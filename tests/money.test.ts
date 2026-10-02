import { describe, expect, it } from "vitest";
import { totalCents, unitCents } from "@/lib/money";
import { lowestAvailablePrice } from "@/lib/catalog";
import { publicData } from "@/lib/json";
import { Prisma } from "@prisma/client";

describe("checkout amounts", () => {
  it("rounds discounted units exactly like Stripe", () => {
    expect(unitCents("10.05", 10)).toBe(905);
    expect(totalCents([{ price: "10.05", quantity: 3 }], 10)).toBe(2715);
  });
  it("avoids floating-point errors", () => expect(unitCents("1.005")).toBe(101));
  it.each([-1, 0, NaN, Infinity])("rejects invalid price %s", (price) =>
    expect(() => unitCents(price)).toThrow(),
  );
  it.each([-1, 101, NaN])("rejects invalid discount %s", (rate) =>
    expect(() => unitCents(100, rate)).toThrow(),
  );
  it.each([-1, 0, 1.5, NaN])("rejects invalid quantity %s", (quantity) =>
    expect(() => totalCents([{ price: 100, quantity }])).toThrow(),
  );
});

describe("catalog", () => {
  it("uses in-stock prices only", () =>
    expect(
      lowestAvailablePrice([
        { stock: 0, price: 20 },
        { stock: 2, price: "100" },
      ]),
    ).toBe(100));
  it("handles an empty inventory without Infinity", () =>
    expect(lowestAvailablePrice([])).toBeNull());
});

describe("API privacy and rich text", () => {
  it("removes password, reset, and OAuth credentials recursively", () => {
    expect(
      publicData({
        password: "hash",
        name: "Tae",
        accounts: [
          {
            provider: "google",
            access_token: "secret",
            refresh_token: "secret",
            id_token: "secret",
          },
        ],
        resetPasswordToken: "secret",
      }),
    ).toEqual({ name: "Tae", accounts: [{ provider: "google" }] });
  });
  it("sanitizes legacy rich text on read and preserves basic formatting", () => {
    const result = publicData({
      description:
        '<p><strong>Perfume</strong><script>alert(1)</script><img src="https://example.com/a.jpg" onerror="alert(2)"><a href="javascript:alert(3)">link</a></p>',
    }) as { description: string };
    expect(result.description).toContain("<strong>Perfume</strong>");
    expect(result.description).not.toMatch(/script|onerror|javascript/);
  });
  it("serializes dates and Prisma decimals", () =>
    expect(
      publicData({ date: new Date("2026-01-01"), price: new Prisma.Decimal("10.50") }),
    ).toEqual({ date: "2026-01-01T00:00:00.000Z", price: "10.5" }));
});
