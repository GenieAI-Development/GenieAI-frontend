import { asRecord, getString } from "@/lib/aiPayload";
import {
  type CatalogSearchProduct,
  type Product,
  toProduct,
} from "@/lib/productCatalog";
import {
  COMMON_GIFT_SEARCH_QUERY,
  PREFERENCE_BUDGETS,
  PREFERENCE_OCCASIONS,
  PREFERENCE_RECIPIENTS,
} from "./constants";
import type {
  BudgetFilter,
  DetectedLanguage,
  ExtendedPreferenceUpdates,
  ExtendedPreferences,
  MessageAnalysis,
  MessageIntent,
  PreferenceSnapshot,
  ShoppingProfile,
} from "./types";

const giftTypeSearchTerms: Record<string, string> = {
  cake: "cake",
  cakes: "cake",
  chocolate: "chocolate",
  chocolates: "chocolate",
  electronics: "headphones",
  fashion: "watch",
  flowers: "roses bouquet",
  food: "chocolate",
  "gift box": "chocolate",
  perfumes: "perfume",
};

const categorySearchTerms: Record<string, string[]> = {
  cakes: ["cake", "cakes", "cupcake"],
  chocolate: ["chocolate", "chocolates", "truffles"],
  electronics: ["electronics", "headphones", "earbuds"],
  fashion: ["fashion", "watch", "wallet", "handbag"],
  flowers: ["roses", "rose bouquet", "bouquet"],
  perfumes: ["perfume", "fragrance", "cologne"],
};

const categoryRelevanceTerms: Record<string, string[]> = {
  cakes: ["cake", "cakes", "cupcake", "cupcakes", "bakery", "gateau"],
  chocolate: ["chocolate", "chocolates", "cocoa", "truffle", "truffles"],
  electronics: [
    "electronic",
    "electronics",
    "headphone",
    "headphones",
    "earphone",
    "earphones",
    "earbud",
    "earbuds",
    "speaker",
    "speakers",
    "charger",
    "power bank",
    "smartwatch",
  ],
  fashion: [
    "fashion",
    "watch",
    "watches",
    "wallet",
    "wallets",
    "handbag",
    "handbags",
    "shirt",
    "dress",
    "clothing",
    "jewelry",
    "jewellery",
    "accessory",
    "accessories",
  ],
  flowers: ["rose", "roses", "bouquet", "floral"],
  perfumes: [
    "perfume",
    "perfumes",
    "fragrance",
    "fragrances",
    "cologne",
    "scent",
  ],
};

