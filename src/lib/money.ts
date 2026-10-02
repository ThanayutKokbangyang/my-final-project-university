import { Prisma } from "@prisma/client";

// Round once per unit so the database total exactly matches Stripe's line items.
export function unitCents(
  price: Prisma.Decimal | string | number,
  discount: Prisma.Decimal | string | number = 0,
) {
  const rate = new Prisma.Decimal(discount);
  const amount = new Prisma.Decimal(price);
  if (!rate.isFinite() || rate.lt(0) || rate.gt(100) || !amount.isFinite() || amount.lte(0)) {
    throw new Error("Invalid price or discount");
  }
  const cents = amount
    .mul(100)
    .mul(new Prisma.Decimal(1).sub(rate.div(100)))
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new Error("Price must be at least one satang");
  return cents;
}

export function totalCents(
  items: { price: Prisma.Decimal | string | number; quantity: number }[],
  discount: Prisma.Decimal | string | number = 0,
) {
  return items.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
      throw new Error("Invalid quantity");
    const total = sum + unitCents(item.price, discount) * item.quantity;
    if (!Number.isSafeInteger(total)) throw new Error("Total is too large");
    return total;
  }, 0);
}
