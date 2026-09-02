import {
  asRecord,
  getNumber,
  getString,
  stripModelThinking,
  type ChatMessage,
} from "@/lib/aiPayload";
import { fetchGroqChatWithFallback } from "@/lib/groqHosted";
import type { Product } from "@/lib/productCatalog";
import { extractJsonObject, getAssistantContent } from "./ai";
import {
  DEFAULT_ENGLISH_CHAT_MODEL,
  DEFAULT_SINHALA_CHAT_MODEL,
  DEFAULT_SINGLISH_CHAT_MODEL,
  MAX_RANKED_PRODUCTS,
  fallbackResponse,
} from "./constants";
import { parseChipArray, parseStringArray } from "./request";
import type {
  CommerceRecommendation,
  CommerceResponse,
  DetectedLanguage,
  GiftMessagePreferences,
  ShoppingProfile,
} from "./types";

export function parseGiftMessagePreferences(
  value: unknown,
): GiftMessagePreferences {
  const record = asRecord(value);

  return {
    language: getString(record, "language") ?? undefined,
    size: getString(record, "size") ?? undefined,
    suggestions: getString(record, "suggestions") ?? undefined,
    tone: getString(record, "tone") ?? undefined,
  };
}

export function parseRecommendations(value: unknown, products: Product[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  const productIds = new Set(products.map((product) => product.id));

  return value
    .map((item) => {
      const record = asRecord(item);
      const id = getString(record, "id");
      const reason = getString(record, "reason");
      const rawFitScore = getNumber(record, "fitScore") ?? 80;
      const fitScore = rawFitScore <= 10 ? rawFitScore * 10 : rawFitScore;

      if (!id || !productIds.has(id)) {
        return null;
      }

      return {
        id,
        fitScore: Math.max(0, Math.min(100, Math.round(fitScore))),
        reason: reason ?? "Good match from the live catalog.",
      };
    })
    .filter((item): item is CommerceRecommendation => item !== null)
    .slice(0, 4);
}

export function parseCommerceResponse(
  text: string,
  mode: string,
  products: Product[],
): CommerceResponse {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    return {
      ...fallbackResponse,
      mode,
      recommendations: fallbackRecommendations(products),
      reply: stripModelThinking(text),
    };
  }

  try {
    const parsed = asRecord(JSON.parse(jsonText) as unknown);
    const analytics = asRecord(parsed?.analytics);

    return {
      analytics: {
        buyBoxHealth:
          getString(analytics, "buyBoxHealth") ??
          fallbackResponse.analytics.buyBoxHealth,
        conversionSignal:
          getString(analytics, "conversionSignal") ??
          fallbackResponse.analytics.conversionSignal,
        nextBestAction:
          getString(analytics, "nextBestAction") ??
          fallbackResponse.analytics.nextBestAction,
        risk: getString(analytics, "risk") ?? fallbackResponse.analytics.risk,
      },
      chips: parseChipArray(parsed?.chips, 6),
      comparisonInsights: [],
      eventPlan: parseStringArray(
        parsed?.eventPlan,
        mode.includes("Event") ? 4 : 8,
      ),
      giftMessage: getString(parsed, "giftMessage") ?? "",
      mode: getString(parsed, "mode") ?? mode,
      recommendations: parseRecommendations(parsed?.recommendations, products),
      reply: stripModelThinking(getString(parsed, "reply") ?? ""),
    };
  } catch {
    return {
      ...fallbackResponse,
      mode,
      recommendations: fallbackRecommendations(products),
      reply: stripModelThinking(text),
    };
  }
}

export function getReplyLanguageInstruction(language: DetectedLanguage) {
  if (language === "Sinhala") {
    return "CRITICAL LANGUAGE RULE: Reply only in natural Sinhala using Sinhala script. Ignore the language used in the query. Do not write the reply in English or Singlish.";
  }

  if (language === "Singlish") {
    return "CRITICAL LANGUAGE RULE: Reply only in natural conversational Sinhala written with Latin letters. Ignore the language used in the query. Every sentence must use Sinhala vocabulary and grammar such as oyage, mata, ona, puluwan, hoyala, balanna, or kiyanna. Do not write an English sentence and do not use Sinhala script.";
  }

  return "CRITICAL LANGUAGE RULE: Reply only in English.";
}

