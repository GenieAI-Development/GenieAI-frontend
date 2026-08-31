import type { Product } from "@/lib/productCatalog";
import type { RankingEvent, ShoppingProfile } from "../commerce/types";

export type RagPreferences = Pick<
  ShoppingProfile,
  "budget" | "category" | "city" | "occasion" | "recipient"
> & {
  budgetMax?: number;
  budgetMin?: number;
  deliveryCity?: string;
};

export type RagCandidate = Product & {
  relevanceScore?: number;
  similarityScore: number;
};

export type RerankedProduct = RagCandidate & {
  relevanceScore: number;
};

export type ProductRankingRequest = {
  events: RankingEvent[];
  fallbackCandidates?: () => Promise<Product[]>;
  preferences: RagPreferences;
  query: string;
  sessionId: string;
};

export type ProductRankingResult = {
  meta: {
    personalized: boolean;
    rerankerFallback: boolean;
    retrievalFallback: boolean;
    source: string;
  };
  products: Product[];
};
