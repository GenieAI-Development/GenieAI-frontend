import type { Product } from "@/lib/productCatalog";
import { cleanProductDescription } from "@/lib/productDescription";

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_EMBEDDING_MODEL = "openai/clip-vit-base-patch32";

type ImageMatchRow = {
  assigned_category?: unknown;
  currency?: unknown;
  description?: unknown;
  image_url?: unknown;
  in_stock?: unknown;
  kapruka_category?: unknown;
  matched_image_url?: unknown;
  name?: unknown;
  price_amount?: unknown;
  product_id?: unknown;
  product_url?: unknown;
  similarity?: unknown;
  stock_level?: unknown;
  summary?: unknown;
};

export type ImageMatchedProduct = Product & {
  matchedImageUrl?: string;
  similarity: number;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new Error(
      "Image search requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return { secretKey, url };
}

function categoryName(row: ImageMatchRow) {
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

function toImageMatchedProduct(row: ImageMatchRow): ImageMatchedProduct | null {
  if (
    typeof row.product_id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.similarity !== "number" ||
    !Number.isFinite(row.similarity)
  ) {
    return null;
  }

  const inStock = row.in_stock === true;
  const stockLevel =
    typeof row.stock_level === "string" ? row.stock_level : null;

  return {
    id: row.product_id,
    name: row.name,
    imageUrl:
      typeof row.image_url === "string"
        ? row.image_url
        : "/product-images/gift-box.svg",
    category: categoryName(row),
    price:
      typeof row.price_amount === "number" && Number.isFinite(row.price_amount)
        ? row.price_amount
        : 0,
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
    similarity: row.similarity,
    matchedImageUrl:
      typeof row.matched_image_url === "string"
        ? row.matched_image_url
        : undefined,
  };
}

export async function matchKaprukaProductImages(
  embedding: number[],
  matchCount = 20,
) {
  const { secretKey, url } = getSupabaseConfig();
  const response = await fetch(
    `${url}/rest/v1/rpc/match_kapruka_gift_product_images`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: Math.max(1, Math.min(Math.round(matchCount), 60)),
        filter_category: null,
        min_price: null,
        max_price: null,
        filter_embedding_model:
          process.env.PRODUCT_IMAGE_EMBEDDING_MODEL?.trim() ||
          DEFAULT_EMBEDDING_MODEL,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase image search failed with ${response.status}${detail ? `: ${detail}` : "."}`,
    );
  }

  const rows = (await response.json()) as ImageMatchRow[];
  const matches = rows
    .map(toImageMatchedProduct)
    .filter((product): product is ImageMatchedProduct => product !== null);
  const uniqueProducts = new Map<string, ImageMatchedProduct>();

  for (const product of matches) {
    const existing = uniqueProducts.get(product.id);
    if (!existing || product.similarity > existing.similarity) {
      uniqueProducts.set(product.id, product);
    }
  }

  return Array.from(uniqueProducts.values());
}
