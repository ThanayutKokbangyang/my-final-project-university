import { safeJson } from "@/lib/json";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError, positiveInt, readBody, requireUser } from "@/lib/http";
import { startPayment } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readBody(req);
    if (!positiveInt(body.orderId)) throw new HttpError(400, "Order ID is required");
    return safeJson({ url: await startPayment(body.orderId, user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
