"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { stripModelThinking } from "@/lib/aiPayload";
import { deliveryCities, locationTypes } from "@/lib/deliveryLocations";
import {
  clearPendingEvents,
  getPendingEvents,
  initializePersonalizationSession,
  trackPersonalizationEvent,
} from "@/lib/personalization/client";
import type { PersonalizationEventType } from "@/lib/personalization/types";
import { formatPrice, Product } from "@/lib/productCatalog";
import { AppHeader } from "./v3/AppHeader";
import { CartDrawer } from "./v3/CartDrawer";
import { ChatThread } from "./v3/ChatThread";
import { CheckoutDialog } from "./v3/CheckoutDialog";
import { Composer } from "./v3/Composer";
import { GenieShell } from "./v3/GenieShell";
import { GiftCardTool, type GiftCardPreferences } from "./v3/GiftCardTool";
import { NavigationRail } from "./v3/NavigationRail";
import { PreferencesDrawer } from "./v3/PreferencesDrawer";
import { ProductDialog } from "./v3/ProductDialog";
import { ProductGrid } from "./v3/ProductGrid";
import { WelcomePanel } from "./v3/WelcomePanel";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  retryContext?: boolean;
  retryReason?: "timeout";
  retryText?: string;
  variant?: "context-panel";
};

type IconName =
  | "box"
  | "camera"
  | "cart"
  | "check"
  | "gift"
  | "heart"
  | "menu"
  | "mic"
  | "plus"
  | "search"
  | "send"
  | "settings"
  | "speaker"
  | "sparkles"
  | "trash"
  | "x";

type CommerceResponse = {
  analytics?: {
    buyBoxHealth?: string;
    conversionSignal?: string;
    nextBestAction?: string;
    risk?: string;
  };
  chips?: string[];
  comparisonInsights?: Array<{
    id: string;
    insights: ComparisonInsight[];
  }>;
  detectedLanguage?: Language;
  eventPlan?: string[];
  extendedPreferences?: ExtendedPreferences;
  eventUserPreference?: ExtendedPreferences;
  giftUserPreference?: ExtendedPreferences;
  giftMessage?: string;
  preferences?: {
    budget: string;
    category: string;
    occasion: string;
    recipient: string;
  };
  products?: Product[];
  recommendations?: Array<{
    id: string;
    fitScore: number;
    reason: string;
  }>;
  reply?: string;
  delivery?: {
    available?: boolean;
    checked_date?: string;
    city?: string;
    currency?: string;
    next_available_date?: string | null;
    perishable_warning?: string | null;
    rate?: number;
    reason?: string | null;
  } | null;
  checkout?: {
    checkout_url?: string;
    expires_at?: string;
    order_ref?: string;
    result?: string;
    summary?: {
      currency?: string;
      delivery_fee?: number;
      grand_total?: number;
      items_total?: number;
    };
  };
};

function getCheckoutResponseMessage(data: CommerceResponse) {
  return (
    data.checkout?.result ??
    data.reply ??
    "GenieAI returned checkout details without a checkout link."
  );
}

type CompareRow = {
  insights: ComparisonInsight[];
  product: Product;
};

type ComparisonInsight = {
  label: string;
  percentage: number;
};

type GuidedPlanItem = {
  label: string;
  quantity: string;
  searchTerm: string;
};

type SuggestedPrompt = {
  action: "fill" | "custom";
  text: string;
};

type GiftMessagePreferences = {
  language: Language;
  size: string;
  suggestions: string;
  tone: string;
};

type ImageResponse = {
  error?: string;
  fallback?: boolean;
  model?: string;
  productHints?: string[];
  searchQuery?: string;
  summary?: string;
  visibleText?: string[];
};

type VoiceResponse = {
  error?: string;
  language?: "en";
  retry?: boolean;
  transcript?: string;
};

type RequiredField = "budget" | "recipient" | "occasion";

type ContextField =
  | RequiredField
  | "boxRecipient"
  | "category"
  | "eventType"
  | "giftBoxTheme"
  | "itemCount"
  | "participants"
  | "venue";

type ContextDraft = Record<ContextField, string>;

type Language = "English" | "Sinhala" | "Singlish";

type ShoppingProfile = {
  budget: string;
  category: string;
  city: string;
  date: string;
  interests: string;
  occasion: string;
  recipient: string;
};

type ExtendedPreferences = {
  budget: string;
  giftType: string;
  occasion: string;
  recipient: string;
  lastRepliedCount: number;
  replyCount: number;
};

type ContextAnalysisResponse = {
  budget?: string | null;
  category?: string | null;
  detectedLanguage?: Language;
  error?: string;
  missingFields?: RequiredField[];
  occasion?: string | null;
  recipient?: string | null;
};

type StoredChatState = {
  chips: string[];
  contextDraft: ContextDraft;
  conversationStage: "first-message" | "collecting-context" | "ready";
  extendedPreferences?: ExtendedPreferences;
  fitReasons?: Record<string, string>;
  guidedPlanIndex?: number;
  guidedPlanItems?: GuidedPlanItem[];
  giftCardAnalysis?: string;
  giftCardImage?: string;
  giftCardMessage?: string;
  giftCardPalette?: string[];
  giftCardPreferences?: GiftCardPreferences;
  giftCardProductId?: string;
  input: string;
  language: Language;
  messages: ChatMessage[];
  pendingUserRequest: string;
  profile: ShoppingProfile;
  productBatchIndex?: number;
  buyBox?: Product[];
  recommendedProducts?: Product[];
  initialCatalogVersion?: string;
  activeMode?: string;
  modeSessions?: Record<string, ModeSession>;
};

type ModePreferencePayload = {
  eventUserPreference?: ExtendedPreferences;
  extendedPreferences?: ExtendedPreferences;
  giftUserPreference?: ExtendedPreferences;
};

type ModeSession = {
  chips: string[];
  contextDraft: ContextDraft;
  conversationStage: "first-message" | "collecting-context" | "ready";
  extendedPreferences?: ExtendedPreferences;
  fitReasons?: Record<string, string>;
  guidedPlanIndex?: number;
  guidedPlanItems?: GuidedPlanItem[];
  input: string;
  messages: ChatMessage[];
  pendingUserRequest: string;
  profile: ShoppingProfile;
  productBatchIndex?: number;
  recommendedProducts?: Product[];
};

type GiftCardResponse = {
  analysis?: string;
  error?: string;
  imageDataUrl?: string;
  message?: string;
  model?: string;
  palette?: string[];
};

const modes = [
  { name: "Smart Shopping", icon: "cart" },
  { name: "Event Planner", icon: "sparkles" },
  { name: "Gift Box Builder", icon: "gift" },
  { name: "Product Compare", icon: "search" },
  { name: "Gift Message", icon: "heart" },
] satisfies Array<{ icon: IconName; name: string }>;

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hello! ආයුබෝවන්! Ayubowan! I am GenieAI. 💫 Tell me what you are looking for, and I will guide the gift details. 😊",
  },
];

const starterChips = [
  "Find a gift",
  "Find a cake",
  "Find flowers",
  "Find chocolates",
  "Find perfume",
];

const PRODUCT_BATCH_SIZE = 4;
const MAX_RANKED_PRODUCTS = 12;

const starterChipGiftTypes: Record<string, string> = {
  "Find a cake": "Cakes",
  "Find chocolates": "Chocolate",
  "Find flowers": "Flowers",
  "Find perfume": "Perfumes",
};

const languageOptions: Language[] = ["English", "Sinhala", "Singlish"];

const languageLabels: Record<Language, string> = {
  English: "English",
  Sinhala: "සිංහල",
  Singlish: "Singlish",
};

const starterMessagesByLanguage: Record<Language, ChatMessage[]> = {
  English: starterMessages,
  Sinhala: [
    {
      role: "assistant",
      content:
        "Ayubowan! මම GenieAI. 💫 ඔබට අවශ්‍ය gift එක කියන්න, මම ඔයාව guide කරන්නම්. 😊",
    },
  ],
  Singlish: [
    {
      role: "assistant",
      content:
        "Ayubowan! Mama GenieAI. 💫 Oyata ona gift eka kiyanna, mama oyawa guide karannam. 😊",
    },
  ],
};

const modeIcons: Record<string, IconName> = {
  "Event Planner": "sparkles",
  "Gift Box Builder": "gift",
  "Gift Message": "heart",
  "Product Compare": "search",
  "Smart Shopping": "cart",
};

const budgetOptions = [
  "Under Rs. 2,500",
  "Rs. 2,500 - 5,000",
  "Rs. 5,000 - 10,000",
  "Above Rs. 10,000",
  "Other",
];

const recipientOptions = ["Male", "Female", "Child", "Couple", "Other"];

const occasionOptions = [
  "Birthday",
  "Anniversary",
  "Wedding",
  "Graduation",
  "Other",
];

const giftTypeOptions = [
  "Flowers",
  "Cakes",
  "Chocolate",
  "Perfumes",
  "Fashion",
  "Other",
];

const eventTypeOptions = ["Birthday", "Anniversary", "Office party", "Family gathering"];

const participantOptions = ["Under 10", "10 - 25", "25 - 50", "Above 50"];

const venueOptions = ["Home", "Office", "Hotel", "Outdoor"];

const giftBoxThemeOptions = ["Chocolate", "Flowers", "Perfume", "Wellness", "Party"];

const itemCountOptions = ["2 items", "3 items", "4 items", "5+ items"];

const shoppingContextFields: ContextField[] = [
  "budget",
  "recipient",
  "occasion",
  "category",
];

function getContextFieldsForMode(mode: string): ContextField[] {
  if (mode.includes("Event")) {
    return ["eventType", "participants", "venue", "budget"];
  }

  if (mode.includes("Gift Box")) {
    return ["boxRecipient", "giftBoxTheme", "itemCount", "budget"];
  }

  return shoppingContextFields;
}

const contextQuestions: Record<
  Language,
  Partial<Record<ContextField, string>>
> = {
  English: {
    boxRecipient: "Who is this gift box for?",
    budget: "What is your budget?",
    category: "Gift type?",
    eventType: "What type of event are you planning?",
    giftBoxTheme: "What gift box theme should I use?",
    itemCount: "How many items?",
    occasion: "What is the occasion?",
    participants: "How many participants?",
    recipient: "Who is the recipient?",
    venue: "Where will the event happen?",
  },
  Sinhala: {
    budget: "ඔබගේ budget එක කීයද?",
    occasion: "මොන අවස්ථාවකටද?",
    recipient: "තෑග්ග ලැබෙන්නේ කාටද?",
  },
  Singlish: {
    boxRecipient: "Gift box eka kaatada?",
    budget: "Budget eka keeyada?",
    category: "Gift type eka?",
    eventType: "Event type eka?",
    giftBoxTheme: "Gift box theme eka mokakda?",
    itemCount: "Box ekata items keeyak oneda?",
    occasion: "Occasion eka?",
    participants: "Keedenek enawada?",
    recipient: "Gift eka kaatada?",
    venue: "Event eka koheda thiyenne?",
  },
};

const contextQuestionOverrides: Record<
  Language,
  Partial<Record<ContextField, string>>
> = {
  English: {},
  Sinhala: {
    boxRecipient: "මෙම gift box එක කාටද?",
    category: "Gift type එක මොකක්ද?",
    eventType: "Event එක මොකක්ද?",
    giftBoxTheme: "Gift box theme එක මොකක්ද?",
    itemCount: "Box එකට items කීයක් දාන්නද?",
    participants: "Participants කී දෙනෙක් ඉන්නවද?",
    venue: "Event එක තියෙන්නේ කොහෙද?",
  },
  Singlish: {
    boxRecipient: "Gift box eka kaatada?",
    category: "Gift type eka?",
    eventType: "Event type eka?",
    giftBoxTheme: "Gift box theme eka mokakda?",
    itemCount: "Box ekata items keeyak oneda?",
    participants: "Keedenek enawada?",
    venue: "Event eka koheda thiyenne?",
  },
};

const giftTypeMessages: Record<Language, string> = {
  English: "Thanks. What type of gift would you like to explore?",
  Sinhala: "ස්තුතියි. ඔබ බලන්න කැමති තෑගි වර්ගය තෝරන්න.",
  Singlish: "Thanks. mokak wage gift type ekak balannada?",
};

const contextFieldOptions: Record<ContextField, string[]> = {
  boxRecipient: recipientOptions,
  budget: budgetOptions,
  category: giftTypeOptions,
  eventType: eventTypeOptions,
  giftBoxTheme: giftBoxThemeOptions,
  itemCount: itemCountOptions,
  occasion: occasionOptions,
  participants: participantOptions,
  recipient: recipientOptions,
  venue: venueOptions,
};

const contextFieldLabels: Record<ContextField, string> = {
  boxRecipient: "Recipient",
  budget: "Budget",
  category: "Gift type",
  eventType: "Event type",
  giftBoxTheme: "Theme",
  itemCount: "Items",
  occasion: "Occasion",
  participants: "Participants",
  recipient: "Recipient",
  venue: "Venue",
};

const contextFieldLabelsByLanguage: Record<
  Language,
  Record<ContextField, string>
> = {
  English: contextFieldLabels,
  Sinhala: {
    boxRecipient: "Recipient",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    giftBoxTheme: "Theme",
    itemCount: "Items",
    occasion: "Occasion",
    participants: "Participants",
    recipient: "Recipient",
    venue: "Venue",
  },
  Singlish: {
    boxRecipient: "Recipient",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    giftBoxTheme: "Theme",
    itemCount: "Items",
    occasion: "Occasion",
    participants: "Participants",
    recipient: "Recipient",
    venue: "Venue",
  },
};

const contextFieldLabelOverrides: Record<
  Language,
  Partial<Record<ContextField, string>>
> = {
  English: {},
  Sinhala: {
    boxRecipient: "ලබන්නා",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    giftBoxTheme: "Theme",
    itemCount: "Items",
    occasion: "අවස්ථාව",
    participants: "Participants",
    recipient: "ලබන්නා",
    venue: "ස්ථානය",
  },
  Singlish: {
    boxRecipient: "Recipient",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    giftBoxTheme: "Theme",
    itemCount: "Items",
    occasion: "Occasion",
    participants: "Participants",
    recipient: "Recipient",
    venue: "Venue",
  },
};

const emptyContextDraft: ContextDraft = {
  boxRecipient: "",
  budget: "",
  category: "",
  eventType: "",
  giftBoxTheme: "",
  itemCount: "",
  occasion: "",
  participants: "",
  recipient: "",
  venue: "",
};

function getLocalDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function removeEmojiForSpeech(value: string) {
  return value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getNonPastDate(value: string) {
  const today = getLocalDateString();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today
    ? value
    : today;
}

function formatBudgetAmount(value: number) {
  return new Intl.NumberFormat("en-LK", {
    maximumFractionDigits: 0,
  }).format(value);
}

function parseBudgetAmount(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }

  const amount = Number(digits);
  return Number.isFinite(amount) && amount >= 0 ? String(amount) : "";
}

