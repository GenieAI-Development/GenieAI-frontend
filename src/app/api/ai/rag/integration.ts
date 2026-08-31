import "server-only";

import type { Product } from "@/lib/productCatalog";
import { buildSemanticQuery } from "./filters";
import { personalizeRankedProducts } from "./personalization";
import {
  MIN_CANDIDATES,
  retrieveKeywordFallback,
  retrieveSemanticCandidates,
} from "./retrieval";
import { rerankProductsWithGroq } from "./reranking";
import type {
  ProductRankingRequest,
  ProductRankingResult,
  RagCandidate,
} from "./types";
import { embedProductQuery } from "./vectorization";

function toFallbackCandidates(products: Product[]) {
  const denominator = Math.max(1, products.length - 1);
  return products.slice(0, MIN_CANDIDATES).map((product, index) => ({
    ...product,
    similarityScore: Math.max(0, 1 - index / denominator),
  }));
}

function removeInternalScores(product: RagCandidate): Product {
  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    category: product.category,
    price: product.price,
    currency: product.currency,
    stock: product.stock,
    stockLabel: product.stockLabel,
    eta: product.eta,
    description: product.description,
    url: product.url,
    ...(product.apiDetails ? { apiDetails: product.apiDetails } : {}),
  };
}

function mergeUniqueCandidates(
  current: RagCandidate[],
  additions: RagCandidate[],
) {
  const byId = new Map(current.map((product) => [product.id, product]));

  for (const product of additions) {
    if (!byId.has(product.id)) {
      byId.set(product.id, product);
    }
  }

  return [...byId.values()].slice(0, MIN_CANDIDATES);
}

export async function rankCommerceProducts({
  events,
  fallbackCandidates,
  preferences,
  query,
  sessionId,
}: ProductRankingRequest): Promise<ProductRankingResult> {
  const semanticQuery = buildSemanticQuery(query, preferences);
  let candidates: RagCandidate[] = [];
  let retrievalFallback = false;
  let source = "supabase-vector";

  try {
    const embedding = await embedProductQuery(semanticQuery);
    candidates = await retrieveSemanticCandidates({
      embedding,
      limit: MIN_CANDIDATES,
      preferences,
    });

    if (candidates.length === 0) {
      throw new Error("Vector search returned no eligible products.");
    }
  } catch {
    retrievalFallback = true;
    source = "supabase-keyword";

    try {
      candidates = await retrieveKeywordFallback({
        limit: MIN_CANDIDATES,
        preferences,
        query: semanticQuery,
      });
    } catch {
      candidates = [];
    }

  }

  if (candidates.length < MIN_CANDIDATES && source === "supabase-vector") {
    try {
      const keywordCandidates = await retrieveKeywordFallback({
        limit: MIN_CANDIDATES,
        preferences,
        query: semanticQuery,
      });
      candidates = mergeUniqueCandidates(candidates, keywordCandidates);
      retrievalFallback = true;
      source = "supabase-vector+keyword";
    } catch {
      // The live catalog below can still supplement a short vector result.
    }
  }

  if (candidates.length < MIN_CANDIDATES && fallbackCandidates) {
    try {
      const liveCandidates = toFallbackCandidates(await fallbackCandidates());
      candidates = mergeUniqueCandidates(candidates, liveCandidates);
      retrievalFallback = true;
      source = candidates.length > liveCandidates.length
        ? `${source}+live-catalog`
        : "live-catalog";
    } catch {
      // Keep any valid Supabase candidates already found.
    }
  }

  const reranked = await rerankProductsWithGroq(semanticQuery, candidates);
  const personalized = personalizeRankedProducts({
    events,
    products: reranked.products,
    sessionId,
  });

  return {
    meta: {
      personalized: personalized.personalized,
      rerankerFallback: reranked.fallback,
      retrievalFallback,
      source,
    },
    products: personalized.products.map(removeInternalScores),
  };
}
