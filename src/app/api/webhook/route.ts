import { safeJson } from "@/lib/json";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { completePayment, releaseReservation } from "@/lib/payments";
import { errorResponse, HttpError } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new HttpError(503, "Webhook is not configured");
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new HttpError(400, "Missing webhook signature");
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
    } catch {
      throw new HttpError(400, "Invalid webhook signature");
    }
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await completePayment(event.data.object as Stripe.Checkout.Session);
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const order = await prisma.order.findFirst({ where: { stripePaymentId: session.id } });
      if (!order) throw new HttpError(409, "Order is not ready yet");
      await releaseReservation(order.id, session.id);
    }
    return safeJson({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
