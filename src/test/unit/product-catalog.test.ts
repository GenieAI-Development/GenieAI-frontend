import { describe, expect, it } from "vitest";
import { cleanProductDescription } from "@/lib/productDescription";
import { formatPrice, toProduct } from "@/lib/productCatalog";

describe("product catalog", () => {
  it.each([
    ["Clean&nbsp;  text", "Clean text"],
    ["Complete sentence. Cut off...", "Complete sentence."],
    ["Only a cutoff…", "Only a cutoff"],
    ["Already complete.", "Already complete."],
  ])("cleans descriptions", (input, expected) => {
    expect(cleanProductDescription(input)).toBe(expected);
  });

  it("normalizes a catalog product and preserves flattened API details", () => {
    const product = toProduct({
      id: "p-1", name: "Rose Box", summary: "Lovely gift...", in_stock: true,
      stock_level: "low", image_url: "/rose.png", url: "https://shop.test/p-1",
      price: { amount: 4500, currency: "LKR" }, category: { name: "Flowers" },
      metadata: { color: "red", tags: ["romantic"] },
    });
    expect(product).toMatchObject({ id: "p-1", name: "Rose Box", price: 4500, currency: "LKR", category: "Flowers", stock: 1, stockLabel: "In stock (low)", description: "Lovely gift" });
    expect(product?.apiDetails).toContainEqual({ label: "metadata.color", value: "red" });
    expect(product?.apiDetails).toContainEqual({ label: "metadata.tags.1", value: "romantic" });
  });

  it("uses safe defaults and rejects products without identity", () => {
    expect(toProduct({ name: "Missing id" })).toBeNull();
    expect(toProduct({ id: "p-2", name: "Gift" })).toMatchObject({ imageUrl: "/product-images/gift-box.svg", price: 0, currency: "LKR", category: "General", stockLabel: "Out of stock", url: "#" });
  });

  it("formats LKR, foreign currency, and invalid values", () => {
    expect(formatPrice(12500)).toBe("Rs. 12,500");
    expect(formatPrice(12.5, "USD")).toBe("USD 12.5");
    expect(formatPrice(Number.NaN)).toBe("Rs. 0");
  });
});
