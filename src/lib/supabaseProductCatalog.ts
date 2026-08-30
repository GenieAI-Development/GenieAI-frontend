import type { Product } from "@/lib/productCatalog";
import { cleanProductDescription } from "@/lib/productDescription";

type SupabaseProductRow = {
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
  stock_level?: unknown;
  summary?: unknown;
};

const REQUEST_TIMEOUT_MS = 6000;
const RANDOM_SAMPLE_MULTIPLIER = 3;
const MAX_SAMPLE_ROUNDS = 3;
const INITIAL_EXCLUDED_PRODUCT_PATTERN = /\bbiscuits?\b/iu;
const INITIAL_CATEGORIES = ["cakes_and_desserts", "flower_bouquets"] as const;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new Error(
      "The initial product catalog requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return { secretKey, url };
}

function getHeaders(secretKey: string) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

async function getInStockProductCount(
  url: string,
  secretKey: string,
  category: string,
) {
  const params = new URLSearchParams({
    assigned_category: `eq.${category}`,
    in_stock: "eq.true",
    select: "product_id",
  });
  const response = await fetch(
    `${url}/rest/v1/kapruka_gift_products?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        ...getHeaders(secretKey),
        Prefer: "count=exact",
        Range: "0-0",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase product count failed with ${response.status}.`);
  }

  const contentRange = response.headers.get("content-range");
  const count = Number(contentRange?.split("/")[1]);

  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Supabase has no in-stock showcase products.");
  }

  return count;
}

async function getProductAtOffset(
  url: string,
  secretKey: string,
  category: string,
  offset: number,
) {
  const params = new URLSearchParams({
    assigned_category: `eq.${category}`,
    in_stock: "eq.true",
    limit: "1",
    offset: String(offset),
    order: "assigned_category.asc,product_id.asc",
    select:
      "assigned_category,currency,description,image_url,in_stock,kapruka_category,name,price_amount,product_id,product_url,stock_level,summary",
  });
  const response = await fetch(
    `${url}/rest/v1/kapruka_gift_products?${params.toString()}`,
    {
      cache: "no-store",
      headers: getHeaders(secretKey),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase product lookup failed with ${response.status}.`);
  }

  const rows = (await response.json()) as SupabaseProductRow[];
  return rows[0] ?? null;
}

function getCategoryName(row: SupabaseProductRow) {
  if (row.assigned_category === "cakes_and_desserts") {
    return "Cakes & Desserts";
  }

  if (row.assigned_category === "flower_bouquets") {
    return "Flower Bouquets";
  }

  if (
    typeof row.kapruka_category === "object" &&
    row.kapruka_category !== null &&
    "name" in row.kapruka_category &&
    typeof row.kapruka_category.name === "string"
  ) {
    return row.kapruka_category.name;
  }

  return typeof row.assigned_category === "string"
    ? row.assigned_category.replaceAll("_", " ")
    : "Gift";
}

function toProduct(row: SupabaseProductRow): Product | null {
  if (typeof row.product_id !== "string" || typeof row.name !== "string") {
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
    category: getCategoryName(row),
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
  };
}

async function getRandomProductsForCategory(
  url: string,
  secretKey: string,
  category: string,
  limit: number,
  includeProduct: (product: Product) => boolean = () => true,
) {
  const count = await getInStockProductCount(url, secretKey, category);
  const products = new Map<string, Product>();

  for (
    let round = 0;
    round < MAX_SAMPLE_ROUNDS && products.size < limit;
    round += 1
  ) {
    const sampleSize = Math.min(
      count,
      (limit - products.size) * RANDOM_SAMPLE_MULTIPLIER,
    );
    const offsets = Array.from(
      { length: sampleSize },
      () => Math.floor(Math.random() * count),
    );
    const rows = await Promise.all(
      offsets.map((offset) =>
        getProductAtOffset(url, secretKey, category, offset),
      ),
    );

    for (const row of rows) {
      const product = row ? toProduct(row) : null;
      if (product && includeProduct(product)) {
        products.set(product.id.toUpperCase(), product);
      }
      if (products.size >= limit) {
        break;
      }
    }
  }

  return Array.from(products.values()).slice(0, limit);
}

function shuffleProducts(products: Product[]) {
  for (let index = products.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [products[index], products[swapIndex]] = [
      products[swapIndex],
      products[index],
    ];
  }
  return products;
}

export async function getRandomInitialProducts(limit: number) {
  const safeLimit = Math.max(2, Math.min(24, Math.round(limit)));
  const { secretKey, url } = getSupabaseConfig();
  const cakeLimit = Math.ceil(safeLimit / 2);
  const flowerLimit = safeLimit - cakeLimit;
  const excludeInitialBiscuits = (product: Product) =>
    !INITIAL_EXCLUDED_PRODUCT_PATTERN.test(
      `${product.name} ${product.category} ${product.description}`,
    );
  const [cakes, flowers] = await Promise.all([
    getRandomProductsForCategory(
      url,
      secretKey,
      INITIAL_CATEGORIES[0],
      cakeLimit,
      excludeInitialBiscuits,
    ),
    getRandomProductsForCategory(
      url,
      secretKey,
      INITIAL_CATEGORIES[1],
      flowerLimit,
      excludeInitialBiscuits,
    ),
  ]);

  return shuffleProducts([...cakes, ...flowers]).slice(0, safeLimit);
}