export function parseBudgetFilter(
  ...values: Array<string | undefined>
): BudgetFilter {
  const normalized = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/,/g, "");

  const numbers = [...normalized.matchAll(/\d+(?:\.\d+)?\s*(k)?/g)]
    .map((match) => {
      const amount = Number(match[0].replace(/[^\d.]/g, ""));
      return Number.isFinite(amount) ? amount * (match[1] ? 1000 : 1) : null;
    })
    .filter((amount): amount is number => amount !== null && amount > 0);

  if (
    numbers.length >= 2 &&
    (/\b(between|from|range)\b/.test(normalized) ||
      /\d\s*-\s*\d/.test(normalized))
  ) {
    return {
      max_price: Math.max(numbers[0], numbers[1]),
      min_price: Math.min(numbers[0], numbers[1]),
    };
  }

  if (/\b(between|from|range)\b/.test(normalized) && numbers.length >= 2) {
    return {
      max_price: Math.max(numbers[0], numbers[1]),
      min_price: Math.min(numbers[0], numbers[1]),
    };
  }

  const upperBudgetAmount = normalized.match(
    /\b(?:under|below|less\s+than|up\s+to|within|max(?:imum)?)\s*(?:rs\.?|lkr)?\s*(\d+(?:\.\d+)?)\s*(k)?/i,
  );
  if (upperBudgetAmount) {
    return {
      max_price:
        Number(upperBudgetAmount[1]) * (upperBudgetAmount[2] ? 1000 : 1),
    };
  }

  const lowerBudgetAmount = normalized.match(
    /\b(?:above|over|higher\s+than|greater\s+than|more\s+than|min(?:imum)?)\s*(?:rs\.?|lkr)?\s*(\d+(?:\.\d+)?)\s*(k)?/i,
  );
  if (lowerBudgetAmount) {
    return {
      min_price:
        Number(lowerBudgetAmount[1]) * (lowerBudgetAmount[2] ? 1000 : 1),
    };
  }

  const explicitBudgetAmount = normalized.match(
    /\bbudget(?:\s+(?:is|of|around|about|approximately|max(?:imum)?))?\s*:?\s*(?:rs\.?|lkr)?\s*(\d+(?:\.\d+)?)\s*(k)?/i,
  );
  const currencyAmount = normalized.match(
    /(?:\b(?:rs\.?|lkr|rupees?)|අයවැය|රුපියල්|රු\.?)\s*:?\s*(\d+(?:\.\d+)?)\s*(k)?/iu,
  );
  const forAmount = normalized.match(
    /\bfor\s+(?:rs\.?|lkr)?\s*(\d+(?:\.\d+)?)\s*(k)?\s*(?:rs\.?|lkr|rupees?)?/i,
  );
  const customAmount = explicitBudgetAmount ?? currencyAmount ?? forAmount;

  if (customAmount) {
    const amount = Number(customAmount[1]);
    const forAmountEnd =
      forAmount && typeof forAmount.index === "number"
        ? forAmount.index + forAmount[0].length
        : 0;
    const forAmountRemainder = forAmount
      ? normalized.slice(forAmountEnd).trim()
      : "";
    const isPlausibleForAmount =
      customAmount !== forAmount ||
      /\b(?:rs\.?|lkr|rupees?)\b|\d\s*k\b/i.test(forAmount?.[0] ?? "") ||
      /^[.!?]*$/.test(forAmountRemainder);
    if (Number.isFinite(amount) && amount > 0 && isPlausibleForAmount) {
      return { max_price: amount * (customAmount[2] ? 1000 : 1) };
    }
  }

  if (
    numbers.length >= 2 &&
    (/\b(budget|price|cost|rs\.?|lkr|rupees?)\b/.test(normalized) ||
      /\d\s*-\s*\d/.test(normalized))
  ) {
    return {
      max_price: Math.max(numbers[0], numbers[1]),
      min_price: Math.min(numbers[0], numbers[1]),
    };
  }

  if (
    numbers.length === 1 &&
    numbers[0] >= 100 &&
    /^\s*(?:rs\.?|lkr)?\s*\d+(?:\.\d+)?\s*k?\s*(?:rs\.?|lkr|rupees?)?\s*$/.test(
      normalized,
    )
  ) {
    return { max_price: numbers[0] };
  }

  return {};
}

export function hasBudgetFilter(filter: BudgetFilter) {
  return (
    typeof filter.min_price === "number" || typeof filter.max_price === "number"
  );
}

export function formatLkrAmount(value: number) {
  return `LKR ${Math.round(value).toLocaleString("en-US")}`;
}

export function formatBudgetFilter(filter: BudgetFilter) {
  if (
    typeof filter.min_price === "number" &&
    typeof filter.max_price === "number"
  ) {
    return `${formatLkrAmount(filter.min_price)}-${formatLkrAmount(filter.max_price)}`;
  }

  if (typeof filter.max_price === "number") {
    return `under ${formatLkrAmount(filter.max_price)}`;
  }

  if (typeof filter.min_price === "number") {
    return `above ${formatLkrAmount(filter.min_price)}`;
  }

  return "";
}

export function isProductInsideBudget(product: Product, filter: BudgetFilter) {
  if (product.currency.toUpperCase() !== "LKR") {
    return false;
  }

  if (
    typeof filter.min_price === "number" &&
    product.price < filter.min_price
  ) {
    return false;
  }

  if (
    typeof filter.max_price === "number" &&
    product.price > filter.max_price
  ) {
    return false;
  }

  return true;
}

