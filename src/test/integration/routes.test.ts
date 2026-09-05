import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());

describe("lightweight API routes", () => {
  it("always returns 204 from backend warm-up, even when upstream fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { GET } = await import("@/app/api/backend-warmup/route");
    const response = await GET();
    expect(response.status).toBe(204);
    expect(fetch).toHaveBeenCalledWith("https://genieai-backend.vercel.app/healthz", { method: "GET", cache: "no-store" });
    vi.unstubAllGlobals();
  });

  it("returns personalization readiness using the session cookie identity", async () => {
    vi.resetModules();
    vi.doMock("@/lib/personalization/identity", () => ({ getOrCreatePersonalizationSessionId: vi.fn().mockResolvedValue("session-route") }));
    vi.doMock("@/lib/personalization/profileStore", () => ({ getPersonalizationProfile: vi.fn().mockReturnValue({ sessionId: "session-route" }) }));
    const { GET } = await import("@/app/api/personalization/session/route");
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasProfile: true, ready: true });
  });
});
