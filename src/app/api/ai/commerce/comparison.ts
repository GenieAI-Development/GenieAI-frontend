import { asRecord, getNumber, getString } from "@/lib/aiPayload";
import { fetchGroqChatWithFallback } from "@/lib/groqHosted";
import type { Product } from "@/lib/productCatalog";
import { extractJsonObject, getAssistantContent } from "./ai";
import { COMPARE_FALLBACK_MODELS, DEFAULT_COMPARE_MODEL } from "./constants";
import { formatLkrAmount } from "./preferences";
import type {
  ComparisonInsight,
  ProductComparisonInsights,
  ShoppingProfile,
} from "./types";

function getInsightPercentage(record: Record<string, unknown> | null) {
  const numericValue = getNumber(record, "percentage");

  if (numericValue !== null) {
    return numericValue;
  }

  const value = record?.percentage;
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value.trim().replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getGroqComparisonInsights(
  apiKey: string,
  language: string,
  products: Product[],
  profile: ShoppingProfile,
) {
  const { response } = await fetchGroqChatWithFallback(
    apiKey,
    {
      model: process.env.GROQ_COMPARE_MODEL ?? DEFAULT_COMPARE_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Score each supplied product using only the supplied facts and shopping context. Return no more than two short insight dimensions per product: Occasion Match and Recipient Match. Do not return Value or Quality: those scores are calculated by the service from live price and description data. A missing preference cannot be scored: when occasion is empty, Occasion Match percentage must be null; when recipient is empty, Recipient Match percentage must be null. Never guess a missing preference. Other percentages must be integers from 0 to 100 and should meaningfully distinguish the products. Do not invent materials, durability, reviews, or other facts absent from the descriptions. Keep insight labels in the requested language. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            expectedSchema: {
              productInsights: [
                {
                  id: "exact supplied product id",
                  insights: [
                    {
                      label: "short insight label",
                      percentage: 0,
                    },
                  ],
                },
              ],
            },
            language,
            shoppingContext: {
              budget: profile.budget,
              occasion: profile.occasion,
              recipient: profile.recipient,
            },
            products: products.map((product) => ({
              category: product.category,
              description: product.description,
              id: product.id,
              name: product.name,
              price: product.price,
            })),
          }),
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 420,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    },
    COMPARE_FALLBACK_MODELS,
  );

  if (!response.ok) {
    return [];
  }

  const content = getAssistantContent((await response.json()) as unknown);
  const jsonText = content ? extractJsonObject(content) : null;

  if (!jsonText) {
    return [];
  }

  try {
    const parsed = asRecord(JSON.parse(jsonText) as unknown);
    const rawProductInsights = parsed?.productInsights;
    const productIdsByNormalizedId = new Map(
      products.map((product) => [product.id.trim().toLowerCase(), product.id]),
    );

    if (!Array.isArray(rawProductInsights)) {
      return [];
    }

    return rawProductInsights
      .map((item): ProductComparisonInsights | null => {
        const record = asRecord(item);
        const requestedId = getString(record, "id")?.trim();
        const id = requestedId
          ? productIdsByNormalizedId.get(requestedId.toLowerCase())
          : undefined;
        const rawInsights = record?.insights;

        if (!id || !Array.isArray(rawInsights)) {
          return null;
        }

        const seenLabels = new Set<string>();
        const insights = rawInsights
          .map((insight): ComparisonInsight | null => {
            const insightRecord = asRecord(insight);
            const label = getString(insightRecord, "label")?.trim();
            const percentage = getInsightPercentage(insightRecord);
            const percentageIsBlank = insightRecord?.percentage === null;
            const normalizedLabel = label?.toLowerCase();

            if (
              !label ||
              !normalizedLabel ||
              seenLabels.has(normalizedLabel) ||
              (percentage === null && !percentageIsBlank)
            ) {
              return null;
            }

            seenLabels.add(normalizedLabel);
            const isOccasionDimension =
              /occasion|event match|awast|utsav|අවස්ථා|උත්සව/i.test(label);
            const isRecipientDimension =
              /recipient|relationship|person match|labann|ලබන්න|පුද්ගල/i.test(label);
            const unavailableForContext =
              (isOccasionDimension && !(profile.occasion ?? "").trim()) ||
              (isRecipientDimension && !(profile.recipient ?? "").trim());
            return {
              label,
              percentage:
                percentageIsBlank || unavailableForContext
                  ? null
                  : Math.max(0, Math.min(100, Math.round(percentage as number))),
            };
          })
          .filter((insight): insight is ComparisonInsight => Boolean(insight))
          .slice(0, 4);

        return insights.length > 0 ? { id, insights } : null;
      })
      .filter((item): item is ProductComparisonInsights => Boolean(item));
  } catch {
    return [];
  }
}

