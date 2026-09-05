import { asRecord, getString } from "@/lib/aiPayload";
import {
  fetchGroqChatWithFallback,
  readGroqError,
} from "@/lib/groqHosted";
import { extractJsonObject, getAssistantContent } from "./ai";
import type { QueryAnalysis } from "./types";

const DEFAULT_QUERY_ANALYSIS_MODEL = "openai/gpt-oss-20b";

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

export async function getGroqQueryAnalysis(
  apiKey: string,
  language: string,
  latestUserMessage: string,
) {
  const { response } = await fetchGroqChatWithFallback(apiKey, {
    model:
      process.env.GROQ_QUERY_ANALYSIS_MODEL ?? DEFAULT_QUERY_ANALYSIS_MODEL,
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
      reasoning_effort: "low",
      response_format: { type: "json_object" },
  }, []);

  if (!response.ok) {
    throw new Error(await readGroqError(response));
  }

  const content = getAssistantContent((await response.json()) as unknown);
  const analysis = content ? parseQueryAnalysis(content) : null;

  if (!analysis?.englishQuery) {
    throw new Error("Query analysis returned an invalid response.");
  }

  return analysis;
}
