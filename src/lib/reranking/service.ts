import "server-only";

import type { Product } from "@/lib/productCatalog";
import {
  getPersonalizationProfile,
  recordPersonalizationEvents,
} from "@/lib/personalization/profileStore";
import type {
  PersonalizationEvent,
  PersonalizationProfile,
} from "@/lib/personalization/types";
import { rerankWithHuggingFace } from "./huggingFace";

const RELEVANCE_WEIGHT = 0.75;
const PREFERENCE_WEIGHT = 0.25;

export type RerankPipelineResult = {
  fallback: boolean;
  products: RankedProduct[];
  source: "huggingface-crossencoder" | "original-order";
};

export type RankedProduct = Product & {
  finalScore: number;
  rerankerScore?: number;
};

function normalizeRelevance(rawScore: number) {
  const safeScore = Math.max(-20, Math.min(20, rawScore));
  return 1 / (1 + Math.exp(-safeScore));
}

function getPreferenceScore(
  product: Product,
  profile: PersonalizationProfile | null,
) {
  if (!profile || profile.signalCount === 0) {
    return null;
  }

  const positiveCategoryScores = Object.values(profile.categoryScores).map(
    (score) => Math.max(0, score),
  );
  const maxCategoryScore = Math.max(0, ...positiveCategoryScores);
  const categoryScore =
    maxCategoryScore > 0
      ? Math.max(
          0,
          profile.categoryScores[product.category.trim().toLowerCase()] ?? 0,
        ) / maxCategoryScore
      : 0;

  const preferredPrice =
    profile.preferredPriceMin !== null && profile.preferredPriceMax !== null
      ? (profile.preferredPriceMin + profile.preferredPriceMax) / 2
      : profile.preferredPriceMax ?? profile.preferredPriceMin;
  const priceScore =
    preferredPrice !== null
      ? Math.max(
          0,
          1 - Math.abs(product.price - preferredPrice) / Math.max(preferredPrice, 1),
        )
      : 0;
  const repeatPenalty = profile.recentProductIds.includes(product.id) ? 0.25 : 0;

  return Math.max(
    0,
    Math.min(1, 0.7 * categoryScore + 0.3 * priceScore - repeatPenalty),
  );
}

function originalOrderRelevance(index: number, total: number) {
  return total <= 1 ? 1 : 1 - (index / (total - 1)) * 0.5;
}

export async function rerankProducts({
  events,
  products,
  query,
  sessionId,
}: {
  events: PersonalizationEvent[];
  products: Product[];
  query: string;
  sessionId: string;
}): Promise<RerankPipelineResult> {
  if (events.length > 0) {
    recordPersonalizationEvents(sessionId, events);
  }
  const profile = getPersonalizationProfile(sessionId);

  let fallback = false;
  let rawScores = new Map<string, number>();

  try {
    const results = await rerankWithHuggingFace(query, products);
    rawScores = new Map(results.map((result) => [result.id, result.rerankerScore]));

    if (rawScores.size !== products.length) {
      throw new Error("Hugging Face reranker omitted one or more products.");
    }
  } catch {
    fallback = true;
  }

  const ranked = products
    .map((product, index) => {
      const relevance = fallback
        ? originalOrderRelevance(index, products.length)
        : normalizeRelevance(rawScores.get(product.id)!);
      const preference = getPreferenceScore(product, profile);
      const finalScore =
        preference === null
          ? relevance
          : RELEVANCE_WEIGHT * relevance + PREFERENCE_WEIGHT * preference;

      return {
        finalScore,
        index,
        product: {
          ...product,
          finalScore: Number(finalScore.toFixed(6)),
          ...(!fallback
            ? { rerankerScore: rawScores.get(product.id)! }
            : {}),
        },
      };
    })
    .sort(
      (first, second) =>
        second.finalScore - first.finalScore || first.index - second.index,
    )
    .map(({ product }) => product);

  return {
    fallback,
    products: ranked,
    source: fallback ? "original-order" : "huggingface-crossencoder",
  };
}
