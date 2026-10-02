import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  user: { update: vi.fn(), findUnique: vi.fn() },
  verificationToken: { findUnique: vi.fn() },
  transaction: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
  order: { findFirst: vi.fn() },
}));
vi.mock("next-auth/next", () => ({ getServerSession: mocks.session }));
vi.mock("@/app/api/auth/authOptions", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: mocks.user,
    verificationToken: mocks.verificationToken,
    $transaction: mocks.transaction,
    order: mocks.order,
  },
}));
vi.mock("@/lib/payments", () => ({
  completePayment: mocks.complete,
  releaseReservation: mocks.release,
  serializable: vi.fn(),
  reserveStock: vi.fn(),
  startPayment: vi.fn(),
  promotionForCheckout: vi.fn(),
}));
import { POST as webhook } from "@/app/api/webhook/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { PUT as updateUser } from "@/app/api/user/route";
import { GET as verifyEmail } from "@/app/api/auth/verify-email/route";
const stripe = new Stripe("sk_test_local");
const secret = "whsec_local_test";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_local";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
});

function request(url: string, method: string, body: unknown, headers = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("security regression routes", () => {
  it("rejects an unsigned webhook", async () =>
    expect(
      (await webhook(request("/api/webhook", "POST", { type: "checkout.session.completed" })))
        .status,
    ).toBe(400));
  it("rejects a forged signature without calling fulfillment", async () => {
    const response = await webhook(
      request("/api/webhook", "POST", "{}", { "stripe-signature": "t=1,v1=forged" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("accepts an authenticated Stripe event", async () => {
    const payload = JSON.stringify({
      id: "evt_local",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test", payment_status: "paid" } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const response = await webhook(
      request("/api/webhook", "POST", payload, { "stripe-signature": signature }),
    );
    expect(response.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledOnce();
  });
  it("returns a retryable error when fulfillment fails", async () => {
    mocks.complete.mockRejectedValue(new Error("Database temporarily unavailable"));
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(
      (await webhook(request("/api/webhook", "POST", payload, { "stripe-signature": signature })))
        .status,
    ).toBe(500);
  });
  it("rejects unauthenticated checkout even with a forged userId", async () => {
    mocks.session.mockResolvedValue(null);
    expect(
      (
        await checkout(
          request("/api/checkout", "POST", { userId: "victim", addressId: 1, selectedItems: [1] }),
        )
      ).status,
    ).toBe(401);
  });
  it("rejects malformed JSON", async () => {
    mocks.session.mockResolvedValue({ user: { id: "owner" } });
    expect((await checkout(request("/api/checkout", "POST", "{broken"))).status).toBe(400);
  });
  it("requires the current password for a password change", async () => {
    mocks.session.mockResolvedValue({ user: { id: "owner", role: "USER" } });
    const response = await updateUser(
      request("/api/user", "PUT", { userIdParam: "owner", newPassword: "longpassword" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });
  it("rejects expired email verification tokens", async () => {
    mocks.verificationToken.findUnique.mockResolvedValue({ expires: new Date("2020-01-01") });
    const response = await verifyEmail(
      new NextRequest("http://localhost/api/auth/verify-email?token=expired"),
    );
    expect(response.status).toBe(400);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });
});
