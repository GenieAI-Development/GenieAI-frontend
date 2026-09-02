import { NextResponse } from "next/server";
import { asRecord, getString, stripModelThinking } from "@/lib/aiPayload";
import {
  fetchGroqChatWithFallback,
  getGroqApiKey,
  getMissingGroqKeyMessage,
  readGroqError,
} from "@/lib/groqHosted";

export const runtime = "nodejs";

const DEFAULT_MODEL = "openai/gpt-oss-20b";

const checkoutDetailsSchema = {
  name: "checkout_delivery_details",
  strict: true,
  schema: {
    type: "object",
    properties: {
      address: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      deliveryDate: { type: ["string", "null"] },
      locationType: { type: ["string", "null"] },
      recipientName: { type: ["string", "null"] },
      recipientPhone: { type: ["string", "null"] },
      senderName: { type: ["string", "null"] },
    },
    required: [
      "address",
      "city",
      "deliveryDate",
      "locationType",
      "recipientName",
      "recipientPhone",
      "senderName",
    ],
    additionalProperties: false,
  },
};

type CheckoutExtraction = {
  address: string | null;
  city: string | null;
  deliveryDate: string | null;
  locationType: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  senderName: string | null;
};

const emptyExtraction: CheckoutExtraction = {
  address: null,
  city: null,
  deliveryDate: null,
  locationType: null,
  recipientName: null,
  recipientPhone: null,
  senderName: null,
};

function extractAssistantContent(payload: unknown) {
  const choices = asRecord(payload)?.choices;
  const message = Array.isArray(choices) ? asRecord(choices[0])?.message : null;
  return stripModelThinking(getString(asRecord(message), "content") ?? "");
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) || null
    : null;
}

function allowedValue(value: unknown, options: string[]) {
  const text = cleanText(value, 120);
  if (!text) return null;
  return options.find((option) => option.toLowerCase() === text.toLowerCase()) ?? null;
}

function parseExtraction(
  content: string,
  cities: string[],
  locationTypes: string[],
  minimumDeliveryDate: string | null,
): CheckoutExtraction {
  const json = extractJsonObject(content);
  if (!json) return emptyExtraction;

  try {
    const value = asRecord(JSON.parse(json) as unknown);
    const phone = cleanText(value?.recipientPhone, 30)?.replace(/[^+\d\s()-]/g, "") ?? null;
    const deliveryDate = cleanText(value?.deliveryDate, 10);
    const validDate =
      deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) &&
      (!minimumDeliveryDate || deliveryDate >= minimumDeliveryDate)
        ? deliveryDate
        : null;

    return {
      address: cleanText(value?.address, 220),
      city: allowedValue(value?.city, cities),
      deliveryDate: validDate,
      locationType: allowedValue(value?.locationType, locationTypes),
      recipientName: cleanText(value?.recipientName, 100),
      recipientPhone: phone && /\d{7,}/.test(phone.replace(/\D/g, "")) ? phone : null,
      senderName: cleanText(value?.senderName, 100),
    };
  } catch {
    return emptyExtraction;
  }
}

export async function POST(request: Request) {
  const body = asRecord(await request.json().catch(() => null));
  const transcript = getString(body, "transcript")?.trim();
  const cities = Array.isArray(body?.cities)
    ? body.cities.filter((city): city is string => typeof city === "string").slice(0, 300)
    : [];
  const locationTypes = Array.isArray(body?.locationTypes)
    ? body.locationTypes.filter((type): type is string => typeof type === "string").slice(0, 30)
    : [];
  const minimumDeliveryDate = getString(body, "minimumDeliveryDate") ?? null;

  if (!transcript) {
    return NextResponse.json({ error: "A voice transcript is required." }, { status: 400 });
  }

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: getMissingGroqKeyMessage() }, { status: 500 });
  }

  const { model, response } = await fetchGroqChatWithFallback(apiKey, {
    model: process.env.GROQ_CHECKOUT_DETAILS_MODEL ?? DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Extract checkout delivery details from an English voice transcript. Return JSON only. Extract only explicitly stated values. Never infer, generate, modify, or return a gift message, card note, greeting, or any other free-form message. Use an exact city and locationType from the supplied option lists or null. deliveryDate must be YYYY-MM-DD and must not be earlier than minimumDeliveryDate. Return null for missing or uncertain values.",
      },
      {
        role: "user",
        content: JSON.stringify({
          allowedCities: cities,
          allowedLocationTypes: locationTypes,
          expectedSchema: {
            address: "string | null",
            city: "one allowed city | null",
            deliveryDate: "YYYY-MM-DD | null",
            locationType: "one allowed location type | null",
            recipientName: "string | null",
            recipientPhone: "string | null",
            senderName: "string | null",
          },
          minimumDeliveryDate,
          transcript,
        }),
      },
    ],
    temperature: 0,
    max_completion_tokens: 300,
    reasoning_effort: "low",
    response_format: {
      type: "json_schema",
      json_schema: checkoutDetailsSchema,
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: await readGroqError(response) }, { status: response.status });
  }

  const extraction = parseExtraction(
    extractAssistantContent(await response.json()),
    cities,
    locationTypes,
    minimumDeliveryDate,
  );

  return NextResponse.json({ extraction, model });
}