export function cleanExtendedPreference(value: string | null) {
  return (
    value
      ?.replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || ""
  );
}

export function parseExtendedPreferences(
  value: unknown,
  profile: ShoppingProfile,
): ExtendedPreferences {
  const record = asRecord(value);
  return {
    budget:
      cleanExtendedPreference(getString(record, "budget")) ||
      profile.budget ||
      "",
    giftType:
      cleanExtendedPreference(getString(record, "giftType")) ||
      profile.category ||
      "",
    occasion:
      cleanExtendedPreference(getString(record, "occasion")) ||
      profile.occasion ||
      "",
    recipient:
      cleanExtendedPreference(getString(record, "recipient")) ||
      profile.recipient ||
      "",
  };
}

export function mergeExtendedPreferences(
  current: ExtendedPreferences,
  updates: ExtendedPreferenceUpdates,
  profileFallback?: PreferenceSnapshot,
): ExtendedPreferences {
  const fallbackGiftType =
    cleanExtendedPreference(updates.giftType) ||
    profileFallback?.requestedGiftType ||
    profileFallback?.category ||
    "";
  const fallbackBudget =
    cleanExtendedPreference(updates.budget) || profileFallback?.budget || "";
  const fallbackOccasion =
    cleanExtendedPreference(updates.occasion) ||
    profileFallback?.occasion ||
    "";
  const fallbackRecipient =
    cleanExtendedPreference(updates.recipient) ||
    profileFallback?.recipient ||
    "";

  return {
    budget: fallbackBudget || current.budget,
    giftType: fallbackGiftType || current.giftType,
    occasion: fallbackOccasion || current.occasion,
    recipient: fallbackRecipient || current.recipient,
  };
}

export function getExtendedSearchProfile(
  profile: ShoppingProfile,
  preferences: ExtendedPreferences,
): ShoppingProfile {
  return {
    ...profile,
    budget: preferences.budget || undefined,
    category: preferences.giftType || undefined,
    occasion: preferences.occasion || undefined,
    recipient: preferences.recipient || undefined,
  };
}

export function getPreferenceSearchTerms(
  query: string,
  profile: ShoppingProfile,
) {
  const category = profile.category?.trim().toLowerCase() ?? "";
  const expandedTerms = categorySearchTerms[category];

  if (expandedTerms) {
    return [...new Set([query, ...expandedTerms].filter(Boolean))];
  }

  return [query];
}

export function getPreferenceRelevanceTerms(
  query: string,
  profile: ShoppingProfile,
) {
  const category = profile.category?.trim().toLowerCase() ?? "";

  if (!category) {
    return [];
  }

  const knownCategoryTerms = categoryRelevanceTerms[category];
  if (knownCategoryTerms) {
    return knownCategoryTerms;
  }

  if (category !== "other") {
    return category
      .split(/[^a-z0-9]+/)
      .map((term) => (term.endsWith("s") ? term.slice(0, -1) : term))
      .filter((term) => term.length >= 3);
  }

  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (term) =>
        term.length >= 3 &&
        !/^(gift|gifts|present|presents|personalized|custom|birthday|anniversary|wedding|male|female|child|couple)$/.test(
          term,
        ),
    );
}

export function isProductRelevantToPreferences(
  product: CatalogSearchProduct,
  query: string,
  profile: ShoppingProfile,
) {
  const relevanceTerms = getPreferenceRelevanceTerms(query, profile);

  if (relevanceTerms.length === 0) {
    return true;
  }

  const normalized = toProduct(product);
  if (!normalized) {
    return false;
  }

  const productText = [
    normalized.name,
    normalized.category,
    normalized.description,
  ]
    .join(" ")
    .toLowerCase();

  const isKnownCategory = Boolean(
    categoryRelevanceTerms[profile.category?.trim().toLowerCase() ?? ""],
  );
  return isKnownCategory
    ? relevanceTerms.some((term) => productText.includes(term))
    : relevanceTerms.every((term) => productText.includes(term));
}