export function hasAvailableStock(product: Product) {
  return product.stock > 0 || /in stock/i.test(product.stockLabel);
}

export function getDeterministicCompareSummary(products: Product[]) {
  const [first, second] = products;

  if (!first || !second) {
    return "I could not compare both products because one product did not load.";
  }

  const sameCategory =
    first.category.trim().toLowerCase() ===
    second.category.trim().toLowerCase();
  const categorySentence = sameCategory
    ? `Both products are in ${first.category}, so the choice is mainly about price, availability, and which description better fits the gift need.`
    : `${first.name} is in ${first.category}, while ${second.name} is in ${second.category}, so they suit different gifting needs.`;

  const firstAvailable = hasAvailableStock(first);
  const secondAvailable = hasAvailableStock(second);
  const stockSentence =
    firstAvailable === secondAvailable
      ? `Availability is similar: ${first.name} is ${first.stockLabel.toLowerCase()} and ${second.name} is ${second.stockLabel.toLowerCase()}.`
      : `${firstAvailable ? first.name : second.name} has the availability advantage because it is ${firstAvailable ? first.stockLabel.toLowerCase() : second.stockLabel.toLowerCase()}, while ${firstAvailable ? second.name : first.name} is ${firstAvailable ? second.stockLabel.toLowerCase() : first.stockLabel.toLowerCase()}.`;

  const priceSentence =
    first.price === second.price
      ? `Both are priced the same at ${formatLkrAmount(first.price)}.`
      : `${first.price < second.price ? first.name : second.name} is cheaper by ${formatLkrAmount(Math.abs(first.price - second.price))}, so ${first.price < second.price ? first.name : second.name} is stronger for budget value, while ${first.price > second.price ? first.name : second.name} needs to justify its higher price through fit, presentation, or category preference.`;

  const preferred =
    firstAvailable && !secondAvailable
      ? first
      : secondAvailable && !firstAvailable
        ? second
        : first.price <= second.price
          ? first
          : second;
  const alternative = preferred.id === first.id ? second : first;

  return `${categorySentence} ${priceSentence} ${stockSentence} Choose ${preferred.name} if you want the safer pick because it has ${preferred.id === first.id ? "the better price or availability balance" : "the better availability or value balance"} for this comparison. Choose ${alternative.name} instead if its ${alternative.category} category and description match the recipient better, but do not choose it over ${preferred.name} unless that fit matters more than ${preferred.id === first.id ? second.name : first.name}'s price or stock advantage.`;
}

export function getDeterministicComparisonInsights(
  products: Product[],
  profile: ShoppingProfile,
): ProductComparisonInsights[] {
  const positivePrices = products
    .map((product) => product.price)
    .filter((price) => price > 0);
  const lowestPrice = Math.min(...positivePrices);

  function getContextMatch(product: Product, context: string) {
    if (!context.trim()) {
      return null;
    }

    const searchableText =
      `${product.name} ${product.category} ${product.description}`.toLowerCase();
    const contextTerms = context
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2);
    const matchingTerms = contextTerms.filter((term) =>
      searchableText.includes(term),
    ).length;

    return Math.min(94, 68 + matchingTerms * 10);
  }

  return products.slice(0, 2).map((product) => {
    const valuePercentage =
      Number.isFinite(lowestPrice) && product.price > 0
        ? Math.max(
            55,
            Math.min(96, Math.round((lowestPrice / product.price) * 92)),
          )
        : 70;
    const qualityPercentage = Math.min(
      92,
      64 + Math.round(Math.min(product.description.length, 240) / 12),
    );

    return {
      id: product.id,
      insights: [
        { label: "Value", percentage: valuePercentage },
        { label: "Quality", percentage: qualityPercentage },
        {
          label: "Occasion Match",
          percentage: getContextMatch(product, profile.occasion ?? ""),
        },
        {
          label: "Recipient Match",
          percentage: getContextMatch(product, profile.recipient ?? ""),
        },
      ],
    };
  });
}
