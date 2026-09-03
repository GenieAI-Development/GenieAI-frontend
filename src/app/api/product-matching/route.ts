import { NextResponse } from "next/server";
import {
  fetchGroqChatWithFallback,
  getGroqApiKey,
  readGroqError,
} from "@/lib/groqHosted";
import {
  type AgentResponse,
  createSession,
  parseAgentJson,
  readAssistantText,
  sendTextMessage,
} from "@/lib/qoderCloudAgent";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ITEMS = 10;
const MAX_TEXT_LENGTH = 500;
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

type CartProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
};

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_TEXT_LENGTH)
    : fallback;
}

function cleanAnalysisText(value: unknown, fallback = "") {
  return cleanText(value, fallback).replace(/\bkapruka\b/gi, "the retailer");
}

function parseProducts(value: unknown): CartProduct[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_ITEMS).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const product = raw as Record<string, unknown>;
    const id = cleanText(product.id, "");
    const name = cleanText(product.name, "");
    if (!id || !name) return [];

    return [{
      id,
      name,
      category: cleanText(product.category, "General"),
      description: cleanText(product.description, ""),
    }];
  });
}

function clampScore(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
}

function normalizeProductName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(kapruka|gift|set|pack|bundle)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function areDuplicateProducts(first: CartProduct, second: CartProduct) {
  const firstName = normalizeProductName(first.name);
  const secondName = normalizeProductName(second.name);
  return (
    (firstName.length > 0 && firstName === secondName) ||
    (first.category.trim().toLowerCase() === second.category.trim().toLowerCase() &&
      firstName.length > 0 &&
      (firstName.includes(secondName) || secondName.includes(firstName)))
  );
}

function validateMatchResult(parsed: AgentResponse, products: CartProduct[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const ids = new Set(productsById.keys());
  const seen = new Set<string>();
  const pairs = (Array.isArray(parsed.pairs) ? parsed.pairs : []).flatMap((pair) => {
    const productAId = cleanText(pair.productAId);
    const productBId = cleanText(pair.productBId);
    if (!ids.has(productAId) || !ids.has(productBId) || productAId === productBId) return [];
    const key = [productAId, productBId].sort().join("::");
    if (seen.has(key)) return [];
    seen.add(key);
    const duplicate = areDuplicateProducts(
      productsById.get(productAId)!,
      productsById.get(productBId)!,
    );
    const score = duplicate ? Math.min(40, clampScore(pair.score)) : clampScore(pair.score);
    return [{
      productAId,
      productBId,
      score,
      matches: !duplicate && score >= 60,
      insight: duplicate
        ? "These are duplicate or very similar items, so choosing one and adding a complementary product would create a more balanced bundle."
        : cleanAnalysisText(pair.insight, "Compatibility insight unavailable."),
    }];
  });

  const expectedPairCount = (products.length * (products.length - 1)) / 2;
  if (pairs.length !== expectedPairCount) {
    throw new Error(
      `The provider returned ${pairs.length} of ${expectedPairCount} required product comparisons.`,
    );
  }

  return {
    overallScore: clampScore(parsed.overallScore),
    overallSummary: cleanAnalysisText(
      parsed.overallSummary,
      "Your cart matching analysis is ready.",
    ),
    pairs,
    recommendations: (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
      .map((item) => cleanAnalysisText(item))
      .filter(Boolean)
      .slice(0, 4),
  };
}

function getGroqAssistantText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const choices = (value as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content.trim() : "";
}

async function analyzeWithGroq(apiKey: string, prompt: string) {
  const { model, response } = await fetchGroqChatWithFallback(apiKey, {
    model: process.env.GROQ_PRODUCT_MATCHING_MODEL ?? DEFAULT_GROQ_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are GenieAI's gift-bundle product compatibility expert. Follow the requested JSON schema exactly. Return JSON only and use only supplied product facts.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_completion_tokens: 1200,
    reasoning_effort: "medium",
    response_format: { type: "json_object" },
  });

  if (!response.ok) {
    throw new Error(await readGroqError(response));
  }

  const raw = getGroqAssistantText((await response.json()) as unknown);
  if (!raw) throw new Error("Groq returned an empty response.");
  return { model, parsed: parseAgentJson(raw) };
}

export async function POST(request: Request) {
  const pat = process.env.QODER_PAT;
  const agentId =
    process.env.QODER_PRODUCT_MATCHING_AGENT_ID ?? process.env.QODER_AGENT_ID;
  const envId = process.env.QODER_ENV_ID;
  const agentVersion = process.env.QODER_AGENT_VERSION;
  const groqApiKey = getGroqApiKey();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const products = parseProducts(body?.products);
  if (products.length < 2) {
    return NextResponse.json(
      { error: "Add at least two products to check their match." },
      { status: 400 },
    );
  }

  const prompt = `You are a gift-bundle compatibility expert. Analyze how well every unique pair of the supplied cart products belongs together as one thoughtful gift or occasion bundle. Consider occasion fit, recipient expectations, theme, practicality, and whether the products complement or clash.

Products:
${JSON.stringify(products)}

Return ONLY valid JSON with this exact shape:
{"overallScore":0,"overallSummary":"1-2 concise sentences","pairs":[{"productAId":"exact supplied id","productBId":"exact supplied id","score":0,"matches":true,"insight":"one concise, specific reason"}],"recommendations":["short actionable suggestion"]}

Use scores from 0 to 100. Include every unique product pair exactly once. Set matches to true for scores 60 or higher. Duplicate or near-identical products must score below 60 and have matches set to false: they are redundant, not a good pairing. Do not mention Kapruka, sellers, prices, stock, ordering, or delivery. Never invent product IDs.`;

  let qoderError = "Qoder is not configured.";
  if (pat && agentId && envId) {
    try {
      const sessionId = await createSession(
        pat,
        agentId,
        envId,
        agentVersion,
        "Cart Product Matching",
      );
      await sendTextMessage(pat, sessionId, prompt);
      const raw = (await readAssistantText(pat, sessionId)).trim();
      if (!raw) throw new Error("Qoder returned an empty response.");
      return NextResponse.json({
        ...validateMatchResult(parseAgentJson(raw), products),
        provider: "qoder",
      });
    } catch (error) {
      qoderError = error instanceof Error ? error.message : "Qoder analysis failed.";
      console.warn(`[product-matching] Qoder failed; trying Groq: ${qoderError}`);
    }
  }

  if (groqApiKey) {
    try {
      const groq = await analyzeWithGroq(groqApiKey, prompt);
      return NextResponse.json({
        ...validateMatchResult(groq.parsed, products),
        provider: "groq",
        model: groq.model,
        fallback: true,
      });
    } catch (error) {
      const groqError = error instanceof Error ? error.message : "Groq analysis failed.";
      console.error(`[product-matching] Groq fallback failed: ${groqError}`);
      return NextResponse.json(
        { error: `Product matching failed. Qoder: ${qoderError} Groq: ${groqError}` },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    { error: `Product matching failed. ${qoderError} Groq is not configured.` },
    { status: 500 },
  );
}
