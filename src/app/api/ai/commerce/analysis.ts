import { asRecord, getString, type ChatMessage } from "@/lib/aiPayload";
import { fetchGroqChatWithFallback } from "@/lib/groqHosted";
import { extractJsonObject, getAssistantContent } from "./ai";
import {
  DEFAULT_MODEL,
  PREFERENCE_BUDGETS,
  PREFERENCE_GIFT_TYPES,
  PREFERENCE_OCCASIONS,
  PREFERENCE_RECIPIENTS,
} from "./constants";
import {
  cleanExtendedPreference,
  getNormalizedPreference,
  normalizeDetectedLanguage,
} from "./preferences";
import type { DetectedLanguage, MessageAnalysis, MessageIntent } from "./types";

export function parseMessageAnalysis(
  text: string,
  fallbackLanguage: DetectedLanguage,
): MessageAnalysis | null {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = asRecord(JSON.parse(jsonText) as unknown);
    const rawIntent = getString(parsed, "intent");
    const intent: MessageIntent =
      rawIntent === "question" ||
      rawIntent === "command" ||
      rawIntent === "conversation"
        ? rawIntent
        : "conversation";
    const rawSearchQuery = getString(parsed, "searchQuery")?.trim() ?? "";
    const searchQuery = rawSearchQuery
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 80);
    const rawPreferences = asRecord(parsed?.preferences);
    const rawExtendedPreferences = asRecord(parsed?.extendedPreferences);
    const requestedGiftType =
      getString(rawPreferences, "requestedGiftType")
        ?.replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || null;

    return {
      detectedLanguage: fallbackLanguage,
      extendedPreferences: {
        budget:
          cleanExtendedPreference(
            getString(rawExtendedPreferences, "budget"),
          ) || null,
        giftType:
          cleanExtendedPreference(
            getString(rawExtendedPreferences, "giftType"),
          ) || null,
        occasion:
          cleanExtendedPreference(
            getString(rawExtendedPreferences, "occasion"),
          ) || null,
        recipient:
          cleanExtendedPreference(
            getString(rawExtendedPreferences, "recipient"),
          ) || null,
      },
      intent,
      preferences: {
        budget: getNormalizedPreference(
          getString(rawPreferences, "budget"),
          PREFERENCE_BUDGETS,
        ),
        category: getNormalizedPreference(
          getString(rawPreferences, "category"),
          PREFERENCE_GIFT_TYPES,
        ),
        occasion: getNormalizedPreference(
          getString(rawPreferences, "occasion"),
          PREFERENCE_OCCASIONS,
        ),
        recipient: getNormalizedPreference(
          getString(rawPreferences, "recipient"),
          PREFERENCE_RECIPIENTS,
        ),
        requestedGiftType,
      },
      searchQuery: searchQuery || null,
    };
  } catch {
    return null;
  }
}

export async function getGroqMessageAnalysis(
  apiKey: string,
  language: string,
  mode: string,
  query: string,
  latestUserMessage: string,
  conversationHistory: ChatMessage[],
) {
  const { response } = await fetchGroqChatWithFallback(apiKey, {
    model:
      process.env.GROQ_PROCESSING_MODEL ??
      process.env.GROQ_COMMERCE_MODEL ??
      DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Analyze only the latest user request; selectedLanguage is authoritative. Return two preference layers. preferences contains only normalized visible preset changes explicitly stated now. extendedPreferences contains the exact, specific English search meaning explicitly stated now for budget, recipient, occasion, and giftType; return null for every field not changed in the latest request. Translate Sinhala or Singlish preference meaning into concise English search text. Never copy older preferences from recentConversation into an update. Classify intent as question, command, or conversation. Normalize visible budgets and categories only to the supplied preset options. Return JSON only and do not answer the user.",
      },
      {
        role: "user",
        content: JSON.stringify({
          expectedSchema: {
            intent: "question | command | conversation",
            preferences: {
              budget:
                "Under Rs. 2,500 | Rs. 2,500 - 5,000 | Rs. 5,000 - 10,000 | Above Rs. 10,000 | Other | null",
              category:
                "Flowers | Cakes | Chocolate | Perfumes | Fashion | Other | null",
              occasion:
                "Birthday | Anniversary | Wedding | Graduation | Other | null",
              recipient: "Male | Female | Child | Couple | Other | null",
              requestedGiftType:
                "specific English gift type from this message, or null",
            },
            extendedPreferences: {
              budget: "exact budget or price range from this message, or null",
              giftType: "specific English gift type from this message, or null",
              occasion: "specific English occasion from this message, or null",
              recipient:
                "specific English recipient from this message, or null",
            },
            searchQuery: "2-5 English catalog words, or empty string",
          },
          latestUserMessage,
          recentConversation: conversationHistory,
          message: query,
          mode,
          selectedLanguage: language,
        }),
      },
    ],
    temperature: 0,
    max_completion_tokens: 180,
    response_format: { type: "json_object" },
  });

  if (!response.ok) {
    return null;
  }

  const content = getAssistantContent((await response.json()) as unknown);
  return content
    ? parseMessageAnalysis(
        content,
        normalizeDetectedLanguage(language, "English"),
      )
    : null;
}
