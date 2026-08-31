import "server-only";

import { cleanProductDescription } from "@/lib/productDescription";
import type { Product } from "@/lib/productCatalog";
import { parseBudgetFilter } from "../commerce/preferences";
import { getAssignedCategory } from "./filters";
import type { RagCandidate, RagPreferences } from "./types";

type ProductRow = {
  assigned_category?: unknown;
  currency?: unknown;
  description?: unknown;
  image_url?: unknown;
  in_stock?: unknown;
  kapruka_category?: unknown;
  name?: unknown;
  price_amount?: unknown;
  product_id?: unknown;
  product_url?: unknown;
  similarity?: unknown;
  stock_level?: unknown;
  summary?: unknown;
};

const REQUEST_TIMEOUT_MS = 10_000;
const MIN_CANDIDATES = 20;
const MAX_CANDIDATES = 60;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new Error("RAG requires Supabase server credentials.");
  }

  return { secretKey, url };
}

function getHeaders(secretKey: string) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
}

function getCategoryName(row: ProductRow) {
  const category = row.kapruka_category;
  if (
    typeof category === "object" &&
    category !== null &&
    "name" in category &&
    typeof category.name === "string"
  ) {
    return category.name;
  }

  return typeof row.assigned_category === "string"
    ? row.assigned_category.replaceAll("_", " ")
    : "Gift";
}

function toCandidate(row: ProductRow, fallbackScore: number) {
  if (typeof row.product_id !== "string" || typeof row.name !== "string") {
    return null;
  }

  const inStock = row.in_stock === true;
  const stockLevel =
    typeof row.stock_level === "string" ? row.stock_level : null;
  const product: Product = {
    id: row.product_id,
    name: row.name,
    imageUrl:
      typeof row.image_url === "string"
        ? row.image_url
        : "/product-images/gift-box.svg",
    category: getCategoryName(row),
    price:
      typeof row.price_amount === "number" &&
      Number.isFinite(row.price_amount)
        ? row.price_amount
        : Number(row.price_amount) || 0,
    currency: typeof row.currency === "string" ? row.currency : "LKR",
    stock: inStock ? 1 : 0,
    stockLabel: inStock
      ? stockLevel
        ? `In stock (${stockLevel})`
        : "In stock"
      : "Out of stock",
    eta: "Delivery checked by the live commerce service",
    description: cleanProductDescription(
      typeof row.summary === "string"
        ? row.summary
        : typeof row.description === "string"
          ? row.description
          : "Gift product from the saved catalog.",
    ),
    url: typeof row.product_url === "string" ? row.product_url : "#",
  };
  const similarity =
    typeof row.similarity === "number" && Number.isFinite(row.similarity)
      ? row.similarity
      : fallbackScore;

  return { ...product, similarityScore: similarity } satisfies RagCandidate;
}

function normalizeLimit(limit: number) {
  return Math.max(MIN_CANDIDATES, Math.min(MAX_CANDIDATES, Math.round(limit)));
}

function getFilterValues(preferences: RagPreferences) {
  const budget = parseBudgetFilter(preferences.budget);
  return {
    category: getAssignedCategory(preferences.category),
    maxPrice: preferences.budgetMax ?? budget.max_price ?? null,
    minPrice: preferences.budgetMin ?? budget.min_price ?? null,
  };
}

export async function retrieveSemanticCandidates({
  embedding,
  limit = MIN_CANDIDATES,
  preferences,
}: {
  embedding: number[];
  limit?: number;
  preferences: RagPreferences;
}) {
  const safeLimit = normalizeLimit(limit);
  const { secretKey, url } = getSupabaseConfig();
  const filters = getFilterValues(preferences);
  const response = await fetch(
    `${url}/rest/v1/rpc/match_kapruka_gift_products`,
    {
      method: "POST",
      headers: getHeaders(secretKey),
      body: JSON.stringify({
        filter_category: filters.category,
        match_count: safeLimit,
        max_price: filters.maxPrice,
        min_price: filters.minPrice,
        query_embedding: embedding,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Supabase vector search failed with ${response.status}.`);
  }

  const rows = (await response.json()) as ProductRow[];
  return rows
    .map((row, index) => toCandidate(row, 1 - index / safeLimit))
    .filter((product): product is RagCandidate => product !== null);
}

export async function retrieveKeywordFallback({
  limit = MIN_CANDIDATES,
  preferences,
  query,
}: {
  limit?: number;
  preferences: RagPreferences;
  query: string;
}) {
  const safeLimit = normalizeLimit(limit);
  const { secretKey, url } = getSupabaseConfig();
  const filters = getFilterValues(preferences);
  const searchTerms = query
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((term) => term.length >= 3)
    .slice(0, 5);
  const effectiveTerms = searchTerms.length > 0 ? searchTerms : ["gift"];
  const keywordConditions = effectiveTerms.flatMap((term) => [
    `name.ilike.*${term}*`,
    `summary.ilike.*${term}*`,
    `description.ilike.*${term}*`,
  ]);
  const params = new URLSearchParams({
    in_stock: "eq.true",
    limit: String(safeLimit),
    or: `(${keywordConditions.join(",")})`,
    order: "updated_at.desc",
    select:
      "assigned_category,currency,description,image_url,in_stock,kapruka_category,name,price_amount,product_id,product_url,stock_level,summary",
  });

  if (filters.category) {
    params.set("assigned_category", `eq.${filters.category}`);
  }
  if (filters.minPrice !== null) {
    params.set("price_amount", `gte.${filters.minPrice}`);
  }
  if (filters.maxPrice !== null) {
    params.append("price_amount", `lte.${filters.maxPrice}`);
  }

  const response = await fetch(
    `${url}/rest/v1/kapruka_gift_products?${params.toString()}`,
    {
      headers: getHeaders(secretKey),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Supabase keyword fallback failed with ${response.status}.`);
  }

  const rows = (await response.json()) as ProductRow[];
  return rows
    .map((row, index) => toCandidate(row, 1 - index / safeLimit))
    .filter((product): product is RagCandidate => product !== null);
}

export { MAX_CANDIDATES, MIN_CANDIDATES };
