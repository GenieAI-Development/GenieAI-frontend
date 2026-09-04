import { asRecord, getString } from "@/lib/aiPayload";
import { fetchGroqChatWithFallback } from "@/lib/groqHosted";
import { extractJsonObject, getAssistantContent } from "./ai";
import { DEFAULT_MODEL } from "./constants";
import type { QueryAnalysis } from "./types";

export function parseQueryAnalysis(text: string): QueryAnalysis | null {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = asRecord(JSON.parse(jsonText) as unknown);
    const rawEnglishQuery = getString(parsed, "englishQuery")?.trim() ?? "";
    const englishQuery = rawEnglishQuery
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 500);
    return {
      englishQuery: englishQuery || null,
      requiresProductSearch: parsed?.requiresProductSearch === true,
    };
  } catch {
    return null;
  }
}

export function shouldSearchProductsLocally(message: string) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    /^(hi|hello|hey|good\s+(morning|afternoon|evening)|thanks?|thank\s+you|bye|goodbye)[!.?\s]*$/iu.test(
      normalized,
    ) ||
    /\b(who are you|what are you|what can you do|how are you|help me use|your name)\b/iu.test(
      normalized,
    )
  ) {
    return false;
  }

  const productRequest =
    /\b(find|show|search|recommend|suggest|buy|shop|looking for|need|want)\b[\s\S]*\b(product|gift|flower|rose|cake|chocolate|perfume|fashion|watch|hamper|basket|card|decor|snack|sweet|jewelry|skincare)\b/iu.test(
      normalized,
    ) ||
    /\b(product|gift|flower|rose|cake|chocolate|perfume|fashion|watch|hamper|basket|decor|snack|sweet|jewelry|skincare)\b/iu.test(
      normalized,
    );
  const deliveryOnly =
    /\b(delivery|deliver|shipping|ship|arrive|arrival|same[-\s]?day|delivery fee)\b|බෙදාහැර|ඩිලිවරි/iu.test(
      normalized,
    ) && !productRequest;

  if (deliveryOnly) {
    return false;
  }

  return (
    productRequest ||
    /\b(budget|under|below|above|over|between|recipient|birthday|anniversary|wedding|graduation)\b/iu.test(
      normalized,
    )
  );
}

export async function getGroqQueryAnalysis(
  apiKey: string,
  language: string,
  latestUserMessage: string,
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
          "Analyze only the latest user request. Return exactly two values: requiresProductSearch and englishQuery. Set requiresProductSearch to true only when the message asks to find, recommend, show, compare, or update products. Set it false for greetings, general conversation, thanks, identity/capability questions, and delivery-only requests. englishQuery must be a faithful English translation of the complete latest user message. For English input, return it unchanged. Never return Sinhala or Singlish in englishQuery. Do not extract, normalize, infer, or return user preferences. Return JSON only and do not answer the user.",
      },
      {
        role: "user",
        content: JSON.stringify({
          expectedSchema: {
            requiresProductSearch: "boolean",
            englishQuery:
              "faithful English translation of latestUserMessage, or the original message when it is already English",
          },
          latestUserMessage,
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
  return content ? parseQueryAnalysis(content) : null;
}