export function isReplyInSelectedLanguage(
  reply: string | null,
  language: DetectedLanguage,
) {
  if (!reply?.trim()) {
    return false;
  }

  if (language === "Sinhala") {
    return /[\u0D80-\u0DFF]/u.test(reply);
  }

  if (language === "Singlish") {
    if (/[\u0D80-\u0DFF]/u.test(reply)) {
      return false;
    }

    const singlishWords =
      reply.match(
        /\b(?:api|balanna|dennam|eka|ekak|galapena|ganna|hari|hoyala|karanna|kiyanna|kohomada|mama|mata|mona|mokak|mokakda|nathuwa|ona|one|oya|oyage|oyata|puluwan|thawa|thiyenawa|tikak|wage|wena)\b/gi,
      ) ?? [];

    return new Set(singlishWords.map((word) => word.toLowerCase())).size >= 2;
  }

  return true;
}

export function getLanguageSafeReply(
  language: DetectedLanguage,
  ...candidates: Array<string | null>
) {
  return (
    candidates.find((reply) => isReplyInSelectedLanguage(reply, language)) ?? ""
  );
}

export function sanitizeChatReply(reply: string, products: Product[]) {
  const productReferences = products.flatMap((product) => [
    product.id.trim().toLowerCase(),
    product.name.trim().toLowerCase(),
  ]);
  const isProductSpecific = (value: string) => {
    const normalized = value.toLowerCase();
    return productReferences.some(
      (reference) => reference.length > 0 && normalized.includes(reference),
    );
  };
  const safeSentences = reply
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:[-*•]|\d+[.)])\s+/.test(line))
    .flatMap((line) => line.match(/[^.!?]+[.!?]?/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !isProductSpecific(sentence))
    .filter((sentence, index, sentences) => {
      const isCompleteSentence = /[.!?]["')\]]?$/.test(sentence);

      if (isCompleteSentence) {
        return true;
      }

      return index < sentences.length - 1;
    });
  const sanitized = safeSentences.join(" ").replace(/\s+/g, " ").trim();

  return sanitized;
}

export function isNoMatchStyleReply(reply: string) {
  return /no exact match|no exact matches|could not find|couldn't find|did not find|within your budget|adjust your budget|adjust your preferences/i.test(
    reply,
  );
}

export async function getAiProductReply(
  apiKey: string,
  language: DetectedLanguage,
  userMessage: string,
  profile: ShoppingProfile,
  conversationHistory: ChatMessage[],
  products: Product[],
) {
  const { response } = await fetchGroqChatWithFallback(apiKey, {
    model:
      language === "Sinhala"
        ? (process.env.GROQ_SINHALA_CHAT_MODEL ?? DEFAULT_SINHALA_CHAT_MODEL)
        : language === "Singlish"
          ? (process.env.GROQ_SINGLISH_CHAT_MODEL ??
            DEFAULT_SINGLISH_CHAT_MODEL)
          : (process.env.GROQ_ENGLISH_CHAT_MODEL ?? DEFAULT_ENGLISH_CHAT_MODEL),
    messages: [
      {
        role: "system",
        content: `You are the shopping reply voice for GenieAI. Product cards already exist and match the user's request, so reply positively about the request using activePreferences as the source of truth. Never say that no products were found, never ask the user to change budget or preferences, and never mention product names, product IDs, prices, counts, lists, or bullet points because the UI already shows the product cards. Reply naturally to the user's message in one short paragraph. ${getReplyLanguageInstruction(language)}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          activePreferences: {
            budget: profile.budget,
            category: profile.category,
            occasion: profile.occasion,
            recipient: profile.recipient,
          },
          exactCatalogMatchCount: products.length,
          query: userMessage,
          recentConversation: conversationHistory,
        }),
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 120,
  });

  if (!response.ok) {
    return "";
  }

  return stripModelThinking(
    getAssistantContent((await response.json()) as unknown) ?? "",
  ).trim();
}

export function fallbackRecommendations(products: Product[]) {
  return products.slice(0, 4).map((product, index) => ({
    id: product.id,
    fitScore: 92 - index * 4,
    reason: "Matched by live product search.",
  }));
}

export function orderProductsByRecommendation(
  products: Product[],
  recommendations: CommerceRecommendation[],
) {
  if (recommendations.length === 0) {
    return products.slice(0, MAX_RANKED_PRODUCTS);
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  const rankedProducts = recommendations
    .map((recommendation) => byId.get(recommendation.id))
    .filter((product): product is Product => Boolean(product));
  const rankedIds = new Set(rankedProducts.map((product) => product.id));

  return [
    ...rankedProducts,
    ...products.filter((product) => !rankedIds.has(product.id)),
  ].slice(0, MAX_RANKED_PRODUCTS);
}
