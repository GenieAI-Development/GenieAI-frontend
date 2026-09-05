import { NextResponse } from "next/server";
import { asRecord, getString, stripModelThinking } from "@/lib/aiPayload";
import {
  fetchGroqChatWithFallback,
  getGroqApiKey,
  getMissingGroqKeyMessage,
  readGroqError,
} from "@/lib/groqHosted";

export const runtime = "nodejs";

const schema = {
  name: "gift_card_details",
  strict: true,
  schema: {
    type: "object",
    properties: {
      instructions: { type: ["string", "null"] },
      language: { type: ["string", "null"] },
      occasion: { type: ["string", "null"] },
      receiverName: { type: ["string", "null"] },
      recipient: { type: ["string", "null"] },
      senderName: { type: ["string", "null"] },
      style: { type: ["string", "null"] },
      theme: { type: ["string", "null"] },
    },
    required: ["instructions", "language", "occasion", "receiverName", "recipient", "senderName", "style", "theme"],
    additionalProperties: false,
  },
};

const fields = ["instructions", "language", "occasion", "receiverName", "recipient", "senderName", "style", "theme"] as const;

function contentFrom(payload: unknown) {
  const choices = asRecord(payload)?.choices;
  const choice = Array.isArray(choices) ? asRecord(choices[0]) : null;
  return stripModelThinking(getString(asRecord(choice?.message), "content") ?? "");
}

export async function POST(request: Request) {
  const body = asRecord(await request.json().catch(() => null));
  const transcript = getString(body, "transcript")?.trim();
  if (!transcript) return NextResponse.json({ error: "A voice transcript is required." }, { status: 400 });
  const apiKey = getGroqApiKey();
  if (!apiKey) return NextResponse.json({ error: getMissingGroqKeyMessage() }, { status: 500 });

  const { response } = await fetchGroqChatWithFallback(apiKey, {
    model: process.env.GROQ_GIFT_CARD_DETAILS_MODEL ?? "openai/gpt-oss-20b",
    messages: [
      { role: "system", content: "Extract only explicitly stated gift-card preferences from this English voice transcript. Return JSON only. Use null for missing or uncertain values. Keep instructions as the user's requested card wording or directions, not a newly written card message." },
      { role: "user", content: JSON.stringify({ transcript, allowed: { language: ["English", "Sinhala", "Singlish"], style: ["Elegant", "Playful", "Romantic", "Minimal", "Festive"], theme: ["Auto-match product", "Celebration", "Floral", "Modern", "Romantic"] } }) },
    ],
    temperature: 0,
    max_completion_tokens: 350,
    reasoning_effort: "low",
    response_format: { type: "json_schema", json_schema: schema },
  });
  if (!response.ok) return NextResponse.json({ error: await readGroqError(response) }, { status: response.status });

  const text = contentFrom(await response.json());
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const record = asRecord(JSON.parse(json) as unknown);
    const extraction = Object.fromEntries(fields.flatMap((field) => {
      const value = getString(record, field)?.replace(/\s+/g, " ").trim().slice(0, field === "instructions" ? 500 : 100);
      return value ? [[field, value]] : [];
    }));
    return NextResponse.json({ extraction });
  } catch {
    return NextResponse.json({ extraction: {} });
  }
}
