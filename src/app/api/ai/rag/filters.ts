import type { RagPreferences } from "./types";

const CATEGORY_ALIASES: Array<[RegExp, string]> = [
  [/cake|dessert|bakery/iu, "cakes_and_desserts"],
  [/flower|bouquet|rose/iu, "flower_bouquets"],
  [/chocolate|candy/iu, "chocolates_and_candy"],
  [/perfume|fragrance/iu, "perfume_and_fragrance"],
  [/jewel/iu, "jewelry"],
  [/fashion|accessor/iu, "fashion_and_accessories"],
  [/basket|hamper/iu, "gift_baskets_and_hampers"],
  [/skincare|beauty/iu, "skincare_and_beauty_sets"],
  [/personalized|custom/iu, "personalized_gifts"],
  [/decor|candle|home/iu, "home_decor_and_candles"],
];

export function getAssignedCategory(category?: string) {
  const normalized = category?.trim();
  if (!normalized) {
    return null;
  }

  return (
    CATEGORY_ALIASES.find(([pattern]) => pattern.test(normalized))?.[1] ?? null
  );
}

export function buildSemanticQuery(
  query: string,
  preferences: RagPreferences,
) {
  const parts = [
    query.trim(),
    preferences.category,
    preferences.occasion,
    preferences.recipient ? `for ${preferences.recipient}` : null,
  ].filter((value): value is string => Boolean(value?.trim()));

  return [...new Set(parts)].join(" ").slice(0, 500) || "gift product";
}
