import { asRecord, getNumber, getString } from "@/lib/aiPayload";
import { commerceTools, createCommerceMcpClient } from "@/lib/commerceMcp";
import { cleanProductDescription } from "@/lib/productDescription";
import {
  type CatalogSearchProduct,
  type Product,
  toProduct,
} from "@/lib/productCatalog";
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
  ShoppingProfile,
} from "./types";

const productSearchCache = new Map<string, CacheEntry<ProductSearchResult>>();

export function normalizePythonProduct(value: unknown): Product | null {
  const record = asRecord(value);
  const id =
    getString(record, "product_id")?.trim() || getString(record, "id")?.trim();
  const name =
    getString(record, "title")?.trim() || getString(record, "name")?.trim();

  if (!id || !name) {
    return null;
  }

  const priceRecord = asRecord(record?.price);
  const directPrice =
    getNumber(record, "price_lkr") ?? getNumber(record, "price");
  const price = directPrice ?? getNumber(priceRecord, "amount") ?? 0;
  const categoryValue = record?.category;
  const category =
    (typeof categoryValue === "string" ? categoryValue.trim() : "") ||
    getString(asRecord(categoryValue), "name")?.trim() ||
    getString(record, "vendor")?.trim() ||
    "General";
  const hasStockSignal =
    typeof record?.inStock === "boolean" ||
    typeof record?.in_stock === "boolean" ||
    typeof record?.stock === "number";
  const inStock =
    !hasStockSignal ||
    record?.inStock === true ||
    record?.in_stock === true ||
    (typeof record?.stock === "number" && record.stock > 0);
  const rawImageUrl =
    getString(record, "image")?.trim() ||
    getString(record, "imageUrl")?.trim() ||
    getString(record, "image_url")?.trim() ||
    "";
  const markdownImageMatch = rawImageUrl.match(
    /^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i,
  );

  return {
    id,
    name,
    imageUrl:
      markdownImageMatch?.[1] || rawImageUrl || "/product-images/gift-box.svg",
    category,
    price,
    currency:
      getString(record, "currency")?.trim() ||
      getString(priceRecord, "currency")?.trim() ||
      "LKR",
    stock: inStock ? 1 : 0,
    stockLabel: inStock ? "In stock" : "Out of stock",
    eta: "Delivery availability is confirmed during checkout",
    description: cleanProductDescription(
      getString(record, "description")?.trim() ||
      getString(record, "summary")?.trim() ||
      getString(record, "reason")?.trim() ||
      "Product matched by GenieAI.",
    ),
    url: getString(record, "url")?.trim() || "#",
  };
}

export async function fetchPythonRankedProducts({
  message,
  sessionId,
}: {
  message: string;
  sessionId: string | null;
}) {
  const serviceUrl = process.env.AI_SERVICE_URL?.trim().replace(/\/+$/, "");

  if (!serviceUrl) {
    throw new Error("Python ranking is not configured. Set AI_SERVICE_URL.");
  }

  const response = await fetch(`${serviceUrl}/api/v1/recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      request_type: "product_recommendation",
      session_id: sessionId,
      message,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Python ranking failed with status ${response.status}.`);
  }

  const responseBody = asRecord(await response.json().catch(() => null));
  if (!responseBody || !Array.isArray(responseBody.products)) {
    throw new Error("Python ranking returned an invalid products response.");
  }

  const products = responseBody.products
    .map(normalizePythonProduct)
    .filter((product): product is Product => product !== null)
    .slice(0, MAX_RANKED_PRODUCTS);
  const reasons = new Map<string, string>();

  responseBody.products.forEach((value) => {
    const record = asRecord(value);
    const productId =
      getString(record, "product_id")?.trim() ||
      getString(record, "id")?.trim();
    const reason = getString(record, "reason")?.trim();

    if (productId && reason) {
      reasons.set(productId, reason);
    }
  });

  return {
    products,
    reasons,
    sessionId: getString(responseBody, "session_id")?.trim() || sessionId,
  };
}

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
): Promise<ProductSearchResult> {
  const cacheKey = JSON.stringify({
    budget: profile.budget,
    category: profile.category,
    occasion: profile.occasion,
    query,
    rawQuery,
    recipient: profile.recipient,
  });

  return getCachedValue(
    productSearchCache,
    cacheKey,
    PRODUCT_SEARCH_CACHE_TTL_MS,
    MAX_PRODUCT_SEARCH_CACHE_ENTRIES,
    () => searchCatalogProductsUncached(mcp, query, profile, rawQuery),
  );
}

export async function searchCatalogProductsUncached(
  mcp: Awaited<ReturnType<typeof createCommerceMcpClient>>,
  query: string,
  profile: ShoppingProfile,
  rawQuery = query,
): Promise<ProductSearchResult> {
  const budgetFilter = parseBudgetFilter(rawQuery, profile.budget);
  const searchTerms =
    query === COMMON_GIFT_SEARCH_QUERY
      ? COMMON_GIFT_SEARCH_TERMS
      : getPreferenceSearchTerms(query, profile);
  const baseParams = {
    currency: "LKR",
    in_stock_only: true,
    limit: MAX_RANKED_PRODUCTS,
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
      .slice(0, MAX_RANKED_PRODUCTS);
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
