import type { CommerceResponse, RankingEvent } from "./types";

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_COMPARE_MODEL = "openai/gpt-oss-20b";
export const COMPARE_FALLBACK_MODELS = ["openai/gpt-oss-120b"];
export const DEFAULT_GIFT_MESSAGE_MODEL = "openai/gpt-oss-20b";
export const ENGLISH_GIFT_MESSAGE_FALLBACK_MODELS = ["openai/gpt-oss-120b"];
export const DEFAULT_SINHALA_GIFT_MESSAGE_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_SINHALA_CHAT_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_SINGLISH_CHAT_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_SINGLISH_GIFT_MESSAGE_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_ENGLISH_CHAT_MODEL = "openai/gpt-oss-20b";
export const INITIAL_REPLY_CHIPS = [
  "Find a gift",
  "Find a cake",
  "Find flowers",
  "Find chocolates",
  "Find perfume",
];

export const COMMON_GIFT_SEARCH_TERMS = ["chocolate", "cake", "flowers"];
export const COMMON_GIFT_SEARCH_QUERY = "__common_gifts__";
export const PREFERENCE_GIFT_TYPES = [
  "Flowers",
  "Cakes",
  "Chocolate",
  "Perfumes",
  "Fashion",
  "Other",
] as const;
export const PREFERENCE_BUDGETS = [
  "Under Rs. 2,500",
  "Rs. 2,500 - 5,000",
  "Rs. 5,000 - 10,000",
  "Above Rs. 10,000",
  "Other",
] as const;
export const PREFERENCE_OCCASIONS = [
  "Birthday",
  "Anniversary",
  "Wedding",
  "Graduation",
  "Other",
] as const;
export const PREFERENCE_RECIPIENTS = [
  "Male",
  "Female",
  "Child",
  "Couple",
  "Other",
] as const;

export const RANKING_EVENT_TYPES = new Set<RankingEvent["event"]>([
  "impression",
  "view",
  "compare",
  "favorite",
  "unfavorite",
  "wishlist",
  "remove_from_wishlist",
  "add_to_cart",
  "remove_from_cart",
  "search",
  "purchase",
]);

export const PRODUCT_SEARCH_CACHE_TTL_MS = 45_000;
export const CITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PRODUCT_SEARCH_CACHE_ENTRIES = 100;
export const MAX_CITY_CACHE_ENTRIES = 100;
export const MAX_RANKED_PRODUCTS = 12;
export const SUPPORTED_TASKS = new Set([
  "checkout",
  "compare",
  "eventPlan",
  "giftBox",
  "giftMessage",
  "initial",
  "productPageReply",
  "recommend",
  "reply",
]);

export const fallbackResponse: CommerceResponse = {
  analytics: {
    buyBoxHealth: "Live catalog ready",
    conversionSignal: "Waiting for a catalog match",
    nextBestAction: "Search the catalog",
    risk: "Catalog results may change",
  },
  chips: [],
  comparisonInsights: [],
  eventPlan: [],
  giftMessage: "",
  mode: "Smart Shopping",
  recommendations: [],
  reply: "",
};