function parseBudgetRangeValue(value: string) {
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

function buildBudgetRangeValue(min: string, max: string) {
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

function divideBudgetAcrossItems(budget: string, itemCount: number) {
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

const initialShoppingProfile: ShoppingProfile = {
  budget: "",
  category: "",
  city: "Colombo",
  date: getLocalDateString(),
  interests: "premium gifts, useful items",
  occasion: "",
  recipient: "",
};

function getExtendedPreferencesFromProfile(
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

function normalizeExtendedPreferences(
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

function mergeExtendedPreferencesWithProfile(
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
    replyCount: didPreferenceChange ? current.replyCount + 1 : current.replyCount,
  };
}

function havePreferenceValuesChanged(
  current: ExtendedPreferences,
  updates: Partial<Pick<ExtendedPreferences, "budget" | "giftType" | "occasion" | "recipient">>,
) {
  return (
    (updates.budget !== undefined && updates.budget !== current.budget) ||
    (updates.giftType !== undefined && updates.giftType !== current.giftType) ||
    (updates.occasion !== undefined && updates.occasion !== current.occasion) ||
    (updates.recipient !== undefined && updates.recipient !== current.recipient)
  );
}

function applyExtendedPreferenceUpdates(
  current: ExtendedPreferences,
  updates: Partial<Pick<ExtendedPreferences, "budget" | "giftType" | "occasion" | "recipient">>,
) {
  const didPreferenceChange = havePreferenceValuesChanged(current, updates);

  return {
    ...current,
    ...updates,
    replyCount: didPreferenceChange ? current.replyCount + 1 : current.replyCount,
  };
}

function syncExtendedPreferencesWithProfile(
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

function normalizeShoppingProfile(nextProfile: ShoppingProfile): ShoppingProfile {
  return {
    ...initialShoppingProfile,
    ...nextProfile,
    date: getNonPastDate(nextProfile.date),
  };
}

function normalizeModeSession(session: ModeSession): ModeSession {
  const normalizedProfile = normalizeShoppingProfile(session.profile);
  const guidedPlanItems = (session.guidedPlanItems ?? []).slice(0, 12);
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
    productBatchIndex: Math.max(0, Math.min(3, session.productBatchIndex ?? 0)),
    recommendedProducts: (session.recommendedProducts ?? []).slice(
      0,
      MAX_RANKED_PRODUCTS,
    ),
  };
}

function normalizeModeSessions(sessions: Record<string, ModeSession>) {
  return Object.fromEntries(
    Object.entries(sessions).map(([mode, session]) => [
      mode,
      normalizeModeSession(session),
    ]),
  );
}

function getPreferenceStateForMode(mode: string) {
  if (mode.includes("Event")) {
    return "eventUserPreference" as const;
  }

  if (mode.includes("Gift Box")) {
    return "giftUserPreference" as const;
  }

  return "extendedPreferences" as const;
}

function getPreferencePayloadForMode(
  mode: string,
  preferenceState: ExtendedPreferences,
): ModePreferencePayload {
  const key = getPreferenceStateForMode(mode);
  return { [key]: preferenceState };
}

function getResponsePreferenceForMode(
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

const copy: Record<
  Language,
  Partial<{
    active: string;
    addProducts: string;
    addToBuyBox: string;
    allContextDetected: string;
    askPlaceholder: string;
    buyBox: string;
    checkout: string;
    city: string;
    clearHistory: string;
    comparePrompt: string;
    continueWithoutContext: string;
    contextIntro: string;
    contextTitle: string;
    createOrderLink: string;
    date: string;
    detectedContext: string;
    delivery: string;
    deliveryInstructions: string;
    eventPrompt: string;
    giftBoxPrompt: string;
    giftMessageLabel: string;
    initialEmpty: string;
    initialLoading: string;
    imageLooksLike: string;
    language: string;
    modes: string;
    openCheckout: string;
    processing: string;
    productView: string;
    recipientName: string;
    recipientPhone: string;
    relatedGiftsReply: string;
    recordingVoice: string;
    send: string;
    sendContext: string;
    sending: string;
    sendingContext: string;
    senderName: string;
    subtotal: string;
    transcribingVoice: string;
    total: string;
    uploadingImage: string;
    useContextCard: string;
    userContext: string;
    voicePause: string;
    voiceEnglishOnly: string;
    voiceRetry: string;
    voiceResume: string;
    voiceStop: string;
  }>
> = {
  English: {
    active: "Active",
    addProducts: "Add products to build a cart order link.",
    addToBuyBox: "Add to Cart",
    allContextDetected: "All needed context was detected from your message.",
    askPlaceholder: "Ask Genie to search, compare, plan an event, or checkout...",
    buyBox: "Cart",
    checkout: "Delivery address",
    city: "City",
    clearHistory: "Clear history",
    comparePrompt: "Enter 2 or 3 product IDs and I will compare them in a table.",
    continueWithoutContext: "Continue Without Context",
    contextIntro:
      "I detected details from your message and only need anything missing before answering it.",
    contextTitle: "Set shopping preferences",
    createOrderLink: "Create Order Link",
    date: "Date",
    detectedContext: "Detected preferences",
    delivery: "Delivery",
    deliveryInstructions: "Delivery instructions",
    eventPrompt: "Let us plan the event. Add the event details below.",
    giftBoxPrompt: "Let us build the gift box. Add the gift box details below.",
    giftMessageLabel: "Gift message",
    initialEmpty: "GenieAI products will appear here after a search.",
    initialLoading: "Loading products...",
    imageLooksLike: "Your image looks like",
    language: "Language",
    modes: "Agent Modes",
    openCheckout: "Open Checkout",
    processing: "Processing...",
    productView: "View",
    recipientName: "Recipient name",
    recipientPhone: "Recipient phone",
    relatedGiftsReply: "I will show you related gifts.",
    recordingVoice: "Recording voice input...",
    send: "Send",
    sendContext: "Send Preferences",
    sending: "Sending",
    sendingContext: "Sending Preferences",
    senderName: "Sender name",
    subtotal: "Subtotal",
    transcribingVoice: "Transcribing voice note...",
    total: "Total",
    uploadingImage: "Processing image...",
    useContextCard: "Use the preferences above...",
    userContext: "Preferences",
    voicePause: "Pause",
    voiceEnglishOnly: "Voice search supports English only.",
    voiceRetry:
      "I couldn't clearly recognize that voice message. Please try again in English.",
    voiceResume: "Resume",
    voiceStop: "Stop",
  },
  Sinhala: {
    active: "Active",
    addProducts: "Order එකකට products එකතු කරන්න.",
    addToBuyBox: "Cart එකට එකතු කරන්න",
    allContextDetected: "ඔබගේ message එකෙන් අවශ්‍ය context හමු වුණා.",
    askPlaceholder: "Genieගෙන් search, compare, plan, checkout අහන්න...",
    buyBox: "Cart",
    checkout: "Delivery address",
    city: "නගරය",
    continueWithoutContext: "Preferences නැතුව ඉදිරියට",
    contextIntro:
      "ඔබගේ message එකෙන් හමු වූ details පාවිච්චි කරලා, අඩු දේවල් විතරක් අහනවා.",
    contextTitle: "Shopping preferences තෝරන්න",
    createOrderLink: "Create Order Link",
    date: "දිනය",
    detectedContext: "හමු වූ preferences",
    delivery: "Delivery",
    deliveryInstructions: "Delivery instructions",
    initialEmpty: "සෙවීමට පස්සේ GenieAI products මෙතැන පෙන්වයි.",
    initialLoading: "Products load වෙනවා...",
    language: "භාෂාව",
    modes: "Agent Modes",
    openCheckout: "Open Checkout",
    productView: "බලන්න",
    recipientName: "Recipient name",
    recipientPhone: "Recipient phone",
    send: "යවන්න",
    sendContext: "Preferences යවන්න",
    sending: "යවමින්",
    sendingContext: "Preferences යවමින්",
    senderName: "Sender name",
    subtotal: "Subtotal",
    total: "Total",
    useContextCard: "ඉහළ preferences භාවිත කරන්න...",
    userContext: "Preferences",
  },
  Singlish: {
    active: "Active",
    addProducts: "Order ekak hadanna products add karanna.",
    addToBuyBox: "Cart ekata add karanna",
    allContextDetected: "Oyage message eken preferences detect una.",
    askPlaceholder: "Genie gen search, compare, plan, checkout ahanna...",
    buyBox: "Cart",
    checkout: "Delivery address",
    city: "City eka",
    clearHistory: "History clear karanna",
    comparePrompt: "Product IDs 2k hari 3k hari denna. Mama table ekakin compare karannam.",
    continueWithoutContext: "Preferences nathuwa idiriyata",
    contextIntro:
      "Oyage message eken details detect kala.",
    contextTitle: "Shopping preferences set karanna",
    createOrderLink: "Create Order Link",
    date: "Date eka",
    detectedContext: "Detected preferences",
    delivery: "Delivery",
    deliveryInstructions: "Delivery instructions",
    eventPrompt: "Event eka plan karamu. Pahala details tika denna.",
    giftBoxPrompt: "Gift box eka hadamu. Pahala details tika denna.",
    giftMessageLabel: "Gift message",
    initialEmpty: "Seweemakata passe GenieAI products methana pennanawa.",
    initialLoading: "Products load wenawa...",
    language: "Language",
    modes: "Agent Modes",
    openCheckout: "Open Checkout",
    productView: "Balanna",
    recipientName: "Recipient name",
    recipientPhone: "Recipient phone",
    relatedGiftsReply: "Mama oyata related gifts pennannam.",
    send: "Send",
    sendContext: "Preferences send karanna",
    sending: "Sending",
    sendingContext: "Preferences sending",
    senderName: "Sender name",
    subtotal: "Subtotal",
    total: "Total",
    useContextCard: "Uda preferences use karanna...",
    userContext: "Preferences",
  },
};

const copyOverrides: Record<Language, Partial<Required<(typeof copy)["English"]>>> = {
  English: {},
  Sinhala: {
    addProducts: "Order එකක් හදන්න products එකතු කරන්න.",
    addToBuyBox: "Cart එකට එකතු කරන්න",
    buyBox: "Cart",
    clearHistory: "History clear කරන්න",
    comparePrompt: "Product IDs 2ක් හෝ 3ක් දෙන්න. මම table එකකින් compare කරන්නම්.",
    contextIntro: "ඔබ දුන් details අනුව අඩු තොරතුරු ටික පමණක් තෝරන්න.",
    contextTitle: "Preferences තෝරන්න",
    eventPrompt: "Event එක plan කරමු. පහළ details ටික තෝරන්න.",
    giftBoxPrompt: "Gift box එක හදමු. පහළ details ටික තෝරන්න.",
    deliveryInstructions: "Delivery instructions",
    giftMessageLabel: "Gift message",
    imageLooksLike: "ඔබේ image එක පේන්නේ",
    processing: "Processing...",
    recordingVoice: "Voice record වෙනවා...",
    relatedGiftsReply: "මම ඔබට ගැලපෙන gifts පෙන්වන්නම්.",
    transcribingVoice: "Voice note එක text කරනවා...",
    uploadingImage: "Image process වෙනවා...",
    useContextCard: "ඉහළ preferences භාවිතා කරන්න...",
    userContext: "Preferences",
    voicePause: "Pause",
    voiceEnglishOnly: "Voice search සඳහා සහාය දක්වන්නේ English පමණයි.",
    voiceRetry:
      "Voice message එක පැහැදිලිව හඳුනාගන්න බැරි වුණා. කරුණාකර English වලින් නැවත උත්සාහ කරන්න.",
    voiceResume: "Resume",
    voiceStop: "Stop",
  },
  Singlish: {
    deliveryInstructions: "Delivery instructions",
    giftMessageLabel: "Gift message",
    imageLooksLike: "Oyage image eka penenne",
    processing: "Processing...",
    recordingVoice: "Voice record wenawa...",
    transcribingVoice: "Voice note eka text karanawa...",
    uploadingImage: "Image process wenawa...",
    voicePause: "Pause",
    voiceEnglishOnly: "Voice search support karanne English witharai.",
    voiceRetry:
      "Voice message eka hariyata handunaganna bari una. English walin aye try karanna.",
    voiceResume: "Resume",
    voiceStop: "Stop",
  },
};

const suggestedPromptsByLanguage: Record<Language, SuggestedPrompt[]> = {
  English: [
    {
      action: "fill",
      text: "Show me red roses between Rs. 2500 - 5000 for my girlfriend's birthday.",
    },
    {
      action: "fill",
      text: "Can you deliver to Colombo tomorrow?",
    },
    {
      action: "custom",
      text: "Or enter your custom message.",
    },
  ],
  Sinhala: [
    {
      action: "fill",
      text: "මගේ පෙම්වතියගේ උපන්දිනයට Rs. 2500 - 5000 අතර රතු රෝස මල් පෙන්නන්න.",
    },
    {
      action: "fill",
      text: "හෙට Colombo වලට delivery කරන්න පුළුවන්ද?",
    },
    {
      action: "custom",
      text: "නැත්නම් ඔබගේ custom message එක type කරන්න.",
    },
  ],
  Singlish: [
    {
      action: "fill",
      text: "Mage pemwathiyage upandinayata Rs. 2500 - 5000 athara rathu rosa mal pennanna.",
    },
    {
      action: "fill",
      text: "Heta Colombo walata delivery karanna puluwanda?",
    },
    {
      action: "custom",
      text: "Nathnam oyage custom message eka type karanna.",
    },
  ],
};

const starterChipLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Build a gift box": "තෑගි පෙට්ටියක් හදන්න",
    "Compare products": "නිෂ්පාදන සසඳන්න",
    "Find a gift": "තෑග්ගක් හොයන්න",
    "Plan an event": "උත්සවයක් සැලසුම් කරන්න",
    "Track an order": "ඇණවුමක් පරීක්ෂා කරන්න",
    "Write a gift message": "තෑගි පණිවිඩයක් ලියන්න",
  },
  Singlish: {
    "Build a gift box": "Gift box hadanna",
    "Compare products": "Products compare karanna",
    "Find a gift": "Gift ekak hoyanna",
    "Plan an event": "Event ekak plan karanna",
    "Track an order": "Order track karanna",
    "Write a gift message": "Gift message liyanna",
  },
};

const starterChipOverrides: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Find a cake": "කේක් එකක් හොයන්න",
    "Find chocolates": "චොකලට් හොයන්න",
    "Find flowers": "මල් හොයන්න",
    "Find perfume": "සුවඳ විලවුන් හොයන්න",
    "Same-day delivery": "අදම බෙදාහැරීම",
  },
  Singlish: {
    "Find a cake": "Cake ekak hoyanna",
    "Find chocolates": "Chocolate hoyanna",
    "Find flowers": "Flowers hoyanna",
    "Find perfume": "Perfume hoyanna",
    "Same-day delivery": "Ada delivery",
  },
};

const optionLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Above Rs. 10,000": "Rs. 10,000 ට වැඩි",
    Anniversary: "\u0dc3\u0d82\u0dc0\u0dad\u0dca\u0dc3\u0dbb\u0dba",
    Birthday: "\u0d8b\u0db4\u0db1\u0dca\u0daf\u0dd2\u0db1\u0dba",
    Child: "ළමයෙක්",
    Chocolate: "\u0da0\u0ddc\u0d9a\u0dbd\u0da7\u0dca",
    Couple: "Couple",
    Cakes: "\u0d9a\u0dda\u0d9a\u0dca",
    Fashion: "Fashion",
    Female: "කාන්තාවක්",
    Flowers: "\u0db8\u0dbd\u0dca",
    Graduation: "\u0d8b\u0db4\u0dcf\u0db0\u0dd2 \u0db4\u0dca\u0dbb\u0daf\u0dcf\u0db1\u0dba",
    Male: "පුරුෂයෙක්",
    Other: "වෙනත්",
    Perfumes: "\u0dc3\u0dd4\u0dc0\u0db3 \u0dc0\u0dd2\u0dbd\u0dc0\u0dd4\u0db1\u0dca",
    "Rs. 2,500 - 5,000": "Rs. 2,500 - 5,000",
    "Rs. 5,000 - 10,000": "Rs. 5,000 - 10,000",
    "Under Rs. 2,500": "Rs. 2,500 ට අඩු",
    Wedding: "\u0dc0\u0dd2\u0dc0\u0dcf\u0dc4\u0dba",
  },
  Singlish: {
    "Above Rs. 10,000": "Rs. 10,000 ta wedi",
    Anniversary: "Sanwathsare",
    Birthday: "Upandinaya",
    Child: "Child",
    Chocolate: "Chocolate",
    Couple: "Couple",
    Cakes: "Cake",
    Fashion: "Fashion",
    Female: "Female",
    Flowers: "Mal",
    Graduation: "Upadhi pradanaya",
    Male: "Male",
    Other: "Wenath",
    Perfumes: "Perfume",
    "Rs. 2,500 - 5,000": "Rs. 2,500 - 5,000",
    "Rs. 5,000 - 10,000": "Rs. 5,000 - 10,000",
    "Under Rs. 2,500": "Rs. 2,500 ta adu",
    Wedding: "Vivahaya",
  },
};

const contextOptionLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "2 items": "අයිතම 2",
    "3 items": "අයිතම 3",
    "4 items": "අයිතම 4",
    "5+ items": "අයිතම 5+",
    "10 - 25": "10 - 25",
    "25 - 50": "25 - 50",
    "Above 50": "50 ට වැඩි",
    "Family gathering": "පවුලේ එකතුව",
    Home: "නිවස",
    Hotel: "හෝටලය",
    Office: "කාර්යාලය",
    "Office party": "කාර්යාල සාදය",
    Outdoor: "එළිමහන්",
    Party: "සාදය",
    Perfume: "සුවඳ විලවුන්",
    "Under 10": "10 ට අඩු",
    Wellness: "සුවතා",
  },
  Singlish: {
    "2 items": "Items 2",
    "3 items": "Items 3",
    "4 items": "Items 4",
    "5+ items": "Items 5+",
    "10 - 25": "10 - 25",
    "25 - 50": "25 - 50",
    "Above 50": "50 ta wedi",
    "Family gathering": "Family gathering",
    Home: "Home",
    Hotel: "Hotel",
    Office: "Office",
    "Office party": "Office party",
    Outdoor: "Outdoor",
    Party: "Party",
    Perfume: "Perfume",
    "Under 10": "10 ta adu",
    Wellness: "Wellness",
  },
};

const dynamicChipLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Check delivery": "බෙදාහැරීම පරීක්ෂා කරන්න",
    Chocolate: "චොකලට්",
    "Colombo delivery": "කොළඹට බෙදාහැරීම",
    "Create order link": "ඇණවුම් සබැඳිය හදන්න",
    "More like this": "මේ වගේ තවත්",
    Perfume: "සුවඳ විලවුන්",
    Roses: "රෝස මල්",
    Watch: "ඔරලෝසුව",
  },
  Singlish: {
    "Check delivery": "Delivery check karanna",
    Chocolate: "Chocolate",
    "Colombo delivery": "Colombo delivery",
    "Create order link": "Order link hadanna",
    "More like this": "Me wage thawa",
    Perfume: "Perfume",
    Roses: "Roses",
    Watch: "Watch",
  },
};

