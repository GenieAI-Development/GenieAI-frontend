import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/productCatalog";
import {
  fallbackRecommendations, getLanguageSafeReply, isNoMatchStyleReply,
  isReplyInSelectedLanguage, orderProductsByRecommendation, parseCommerceResponse,
  parseGiftMessagePreferences, parseRecommendations, sanitizeChatReply,
} from "@/app/api/ai/commerce/recommendations";

const products: Product[] = ["one", "two", "three"].map((id, index) => ({ id, name: `Product ${id}`, imageUrl: "/x", category: "Gifts", price: 1000 + index, currency: "LKR", stock: 1, stockLabel: "In stock", eta: "Soon", description: "A gift", url: "#" }));

describe("commerce recommendations", () => {
  it("parses known product recommendations and clamps scores", () => {
    expect(parseRecommendations([{ id: "one", fitScore: 9.2, reason: "Great" }, { id: "two", fitScore: 120 }, { id: "missing" }], products)).toEqual([
      { id: "one", fitScore: 92, reason: "Great" },
      { id: "two", fitScore: 100, reason: "Good match from the live catalog." },
    ]);
  });

  it("parses structured responses and safely falls back on malformed JSON", () => {
    const parsed = parseCommerceResponse(JSON.stringify({ reply: "Hello", mode: "Compare", chips: ["More"], recommendations: [{ id: "one" }], analytics: { risk: "Low" } }), "Shopping", products);
    expect(parsed).toMatchObject({ reply: "Hello", mode: "Compare", chips: ["More"], recommendations: [{ id: "one", fitScore: 80, reason: expect.any(String) }], analytics: { risk: "Low" } });
    expect(parseCommerceResponse("plain answer", "Shopping", products)).toMatchObject({ reply: "plain answer", mode: "Shopping" });
  });

  it("validates language-specific replies", () => {
    expect(isReplyInSelectedLanguage("මෙය හොඳ තෑග්ගක්", "Sinhala")).toBe(true);
    expect(isReplyInSelectedLanguage("oyage gift eka hoyala dennam", "Singlish")).toBe(true);
    expect(isReplyInSelectedLanguage("This is an English answer", "Singlish")).toBe(false);
    expect(getLanguageSafeReply("Sinhala", "English", "හොඳයි")).toBe("හොඳයි");
  });

  it("removes card-specific and list content from chat replies", () => {
    expect(sanitizeChatReply("Here are ideas. Product one is perfect.\n- Product two.\nEnjoy browsing!", products)).toBe("Here are ideas. Enjoy browsing!");
    expect(isNoMatchStyleReply("I could not find an exact match within your budget")).toBe(true);
  });

  it("orders ranked products before the remaining catalog", () => {
    expect(orderProductsByRecommendation(products, [{ id: "three", fitScore: 90, reason: "x" }]).map((p) => p.id)).toEqual(["three", "one", "two"]);
    expect(fallbackRecommendations(products).map((r) => r.fitScore)).toEqual([92, 88, 84]);
    expect(parseGiftMessagePreferences({ language: "Sinhala", size: 4 })).toEqual({ language: "Sinhala", size: undefined, suggestions: undefined, tone: undefined });
  });
});
