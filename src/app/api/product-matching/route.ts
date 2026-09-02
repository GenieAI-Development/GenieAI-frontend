import { NextResponse } from "next/server";
import {
  createSession,
  parseAgentJson,
  readAssistantText,
  sendTextMessage,
} from "@/lib/qoderCloudAgent";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ITEMS = 10;
const MAX_TEXT_LENGTH = 500;

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

export async function POST(request: Request) {
  const pat = process.env.QODER_PAT;
  const agentId =
    process.env.QODER_PRODUCT_MATCHING_AGENT_ID ?? process.env.QODER_AGENT_ID;
  const envId = process.env.QODER_ENV_ID;
  const agentVersion = process.env.QODER_AGENT_VERSION;

  if (!pat || !agentId || !envId) {
    return NextResponse.json(
      {
        error:
          "Missing QODER_PAT, QODER_PRODUCT_MATCHING_AGENT_ID (or QODER_AGENT_ID), or QODER_ENV_ID.",
      },
      { status: 500 },
    );
  }

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
    if (!raw) throw new Error("The agent returned an empty response.");

    const parsed = parseAgentJson(raw);
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
          : cleanText(pair.insight, "Compatibility insight unavailable."),
      }];
    });

    if (pairs.length === 0) throw new Error("The agent returned no valid product comparisons.");

    return NextResponse.json({
      overallScore: clampScore(parsed.overallScore),
      overallSummary: cleanText(parsed.overallSummary, "Your cart matching analysis is ready."),
      pairs,
      recommendations: (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
        .map((item) => cleanText(item))
        .filter(Boolean)
        .slice(0, 4),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product matching failed.";
    console.error(`[product-matching] ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