const commonChipLabels: Record<Language, Record<string, string>> = {
  English: {
    "Next item": "Next item",
    "Previous item": "Previous item",
    "Suggest more": "Suggest more",
  },
  Sinhala: {
    "Check delivery": "බෙදාහැරීම පරීක්ෂා කරන්න",
    Chocolate: "චොකලට්",
    "Colombo delivery": "කොළඹට බෙදාහැරීම",
    "Create order link": "ඇණවුම් සබැඳිය හදන්න",
    "More like this": "මේ වගේ තවත්",
    "Next item": "ඊළඟ අයිතමය",
    "Open checkout": "Checkout අරින්න",
    "Previous item": "පෙර අයිතමය",
    Perfume: "සුවඳ විලවුන්",
    Roses: "රෝස මල්",
    "Search more products": "තව products හොයන්න",
    "Search products": "Products හොයන්න",
    "Suggest more": "තවත් යෝජනා",
    Watch: "ඔරලෝසුව",
  },
  Singlish: {
    "Check delivery": "Delivery check karanna",
    Chocolate: "Chocolate",
    "Colombo delivery": "Colombo delivery",
    "Create order link": "Order link hadanna",
    "More like this": "Me wage thawa",
    "Next item": "Ilanga item eka",
    "Open checkout": "Open checkout",
    "Previous item": "Kalin item eka",
    Perfume: "Perfume",
    Roses: "Roses",
    "Search more products": "Thawa products hoyanna",
    "Search products": "Products hoyanna",
    "Suggest more": "Thawa yojana",
    Watch: "Watch",
  },
};

const iconPaths: Record<IconName, string> = {
  box: "M4 7l8-4 8 4-8 4-8-4Zm0 0v10l8 4m0-10v10m8-14v10l-8 4",
  camera:
    "M4 7h3l1.5-2h7L17 7h3v12H4V7Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  cart: "M3 4h2l2 11h10l2-7H6m2 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  check: "M5 12l4 4L19 6",
  gift: "M20 12v8H4v-8m16 0H4m16 0V8H4v4m8-4v12M8 8c-2 0-3-1-3-2s1-2 2-2c2 0 5 4 5 4s3-4 5-4c1 0 2 1 2 2s-1 2-3 2",
  heart:
    "M12 20s-7-4.4-9-9c-1.2-2.8.8-5.8 3.8-5.8 1.8 0 3.1 1 4.2 2.4 1.1-1.4 2.4-2.4 4.2-2.4 3 0 5 3 3.8 5.8-2 4.6-9 9-9 9Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0m-7 7v3m-4 0h8",
  plus: "M12 5v14M5 12h14",
  search: "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.5-2 5 5",
  send: "M12 5v14m0-14-5 5m5-5 5 5",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M4.9 4.9 7 7m10 10 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m10-10 2.1-2.1",
  speaker: "M4 9v6h4l5 4V5L8 9H4Zm12 1a4 4 0 0 1 0 4m2-7a8 8 0 0 1 0 10",
  sparkles:
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm6 12 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 3l.8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8L5 3Z",
  trash: "M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3",
  x: "M6 6l12 12M18 6 6 18",
};

