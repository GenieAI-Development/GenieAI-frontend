import "server-only";

import {
  getPersonalizationProfile,
  recordPersonalizationEvent,
} from "@/lib/personalization/profileStore";
import type { Product } from "@/lib/productCatalog";
import type { RankingEvent } from "../commerce/types";
import { getAssignedCategory } from "./filters";
import type { RerankedProduct } from "./types";

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("en").replaceAll("_", " ");
}

function getCategoryKey(value: string) {
  return getAssignedCategory(value) ?? normalizeKey(value);
}

function getPreferenceScore(
  product: Product,
  profile: NonNullable<ReturnType<typeof getPersonalizationProfile>>,
) {
  const categoryScores = Object.entries(profile.categoryScores);
  const maxCategoryScore = Math.max(
    0,
    ...categoryScores.map(([, score]) => Math.max(0, score)),
  );
  const productCategory = getCategoryKey(product.category);
  const matchingCategoryScore = categoryScores.reduce((best, [category, score]) => {
    const normalizedCategory = getCategoryKey(category);
    return productCategory === normalizedCategory
      ? Math.max(best, score)
      : best;
  }, 0);
  const categoryScore =
    maxCategoryScore > 0
      ? Math.max(0, matchingCategoryScore) / maxCategoryScore
      : 0;
  const hasPricePreference =
    profile.preferredPriceMin !== null && profile.preferredPriceMax !== null;
  const priceMidpoint = hasPricePreference
    ? (profile.preferredPriceMin! + profile.preferredPriceMax!) / 2
    : null;
  const priceScore =
    priceMidpoint === null
      ? 0
      : Math.max(
          0,
          1 - Math.abs(product.price - priceMidpoint) / Math.max(priceMidpoint, 1),
        );
  const repeatPenalty = profile.recentProductIds.includes(product.id) ? 0.25 : 0;

  return Math.max(
    0,
    Math.min(1, 0.7 * categoryScore + 0.3 * priceScore - repeatPenalty),
  );
}

export function personalizeRankedProducts({
  events,
  products,
  sessionId,
}: {
  events: RankingEvent[];
  products: RerankedProduct[];
  sessionId: string;
}) {
  if (events.length === 0) {
    return { personalized: false, products };
  }

  for (const event of events) {
    recordPersonalizationEvent(sessionId, {
      ...event,
      category: event.category
        ? (getAssignedCategory(event.category) ?? event.category)
        : undefined,
      timestamp: event.timestamp ?? new Date().toISOString(),
    });
  }

  const profile = getPersonalizationProfile(sessionId);
  if (!profile) {
    return { personalized: false, products };
  }

  return {
    personalized: true,
    products: products
      .map((product, originalIndex) => ({
        finalScore:
          0.75 * product.relevanceScore +
          0.25 * getPreferenceScore(product, profile),
        originalIndex,
        product,
      }))
      .sort(
        (first, second) =>
          second.finalScore - first.finalScore ||
          first.originalIndex - second.originalIndex,
      )
      .map(({ product }) => product),
  };
}
