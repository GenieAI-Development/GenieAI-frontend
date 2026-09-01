import type { CatalogSearchProduct } from "@/lib/productCatalog";

export type CommerceRecommendation = {
  id: string;
  fitScore: number;
  reason: string;
};

export type MessageIntent = "command" | "conversation" | "question";
export type DetectedLanguage = "English" | "Sinhala" | "Singlish";

export type PreferenceSnapshot = {
  budget: string | null;
  category: string | null;
  occasion: string | null;
  recipient: string | null;
  requestedGiftType: string | null;
};

export type ExtendedPreferences = {
  budget: string;
  giftType: string;
  occasion: string;
  recipient: string;
};

export type ExtendedPreferenceUpdates = {
  budget: string | null;
  giftType: string | null;
  occasion: string | null;
  recipient: string | null;
};

export type MessageAnalysis = {
  detectedLanguage: DetectedLanguage;
  extendedPreferences: ExtendedPreferenceUpdates;
  intent: MessageIntent;
  preferences: PreferenceSnapshot;
  requiresProductSearch: boolean;
  searchQuery: string | null;
};

export type ShoppingProfile = {
  budget?: string;
  category?: string;
  city?: string;
  date?: string;
  occasion?: string;
  recipient?: string;
};

export type CatalogSearchResponse = {
  applied_filters?: unknown;
  next_cursor?: string | null;
  result?: string;
  results?: CatalogSearchProduct[];
};

export type CatalogProductDetailResponse = {
  category?: {
    id?: string;
    name?: string;
    path?: string;
    slug?: string;
  };
  description?: string;
  id?: string;
  images?: string[];
  in_stock?: boolean;
  name?: string;
  price?: {
    amount?: number;
    currency?: string;
  };
  stock_level?: string;
  summary?: string;
  url?: string;
};

export type CatalogCityResponse = {
  cities?: Array<{
    aliases?: string[];
    name?: string;
  }>;
};

export type CatalogDeliveryResponse = {
  available?: boolean;
  checked_date?: string;
  city?: string;
  currency?: string;
  next_available_date?: string | null;
  perishable_warning?: string | null;
  rate?: number;
  reason?: string | null;
  result?: string;
};

export type CatalogOrderResponse = {
  checkout_url?: string;
  checkoutUrl?: string;
  click_to_pay_url?: string;
  expires_at?: string;
  order_ref?: string;
  result?: string;
  summary?: {
    addons_total?: number;
    currency?: string;
    delivery_fee?: number;
    grand_total?: number;
    items_total?: number;
  };
};

export type BudgetFilter = {
  max_price?: number;
  min_price?: number;
};

export type ProductSearchResult = {
  budgetFilter: BudgetFilter;
  exactBudgetMatched: boolean;
  nearbyBudgetLabel?: string;
  requestedBudgetLabel?: string;
  results: CatalogSearchProduct[];
  usedNearbyBudgetFallback: boolean;
};

export type RankingEvent = {
  category?: string;
  event:
    | "impression"
    | "view"
    | "compare"
    | "add_to_cart"
    | "remove_from_cart"
    | "search"
    | "purchase";
  eventId?: string;
  position?: number;
  price?: number;
  productId?: string;
  query?: string;
  timestamp?: string;
};

export type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

export type CommerceResponse = {
  analytics: {
    buyBoxHealth: string;
    conversionSignal: string;
    nextBestAction: string;
    risk: string;
  };
  chips: string[];
  comparisonInsights: ProductComparisonInsights[];
  eventPlan: string[];
  eventUserPreference?: ExtendedPreferences;
  extendedPreferences?: ExtendedPreferences;
  giftMessage: string;
  giftUserPreference?: ExtendedPreferences;
  mode: string;
  productSearchPerformed?: boolean;
  recommendations: CommerceRecommendation[];
  reply: string;
};

export type ComparisonInsight = {
  label: string;
  percentage: number | null;
};

export type ProductComparisonInsights = {
  id: string;
  insights: ComparisonInsight[];
};

export type CheckoutDetails = {
  address?: string;
  giftMessage?: string;
  locationType?: string;
  recipientName?: string;
  recipientPhone?: string;
  senderName?: string;
};

export type GiftMessagePreferences = {
  language?: string;
  size?: string;
  suggestions?: string;
  tone?: string;
};
