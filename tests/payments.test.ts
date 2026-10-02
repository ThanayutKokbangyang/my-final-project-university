import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  tx: {
    order: { findFirst: vi.fn(), update: vi.fn() },
    inventory: { update: vi.fn(), updateMany: vi.fn() },
    cart: { findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    promotionUsage: { deleteMany: vi.fn(), findUnique: vi.fn() },
    promotionCode: { findUnique: vi.fn() },
  },
  findFirst: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(mocks.tx)),
    order: { findFirst: mocks.findFirst, update: mocks.update },
  },
}));
vi.mock("@/lib/stripe", () => ({
  appUrl: () => "http://localhost:3000",
  getStripe: () => ({ checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } } }),
}));
vi.mock("@/app/api/auth/authOptions", () => ({ authOptions: {} }));
import {
  completePayment,
  promotionForCheckout,
  releaseReservation,
  reserveStock,
  startPayment,
} from "@/lib/payments";

function order() {
  return {
    id: 1,
    userId: "owner",
    isPaid: false,
    stockReserved: true,
    totalAmount: new Prisma.Decimal(10),
    stripePaymentId: "cs_test",
    cartSnapshot: [{ id: 10, quantity: 2 }],
    orderItems: [{ inventoryId: 5, quantity: 2 }],
  };
}
function payment(overrides = {}) {
  return {
    id: "cs_test",
    payment_status: "paid",
    currency: "thb",
    amount_total: 1000,
    payment_intent: "pi_test",
    metadata: { userId: "owner" },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}
beforeEach(() => vi.resetAllMocks());

describe("payment lifecycle", () => {
  it("rejects pay-later for another user's order", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(startPayment(1, "intruder")).rejects.toMatchObject({ status: 404 });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, userId: "intruder" } }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reuses an open checkout session", async () => {
    mocks.findFirst.mockResolvedValue({ ...order(), orderItems: [{}] });
    mocks.retrieve.mockResolvedValue({ status: "open", url: "https://checkout.stripe.com/test" });
    expect(await startPayment(1, "owner")).toBe("https://checkout.stripe.com/test");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps the same create parameters when recovering a lost response later", async () => {
    mocks.findFirst.mockResolvedValue({
      ...order(),
      stripePaymentId: null,
      orderItems: [{ price: new Prisma.Decimal(5), quantity: 2, product: { title: "Perfume" } }],
    });
    mocks.create.mockResolvedValue({ id: "cs_recovered", url: "https://checkout.stripe.com/test" });
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000000000000);
    try {
      await startPayment(1, "owner");
      clock.mockReturnValue(1000000060000);
      await startPayment(1, "owner");
      expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1]);
      expect(mocks.create.mock.calls[0][1]).toEqual({ idempotencyKey: "order-1-checkout" });
    } finally {
      clock.mockRestore();
    }
  });
  it("does nothing for a session that is not paid", async () => {
    await completePayment(payment({ payment_status: "unpaid" }));
    expect(mocks.tx.order.findFirst).not.toHaveBeenCalled();
  });
  it("does not fulfill a duplicate webhook twice", async () => {
    mocks.tx.order.findFirst.mockResolvedValue({ ...order(), isPaid: true });
    await completePayment(payment());
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.tx.cart.delete).not.toHaveBeenCalled();
  });
  it.each([{ amount_total: 999 }, { currency: "usd" }, { metadata: { userId: "intruder" } }])(
    "rejects a mismatched payment %s",
    async (overrides) => {
      mocks.tx.order.findFirst.mockResolvedValue(order());
      await expect(completePayment(payment(overrides))).rejects.toMatchObject({ status: 409 });
      expect(mocks.tx.order.update).not.toHaveBeenCalled();
    },
  );
  it("retains items added to the cart after checkout started", async () => {
    mocks.tx.order.findFirst.mockResolvedValue(order());
    mocks.tx.cart.findFirst.mockResolvedValue({ id: 10, quantity: 5 });
    await completePayment(payment());
    expect(mocks.tx.cart.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { quantity: { decrement: 2 } },
    });
    expect(mocks.tx.inventory.update).not.toHaveBeenCalled();
    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true, paymentStatus: "succeeded" }),
      }),
    );
  });
  it("returns an error for a webhook arriving before the session was saved", async () => {
    mocks.tx.order.findFirst.mockResolvedValue(null);
    await expect(completePayment(payment())).rejects.toMatchObject({ status: 409 });
  });
  it("restocks an expired reservation and releases its coupon", async () => {
    mocks.tx.order.findFirst.mockResolvedValue(order());
    await releaseReservation(1, "cs_test");
    expect(mocks.tx.inventory.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { stock: { increment: 2 } },
    });
    expect(mocks.tx.promotionUsage.deleteMany).toHaveBeenCalledWith({ where: { orderId: 1 } });
  });
  it.each([{ isPaid: true }, { stockReserved: false }])(
    "does not restock twice or restock a paid order %s",
    async (patch) => {
      mocks.tx.order.findFirst.mockResolvedValue({ ...order(), ...patch });
      await releaseReservation(1);
      expect(mocks.tx.inventory.update).not.toHaveBeenCalled();
    },
  );
  it("uses a conditional stock decrement and rejects insufficient stock", async () => {
    mocks.tx.inventory.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      reserveStock(mocks.tx as unknown as Prisma.TransactionClient, [
        { inventoryId: 5, quantity: 2 },
      ]),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 5, stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
  });
  it("checks dates even if the promotion status is still ACTIVE", async () => {
    mocks.tx.promotionCode.findUnique.mockResolvedValue({
      status: "ACTIVE",
      startDate: new Date("2020-01-01"),
      endDate: new Date("2020-02-01"),
    });
    await expect(
      promotionForCheckout(mocks.tx as unknown as Prisma.TransactionClient, "OLD", "owner"),
    ).rejects.toMatchObject({ status: 400 });
  });
});