export function getSearchQuery(
  query: string,
  profile: ShoppingProfile,
  mode: string,
) {
  const haystack = [query, profile.category, profile.occasion, mode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const [key, term] of Object.entries(giftTypeSearchTerms)) {
    if (haystack.includes(key)) {
      return term;
    }
  }

  const cleaned = query
    .replace(
      /\b(find|can|you|me|a|an|gift|for|please|genieai|budget|recipient|occasion)\b/gi,
      " ",
    )
    .replace(
      /\b(between|from|to|and|under|below|less|than|above|over|higher|greater|more|rupees?|rs\.?|lkr)\b/gi,
      " ",
    )
    .replace(/\d+(?:\.\d+)?\s*k?/gi, " ")
    .replace(
      /\b(male|female|child|couple|birthday|anniversary|wedding)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 120);
  }

  return profile.category || COMMON_GIFT_SEARCH_QUERY;
}

export function inferBudgetPreference(message: string) {
  const filter = parseBudgetFilter(message);

  if (!hasBudgetFilter(filter)) {
    return null;
  }

  if (filter.max_price === 5000 && filter.min_price === undefined) {
    return PREFERENCE_BUDGETS[0];
  }

  if (filter.min_price === 5000 && filter.max_price === 10000) {
    return PREFERENCE_BUDGETS[1];
  }

  if (filter.min_price === 10000 && filter.max_price === undefined) {
    return PREFERENCE_BUDGETS[2];
  }

  return PREFERENCE_BUDGETS[3];
}

export function normalizeAnalyzedSearchQuery(
  searchQuery: string | null,
  profile: ShoppingProfile,
) {
  const value = searchQuery || profile.category || "";
  const normalized = value.trim().toLowerCase();

  if (!normalized || /^(gift|gifts|other|present|presents)$/.test(normalized)) {
    const profileCategory = profile.category?.trim() ?? "";
    const normalizedProfileCategory = profileCategory.toLowerCase();

    if (
      profileCategory &&
      !/^(gift|gifts|other|present|presents)$/.test(normalizedProfileCategory)
    ) {
      return giftTypeSearchTerms[normalizedProfileCategory] ?? profileCategory;
    }

    return COMMON_GIFT_SEARCH_QUERY;
  }

  return giftTypeSearchTerms[normalized] ?? value;
}

export function inferMessageIntent(query: string): MessageIntent {
  const normalized = query.trim().toLowerCase();

  if (
    normalized.includes("?") ||
    /^(can|could|do|does|how|is|may|should|what|when|where|which|who|why)\b/.test(
      normalized,
    ) ||
    /\b(mokak|mokada|kohomada|koheda|keeyada|puluwanda)\b/.test(normalized)
  ) {
    return "question";
  }

  return normalized ? "command" : "conversation";
}

