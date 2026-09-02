import type { ChatMessage } from "@/lib/aiPayload";
import { fetchGroqChatWithFallback } from "@/lib/groqHosted";
import {
  getHuggingFaceApiKey,
  getHuggingFaceNovitaReply,
} from "@/lib/huggingFaceNovita";
import type { Product } from "@/lib/productCatalog";
import { getAssistantContent } from "./ai";
import { getBudgetSearchReply } from "./catalog";
import {
  DEFAULT_ENGLISH_CHAT_MODEL,
  DEFAULT_SINHALA_CHAT_MODEL,
  DEFAULT_SINGLISH_CHAT_MODEL,
  fallbackResponse,
} from "./constants";
import {
  fallbackRecommendations,
  getAiProductReply,
  getLanguageSafeReply,
  getReplyLanguageInstruction,
  isNoMatchStyleReply,
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
  const replyLengthInstruction = isShoppingMode
    ? "In Smart Shopping mode, reply with one compact but detailed paragraph that can be up to three sentences."
    : "The reply must be one short paragraph.";
  const huggingFaceApiKey = getHuggingFaceApiKey();
  const directReplyPromise =
    language !== "English" && huggingFaceApiKey && !isPlanOnlyTask
      ? getHuggingFaceNovitaReply(huggingFaceApiKey, {
          messages: [
            {
              role: "system",
              content: `You are the direct conversation voice for GenieAI. Answer the user's actual message naturally and concisely. Answer questions directly, acknowledge or carry out commands, and respond naturally to conversation. Product cards update separately, so never say that you updated products. Never include product names, product IDs, prices, product categories, product examples, recommendation lists, bullets, or numbered lists. If exact matching products were not found, say so briefly and ask whether the user wants to change a preference; do not invent or suggest a substitute category. Use activePreferences as the single source of truth for the user's current preferences and do not mix it with older or conflicting categories. The selected replyLanguage is authoritative. English product terms may appear only when necessary. Do not reveal reasoning or include <think> blocks. ${replyLengthInstruction} ${getReplyLanguageInstruction(language)}`,
            },
            {
              role: "user",
              content: JSON.stringify({
                delivery,
                recentConversation: conversationHistory,
                exactCatalogMatchCount: products.length,
                activePreferences: {
                  budget: profile.budget,
                  category: profile.category,
                  occasion: profile.occasion,
                  recipient: profile.recipient,
                },
                messageIntent: messageAnalysis.intent,
                mode,
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
              }),
            },
          ],
          temperature: 0.2,
          max_tokens: 120,
        })
      : Promise.resolve(null);
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
        content: `You are the multilingual reasoning and conversation layer for GenieAI. ${isPlanOnlyTask ? "This is a plan-only request, so no product catalog is supplied or expected. Create the requested checklist from the submitted context without claiming that products were searched." : isTextOnlyTask ? "This is a text-only request. No product search was performed and no product catalog is expected. Answer the user's greeting, identity question, capability question, general conversation, or delivery-only question directly. Do not claim that products were searched or that product results were updated. If a delivery question needs a product, destination, or date that was not supplied, ask one concise clarification." : "Product and delivery data already came from the live commerce service. Rank only provided products that satisfy the active preferences. If no matching catalog products are supplied, clearly say that no exact match was found and ask whether the user wants to change a preference; never propose a substitute category."}${task === "eventPlan" ? " For Event Planner, suggest no more than four checklist items." : ""} The submitted profile is the user's highest-priority requirement: never replace its requested gift type, budget, recipient, or occasion with a different option. Use activePreferences as the single source of truth for the user's current preferences and do not mix it with older or conflicting categories. First respond to the user's actual message: answer a question directly, carry out or specifically acknowledge a command, and respond naturally to conversation. In Event Planner and Gift Box modes, always answer a custom user question or command directly in reply, even while a guided item list is active. Never use 'I updated the products', a translation of it, or another generic UI-update status as the reply. The product cards update separately while you reply. If facts needed to answer are not present in the supplied data, say so briefly or ask one useful clarification instead of inventing facts. Rank only the provided product IDs and never invent catalog products. ${replyLengthInstruction} Never include product names, product IDs, prices, or a written list of recommendations in reply because the UI shows products only as cards. For eventPlan and giftBox tasks, return the checklist only in eventPlan, never repeat that checklist in reply. For compare tasks, make reply a direct, useful response for the AI suggestions field without listing products. Analytics and reply chips are generated locally, so do not return them. Return JSON only. ${getReplyLanguageInstruction(language)}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          delivery,
          recentConversation: conversationHistory,
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
        }),
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 850,
    response_format: {
      type: "json_object",
    },
  });
  const { response } = await groqCommercePromise;
  const directReply = await Promise.race([
    directReplyPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 200)),
  ]);

  if (!response.ok) {
    return {
      ...fallbackResponse,
      mode,
      recommendations: fallbackRecommendations(products),
      reply: sanitizeChatReply(
        getLanguageSafeReply(language, directReply),
        products,
      ),
    };
  }

  const content = getAssistantContent((await response.json()) as unknown);

  if (!content) {
    return {
      ...fallbackResponse,
      mode,
      recommendations: fallbackRecommendations(products),
      reply: sanitizeChatReply(
        getLanguageSafeReply(language, directReply),
        products,
      ),
    };
  }

  const commerce = parseCommerceResponse(content, mode, products);
  const initialReply = getLanguageSafeReply(
    language,
    directReply,
    commerce.reply,
  );
  const needsPositiveProductReply =
    products.length > 0 && isNoMatchStyleReply(initialReply);
  const aiPositiveReply = needsPositiveProductReply
    ? await getAiProductReply(
        apiKey,
        language,
        userMessage,
        profile,
        conversationHistory,
        products,
      )
    : "";
  const reply = needsPositiveProductReply
    ? getLanguageSafeReply(language, aiPositiveReply, initialReply)
    : initialReply;

  return {
    ...commerce,
    reply: sanitizeChatReply(reply, products),
  };
}
