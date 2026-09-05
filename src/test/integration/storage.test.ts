import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";

describe("chat state persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips and clears state through IndexedDB", async () => {
    const { clearStoredChatState, readStoredChatState, writeStoredChatState } = await import("@/genie-ai/storage");
    const state = { activeMode: "Shopping", sessions: {} } as never;
    await writeStoredChatState(state);
    await expect(readStoredChatState()).resolves.toEqual(state);
    await clearStoredChatState();
    await expect(readStoredChatState()).resolves.toBeNull();
  });
});