export function inferOccasionPreference(message: string) {
  const normalized = message.toLowerCase();

  if (/\b(birthday|bday)\b/.test(normalized)) return PREFERENCE_OCCASIONS[0];
  if (/\banniversary\b/.test(normalized)) return PREFERENCE_OCCASIONS[1];
  if (/\b(wedding|marriage)\b/.test(normalized)) return PREFERENCE_OCCASIONS[2];
  if (/\b(graduation|graduate)\b/.test(normalized))
    return PREFERENCE_OCCASIONS[3];
  if (
    /\b(christmas|new year|valentine(?:'s)? day|mother(?:'s)? day|father(?:'s)? day|housewarming|baby shower|engagement|retirement|farewell|promotion|religious festival)\b/.test(
      normalized,
    )
  ) {
    return PREFERENCE_OCCASIONS[4];
  }

  return null;
}

export function inferRecipientPreference(message: string) {
  const normalized = message.toLowerCase();

  if (/\b(couple|parents|mom and dad|husband and wife)\b/.test(normalized)) {
    return PREFERENCE_RECIPIENTS[3];
  }
  if (
    /\b(child|children|kid|kids|baby|son|daughter|nephew|niece)\b/.test(
      normalized,
    )
  ) {
    return PREFERENCE_RECIPIENTS[2];
  }
  if (
    /\b(girlfriend|wife|mother|mom|mum|sister|aunt|aunty|female|lady|girl|her)\b/.test(
      normalized,
    )
  ) {
    return PREFERENCE_RECIPIENTS[1];
  }
  if (
    /\b(boyfriend|husband|father|dad|brother|uncle|male|gentleman|boy|him)\b/.test(
      normalized,
    )
  ) {
    return PREFERENCE_RECIPIENTS[0];
  }
  if (
    /\b(friend|teacher|boss|manager|colleague|coworker|employee|client|customer|neighbor|neighbour|grandparent|grandmother|grandfather|coach|mentor)\b/.test(
      normalized,
    )
  ) {
    return PREFERENCE_RECIPIENTS[4];
  }

  return null;
}

export function normalizeDetectedLanguage(
  value: string | null,
  fallback: DetectedLanguage,
): DetectedLanguage {
  return value === "English" || value === "Sinhala" || value === "Singlish"
    ? value
    : fallback;
}

export function getNormalizedPreference<T extends readonly string[]>(
  value: string | null,
  options: T,
) {
  if (!value) {
    return null;
  }

  return (
    options.find(
      (option) => option.toLowerCase() === value.trim().toLowerCase(),
    ) ?? null
  );
}

export function getFreshProfile(
  profile: ShoppingProfile,
  preferences: PreferenceSnapshot,
): ShoppingProfile {
  return {
    ...profile,
    ...(preferences.budget ? { budget: preferences.budget } : {}),
    ...(preferences.category ? { category: preferences.category } : {}),
    ...(preferences.occasion ? { occasion: preferences.occasion } : {}),
    ...(preferences.recipient ? { recipient: preferences.recipient } : {}),
  };
}

export function getClientPreferences(profile: ShoppingProfile) {
  return {
    budget: profile.budget ?? "",
    category: profile.category ?? "",
    occasion: profile.occasion ?? "",
    recipient: profile.recipient ?? "",
  };
}

export function inferPresetCategoryFromGiftType(
  giftType: string | null | undefined,
) {
  const normalized = giftType?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "";
  }

  if (/(flower|flowers|rose|roses|bouquet|floral)/.test(normalized)) {
    return "Flowers";
  }

  if (/(cake|cakes|gateau|cupcake)/.test(normalized)) {
    return "Cakes";
  }

  if (/(chocolate|chocolates|cocoa|truffle)/.test(normalized)) {
    return "Chocolate";
  }

  if (/(perfume|perfumes|fragrance|cologne|scent)/.test(normalized)) {
    return "Perfumes";
  }

  if (
    /(watch|fashion|wallet|bag|jewellery|jewelry|dress|clothing)/.test(
      normalized,
    )
  ) {
    return "Fashion";
  }

  if (
    /(electronic|electronics|headphone|headphones|earbud|earbuds|speaker|gadget)/.test(
      normalized,
    )
  ) {
    return "Other";
  }

  return "";
}

export function getReplyPreferenceProfile(
  profile: ShoppingProfile,
  extendedPreferences: ExtendedPreferences,
  messageAnalysis: MessageAnalysis,
): ShoppingProfile {
  const requestedGiftType =
    cleanExtendedPreference(messageAnalysis.preferences.requestedGiftType) ||
    extendedPreferences.giftType ||
    profile.category ||
    "";
  const inferredCategory =
    inferPresetCategoryFromGiftType(requestedGiftType) ||
    inferPresetCategoryFromGiftType(extendedPreferences.giftType) ||
    profile.category ||
    "";

  return {
    ...profile,
    budget: extendedPreferences.budget || profile.budget,
    category: inferredCategory || profile.category,
    occasion: extendedPreferences.occasion || profile.occasion,
    recipient: extendedPreferences.recipient || profile.recipient,
  };
}
