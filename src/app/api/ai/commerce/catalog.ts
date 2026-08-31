import { commerceTools, createCommerceMcpClient } from "@/lib/commerceMcp";
import {
  type CatalogSearchProduct,
  type Product,
  toProduct,
} from "@/lib/productCatalog";
import { rankCommerceProducts } from "../rag/integration";
import { getCachedValue } from "./cache";
import {
  COMMON_GIFT_SEARCH_QUERY,
  COMMON_GIFT_SEARCH_TERMS,
  MAX_RANKED_PRODUCTS,
  MAX_PRODUCT_SEARCH_CACHE_ENTRIES,
  PRODUCT_SEARCH_CACHE_TTL_MS,
} from "./constants";
import {
  formatBudgetFilter,
  getPreferenceSearchTerms,
  hasBudgetFilter,
  isProductInsideBudget,
  isProductRelevantToPreferences,
  parseBudgetFilter,
} from "./preferences";
import type {
  BudgetFilter,
  CacheEntry,
  CatalogProductDetailResponse,
  CatalogSearchResponse,
  ProductSearchResult,
  RankingEvent,
  ShoppingProfile,
} from "./types";

const productSearchCache = new Map<string, CacheEntry<ProductSearchResult>>();

export function getBudgetSearchReply(
  search: ProductSearchResult,
  productCount: number,
) {
  if (!hasBudgetFilter(search.budgetFilter)) {
    return null;
  }

  const requestedBudgetLabel =
    search.requestedBudgetLabel ?? formatBudgetFilter(search.budgetFilter);
  const productLabel = productCount === 1 ? "product" : "products";

  if (search.exactBudgetMatched) {
    return `I found some ${productLabel} in ${requestedBudgetLabel}`;
  }

  if (search.usedNearbyBudgetFallback && productCount > 0) {
    return `No products match in ${requestedBudgetLabel}. I'll show related gifts around ${search.nearbyBudgetLabel ?? "that price"} instead.`;
  }

  return `No products match in ${requestedBudgetLabel}, and I could not find nearby products for this search.`;
}

export async function searchCatalogProducts(
  mcp: Awaited<ReturnType<typeof createCommerceMcpClient>>,
  query: string,
  profile: ShoppingProfile,
  rawQuery = query,
  limit = MAX_RANKED_PRODUCTS,
): Promise<ProductSearchResult> {
  const cacheKey = JSON.stringify({
    budget: profile.budget,
    category: profile.category,
    occasion: profile.occasion,
    query,
    rawQuery,
    recipient: profile.recipient,
    limit,
  });

  return getCachedValue(
    productSearchCache,
    cacheKey,
    PRODUCT_SEARCH_CACHE_TTL_MS,
    MAX_PRODUCT_SEARCH_CACHE_ENTRIES,
    () => searchCatalogProductsUncached(mcp, query, profile, rawQuery, limit),
  );
}

