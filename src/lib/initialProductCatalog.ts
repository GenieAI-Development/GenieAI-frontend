import initialProductsFile from "@/data/initial-products.json";
import { cleanProductDescription } from "@/lib/productDescription";
import type { Product } from "@/lib/productCatalog";

type InitialCatalogRow = {
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

type InitialCatalogFile = {
  products?: unknown;
};

function getCategoryName(row: InitialCatalogRow) {
  if (row.assigned_category === "cakes_and_desserts") return "Cakes & Desserts";
  if (row.assigned_category === "flower_bouquets") return "Flower Bouquets";
  if (row.assigned_category === "chocolates_and_candy") return "Chocolates & Candy";

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

function toProduct(row: InitialCatalogRow): Product | null {
  if (typeof row.product_id !== "string" || typeof row.name !== "string") {
    return null;
  }

  const inStock = row.in_stock === true;
  const stockLevel = typeof row.stock_level === "string" ? row.stock_level : null;
  const description =
    typeof row.summary === "string"
      ? row.summary
      : typeof row.description === "string"
        ? row.description
        : "Gift product from the local initial catalog.";

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
    eta: "Delivery available from the local initial catalog",
    description: cleanProductDescription(description),
    url: typeof row.product_url === "string" ? row.product_url : "#",
  };
}

const catalogFile = initialProductsFile as InitialCatalogFile;
const initialRows: InitialCatalogRow[] = Array.isArray(catalogFile.products)
  ? (catalogFile.products as InitialCatalogRow[])
  : [];

const initialProducts = initialRows
  .map((row) => toProduct(row))
  .filter((product): product is Product => product !== null && product.stock > 0);

export function getRandomInitialProducts(limit: number) {
  const safeLimit = Math.max(0, Math.min(initialProducts.length, Math.round(limit)));
  const products = [...initialProducts];

  for (let index = products.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [products[index], products[swapIndex]] = [
      products[swapIndex],
      products[index],
    ];
  }

  return products.slice(0, safeLimit);
}