const CHAT_DB_NAME = "genie-ai-chat";
const CHAT_STORE_NAME = "chat-state";
const CHAT_STATE_KEY = "current";
const CHAT_STORAGE_KEY = "genie-ai-chat-state";
const INITIAL_CATALOG_VERSION = "supabase-cakes-flowers-v2";
const INTRO_PANEL_STORAGE_KEY = "genie-ai-intro-panel-date";
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function getValidatedPhoneNumber(value: string) {
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

function getTaskForMode(mode: string) {
  if (mode.includes("Event")) return "eventPlan";
  if (mode.includes("Gift Box")) return "giftBox";
  if (mode.includes("Compare")) return "compare";
  return "recommend";
}

function Icon({ name, className = "h-5 w-5" }: { className?: string; name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d={iconPaths[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function openChatDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CHAT_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(CHAT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredChatState() {
  if (typeof indexedDB === "undefined") {
    const storedValue = localStorage.getItem(CHAT_STORAGE_KEY);
    return storedValue ? (JSON.parse(storedValue) as StoredChatState) : null;
  }

  const database = await openChatDatabase();

  return new Promise<StoredChatState | null>((resolve, reject) => {
    const transaction = database.transaction(CHAT_STORE_NAME, "readonly");
    const request = transaction.objectStore(CHAT_STORE_NAME).get(CHAT_STATE_KEY);

    request.onsuccess = () => resolve((request.result as StoredChatState) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeStoredChatState(state: StoredChatState) {
  if (typeof indexedDB === "undefined") {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
    return;
  }

  const database = await openChatDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CHAT_STORE_NAME, "readwrite");
    const request = transaction
      .objectStore(CHAT_STORE_NAME)
      .put(state, CHAT_STATE_KEY);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function clearStoredChatState() {
  localStorage.removeItem(CHAT_STORAGE_KEY);

  if (typeof indexedDB === "undefined") {
    return;
  }

  const database = await openChatDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CHAT_STORE_NAME, "readwrite");
    const request = transaction.objectStore(CHAT_STORE_NAME).delete(CHAT_STATE_KEY);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

const rotatingActivityMessages: Record<Language, string[]> = {
  English: [
    "Understanding your request...",
    "Checking your preferences...",
    "Searching GenieAI products...",
    "Matching the best options...",
    "Preparing your reply...",
  ],
  Sinhala: [
    "ඔබේ ඉල්ලීම තේරුම් ගනිමින්...",
    "Preferences පරීක්ෂා කරමින්...",
    "GenieAI products සොයමින්...",
    "හොඳම ගැළපීම් තෝරමින්...",
    "පිළිතුර සකස් කරමින්...",
  ],
  Singlish: [
    "Oyage request eka balamin...",
    "Preferences check karamin...",
    "GenieAI products hoyamin...",
    "Galapena options thoramin...",
    "Reply eka hadamin...",
  ],
};

export function GenieAIController() {
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const compareTableTopScrollRef = useRef<HTMLDivElement | null>(null);
  const compareTableBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const productCarouselRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const shouldSendRecordingRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatSoundContextRef = useRef<AudioContext | null>(null);
  const speechPlaybackRequestRef = useRef(0);
  const initialProductsLoadedRef = useRef(false);
  const lastPersonalizationImpressionKeyRef = useRef("");

  const [activeMode, setActiveMode] = useState("Smart Shopping");
  const [language, setLanguage] = useState<Language>("English");
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [chips, setChips] = useState(starterChips);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [productBatchIndex, setProductBatchIndex] = useState(0);
  const [isLoadingInitialProducts, setIsLoadingInitialProducts] =
    useState(true);
  const [fitReasons, setFitReasons] = useState<Record<string, string>>({});
  const [buyBox, setBuyBox] = useState<Product[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutDetails, setCheckoutDetails] = useState({
    address: "",
    locationType: "",
    recipientName: "",
    recipientPhone: "",
    senderName: "",
  });
  const [profile, setProfile] =
    useState<ShoppingProfile>(initialShoppingProfile);
  const [extendedPreferences, setExtendedPreferences] =
    useState<ExtendedPreferences>(() =>
      getExtendedPreferencesFromProfile(initialShoppingProfile),
    );
  const [conversationStage, setConversationStage] = useState<
    "first-message" | "collecting-context" | "ready"
  >("first-message");
  const [pendingUserRequest, setPendingUserRequest] = useState("");
  const [contextDraft, setContextDraft] =
    useState<ContextDraft>(emptyContextDraft);
  const [analytics, setAnalytics] = useState({
    buyBoxHealth: "Ready",
    conversionSignal: "High intent after budget and city are known",
    nextBestAction: "Ask for recipient phone and delivery slot",
    risk: "Perfume stock is limited",
  });
  const [giftMessage, setGiftMessage] = useState(
    "Wishing you a wonderful day filled with love and appreciation.",
  );
  const [status, setStatus] = useState(
    "Groq chat and media ready. Live commerce service ready.",
  );
  const [canScrollProductCarouselLeft, setCanScrollProductCarouselLeft] =
    useState(false);
  const [canScrollProductCarouselRight, setCanScrollProductCarouselRight] =
    useState(false);
  const [activityMessage, setActivityMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isChatStateLoaded, setIsChatStateLoaded] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const [isBuyBoxOpen, setIsBuyBoxOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modeSessions, setModeSessions] = useState<Record<string, ModeSession>>({});
  const [compareSelectionIds, setCompareSelectionIds] = useState<string[]>([]);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [compareSuggestion, setCompareSuggestion] = useState("");
  const [guidedPlanItems, setGuidedPlanItems] = useState<GuidedPlanItem[]>([]);
  const [guidedPlanIndex, setGuidedPlanIndex] = useState(0);
  const [isCompareSubmitting, setIsCompareSubmitting] = useState(false);
  const [isCheckoutCreating, setIsCheckoutCreating] = useState(false);
  const [checkoutWarning, setCheckoutWarning] = useState("");
  const [giftMessagePreferences, setGiftMessagePreferences] =
    useState<GiftMessagePreferences>({
      language: "English",
      size: "Short",
      suggestions: "",
      tone: "Warm",
    });
  const [isGiftMessageGenerating, setIsGiftMessageGenerating] = useState(false);
  const [giftMessageToolTab, setGiftMessageToolTab] = useState<"message" | "card">("message");
  const [giftCardPreferences, setGiftCardPreferences] =
    useState<GiftCardPreferences>({
      instructions: "",
      language: "English",
      occasion: "",
      recipient: "",
      receiverName: "",
      senderName: "",
      style: "Elegant",
      theme: "Auto-match product",
    });
  const [giftCardProductId, setGiftCardProductId] = useState("");
  const [giftCardImage, setGiftCardImage] = useState("");
  const [giftCardMessage, setGiftCardMessage] = useState("");
  const [giftCardAnalysis, setGiftCardAnalysis] = useState("");
  const [giftCardPalette, setGiftCardPalette] = useState<string[]>([]);
  const [isGiftCardGenerating, setIsGiftCardGenerating] = useState(false);
  const [isIntroPanelVisible, setIsIntroPanelVisible] = useState(false);
  const [isComposerMenuOpen, setIsComposerMenuOpen] = useState(false);
  const [isPromptPopupOpen, setIsPromptPopupOpen] = useState(false);
  const [sidebarBudgetMin, setSidebarBudgetMin] = useState(() =>
    parseBudgetRangeValue(initialShoppingProfile.budget).min
  );
  const [sidebarBudgetMax, setSidebarBudgetMax] = useState(() =>
    parseBudgetRangeValue(initialShoppingProfile.budget).max
  );
  const [sidebarBudgetError, setSidebarBudgetError] = useState("");

  const totals = useMemo(() => {
    const subtotal = buyBox.reduce((sum, product) => sum + product.price, 0);
    const delivery = buyBox.length > 0 ? deliveryFee : 0;
    return {
      delivery,
      subtotal,
      total: subtotal + delivery,
    };
  }, [buyBox, deliveryFee]);
  const text = { ...copy.English, ...copy[language], ...copyOverrides[language] } as Required<
    (typeof copy)["English"]
  >;
  const minimumDeliveryDate = getLocalDateString();
  const visibleProducts = useMemo(
    () => {
      const start = productBatchIndex * PRODUCT_BATCH_SIZE;
      return recommendedProducts.slice(start, start + PRODUCT_BATCH_SIZE);
    },
    [productBatchIndex, recommendedProducts],
  );
  const latestUserQuery = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "user")?.content,
    [messages],
  );
  const shouldShowProductSuggestions =
    conversationStage !== "collecting-context";
  const hasUserMessages = messages.some((message) => message.role === "user");
  const isGuidedMode =
    activeMode.includes("Event") || activeMode.includes("Gift Box");
  const visibleReplyChips =
    isGuidedMode && isSending
      ? []
      : activeMode === "Smart Shopping" && hasUserMessages
      ? chips.filter((chip) => chip === "Suggest more")
      : hasUserMessages
        ? chips.filter((chip) => !isRemovedGenericReplyChip(chip))
        : chips;
  const latestAssistantMessageIndex = messages.reduce(
    (latestIndex, message, index) =>
      message.role === "assistant" ? index : latestIndex,
    -1,
  );
  const cartCount = buyBox.length;
  const readAloudTitle =
    language === "Sinhala"
      ? "අවසන් message එක කියවන්න"
      : language === "Singlish"
        ? "Anthima message eka kiyawanna"
        : "Read latest message aloud";
  const isCompareMode = activeMode.includes("Compare");
  const isGiftMessageMode = activeMode.includes("Message");
  const isFormToolMode = isCompareMode || isGiftMessageMode;
  const suggestedPrompts = suggestedPromptsByLanguage[language];

  useEffect(() => {
    void initializePersonalizationSession();
  }, []);

  useEffect(() => {
    if (isSending || visibleProducts.length === 0) {
      return;
    }

    const impressionKey = JSON.stringify({
      mode: activeMode,
      productIds: visibleProducts.map((product) => product.id),
      query: latestUserQuery ?? "",
    });

    if (lastPersonalizationImpressionKeyRef.current === impressionKey) {
      return;
    }

    lastPersonalizationImpressionKeyRef.current = impressionKey;
    visibleProducts.forEach((product, index) => {
      void trackPersonalizationEvent({
        category: product.category,
        event: "impression",
        position: productBatchIndex * PRODUCT_BATCH_SIZE + index + 1,
        price: product.price,
        productId: product.id,
        query: latestUserQuery,
      });
    });
  }, [activeMode, isSending, latestUserQuery, productBatchIndex, visibleProducts]);

  useEffect(() => {
    if (!isPromptPopupOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!composerRef.current?.contains(event.target as Node)) {
        setIsPromptPopupOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPromptPopupOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPromptPopupOpen]);

  function closeIntroPanel() {
    setIsIntroPanelVisible(false);
  }

  function getChipLabel(chip: string) {
    const localizedLabel =
      starterChipOverrides[language][chip] ??
      starterChipLabels[language][chip] ??
      commonChipLabels[language][chip] ??
      dynamicChipLabels[language][chip] ??
      contextOptionLabels[language][chip] ??
      optionLabels[language][chip] ??
      chip;

    return localizedLabel.trim().split(/\s+/u).slice(0, 3).join(" ");
  }

  function getGuidedReplyChips() {
    return ["Previous item", "Next item", "Suggest more"];
  }

  function isRemovedGenericReplyChip(chip: string) {
    return /\b(check delivery|delivery check|create order link|order link|open checkout|more like this|search products)\b|බෙදාහැරීම|ඇණවුම්\s+සබැඳිය/iu.test(
      chip,
    );
  }

  function getOptionLabel(option: string) {
    return (
      contextOptionLabels[language][option] ??
      optionLabels[language][option] ??
      option
    );
  }

  function getLocalizedUserText(value: string) {
    return getChipLabel(value);
  }

  function syncSidebarBudgetDraft(nextBudget: string) {
    const parsedBudget = parseBudgetRangeValue(nextBudget);
    setSidebarBudgetMin(parsedBudget.min);
    setSidebarBudgetMax(parsedBudget.max);
    setSidebarBudgetError("");
  }

  function getContextFieldLabel(field: ContextField) {
    return (
      contextFieldLabelOverrides[language][field] ??
      contextFieldLabelsByLanguage[language][field]
    );
  }

  function getModeIntroMessage(mode: string, selectedLanguage = language) {
    const localizedText = {
      ...copy.English,
      ...copy[selectedLanguage],
      ...copyOverrides[selectedLanguage],
    } as Required<(typeof copy)["English"]>;

    if (mode.includes("Event")) return localizedText.eventPrompt;
    if (mode.includes("Gift Box")) return localizedText.giftBoxPrompt;
    if (mode.includes("Compare")) return localizedText.comparePrompt;
    return starterMessagesByLanguage[selectedLanguage][0].content;
  }

  function getDefaultModeSession(mode: string): ModeSession {
    if (mode === "Smart Shopping") {
      return {
        chips: starterChips,
        contextDraft: emptyContextDraft,
        conversationStage: "first-message",
        extendedPreferences: getExtendedPreferencesFromProfile(
          initialShoppingProfile,
        ),
        fitReasons: {},
        guidedPlanIndex: 0,
        guidedPlanItems: [],
        input: "",
        messages: starterMessagesByLanguage[language],
        pendingUserRequest: "",
        profile: normalizeShoppingProfile(initialShoppingProfile),
        productBatchIndex: 0,
        recommendedProducts: [],
      };
    }

    const needsContext = mode.includes("Event") || mode.includes("Gift Box");

    return {
      chips: [],
      contextDraft: emptyContextDraft,
      conversationStage: needsContext ? "collecting-context" : "ready",
      extendedPreferences: getExtendedPreferencesFromProfile(profile),
      fitReasons: {},
      guidedPlanIndex: 0,
      guidedPlanItems: [],
      input: "",
      messages: [
        {
          role: "assistant",
          content: getModeIntroMessage(mode),
          variant: needsContext ? "context-panel" : undefined,
        },
      ],
      pendingUserRequest: mode.includes("Event")
        ? "Plan an event"
        : mode.includes("Gift Box")
          ? "Build a gift box"
          : "",
      profile: normalizeShoppingProfile(profile),
      productBatchIndex: 0,
      recommendedProducts: [],
    };
  }

  function getCurrentModeSession(): ModeSession {
    return {
      chips,
      contextDraft,
      conversationStage,
      extendedPreferences,
      fitReasons,
      guidedPlanIndex,
      guidedPlanItems,
      input,
      messages,
      pendingUserRequest,
      profile: normalizeShoppingProfile(profile),
      productBatchIndex,
      recommendedProducts,
    };
  }

  function applyModeSession(session: ModeSession) {
    const normalizedSession = normalizeModeSession(session);

    setChips(normalizedSession.chips);
    setContextDraft(normalizedSession.contextDraft);
    setConversationStage(normalizedSession.conversationStage);
    setExtendedPreferences(
      normalizeExtendedPreferences(
        normalizedSession.extendedPreferences,
        normalizedSession.profile,
      ),
    );
    setFitReasons(normalizedSession.fitReasons ?? {});
    setGuidedPlanIndex(normalizedSession.guidedPlanIndex ?? 0);
    setGuidedPlanItems(normalizedSession.guidedPlanItems ?? []);
    setInput(normalizedSession.input);
    setMessages(normalizedSession.messages);
    setPendingUserRequest(normalizedSession.pendingUserRequest);
    setProfile(normalizedSession.profile);
    setProductBatchIndex(normalizedSession.productBatchIndex ?? 0);
    syncSidebarBudgetDraft(normalizedSession.profile.budget);
    setRecommendedProducts(
      (normalizedSession.recommendedProducts ?? []).slice(0, MAX_RANKED_PRODUCTS),
    );
  }

  function resetToolPanels() {
    setCompareRows([]);
    setCompareSuggestion("");
    setGuidedPlanItems([]);
    setGuidedPlanIndex(0);
    setGiftCardImage("");
    setGiftCardMessage("");
    setGiftCardAnalysis("");
    setGiftCardPalette([]);
    setGiftCardProductId("");
  }

  function getCommerceReply(data: CommerceResponse) {
    const reply = stripModelThinking(data.reply ?? "").trim();

    if (!reply) {
      return reply;
    }

    return reply;
  }

  function getGuidedReplyIntro() {
    if (language === "Sinhala") {
      return "මේවා තමයි ඔයාට ඕනෙ වෙන්න‌ේ.";
    }

    if (language === "Singlish") {
      return "Meඅa thamai oyata ona wenne.";
    }

    return "This is what you need.";
  }

  function getRetryableFailureType(error: unknown) {
    const message = getErrorMessage(error).toLowerCase();

    if (/timed?\s*out|timeout/.test(message)) {
      return "timeout" as const;
    }

    return null;
  }

  function getRetryFailureReply() {
    if (language === "Sinhala") {
      return "Model quota සීමාව ඉවර වෙලා. නැවත උත්සාහ කරන්න, නැත්නම් English වලට මාරු වෙන්න.";
    }

    if (language === "Singlish") {
      return "Model quota limit eka iwara wela. Ayeth try karanna nathnam English walata maru wenna.";
    }

    return "Model quota limit reached. Please try again or switch to English.";
  }

  function addRetryFailure(
    error: unknown,
    retryText: string,
    retryContext = false,
  ) {
    const failureType = getRetryableFailureType(error);

    if (!failureType) {
      return false;
    }

    const content = getRetryFailureReply();
    addMessage({
      role: "assistant",
      content,
      retryContext,
      retryReason: "timeout",
      retryText,
    });
    setStatus(content);
    return true;
  }

  function getTryAgainLabel() {
    if (language === "Sinhala") return "නැවත උත්සාහ කරන්න";
    if (language === "Singlish") return "Ayeth try karanna";
    return "Try again";
  }

  function getSwitchToEnglishLabel() {
    if (language === "Sinhala") return "English walata maru wenna";
    if (language === "Singlish") return "English walata maru wenna";
    return "Switch to English";
  }

  function getEmptyCartWarning(selectedLanguage: Language = language) {
    if (selectedLanguage === "Sinhala") {
      return "Create Order Link click karanna kalin cart ekata item ekak hari add karanna.";
    }
    if (selectedLanguage === "Singlish") {
      return "Create Order Link click karanna kalin cart ekata item ekak add karanna.";
    }
    return "Please add at least one item to the cart before creating the order link.";
  }

  function getParticipantCount(draft: ContextDraft) {
    const source = draft.participants || "";

    if (source.includes("Above 50")) return 60;
    if (source.includes("25 - 50")) return 40;
    if (source.includes("10 - 25")) return 20;
    if (source.includes("Under 10")) return 8;

    return 12;
  }

  function getGiftBoxItemCount(draft: ContextDraft) {
    const match = (draft.itemCount || "").match(/\d+/);
    return match ? Number(match[0]) : 3;
  }

  function getPlanSearchTerm(item: GuidedPlanItem | string) {
    const value = typeof item === "string" ? item : item.searchTerm || item.label;
    const normalized = value.toLowerCase();

    if (normalized.includes("cake")) return "cake";
    if (normalized.includes("flower") || normalized.includes("rose")) return "flowers";
    if (normalized.includes("chocolate")) return "chocolate";
    if (normalized.includes("perfume")) return "perfume";
    if (normalized.includes("sweet")) return "sweets";
    if (normalized.includes("decor")) return "decorations";
    if (normalized.includes("party")) return "party";
    if (normalized.includes("snack")) return "snacks";

    if (normalized.includes("card")) return "greeting card";

    return value.replace(/^\d+[\).:-]?\s*/, "").slice(0, 80) || "gift";
  }

  function formatGuidedPlanItem(item: GuidedPlanItem) {
    return `${item.label} - ${item.quantity}`;
  }

  function getDefaultPlanItems(mode: string, draft: ContextDraft): GuidedPlanItem[] {
    if (mode.includes("Gift Box")) {
      const theme = draft.giftBoxTheme || draft.category || profile.category;
      const itemCount = getGiftBoxItemCount(draft);

      if (theme === "Flowers") {
        return [
          { label: "flowers", quantity: "1 bouquet", searchTerm: "flowers" },
          { label: "chocolates", quantity: `${Math.max(1, itemCount - 1)} boxes`, searchTerm: "chocolate" },
          { label: "card", quantity: "1 card", searchTerm: "greeting card" },
        ];
      }

      if (theme === "Perfume") {
        return [
          { label: "perfume", quantity: "1 bottle", searchTerm: "perfume" },
          { label: "chocolates", quantity: `${Math.max(1, itemCount - 1)} boxes`, searchTerm: "chocolate" },
          { label: "flowers", quantity: "1 small bouquet", searchTerm: "flowers" },
        ];
      }

      if (theme === "Party") {
        return [
          { label: "cake", quantity: "1kg", searchTerm: "cake" },
          { label: "party pack", quantity: `${itemCount} items`, searchTerm: "party pack" },
          { label: "chocolates", quantity: "1 box", searchTerm: "chocolate" },
        ];
      }

      return [
        { label: "chocolates", quantity: `${itemCount} items`, searchTerm: "chocolate" },
        { label: "flowers", quantity: "1 bouquet", searchTerm: "flowers" },
        { label: "cake", quantity: "1kg", searchTerm: "cake" },
      ];
    }

    const participants = getParticipantCount(draft);
    const cakeKg = Math.max(1, Math.ceil(participants / 12));

    return [
      { label: "cake", quantity: `${cakeKg}kg`, searchTerm: "cake" },
      { label: "flowers", quantity: "1-2 bouquets", searchTerm: "flowers" },
      { label: "chocolates", quantity: `${Math.ceil(participants / 8)} boxes`, searchTerm: "chocolate" },
      { label: "snacks", quantity: `${participants} servings`, searchTerm: "snacks" },
    ];
  }

  function normalizeGuidedPlanItems(
    items: string[],
    mode = activeMode,
    draft = contextDraft,
  ) {
    const fallback = getDefaultPlanItems(mode, draft);

    if (mode.includes("Event")) {
      return fallback;
    }

    return items.length > 0
      ? items.slice(0, 4).map((item, index) => ({
          label:
            item.replace(/^[-*\d.)\s]+/, "").split("-")[0].trim() ||
            fallback[index]?.label ||
            "gift",
          quantity: fallback[index]?.quantity || "1 item",
          searchTerm: fallback[index]?.searchTerm || getPlanSearchTerm(item),
        }))
      : fallback;
  }

  function getGuidedPlanReply(
    items: GuidedPlanItem[],
    index = 0,
    replyLanguage = language,
  ) {
    const nextItem = items[index]?.label ?? items[0]?.label ?? "gift";
    const itemList = items
      .map((item) => `- ${formatGuidedPlanItem(item)}`)
      .join("\n");

    if (replyLanguage === "Sinhala") {
      return `යෝජිත අයිතම ලැයිස්තුව:\n${itemList}\n\nමුලින්ම ${nextItem} සඳහා options පෙන්වන්නම්. ඊළඟ අයිතමයට යන්න Next item ඔබන්න.`;
    }

    if (replyLanguage === "Singlish") {
      return `Yojitha item list eka:\n${itemList}\n\nMulinnama ${nextItem} walata options pennannam. Ilanga item ekata yanna Next item obanna.`;
    }

    return `Suggested item list:\n${itemList}\n\nI will start by showing options for ${nextItem}. Use Next item to move through the list.`;
  }

  function getStepReply(item: GuidedPlanItem | string, isMore = false) {
    const label = typeof item === "string" ? item : formatGuidedPlanItem(item);

    if (isMore) {
      if (language === "Sinhala") return `${label} walata thawa options pennanawa.`;
      if (language === "Singlish") return `${label} walata thawa options pennanawa.`;
      return `I will show more options for ${label}.`;
    }

    if (typeof item !== "string") {
      if (language === "Sinhala") return `Dan ${label} walata cards pennanawa.`;
      if (language === "Singlish") return `Dan ${label} walata cards pennanawa.`;
      return `Now I will suggest ${label}.`;
    }

    if (language === "Sinhala") return `දැන් ${item} සඳහා cards පෙන්වනවා.`;
    if (language === "Singlish") return `Dan ${item} walata cards pennanawa.`;
    return `Now I will suggest ${item}.`;
  }

  function getImageSearchReply(data: ImageResponse) {
    const imageSummary = data.summary?.trim();

    if (data.fallback) {
      return text.relatedGiftsReply;
    }

    return imageSummary
      ? `${text.imageLooksLike} ${imageSummary}. ${text.relatedGiftsReply}`
      : text.relatedGiftsReply;
  }

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setGiftMessagePreferences((current) => ({
      ...current,
      language: nextLanguage,
    }));
    setCheckoutWarning((current) =>
      current ? getEmptyCartWarning(nextLanguage) : current,
    );
    setMessages((current) => {
      const starterContent = new Set(
        Object.values(starterMessagesByLanguage).map(
          ([message]) => message.content,
        ),
      );
      const modeIntroContent = new Set(
        languageOptions.flatMap((option) =>
          modes.map((mode) => getModeIntroMessage(mode.name, option)),
        ),
      );

      if (
        current.length === 1 &&
        current[0].role === "assistant" &&
        starterContent.has(current[0].content)
      ) {
        return starterMessagesByLanguage[nextLanguage];
      }

      if (
        current.length === 1 &&
        current[0].role === "assistant" &&
        modeIntroContent.has(current[0].content)
      ) {
        return [
          {
            ...current[0],
            content: getModeIntroMessage(activeMode, nextLanguage),
          },
        ];
      }

      return current;
    });
  }

  function renderInlineText(value: string) {
    return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }

      return <span key={index}>{part}</span>;
    });
  }

  function renderChatMessage(content: string) {
    const cleanedContent = stripModelThinking(content);
    const lines = cleanedContent
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return null;
    }

    const cellsFromRow = (line: string) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
    const elements: ReactNode[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const nextLine = lines[index + 1];
      const isTableStart =
        line.includes("|") && Boolean(nextLine?.match(/^\|?[\s:-]+\|[\s|:-]+$/));

      if (isTableStart) {
        const headers = cellsFromRow(line);
        const rows: string[][] = [];
        index += 2;

        while (index < lines.length && lines[index].includes("|")) {
          rows.push(cellsFromRow(lines[index]));
          index += 1;
        }

        index -= 1;
        elements.push(
          <div key={`table-${index}`} className="max-w-full overflow-x-auto rounded-xl border border-[#D7E2EF] bg-white">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="bg-[#E7EEF7] text-[#0B2748]">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="border-b border-[#D7E2EF] px-3 py-2 font-bold break-words [overflow-wrap:anywhere]">
                      {renderInlineText(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`} className="border-b border-[#E4E1D8] px-3 py-2 align-top break-words [overflow-wrap:anywhere]">
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);

      if (bulletMatch || numberedMatch) {
        elements.push(
          <div key={`${line}-${index}`} className="flex min-w-0 gap-2 break-words [overflow-wrap:anywhere]">
            <span className="mt-[0.55rem] h-1.5 w-1.5 flex-none rounded-full bg-current opacity-60" />
            <span>{renderInlineText(bulletMatch?.[1] ?? numberedMatch?.[1] ?? line)}</span>
          </div>,
        );
      } else {
        elements.push(
          <p key={`${line}-${index}`} className="break-words [overflow-wrap:anywhere]">
            {renderInlineText(line)}
          </p>,
        );
      }
    }

    return <div className="grid min-w-0 gap-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{elements}</div>;
  }

  function renderCompareTool() {
    const firstCompareRow = compareRows[0];
    const secondCompareRow = compareRows[1];
    const productOne = firstCompareRow?.product;
    const productTwo = secondCompareRow?.product;
    const renderInsights = (insights: ComparisonInsight[]) => (
      <div className="grid gap-2.5">
        {insights.slice(0, 4).map((insight) => (
          <div key={insight.label} className="grid gap-1.5 rounded-lg bg-[#FAF7F1] p-2.5">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#31577F]">
              <span>{insight.label}</span>
              <span className="font-bold text-[#B3872F]">{insight.percentage}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#D7E2EF]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#1E4D8C,#C89B3C)]"
                style={{ width: `${insight.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
    const criteriaRows: Array<[string, ReactNode, ReactNode]> = productOne && productTwo
      ? [
          ["Name", productOne.name, productTwo.name],
          [
            "Price",
            formatPrice(productOne.price, productOne.currency),
            formatPrice(productTwo.price, productTwo.currency),
          ],
          ["Description", productOne.description, productTwo.description],
          [
            "AI insights",
            renderInsights(firstCompareRow?.insights ?? []),
            renderInsights(secondCompareRow?.insights ?? []),
          ],
        ]
      : [];

    return (
      <div className="grid gap-3">
        <div className="rounded-2xl bg-[#0B2748] px-5 py-4 shadow-[0_12px_30px_-20px_rgba(10,31,58,.6)]">
          <div>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Product Compare
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#AFC8E5]">
              Select two products from Smart Shopping to compare them here.
            </p>
          </div>
        </div>

        {(!productOne || !productTwo) && compareSuggestion ? (
          <div className="rounded-xl border border-[#E6D5A7] bg-[#FFF8E7] p-4 text-sm leading-6 text-[#5B6B7A]">
            {compareSuggestion}
          </div>
        ) : null}

        {productOne && productTwo ? (
          <div className="overflow-hidden rounded-2xl border border-[#D7E2EF] bg-white shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]">
            <div
              ref={compareTableTopScrollRef}
              className="overflow-x-scroll border-b border-[#D7E2EF] md:hidden"
              onScroll={(event) => {
                if (compareTableBottomScrollRef.current) {
                  compareTableBottomScrollRef.current.scrollLeft =
                    event.currentTarget.scrollLeft;
                }
              }}
            >
              <div className="h-4 min-w-[720px]" />
            </div>
            <div
              ref={compareTableBottomScrollRef}
              className="overflow-x-scroll pb-2"
              onScroll={(event) => {
                if (compareTableTopScrollRef.current) {
                  compareTableTopScrollRef.current.scrollLeft =
                    event.currentTarget.scrollLeft;
                }
              }}
            >
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-[#E7EEF7] text-[#0B2748]">
                  <tr>
                    <th className="w-[22%] p-3 text-xs font-bold uppercase tracking-wide">Criteria</th>
                    <th className="w-[39%] p-3 font-semibold">Product 1</th>
                    <th className="w-[39%] p-3 font-semibold">Product 2</th>
                  </tr>
                </thead>
                <tbody>
                  {criteriaRows.map(([criteria, first, second]) => (
                    <tr key={criteria} className="border-t border-[#D7E2EF]">
                      <td className="bg-[#FAF7F1] p-3 align-top text-xs font-bold uppercase tracking-wide text-[#31577F]">
                        {criteria}
                      </td>
                      <td className="p-3 align-top leading-6 text-[#16202B]">
                        {first}
                      </td>
                      <td className="p-3 align-top leading-6 text-[#16202B]">
                        {second}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderGiftMessageTool() {
    const tabs = (
      <div className="relative grid h-11 w-full grid-cols-2 border-b-2 border-[#DCE2E8] bg-transparent" role="tablist" aria-label="Gift creation tools">
        <span aria-hidden="true" className={`pointer-events-none absolute -bottom-0.5 left-0 h-0.5 w-1/2 bg-[#D6A936] transition-transform duration-300 ease-out ${giftMessageToolTab === "card" ? "translate-x-full" : "translate-x-0"}`} />
        <button type="button" role="tab" aria-selected={giftMessageToolTab === "message"} onClick={() => setGiftMessageToolTab("message")} className={`relative min-w-0 text-sm font-medium transition-colors duration-200 ${giftMessageToolTab === "message" ? "text-[#16202B]" : "text-[#6C7C8C] hover:text-[#31577F]"}`}>Message</button>
        <button type="button" role="tab" aria-selected={giftMessageToolTab === "card"} onClick={() => {
          setGiftCardPreferences((current) => ({
            ...current,
            language,
            occasion: profile.occasion || current.occasion,
            recipient: profile.recipient || current.recipient,
            receiverName: checkoutDetails.recipientName || current.receiverName || "",
            senderName: checkoutDetails.senderName || current.senderName || "",
          }));
          setGiftMessageToolTab("card");
        }} className={`relative min-w-0 text-sm font-medium transition-colors duration-200 ${giftMessageToolTab === "card" ? "text-[#16202B]" : "text-[#6C7C8C] hover:text-[#31577F]"}`}>Gift Card</button>
      </div>
    );

    if (giftMessageToolTab === "card") {
      return (
        <div className="flex min-h-0 flex-col gap-3 lg:h-full">
          {tabs}
          <div className="min-h-0 flex-1">
            <GiftCardTool
              analysis={giftCardAnalysis}
              generatedImage={giftCardImage}
              generating={isGiftCardGenerating}
              languageLabels={languageLabels}
              languageOptions={languageOptions}
              message={giftCardMessage}
              onPreferences={setGiftCardPreferences}
              onProduct={setGiftCardProductId}
              onSubmit={(event) => void handleGiftCardSubmit(event)}
              palette={giftCardPalette}
              preferences={giftCardPreferences}
              products={buyBox}
              selectedProductId={giftCardProductId}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-col gap-3 lg:h-full">
        {tabs}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <section className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-[#D7E2EF] bg-white shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]">
          <div className="bg-[#0B2748] px-5 py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#D6A936]">Personal note</p><h2 className="mt-1 text-xl font-semibold text-white">Gift Message</h2></div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-[#FAF7F1] p-4"><label className="mb-2 text-xs font-semibold text-[#5B6B7A]" htmlFor="gift-message-editor">Your message</label><textarea id="gift-message-editor" value={giftMessage} onChange={(event) => setGiftMessage(event.target.value)} className="min-h-[210px] w-full flex-1 resize-none rounded-xl border border-[#D7E2EF] bg-white p-4 text-base leading-7 text-[#16202B] outline-none transition focus:border-[#3D74B8]" placeholder="Your generated gift message will appear here…" /></div>
        </section>

        <form
          onSubmit={(event) => void handleGiftMessageSubmit(event)}
          className="grid content-start gap-3 rounded-2xl border border-[#D7E2EF] bg-white p-4 shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]"
        >
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B3872F]">Customize</p><h3 className="mt-1 text-base font-semibold text-[#0B2748]">Message preferences</h3></div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
              Language
              <select
                value={giftMessagePreferences.language}
                onChange={(event) =>
                  setGiftMessagePreferences((current) => ({
                    ...current,
                    language: event.target.value as Language,
                  }))
                }
                className="h-10 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              >
                {languageOptions.map((option) => (
                  <option key={option} value={option}>
                    {languageLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
              Size
              <select
                value={giftMessagePreferences.size}
                onChange={(event) =>
                  setGiftMessagePreferences((current) => ({
                    ...current,
                    size: event.target.value,
                  }))
                }
                className="h-10 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              >
                <option>Short</option>
                <option>Medium</option>
                <option>Long</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
              Tone
              <select
                value={giftMessagePreferences.tone}
                onChange={(event) =>
                  setGiftMessagePreferences((current) => ({
                    ...current,
                    tone: event.target.value,
                  }))
                }
                className="h-10 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              >
                <option>Warm</option>
                <option>Romantic</option>
                <option>Respectful</option>
                <option>Funny</option>
                <option>Formal</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
            Suggestions
            <textarea
              value={giftMessagePreferences.suggestions}
              onChange={(event) =>
                setGiftMessagePreferences((current) => ({
                  ...current,
                  suggestions: event.target.value,
                }))
              }
              rows={3}
              className="resize-none rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 py-2 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              placeholder="Example: make it romantic, mention birthday, keep it simple..."
            />
          </label>
          <button
            type="submit"
            disabled={isGiftMessageGenerating}
            className="h-10 rounded-[10px] bg-[#0B2748] px-5 text-sm font-semibold text-white transition hover:bg-[#123661] disabled:opacity-50"
          >
            {isGiftMessageGenerating ? "Updating..." : "Update message"}
          </button>
        </form>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!isSending) {
      return;
    }

    const messagesForLanguage = rotatingActivityMessages[language];
    let nextMessageIndex = 0;
    const intervalId = window.setInterval(() => {
      setActivityMessage(messagesForLanguage[nextMessageIndex]);
      nextMessageIndex = (nextMessageIndex + 1) % messagesForLanguage.length;
    }, 1800);

    return () => window.clearInterval(intervalId);
  }, [isSending, language]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const container = chatScrollContainerRef.current;
      const messageElements = container?.querySelectorAll<HTMLElement>(
        '[data-chat-message="true"]',
      );
      const latestMessage = messageElements?.item(messageElements.length - 1);

      if (!container || !latestMessage) {
        return;
      }

      container.scrollTo({
        behavior: "smooth",
        top: latestMessage.offsetTop - container.offsetTop - 8,
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [messages]);

  useEffect(() => {
    const today = getLocalDateString();

    try {
      if (localStorage.getItem(INTRO_PANEL_STORAGE_KEY) === today) {
        return;
      }
    } catch {
      // If storage is unavailable, still show the welcome sheet for this load.
    }

    const showTimer = window.setTimeout(() => {
      setIsIntroPanelVisible(true);

      try {
        localStorage.setItem(INTRO_PANEL_STORAGE_KEY, today);
      } catch {
        // Ignore private browsing or storage quota errors.
      }
    }, 3000);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restoreChatState() {
      try {
        const storedState = await readStoredChatState();

        if (!isMounted) {
          return;
        }

        if (storedState) {
          const storedMode = storedState.activeMode ?? "Smart Shopping";
          const restoredMode = storedMode === "Gift Card" ? "Gift Message" : storedMode;
          const restoredSessions = normalizeModeSessions(
            storedState.modeSessions ?? {},
          );
          const restoredSession =
            restoredSessions[restoredMode] ?? {
              chips: storedState.chips,
              contextDraft: storedState.contextDraft,
              conversationStage: storedState.conversationStage,
              extendedPreferences: normalizeExtendedPreferences(
                storedState.extendedPreferences,
                storedState.profile,
              ),
              fitReasons: storedState.fitReasons ?? {},
              guidedPlanIndex: storedState.guidedPlanIndex ?? 0,
              guidedPlanItems: storedState.guidedPlanItems ?? [],
              input: storedState.input,
              messages: storedState.messages,
              pendingUserRequest: storedState.pendingUserRequest,
              profile: normalizeShoppingProfile(storedState.profile),
              productBatchIndex: storedState.productBatchIndex ?? 0,
              recommendedProducts: storedState.recommendedProducts ?? [],
            };
          const shouldUseFreshStarterChips =
            restoredSession.conversationStage === "first-message" &&
            !restoredSession.messages.some((message) => message.role === "user");
          const restoredSessionWithFreshChips = shouldUseFreshStarterChips
            ? {
                ...restoredSession,
                chips: starterChips,
              }
            : restoredSession;
          const shouldRefreshInitialCatalog =
            restoredMode === "Smart Shopping" &&
            storedState.initialCatalogVersion !== INITIAL_CATALOG_VERSION;
          const sessionToApply = shouldRefreshInitialCatalog
            ? {
                ...restoredSessionWithFreshChips,
                fitReasons: {},
                productBatchIndex: 0,
                recommendedProducts: [],
              }
            : restoredSessionWithFreshChips;
          const nextRestoredSessions = shouldRefreshInitialCatalog
            ? {
                ...restoredSessions,
                "Smart Shopping": sessionToApply,
              }
            : restoredSessions;

          setActiveMode(restoredMode);
          if (storedMode === "Gift Card") setGiftMessageToolTab("card");
          setLanguage(storedState.language);
          setModeSessions(nextRestoredSessions);
          setBuyBox(storedState.buyBox ?? []);
          if (storedState.giftCardPreferences) {
            setGiftCardPreferences((current) => ({
              ...current,
              ...storedState.giftCardPreferences,
              receiverName: storedState.giftCardPreferences?.receiverName ?? "",
              senderName: storedState.giftCardPreferences?.senderName ?? "",
            }));
          }
          setGiftCardProductId(storedState.giftCardProductId ?? "");
          setGiftCardImage(storedState.giftCardImage ?? "");
          setGiftCardMessage(storedState.giftCardMessage ?? "");
          setGiftCardAnalysis(storedState.giftCardAnalysis ?? "");
          setGiftCardPalette(storedState.giftCardPalette ?? []);
          applyModeSession(sessionToApply);
        }
      } catch (error) {
        if (isMounted) {
          setStatus(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsChatStateLoaded(true);
        }
      }
    }

    void restoreChatState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isChatStateLoaded) {
      return;
    }

    void writeStoredChatState({
      activeMode,
      chips,
      contextDraft,
      conversationStage,
      extendedPreferences,
      fitReasons,
      guidedPlanIndex,
      guidedPlanItems,
      giftCardAnalysis,
      giftCardImage,
      giftCardMessage,
      giftCardPalette,
      giftCardPreferences,
      giftCardProductId,
      input,
      initialCatalogVersion: INITIAL_CATALOG_VERSION,
      language,
      messages,
      buyBox,
      profile,
      productBatchIndex,
      recommendedProducts,
      modeSessions: {
        ...modeSessions,
        [activeMode]: {
          chips,
          contextDraft,
          conversationStage,
          extendedPreferences,
          fitReasons,
          guidedPlanIndex,
          guidedPlanItems,
          input,
          messages,
          pendingUserRequest,
          profile,
          productBatchIndex,
          recommendedProducts,
        },
      },
      pendingUserRequest,
    });
  }, [
    activeMode,
    chips,
    contextDraft,
    conversationStage,
    extendedPreferences,
    fitReasons,
    guidedPlanIndex,
    guidedPlanItems,
    giftCardAnalysis,
    giftCardImage,
    giftCardMessage,
    giftCardPalette,
    giftCardPreferences,
    giftCardProductId,
    input,
    isChatStateLoaded,
    language,
    messages,
    buyBox,
    modeSessions,
    pendingUserRequest,
    profile,
    productBatchIndex,
    recommendedProducts,
  ]);

  useEffect(() => {
    if (!isChatStateLoaded) {
      return;
    }

    if (initialProductsLoadedRef.current) {
      return;
    }

    if (recommendedProducts.length > 0) {
      initialProductsLoadedRef.current = true;
      window.setTimeout(() => setIsLoadingInitialProducts(false), 0);
      return;
    }

    initialProductsLoadedRef.current = true;
    let isMounted = true;

    async function loadInitialProducts() {
      const maxAttempts = 3;

      async function requestInitialProducts(attempt: number) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 7000);

        try {
          const response = await fetch("/api/ai/commerce", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cartIds: [],
              mode: "Smart Shopping",
              profile: normalizeShoppingProfile(initialShoppingProfile),
              query: "gift",
              task: "initial",
            }),
            signal: controller.signal,
          });
          const data = (await response.json()) as CommerceResponse & {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(data.error ?? "Live product load failed.");
          }

          if (!data.products || data.products.length === 0) {
            throw new Error(
              `The live catalog returned no starter products on attempt ${attempt}.`,
            );
          }

          return data;
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      try {
        let data: (CommerceResponse & { error?: string }) | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          if (!isMounted) {
            return;
          }

          setStatus(
            attempt === 1
              ? "The live catalog is loading starter products."
              : `The live catalog returned empty/error. Retrying ${attempt}/${maxAttempts}.`,
          );

          try {
            data = await requestInitialProducts(attempt);
            break;
          } catch (error) {
            if (attempt === maxAttempts) {
              throw error;
            }
          }
        }

        if (!isMounted || !data) {
          return;
        }

        if (data.products && data.products.length > 0) {
          setRecommendedProducts(data.products.slice(0, MAX_RANKED_PRODUCTS));
          setProductBatchIndex(0);
        }

        if (data.recommendations) {
          setFitReasons(
            data.recommendations.reduce<Record<string, string>>(
              (nextReasons, recommendation) => {
                nextReasons[recommendation.id] =
                  `${recommendation.fitScore}% - ${recommendation.reason}`;
                return nextReasons;
              },
              {},
            ),
          );
        }

        if (data.delivery?.rate !== undefined) {
          setDeliveryFee(data.delivery.rate);
        }

        if (data.analytics) {
          setAnalytics((current) => ({
            buyBoxHealth: data.analytics?.buyBoxHealth ?? current.buyBoxHealth,
            conversionSignal:
              data.analytics?.conversionSignal ?? current.conversionSignal,
            nextBestAction:
              data.analytics?.nextBestAction ?? current.nextBestAction,
            risk: data.analytics?.risk ?? current.risk,
          }));
        }

        setStatus("GenieAI products ready.");
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof DOMException && error.name === "AbortError"
              ? "Live products timed out after automatic retries."
              : getErrorMessage(error);
          setStatus(message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingInitialProducts(false);
        }
      }
    }

    void loadInitialProducts();

    return () => {
      isMounted = false;
    };
  }, [isChatStateLoaded, recommendedProducts.length]);

  function addMessage(message: ChatMessage) {
    if (message.role === "assistant") {
      playChatSound("receive");
    }
    setMessages((current) => [...current, message]);
  }

  function appendAssistantMessage(content: string) {
    if (!content.trim()) {
      return;
    }

    addMessage({
      role: "assistant",
      content,
    });
  }

  function markReplyGeneratedForCount(replyCount: number) {
    setExtendedPreferences((current) =>
      replyCount > current.lastRepliedCount
        ? { ...current, lastRepliedCount: replyCount }
        : current,
    );
  }

  function appendAssistantMessageForReplyCount(
    content: string,
    replyPreferences = extendedPreferences,
  ) {
    if (!content.trim()) {
      return;
    }

    if (
      replyPreferences.replyCount > 0 &&
      replyPreferences.replyCount <= replyPreferences.lastRepliedCount
    ) {
      return;
    }

    appendAssistantMessage(content);
    if (replyPreferences.replyCount > 0) {
      markReplyGeneratedForCount(replyPreferences.replyCount);
    }
  }

  function playChatSound(type: "receive" | "send") {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    try {
      const context =
        chatSoundContextRef.current ?? new AudioContextCtor();

      chatSoundContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime;
      const duration = type === "send" ? 0.08 : 0.12;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        type === "send" ? 660 : 520,
        startAt,
      );
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.03, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + duration,
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    } catch {
      // Ignore audio playback failures so chat flow stays uninterrupted.
    }
  }

  function updateSelectedPreference(
    field: "budget" | "category" | "occasion" | "recipient",
    value: string,
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
    const extendedField = field === "category" ? "giftType" : field;
    setExtendedPreferences((current) =>
      applyExtendedPreferenceUpdates(current, {
        [extendedField]: value,
      }),
    );
  }

  function validateSidebarBudgetDraft() {
    const minValue = sidebarBudgetMin.trim();
    const maxValue = sidebarBudgetMax.trim();
    const allowedPattern = /^[\d,\s]*$/;

    if (minValue && !allowedPattern.test(minValue)) {
      return { budget: "", error: "Min price can only contain numbers." };
    }

    if (maxValue && !allowedPattern.test(maxValue)) {
      return { budget: "", error: "Max price can only contain numbers." };
    }

    const normalizedMin = parseBudgetAmount(minValue);
    const normalizedMax = parseBudgetAmount(maxValue);

    if (minValue && !normalizedMin) {
      return { budget: "", error: "Enter a valid minimum price." };
    }

    if (maxValue && !normalizedMax) {
      return { budget: "", error: "Enter a valid maximum price." };
    }

    if (
      normalizedMin &&
      normalizedMax &&
      Number(normalizedMin) > Number(normalizedMax)
    ) {
      return {
        budget: "",
        error: "Minimum price cannot be greater than maximum price.",
      };
    }

    return {
      budget: buildBudgetRangeValue(normalizedMin, normalizedMax),
      error: "",
    };
  }

  function addToBuyBox(product: Product) {
    setCheckoutWarning("");
    if (!buyBox.some((item) => item.id === product.id)) {
      trackProductInteraction("add_to_cart", product);
    }
    setBuyBox((current) =>
      current.some((item) => item.id === product.id)
        ? current
        : [...current, product],
    );
  }

  function removeFromBuyBox(productId: string) {
    const product = buyBox.find((item) => item.id === productId);
    if (product) {
      trackProductInteraction("remove_from_cart", product);
    }
    setBuyBox((current) => current.filter((item) => item.id !== productId));
    if (giftCardProductId === productId) {
      setGiftCardProductId("");
    }
  }

  function trackProductInteraction(
    event: PersonalizationEventType,
    product: Product,
  ) {
    const position = visibleProducts.findIndex(
      (visibleProduct) => visibleProduct.id === product.id,
    );

    void trackPersonalizationEvent({
      category: product.category,
      event,
      position:
        position >= 0
          ? productBatchIndex * PRODUCT_BATCH_SIZE + position + 1
          : undefined,
      price: product.price,
      productId: product.id,
      query: latestUserQuery,
    });
  }

  function viewProduct(product: Product) {
    trackProductInteraction("view", product);
    setSelectedProduct(product);
  }

  function applyCommerceResponse(
    data: CommerceResponse,
    applyPreferenceUpdates = false,
  ) {
    const responsePreferences = getResponsePreferenceForMode(activeMode, data);
    if (data.products) {
      setRecommendedProducts(data.products.slice(0, MAX_RANKED_PRODUCTS));
      setProductBatchIndex(0);
    }

    if (data.recommendations) {
      setFitReasons(
        data.recommendations.reduce<Record<string, string>>(
          (nextReasons, recommendation) => {
            nextReasons[recommendation.id] = `${recommendation.fitScore}% - ${recommendation.reason}`;
            return nextReasons;
          },
          {},
        ),
      );
    }

    if (data.chips) {
      setChips(data.chips);
    }

    if (data.analytics) {
      setAnalytics({
        buyBoxHealth: data.analytics.buyBoxHealth ?? analytics.buyBoxHealth,
        conversionSignal:
          data.analytics.conversionSignal ?? analytics.conversionSignal,
        nextBestAction:
          data.analytics.nextBestAction ?? analytics.nextBestAction,
        risk: data.analytics.risk ?? analytics.risk,
      });
    }

    if (data.delivery?.rate !== undefined) {
      setDeliveryFee(data.delivery.rate);
    }

    if (data.checkout?.checkout_url) {
      setCheckoutUrl(data.checkout.checkout_url);
    }

    if (data.giftMessage) {
      setGiftMessage(data.giftMessage);
    }

    if (applyPreferenceUpdates && data.preferences) {
      const nextPreferences = data.preferences;
      const profileUpdates = {
        budget: nextPreferences.budget,
        category: nextPreferences.category,
        occasion: nextPreferences.occasion,
        recipient: nextPreferences.recipient,
      };

      setProfile((current) => ({
        ...current,
        ...profileUpdates,
      }));
      setExtendedPreferences((current) =>
        mergeExtendedPreferencesWithProfile(
          current,
          profileUpdates,
          responsePreferences,
        ),
      );
    } else if (responsePreferences) {
      const { budget, giftType, occasion, recipient } = responsePreferences;
      setExtendedPreferences((current) =>
        applyExtendedPreferenceUpdates(current, {
          budget,
          giftType,
          occasion,
          recipient,
        }),
      );
    }

  }

  async function runCommerce(
    query: string,
    mode = activeMode,
    profileOverride = profile,
    applyPreferenceUpdates = true,
    userMessage = query,
    preserveProfile = false,
    extendedPreferencesOverride = extendedPreferences,
    taskOverride?: string,
  ) {
    const requestProfile = normalizeShoppingProfile(profileOverride);
    const requestTask = taskOverride ?? getTaskForMode(mode);
    const pendingEvents = requestTask === "recommend" ? getPendingEvents() : [];
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 28000);
    const requestBody = JSON.stringify({
      cartIds: buyBox.map((product) => product.id),
      conversationHistory: messages
        .filter(
          (message) =>
            message.role === "user" || message.role === "assistant",
        )
        .slice(-3)
        .map(({ content, role }) => ({ content, role })),
      events: pendingEvents,
      language,
      mode,
      profile: requestProfile,
      preserveProfile,
      query,
      task: requestTask,
      userMessage,
      ...getPreferencePayloadForMode(mode, extendedPreferencesOverride),
    });

    try {
      while (true) {
        let response: Response;

        try {
          response = await fetch("/api/ai/commerce", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: requestBody,
            signal: controller.signal,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("The request timed out. Please try again.");
          }

          throw error;
        }

        let data: (CommerceResponse & { error?: string }) | null = null;
        try {
          data = (await response.json()) as CommerceResponse & { error?: string };
        } catch {
          // Retry empty HTTP bodies until a valid response arrives or the
          // existing request deadline turns this into a visible timeout.
        }

        const errorMessage = data?.error ?? "";
        const isEmptyResponse =
          !data ||
          Object.keys(data).length === 0 ||
          /empty(?:\s+\w+)*\s+response/i.test(errorMessage);

        if (isEmptyResponse) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          continue;
        }

        if (!data) {
          continue;
        }

        if (!response.ok) {
          throw new Error(errorMessage || "Commerce request failed.");
        }

        if (
          applyPreferenceUpdates &&
          !stripModelThinking(data.reply ?? "").trim()
        ) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          continue;
        }

        applyCommerceResponse(data, applyPreferenceUpdates);
        if (requestTask === "recommend") {
          clearPendingEvents(pendingEvents);
        }
        return data;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function runGuidedItemCommerce(
    query: string,
    planItems = guidedPlanItems,
    profileOverride = profile,
    preferencesOverride = extendedPreferences,
    draft = contextDraft,
  ) {
    const itemCount = activeMode.includes("Gift Box")
      ? getGiftBoxItemCount(draft)
      : planItems.length;
    const itemBudget = divideBudgetAcrossItems(
      preferencesOverride.budget || profileOverride.budget,
      itemCount,
    );
    const itemSearchTerm = query.trim();

    return runCommerce(
      itemSearchTerm,
      activeMode,
      {
        ...profileOverride,
        budget: itemBudget,
        category: itemSearchTerm,
      },
      false,
      itemSearchTerm,
      true,
      {
        ...preferencesOverride,
        budget: itemBudget,
        giftType: itemSearchTerm,
      },
      "recommend",
    );
  }

  function getContextDraftFromProfile(nextProfile: ShoppingProfile) {
    return {
      ...emptyContextDraft,
      budget: nextProfile.budget,
      category: nextProfile.category,
      occasion: nextProfile.occasion,
      recipient: nextProfile.recipient,
    };
  }

  function getContextQuestion(field: ContextField) {
    const overriddenQuestion = contextQuestionOverrides[language][field];

    if (overriddenQuestion) {
      return overriddenQuestion;
    }

    if (field === "category") {
      return contextQuestions[language][field] ?? giftTypeMessages[language];
    }

    return (
      contextQuestions[language][field] ??
      contextQuestions.English[field] ??
      contextFieldLabels[field]
    );
  }

  function mergeContextDraft(
    baseProfile: ShoppingProfile,
    draft: ContextDraft,
  ): ShoppingProfile {
    return {
      ...baseProfile,
      budget: draft.budget || baseProfile.budget,
      category:
        draft.category || draft.giftBoxTheme || draft.eventType || baseProfile.category,
      occasion: draft.occasion || draft.eventType || baseProfile.occasion,
      recipient: draft.recipient || draft.boxRecipient || baseProfile.recipient,
    };
  }

  function buildContextSummary(draft: ContextDraft) {
    const selectedContext = getContextFieldsForMode(activeMode)
      .map((field) => {
        const value = draft[field].trim();
        return value
          ? `${getContextFieldLabel(field)}: ${getOptionLabel(value)}`
          : null;
      })
      .filter((item): item is string => item !== null);

    return selectedContext.length > 0
      ? `Context selected: ${selectedContext.join(", ")}`
      : "Continue without context";
  }

  function getPreferenceDraftFromProfile(nextProfile: ShoppingProfile): ContextDraft {
    return getContextDraftFromProfile(nextProfile);
  }

  function buildPreferenceMessage(nextProfile: ShoppingProfile) {
    return buildContextSummary(getPreferenceDraftFromProfile(nextProfile));
  }

  async function analyzeFirstMessage(content: string) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 28000);
    const requestBody = JSON.stringify({
      context: {
        budget: profile.budget || null,
        category: profile.category || null,
        occasion: profile.occasion || null,
        recipient: profile.recipient || null,
      },
      message: content,
      selectedLanguage: language,
    });

    try {
      while (true) {
        let response: Response;
        try {
          response = await fetch("/api/ai/context-analysis", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: requestBody,
            signal: controller.signal,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("The request timed out. Please try again.");
          }

          throw error;
        }

        let data: ContextAnalysisResponse | null = null;
        try {
          data = (await response.json()) as ContextAnalysisResponse;
        } catch {
          // Retry an empty body within the same overall request deadline.
        }

        const errorMessage = data?.error ?? "";
        if (
          !data ||
          Object.keys(data).length === 0 ||
          /empty(?:\s+\w+)*\s+(?:analysis|response)/i.test(errorMessage)
        ) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          continue;
        }

        if (!data) {
          continue;
        }

        if (!response.ok) {
          throw new Error(errorMessage || "Groq context analysis failed.");
        }

        return data;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function showContextPanel(
    nextProfile: ShoppingProfile,
    detectedLanguage = language,
  ) {
    setConversationStage("collecting-context");
    setContextDraft(getContextDraftFromProfile(nextProfile));
    setChips([]);
    addMessage({
      role: "assistant",
      content: getModeIntroMessage(activeMode, detectedLanguage),
      variant: "context-panel",
    });
    setStatus("Choose context chips or continue without context.");
  }

  async function answerWithCollectedContext(
    request: string,
    requestProfile: ShoppingProfile,
    requestDraft = contextDraft,
    requestExtendedPreferences = extendedPreferences,
  ) {
    setConversationStage("ready");
    setChips(starterChips);
    setStatus(
      "Groq is answering with the collected context. The live catalog is searching products.",
    );
    const commerceData = await runCommerce(
      `${request}\n${buildContextSummary(requestDraft)}\nBudget: ${requestProfile.budget}\nRecipient: ${requestProfile.recipient}\nOccasion: ${requestProfile.occasion}\nGift type: ${requestProfile.category}`,
      activeMode,
      requestProfile,
      true,
      request,
      true,
      requestExtendedPreferences,
    );

    if (activeMode.includes("Event") || activeMode.includes("Gift Box")) {
      const planItems = normalizeGuidedPlanItems(
        commerceData.eventPlan ?? [],
        activeMode,
        requestDraft,
      );
      const firstItem = planItems[0] ?? "gift";

      setGuidedPlanItems(planItems);
      setGuidedPlanIndex(0);
      await runGuidedItemCommerce(
        getPlanSearchTerm(firstItem),
        planItems,
        requestProfile,
        requestExtendedPreferences,
        requestDraft,
      );
      appendAssistantMessage(getGuidedPlanReply(planItems, 0, language));
      setChips(getGuidedReplyChips());
      setStatus("Guided suggestions ready.");
      return;
    }

    appendAssistantMessageForReplyCount(
      getCommerceReply(commerceData),
      requestExtendedPreferences,
    );
    setStatus("Groq reply complete. GenieAI commerce panels updated.");
  }

  async function handleFirstMessage(content: string) {
    setStatus("Groq is analyzing budget, recipient, and occasion.");
    let nextProfile: ShoppingProfile = profile;

    try {
      const analysis = await analyzeFirstMessage(content);
      nextProfile = {
        ...profile,
        budget: analysis.budget ?? profile.budget,
        category: analysis.category ?? profile.category,
        occasion: analysis.occasion ?? profile.occasion,
        recipient: analysis.recipient ?? profile.recipient,
      };
    } catch (error) {
      if (getRetryableFailureType(error)) {
        throw error;
      }

      setStatus(`${getErrorMessage(error)} Choose context manually.`);
    }

    setPendingUserRequest(content);
    if (activeMode.includes("Event") || activeMode.includes("Gift Box")) {
      const nextDraft = getContextDraftFromProfile(nextProfile);
      setProfile(nextProfile);
      setExtendedPreferences((current) =>
        syncExtendedPreferencesWithProfile(current, nextProfile),
      );
      setContextDraft(nextDraft);
      await answerWithCollectedContext(
        content,
        nextProfile,
        nextDraft,
        syncExtendedPreferencesWithProfile(extendedPreferences, nextProfile),
      );
      return;
    }

    const hasDetectedShoppingPreferences = Boolean(
      nextProfile.budget ||
        nextProfile.category ||
        nextProfile.occasion ||
        nextProfile.recipient,
    );

    if (hasDetectedShoppingPreferences) {
      setProfile(nextProfile);
      const nextExtendedPreferences = syncExtendedPreferencesWithProfile(
        extendedPreferences,
        nextProfile,
      );
      setExtendedPreferences(nextExtendedPreferences);
      await handleReadyMessage(
        content,
        nextProfile,
        nextExtendedPreferences,
        true,
      );
      return;
    }

    showContextPanel(nextProfile, language);
  }

  function selectContextOption(field: ContextField, value: string) {
    if (conversationStage !== "collecting-context" || isSending) {
      return;
    }

    setContextDraft((current) => ({
      ...current,
      [field]: current[field] === value ? "" : value,
    }));
  }

  async function submitContextPanel(useSelectedContext: boolean) {
    if (conversationStage !== "collecting-context" || isSending) {
      return;
    }

    const nextProfile = useSelectedContext
      ? mergeContextDraft(profile, contextDraft)
      : profile;
    const contextMessage = useSelectedContext
      ? buildContextSummary(contextDraft)
      : "Continue without context";
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: contextMessage },
    ];

    setProfile(nextProfile);
    const nextExtendedPreferences = syncExtendedPreferencesWithProfile(
      extendedPreferences,
      nextProfile,
    );
    setExtendedPreferences(nextExtendedPreferences);
    setMessages(nextMessages);
    setIsSending(true);
    setActivityMessage(text.processing);

    try {
      await answerWithCollectedContext(
        pendingUserRequest || contextMessage,
        nextProfile,
        contextDraft,
        nextExtendedPreferences,
      );
    } catch (error) {
      if (
        !addRetryFailure(
          error,
          pendingUserRequest || contextMessage,
          true,
        )
      ) {
        setStatus(getErrorMessage(error));
      }
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  async function handleReadyMessage(
    content: string,
    profileOverride = profile,
    extendedPreferencesOverride = extendedPreferences,
    enforceReplyCount = false,
    modeOverride = activeMode,
  ) {
    setStatus("Groq is answering. The live catalog is searching products.");
    const commerceData = await runCommerce(
      content,
      modeOverride,
      profileOverride,
      true,
      content,
      false,
      extendedPreferencesOverride,
    );

    if (enforceReplyCount) {
      appendAssistantMessageForReplyCount(
        getCommerceReply(commerceData),
        extendedPreferencesOverride,
      );
    } else {
      appendAssistantMessage(getCommerceReply(commerceData));
    }
    setStatus("Groq chat complete. GenieAI commerce panels updated.");
  }

  async function handleSidebarPreferenceSubmit() {
    if (isSending) {
      return;
    }

    const validatedBudget = validateSidebarBudgetDraft();
    if (validatedBudget.error) {
      setSidebarBudgetError(validatedBudget.error);
      return;
    }

    setSidebarBudgetError("");
    const nextProfile = {
      ...profile,
      budget: validatedBudget.budget,
    };
    const nextExtendedPreferences = syncExtendedPreferencesWithProfile(
      extendedPreferences,
      nextProfile,
    );
    const preferenceMessage = buildPreferenceMessage(nextProfile);
    if (preferenceMessage === "Continue without context") {
      setStatus("Choose at least one preference before sending.");
      return;
    }

    const shoppingMode = "Smart Shopping";
    const shoppingSession =
      activeMode === shoppingMode
        ? null
        : modeSessions[shoppingMode] ?? getDefaultModeSession(shoppingMode);
    const nextMessages: ChatMessage[] = [
      ...(shoppingSession?.messages ?? messages),
      { role: "user", content: preferenceMessage },
    ];

    if (shoppingSession) {
      const currentMode = activeMode;
      const currentSession = getCurrentModeSession();
      setModeSessions((current) => ({
        ...current,
        [currentMode]: currentSession,
      }));
      setActiveMode(shoppingMode);
      setCompareSelectionIds([]);
      applyModeSession(shoppingSession);
    }

    setMessages(nextMessages);
    playChatSound("send");
    setPendingUserRequest(preferenceMessage);
    setProfile(nextProfile);
    setExtendedPreferences(nextExtendedPreferences);
    setIsSending(true);
    setActivityMessage(text.processing);

    try {
      await handleReadyMessage(
        preferenceMessage,
        nextProfile,
        nextExtendedPreferences,
        true,
        shoppingMode,
      );
    } catch (error) {
      if (!addRetryFailure(error, preferenceMessage)) {
        setStatus(getErrorMessage(error));
      }
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  async function handleGuidedCustomMessage(content: string) {
    setStatus("Groq is answering and finding related guided options.");
    const commerceData = guidedPlanItems.length > 0
      ? await runGuidedItemCommerce(content)
      : await runCommerce(content);
    appendAssistantMessage(getCommerceReply(commerceData));
    setChips(getGuidedReplyChips());
    setStatus("Related guided options loaded.");
  }

  async function handleNextGuidedItem() {
    if (isSending || guidedPlanItems.length === 0) {
      return;
    }

    const nextIndex = guidedPlanIndex + 1;

    if (nextIndex >= guidedPlanItems.length) {
      setChips(getGuidedReplyChips());
      setStatus("All guided item cards are shown.");
      return;
    }

    const nextItem = guidedPlanItems[nextIndex];
    setIsSending(true);
    setActivityMessage(text.processing);
    setGuidedPlanIndex(nextIndex);

    try {
      setRecommendedProducts([]);
      setFitReasons({});
      await runGuidedItemCommerce(getPlanSearchTerm(nextItem));
      setChips(getGuidedReplyChips());
      setStatus("Next guided item loaded.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  async function handlePreviousGuidedItem() {
    if (isSending || guidedPlanItems.length === 0) {
      return;
    }

    const previousIndex = guidedPlanIndex - 1;

    if (previousIndex < 0) {
      setStatus("You are already at the first guided item.");
      return;
    }

    const previousItem = guidedPlanItems[previousIndex];
    setIsSending(true);
    setActivityMessage(text.processing);
    setGuidedPlanIndex(previousIndex);

    try {
      setRecommendedProducts([]);
      setFitReasons({});
      await runGuidedItemCommerce(getPlanSearchTerm(previousItem));
      setChips(getGuidedReplyChips());
      setStatus("Previous guided item loaded.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  function getProductPageReplyFallback(exhausted: boolean, guided: boolean) {
    if (exhausted) {
      return language === "Sinhala"
        ? guided
          ? "මෙම item එකට ගැළපුණු සියලුම products පෙන්වා අවසන්. ඔබට query එක හෝ preferences වෙනස් කරන්න අවශ්‍යද?"
          : "ගැළපුණු සියලුම products පෙන්වා අවසන්. ඔබට search query එක හෝ preferences වෙනස් කරන්න අවශ්‍යද?"
        : language === "Singlish"
          ? guided
            ? "Me item ekata match una products okkoma pennala iwrai. Query eka hari preferences hari wenas karannada?"
            : "Match una products okkoma pennala iwrai. Search query eka hari preferences hari wenas karannada?"
          : guided
            ? "You've seen all the products matched for this item. Would you like to change the query or update your preferences?"
            : "You've seen all the matched products. Would you like to change your search query or update your preferences?";
    }

    return language === "Sinhala"
      ? "ඔබේ preferences වලට ගැළපෙන ඊළඟ products පෙන්වන්නම්."
      : language === "Singlish"
        ? "Oyage preferences walata match wena ilanga products pennanawa."
        : "Here are the next matched products for your preferences.";
  }

  async function requestProductPageReply({
    exhausted,
    guided,
    shownFrom,
    shownTo,
  }: {
    exhausted: boolean;
    guided: boolean;
    shownFrom: number;
    shownTo: number;
  }) {
    try {
      const response = await fetch("/api/ai/commerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exhausted,
          language,
          mode: activeMode,
          profile,
          query: latestUserQuery ?? pendingUserRequest,
          shownFrom,
          shownTo,
          task: "productPageReply",
          total: recommendedProducts.length,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        reply?: string;
      } | null;

      if (!response.ok || !data?.reply?.trim()) {
        throw new Error(data?.error || "AI reply generation failed.");
      }

      return data.reply.trim();
    } catch {
      return getProductPageReplyFallback(exhausted, guided);
    }
  }

  async function handleSuggestMoreGuidedItem() {
    if (isSending || guidedPlanItems.length === 0) {
      return;
    }

    const nextBatchIndex = productBatchIndex + 1;
    const nextBatchStart = nextBatchIndex * PRODUCT_BATCH_SIZE;
    const exhausted = nextBatchStart >= recommendedProducts.length;
    const shownFrom = exhausted ? 1 : nextBatchStart + 1;
    const shownTo = exhausted
      ? recommendedProducts.length
      : Math.min(
          nextBatchStart + PRODUCT_BATCH_SIZE,
          recommendedProducts.length,
        );
    setProductBatchIndex(nextBatchIndex);
    if (exhausted) {
      setChips((current) => current.filter((chip) => chip !== "Suggest more"));
    }
    setIsSending(true);
    setActivityMessage(text.processing);

    try {
      const reply = await requestProductPageReply({
        exhausted,
        guided: true,
        shownFrom,
        shownTo,
      });
      addMessage({ role: "assistant", content: reply });
      setStatus(
        exhausted
          ? "All matched products for this item have been shown."
          : `Showing ranked products ${shownFrom}-${shownTo}.`,
      );
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  async function handleSuggestMoreShopping() {
    if (isSending) {
      return;
    }

    const nextBatchIndex = productBatchIndex + 1;
    const nextBatchStart = nextBatchIndex * PRODUCT_BATCH_SIZE;
    const exhausted = nextBatchStart >= recommendedProducts.length;
    const shownFrom = exhausted ? 1 : nextBatchStart + 1;
    const shownTo = exhausted
      ? recommendedProducts.length
      : Math.min(
          nextBatchStart + PRODUCT_BATCH_SIZE,
          recommendedProducts.length,
        );
    setProductBatchIndex(nextBatchIndex);
    if (exhausted) {
      setChips((current) => current.filter((chip) => chip !== "Suggest more"));
    }
    setIsSending(true);
    setActivityMessage(text.processing);

    try {
      const reply = await requestProductPageReply({
        exhausted,
        guided: false,
        shownFrom,
        shownTo,
      });
      addMessage({ role: "assistant", content: reply });
      setStatus(
        exhausted
          ? "All matched products have been shown."
          : `Showing ranked products ${shownFrom}-${shownTo}.`,
      );
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  function handleChipClick(chip: string) {
    if (chip === "Previous item") {
      void handlePreviousGuidedItem();
      return;
    }

    if (chip === "Next item") {
      void handleNextGuidedItem();
      return;
    }

    if (chip === "Suggest more") {
      if (activeMode === "Smart Shopping") {
        void handleSuggestMoreShopping();
      } else {
        void handleSuggestMoreGuidedItem();
      }
      return;
    }

    void submitText(getLocalizedUserText(chip), starterChipGiftTypes[chip]);
  }

  async function handleRetryMessage(message: ChatMessage) {
    const retryText = message.retryText?.trim();
    if (!retryText || isSending) {
      return;
    }

    setMessages((current) =>
      current.map((item) =>
        item === message
          ? {
              ...item,
              retryContext: undefined,
              retryReason: undefined,
              retryText: undefined,
            }
          : item,
      ),
    );

    if (!message.retryContext) {
      await submitText(retryText);
      return;
    }

    setIsSending(true);
    setActivityMessage(text.processing);
    try {
      await answerWithCollectedContext(retryText, profile);
    } catch (error) {
      if (!addRetryFailure(error, retryText, true)) {
        setStatus(getErrorMessage(error));
      }
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  async function submitText(nextText: string, starterGiftType?: string) {
    const content = nextText.trim();
    if (!content || isSending) {
      return;
    }

    void trackPersonalizationEvent({
      category: starterGiftType || profile.category || undefined,
      event: "search",
      query: content,
    });

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];

    setMessages(nextMessages);
    playChatSound("send");
    setInput("");
    setIsSending(true);
    setActivityMessage(text.processing);

    try {
      if (starterGiftType) {
        const nextProfile = { ...profile, category: starterGiftType };
        const nextExtendedPreferences = {
          ...applyExtendedPreferenceUpdates(extendedPreferences, {
            giftType: starterGiftType,
          }),
        };
        setProfile(nextProfile);
        setExtendedPreferences(nextExtendedPreferences);
        setPendingUserRequest(content);

        if (conversationStage === "first-message") {
          showContextPanel(nextProfile, language);
        } else {
          const commerceData = await runCommerce(
            content,
            activeMode,
            nextProfile,
            false,
            content,
            true,
            nextExtendedPreferences,
          );
          appendAssistantMessage(getCommerceReply(commerceData));
        }
      } else if (conversationStage === "collecting-context") {
        setConversationStage("ready");
        await answerWithCollectedContext(
          pendingUserRequest || content,
          profile,
        );
      } else if (conversationStage === "first-message") {
        await handleFirstMessage(content);
      } else if (
        activeMode.includes("Event") ||
        activeMode.includes("Gift Box")
      ) {
        await handleGuidedCustomMessage(content);
      } else {
        await handleReadyMessage(content);
      }
    } catch (error) {
      if (!addRetryFailure(error, content)) {
        setStatus(getErrorMessage(error));
      }
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPromptPopupOpen(false);
    await submitText(input);
  }

  function handleSuggestedPromptClick(prompt: SuggestedPrompt) {
    if (prompt.action === "fill") {
      setInput(prompt.text);
      setIsPromptPopupOpen(false);
      return;
    }

    setIsPromptPopupOpen(false);
    composerInputRef.current?.focus();
  }

  async function compareProducts(ids: string[]) {
    if (ids.length < 2 || isCompareSubmitting) {
      return;
    }

    setIsCompareSubmitting(true);
    setCompareRows([]);
    setCompareSuggestion("");
    setStatus("The live catalog is loading product data for comparison.");

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 18000);
      const response = await fetch("/api/ai/commerce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          mode: "Product Compare",
          productIds: ids,
          profile: normalizeShoppingProfile(profile),
          query: ids.join(" "),
          task: "compare",
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      const data = (await response.json()) as CommerceResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Product comparison failed.");
      }

      const comparisonInsights = new Map(
        (data.comparisonInsights ?? []).map((productInsights) => [
          productInsights.id,
          productInsights.insights.slice(0, 4),
        ]),
      );
      const rows = (data.products ?? []).slice(0, 2).map((product) => ({
        insights: comparisonInsights.get(product.id) ?? [],
        product,
      }));

      setCompareRows(rows);
      setCompareSuggestion(data.reply || "");
      setStatus(
        rows.length >= 2
          ? "Product comparison table ready."
          : (data.reply || "Product comparison table ready."),
      );
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Comparison timed out. Use real product IDs copied from Smart Shopping product cards."
          : getErrorMessage(error);
      setCompareSuggestion(message);
      setStatus(message);
    } finally {
      setIsCompareSubmitting(false);
    }
  }

  function toggleCompareSelection(productId: string) {
    if (
      !compareSelectionIds.includes(productId) &&
      compareSelectionIds.length < 2
    ) {
      const product = recommendedProducts.find(
        (candidate) => candidate.id === productId,
      );
      if (product) {
        trackProductInteraction("compare", product);
      }
    }

    setCompareSelectionIds((current) => {
      if (current.includes(productId)) {
        return current.filter((id) => id !== productId);
      }

      return current.length < 2 ? [...current, productId] : current;
    });
  }

  async function handleCompareSelectionDone() {
    if (compareSelectionIds.length !== 2 || isCompareSubmitting) {
      return;
    }

    const ids = [...compareSelectionIds];
    const currentMode = activeMode;
    const currentSession = getCurrentModeSession();
    const compareMode = "Product Compare";
    const compareSession = modeSessions[compareMode] ?? getDefaultModeSession(compareMode);

    setModeSessions((current) => ({
      ...current,
      [currentMode]: currentSession,
    }));
    setCompareSelectionIds([]);
    setActiveMode(compareMode);
    applyModeSession(compareSession);
    setIsLeftPanelOpen(false);

    await compareProducts(ids);
  }

  async function generateGiftMessage(suggestions?: string) {
    if (isGiftMessageGenerating) {
      return;
    }

    setIsGiftMessageGenerating(true);
    setStatus("Generating a gift message.");

    try {
      const nextPreferences = {
        ...giftMessagePreferences,
        suggestions:
          suggestions !== undefined
            ? suggestions
            : giftMessagePreferences.suggestions,
      };
      const response = await fetch("/api/ai/commerce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          giftMessagePreferences: nextPreferences,
          language: nextPreferences.language,
          mode: "Gift Message",
          profile: normalizeShoppingProfile(profile),
          query: nextPreferences.suggestions || "Generate a gift message",
          task: "giftMessage",
        }),
      });
      const data = (await response.json()) as CommerceResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Gift message generation failed.");
      }

      if (!data.giftMessage?.trim()) {
        throw new Error("No updated gift message was returned. Please try again.");
      }

      setGiftMessage(data.giftMessage);
      setStatus("Gift message ready and saved for checkout.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setIsGiftMessageGenerating(false);
    }
  }

  async function handleGiftMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await generateGiftMessage(giftMessagePreferences.suggestions);
  }

  async function handleGiftCardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGiftCardGenerating) return;

    const product = buyBox.find((item) => item.id === giftCardProductId);
    if (!product) {
      setStatus("Select a product from the cart before generating a gift card.");
      return;
    }

    setIsGiftCardGenerating(true);
    setStatus("Groq is analyzing the product image and designing the gift card.");

    try {
      const response = await fetch("/api/ai/gift-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: giftCardPreferences,
          product: {
            description: product.description,
            id: product.id,
            imageUrl: product.imageUrl,
            name: product.name,
          },
        }),
      });
      const data = (await response.json()) as GiftCardResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Gift card generation failed.");
      }
      if (!data.imageDataUrl) {
        throw new Error("Groq did not return a valid gift card.");
      }

      setGiftCardImage(data.imageDataUrl);
      setGiftCardMessage(data.message ?? "");
      setGiftCardAnalysis(data.analysis ?? "");
      setGiftCardPalette(data.palette ?? []);
      if (data.message?.trim()) setGiftMessage(data.message.trim());
      setStatus("Gift card generated. Its message is also saved for checkout.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setIsGiftCardGenerating(false);
    }
  }

  function handleModeChange(mode: string) {
    if (mode === activeMode) {
      setIsLeftPanelOpen(false);
      return;
    }

    const currentMode = activeMode;
    const currentSession = getCurrentModeSession();
    const nextSession = modeSessions[mode] ?? getDefaultModeSession(mode);

    setModeSessions((current) => ({
      ...current,
      [currentMode]: currentSession,
    }));
    setActiveMode(mode);
    setCompareSelectionIds([]);
    applyModeSession(nextSession);
    setIsLeftPanelOpen(false);
    setStatus(`${mode} ready.`);
  }

  async function handleClearHistory() {
    const nextSession = getDefaultModeSession(activeMode);
    const preservedProducts = recommendedProducts;

    setModeSessions({});
    applyModeSession({
      ...nextSession,
      fitReasons: {},
      recommendedProducts: preservedProducts,
    });
    syncSidebarBudgetDraft("");
    resetToolPanels();
    setStatus("Chat history cleared.");

    try {
      await clearStoredChatState();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  function openCheckoutModal() {
    if (buyBox.length === 0) {
      setCheckoutWarning(getEmptyCartWarning());
      setStatus("Add at least one live product before checkout.");
      return;
    }

    setCheckoutWarning("");
    setCheckoutUrl("");
    setIsCheckoutModalOpen(true);
  }

  async function handleCreateOrderLink(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (isCheckoutCreating) {
      return;
    }

    if (buyBox.length === 0) {
      setCheckoutWarning(getEmptyCartWarning());
      setStatus("Add at least one live product before checkout.");
      return;
    }

    const phoneValidation = getValidatedPhoneNumber(
      checkoutDetails.recipientPhone,
    );

    if (phoneValidation.error) {
      setCheckoutWarning(phoneValidation.error);
      setStatus(phoneValidation.error);
      return;
    }

    setIsCheckoutCreating(true);
    setCheckoutWarning("");
    setCheckoutUrl("");
    setStatus("GenieAI is creating a guest-checkout link.");

    try {
      const response = await fetch("/api/ai/commerce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cartIds: buyBox.map((product) => product.id),
          checkout: {
            ...checkoutDetails,
            recipientPhone: phoneValidation.normalizedValue,
            giftMessage,
          },
          language,
          mode: activeMode,
          profile: normalizeShoppingProfile(profile),
          query: "Create GenieAI guest checkout link",
          task: "checkout",
        }),
      });
      const data = (await response.json()) as CommerceResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "GenieAI checkout failed.");
      }

      applyCommerceResponse(data);
      if (data.checkout?.checkout_url) {
        setStatus("GenieAI checkout link created.");
        setCheckoutWarning("");
      } else {
        const message = getCheckoutResponseMessage(data);
        setCheckoutWarning(message);
        setStatus(message);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setCheckoutWarning(message);
      setStatus(message);
    } finally {
      setIsCheckoutCreating(false);
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsComposerMenuOpen(false);
    const formData = new FormData();
    formData.append("image", file);
    setActivityMessage(text.uploadingImage);
    setIsImageProcessing(true);
    setStatus("Groq vision is analyzing the image.");

    try {
      const response = await fetch("/api/ai/image-analysis", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ImageResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Groq image analysis failed.");
      }

      const query = data.searchQuery || data.productHints?.join(" ") || "gift";
      addMessage({
        role: "assistant",
        content: getImageSearchReply(data),
      });
      await runCommerce(query, activeMode, profile, false);
      setStatus(
        data.fallback
          ? "Image upload used a best-effort fallback search. GenieAI products updated."
          : "Groq image analysis complete. GenieAI products updated.",
      );
    } catch (error) {
      const message = getErrorMessage(error);
      addMessage({
        role: "assistant",
        content: `Image upload did not complete: ${message}`,
      });
      setStatus(message);
    } finally {
      setActivityMessage("");
      setIsImageProcessing(false);
      event.target.value = "";
    }
  }

  async function startRecording() {
    if (isRecording) {
      return;
    }

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setStatus("Audio recording is not available in this browser.");
      return;
    }

    try {
      setIsComposerMenuOpen(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recordingStreamRef.current = stream;
      shouldSendRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setIsRecording(false);
        setIsRecordingPaused(false);
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], "genie-ai-voice.webm", {
          type: recorder.mimeType || "audio/webm",
        });
        mediaRecorderRef.current = null;

        if (shouldSendRecordingRef.current && blob.size > 0) {
          void transcribeVoice(file);
        } else {
          shouldSendRecordingRef.current = false;
          audioChunksRef.current = [];
          setActivityMessage("");
          setStatus("Voice recording stopped.");
        }
      };

      recorder.start();
      setIsRecording(true);
      setActivityMessage(text.recordingVoice);
      setStatus("Recording voice input.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  function toggleRecordingPause() {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    if (recorder.state === "recording") {
      recorder.pause();
      setIsRecordingPaused(true);
      setActivityMessage("Voice recording paused.");
      return;
    }

    if (recorder.state === "paused") {
      recorder.resume();
      setIsRecordingPaused(false);
      setActivityMessage(text.recordingVoice);
    }
  }

  function discardRecording() {
    if (!mediaRecorderRef.current || !isRecording) {
      return;
    }

    setIsComposerMenuOpen(false);
    shouldSendRecordingRef.current = false;
    mediaRecorderRef.current.stop();
  }

  function sendRecording() {
    if (!mediaRecorderRef.current || !isRecording) {
      return;
    }

    setIsComposerMenuOpen(false);
    shouldSendRecordingRef.current = true;
    setIsVoiceProcessing(true);
    setActivityMessage(text.transcribingVoice);
    setStatus("Groq is transcribing the voice note.");
    mediaRecorderRef.current.stop();
  }

  async function transcribeVoice(file: File) {
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("language", "en");
    setIsVoiceProcessing(true);
    setActivityMessage(text.transcribingVoice);

    try {
      const response = await fetch("/api/ai/voice-messages", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as VoiceResponse;

      if (!response.ok) {
        if (data.retry) {
          addMessage({ role: "assistant", content: text.voiceRetry });
          setStatus(text.voiceRetry);
          return;
        }

        throw new Error(data.error ?? "Groq transcription failed.");
      }

      const transcript = data.transcript ?? "";
      if (!transcript) {
        addMessage({ role: "assistant", content: text.voiceRetry });
        setStatus(text.voiceRetry);
        return;
      }

      setInput("");
      await submitText(transcript);
      setStatus("Groq voice transcript processed.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      shouldSendRecordingRef.current = false;
      audioChunksRef.current = [];
      setActivityMessage("");
      setIsVoiceProcessing(false);
    }
  }

  async function speakMessage(messageText: string) {
    if (!messageText.trim() || isSpeaking) {
      return;
    }

    const spokenText = removeEmojiForSpeech(messageText).slice(0, 1200);

    if (!spokenText) {
      setStatus("There is no readable text after removing emojis.");
      return;
    }

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setStatus("Read-aloud is not available in this browser.");
      return;
    }

    const femaleVoicePattern =
      /female|amy|aria|ava|emma|fiona|hazel|ivy|joanna|jenny|karen|kendra|kimberly|libby|maisie|michelle|moira|natasha|olivia|salli|samantha|sara|serena|shelley|sonia|susan|tessa|victoria|zira|google us english/i;
    const naturalVoicePattern = /enhanced|google|microsoft|natural|neural|premium/i;
    const speechSynthesis = window.speechSynthesis;
    const playbackRequest = speechPlaybackRequestRef.current + 1;
    speechPlaybackRequestRef.current = playbackRequest;
    const hasFemaleEnglishVoice = (voices: SpeechSynthesisVoice[]) =>
      voices.some(
        (voice) =>
          voice.lang.toLowerCase().startsWith("en") &&
          femaleVoicePattern.test(`${voice.name} ${voice.voiceURI}`),
      );

    speechSynthesis.cancel();
    setIsSpeaking(true);
    setStatus("Loading a female English voice.");

    let voices = speechSynthesis.getVoices();
    if (!hasFemaleEnglishVoice(voices)) {
      await new Promise<void>((resolve) => {
        const finishLoading = () => {
          window.clearTimeout(timeoutId);
          speechSynthesis.removeEventListener("voiceschanged", finishLoading);
          resolve();
        };
        const timeoutId = window.setTimeout(finishLoading, 1200);
        speechSynthesis.addEventListener("voiceschanged", finishLoading, {
          once: true,
        });
      });
      voices = speechSynthesis.getVoices();
    }

    if (speechPlaybackRequestRef.current !== playbackRequest) {
      return;
    }

    const femaleEnglishVoices = voices.filter(
      (voice) =>
        voice.lang.toLowerCase().startsWith("en") &&
        femaleVoicePattern.test(`${voice.name} ${voice.voiceURI}`),
    );
    const getVoiceScore = (voice: SpeechSynthesisVoice) => {
      const locale = voice.lang.toLowerCase();
      const voiceIdentity = `${voice.name} ${voice.voiceURI}`;
      const localeScore = locale.startsWith("en-lk")
        ? 40
        : locale.startsWith("en-gb")
          ? 35
          : locale.startsWith("en-us")
            ? 30
            : locale.startsWith("en-in")
              ? 25
              : 10;

      return (
        localeScore +
        (femaleVoicePattern.test(voiceIdentity) ? 100 : 0) +
        (naturalVoicePattern.test(voiceIdentity) ? 10 : 0) +
        (voice.default ? 2 : 0)
      );
    };
    const preferredVoice = [...femaleEnglishVoices].sort(
      (firstVoice, secondVoice) =>
        getVoiceScore(secondVoice) - getVoiceScore(firstVoice),
    )[0];

    if (!preferredVoice) {
      setIsSpeaking(false);
      setStatus("No female English voice is installed in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(spokenText);

    utterance.lang = preferredVoice.lang;
    utterance.rate = 0.96;
    utterance.pitch = 1.05;
    utterance.voice = preferredVoice;

    utterance.onend = () => {
      if (speechPlaybackRequestRef.current !== playbackRequest) return;
      setIsSpeaking(false);
      setStatus("Finished reading the latest message.");
    };
    utterance.onerror = () => {
      if (speechPlaybackRequestRef.current !== playbackRequest) return;
      setIsSpeaking(false);
      setStatus("The browser could not read this message aloud.");
    };

    setStatus("Reading the latest message aloud.");
    speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    speechPlaybackRequestRef.current += 1;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setStatus("Read-aloud stopped.");
  }

  useEffect(() => {
    const container = productCarouselRef.current;

    if (!container) {
      setCanScrollProductCarouselLeft(false);
      setCanScrollProductCarouselRight(false);
      return;
    }

    const updateCarouselControls = () => {
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const threshold = 8;

      setCanScrollProductCarouselLeft(container.scrollLeft > threshold);
      setCanScrollProductCarouselRight(maxScrollLeft - container.scrollLeft > threshold);
    };

    updateCarouselControls();
    container.addEventListener("scroll", updateCarouselControls, { passive: true });
    window.addEventListener("resize", updateCarouselControls);

    return () => {
      container.removeEventListener("scroll", updateCarouselControls);
      window.removeEventListener("resize", updateCarouselControls);
    };
  }, [visibleProducts.length, recommendedProducts.length, isLoadingInitialProducts]);

  function scrollProductCarousel(direction: "next" | "prev") {
    const container = productCarouselRef.current;

    if (!container) {
      return;
    }

    const distance = Math.max(container.clientWidth * 0.82, 220);

    container.scrollBy({
      behavior: "smooth",
      left: direction === "next" ? distance : -distance,
    });
  }

  function renderContextPanel(isActive: boolean) {
    const contextFields = getContextFieldsForMode(activeMode);
    const selectedContextFields = contextFields.filter((field) =>
      contextDraft[field].trim(),
    );
    const fieldsToAsk = contextFields.filter(
      (field) => !contextDraft[field].trim(),
    );
    const hasSelectedContext = selectedContextFields.length > 0;

    return (
      <div className="grid gap-2 overflow-hidden rounded-2xl border border-[#D7E2EF] bg-white p-2.5 shadow-[0_12px_32px_-22px_rgba(10,31,58,.35)]">
        <div>
          <h3 className="text-base font-semibold leading-5 text-[#0B2748]">
            {text.contextTitle}
          </h3>
        </div>

        {selectedContextFields.length > 0 ? (
          <div className="rounded-xl border border-[#E6D5A7] bg-[#FFF8E7] p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A6823]">
              {text.detectedContext}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selectedContextFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  disabled={!isActive || isSending}
                  onClick={() => selectContextOption(field, contextDraft[field])}
                  className="rounded-full border border-[#D6A936] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B2748] shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {getContextFieldLabel(field)}:{" "}
                  {getOptionLabel(contextDraft[field])}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {fieldsToAsk.length > 0 ? (
          <div className="grid gap-1.5">
            {fieldsToAsk.map((field) => (
              <fieldset key={field} aria-label={getContextQuestion(field)} className="rounded-lg border border-[#E4E1D8] bg-[#FAF7F1] px-2.5 py-1.5">
                <div className="grid gap-1.5 sm:grid-cols-[20%_minmax(0,1fr)] sm:items-center sm:gap-2">
                  <p className="text-xs font-semibold leading-4 text-[#0B2748]">
                    {getContextQuestion(field)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {contextFieldOptions[field].map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={false}
                        disabled={!isActive || isSending}
                        onClick={() => selectContextOption(field, option)}
                        className="rounded-full border border-[#D7E2EF] bg-white px-2.5 py-1 text-xs font-medium leading-4 text-[#31577F] transition hover:border-[#D6A936] hover:bg-[#FFF8E7] hover:text-[#0B2748] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {getOptionLabel(option)}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>
            ))}
          </div>
        ) : <div />}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!isActive || isSending || !hasSelectedContext}
            onClick={() => void submitContextPanel(true)}
            className="h-9 rounded-[10px] bg-[#D6A936] px-3 text-xs font-semibold text-[#071A30] shadow-sm transition hover:bg-[#C89B3C] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSending ? text.sendingContext : text.sendContext}
          </button>
          <button
            type="button"
            disabled={!isActive || isSending}
            onClick={() => void submitContextPanel(false)}
            className="h-9 rounded-[10px] border border-[#D7E2EF] bg-white px-3 text-xs font-semibold text-[#31577F] transition hover:border-[#1E4D8C] hover:bg-[#F5F8FC] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {text.continueWithoutContext}
          </button>
        </div>
      </div>
    );
  }


  const productSection = shouldShowProductSuggestions ? (
    <div className="mt-2 md:ml-[54px] md:mt-5">
      <ProductGrid
        addLabel={text.addToBuyBox}
        cartIds={new Set(buyBox.map((product) => product.id))}
        compareIds={compareSelectionIds}
        emptyLabel={text.initialEmpty}
        formatPrice={formatPrice}
        isLoading={isLoadingInitialProducts}
        onAdd={addToBuyBox}
        onCompare={toggleCompareSelection}
        onView={viewProduct}
        products={visibleProducts}
        viewLabel={text.productView}
      />
    </div>
  ) : null;

  const replyChipSection = visibleReplyChips.length > 0 ? (
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1.5 md:ml-[54px] md:mt-4 md:gap-2">
      {visibleReplyChips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => handleChipClick(chip)}
          className="rounded-full border border-[#E4E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#1E4D8C] transition hover:border-[#3D74B8] hover:bg-[#E7EEF7]"
        >
          {getChipLabel(chip)}
        </button>
      ))}
    </div>
  ) : null;

  const processingOverlay =
    isRecording || isVoiceProcessing || isImageProcessing ? (
      <div className="absolute bottom-[78px] left-1/2 z-30 w-[min(92%,520px)] -translate-x-1/2 rounded-[14px] border border-[#E4E1D8] bg-white/95 p-3 text-xs font-semibold text-[#123661] shadow-[0_16px_40px_-16px_rgba(10,31,58,.35)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`h-2.5 w-2.5 animate-pulse rounded-full ${
              isRecording ? "bg-[#B25A2E]" : "bg-[#1E4D8C]"
            }`}
          />
          <span>
            {isRecording
              ? text.recordingVoice
              : isVoiceProcessing
                ? text.transcribingVoice
                : text.uploadingImage}
          </span>
          {isRecording ? (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={toggleRecordingPause}
                className="rounded-lg border border-[#E4E1D8] px-3 py-2"
              >
                {isRecordingPaused ? text.voiceResume : text.voicePause}
              </button>
              <button
                type="button"
                onClick={discardRecording}
                className="rounded-lg border border-[#E4E1D8] px-3 py-2"
              >
                {text.voiceStop}
              </button>
              <button
                type="button"
                onClick={sendRecording}
                className="rounded-lg bg-[#C89B3C] px-3 py-2 text-[#0A1F3A]"
              >
                {text.send}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <GenieShell
      header={
        <AppHeader
          cartCount={cartCount}
          clearLabel={text.clearHistory}
          compareCount={compareSelectionIds.length}
          isComparing={isCompareSubmitting}
          language={language}
          languageLabels={languageLabels}
          languageOptions={languageOptions}
          onClearHistory={() => void handleClearHistory()}
          onCompareDone={() => void handleCompareSelectionDone()}
          onLanguageChange={handleLanguageChange}
          onOpenCart={() => setIsBuyBoxOpen(true)}
        />
      }
      navigation={
        <NavigationRail
          activeMode={activeMode}
          modes={modes}
          onModeChange={handleModeChange}
          onOpenPreferences={() => setIsLeftPanelOpen(true)}
        />
      }
      composer={
        !isFormToolMode && !isGuidedMode ? (
          <Composer
            disabled={isSending || isVoiceProcessing || isImageProcessing}
            formRef={composerRef}
            imageInputRef={imageInputRef}
            inputRef={composerInputRef}
            isRecording={isRecording}
            onFocus={() => {
              if (!input.trim()) setIsPromptPopupOpen(true);
            }}
            onImage={(event) => void handleImageChange(event)}
            onInput={(value) => {
              setInput(value);
              setIsPromptPopupOpen(false);
            }}
            onSubmit={(event) => void handleSubmit(event)}
            onVoice={() => {
              if (!isRecording) void startRecording();
            }}
            placeholder={text.askPlaceholder}
            sendLabel={isSending ? text.sending : text.send}
            value={input}
          >
            {isPromptPopupOpen ? (
              <div className="absolute bottom-[calc(100%+8px)] left-4 right-4 z-40 grid gap-2 rounded-[14px] border border-[#E4E1D8] bg-white p-2 shadow-[0_16px_40px_-16px_rgba(10,31,58,.35)] sm:left-7 sm:right-7">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt.text}
                    type="button"
                    onClick={() => handleSuggestedPromptClick(prompt)}
                    className="rounded-[10px] bg-[#FAF7F1] px-4 py-3 text-left text-sm text-[#3E4A56] transition hover:bg-[#E7EEF7]"
                  >
                    {prompt.text}
                  </button>
                ))}
              </div>
            ) : null}
          </Composer>
        ) : (
          <div />
        )
      }
      overlays={
        <>
          {processingOverlay}
          <WelcomePanel open={isIntroPanelVisible} onClose={closeIntroPanel} />
          <ProductDialog
            formatPrice={formatPrice}
            onClose={() => setSelectedProduct(null)}
            product={selectedProduct}
          />
          <CartDrawer
            checkoutLabel={text.createOrderLink}
            delivery={totals.delivery}
            formatPrice={formatPrice}
            items={buyBox}
            onCheckout={openCheckoutModal}
            onClose={() => setIsBuyBoxOpen(false)}
            onRemove={removeFromBuyBox}
            open={isBuyBoxOpen}
            subtotal={totals.subtotal}
            total={totals.total}
          />
          <PreferencesDrawer
            budgetError={sidebarBudgetError}
            budgetMax={sidebarBudgetMax}
            budgetMin={sidebarBudgetMin}
            budgetOptions={budgetOptions}
            cities={deliveryCities}
            giftTypes={giftTypeOptions}
            isSending={isSending}
            occasions={occasionOptions}
            onApply={() => {
              void handleSidebarPreferenceSubmit();
              setIsLeftPanelOpen(false);
            }}
            onBudgetMax={(value) => {
              setSidebarBudgetMax(value);
              setSidebarBudgetError("");
            }}
            onBudgetMin={(value) => {
              setSidebarBudgetMin(value);
              setSidebarBudgetError("");
            }}
            onClose={() => setIsLeftPanelOpen(false)}
            open={isLeftPanelOpen}
            profile={profile}
            recipients={recipientOptions}
            setProfile={setProfile}
          />
          <CheckoutDialog
            checkoutDetails={checkoutDetails}
            checkoutUrl={checkoutUrl}
            cities={deliveryCities}
            creating={isCheckoutCreating}
            dateLabel={text.date}
            giftMessage={giftMessage}
            giftMessageLabel={text.giftMessageLabel}
            locationTypes={locationTypes}
            minimumDeliveryDate={minimumDeliveryDate}
            onClose={() => setIsCheckoutModalOpen(false)}
            onGiftMessage={setGiftMessage}
            onSubmit={(event) => void handleCreateOrderLink(event)}
            open={isCheckoutModalOpen}
            openCheckoutLabel={text.openCheckout}
            profile={profile}
            setCheckoutDetails={setCheckoutDetails}
            setProfile={setProfile}
            submitLabel={text.createOrderLink}
            warning={checkoutWarning}
          />
        </>
      }
    >
      <div className="relative h-full">
        <ChatThread
          activityMessage={activityMessage}
          chatRef={chatScrollContainerRef}
          contentOverride={
            isCompareMode ? (
              <div className="mx-auto w-full max-w-6xl">
                {renderCompareTool()}
              </div>
            ) : isGiftMessageMode ? (
              <div className="mx-auto -mt-3 h-full w-full max-w-5xl sm:-mt-4">
                {renderGiftMessageTool()}
              </div>
            ) : undefined
          }
          contextPanel={renderContextPanel}
          conversationStage={conversationStage}
          footer={
            <>
              {!isGuidedMode ? replyChipSection : null}
              {productSection}
              {isGuidedMode ? replyChipSection : null}
            </>
          }
          isSending={isSending}
          isSpeaking={isSpeaking}
          language={language}
          latestAssistantIndex={latestAssistantMessageIndex}
          messages={messages}
          onLanguageEnglish={() => handleLanguageChange("English")}
          onRetry={(message) => void handleRetryMessage(message)}
          onSpeak={(content) => void speakMessage(content)}
          onStopSpeaking={stopSpeaking}
          readAloudTitle={readAloudTitle}
          renderMessage={renderChatMessage}
          switchEnglishLabel={getSwitchToEnglishLabel()}
          tryAgainLabel={getTryAgainLabel()}
        />
      </div>
    </GenieShell>
  );
}
