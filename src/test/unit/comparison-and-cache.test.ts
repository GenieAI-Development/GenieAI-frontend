import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/productCatalog";
import { getCachedValue } from "@/app/api/ai/commerce/cache";
import { getDeterministicCompareSummary, getDeterministicComparisonInsights, hasAvailableStock } from "@/app/api/ai/commerce/comparison";

const product = (id: string, price: number, stock: number, category = "Gifts"): Product => ({ id, name: `Product ${id}`, imageUrl: "/x", category, price, currency: "LKR", stock, stockLabel: stock ? "In stock" : "Out of stock", eta: "Soon", description: `${category} birthday present with a detailed description`, url: "#" });

describe("comparison and cache", () => {
  it("deduplicates concurrent cache loads and reloads expired values", async () => {
    vi.useFakeTimers();
    const cache = new Map();
    const load = vi.fn().mockResolvedValue("value");
    const first = getCachedValue(cache, "key", 1000, 3, load);
    const second = getCachedValue(cache, "key", 1000, 3, load);
    expect(first).toBe(second);
    expect(await first).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    await getCachedValue(cache, "key", 1000, 3, load);
    expect(load).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("removes failed cache entries", async () => {
    const cache = new Map();
    await expect(getCachedValue(cache, "bad", 1000, 3, () => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
    expect(cache.has("bad")).toBe(false);
  });

  it("compares price, stock, category and contextual fit", () => {
    const products = [product("A", 3000, 1, "Flowers"), product("B", 5000, 0, "Cakes")];
    expect(hasAvailableStock(products[0])).toBe(true);
    expect(getDeterministicCompareSummary(products)).toContain("Product A is cheaper by LKR 2,000");
    const insights = getDeterministicComparisonInsights(products, { occasion: "Birthday", recipient: "" });
    expect(insights[0].insights.find((i) => i.label === "Occasion Match")?.percentage).toBeGreaterThan(68);
    expect(insights[0].insights.find((i) => i.label === "Recipient Match")?.percentage).toBeNull();
  });
});
