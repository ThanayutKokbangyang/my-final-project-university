export interface CatalogInventory {
  price: string | number;
  stock: number;
}
export function lowestAvailablePrice(inventories: CatalogInventory[]) {
  const prices = inventories
    .filter((item) => item.stock > 0)
    .map((item) => Number(item.price))
    .filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : null;
}
