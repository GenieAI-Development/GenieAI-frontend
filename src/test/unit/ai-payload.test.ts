import { describe, expect, it } from "vitest";
import { asRecord, getNumber, getString, stripModelThinking } from "@/lib/aiPayload";
import { extractJsonObject, getAssistantContent } from "@/app/api/ai/commerce/ai";

describe("AI payload helpers", () => {
  it("only accepts non-null objects as records", () => {
    expect(asRecord({ ok: true })).toEqual({ ok: true });
    expect(asRecord(null)).toBeNull();
    expect(asRecord("value")).toBeNull();
  });

  it("reads only correctly typed fields", () => {
    const record = { name: "Genie", score: 9, numericText: "9" };
    expect(getString(record, "name")).toBe("Genie");
    expect(getString(record, "score")).toBeNull();
    expect(getNumber(record, "score")).toBe(9);
    expect(getNumber(record, "numericText")).toBeNull();
  });

  it.each([
    ["<think>secret</think>Answer", "Answer"],
    ["```think\nsecret\n```\nAnswer", "Answer"],
    ["Before <think>unfinished", "Before"],
  ])("removes model reasoning", (input, expected) => {
    expect(stripModelThinking(input)).toBe(expected);
  });

  it("extracts assistant content and strips reasoning", () => {
    expect(getAssistantContent({ choices: [{ message: { content: "<think>x</think> Hello" } }] })).toBe("Hello");
    expect(getAssistantContent({ choices: [] })).toBeNull();
  });

  it("extracts JSON from fenced or surrounding text", () => {
    expect(extractJsonObject('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    expect(extractJsonObject('prefix {"ok":true} suffix')).toBe('{"ok":true}');
    expect(extractJsonObject("no json")).toBeNull();
  });
});
