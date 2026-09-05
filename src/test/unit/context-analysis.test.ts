import { afterEach, describe, expect, it, vi } from "vitest";
import { isLikelyGiftRequest, POST } from "@/app/api/ai/context-analysis/route";

afterEach(() => vi.unstubAllEnvs());

describe("gift request classification", () => {
  it.each([
    "I need a gift for my mother",
    "Show me cakes for my girlfriend's birthday",
    "Find me a cake",
    "Recommend a wedding present",
    "Mage yaluwa ta birthday gift ekak ona",
  ])("recognizes gift-shopping intent in %s", (message) => {
    expect(isLikelyGiftRequest(message)).toBe(true);
  });

  it.each([
    "Hello, how are you?",
    "What time do you close?",
    "Can you deliver to Colombo tomorrow?",
    "Show me headphones for myself",
  ])("does not classify an ordinary request as gifting: %s", (message) => {
    expect(isLikelyGiftRequest(message)).toBe(false);
  });

  it.each([
    ["Show me cakes for my girlfriend's birthday between Rs. 5,000 - 10,000", true, []],
    ["Can you deliver to Colombo tomorrow?", false, []],
  ])(
    "combines current and saved preference requirements for %s",
    async (message, isGiftRequest, missingFields) => {
      vi.stubEnv("GROQ_API_KEY", "");
      vi.stubEnv("GROQ_TOKEN", "");
      const response = await POST(
        new Request("http://localhost/api/ai/context-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              budget: "Above Rs. 10,000",
              occasion: "Anniversary",
              recipient: "Male",
            },
            message,
            selectedLanguage: "English",
          }),
        }),
      );
      const data = await response.json();

      expect(data).toMatchObject({ isGiftRequest, missingFields });
    },
  );

  it("does not ask again when sidebar preferences already satisfy a vague gift request", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("GROQ_TOKEN", "");
    const response = await POST(
      new Request("http://localhost/api/ai/context-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            budget: "Above Rs. 10,000",
            occasion: "Anniversary",
            recipient: "Male",
          },
          message: "Can you help me find a gift?",
          selectedLanguage: "English",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      isGiftRequest: true,
      missingFields: [],
    });
  });

  it("asks only for preferences missing from both the message and saved context", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("GROQ_TOKEN", "");
    const response = await POST(
      new Request("http://localhost/api/ai/context-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { budget: "Below Rs. 5,000" },
          message: "Can you help me find a gift?",
          selectedLanguage: "English",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      isGiftRequest: true,
      missingFields: ["recipient", "occasion"],
    });
  });

  it("keeps the detected cake category while requesting the three missing preferences", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("GROQ_TOKEN", "");
    const response = await POST(
      new Request("http://localhost/api/ai/context-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {},
          message: "Find me a cake",
          selectedLanguage: "English",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      category: "Cakes",
      isGiftRequest: true,
      missingFields: ["budget", "recipient", "occasion"],
    });
  });
});
