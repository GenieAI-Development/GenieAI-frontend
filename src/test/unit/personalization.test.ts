import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPersonalizationEventType, personalizationEventWeights } from "@/lib/personalization/eventWeights";

describe("personalization profile store", () => {
  beforeEach(() => {
    vi.resetModules();
    delete globalThis.__geniePersonalizationProfiles;
  });

  it("recognizes supported interaction events", () => {
    expect(isPersonalizationEventType("purchase")).toBe(true);
    expect(isPersonalizationEventType("click")).toBe(false);
    expect(personalizationEventWeights.favorite).toBeGreaterThan(personalizationEventWeights.view);
  });

  it("records weighted signals, recent values, and prices", async () => {
    const { recordPersonalizationEvents, getPersonalizationProfile } = await import("@/lib/personalization/profileStore");
    const profile = recordPersonalizationEvents("session-a", [
      { event: "view", eventId: "e1", timestamp: "2026-09-05T00:00:00Z", category: " Flowers ", productId: "p1", price: 4000, query: "roses" },
      { event: "purchase", eventId: "e2", timestamp: "2026-09-05T00:01:00Z", category: "Flowers", productId: "p2", price: 6000, query: "bouquet" },
    ]);
    expect(profile.categoryScores.flowers).toBe(6);
    expect(profile.recentProductIds).toEqual(["p2", "p1"]);
    expect(profile.recentQueries).toEqual(["bouquet", "roses"]);
    expect(profile.preferredPriceMin).toBe(4250);
    expect(profile.preferredPriceMax).toBe(7083);
    expect(getPersonalizationProfile("session-a")).toEqual(profile);
  });

  it("deduplicates event IDs and decays existing category scores", async () => {
    const { recordPersonalizationEvents } = await import("@/lib/personalization/profileStore");
    const event = { event: "favorite" as const, eventId: "same", timestamp: "2026-09-05T00:00:00Z", category: "Cakes" };
    expect(recordPersonalizationEvents("session-b", [event]).signalCount).toBe(1);
    expect(recordPersonalizationEvents("session-b", [event]).signalCount).toBe(1);
    const updated = recordPersonalizationEvents("session-b", [
      {
        event: "view",
        eventId: "next",
        timestamp: "2026-09-05T00:01:00Z",
        category: "Flowers",
      },
    ]);
    expect(updated.categoryScores.cakes).toBe(3.6);
  });
});
