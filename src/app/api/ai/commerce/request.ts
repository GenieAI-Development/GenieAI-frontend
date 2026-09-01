import {
  asRecord,
  getNumber,
  getString,
  type ChatMessage,
} from "@/lib/aiPayload";
import type { Product } from "@/lib/productCatalog";
import { INITIAL_REPLY_CHIPS, RANKING_EVENT_TYPES } from "./constants";
import type {
  CatalogDeliveryResponse,
  CommerceRecommendation,
  CommerceResponse,
  ExtendedPreferences,
  MessageIntent,
  RankingEvent,
  ShoppingProfile,
} from "./types";

export function getSubmittedPreferenceRecord(
  bodyRecord: Record<string, unknown> | null | undefined,
  mode: string,
) {
  if (mode.includes("Event")) {
    return bodyRecord?.eventUserPreference ?? bodyRecord?.extendedPreferences;
  }

  if (mode.includes("Gift Box")) {
    return bodyRecord?.giftUserPreference ?? bodyRecord?.extendedPreferences;
  }

  return bodyRecord?.extendedPreferences;
}

export function getPreferenceResponseForMode(
  mode: string,
  preferences: ExtendedPreferences,
) {
  if (mode.includes("Event")) {
    return { eventUserPreference: preferences };
  }

  if (mode.includes("Gift Box")) {
    return { giftUserPreference: preferences };
  }

  return { extendedPreferences: preferences };
}

export function isDeliveryRequested(message: string) {
  return /\b(deliver(?:y|ed|ing)?|shipping|ship|arriv(?:e|al)|same[-\s]?day|delivery\s+fee)\b|බෙදාහැර|ඩිලිවරි|ගෙනැවිත්|delivery|deliver/iu.test(
    message,
  );
}

export function getLocalDeliveryRuleReply(language: string) {
  if (language === "Sinhala") {
    return "ඕනෑම භාණ්ඩයක් බෙදාහැරීමට අවම වශයෙන් දින 1ක් අවශ්‍යයි. එම නිසා අවශ්‍ය බෙදාහැරීමේ දිනයට අවම වශයෙන් දින 1කට පෙර ඇණවුම ලබා දෙන්න.";
  }

  if (language === "Singlish") {
    return "Onema item ekak deliver karanna aduma tharamin dawas 1k yanawa. E nisa delivery eka ona dinata aduma tharamin dawas 1kata kalin order karanna.";
  }

  return "Delivery takes at least 1 day for every item. Please place your order at least 1 day before the required delivery date.";
}

export function getRandomInitialChips() {
  return [...INITIAL_REPLY_CHIPS].sort(() => Math.random() - 0.5).slice(0, 2);
}

export function getShoppingReplyChips() {
  const [randomStarterChip] = getRandomInitialChips();
  return ["Suggest more", randomStarterChip].filter(Boolean).slice(0, 2);
}

export function getLocalAnalytics({
  delivery,
  deliveryRequested,
  intent,
  products,
  profile,
  recommendations,
}: {
  delivery: CatalogDeliveryResponse | null;
  deliveryRequested: boolean;
  intent: MessageIntent;
  products: Product[];
  profile: ShoppingProfile;
  recommendations: CommerceRecommendation[];
}): CommerceResponse["analytics"] {
  const hasProducts = products.length > 0;
  const hasRankedProducts = recommendations.length > 0;

  return {
    buyBoxHealth: hasProducts
      ? hasRankedProducts
        ? "Ranked live products ready"
        : "Live products ready"
      : "No exact live product match",
    conversionSignal:
      intent === "command"
        ? "Active shopping request"
        : intent === "question"
          ? "Product research question"
          : "Shopping conversation",
    nextBestAction: deliveryRequested
      ? !profile.city
        ? "Add a delivery city"
        : delivery
          ? "Review delivery availability"
          : "Retry the delivery check"
      : hasProducts
        ? "Review the recommended cards"
        : "Change a search preference",
    risk: !hasProducts
      ? "Live catalog returned no exact match"
      : deliveryRequested && delivery?.available === false
        ? "Requested delivery is unavailable"
        : "Price and stock can change",
  };
}

export function parseStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export function parseRankingEvents(value: unknown): RankingEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): RankingEvent | null => {
      const record = asRecord(item);
      const event = getString(record, "event") as RankingEvent["event"] | null;

      if (!event || !RANKING_EVENT_TYPES.has(event)) {
        return null;
      }

      const optionalString = (key: string, maxLength: number) =>
        getString(record, key)?.trim().slice(0, maxLength) || undefined;
      const optionalNumber = (key: string) => {
        const number = getNumber(record, key);
        return number !== null && number >= 0 ? number : undefined;
      };

      return {
        category: optionalString("category", 120),
        event,
        eventId: optionalString("eventId", 100),
        position: optionalNumber("position"),
        price: optionalNumber("price"),
        productId: optionalString("productId", 160),
        query: optionalString("query", 500),
        timestamp: optionalString("timestamp", 40),
      };
    })
    .filter((event): event is RankingEvent => event !== null)
    .slice(0, 100);
}

export function parseConversationHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      const role = getString(record, "role");
      const content = getString(record, "content")?.trim();

      if ((role !== "user" && role !== "assistant") || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        message !== null,
    )
    .slice(-3);
}

export function parseUserChatHistory(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((message): message is string => typeof message === "string")
    .map((message) => message.trim())
    .filter(Boolean)
    .slice(-3);
}

export function parseChipArray(value: unknown, maxItems: number) {
  return parseStringArray(value, maxItems)
    .filter(
      (chip) =>
        !/\b(check delivery|delivery check|create order link|order link|open checkout|more like this|search products)\b|බෙදාහැරීම|ඇණවුම්\s+සබැඳිය/iu.test(
          chip,
        ),
    )
    .map((chip) => chip.split(/\s+/u).slice(0, 3).join(" "))
    .filter((chip, index, chips) => chips.indexOf(chip) === index);
}

export function getLocalDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function getNonPastDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const today = getLocalDateString();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today ? value : today;
}

export function parseProfile(value: unknown): ShoppingProfile {
  const record = asRecord(value);

  return {
    budget: getString(record, "budget") ?? undefined,
    category: getString(record, "category") ?? undefined,
    city: getString(record, "city") ?? undefined,
    date: getNonPastDate(getString(record, "date") ?? undefined),
    occasion: getString(record, "occasion") ?? undefined,
    recipient: getString(record, "recipient") ?? undefined,
  };
}
