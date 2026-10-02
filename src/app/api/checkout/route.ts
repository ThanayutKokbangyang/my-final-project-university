import { safeJson } from "@/lib/json";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  errorResponse,
  HttpError,
  positiveIds,
  positiveInt,
  readBody,
  requireUser,
} from "@/lib/http";
import { promotionForCheckout, reserveStock, serializable, startPayment } from "@/lib/payments";
import { getStripe, appUrl } from "@/lib/stripe";
import { unitCents } from "@/lib/money";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readBody(req);
    const ids = positiveIds(body.selectedItems);
    if (!positiveInt(body.addressId)) throw new HttpError(400, "Address ID is required");
    const addressId = body.addressId;
    if (body.promotionCode != null && typeof body.promotionCode !== "string")
      throw new HttpError(400, "Invalid promotion code");
    const code = typeof body.promotionCode === "string" ? body.promotionCode.trim() : "";
    getStripe();
    appUrl();
    const order = await serializable(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: addressId, userId: user.id } });
      if (!address) throw new HttpError(403, "Address does not belong to this user");
      const items = await tx.cart.findMany({
        where: { userId: user.id, id: { in: ids } },
        include: { inventory: true },
      });
      if (items.length !== ids.length) throw new HttpError(400, "Some cart items are unavailable");
      const pending = await tx.order.findMany({ where: { userId: user.id, stockReserved: true } });
      if (
        pending.some(
          (order) =>
            Array.isArray(order.cartSnapshot) &&
            order.cartSnapshot.some(
              (entry) =>
                entry &&
                typeof entry === "object" &&
                !Array.isArray(entry) &&
                ids.includes(Number(entry.id)),
            ),
        )
      ) {
        throw new HttpError(
          409,
          "These cart items already have a pending checkout. Pay or cancel it from your orders.",
        );
      }
      const promotion = code ? await promotionForCheckout(tx, code, user.id) : null;
      const orderItems = items.map((item) => {
        if (item.productId !== item.inventory.productId)
          throw new HttpError(400, "Product and inventory do not match");
        return {
          productId: item.productId,
          inventoryId: item.inventoryId,
          quantity: item.quantity,
          price: new Prisma.Decimal(
            unitCents(item.inventory.price, promotion?.discountPercentage ?? 0),
          ).div(100),
        };
      });
      const total = orderItems.reduce(
        (sum, item) => sum.add(item.price.mul(item.quantity)),
        new Prisma.Decimal(0),
      );
      await reserveStock(tx, orderItems);
      const created = await tx.order.create({
        data: {
          userId: user.id,
          addressId,
          totalAmount: total,
          paymentStatus: "pending",
          stockReserved: true,
          promotionCodeId: promotion?.id,
          cartSnapshot: items.map(({ id, quantity }) => ({ id, quantity })),
          orderItems: { create: orderItems },
        },
      });
      if (promotion)
        await tx.promotionUsage.create({
          data: { promotionCodeId: promotion.id, userId: user.id, orderId: created.id },
        });
      return created;
    });
    // The order is retained if Stripe is temporarily unavailable. Pay-later uses the
    // same idempotency key to recover an ambiguous session-creation result safely.
    const url = await startPayment(order.id, user.id);
    return safeJson({ url, orderId: order.id });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
