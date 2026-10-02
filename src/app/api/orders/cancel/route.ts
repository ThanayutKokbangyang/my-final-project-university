import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, HttpError, positiveInt, readBody, requireUser } from "@/lib/http";
import { safeJson } from "@/lib/json";
import { completePayment, releaseReservation, startPayment } from "@/lib/payments";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { orderId } = await readBody(req);
    if (!positiveInt(orderId)) throw new HttpError(400, "Order ID is required");
    let order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.isPaid) throw new HttpError(409, "Paid orders cannot be cancelled here");
    if (!order.stockReserved) return safeJson({ cancelled: true });
    if (!order.stripePaymentId) {
      // Recover a session whose create response may have been lost before expiring it.
      await startPayment(order.id, user.id);
      order = await prisma.order.findUnique({ where: { id: order.id } });
    }
    if (!order?.stripePaymentId) throw new HttpError(409, "Payment session is not ready");
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(order.stripePaymentId);
    if (session.status === "complete") {
      await completePayment(session);
      throw new HttpError(409, "Payment has already completed");
    }
    if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
    await releaseReservation(order.id, session.id);
    return safeJson({ cancelled: true });
  } catch (error) {
    return errorResponse(error);
  }
}
