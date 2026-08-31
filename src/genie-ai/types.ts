import type { Product } from "@/lib/productCatalog";
import type { GiftCardPreferences } from "./v3/GiftCardTool";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  retryContext?: boolean;
  retryReason?: "timeout";
  retryText?: string;
  variant?: "context-panel";
};

export type IconName =
  | "box"
  | "camera"
  | "cart"
  | "check"
  | "gift"
  | "heart"
  | "menu"
  | "mic"
  | "plus"
  | "search"
  | "send"
  | "settings"
  | "speaker"
  | "sparkles"
  | "truck"
  | "trash"
  | "x";

export type CommerceResponse = {
  analytics?: {
    buyBoxHealth?: string;
    conversionSignal?: string;
    nextBestAction?: string;
    risk?: string;
  };
  chips?: string[];
  comparisonInsights?: Array<{
    id: string;
    insights: ComparisonInsight[];
  }>;
  detectedLanguage?: Language;
  eventPlan?: string[];
  extendedPreferences?: ExtendedPreferences;
  eventUserPreference?: ExtendedPreferences;
  giftUserPreference?: ExtendedPreferences;
  giftMessage?: string;
  preferences?: {
    budget: string;
    category: string;
    occasion: string;
    recipient: string;
  };
  products?: Product[];
  recommendations?: Array<{
    id: string;
    fitScore: number;
    reason: string;
  }>;
  reply?: string;
  delivery?: {
    available?: boolean;
    checked_date?: string;
    city?: string;
    currency?: string;
    next_available_date?: string | null;
    perishable_warning?: string | null;
    rate?: number;
    reason?: string | null;
  } | null;
  checkout?: {
    checkout_url?: string;
    expires_at?: string;
    order_ref?: string;
    result?: string;
    summary?: {
      currency?: string;
      delivery_fee?: number;
      grand_total?: number;
      items_total?: number;
    };
  };
};

export function getCheckoutResponseMessage(data: CommerceResponse) {
  return (
    data.checkout?.result ??
    data.reply ??
    "GenieAI returned checkout details without a checkout link."
  );
}

export type ComparisonInsight = {
  label: string;
  percentage: number | null;
};

export type CompareRow = {
  insights: ComparisonInsight[];
  product: Product;
};

export type GuidedPlanItem = {
  label: string;
  quantity: string;
  searchTerm: string;
};

export type SuggestedPrompt = {
  action: "fill" | "custom";
  text: string;
};

export type ImageResponse = {
  error?: string;
  fallback?: boolean;
  model?: string;
  productHints?: string[];
  searchQuery?: string;
  summary?: string;
  visibleText?: string[];
};

export type VoiceResponse = {
  error?: string;
  language?: "en";
  retry?: boolean;
  transcript?: string;
};

export type RequiredField = "budget" | "recipient" | "occasion";

export type ContextField =
  | RequiredField
  | "boxRecipient"
  | "category"
  | "eventType"
  | "giftBoxTheme"
  | "itemCount"
  | "participants"
  | "venue";

export type ContextDraft = Record<ContextField, string>;

export type Language = "English" | "Sinhala" | "Singlish";

export type ShoppingProfile = {
  budget: string;
  category: string;
  city: string;
  date: string;
  interests: string;
  occasion: string;
  recipient: string;
};

export type ExtendedPreferences = {
  budget: string;
  giftType: string;
  occasion: string;
  recipient: string;
  lastRepliedCount: number;
  replyCount: number;
};

export type ContextAnalysisResponse = {
  budget?: string | null;
  category?: string | null;
  detectedLanguage?: Language;
  error?: string;
  missingFields?: RequiredField[];
  occasion?: string | null;
  recipient?: string | null;
};

export type StoredChatState = {
  chips: string[];
  contextDraft: ContextDraft;
  conversationStage: "first-message" | "collecting-context" | "ready";
  extendedPreferences?: ExtendedPreferences;
  fitReasons?: Record<string, string>;
  guidedPlanIndex?: number;
  guidedPlanItems?: GuidedPlanItem[];
  giftCardAnalysis?: string;
  giftCardImage?: string;
  giftCardMessage?: string;
  giftCardPalette?: string[];
  giftCardPreferences?: GiftCardPreferences;
  giftCardProductId?: string;
  input: string;
  language: Language;
  messages: ChatMessage[];
  pendingUserRequest: string;
  profile: ShoppingProfile;
  productBatchIndex?: number;
  buyBox?: Product[];
  recommendedProducts?: Product[];
  initialCatalogVersion?: string;
  activeMode?: string;
  modeSessions?: Record<string, ModeSession>;
};

export type ModePreferencePayload = {
  eventUserPreference?: ExtendedPreferences;
  extendedPreferences?: ExtendedPreferences;
  giftUserPreference?: ExtendedPreferences;
};

export type ModeSession = {
  chips: string[];
  contextDraft: ContextDraft;
  conversationStage: "first-message" | "collecting-context" | "ready";
  extendedPreferences?: ExtendedPreferences;
  fitReasons?: Record<string, string>;
  guidedPlanIndex?: number;
  guidedPlanItems?: GuidedPlanItem[];
  input: string;
  messages: ChatMessage[];
  pendingUserRequest: string;
  profile: ShoppingProfile;
  productBatchIndex?: number;
  recommendedProducts?: Product[];
};

export type GiftCardResponse = {
  analysis?: string;
  error?: string;
  imageDataUrl?: string;
  message?: string;
  model?: string;
  palette?: string[];
};
