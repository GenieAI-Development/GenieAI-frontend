import { asRecord, getString, stripModelThinking } from "@/lib/aiPayload";
import { fetchGroqChatWithFallback } from "@/lib/groqHosted";
import { extractJsonObject, getAssistantContent } from "./ai";
import {
  DEFAULT_ENGLISH_CHAT_MODEL,
  DEFAULT_GIFT_MESSAGE_MODEL,
  DEFAULT_SINHALA_CHAT_MODEL,
  DEFAULT_SINHALA_GIFT_MESSAGE_MODEL,
  DEFAULT_SINGLISH_CHAT_MODEL,
  DEFAULT_SINGLISH_GIFT_MESSAGE_MODEL,
  ENGLISH_GIFT_MESSAGE_FALLBACK_MODELS,
} from "./constants";
import { getReplyLanguageInstruction } from "./recommendations";
import type {
  DetectedLanguage,
  GiftMessagePreferences,
  ShoppingProfile,
} from "./types";

export async function getGroqGiftMessage(
  apiKey: string,
  profile: ShoppingProfile,
  preferences: GiftMessagePreferences,
) {
  const isSinhala = preferences.language?.trim().toLowerCase() === "sinhala";
  const isSinglish = preferences.language?.trim().toLowerCase() === "singlish";
  const isEnglish = preferences.language?.trim().toLowerCase() === "english";
  const { response } = await fetchGroqChatWithFallback(
    apiKey,
    {
      model: isSinhala
        ? (process.env.GROQ_SINHALA_GIFT_MESSAGE_MODEL ??
          DEFAULT_SINHALA_GIFT_MESSAGE_MODEL)
        : isSinglish
          ? (process.env.GROQ_SINGLISH_GIFT_MESSAGE_MODEL ??
            DEFAULT_SINGLISH_GIFT_MESSAGE_MODEL)
          : (process.env.GROQ_GIFT_MESSAGE_MODEL ?? DEFAULT_GIFT_MESSAGE_MODEL),
      messages: [
        {
          role: "system",
          content: `${isSinhala ? "" : "/no_think\n"}You are a native Sri Lankan gift-card writer. Generate one fresh, polished message in the explicitly requested language. Sinhala must use fluent, idiomatic Sinhala script rather than a literal word-for-word translation. Singlish must be natural conversational Sinhala written entirely with Latin letters, never English prose or Sinhala script. Natural Singlish style includes 'Obata subama suba upandinayak wewa!' and 'Oyata godak adarei. Hemadama sathutin saha nirogiwa inna.' Do not copy these examples. Respect the requested size, tone, relationship, occasion, and suggestions. Return exactly one JSON object containing a giftMessage string and no other text.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            expectedSchema: { giftMessage: "message text only" },
            preferences,
            profile,
          }),
        },
      ],
      temperature: 0.45,
      max_completion_tokens: 400,
      ...(isEnglish
        ? {
            reasoning_effort: "low",
            response_format: { type: "json_object" },
          }
        : {}),
    },
    isEnglish ? ENGLISH_GIFT_MESSAGE_FALLBACK_MODELS : undefined,
  );

  if (!response.ok) {
    return "";
  }

  const content = getAssistantContent((await response.json()) as unknown);
  const jsonText = content ? extractJsonObject(content) : null;

  if (!jsonText) {
    return "";
  }

  try {
    return (
      getString(asRecord(JSON.parse(jsonText) as unknown), "giftMessage") ?? ""
    );
  } catch {
    return "";
  }
}

export function getProductPageReplyFallback(
  language: DetectedLanguage,
  exhausted: boolean,
) {
  if (exhausted) {
    return language === "Sinhala"
      ? "ගැළපුණු සියලුම products පෙන්වා අවසන්. ඔබට search query එක හෝ preferences වෙනස් කරන්න අවශ්‍යද?"
      : language === "Singlish"
        ? "Match una products okkoma pennala iwrai. Search query eka hari preferences hari wenas karannada?"
        : "You've seen all the matched products. Would you like to change your search query or update your preferences?";
  }

  return language === "Sinhala"
    ? "ඔබේ preferences වලට ගැළපෙන ඊළඟ products පෙන්වන්නම්."
    : language === "Singlish"
      ? "Oyage preferences walata match wena ilanga products pennanawa."
      : "Here are the next matched products for your preferences.";
}

export async function getGroqProductPageReply(
  apiKey: string,
  language: DetectedLanguage,
  context: {
    exhausted: boolean;
    mode: string;
    profile: ShoppingProfile;
    query: string;
    shownFrom: number;
    shownTo: number;
    total: number;
  },
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
        content: `Write one natural, concise shopping-assistant sentence. The product cards were paged locally, so never claim that you searched, ranked, loaded, or fetched products. Do not mention product names, IDs, APIs, or technical details. If exhausted is true, clearly say all matched products have now been shown and ask whether the user wants to change the query or preferences. Otherwise acknowledge that the next matched products are now visible. ${getReplyLanguageInstruction(language)}`,
      },
      {
        role: "user",
        content: JSON.stringify(context),
      },
    ],
    temperature: 0.35,
    max_completion_tokens: 100,
  });

  if (!response.ok) {
    return "";
  }

  return stripModelThinking(
    getAssistantContent((await response.json()) as unknown) ?? "",
  ).trim();
}
