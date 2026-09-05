import { afterEach, describe, expect, it, vi } from "vitest";
import { collectTextFromContent, createSession, parseAgentJson, qoderFetch, sendImageMessage, sendTextMessage } from "@/lib/qoderCloudAgent";
import { toCommerceLocationType } from "@/lib/deliveryLocations";

afterEach(() => vi.unstubAllGlobals());

describe("Qoder client and delivery location helpers", () => {
  it("normalizes commerce location types", () => {
    expect(toCommerceLocationType()).toBe("house");
    expect(toCommerceLocationType("Other(Including Hotels)")).toBe("other");
    expect(toCommerceLocationType("Wedding Reception")).toBe("wedding_reception");
  });

  it("collects text and parses agent JSON with fallback", () => {
    expect(collectTextFromContent([{ type: "text", text: "one" }, { text: " two" }, { image: "x" }])).toBe("one two");
    expect(parseAgentJson('prefix {"searchQuery":"roses"} suffix')).toEqual({ searchQuery: "roses" });
    expect(parseAgentJson("plain text")).toEqual({ searchQuery: "plain text", summary: "plain text" });
  });

  it("adds authorization and reports failed API responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("denied", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(qoderFetch("pat", "/sessions")).rejects.toThrow("Qoder /sessions 401: denied");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/sessions"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer pat" }) }));
  });

  it("creates sessions and sends text/image event payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "s1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createSession("pat", "agent", "env", 2)).resolves.toBe("s1");
    await sendTextMessage("pat", "s1", "hello");
    await sendImageMessage("pat", "s1", "data:image/png;base64,x", "analyze");
    const textBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const imageBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(textBody.events[0].content[0]).toEqual({ type: "text", text: "hello" });
    expect(imageBody.events[0].content).toContainEqual({ type: "image", image: "data:image/png;base64,x" });
  });
});