export async function searchCatalogProductsUncached(
  mcp: Awaited<ReturnType<typeof createCommerceMcpClient>>,
  query: string,
  profile: ShoppingProfile,
  rawQuery = query,
  limit = MAX_RANKED_PRODUCTS,
): Promise<ProductSearchResult> {
  const budgetFilter = parseBudgetFilter(rawQuery, profile.budget);
  const searchTerms =
    query === COMMON_GIFT_SEARCH_QUERY
      ? COMMON_GIFT_SEARCH_TERMS
      : getPreferenceSearchTerms(query, profile);
  const baseParams = {
    currency: "LKR",
    in_stock_only: true,
    limit: Math.max(1, Math.min(60, Math.round(limit))),
    response_format: "json",
    sort: "relevance",
  };

  async function searchWithParams(filter: BudgetFilter = {}) {
    const responseResults = await Promise.allSettled(
      searchTerms.map((term) =>
        mcp.callTool<CatalogSearchResponse>(commerceTools.searchProducts, {
          ...baseParams,
          ...filter,
          q: term,
        }),
      ),
    );
    const responses = responseResults
      .filter(
        (result): result is PromiseFulfilledResult<CatalogSearchResponse> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);

    if (responses.length === 0) {
      const firstFailure = responseResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      throw firstFailure?.reason ?? new Error("Live product search failed.");
    }
    const seenIds = new Set<string>();

    const rawResults =
      query === COMMON_GIFT_SEARCH_QUERY
        ? [
            ...responses.flatMap((response) =>
              response.results?.[0] ? [response.results[0]] : [],
            ),
            ...responses.flatMap(
              (response) => response.results?.slice(1) ?? [],
            ),
          ]
        : responses.flatMap((response) => response.results ?? []);

    return rawResults
      .filter((product) => {
        const id = typeof product.id === "string" ? product.id : null;

        if (!id || seenIds.has(id)) {
          return false;
        }

        seenIds.add(id);
        return true;
      })
      .filter((product) =>
        isProductRelevantToPreferences(product, query, profile),
      )
      .slice(0, Math.max(1, Math.min(60, Math.round(limit))));
  }

  if (!hasBudgetFilter(budgetFilter)) {
    const results = await searchWithParams();

    return {
      budgetFilter,
      exactBudgetMatched: false,
      results,
      usedNearbyBudgetFallback: false,
    };
  }

  const withBudget = await searchWithParams(budgetFilter);
  const exactResults = withBudget.filter((product) => {
    const normalized = toProduct(product);
    return normalized ? isProductInsideBudget(normalized, budgetFilter) : false;
  });

  if (exactResults.length > 0) {
    return {
      budgetFilter,
      exactBudgetMatched: true,
      requestedBudgetLabel: formatBudgetFilter(budgetFilter),
      results: exactResults,
      usedNearbyBudgetFallback: false,
    };
  }

  return {
    budgetFilter,
    exactBudgetMatched: false,
    requestedBudgetLabel: formatBudgetFilter(budgetFilter),
    results: [],
    usedNearbyBudgetFallback: false,
  };
}

export async function searchRankedCommerceProducts({
  events,
  profile,
  query,
  sessionId,
}: {
  events: RankingEvent[];
  profile: ShoppingProfile;
  query: string;
  sessionId: string;
}) {
  const result = await rankCommerceProducts({
    events,
    preferences: profile,
    query,
    sessionId,
    fallbackCandidates: async () => {
      const mcp = await createCommerceMcpClient();
      const search = await searchCatalogProducts(
        mcp,
        query,
        profile,
        query,
        20,
      );

      return search.results
        .map((product) => toProduct(product))
        .filter((product): product is Product => product !== null);
    },
  });

  return result.products.slice(0, MAX_RANKED_PRODUCTS);
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out.")), timeoutMs),
    ),
  ]);
}

export async function searchProductsByIds(
  mcp: Awaited<ReturnType<typeof createCommerceMcpClient>>,
  productIds: string[],
) {
  const normalizeProductId = (value: string) =>
    value.trim().replace(/\s+/g, "").toUpperCase();
  const results = await Promise.allSettled(
    productIds.map((productId) =>
      withTimeout(
        mcp.callTool<CatalogProductDetailResponse>(commerceTools.getProduct, {
          currency: "LKR",
          product_id: productId,
          response_format: "json",
        }),
        7000,
      ),
    ),
  );
  const seenIds = new Set<string>();

  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled") {
      return [];
    }

    const rawProduct = result.value;
    const requestedId = normalizeProductId(productIds[index] ?? "");
    const resolvedId =
      typeof rawProduct.id === "string"
        ? normalizeProductId(rawProduct.id)
        : "";

    if (!resolvedId || resolvedId !== requestedId) {
      return [];
    }

    const compareProduct: CatalogSearchProduct = {
      category: rawProduct.category,
      id: rawProduct.id,
      image_url: Array.isArray(rawProduct.images)
        ? rawProduct.images[0]
        : undefined,
      in_stock: rawProduct.in_stock,
      name: rawProduct.name,
      price: rawProduct.price,
      stock_level: rawProduct.stock_level,
      summary: rawProduct.summary ?? rawProduct.description,
      url: rawProduct.url,
    };

    if (seenIds.has(resolvedId)) {
      return [];
    }

    seenIds.add(resolvedId);
    return [compareProduct];
  });
}
