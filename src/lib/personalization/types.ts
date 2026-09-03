export type PersonalizationEventType =
  | "search"
  | "impression"
  | "view"
  | "compare"
  | "add_to_cart"
  | "remove_from_cart"
  | "purchase";

export type PersonalizationEvent = {
  category?: string;
  event: PersonalizationEventType;
  eventId?: string;
  position?: number;
  price?: number;
  productId?: string;
  query?: string;
  timestamp: string;
};

export type PersonalizationProfile = {
  categoryScores: Record<string, number>;
  preferredPriceMax: number | null;
  preferredPriceMin: number | null;
  recentProductIds: string[];
  recentQueries: string[];
  seenEventIds: string[];
  sessionId: string;
  signalCount: number;
  updatedAt: string;
};

