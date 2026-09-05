import { describe, expect, it } from "vitest";
import {
  applyExtendedPreferenceUpdates, buildBudgetRangeValue, divideBudgetAcrossItems,
  getPreferencePayloadForMode, getPreferenceStateForMode, getTaskForMode,
  getValidatedPhoneNumber, havePreferenceValuesChanged, normalizeExtendedPreferences,
  parseBudgetAmount, parseBudgetRangeValue, removeEmojiForSpeech,
} from "@/genie-ai/utils";

const profile = { budget: "5000", category: "Flowers", city: "Colombo", date: "2099-01-01", interests: "gifts", occasion: "Birthday", recipient: "Mother" };
const prefs = { budget: "5000", giftType: "Flowers", occasion: "Birthday", recipient: "Mother", replyCount: 1, lastRepliedCount: 0 };

describe("Genie client utilities", () => {
  it("handles budget input and ranges", () => {
    expect(parseBudgetAmount("Rs. 12,500")).toBe("12500");
    expect(parseBudgetRangeValue("Rs. 2,500 - 5,000")).toEqual({ min: "2500", max: "5000" });
    expect(buildBudgetRangeValue("8000", "3000")).toBe("Rs. 3,000 - 8,000");
    expect(divideBudgetAcrossItems("Under Rs. 6,000", 3)).toBe("Under Rs. 2,000");
  });

  it("normalizes speech and phone input", () => {
    expect(removeEmojiForSpeech("Great 🎁  gift! ❤️")).toBe("Great gift!");
    expect(getValidatedPhoneNumber("123-45").error).toContain("at least 7 digits");
    expect(getValidatedPhoneNumber("+94 77 123 4567")).toEqual({ error: "", normalizedValue: "+94 77 123 4567" });
  });

  it("normalizes, detects, and applies preference changes", () => {
    expect(normalizeExtendedPreferences(undefined, profile)).toEqual({ ...prefs, replyCount: 0 });
    expect(havePreferenceValuesChanged(prefs, { giftType: "Cakes" })).toBe(true);
    expect(applyExtendedPreferenceUpdates(prefs, { giftType: "Cakes" })).toMatchObject({ giftType: "Cakes", replyCount: 2 });
  });

  it("maps modes to task and payload contracts", () => {
    expect(getPreferenceStateForMode("Event Planner")).toBe("eventUserPreference");
    expect(getPreferencePayloadForMode("Gift Box Builder", prefs)).toEqual({ giftUserPreference: prefs });
    expect(getTaskForMode("Compare Products")).toBe("compare");
    expect(getTaskForMode("Shopping")).toBe("recommend");
  });
});
