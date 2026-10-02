import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/api/auth/authOptions", () => ({ authOptions: {} }));
import { parseInventories, syncInventories } from "@/lib/inventories";
import { Prisma } from "@prisma/client";

describe("inventory edits", () => {
  it("rejects duplicate sizes including equivalent decimal strings", () =>
    expect(() =>
      parseInventories([
        { size: "10.0", price: 100, stock: 1 },
        { size: 10, price: 100, stock: 2 },
      ]),
    ).toThrow("Duplicate"));
  it("rejects negative stock", () =>
    expect(() => parseInventories([{ size: 10, price: 100, stock: -1 }])).toThrow());
  it("upserts retained sizes without deleting existing inventory IDs", async () => {
    const inventory = {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    };
    await syncInventories({ inventory } as unknown as Prisma.TransactionClient, 1, [
      { size: 10, price: 100, stock: 5 },
    ]);
    expect(inventory.deleteMany).toHaveBeenCalledWith({ where: { productId: 1, id: { in: [] } } });
    expect(inventory.upsert).toHaveBeenCalledOnce();
  });
  it("blocks removal of sizes referenced by an order", async () => {
    const inventory = {
      findMany: vi.fn().mockResolvedValue([{ _count: { OrderItem: 1, Cart: 0 } }]),
      deleteMany: vi.fn(),
    };
    await expect(
      syncInventories({ inventory } as unknown as Prisma.TransactionClient, 1, []),
    ).rejects.toMatchObject({ status: 409 });
    expect(inventory.deleteMany).not.toHaveBeenCalled();
  });
});
