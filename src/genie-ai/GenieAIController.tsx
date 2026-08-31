"use client";

import {
  ChangeEvent,
  FormEvent,
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
import type { GiftCardPreferences } from "./v3/GiftCardTool";
import { NavigationRail } from "./v3/NavigationRail";
import { PreferencesDrawer } from "./v3/PreferencesDrawer";
import { ProductDialog } from "./v3/ProductDialog";
import { ProductGrid } from "./v3/ProductGrid";
import { WelcomePanel } from "./v3/WelcomePanel";
import { ChatMessageContent } from "./components/ChatMessageContent";
import { CompareTool } from "./components/CompareTool";
import { ContextPanel } from "./components/ContextPanel";
import {
  GiftCreationTool,
  type GiftMessagePreferences,
} from "./components/GiftCreationTool";
import { ProcessingOverlay } from "./components/ProcessingOverlay";
import { ReplyChips } from "./components/ReplyChips";
import { SuggestedPromptsPopover } from "./components/SuggestedPromptsPopover";

import {
  type ChatMessage,
  type CommerceResponse,
  type CompareRow,
  type ContextAnalysisResponse,
  type ContextDraft,
  type ContextField,
  type ExtendedPreferences,
  type GiftCardResponse,
  type GuidedPlanItem,
  type ImageResponse,
  type Language,
  type ModeSession,
  type ShoppingProfile,
  type SuggestedPrompt,
  type VoiceResponse,
  getCheckoutResponseMessage,
} from "./types";

import {
  MAX_RANKED_PRODUCTS,
  PRODUCT_BATCH_SIZE,
  budgetOptions,
  contextFieldLabelOverrides,
  contextFieldLabels,
  contextFieldLabelsByLanguage,
  contextFieldOptions,
  contextQuestionOverrides,
  contextQuestions,
  emptyContextDraft,
  getContextFieldsForMode,
  giftTypeMessages,
  giftTypeOptions,
  languageLabels,
  languageOptions,
  modes,
  occasionOptions,
  recipientOptions,
  starterChipGiftTypes,
  starterChips,
  starterMessages,
  starterMessagesByLanguage,
} from "./config";

import {
  applyExtendedPreferenceUpdates,
  buildBudgetRangeValue,
  divideBudgetAcrossItems,
  getErrorMessage,
  getExtendedPreferencesFromProfile,
  getLocalDateString,
  getPreferencePayloadForMode,
  getResponsePreferenceForMode,
  getTaskForMode,
  getValidatedPhoneNumber,
  initialShoppingProfile,
  mergeExtendedPreferencesWithProfile,
  normalizeExtendedPreferences,
  normalizeModeSession,
  normalizeModeSessions,
  normalizeShoppingProfile,
  parseBudgetAmount,
  parseBudgetRangeValue,
  removeEmojiForSpeech,
  syncExtendedPreferencesWithProfile,
} from "./utils";

import {
  commonChipLabels,
  contextOptionLabels,
  copy,
  copyOverrides,
  dynamicChipLabels,
  optionLabels,
  starterChipLabels,
  starterChipOverrides,
  suggestedPromptsByLanguage,
} from "./config";

import {
  INITIAL_CATALOG_VERSION,
  INTRO_PANEL_STORAGE_KEY,
  clearStoredChatState,
  readStoredChatState,
  writeStoredChatState,
} from "./storage";

import { rotatingActivityMessages } from "./config";

export function GenieAIController() {
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
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
  const [profile, setProfile] = useState<ShoppingProfile>(
    initialShoppingProfile,
  );
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
  const [, setStatus] = useState(
    "Groq chat and media ready. Live commerce service ready.",
  );
  const [activityMessage, setActivityMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isChatStateLoaded, setIsChatStateLoaded] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isBuyBoxOpen, setIsBuyBoxOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modeSessions, setModeSessions] = useState<Record<string, ModeSession>>(
    {},
  );
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
  const [giftMessageToolTab, setGiftMessageToolTab] = useState<
    "message" | "card"
  >("message");
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
  const [, setIsComposerMenuOpen] = useState(false);
  const [isPromptPopupOpen, setIsPromptPopupOpen] = useState(false);
  const [sidebarBudgetMin, setSidebarBudgetMin] = useState(
    () => parseBudgetRangeValue(initialShoppingProfile.budget).min,
  );
  const [sidebarBudgetMax, setSidebarBudgetMax] = useState(
    () => parseBudgetRangeValue(initialShoppingProfile.budget).max,
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
  const text = {
    ...copy.English,
    ...copy[language],
    ...copyOverrides[language],
  } as Required<(typeof copy)["English"]>;
  const minimumDeliveryDate = getLocalDateString();
  const visibleProducts = useMemo(() => {
    const start = productBatchIndex * PRODUCT_BATCH_SIZE;
    return recommendedProducts.slice(start, start + PRODUCT_BATCH_SIZE);
  }, [productBatchIndex, recommendedProducts]);
  const latestUserQuery = useMemo(
    () =>
      [...messages].reverse().find((message) => message.role === "user")
        ?.content,
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
  }, [
    activeMode,
    isSending,
    latestUserQuery,
    productBatchIndex,
    visibleProducts,
  ]);

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
      (normalizedSession.recommendedProducts ?? []).slice(
        0,
        MAX_RANKED_PRODUCTS,
      ),
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
    const value =
      typeof item === "string" ? item : item.searchTerm || item.label;
    const normalized = value.toLowerCase();

    if (normalized.includes("cake")) return "cake";
    if (normalized.includes("flower") || normalized.includes("rose"))
      return "flowers";
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

  function getDefaultPlanItems(
    mode: string,
    draft: ContextDraft,
  ): GuidedPlanItem[] {
    if (mode.includes("Gift Box")) {
      const theme = draft.giftBoxTheme || draft.category || profile.category;
      const itemCount = getGiftBoxItemCount(draft);

      if (theme === "Flowers") {
        return [
          { label: "flowers", quantity: "1 bouquet", searchTerm: "flowers" },
          {
            label: "chocolates",
            quantity: `${Math.max(1, itemCount - 1)} boxes`,
            searchTerm: "chocolate",
          },
          { label: "card", quantity: "1 card", searchTerm: "greeting card" },
        ];
      }

      if (theme === "Perfume") {
        return [
          { label: "perfume", quantity: "1 bottle", searchTerm: "perfume" },
          {
            label: "chocolates",
            quantity: `${Math.max(1, itemCount - 1)} boxes`,
            searchTerm: "chocolate",
          },
          {
            label: "flowers",
            quantity: "1 small bouquet",
            searchTerm: "flowers",
          },
        ];
      }

      if (theme === "Party") {
        return [
          { label: "cake", quantity: "1kg", searchTerm: "cake" },
          {
            label: "party pack",
            quantity: `${itemCount} items`,
            searchTerm: "party pack",
          },
          { label: "chocolates", quantity: "1 box", searchTerm: "chocolate" },
        ];
      }

      return [
        {
          label: "chocolates",
          quantity: `${itemCount} items`,
          searchTerm: "chocolate",
        },
        { label: "flowers", quantity: "1 bouquet", searchTerm: "flowers" },
        { label: "cake", quantity: "1kg", searchTerm: "cake" },
      ];
    }

    const participants = getParticipantCount(draft);
    const cakeKg = Math.max(1, Math.ceil(participants / 12));

    return [
      { label: "cake", quantity: `${cakeKg}kg`, searchTerm: "cake" },
      { label: "flowers", quantity: "1-2 bouquets", searchTerm: "flowers" },
      {
        label: "chocolates",
        quantity: `${Math.ceil(participants / 8)} boxes`,
        searchTerm: "chocolate",
      },
      {
        label: "snacks",
        quantity: `${participants} servings`,
        searchTerm: "snacks",
      },
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
            item
              .replace(/^[-*\d.)\s]+/, "")
              .split("-")[0]
              .trim() ||
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

  function renderChatMessage(content: string) {
    return <ChatMessageContent content={content} />;
  }

  function renderCompareTool() {
    return (
      <CompareTool
        compareRows={compareRows}
        formatPrice={formatPrice}
        suggestion={compareSuggestion}
      />
    );
  }

  function renderGiftMessageTool() {
    return (
      <GiftCreationTool
        card={{
          analysis: giftCardAnalysis,
          generatedImage: giftCardImage,
          generating: isGiftCardGenerating,
          message: giftCardMessage,
          palette: giftCardPalette,
          preferences: giftCardPreferences,
          selectedProductId: giftCardProductId,
        }}
        languageLabels={languageLabels}
        languageOptions={languageOptions}
        message={giftMessage}
        messageGenerating={isGiftMessageGenerating}
        messagePreferences={giftMessagePreferences}
        onCardPreferences={setGiftCardPreferences}
        onCardProduct={setGiftCardProductId}
        onCardSubmit={(event) => void handleGiftCardSubmit(event)}
        onMessage={setGiftMessage}
        onMessagePreferences={setGiftMessagePreferences}
        onMessageSubmit={(event) => void handleGiftMessageSubmit(event)}
        onTab={(tab) => {
          if (tab === "card") {
            setGiftCardPreferences((current) => ({
              ...current,
              language,
              occasion: profile.occasion || current.occasion,
              recipient: profile.recipient || current.recipient,
              receiverName:
                checkoutDetails.recipientName || current.receiverName || "",
              senderName:
                checkoutDetails.senderName || current.senderName || "",
            }));
          }
          setGiftMessageToolTab(tab);
        }}
        products={buyBox}
        tab={giftMessageToolTab}
      />
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
          const restoredMode =
            storedMode === "Gift Card" ? "Gift Message" : storedMode;
          const restoredSessions = normalizeModeSessions(
            storedState.modeSessions ?? {},
          );
          const restoredSession = restoredSessions[restoredMode] ?? {
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
            !restoredSession.messages.some(
              (message) => message.role === "user",
            );
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
    // Restore once on mount; applyModeSession intentionally uses the initial controller state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const context = chatSoundContextRef.current ?? new AudioContextCtor();

      chatSoundContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime;
      const duration = type === "send" ? 0.08 : 0.12;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(type === "send" ? 660 : 520, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.03, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    } catch {
      // Ignore audio playback failures so chat flow stays uninterrupted.
    }
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
            nextReasons[recommendation.id] =
              `${recommendation.fitScore}% - ${recommendation.reason}`;
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
          (message) => message.role === "user" || message.role === "assistant",
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
          data = (await response.json()) as CommerceResponse & {
            error?: string;
          };
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
        draft.category ||
        draft.giftBoxTheme ||
        draft.eventType ||
        baseProfile.category,
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

  function getPreferenceDraftFromProfile(
    nextProfile: ShoppingProfile,
  ): ContextDraft {
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
      if (!addRetryFailure(error, pendingUserRequest || contextMessage, true)) {
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
        : (modeSessions[shoppingMode] ?? getDefaultModeSession(shoppingMode));
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
    const commerceData =
      guidedPlanItems.length > 0
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

  const allProductsShownReply =
    "You've seen all the matched products. Update your preferences to find more.";

  function handleSuggestMoreGuidedItem() {
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
    if (exhausted) {
      addMessage({ role: "assistant", content: allProductsShownReply });
    }
    setStatus(
      exhausted
        ? "All matched products for this item have been shown."
        : `Showing ranked products ${shownFrom}-${shownTo}.`,
    );
  }

  function handleSuggestMoreShopping() {
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
    if (exhausted) {
      addMessage({ role: "assistant", content: allProductsShownReply });
    }
    setStatus(
      exhausted
        ? "All matched products have been shown."
        : `Showing ranked products ${shownFrom}-${shownTo}.`,
    );
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
        handleSuggestMoreShopping();
      } else {
        handleSuggestMoreGuidedItem();
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
      const data = (await response.json()) as CommerceResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Product comparison failed.");
      }

      const comparisonInsights = new Map(
        (data.comparisonInsights ?? []).map((productInsights) => [
          productInsights.id,
          productInsights.insights.slice(0, 4),
        ]),
      );
      const rows = (data.products ?? []).slice(0, 2).map((product) => {
        const insights = comparisonInsights.get(product.id) ?? [];
        return {
          insights,
          product,
        };
      });

      setCompareRows(rows);
      setCompareSuggestion(data.reply || "");
      setStatus(
        rows.length >= 2
          ? "Product comparison table ready."
          : data.reply || "Product comparison table ready.",
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
    const compareSession =
      modeSessions[compareMode] ?? getDefaultModeSession(compareMode);

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
      const data = (await response.json()) as CommerceResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Gift message generation failed.");
      }

      if (!data.giftMessage?.trim()) {
        throw new Error(
          "No updated gift message was returned. Please try again.",
        );
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
      setStatus(
        "Select a product from the cart before generating a gift card.",
      );
      return;
    }

    setIsGiftCardGenerating(true);
    setStatus(
      "Groq is analyzing the product image and designing the gift card.",
    );

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
    const naturalVoicePattern =
      /enhanced|google|microsoft|natural|neural|premium/i;
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

  function renderContextPanel(isActive: boolean) {
    return (
      <ContextPanel
        contextDraft={contextDraft}
        contextFields={getContextFieldsForMode(activeMode)}
        disabled={isSending}
        getFieldLabel={getContextFieldLabel}
        getOptionLabel={getOptionLabel}
        getQuestion={getContextQuestion}
        isActive={isActive}
        labels={{
          continueWithoutContext: text.continueWithoutContext,
          contextTitle: text.contextTitle,
          detectedContext: text.detectedContext,
          sendContext: text.sendContext,
          sendingContext: text.sendingContext,
        }}
        onSelect={selectContextOption}
        onSubmit={(includeContext) => void submitContextPanel(includeContext)}
        options={contextFieldOptions}
      />
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

  const replyChipSection = (
    <ReplyChips
      chips={visibleReplyChips}
      getLabel={getChipLabel}
      onSelect={handleChipClick}
    />
  );

  const processingOverlay = (
    <ProcessingOverlay
      isImageProcessing={isImageProcessing}
      isRecording={isRecording}
      isRecordingPaused={isRecordingPaused}
      isVoiceProcessing={isVoiceProcessing}
      labels={{
        pause: text.voicePause,
        recording: text.recordingVoice,
        resume: text.voiceResume,
        send: text.send,
        stop: text.voiceStop,
        transcribing: text.transcribingVoice,
        uploading: text.uploadingImage,
      }}
      onDiscard={discardRecording}
      onPause={toggleRecordingPause}
      onSend={sendRecording}
    />
  );

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
              <SuggestedPromptsPopover
                onSelect={handleSuggestedPromptClick}
                prompts={suggestedPrompts}
              />
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
