import { safeJson } from "@/lib/json";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { errorResponse, HttpError, requireUser } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const id = req.nextUrl.searchParams.get("sessionId");
    if (!id) throw new HttpError(400, "Session ID is required");
    const order = await prisma.order.findFirst({ where: { stripePaymentId: id, userId: user.id } });
    if (!order) throw new HttpError(404, "Order not found");
    const session = await getStripe().checkout.sessions.retrieve(id);
    return safeJson({
      id: session.id,
      payment_status: session.payment_status,
      metadata: { userId: user.id, orderId: String(order.id) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
