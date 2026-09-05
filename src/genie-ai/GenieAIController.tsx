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
import {
  deliveryCities,
  locationTypes,
  mainDeliveryCities,
} from "@/lib/deliveryLocations";
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
import { ProfilePanel } from "./v3/ProfilePanel";
import { OrderCompletedDialog } from "./v3/OrderCompletedDialog";
import { WelcomePanel } from "./v3/WelcomePanel";
import { ChatMessageContent } from "./components/ChatMessageContent";
import { CompareTool } from "./components/CompareTool";
import { OrderTrackingTool } from "./components/OrderTrackingTool";
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
  type ContextDraft,
  type ContextField,
  type ExtendedPreferences,
  type GiftCardResponse,
  type GuidedPlanItem,
  type ImageResponse,
  type ImageSearchResponse,
  type Language,
  type ModeSession,
  type PreviousOrder,
  type SearchMode,
  type ShoppingProfile,
  type SuggestedPrompt,
  type VoiceResponse,
} from "./types";

import {
  MAX_RANKED_PRODUCTS,
  PRODUCT_BATCH_SIZE,
  budgetOptions,
  contextFieldLabelOverrides,
  contextFieldLabels,
  contextFieldLabelsByLanguage,
  getContextFieldOptionsForMode,
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
  const [searchMode, setSearchMode] = useState<SearchMode>("instant");
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
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [previousOrders, setPreviousOrders] = useState<PreviousOrder[]>([]);
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
  const [isGiftMessageCheckoutNoticeVisible, setIsGiftMessageCheckoutNoticeVisible] =
    useState(false);
  const [, setStatus] = useState(
    "Groq chat and media ready. Live commerce service ready.",
  );
  const [activityMessage, setActivityMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isComposerSettling, setIsComposerSettling] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isChatStateLoaded, setIsChatStateLoaded] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isBuyBoxOpen, setIsBuyBoxOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isOrderCompletedOpen, setIsOrderCompletedOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modeSessions, setModeSessions] = useState<Record<string, ModeSession>>(
    {},
  );
  const [recommendationSessionId, setRecommendationSessionId] = useState<
    string | null
  >(null);
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

  useEffect(() => {
    if (!isGiftMessageCheckoutNoticeVisible) return;

    const timeoutId = window.setTimeout(
      () => setIsGiftMessageCheckoutNoticeVisible(false),
      5000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [isGiftMessageCheckoutNoticeVisible]);
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
  const isGuidedMode =
    activeMode.includes("Event") || activeMode.includes("Gift Box");
  const visibleProducts = useMemo(() => {
    if (isGuidedMode) return recommendedProducts;

    const visibleProductCount = (productBatchIndex + 1) * PRODUCT_BATCH_SIZE;
    return recommendedProducts.slice(0, visibleProductCount);
  }, [isGuidedMode, productBatchIndex, recommendedProducts]);
  const hasMoreRecommendedProducts =
    (productBatchIndex + 1) * PRODUCT_BATCH_SIZE <
    recommendedProducts.length;
  const latestUserQuery = useMemo(
    () =>
      [...messages].reverse().find((message) => message.role === "user")
        ?.content,
    [messages],
  );
  const shouldShowProductSuggestions =
    conversationStage !== "collecting-context";
  const hasUserMessages = messages.some((message) => message.role === "user");
  const isSmartShoppingInitialView =
    activeMode === "Smart Shopping" &&
    !hasUserMessages &&
    conversationStage === "first-message";
  const visibleReplyChips =
    isGuidedMode && isSending
      ? []
      : isGuidedMode
        ? chips.filter((chip) => chip !== "Suggest more")
      : activeMode === "Smart Shopping" && hasUserMessages
        ? chips.filter((chip) => chip !== "Suggest more")
        : hasUserMessages
          ? chips.filter(
              (chip) =>
                !isRemovedGenericReplyChip(chip) &&
                chip !== "Suggest more",
            )
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
  const isDeliveryPredictionMode = activeMode === "Delivery Prediction";
  const isProfileMode = activeMode === "Profile";
  const isFormToolMode = isCompareMode || isGiftMessageMode || isDeliveryPredictionMode || isProfileMode;
  const suggestedPrompts = suggestedPromptsByLanguage[language];
  const suggestedPromptTexts = useMemo(
    () => suggestedPrompts.map((prompt) => prompt.text),
    [suggestedPrompts],
  );

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
        position: index + 1,
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

  useEffect(() => {
    if (!isComposerSettling) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setIsComposerSettling(false),
      620,
    );
    return () => window.clearTimeout(timeoutId);
  }, [isComposerSettling]);

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

  function getGuidedReplyChips(items = guidedPlanItems) {
    return [
      ...new Set(
        items
          .map((item) => item.label.trim())
          .filter(Boolean),
      ),
    ];
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
    if (mode === "Delivery Prediction") return "Enter a delivery location to predict preparation and travel time from Colombo.";
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
        recommendationSessionId: null,
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
      recommendationSessionId: null,
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
      recommendationSessionId,
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
    setRecommendationSessionId(
      normalizedSession.recommendationSessionId ?? null,
    );
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
    return match ? Math.min(4, Number(match[0])) : 3;
  }

  function getEventItemCount(draft: ContextDraft) {
    const match = (draft.itemCount || "").match(/\d+/);
    return match ? Number(match[0]) : 4;
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
      const itemCount = getGiftBoxItemCount(draft);

      return [
        {
          label: "chocolates",
          quantity: "1 box",
          searchTerm: "chocolate",
        },
        { label: "flowers", quantity: "1 bouquet", searchTerm: "flowers" },
        { label: "cake", quantity: "1kg", searchTerm: "cake" },
        { label: "perfume", quantity: "1 gift set", searchTerm: "perfume" },
        { label: "fashion accessory", quantity: "1 item", searchTerm: "fashion" },
      ].slice(0, itemCount);
    }

    const participants = getParticipantCount(draft);
    const itemCount = getEventItemCount(draft);
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
      { label: "perfume", quantity: "1 gift set", searchTerm: "perfume" },
    ].slice(0, itemCount);
  }

  function normalizeGuidedPlanItems(
    items: string[],
    mode = activeMode,
    draft = contextDraft,
  ) {
    const fallback = getDefaultPlanItems(mode, draft);
    const maxItems = mode.includes("Gift Box")
      ? getGiftBoxItemCount(draft)
      : mode.includes("Event")
        ? getEventItemCount(draft)
        : 8;

    const normalizedItems = items.length > 0
      ? items.slice(0, maxItems).map((item, index) => {
          const cleanedItem = item.replace(/^[-*\d.)\s]+/, "").trim();
          const [rawLabel, ...quantityParts] = cleanedItem.split(/\s+-\s+/);

          return {
            label: rawLabel?.trim() || fallback[index]?.label || "gift",
            quantity:
              quantityParts.join(" - ").trim() ||
              fallback[index]?.quantity ||
              "1 item",
            searchTerm: getPlanSearchTerm(rawLabel || cleanedItem),
          };
        })
      : fallback;

    const requiresExactItemCount =
      mode.includes("Event") || mode.includes("Gift Box");
    if (!requiresExactItemCount || normalizedItems.length >= maxItems) {
      return normalizedItems;
    }

    const existingLabels = new Set(
      normalizedItems.map((item) => item.label.toLowerCase()),
    );
    return [
      ...normalizedItems,
      ...fallback.filter((item) => !existingLabels.has(item.label.toLowerCase())),
    ].slice(0, maxItems);
  }

  function getGuidedPlanReply(
    items: GuidedPlanItem[],
    index = 0,
    replyLanguage = language,
  ) {
    const nextItem = items[index]?.label ?? items[0]?.label ?? "gift";
    const itemList = items
      .map((item) =>
        activeMode.includes("Gift Box")
          ? `- ${item.label}`
          : `- ${formatGuidedPlanItem(item)}`,
      )
      .join("\n");

    if (replyLanguage === "Sinhala") {
      return `යෝජිත අයිතම ලැයිස්තුව:\n${itemList}\n\nමුලින්ම ${nextItem} සඳහා options පෙන්වන්නම්. පහළ ඇති item එකක් තෝරා ඒ සඳහා options බලන්න.`;
    }

    if (replyLanguage === "Singlish") {
      return `Yojitha item list eka:\n${itemList}\n\nMulinnama ${nextItem} walata options pennannam. Pahala thiyena item ekak thora eeta options balanna.`;
    }

    return `Suggested item list:\n${itemList}\n\nI will start by showing options for ${nextItem}. Select an item below to see options for that exact item.`;
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
    const latestMessage = messages.at(-1);
    const canFocusComposer =
      latestMessage?.role === "assistant" &&
      (conversationStage === "ready" || isSmartShoppingInitialView) &&
      !isSending &&
      !isImageProcessing &&
      !isVoiceProcessing &&
      !isRecording;

    if (!canFocusComposer) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    conversationStage,
    isImageProcessing,
    isRecording,
    isSending,
    isVoiceProcessing,
    isSmartShoppingInitialView,
    messages,
  ]);

  useEffect(() => {
    // Prepare CLIP after the UI is interactive. This is deliberately best
    // effort: a later upload still works if the host discards the warm instance.
    const timeoutId = window.setTimeout(() => {
      void fetch("/api/ai/image-search", { cache: "no-store" }).catch(() => {
        // Image search will report its own error when a user uploads a photo.
      });
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, []);

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
            storedMode === "Gift Card"
              ? "Gift Message"
              : storedMode === "Order Tracking"
                ? "Delivery Prediction"
                : storedMode === "Event Planner"
                  ? "Smart Shopping"
                : storedMode;
          const storedModeSessions = { ...(storedState.modeSessions ?? {}) };
          if (
            storedModeSessions["Order Tracking"] &&
            !storedModeSessions["Delivery Prediction"]
          ) {
            storedModeSessions["Delivery Prediction"] =
              storedModeSessions["Order Tracking"];
          }
          delete storedModeSessions["Order Tracking"];
          delete storedModeSessions["Event Planner"];
          const restoredSessions = normalizeModeSessions(
            storedModeSessions,
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
            recommendationSessionId: null,
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
          const storedSearchMode = storedState.searchMode as string | undefined;
          setSearchMode(
            storedSearchMode === "thinking" || storedSearchMode === "extended"
              ? "thinking"
              : "instant",
          );
          if (storedMode === "Gift Card") setGiftMessageToolTab("card");
          setLanguage(storedState.language);
          setModeSessions(nextRestoredSessions);
          setBuyBox(storedState.buyBox ?? []);
          setFavoriteProducts(storedState.favoriteProducts ?? []);
          setWishlistProducts(storedState.wishlistProducts ?? []);
          setPreviousOrders(storedState.previousOrders ?? []);
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
      favoriteProducts,
      previousOrders,
      input,
      initialCatalogVersion: INITIAL_CATALOG_VERSION,
      language,
      messages,
      buyBox,
      wishlistProducts,
      profile,
      productBatchIndex,
      recommendedProducts,
      searchMode,
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
          recommendationSessionId,
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
    favoriteProducts,
    previousOrders,
    input,
    isChatStateLoaded,
    language,
    messages,
    buyBox,
    wishlistProducts,
    modeSessions,
    pendingUserRequest,
    profile,
    productBatchIndex,
    recommendedProducts,
    recommendationSessionId,
    searchMode,
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
      try {
        setStatus("Loading starter products from the local catalog.");
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
        });
        const data = (await response.json()) as CommerceResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Starter product load failed.");
        }

        if (!data.products || data.products.length === 0) {
          throw new Error("The local starter catalog returned no products.");
        }

        if (!isMounted) {
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
      position: position >= 0 ? position + 1 : undefined,
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
    if (data.recommendationSessionId !== undefined) {
      setRecommendationSessionId(data.recommendationSessionId);
    }
    if (data.products) {
      setRecommendedProducts(
        activeMode.includes("Event") || activeMode.includes("Gift Box")
          ? data.products
          : data.products.slice(0, MAX_RANKED_PRODUCTS),
      );
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

    if (activeMode === "Smart Shopping") {
      const hasMoreProducts =
        (data.products?.length ?? recommendedProducts.length) >
        PRODUCT_BATCH_SIZE;
      setChips(hasMoreProducts ? ["Suggest more"] : []);
    } else if (data.chips) {
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
    forceProductSearch = false,
  ) {
    const requestProfile = normalizeShoppingProfile(profileOverride);
    const requestTask = taskOverride ?? getTaskForMode(mode);
    const requestRecommendationSessionId =
      mode === activeMode
        ? recommendationSessionId
        : (modeSessions[mode]?.recommendationSessionId ?? null);
    const pendingEvents = requestTask === "recommend" ? getPendingEvents() : [];
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);
    const requestBody = JSON.stringify({
      cartIds: buyBox.map((product) => product.id),
      conversationHistory: messages
        .filter(
          (message) => message.role === "user" || message.role === "assistant",
        )
        .slice(-3)
        .map(({ content, role }) => ({ content, role })),
      events: pendingEvents,
      forceProductSearch,
      language,
      mode,
      profile: requestProfile,
      preserveProfile,
      query,
      recommendationSessionId: requestRecommendationSessionId,
      searchMode,
      task: requestTask,
      userMessage,
      ...getPreferencePayloadForMode(mode, extendedPreferencesOverride),
    });

    try {
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
        throw new Error("GenieAI returned an invalid response. Please try again.");
      }

      const errorMessage = data?.error ?? "";
      const isEmptyResponse = !data || Object.keys(data).length === 0;

      if (isEmptyResponse) {
        throw new Error("GenieAI returned an empty response. Please try again.");
      }

      if (!data) {
        throw new Error("GenieAI returned an invalid response. Please try again.");
      }

      if (!response.ok) {
        throw new Error(errorMessage || "Commerce request failed.");
      }

      if (
        applyPreferenceUpdates &&
        !stripModelThinking(data.reply ?? "").trim()
      ) {
        throw new Error("GenieAI returned an empty reply. Please try again.");
      }

      applyCommerceResponse(data, applyPreferenceUpdates);
      if (
        requestTask === "recommend" &&
        data.productSearchPerformed !== false
      ) {
        clearPendingEvents(pendingEvents);
      }
      return data;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function runGuidedItemCommerce(
    query: string,
    planItems = guidedPlanItems,
    profileOverride = profile,
    preferencesOverride = extendedPreferences,
  ) {
    const itemCount = Math.max(1, planItems.length);
    const itemBudget = divideBudgetAcrossItems(
      preferencesOverride.budget || profileOverride.budget,
      itemCount,
    );
    const itemSearchTerm = query.trim();
    const modeCategory = activeMode.includes("Event")
      ? "Events"
      : profileOverride.category || preferencesOverride.giftType;

    return runCommerce(
      itemSearchTerm,
      activeMode,
      {
        ...profileOverride,
        budget: itemBudget,
        category: modeCategory,
      },
      false,
      itemSearchTerm,
      true,
      {
        ...preferencesOverride,
        budget: itemBudget,
        giftType: modeCategory,
      },
      "recommend",
      true,
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
      ? `Preferences selected: ${selectedContext.join(", ")}`
      : "Continue without context";
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
      content: {
        English:
          "I still need a few gift preferences. Could you choose the missing details below?",
        Sinhala:
          "Gift එක හොඳින් තෝරන්න තවත් preferences කිහිපයක් අවශ්‍යයි. පහළින් අඩු details තෝරන්න පුළුවන්ද?",
        Singlish:
          "Gift eka hondin thoranna thawa preferences tikak ona. Pahalin missing details thoranna puluwanda?",
      }[detectedLanguage],
      variant: "context-panel",
    });
    setStatus("Choose context chips or continue without context.");
  }

  function leaveInitialSmartShoppingView() {
    if (!isSmartShoppingInitialView) {
      return;
    }

    setIsComposerSettling(true);
    setConversationStage("ready");
  }

  async function answerWithCollectedContext(
    request: string,
    requestProfile: ShoppingProfile,
    requestDraft = contextDraft,
    requestExtendedPreferences = extendedPreferences,
  ) {
    setConversationStage("ready");
    setChips(activeMode === "Smart Shopping" ? [] : starterChips);
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
      );
      appendAssistantMessage(getGuidedPlanReply(planItems, 0, language));
      setChips(getGuidedReplyChips(planItems));
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
    // Typed requests go straight to search/chat. The preference setter is an
    // intentional, chip-driven entry flow rather than an automatic follow-up.
    setConversationStage("ready");
    setPendingUserRequest("");
    await handleReadyMessage(content, profile, extendedPreferences);
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

  function handleSidebarPreferenceSubmit() {
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
    setProfile(nextProfile);
    setExtendedPreferences(nextExtendedPreferences);
    // Sidebar preferences are global. Keep every saved mode session in sync so
    // moving between modes or restoring the chat cannot revive an older profile.
    setModeSessions((current) =>
      Object.fromEntries(
        Object.entries(current).map(([mode, session]) => [
          mode,
          {
            ...session,
            extendedPreferences: syncExtendedPreferencesWithProfile(
              session.extendedPreferences ??
                getExtendedPreferencesFromProfile(session.profile),
              nextProfile,
            ),
            profile: nextProfile,
          },
        ]),
      ),
    );
    setPendingUserRequest("");
    setStatus("Preferences updated. They will be used for your next query.");
  }

  function toggleFavorite(product: Product) {
    const isFavorite = favoriteProducts.some((item) => item.id === product.id);
    trackProductInteraction(isFavorite ? "unfavorite" : "favorite", product);
    setFavoriteProducts((current) =>
      isFavorite
        ? current.filter((item) => item.id !== product.id)
        : [product, ...current.filter((item) => item.id !== product.id)],
    );
  }

  function toggleWishlist(product: Product) {
    const isWishlisted = wishlistProducts.some((item) => item.id === product.id);
    trackProductInteraction(
      isWishlisted ? "remove_from_wishlist" : "wishlist",
      product,
    );
    setWishlistProducts((current) =>
      isWishlisted
        ? current.filter((item) => item.id !== product.id)
        : [product, ...current.filter((item) => item.id !== product.id)],
    );
  }

  async function handleGuidedCustomMessage(content: string) {
    setStatus("Groq is analyzing your message.");
    const commerceData = await runCommerce(
      content,
      activeMode,
      profile,
      true,
      content,
      false,
      extendedPreferences,
      "recommend",
    );
    appendAssistantMessage(getCommerceReply(commerceData));
    setChips(
      commerceData.productSearchPerformed === false
        ? []
        : getGuidedReplyChips(),
    );
    setStatus(
      commerceData.productSearchPerformed === false
        ? "GenieAI replied without searching products."
        : "Related guided options loaded.",
    );
  }

  async function handleGuidedPlanItem(item: GuidedPlanItem, index: number) {
    if (isSending) {
      return;
    }

    setIsSending(true);
    setActivityMessage(text.processing);
    setGuidedPlanIndex(index);

    try {
      setRecommendedProducts([]);
      setFitReasons({});
      // Search the plan label itself rather than a broad category, so a chip
      // such as "chocolate truffle cake" remains an exact product query.
      await runGuidedItemCommerce(item.label);
      setChips(getGuidedReplyChips());
      setStatus(`Options for ${item.label} loaded.`);
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setActivityMessage("");
      setIsSending(false);
    }
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

  function handleSuggestMoreGuidedItem() {
    if (isSending || guidedPlanItems.length === 0) {
      return;
    }

    const nextBatchIndex = productBatchIndex + 1;
    const nextBatchStart = nextBatchIndex * PRODUCT_BATCH_SIZE;
    if (nextBatchStart >= recommendedProducts.length) {
      setChips((current) => current.filter((chip) => chip !== "Suggest more"));
      return;
    }

    const shownFrom = nextBatchStart + 1;
    const shownTo = Math.min(
      nextBatchStart + PRODUCT_BATCH_SIZE,
      recommendedProducts.length,
    );
    const isFinalBatch = shownTo >= recommendedProducts.length;
    setProductBatchIndex(nextBatchIndex);
    if (isFinalBatch) {
      setChips((current) => current.filter((chip) => chip !== "Suggest more"));
    }
    setStatus(
      isFinalBatch
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
    if (nextBatchStart >= recommendedProducts.length) {
      setChips((current) => current.filter((chip) => chip !== "Suggest more"));
      return;
    }

    const shownTo = Math.min(
      nextBatchStart + PRODUCT_BATCH_SIZE,
      recommendedProducts.length,
    );
    const isFinalBatch = shownTo >= recommendedProducts.length;
    setProductBatchIndex(nextBatchIndex);
    if (isFinalBatch) {
      setChips((current) => current.filter((chip) => chip !== "Suggest more"));
    }
    setStatus(
      isFinalBatch
        ? "All matched products have been shown."
        : `Showing ranked products 1-${shownTo}.`,
    );
  }

  function handleChipClick(chip: string) {
    if (isGuidedMode) {
      const itemIndex = guidedPlanItems.findIndex(
        (item) => item.label === chip,
      );
      if (itemIndex >= 0) {
        void handleGuidedPlanItem(guidedPlanItems[itemIndex], itemIndex);
        return;
      }
    }

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

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];

    if (isSmartShoppingInitialView) {
      setIsComposerSettling(true);
    }
    if (activeMode === "Smart Shopping") {
      setProductBatchIndex(0);
    }
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
        // Only a starter chip opens the preference setter. It is shown before
        // search so the shopper can confirm or change its prefilled values.
        showContextPanel(nextProfile, language);
      } else if (activeMode.includes("Event") || activeMode.includes("Gift Box")) {
        await handleGuidedCustomMessage(content);
      } else {
        await handleFirstMessage(content);
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
      setIsGiftMessageCheckoutNoticeVisible(true);
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
      const requestCard = async () => {
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
        const data = (await response.json().catch(() => ({}))) as GiftCardResponse;
        return { data, response };
      };

      let { data, response } = await requestCard();
      const shouldRetry =
        !response.ok && [502, 503, 504].includes(response.status);
      if (shouldRetry || (response.ok && !data.imageDataUrl)) {
        // The first vision request can race a cold model or return malformed
        // structured output. This endpoint is safe to retry once.
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        ({ data, response } = await requestCard());
      }

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
      if (data.message?.trim()) {
        setGiftMessage(data.message.trim());
        setIsGiftMessageCheckoutNoticeVisible(true);
      }
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

  function handleClearHistory() {
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
    setStatus("Completing your order.");

    /*
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
    */

    const completedOrder: PreviousOrder = {
      createdAt: new Date().toISOString(),
      delivery: totals.delivery,
      id: crypto.randomUUID(),
      items: [...buyBox],
      subtotal: totals.subtotal,
      total: totals.total,
    };
    setPreviousOrders((current) => [completedOrder, ...current].slice(0, 25));
    buyBox.forEach((product) => trackProductInteraction("purchase", product));
    setBuyBox([]);
    setGiftCardProductId("");
    setCheckoutWarning("");
    setIsCheckoutCreating(false);
    setIsCheckoutModalOpen(false);
    setIsOrderCompletedOpen(true);
    setStatus("Order completed. Your cart has been cleared.");
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    leaveInitialSmartShoppingView();
    setIsComposerMenuOpen(false);
    setActivityMessage(text.uploadingImage);
    setIsImageProcessing(true);
    setStatus("Searching for visually similar gifts.");

    try {
      const searchFormData = new FormData();
      searchFormData.append("image", file);
      const analysisFormData = new FormData();
      analysisFormData.append("image", file);

      // Visual retrieval and Groq's description are deliberately independent:
      // a vision-model failure must not prevent catalog RAG results from showing.
      const searchRequest = fetch("/api/ai/image-search", {
        method: "POST",
        body: searchFormData,
      });
      const analysisRequest = fetch("/api/ai/image-analysis", {
        method: "POST",
        body: analysisFormData,
      });

      const [searchResult, analysisResult] = await Promise.allSettled([
        searchRequest,
        analysisRequest,
      ]);

      if (searchResult.status === "rejected") {
        throw searchResult.reason;
      }

      const searchResponse = searchResult.value;
      const searchData = (await searchResponse.json()) as ImageSearchResponse;

      if (!searchResponse.ok) {
        throw new Error(searchData.error ?? "Image vector search failed.");
      }

      let imageDetails = "";
      if (analysisResult.status === "fulfilled") {
        const analysisResponse = analysisResult.value;
        const analysisData = (await analysisResponse.json()) as ImageResponse;
        if (
          analysisResponse.ok &&
          !analysisData.fallback &&
          analysisData.summary?.trim()
        ) {
          imageDetails = analysisData.summary.trim();
        }
      }

      const imageDescription = imageDetails
        ? `${text.imageLooksLike}: ${imageDetails.replace(/[.!?]+$/u, "")}. `
        : "";

      if (!searchData.lowConfidence && searchData.products.length > 0) {
        setRecommendedProducts(
          searchData.products.slice(0, MAX_RANKED_PRODUCTS),
        );
        setProductBatchIndex(0);
        setFitReasons({});
        addMessage({
          role: "assistant",
          content:
            `${imageDescription}I found these gifts by visual similarity to your image. Note: your selected preferences are not applied to visual search.`,
        });
        setStatus("Visual product search complete. GenieAI products updated.");
      } else {
        setRecommendedProducts([]);
        setProductBatchIndex(0);
        setFitReasons({});
        addMessage({
          role: "assistant",
          content:
            `${imageDescription}No matching products were found in our system. Try searching for cakes, flowers, chocolates, perfumes, or another gift category.`,
        });
        setStatus("No matching products were found in our system.");
      }
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
      leaveInitialSmartShoppingView();
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
        allowSkip={!activeMode.includes("Gift Box")}
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
        options={getContextFieldOptionsForMode(activeMode)}
      />
    );
  }

  const productSection =
    shouldShowProductSuggestions &&
    !isFormToolMode &&
    (isLoadingInitialProducts || visibleProducts.length > 0) ? (
    <div className="mt-2 md:ml-[54px] md:mt-5">
      <ProductGrid
        addLabel={text.addToBuyBox}
        cartIds={new Set(buyBox.map((product) => product.id))}
        compareIds={compareSelectionIds}
        emptyLabel={text.initialEmpty}
        favoriteIds={new Set(favoriteProducts.map((product) => product.id))}
        formatPrice={formatPrice}
        isLoading={isLoadingInitialProducts}
        onAdd={addToBuyBox}
        onCompare={toggleCompareSelection}
        onFavorite={toggleFavorite}
        onView={viewProduct}
        onWishlist={toggleWishlist}
        horizontal={isGuidedMode}
        products={visibleProducts}
        viewLabel={text.productView}
        wishlistIds={new Set(wishlistProducts.map((product) => product.id))}
      />
      {activeMode === "Smart Shopping" && hasMoreRecommendedProducts ? (
        <button
          type="button"
          onClick={handleSuggestMoreShopping}
          disabled={isSending}
          className="mt-4 rounded-full border border-[#3D74B8] bg-white px-4 py-2 text-xs font-semibold text-[#1E4D8C] transition hover:bg-[#E7EEF7] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {getChipLabel("Suggest more")}
        </button>
      ) : null}
    </div>
  ) : null;

  const replyChipSection = (
    <ReplyChips
      chips={visibleReplyChips}
      getLabel={getChipLabel}
      onSelect={handleChipClick}
      underMessage={isGuidedMode}
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

  const composerSection = !isFormToolMode && !isGuidedMode ? (
    <Composer
      animatedPlaceholders={suggestedPromptTexts}
      animatePlaceholder={isSmartShoppingInitialView}
      disabled={isSending || isVoiceProcessing || isImageProcessing}
      formRef={composerRef}
      imageInputRef={imageInputRef}
      inputRef={composerInputRef}
      isRecording={isRecording}
      onDismissSuggestedPrompts={() => setIsPromptPopupOpen(false)}
      onFocus={() => {
        setIsPromptPopupOpen(false);
      }}
      onImage={(event) => void handleImageChange(event)}
      onInput={(value) => {
        setInput(value);
        setIsPromptPopupOpen(false);
      }}
      onSuggestedPrompts={() => setIsPromptPopupOpen((current) => !current)}
      onSubmit={(event) => void handleSubmit(event)}
      onVoice={() => {
        if (!isRecording) void startRecording();
      }}
      placeholder={text.askPlaceholder}
      searchMode={searchMode}
      sendLabel={isSending ? text.sending : text.send}
      setSearchMode={setSearchMode}
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
  );

  const initialAssistantMessage = messages.find(
    (message) => message.role === "assistant",
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
          onOpenPreferences={() => setIsLeftPanelOpen(true)}
        />
      }
      navigation={
        <NavigationRail
          activeMode={activeMode}
          modes={modes}
          onModeChange={handleModeChange}
        />
      }
      composer={
        isSmartShoppingInitialView ? (
          <div />
        ) : (
          <div
            className={
              isComposerSettling ? "genie-composer-settle" : undefined
            }
          >
            {composerSection}
          </div>
        )
      }
      overlays={
        <>
          {processingOverlay}
          {isGiftMessageCheckoutNoticeVisible ? <div role="status" aria-live="polite" className="fixed right-4 top-20 z-[130] flex max-w-sm items-start gap-3 rounded-xl border border-[#B7DEC3] bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(10,31,58,.45)]"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#E7F5EC] text-sm font-bold text-[#267044]">✓</span><p className="text-xs font-semibold leading-5 text-[#1F5C38]">Gift message saved. It will appear in the checkout form.</p><button type="button" onClick={() => setIsGiftMessageCheckoutNoticeVisible(false)} className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#5D8369] hover:bg-[#E7F5EC]" aria-label="Dismiss notification">×</button></div> : null}
          <WelcomePanel open={isIntroPanelVisible} onClose={closeIntroPanel} />
          <ProductDialog
            formatPrice={formatPrice}
            onClose={() => setSelectedProduct(null)}
            product={selectedProduct}
          />
          <CartDrawer
            canCheckout={buyBox.length > 0}
            checkoutLabel="Checkout"
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
            onBudgetPreset={syncSidebarBudgetDraft}
            onClose={() => setIsLeftPanelOpen(false)}
            open={isLeftPanelOpen}
            profile={profile}
            recipients={recipientOptions}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
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
            submitLabel="Complete order"
            warning={checkoutWarning}
          />
          <OrderCompletedDialog open={isOrderCompletedOpen} onClose={() => setIsOrderCompletedOpen(false)} />
        </>
      }
    >
      <div className="relative h-full">
        <ChatThread
          activityMessage={activityMessage}
          chatRef={chatScrollContainerRef}
          contentOverride={
            isSmartShoppingInitialView ? (
              <div className="flex min-h-[calc(100dvh-128px)] items-center justify-center px-4 py-10 sm:px-8">
                <div className="w-full max-w-6xl -translate-y-[4vh]">
                  <div className="mx-auto max-w-3xl">
                    {initialAssistantMessage ? (
                      <div className="mb-5 text-center">
                        <div className="mx-auto max-w-2xl text-base leading-7 text-[#3E4A56] sm:text-lg">
                          {renderChatMessage(initialAssistantMessage.content)}
                        </div>
                      </div>
                    ) : null}
                    {composerSection}
                    <div className="px-4 sm:px-7">
                      <ReplyChips
                        chips={chips}
                        centered
                        getLabel={getChipLabel}
                        onSelect={handleChipClick}
                        underMessage
                      />
                    </div>
                  </div>
                  {recommendedProducts.length > 0 ? (
                    <div className="mt-7">
                      <ProductGrid
                        addLabel={text.addToBuyBox}
                        cartIds={new Set(buyBox.map((product) => product.id))}
                        compareIds={compareSelectionIds}
                        emptyLabel={text.initialEmpty}
                        favoriteIds={new Set(favoriteProducts.map((product) => product.id))}
                        formatPrice={formatPrice}
                        isLoading={false}
                        onAdd={addToBuyBox}
                        onCompare={toggleCompareSelection}
                        onFavorite={toggleFavorite}
                        onView={viewProduct}
                        onWishlist={toggleWishlist}
                        products={recommendedProducts.slice(0, PRODUCT_BATCH_SIZE)}
                        viewLabel={text.productView}
                        wishlistIds={new Set(wishlistProducts.map((product) => product.id))}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : isCompareMode ? (
              <div className="mx-auto w-full max-w-6xl">
                {renderCompareTool()}
              </div>
            ) : isGiftMessageMode ? (
              <div className="mx-auto -mt-3 h-full w-full max-w-5xl sm:-mt-4">
                {renderGiftMessageTool()}
              </div>
            ) : isDeliveryPredictionMode ? (
              <OrderTrackingTool cities={mainDeliveryCities} products={buyBox} />
            ) : isProfileMode ? (
              <ProfilePanel
                addLabel={text.addToBuyBox}
                cartIds={new Set(buyBox.map((product) => product.id))}
                compareIds={compareSelectionIds}
                favoriteIds={new Set(favoriteProducts.map((product) => product.id))}
                favorites={favoriteProducts}
                formatPrice={formatPrice}
                onAdd={addToBuyBox}
                onCompare={toggleCompareSelection}
                onFavorite={toggleFavorite}
                onView={viewProduct}
                onWishlist={toggleWishlist}
                previousOrders={previousOrders}
                viewLabel={text.productView}
                wishlist={wishlistProducts}
                wishlistIds={new Set(wishlistProducts.map((product) => product.id))}
              />
            ) : undefined
          }
          contextPanel={renderContextPanel}
          assistantFooter={isGuidedMode ? replyChipSection : undefined}
          conversationStage={conversationStage}
          footer={
            <>
              {!isGuidedMode ? replyChipSection : null}
              {productSection}
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
          showReadAloud={!activeMode.includes("Gift")}
          switchEnglishLabel={getSwitchToEnglishLabel()}
          tryAgainLabel={getTryAgainLabel()}
        />
      </div>
    </GenieShell>
  );
}
