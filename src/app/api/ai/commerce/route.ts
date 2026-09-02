import { NextResponse } from "next/server";
import { asRecord, getNumber, getString } from "@/lib/aiPayload";
import { getGroqApiKey, getMissingGroqKeyMessage } from "@/lib/groqHosted";
import {
  getHuggingFaceApiKey,
  getHuggingFaceNovitaReply,
} from "@/lib/huggingFaceNovita";
import {
  commerceTools,
  createCommerceMcpClient,
  getCommerceMcpUrl,
} from "@/lib/commerceMcp";
import { getOrCreatePersonalizationSessionId } from "@/lib/personalization/identity";
import { type Product, toProduct } from "@/lib/productCatalog";
import { getRandomInitialProducts } from "@/lib/initialProductCatalog";
import { rerankProducts } from "@/lib/reranking/service";
import {
  getGroqMessageAnalysis,
  shouldSearchProductsLocally,
} from "./analysis";
import {
  fetchPythonRankedProducts,
  getBudgetSearchReply,
  searchCatalogProducts,
  searchProductsByIds,
  withTimeout,
} from "./catalog";
import {
  checkDelivery,
  createCheckoutOrder,
  getCanonicalCity,
  getMissingCheckoutFields,
  parseCheckoutDetails,
} from "./checkout";
import {
  getDeterministicCompareSummary,
  getDeterministicComparisonInsights,
  getGroqComparisonInsights,
} from "./comparison";
import { getGroqCommerce } from "./commerce";
import {
  MAX_RANKED_PRODUCTS,
  SUPPORTED_TASKS,
  fallbackResponse,
} from "./constants";
import {
  getGroqGiftMessage,
  getGroqProductPageReply,
  getProductPageReplyFallback,
} from "./generation";
import {
  formatBudgetFilter,
  getClientPreferences,
  getExtendedSearchProfile,
  getFreshProfile,
  getReplyPreferenceProfile,
  getSearchQuery,
  hasBudgetFilter,
  inferBudgetPreference,
  inferMessageIntent,
  inferOccasionPreference,
  inferRecipientPreference,
  isProductInsideBudget,
  mergeExtendedPreferences,
  normalizeAnalyzedSearchQuery,
  normalizeDetectedLanguage,
  parseBudgetFilter,
  parseExtendedPreferences,
} from "./preferences";
import {
  fallbackRecommendations,
  orderProductsByRecommendation,
  parseGiftMessagePreferences,
} from "./recommendations";
import {
  getLocalAnalytics,
  getLocalDeliveryRuleReply,
  getPreferenceResponseForMode,
  getRandomInitialChips,
  getShoppingReplyChips,
  getSubmittedPreferenceRecord,
  isDeliveryRequested,
  parseConversationHistory,
  parseProfile,
  parseRankingEvents,
  parseStringArray,
  parseUserChatHistory,
} from "./request";
import type { MessageAnalysis } from "./types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const bodyRecord = asRecord(body);
  const task = getString(bodyRecord, "task") ?? "recommend";
  const mode = getString(bodyRecord, "mode") ?? "Smart Shopping";

  if (!SUPPORTED_TASKS.has(task)) {
    return NextResponse.json(
      { error: "Unsupported commerce task." },
      { status: 400 },
    );
  }

  const language = normalizeDetectedLanguage(
    getString(bodyRecord, "language"),
    "English",
  );
  const query = getString(bodyRecord, "query") ?? "";
  const userMessage = getString(bodyRecord, "userMessage") ?? query;
  const preserveProfile = bodyRecord?.preserveProfile === true;
  const forceProductSearch = bodyRecord?.forceProductSearch === true;
  const cartIds = parseStringArray(bodyRecord?.cartIds, 30);
  const requestedProductIds = parseStringArray(bodyRecord?.productIds, 3);
  const rankingEvents = parseRankingEvents(bodyRecord?.events).map((event) => ({
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  }));
  const conversationHistory = parseConversationHistory(
    bodyRecord?.conversationHistory,
  );
  const chatHistory =
    mode.includes("Event") || mode.includes("Gift Box")
      ? null
      : parseUserChatHistory(bodyRecord?.chatHistory);
  const profile = parseProfile(bodyRecord?.profile);
  const submittedExtendedPreferences = parseExtendedPreferences(
    getSubmittedPreferenceRecord(bodyRecord, mode),
    profile,
  );
  const checkout = parseCheckoutDetails(bodyRecord?.checkout);
  const giftMessagePreferences = parseGiftMessagePreferences(
    bodyRecord?.giftMessagePreferences,
  );

  try {
    if (task === "productPageReply") {
      const exhausted = bodyRecord?.exhausted === true;
      const shownFrom = Math.max(
        1,
        Math.round(getNumber(bodyRecord, "shownFrom") ?? 1),
      );
      const shownTo = Math.max(
        shownFrom,
        Math.round(getNumber(bodyRecord, "shownTo") ?? shownFrom),
      );
      const total = Math.max(
        0,
        Math.round(getNumber(bodyRecord, "total") ?? 0),
      );
      const apiKey = getGroqApiKey();
      const fallbackReply = getProductPageReplyFallback(language, exhausted);
      const aiReply = apiKey
        ? await getGroqProductPageReply(apiKey, language, {
            exhausted,
            mode,
            profile,
            query,
            shownFrom,
            shownTo,
            total,
          }).catch(() => "")
        : "";

      return NextResponse.json({
        ...fallbackResponse,
        chips: exhausted ? [] : ["Suggest more"],
        mode,
        products: [],
        recommendations: [],
        reply: aiReply || fallbackReply,
      });
    }

    if (task === "giftMessage") {
      const apiKey = getGroqApiKey();
      const huggingFaceApiKey = getHuggingFaceApiKey();
      const useNovitaGiftMessage =
        giftMessagePreferences.language?.trim().toLowerCase() !== "english";
      const novitaMessage =
        useNovitaGiftMessage && huggingFaceApiKey
          ? await getHuggingFaceNovitaReply(huggingFaceApiKey, {
              messages: [
                {
                  role: "system",
                  content:
                    "Write one fresh, polished gift-card message in the explicitly requested language. Sinhala must use natural Sinhala script. Singlish must be natural conversational Sinhala written only with Latin letters. Respect the requested size, tone, recipient, occasion, and suggestions. Return only the finished gift message with no label, JSON, quotation marks, or explanation.",
                },
                {
                  role: "user",
                  content: JSON.stringify({
                    preferences: giftMessagePreferences,
                    profile,
                  }),
                },
              ],
              temperature: 0.45,
              max_tokens: 400,
            })
          : null;
      const message =
        novitaMessage?.trim() ||
        (apiKey
          ? await getGroqGiftMessage(apiKey, profile, giftMessagePreferences)
          : "");

      if (apiKey && !message) {
        return NextResponse.json(
          {
            error:
              "Groq did not return a valid updated gift message. Please try again.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        ...fallbackResponse,
        chips: [],
        giftMessage:
          message ||
          "Wishing you a wonderful day filled with love, joy, and beautiful memories.",
        mode,
        products: [],
        reply: "Gift message generated.",
      });
    }

    if (task === "checkout") {
      const mcp = await createCommerceMcpClient();
      const missingFields = getMissingCheckoutFields(
        cartIds,
        profile,
        checkout,
      );

      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            error: `Add ${missingFields.join(", ")} before creating a checkout link.`,
          },
          { status: 400 },
        );
      }

      const order = await createCheckoutOrder(mcp, cartIds, profile, checkout);

      return NextResponse.json({
        ...fallbackResponse,
        analytics: {
          buyBoxHealth: "Checkout link created",
          conversionSignal: "Ready for payment",
          nextBestAction: "Open the click-to-pay URL",
          risk: "Checkout link expires after 60 minutes",
        },
        checkout: order,
        chips: [],
        mode,
        products: [],
        reply: order.checkout_url
          ? "GenieAI created a guest-checkout link."
          : (order.result ?? "GenieAI returned checkout details."),
      });
    }

    const productIdsForCompare = task === "compare" ? requestedProductIds : [];
    const apiKey = getGroqApiKey();
    const messageAnalysisPromise =
      apiKey && task !== "initial" && productIdsForCompare.length < 2
        ? withTimeout(
            getGroqMessageAnalysis(
              apiKey,
              language,
              mode,
              query,
              userMessage,
              conversationHistory,
            ),
            4000,
          ).catch(() => null)
        : Promise.resolve(null);
    const messageAnalysis = await messageAnalysisPromise;
    const locallyDetectedBudget = inferBudgetPreference(userMessage);
    const locallyDetectedOccasion = inferOccasionPreference(userMessage);
    const locallyDetectedRecipient = inferRecipientPreference(userMessage);
    const resolvedMessageAnalysis: MessageAnalysis = messageAnalysis
      ? {
          ...messageAnalysis,
          detectedLanguage: language,
          preferences: {
            ...messageAnalysis.preferences,
            budget: locallyDetectedBudget ?? messageAnalysis.preferences.budget,
            occasion:
              locallyDetectedOccasion ?? messageAnalysis.preferences.occasion,
            recipient:
              locallyDetectedRecipient ?? messageAnalysis.preferences.recipient,
          },
        }
      : {
          detectedLanguage: language,
          extendedPreferences: {
            budget: null,
            giftType: null,
            occasion: null,
            recipient: null,
          },
          intent: inferMessageIntent(query),
          preferences: {
            budget: locallyDetectedBudget,
            category: null,
            occasion: locallyDetectedOccasion,
            recipient: locallyDetectedRecipient,
            requestedGiftType: null,
          },
          requiresProductSearch: shouldSearchProductsLocally(userMessage),
          searchQuery: null,
        };
    const effectiveProfile = preserveProfile
      ? profile
      : getFreshProfile(profile, resolvedMessageAnalysis.preferences);
    const isGuidedRecommendation =
      task === "recommend" &&
      (mode.includes("Event") || mode.includes("Gift Box"));
    const effectiveExtendedPreferences = isGuidedRecommendation
      ? submittedExtendedPreferences
      : mergeExtendedPreferences(
          submittedExtendedPreferences,
          resolvedMessageAnalysis.extendedPreferences,
          resolvedMessageAnalysis.preferences,
        );
    const searchProfile = getExtendedSearchProfile(
      effectiveProfile,
      effectiveExtendedPreferences,
    );
    const replyPreferenceProfile = getReplyPreferenceProfile(
      searchProfile,
      effectiveExtendedPreferences,
      resolvedMessageAnalysis,
    );
    const activeBudgetFilter = parseBudgetFilter(
      effectiveExtendedPreferences.budget,
    );
    const searchQuery =
      productIdsForCompare.length >= 2
        ? productIdsForCompare.join(" ")
        : isGuidedRecommendation
          ? query
          : effectiveExtendedPreferences.giftType ||
            (messageAnalysis
              ? normalizeAnalyzedSearchQuery(
                  resolvedMessageAnalysis.searchQuery ||
                    resolvedMessageAnalysis.preferences.requestedGiftType,
                  searchProfile,
                )
              : getSearchQuery(query, searchProfile, mode));

    if (
      task === "recommend" &&
      !forceProductSearch &&
      isDeliveryRequested(userMessage)
    ) {
      return NextResponse.json({
        ...fallbackResponse,
        analytics: {
          buyBoxHealth: "Delivery policy provided",
          conversionSignal: "Delivery information request",
          nextBestAction: "Order at least one day before delivery",
          risk: "Orders placed less than one day ahead cannot be delivered on time",
        },
        chips: [],
        delivery: null,
        mode,
        productSearchPerformed: false,
        products: [],
        recommendations: [],
        reply: getLocalDeliveryRuleReply(
          resolvedMessageAnalysis.detectedLanguage,
        ),
      });
    }

    if (task === "eventPlan" || task === "giftBox") {
      if (!apiKey) {
        return NextResponse.json(
          { error: getMissingGroqKeyMessage() },
          { status: 500 },
        );
      }

      const commerce = await getGroqCommerce(
        apiKey,
        resolvedMessageAnalysis.detectedLanguage,
        mode,
        task,
        query,
        userMessage,
        [],
        null,
        replyPreferenceProfile,
        resolvedMessageAnalysis,
        searchQuery,
        null,
        conversationHistory,
      );

      if (commerce instanceof NextResponse) {
        return commerce;
      }

      return NextResponse.json({
        ...commerce,
        analytics: getLocalAnalytics({
          delivery: null,
          deliveryRequested: false,
          intent: resolvedMessageAnalysis.intent,
          products: [],
          profile: replyPreferenceProfile,
          recommendations: [],
        }),
        chips: [],
        delivery: null,
        mode,
        products: [],
        recommendations: [],
      });
    }

    if (
      task === "recommend" &&
      !forceProductSearch &&
      !resolvedMessageAnalysis.requiresProductSearch
    ) {
      if (!apiKey) {
        return NextResponse.json(
          { error: getMissingGroqKeyMessage() },
          { status: 500 },
        );
      }

      const commerce = await getGroqCommerce(
        apiKey,
        resolvedMessageAnalysis.detectedLanguage,
        mode,
        "reply",
        query,
        userMessage,
        [],
        null,
        replyPreferenceProfile,
        resolvedMessageAnalysis,
        "",
        null,
        conversationHistory,
      );

      if (commerce instanceof NextResponse) {
        return commerce;
      }

      return NextResponse.json({
        ...commerce,
        analytics: getLocalAnalytics({
          delivery: null,
          deliveryRequested: false,
          intent: resolvedMessageAnalysis.intent,
          products: [],
          profile: replyPreferenceProfile,
          recommendations: [],
        }),
        chips: [],
        delivery: null,
        mode,
        productSearchPerformed: false,
        products: [],
        recommendations: [],
      });
    }

    if (task === "recommend") {
      const sessionId = await getOrCreatePersonalizationSessionId();
      const candidates = await fetchPythonRankedProducts({
        chatHistory,
        profile: searchProfile,
        query,
        sessionId,
      });
      const ranking = await rerankProducts({
        events: rankingEvents,
        products: candidates,
        query,
        sessionId,
      });
      const products = ranking.products;

      if (!apiKey) {
        return NextResponse.json(
          { error: getMissingGroqKeyMessage() },
          { status: 500 },
        );
      }

      const commerce = await getGroqCommerce(
        apiKey,
        resolvedMessageAnalysis.detectedLanguage,
        mode,
        task,
        query,
        userMessage,
        products,
        null,
        replyPreferenceProfile,
        resolvedMessageAnalysis,
        searchQuery,
        null,
        conversationHistory,
      );

      if (commerce instanceof NextResponse) {
        return commerce;
      }

      const recommendations =
        commerce.recommendations.length > 0
          ? commerce.recommendations
          : fallbackRecommendations(products);

      return NextResponse.json({
        ...commerce,
        analytics: getLocalAnalytics({
          delivery: null,
          deliveryRequested: false,
          intent: resolvedMessageAnalysis.intent,
          products,
          profile: replyPreferenceProfile,
          recommendations,
        }),
        chips:
          mode.includes("Event") || mode.includes("Gift Box")
            ? ["Next item", "Suggest more"]
            : getShoppingReplyChips(),
        delivery: null,
        mode,
        productSearchPerformed: true,
        products,
        ranking: {
          fallback: ranking.fallback,
          source: ranking.source,
        },
        recommendations,
      });
    }

    if (task === "initial") {
      // The welcome grid is intentionally a small random sample of the entire
      // local catalog, rather than a category-specific collection.
      const products = await getRandomInitialProducts(4);
      const recommendations = fallbackRecommendations(products);

      return NextResponse.json({
        ...fallbackResponse,
        analytics: {
          buyBoxHealth: "Random saved products loaded",
          conversionSignal: "Starter catalog is ready",
          nextBestAction: "Ask for the gift recipient and budget",
          risk: "Saved catalog availability may differ from live availability",
        },
        catalog: {
          source: "local",
          strategy: "four-random-in-stock-local-products",
        },
        chips: [],
        delivery: null,
        mode,
        products,
        recommendations,
        reply: "GenieAI loaded products.",
      });
    }

    const mcp = await createCommerceMcpClient();
    const deliveryRequested = isDeliveryRequested(userMessage);
    const canonicalCityPromise =
      deliveryRequested && effectiveProfile.city
        ? getCanonicalCity(mcp, effectiveProfile.city).catch(() => null)
        : Promise.resolve(null);
    const productSearchPromise =
      productIdsForCompare.length >= 2
        ? searchProductsByIds(mcp, productIdsForCompare).then((results) => ({
            productSearch: null,
            results,
          }))
        : searchCatalogProducts(
            mcp,
            searchQuery,
            searchProfile,
            hasBudgetFilter(activeBudgetFilter)
              ? `${query} ${formatBudgetFilter(activeBudgetFilter)}`
              : query,
          ).then((productSearch) => ({
            productSearch,
            results: productSearch.results,
          }));
    const [searchOutcome, canonicalCity] = await Promise.all([
      productSearchPromise,
      canonicalCityPromise,
    ]);
    const { productSearch, results: searchResults } = searchOutcome;
    const normalizedProducts = searchResults
      .map((product) => toProduct(product))
      .filter((product): product is Product => product !== null);
    const products =
      task === "compare" || !hasBudgetFilter(activeBudgetFilter)
        ? normalizedProducts
        : normalizedProducts.filter((product) =>
            isProductInsideBudget(product, activeBudgetFilter),
          );

    if (task === "compare" && productIdsForCompare.length >= 2) {
      if (products.length < 2) {
        return NextResponse.json({
          ...fallbackResponse,
          analytics: {
            buyBoxHealth: "Comparison needs real product IDs",
            conversionSignal: "Missing product match",
            nextBestAction: "Copy IDs from Smart Shopping product cards",
            risk: "One or more IDs did not match live catalog products",
          },
          chips: [],
          mode,
          products,
          recommendations: [],
          reply:
            "I could not match two live catalog products. Select products shown on the product cards in Smart Shopping mode.",
        });
      }

      const apiKey = getGroqApiKey();
      const aiInsights = apiKey
        ? await withTimeout(
            getGroqComparisonInsights(
              apiKey,
              language,
              products.slice(0, 2),
              profile,
            ),
            6000,
          ).catch(() => [])
        : [];
      const comparisonInsights =
        aiInsights.length === products.slice(0, 2).length
          ? aiInsights
          : getDeterministicComparisonInsights(products, profile);
      const finalComparison = getDeterministicCompareSummary(
        products.slice(0, 2),
      );

      return NextResponse.json({
        ...fallbackResponse,
        analytics: {
          buyBoxHealth: "Comparison ready",
          conversionSignal: "User is evaluating products",
          nextBestAction: "Review the AI suggestion field",
          risk:
            products.length < 2
              ? "Some product IDs did not return matches"
              : "Live catalog can change",
        },
        chips: [],
        comparisonInsights,
        mode,
        products: products.slice(0, 3),
        recommendations: products.slice(0, 3).map((product) => ({
          fitScore: 80,
          id: product.id,
          reason: finalComparison,
        })),
        reply: finalComparison,
      });
    }

    const productIdForDelivery = products[0]?.id ?? cartIds[0];
    const delivery =
      deliveryRequested && effectiveProfile.city && canonicalCity
        ? await checkDelivery(
            mcp,
            effectiveProfile,
            productIdForDelivery,
            canonicalCity,
          ).catch(() => null)
        : null;

    if (products.length === 0 && !apiKey) {
      return NextResponse.json({
        ...fallbackResponse,
        analytics: {
          buyBoxHealth: "No live products found",
          conversionSignal: "Search needs refinement",
          nextBestAction: "Try another specific keyword",
          risk: "The live catalog returned no purchasable products",
        },
        chips: [],
        delivery,
        mode,
        products: [],
        reply:
          productSearch && hasBudgetFilter(productSearch.budgetFilter)
            ? getBudgetSearchReply(productSearch, 0)
            : `GenieAI did not find products for "${searchQuery}".`,
      });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: getMissingGroqKeyMessage() },
        { status: 500 },
      );
    }

    const commerce = await getGroqCommerce(
      apiKey,
      resolvedMessageAnalysis.detectedLanguage,
      mode,
      task,
      query,
      userMessage,
      products,
      delivery,
      replyPreferenceProfile,
      resolvedMessageAnalysis,
      searchQuery,
      productSearch,
      conversationHistory,
    );

    if (commerce instanceof NextResponse) {
      return commerce;
    }

    const recommendations =
      commerce.recommendations.length > 0
        ? commerce.recommendations
        : fallbackRecommendations(products);
    const recommendationProducts = orderProductsByRecommendation(
      products,
      recommendations,
    );
    const responseProducts =
      task === "compare"
        ? products.slice(0, 3)
        : recommendationProducts.slice(0, MAX_RANKED_PRODUCTS);
    return NextResponse.json({
      ...commerce,
      analytics: getLocalAnalytics({
        delivery,
        deliveryRequested,
        intent: resolvedMessageAnalysis.intent,
        products: responseProducts,
        profile: replyPreferenceProfile,
        recommendations,
      }),
      chips:
        mode.includes("Event") || mode.includes("Gift Box")
          ? ["Next item", "Suggest more"]
          : mode === "Smart Shopping"
            ? getShoppingReplyChips()
            : getRandomInitialChips(),
      delivery,
      detectedLanguage: resolvedMessageAnalysis.detectedLanguage,
      mcp: {
        endpoint: getCommerceMcpUrl(),
        searchQuery,
        tools: [
          commerceTools.searchProducts,
          ...(deliveryRequested ? [commerceTools.checkDelivery] : []),
        ],
      },
      products: responseProducts,
      preferences: getClientPreferences(replyPreferenceProfile),
      recommendations,
      reply: commerce.reply,
      ...getPreferenceResponseForMode(mode, effectiveExtendedPreferences),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The commerce request failed.",
      },
      { status: 502 },
    );
  }
}
