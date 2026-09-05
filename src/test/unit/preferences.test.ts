import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/productCatalog";
import {
  cleanExtendedPreference, formatBudgetFilter, getPreferenceRelevanceTerms,
  getSearchQuery, inferBudgetPreference, inferMessageIntent, inferOccasionPreference,
  inferPresetCategoryFromGiftType, inferRecipientPreference, isProductInsideBudget,
  isProductRelevantToPreferences, normalizeAnalyzedSearchQuery, normalizeDetectedLanguage,
  parseBudgetFilter, parseExtendedPreferences,
} from "@/app/api/ai/commerce/preferences";

const profile = { budget: "", category: "Flowers", city: "Colombo", date: "2027-01-01", occasion: "Birthday", recipient: "Mother" };
const product: Product = { id: "1", name: "Rose Bouquet", imageUrl: "/x", category: "Flowers", price: 5000, currency: "LKR", stock: 1, stockLabel: "In stock", eta: "Tomorrow", description: "Fresh red roses", url: "#" };

describe("commerce preferences", () => {
  it.each([
    ["under Rs. 5k", { max_price: 5000 }],
    ["above LKR 10000", { min_price: 10000 }],
    ["between 2,500 and 5,000", { min_price: 2500, max_price: 5000 }],
    ["budget is 7500", { max_price: 7500 }],
    ["5000", { max_price: 5000 }],
    ["for my mother", {}],
  ])("parses budget %s", (input, expected) => expect(parseBudgetFilter(input)).toEqual(expected));

  it("formats and applies budget filters", () => {
    expect(formatBudgetFilter({ min_price: 2000, max_price: 6000 })).toBe("LKR 2,000-LKR 6,000");
    expect(isProductInsideBudget(product, { max_price: 5000 })).toBe(true);
    expect(isProductInsideBudget({ ...product, currency: "USD" }, {})).toBe(false);
  });

  it("normalizes and falls back extended preferences", () => {
    expect(cleanExtendedPreference("  roses\n and   cake ")).toBe("roses and cake");
    expect(parseExtendedPreferences({ budget: "  " }, profile)).toEqual({ budget: "", giftType: "Flowers", occasion: "Birthday", recipient: "Mother" });
  });

  it("expands known categories and validates relevance", () => {
    expect(getPreferenceRelevanceTerms("gift", profile)).toContain("bouquet");
    expect(isProductRelevantToPreferences({ id: "1", name: "Rose Bouquet", category: { name: "Flowers" } }, "gift", profile)).toBe(true);
    expect(isProductRelevantToPreferences({ id: "2", name: "Laptop", category: { name: "Electronics" } }, "gift", profile)).toBe(false);
  });

  it("builds useful catalog queries", () => {
    expect(getSearchQuery("find me a gift please", profile, "Shopping")).toBe("roses bouquet");
    expect(normalizeAnalyzedSearchQuery("gift", profile)).toBe("roses bouquet");
  });

  it("infers intent and common preference dimensions", () => {
    expect(inferMessageIntent("Can you help?")).toBe("question");
    expect(inferMessageIntent("show roses")).toBe("command");
    expect(inferMessageIntent(" ")).toBe("conversation");
    expect(inferBudgetPreference("below 5000")).toBe("Below Rs. 5,000");
    expect(inferBudgetPreference("between 5000 and 10000")).toBe("Rs. 5,000 - 10,000");
    expect(inferBudgetPreference("above 10000")).toBe("Above Rs. 10,000");
    expect(inferOccasionPreference("graduation present")).toBe("Graduation");
    expect(inferRecipientPreference("for my mum")).toBe("Female");
    expect(inferPresetCategoryFromGiftType("rose bouquet")).toBe("Flowers");
    expect(normalizeDetectedLanguage("invalid", "English")).toBe("English");
  });
});
