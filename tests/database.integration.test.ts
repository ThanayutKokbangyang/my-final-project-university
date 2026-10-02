import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { completePayment, releaseReservation, reserveStock, serializable } from "@/lib/payments";
import { syncInventories } from "@/lib/inventories";

// Opt in only against a dedicated test database; this suite removes only its own fixtures.
const enabled =
  !!process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL === process.env.DATABASE_URL;
describe.skipIf(!enabled)("MySQL reservation and inventory integration", () => {
  const suffix = randomUUID();
  let userId: string;
  let productId: number;
  let inventoryId: number;
  let formulaId: number, ingredientId: number, productTypeId: number, fragranceFamilyId: number;
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `integration-${suffix}@example.test` },
    });
    userId = user.id;
    const [formula, ingredient, productType, fragranceFamily] = await Promise.all([
      prisma.formula.create({ data: { name: suffix } }),
      prisma.ingredient.create({ data: { name: suffix } }),
      prisma.productType.create({ data: { name: suffix } }),
      prisma.fragranceFamily.create({ data: { name: suffix } }),
    ]);
    formulaId = formula.id;
    ingredientId = ingredient.id;
    productTypeId = productType.id;
    fragranceFamilyId = fragranceFamily.id;
    const product = await prisma.product.create({
      data: {
        title: "Integration perfume",
        description: "Test",
        howToUse: "Test",
        image: "test",
        gender: "UNISEX",
        formulaId,
        ingredientId,
        productTypeId,
        fragranceFamilyId,
      },
    });
    productId = product.id;
    const inventory = await prisma.inventory.create({
      data: { productId, size: 10, price: 5, stock: 5 },
    });
    inventoryId = inventory.id;
  });
  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (formulaId) await prisma.formula.delete({ where: { id: formulaId } });
    if (ingredientId) await prisma.ingredient.delete({ where: { id: ingredientId } });
    if (productTypeId) await prisma.productType.delete({ where: { id: productTypeId } });
    if (fragranceFamilyId)
      await prisma.fragranceFamily.delete({ where: { id: fragranceFamilyId } });
    await prisma.$disconnect();
  });
  it("allows only one buyer to reserve the last unit concurrently", async () => {
    await prisma.inventory.update({ where: { id: inventoryId }, data: { stock: 1 } });
    const attempts = await Promise.allSettled(
      [1, 2].map(() => serializable((tx) => reserveStock(tx, [{ inventoryId, quantity: 1 }]))),
    );
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).stock).toBe(
      0,
    );
  });
  it("rolls back stock updates when a later item has insufficient stock", async () => {
    await prisma.inventory.update({ where: { id: inventoryId }, data: { stock: 5 } });
    await expect(
      serializable((tx) =>
        reserveStock(tx, [
          { inventoryId, quantity: 2 },
          { inventoryId: 2147483647, quantity: 1 },
        ]),
      ),
    ).rejects.toThrow();
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).stock).toBe(
      5,
    );
  });
  it("fulfills a payment once and removes only the purchased cart quantity", async () => {
    const cart = await prisma.cart.create({
      data: { userId, productId, inventoryId, quantity: 4 },
    });
    const sessionId = `cs_${suffix}`;
    const order = await serializable(async (tx) => {
      await reserveStock(tx, [{ inventoryId, quantity: 2 }]);
      return tx.order.create({
        data: {
          userId,
          totalAmount: 10,
          stockReserved: true,
          stripePaymentId: sessionId,
          cartSnapshot: [{ id: cart.id, quantity: 2 }],
          orderItems: { create: [{ productId, inventoryId, quantity: 2, price: 5 }] },
        },
      });
    });
    const session = {
      id: sessionId,
      payment_status: "paid",
      currency: "thb",
      amount_total: 1000,
      metadata: { userId },
      payment_intent: "pi_local",
    } as unknown as Stripe.Checkout.Session;
    await completePayment(session);
    await completePayment(session);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).isPaid).toBe(true);
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } })).quantity).toBe(2);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).stock).toBe(
      3,
    );
    await expect(prisma.product.delete({ where: { id: productId } })).rejects.toMatchObject({
      code: "P2003",
    });
  });
  it("releases a reservation once, even with duplicate expiration events", async () => {
    const order = await serializable(async (tx) => {
      await reserveStock(tx, [{ inventoryId, quantity: 1 }]);
      return tx.order.create({
        data: {
          userId,
          totalAmount: 5,
          stockReserved: true,
          orderItems: { create: [{ productId, inventoryId, quantity: 1, price: 5 }] },
        },
      });
    });
    await releaseReservation(order.id);
    await releaseReservation(order.id);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).stock).toBe(
      3,
    );
  });
  it("preserves an inventory ID when editing a referenced size", async () => {
    await prisma.$transaction((tx) =>
      syncInventories(tx, productId, [{ size: 10, price: 6, stock: 3 }]),
    );
    expect(
      (
        await prisma.inventory.findUniqueOrThrow({
          where: { productId_size: { productId, size: 10 } },
        })
      ).id,
    ).toBe(inventoryId);
    await expect(
      prisma.$transaction((tx) => syncInventories(tx, productId, [])),
    ).rejects.toMatchObject({ status: 409 });
  });
});
