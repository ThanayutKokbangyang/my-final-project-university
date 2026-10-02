import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  tx: {
    address: { findFirst: vi.fn() },
    cart: { findMany: vi.fn() },
    inventory: { updateMany: vi.fn() },
    order: { findMany: vi.fn(), create: vi.fn() },
    promotionCode: { findUnique: vi.fn() },
    promotionUsage: { findUnique: vi.fn(), create: vi.fn() },
  },
  order: { findFirst: vi.fn(), update: vi.fn() },
  sessions: { create: vi.fn(), retrieve: vi.fn() },
  session: vi.fn(),
}));
vi.mock("next-auth/next", () => ({ getServerSession: mocks.session }));
vi.mock("@/app/api/auth/authOptions", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(mocks.tx)),
    order: mocks.order,
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: mocks.sessions } }),
  appUrl: () => "http://localhost:3000",
}));
import { POST } from "@/app/api/checkout/route";
function request(patch = {}) {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify({
      addressId: 3,
      selectedItems: [1],
      userId: "victim",
      amountToPay: "0.01",
      ...patch,
    }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "owner", role: "USER" } });
  mocks.tx.address.findFirst.mockResolvedValue({ id: 3 });
  mocks.tx.cart.findMany.mockResolvedValue([
    {
      id: 1,
      productId: 5,
      inventoryId: 6,
      quantity: 2,
      inventory: { productId: 5, price: new Prisma.Decimal(100) },
    },
  ]);
  mocks.tx.inventory.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.order.findMany.mockResolvedValue([]);
  mocks.tx.order.create.mockImplementation(async ({ data }) => ({ id: 10, ...data }));
  mocks.order.findFirst.mockResolvedValue({
    id: 10,
    userId: "owner",
    isPaid: false,
    stockReserved: true,
    orderItems: [{ price: new Prisma.Decimal(100), quantity: 2, product: { title: "Perfume" } }],
  });
  mocks.sessions.create.mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.com/test",
  });
});
describe("checkout trust boundary", () => {
  it("ignores caller userId and total, and calculates the total from database prices", async () => {
    expect((await POST(request())).status).toBe(200);
    const data = mocks.tx.order.create.mock.calls[0][0].data;
    expect(data.userId).toBe("owner");
    expect(data.totalAmount.toString()).toBe("200");
    expect(mocks.tx.address.findFirst).toHaveBeenCalledWith({ where: { id: 3, userId: "owner" } });
    expect(mocks.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { userId: "owner", orderId: "10" } }),
      { idempotencyKey: "order-10-checkout" },
    );
  });
  it("rejects an address owned by another user", async () => {
    mocks.tx.address.findFirst.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.tx.inventory.updateMany).not.toHaveBeenCalled();
  });
  it("rejects another user's cart item IDs", async () => {
    mocks.tx.cart.findMany.mockResolvedValue([]);
    expect((await POST(request())).status).toBe(400);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });
  it("prevents a second checkout for the same cart rows", async () => {
    mocks.tx.order.findMany.mockResolvedValue([{ cartSnapshot: [{ id: 1, quantity: 2 }] }]);
    expect((await POST(request())).status).toBe(409);
    expect(mocks.tx.inventory.updateMany).not.toHaveBeenCalled();
  });
  it("rejects corrupted cart quantities before creating a payment", async () => {
    mocks.tx.cart.findMany.mockResolvedValue([
      {
        id: 1,
        productId: 5,
        inventoryId: 6,
        quantity: -1,
        inventory: { productId: 5, price: new Prisma.Decimal(100) },
      },
    ]);
    expect((await POST(request())).status).toBe(400);
    expect(mocks.sessions.create).not.toHaveBeenCalled();
  });
});
