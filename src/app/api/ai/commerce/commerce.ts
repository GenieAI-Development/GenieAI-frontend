import type { ChatMessage } from "@/lib/aiPayload";
import { fetchGroqChatWithFallback, readGroqError } from "@/lib/groqHosted";
import type { Product } from "@/lib/productCatalog";
import { getAssistantContent } from "./ai";
import { getBudgetSearchReply } from "./catalog";
import {
  DEFAULT_ENGLISH_CHAT_MODEL,
  DEFAULT_SINHALA_CHAT_MODEL,
  DEFAULT_SINGLISH_CHAT_MODEL,
} from "./constants";
import {
  getReplyLanguageInstruction,
  parseCommerceResponse,
  sanitizeChatReply,
} from "./recommendations";
import type {
  CatalogDeliveryResponse,
  DetectedLanguage,
  MessageAnalysis,
  ProductSearchResult,
  ShoppingProfile,
} from "./types";

export async function getGroqCommerce(
  apiKey: string,
  language: DetectedLanguage,
  mode: string,
  task: string,
  query: string,
  userMessage: string,
  products: Product[],
  delivery: CatalogDeliveryResponse | null,
  profile: ShoppingProfile,
  messageAnalysis: MessageAnalysis,
  searchQuery: string,
  productSearch: ProductSearchResult | null,
  conversationHistory: ChatMessage[],
) {
  const isShoppingMode = mode === "Smart Shopping";
  const isPlanOnlyTask = task === "eventPlan" || task === "giftBox";
  const isTextOnlyTask = task === "reply";
  const isProductReplyTask = task === "productReply";
  const isReplyOnlyTask = isTextOnlyTask || task === "productReply";
  const productReplyItemLabel =
    profile.category?.trim() || searchQuery.trim() || "matching options";
  const replyLengthInstruction = isShoppingMode
    ? "In Smart Shopping mode, reply with one compact but detailed paragraph of at least 10 words that can be up to three sentences."
    : "The reply must be one short paragraph.";
  const groqCommerceModel =
    language === "Sinhala"
      ? (process.env.GROQ_SINHALA_CHAT_MODEL ?? DEFAULT_SINHALA_CHAT_MODEL)
      : language === "Singlish"
        ? (process.env.GROQ_SINGLISH_CHAT_MODEL ?? DEFAULT_SINGLISH_CHAT_MODEL)
        : (process.env.GROQ_ENGLISH_CHAT_MODEL ?? DEFAULT_ENGLISH_CHAT_MODEL);
  const groqCommercePromise = fetchGroqChatWithFallback(apiKey, {
    model: groqCommerceModel,
    messages: [
      {
        role: "system",
        content: `You are the multilingual reasoning and conversation layer for GenieAI. ${isPlanOnlyTask ? "This is a plan-only request, so no product catalog is supplied or expected. Create the requested checklist from the submitted context without claiming that products were searched." : isTextOnlyTask ? "This is a text-only request. No product search was performed and no product catalog is expected. Answer the user's greeting, identity question, capability question, general conversation, or delivery-only question directly. Do not claim that products were searched or that product results were updated. If a delivery question needs a product, destination, or date that was not supplied, ask one concise clarification." : isProductReplyTask ? "A product search has completed. Analyze requestSummary and itemLabel, then write one natural, friendly confirmation of the user's request using at least 10 words. You may mention only the generic item type they asked for, never returned product data. Do not include individual product names, result count, prices, vendors, product comparisons, or a list. Product cards are shown separately in the UI." : "Product and delivery data already came from the live commerce service. Rank only provided products that satisfy the active preferences. If no matching catalog products are supplied, clearly say that no exact match was found and ask whether the user wants to change a preference; never propose a substitute category."}${task === "eventPlan" ? " For Event Planner, suggest no more than four checklist items." : ""} The submitted profile is the user's highest-priority requirement: never replace its requested gift type, budget, recipient, or occasion with a different option. Use activePreferences as the single source of truth for the user's current preferences and do not mix it with older or conflicting categories. First respond to the user's actual message: answer a question directly, carry out or specifically acknowledge a command, and respond naturally to conversation. In Event Planner and Gift Box modes, always answer a custom user question or command directly in reply, even while a guided item list is active. Never use 'I updated the products', a translation of it, or another generic UI-update status as the reply. The product cards update separately while you reply. If facts needed to answer are not present in the supplied data, say so briefly or ask one useful clarification instead of inventing facts. Rank only the provided product IDs and never invent catalog products. ${replyLengthInstruction} Never include product names, product IDs, prices, or a written list of recommendations in reply because the UI shows products only as cards. For eventPlan and giftBox tasks, return the checklist only in eventPlan, never repeat that checklist in reply. For compare tasks, make reply a direct, useful response for the AI suggestions field without listing products. Analytics and reply chips are generated locally, so do not return them. Return JSON only. ${getReplyLanguageInstruction(language)}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          isProductReplyTask
            ? {
                expectedSchema: {
                reply:
                    "friendly acknowledgement of at least 10 words with no product details",
                },
                replyLanguage: language,
                searchCompleted: true,
                itemLabel: productReplyItemLabel,
                requestSummary:
                  messageAnalysis.englishQuery?.trim() || userMessage,
                task,
              }
            : isTextOnlyTask
              ? {
                  expectedSchema: {
                    reply: "concise direct answer to this specific user message",
                  },
                  conversationHistory,
                  englishQuery: messageAnalysis.englishQuery,
                  mode,
                  query: userMessage,
                  replyLanguage: language,
                  searchQuery,
                  task,
                }
            : isShoppingMode
            ? {
                expectedSchema: {
                  recommendations: [
                    {
                      fitScore: 0,
                      id: "one of the provided product ids only",
                      reason: "why this product fits",
                    },
                  ],
                  reply: "concise direct answer to this specific user message",
                },
                activePreferences: {
                  budget: profile.budget,
                  category: profile.category,
                  occasion: profile.occasion,
                  recipient: profile.recipient,
                },
                query: userMessage,
                replyLanguage: language,
                productCatalogFromCommerceMcp: products,
                searchQuery,
                task,
              }
            : {
                expectedSchema: {
                  eventPlan: ["optional checklist line"],
                  giftMessage: "optional generated message",
                  mode: "active mode",
                  recommendations: [
                    {
                      fitScore: 0,
                      id: "one of the provided live product ids only",
                      reason: "why this product fits",
                    },
                  ],
                  reply: "concise direct answer to this specific user message",
                },
                activePreferences: {
                  budget: profile.budget,
                  category: profile.category,
                  occasion: profile.occasion,
                  recipient: profile.recipient,
                },
                mode,
                messageIntent: messageAnalysis.intent,
                requestedGiftType: messageAnalysis.preferences.requestedGiftType,
                productCatalogFromCommerceMcp: products,
                profile,
                query: isPlanOnlyTask ? query : userMessage,
                replyLanguage: language,
                searchContext: {
                  budgetResult: productSearch
                    ? getBudgetSearchReply(productSearch, products.length)
                    : null,
                  catalogSearchQuery: searchQuery,
                },
                task,
              },
        ),
      },
    ],
    temperature: 0.2,
    max_completion_tokens: isReplyOnlyTask ? 320 : 500,
    reasoning_effort: "low",
    response_format: {
      type: "json_object",
    },
  }, []);
  const { response } = await groqCommercePromise;

  if (!response.ok) {
    throw new Error(await readGroqError(response));
  }

  const content = getAssistantContent((await response.json()) as unknown);

  if (!content) {
    throw new Error("Groq returned an empty commerce response.");
  }

  const commerce = parseCommerceResponse(content, mode, products);
  const initialReply = commerce.reply.trim();

  if (!initialReply.trim()) {
    throw new Error("Groq returned an empty reply.");
  }
  const sanitizedReply = sanitizeChatReply(initialReply, products);

  if (!sanitizedReply) {
    throw new Error("Groq returned an invalid reply.");
  }

  return {
    ...commerce,
    reply: sanitizedReply,
  };
}
