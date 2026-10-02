import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import prisma from "./prisma";
import { HttpError, positiveInt } from "./http";
import { appUrl, getStripe } from "./stripe";
import { unitCents } from "./money";

type Transaction = Prisma.TransactionClient;

export async function serializable<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
}

export async function reserveStock(
  tx: Transaction,
  items: { inventoryId: number; quantity: number }[],
) {
  // Update in a stable order to reduce deadlocks. The stock predicate prevents overselling.
  for (const item of [...items].sort((a, b) => a.inventoryId - b.inventoryId)) {
    if (!positiveInt(item.quantity)) throw new HttpError(400, "Invalid quantity");
    const result = await tx.inventory.updateMany({
      where: { id: item.inventoryId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (result.count !== 1) throw new HttpError(409, "Not enough stock available");
  }
}

export async function promotionForCheckout(tx: Transaction, code: string, userId: string) {
  const promotion = await tx.promotionCode.findUnique({ where: { code } });
  const now = new Date();
  if (
    !promotion ||
    promotion.status !== "ACTIVE" ||
    promotion.startDate > now ||
    promotion.endDate < now
  ) {
    throw new HttpError(400, "Promotion code is invalid or expired");
  }
  const used = await tx.promotionUsage.findUnique({
    where: { promotionCodeId_userId: { promotionCodeId: promotion.id, userId } },
  });
  if (used)
    throw new HttpError(409, "Promotion code is already used or reserved for another checkout");
  return promotion;
}

export async function startPayment(orderId: number, userId: string) {
  const stripe = getStripe();
  const origin = appUrl();
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { orderItems: { include: { product: true } } },
  });
  if (!order) throw new HttpError(404, "Order not found");
  if (order.isPaid) throw new HttpError(409, "Order is already paid");
  if (!order.stockReserved || !order.orderItems.length)
    throw new HttpError(409, "Checkout has expired. Please create a new order from your cart.");
  // Reuse the existing session rather than creating two payments for one order.
  if (order.stripePaymentId) {
    const existing = await stripe.checkout.sessions.retrieve(order.stripePaymentId);
    if (existing.status === "complete") {
      await completePayment(existing);
      throw new HttpError(409, "Payment has already completed");
    }
    if (existing.status === "open" && existing.url) return existing.url;
    await releaseReservation(order.id, existing.id);
    throw new HttpError(409, "Checkout has expired. Please create a new order from your cart.");
  }
  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ["card"],
      mode: "payment",
      // Use Stripe's default expiry: a changing timestamp would break idempotent retries.
      line_items: order.orderItems.map((item) => ({
        price_data: {
          currency: "thb",
          product_data: { name: item.product.title },
          unit_amount: unitCents(item.price),
        },
        quantity: item.quantity,
      })),
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      client_reference_id: String(order.id),
      metadata: { userId, orderId: String(order.id) },
    },
    { idempotencyKey: `order-${order.id}-checkout` },
  );
  await prisma.order.update({ where: { id: order.id }, data: { stripePaymentId: session.id } });
  if (!session.url) throw new HttpError(502, "Checkout URL is unavailable");
  return session.url;
}

export async function completePayment(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  await serializable(async (tx) => {
    const order = await tx.order.findFirst({
      where: { stripePaymentId: session.id },
      include: { orderItems: true },
    });
    // A webhook can beat the database session update; return an error so Stripe retries.
    if (!order) throw new HttpError(409, "Order is not ready yet");
    if (order.isPaid) return;
    if (
      session.metadata?.userId !== order.userId ||
      session.currency !== "thb" ||
      session.amount_total !== order.totalAmount.mul(100).toNumber()
    ) {
      throw new HttpError(409, "Payment does not match the order");
    }
    if (!order.stockReserved)
      throw new HttpError(409, "Order reservation has already been released");
    await tx.order.update({
      where: { id: order.id },
      data: {
        isPaid: true,
        paymentStatus: "succeeded",
        stockReserved: false,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id,
      },
    });
    // Remove only the quantity purchased; keep items added/edited after checkout started.
    const snapshot = Array.isArray(order.cartSnapshot) ? order.cartSnapshot : [];
    for (const entry of snapshot) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const { id, quantity } = entry;
      if (!positiveInt(id) || !positiveInt(quantity)) continue;
      const cart = await tx.cart.findFirst({ where: { id, userId: order.userId } });
      if (!cart) continue;
      if (cart.quantity <= quantity) await tx.cart.delete({ where: { id: cart.id } });
      else
        await tx.cart.update({
          where: { id: cart.id },
          data: { quantity: { decrement: quantity } },
        });
    }
  });
}

export async function releaseReservation(orderId: number, sessionId?: string) {
  await serializable(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, ...(sessionId ? { stripePaymentId: sessionId } : {}) },
      include: { orderItems: true },
    });
    if (!order || order.isPaid || !order.stockReserved) return;
    await tx.order.update({
      where: { id: order.id },
      data: { stockReserved: false, paymentStatus: "expired" },
    });
    for (const item of order.orderItems) {
      await tx.inventory.update({
        where: { id: item.inventoryId },
        data: { stock: { increment: item.quantity } },
      });
    }
    await tx.promotionUsage.deleteMany({ where: { orderId: order.id } });
  });
}
