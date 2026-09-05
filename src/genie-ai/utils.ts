import { MAX_RANKED_PRODUCTS, PRODUCT_BATCH_SIZE } from "./config";
import type {
  CommerceResponse,
  ExtendedPreferences,
  ModePreferencePayload,
  ModeSession,
  ShoppingProfile,
} from "./types";

export function getLocalDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function removeEmojiForSpeech(value: string) {
  return value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0E\uFE0F]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getNonPastDate(value: string) {
  const today = getLocalDateString();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today ? value : today;
}

export function formatBudgetAmount(value: number) {
  return new Intl.NumberFormat("en-LK", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseBudgetAmount(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }

  const amount = Number(digits);
  return Number.isFinite(amount) && amount >= 0 ? String(amount) : "";
}

export function parseBudgetRangeValue(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return { max: "", min: "" };
  }

  if (/^under\s+rs\./i.test(normalized)) {
    return { max: parseBudgetAmount(normalized), min: "" };
  }

  if (/^(above|over)\s+rs\./i.test(normalized)) {
    return { max: "", min: parseBudgetAmount(normalized) };
  }

  const betweenMatch = normalized.match(/rs\.\s*([\d,]+)\s*-\s*([\d,]+)/i);
  if (betweenMatch) {
    return {
      max: parseBudgetAmount(betweenMatch[2]),
      min: parseBudgetAmount(betweenMatch[1]),
    };
  }

  return { max: "", min: parseBudgetAmount(normalized) };
}

export function buildBudgetRangeValue(min: string, max: string) {
  const normalizedMin = parseBudgetAmount(min);
  const normalizedMax = parseBudgetAmount(max);

  if (normalizedMin && normalizedMax) {
    const minAmount = Number(normalizedMin);
    const maxAmount = Number(normalizedMax);

    if (minAmount > maxAmount) {
      return `Rs. ${formatBudgetAmount(maxAmount)} - ${formatBudgetAmount(minAmount)}`;
    }

    return `Rs. ${formatBudgetAmount(minAmount)} - ${formatBudgetAmount(maxAmount)}`;
  }

  if (normalizedMin) {
    return `Above Rs. ${formatBudgetAmount(Number(normalizedMin))}`;
  }

  if (normalizedMax) {
    return `Under Rs. ${formatBudgetAmount(Number(normalizedMax))}`;
  }

  return "";
}

export function divideBudgetAcrossItems(budget: string, itemCount: number) {
  const divisor = Math.max(1, Math.floor(itemCount));
  const normalized = budget.trim();

  if (!normalized || normalized.toLowerCase() === "other" || divisor === 1) {
    return budget;
  }

  const { min, max } = parseBudgetRangeValue(normalized);
  const dividedMin = min
    ? String(Math.max(1, Math.floor(Number(min) / divisor)))
    : "";
  const dividedMax = max
    ? String(Math.max(1, Math.floor(Number(max) / divisor)))
    : "";

  if (/^under\b/i.test(normalized)) {
    return dividedMax
      ? `Under Rs. ${formatBudgetAmount(Number(dividedMax))}`
      : budget;
  }

  if (/^(above|over)\b/i.test(normalized)) {
    return dividedMin
      ? `Above Rs. ${formatBudgetAmount(Number(dividedMin))}`
      : budget;
  }

  if (dividedMin && dividedMax) {
    return buildBudgetRangeValue(dividedMin, dividedMax);
  }

  const singleAmount = dividedMax || dividedMin;
  return singleAmount
    ? `Under Rs. ${formatBudgetAmount(Number(singleAmount))}`
    : budget;
}

export const initialShoppingProfile: ShoppingProfile = {
  budget: "",
  category: "",
  city: "Colombo",
  date: getLocalDateString(),
  interests: "premium gifts, useful items",
  occasion: "",
  recipient: "",
};

export function getExtendedPreferencesFromProfile(
  profile: ShoppingProfile,
): ExtendedPreferences {
  return {
    budget: profile.budget,
    giftType: profile.category,
    lastRepliedCount: 0,
    occasion: profile.occasion,
    recipient: profile.recipient,
    replyCount: 0,
  };
}

export function normalizeExtendedPreferences(
  value: Partial<ExtendedPreferences> | undefined,
  profile: ShoppingProfile,
): ExtendedPreferences {
  const fallback = getExtendedPreferencesFromProfile(profile);

  return {
    budget: value?.budget ?? fallback.budget,
    giftType: value?.giftType ?? fallback.giftType,
    lastRepliedCount: value?.lastRepliedCount ?? 0,
    occasion: value?.occasion ?? fallback.occasion,
    recipient: value?.recipient ?? fallback.recipient,
    replyCount: value?.replyCount ?? 0,
  };
}

