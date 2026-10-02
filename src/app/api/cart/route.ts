import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, HttpError, positiveInt, readBody, requireUser } from "@/lib/http";
import { safeJson } from "@/lib/json";
import { serializable } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { productId, inventoryId, quantity = 1 } = await readBody(req);
    if (!positiveInt(productId) || !positiveInt(inventoryId) || !positiveInt(quantity))
      throw new HttpError(400, "Positive product, inventory, and quantity values are required");
    const result = await serializable(async (tx) => {
      const inventory = await tx.inventory.findUnique({ where: { id: inventoryId } });
      if (!inventory) throw new HttpError(404, "Inventory not found");
      if (inventory.productId !== productId)
        throw new HttpError(400, "Product and inventory do not match");
      const existing = await tx.cart.findFirst({ where: { userId: user.id, inventoryId } });
      const newQuantity = (existing?.quantity ?? 0) + quantity;
      if (!Number.isSafeInteger(newQuantity) || newQuantity > inventory.stock)
        throw new HttpError(400, "Not enough stock available");
      const cartItem = existing
        ? await tx.cart.update({ where: { id: existing.id }, data: { quantity: newQuantity } })
        : await tx.cart.create({
            data: { userId: user.id, productId, inventoryId, quantity },
            include: { product: true, inventory: true },
          });
      return { message: "Cart updated", cartItem, newItem: !existing };
    });
    return safeJson(result);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET() {
  try {
    const user = await requireUser();
    const cartItems = await prisma.cart.findMany({
      where: { userId: user.id },
      include: { product: true, inventory: true },
      orderBy: { id: "asc" },
    });
    return safeJson({ cartItems });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const { inventoryId, quantity } = await readBody(req);
    if (!positiveInt(inventoryId) || !positiveInt(quantity))
      throw new HttpError(400, "Positive inventory and quantity values are required");
    const result = await serializable(async (tx) => {
      const item = await tx.cart.findFirst({
        where: { userId: user.id, inventoryId },
        include: { inventory: true },
      });
      if (!item) throw new HttpError(404, "Item not found in cart");
      if (quantity > item.inventory.stock) throw new HttpError(400, "Not enough stock available");
      return tx.cart.update({ where: { id: item.id }, data: { quantity } });
    });
    return safeJson({ message: "Product quantity updated", cartItem: result });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { inventoryId } = await readBody(req);
    if (!positiveInt(inventoryId)) throw new HttpError(400, "Inventory ID is required");
    const result = await prisma.cart.deleteMany({ where: { userId: user.id, inventoryId } });
    if (!result.count) throw new HttpError(404, "Item not found in cart");
    return safeJson({ message: "Product removed from cart" });
  } catch (error) {
    return errorResponse(error);
  }
}
export const dynamic = "force-dynamic";
