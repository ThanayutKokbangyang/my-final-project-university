import { Prisma } from "@prisma/client";
import { HttpError } from "./http";

export function parseInventories(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, "Invalid inventories");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new HttpError(400, "Invalid inventory");
    const { size, price, stock } = item;
    if (
      ![size, price].every((n) => typeof n === "number" || typeof n === "string") ||
      !Number.isFinite(Number(size)) ||
      Number(size) <= 0 ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0 ||
      !Number.isSafeInteger(stock) ||
      stock < 0
    )
      throw new HttpError(
        400,
        "Size and price must be positive; stock must be a non-negative integer",
      );
    const key = new Prisma.Decimal(size).toString();
    if (seen.has(key)) throw new HttpError(400, "Duplicate inventory size");
    seen.add(key);
    return {
      size: new Prisma.Decimal(size),
      price: new Prisma.Decimal(price),
      stock: stock as number,
    };
  });
}

export async function syncInventories(
  tx: Prisma.TransactionClient,
  productId: number,
  value: unknown,
) {
  const inventories = parseInventories(value);
  const removed = await tx.inventory.findMany({
    where: { productId, size: { notIn: inventories.map((item) => item.size) } },
    include: { _count: { select: { OrderItem: true, Cart: true } } },
  });
  if (removed.some((item) => item._count.OrderItem > 0 || item._count.Cart > 0)) {
    throw new HttpError(
      409,
      "This size is referenced by a cart or order. Keep the size and set stock to zero instead.",
    );
  }
  await tx.inventory.deleteMany({
    where: { productId, id: { in: removed.map((item) => item.id) } },
  });
  for (const item of inventories) {
    await tx.inventory.upsert({
      where: { productId_size: { productId, size: item.size } },
      update: item,
      create: { productId, ...item },
    });
  }
}