export function mergeExtendedPreferencesWithProfile(
  current: ExtendedPreferences,
  profileUpdates: Partial<
    Pick<ShoppingProfile, "budget" | "category" | "occasion" | "recipient">
  >,
  extendedUpdates?: Partial<ExtendedPreferences>,
): ExtendedPreferences {
  const nextPreferences = {
    budget:
      extendedUpdates?.budget ?? profileUpdates.budget ?? current.budget ?? "",
    giftType:
      extendedUpdates?.giftType ??
      profileUpdates.category ??
      current.giftType ??
      "",
    occasion:
      extendedUpdates?.occasion ??
      profileUpdates.occasion ??
      current.occasion ??
      "",
    recipient:
      extendedUpdates?.recipient ??
      profileUpdates.recipient ??
      current.recipient ??
      "",
  };
  const didPreferenceChange =
    nextPreferences.budget !== current.budget ||
    nextPreferences.giftType !== current.giftType ||
    nextPreferences.occasion !== current.occasion ||
    nextPreferences.recipient !== current.recipient;

  return {
    ...nextPreferences,
    lastRepliedCount: current.lastRepliedCount,
    replyCount: didPreferenceChange
      ? current.replyCount + 1
      : current.replyCount,
  };
}

export function havePreferenceValuesChanged(
  current: ExtendedPreferences,
  updates: Partial<
    Pick<ExtendedPreferences, "budget" | "giftType" | "occasion" | "recipient">
  >,
) {
  return (
    (updates.budget !== undefined && updates.budget !== current.budget) ||
    (updates.giftType !== undefined && updates.giftType !== current.giftType) ||
    (updates.occasion !== undefined && updates.occasion !== current.occasion) ||
    (updates.recipient !== undefined && updates.recipient !== current.recipient)
  );
}

export function applyExtendedPreferenceUpdates(
  current: ExtendedPreferences,
  updates: Partial<
    Pick<ExtendedPreferences, "budget" | "giftType" | "occasion" | "recipient">
  >,
) {
  const didPreferenceChange = havePreferenceValuesChanged(current, updates);

  return {
    ...current,
    ...updates,
    replyCount: didPreferenceChange
      ? current.replyCount + 1
      : current.replyCount,
  };
}

export function syncExtendedPreferencesWithProfile(
  current: ExtendedPreferences,
  profile: ShoppingProfile,
) {
  return applyExtendedPreferenceUpdates(current, {
    budget: profile.budget,
    giftType: profile.category,
    occasion: profile.occasion,
    recipient: profile.recipient,
  });
}

export function normalizeShoppingProfile(
  nextProfile: ShoppingProfile,
): ShoppingProfile {
  return {
    ...initialShoppingProfile,
    ...nextProfile,
    date: getNonPastDate(nextProfile.date),
  };
}

export function normalizeModeSession(session: ModeSession): ModeSession {
  const normalizedProfile = normalizeShoppingProfile(session.profile);
  const guidedPlanItems = (session.guidedPlanItems ?? []).slice(0, 12);
  const recommendedProducts = (session.recommendedProducts ?? []).slice(
    0,
    MAX_RANKED_PRODUCTS,
  );
  const maxProductBatchIndex = Math.max(
    0,
    Math.ceil(recommendedProducts.length / PRODUCT_BATCH_SIZE) - 1,
  );
  return {
    ...session,
    extendedPreferences: normalizeExtendedPreferences(
      session.extendedPreferences,
      normalizedProfile,
    ),
    fitReasons: session.fitReasons ?? {},
    guidedPlanIndex: Math.max(
      0,
      Math.min(
        Math.max(0, guidedPlanItems.length - 1),
        session.guidedPlanIndex ?? 0,
      ),
    ),
    guidedPlanItems,
    profile: normalizedProfile,
    productBatchIndex: Math.max(
      0,
      Math.min(maxProductBatchIndex, session.productBatchIndex ?? 0),
    ),
    recommendedProducts,
  };
}

export function normalizeModeSessions(sessions: Record<string, ModeSession>) {
  return Object.fromEntries(
    Object.entries(sessions).map(([mode, session]) => [
      mode,
      normalizeModeSession(session),
    ]),
  );
}

export function getPreferenceStateForMode(mode: string) {
  if (mode.includes("Event")) {
    return "eventUserPreference" as const;
  }

  if (mode.includes("Gift Box")) {
    return "giftUserPreference" as const;
  }

  return "extendedPreferences" as const;
}

export function getPreferencePayloadForMode(
  mode: string,
  preferenceState: ExtendedPreferences,
): ModePreferencePayload {
  const key = getPreferenceStateForMode(mode);
  return { [key]: preferenceState };
}

export function getResponsePreferenceForMode(
  mode: string,
  data: CommerceResponse,
) {
  if (mode.includes("Event")) {
    return data.eventUserPreference ?? data.extendedPreferences;
  }

  if (mode.includes("Gift Box")) {
    return data.giftUserPreference ?? data.extendedPreferences;
  }

  return data.extendedPreferences;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

export function getValidatedPhoneNumber(value: string) {
  const trimmedValue = value.trim();
  const normalizedDigits = trimmedValue.replace(/\D/g, "");

  if (normalizedDigits.length < 7) {
    return {
      error: "Recipient phone number must have at least 7 digits.",
      normalizedValue: trimmedValue,
    };
  }

  return {
    error: "",
    normalizedValue: trimmedValue,
  };
}

export function getTaskForMode(mode: string) {
  if (mode.includes("Event")) return "eventPlan";
  if (mode.includes("Gift Box")) return "giftBox";
  if (mode.includes("Compare")) return "compare";
  return "recommend";
}
