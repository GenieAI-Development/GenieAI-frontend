import { describe, expect, it } from "vitest";
import {
  getLocalAnalytics, getLocalDeliveryRuleReply, getPreferenceResponseForMode,
  getSubmittedPreferenceRecord, isDeliveryRequested, parseChipArray,
  parseConversationHistory, parseProfile, parseRankingEvents, parseStringArray,
  parseUserChatHistory,
} from "@/app/api/ai/commerce/request";

const preferences = { budget: "Under Rs. 5,000", giftType: "Flowers", occasion: "Birthday", recipient: "Female" };

describe("commerce request parsing", () => {
  it("routes mode-specific preference payloads", () => {
    expect(getSubmittedPreferenceRecord({ eventUserPreference: preferences }, "Event Planner")).toBe(preferences);
    expect(getPreferenceResponseForMode("Gift Box Builder", preferences)).toEqual({ giftUserPreference: preferences });
    expect(getPreferenceResponseForMode("Shopping", preferences)).toEqual({ extendedPreferences: preferences });
  });

  it("detects delivery wording and localizes the rule", () => {
    expect(isDeliveryRequested("Can this arrive tomorrow?")).toBe(true);
    expect(isDeliveryRequested("Show me roses")).toBe(false);
    expect(getLocalDeliveryRuleReply("Sinhala")).toMatch(/[\u0D80-\u0DFF]/u);
    expect(getLocalDeliveryRuleReply("English")).toContain("at least 1 day");
  });

  it("sanitizes arrays, conversations and chips", () => {
    expect(parseStringArray([" a ", 4, "", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(parseConversationHistory([
      { role: "system", content: "ignore" }, { role: "user", content: " one " },
      { role: "assistant", content: "two" }, { role: "user", content: "three" }, { role: "assistant", content: "four" },
    ])).toEqual([{ role: "assistant", content: "two" }, { role: "user", content: "three" }, { role: "assistant", content: "four" }]);
    expect(parseUserChatHistory([" one ", null, "two", "three", "four"])).toEqual(["two", "three", "four"]);
    expect(parseChipArray(["Check delivery", "A very long useful label", "A very long useful label", "More ideas"], 6)).toEqual(["A very long", "More ideas"]);
  });

  it("accepts only valid and bounded ranking events", () => {
    expect(parseRankingEvents([{ event: "view", productId: " p1 ", price: 100 }, { event: "invalid" }, { event: "purchase", price: -1 }])).toEqual([
      expect.objectContaining({ event: "view", productId: "p1", price: 100 }),
      expect.objectContaining({ event: "purchase", price: undefined }),
    ]);
  });

  it("normalizes profiles and prevents past delivery dates", () => {
    expect(parseProfile({ budget: "5000", date: "2000-01-01", city: 4 })).toMatchObject({ budget: "5000", city: undefined });
    expect(parseProfile(null)).toEqual({ budget: undefined, category: undefined, city: undefined, date: undefined, occasion: undefined, recipient: undefined });
  });

  it("builds deterministic local analytics", () => {
    const result = getLocalAnalytics({ delivery: { available: false } as never, deliveryRequested: true, intent: "command", products: [], profile: { city: "Colombo" }, recommendations: [] });
    expect(result).toEqual({ buyBoxHealth: "No exact live product match", conversionSignal: "Active shopping request", nextBestAction: "Review delivery availability", risk: "Live catalog returned no exact match" });
  });
});
