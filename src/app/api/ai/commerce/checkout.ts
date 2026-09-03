import { asRecord, getString } from "@/lib/aiPayload";
import { commerceTools, createCommerceMcpClient } from "@/lib/commerceMcp";
import { toCommerceLocationType } from "@/lib/deliveryLocations";
import { CITY_CACHE_TTL_MS, MAX_CITY_CACHE_ENTRIES } from "./constants";
import { getCachedValue } from "./cache";
import type {
  CacheEntry,
  CatalogCityResponse,
  CatalogDeliveryResponse,
  CatalogOrderResponse,
  CheckoutDetails,
  ShoppingProfile,
} from "./types";

const cityCache = new Map<string, CacheEntry<string>>();

export function getFirstUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.match(/https?:\/\/[^\s"'`<>()]+/i)?.[0];
}

export function normalizeCheckoutOrderResponse(
  order: CatalogOrderResponse | null | undefined,
) {
  if (!order) {
    return { result: "" } as CatalogOrderResponse;
  }

  const checkoutUrl =
    order.checkout_url ??
    order.checkoutUrl ??
    order.click_to_pay_url ??
    getFirstUrl(order.result);

  return {
    ...order,
    checkout_url: checkoutUrl,
  };
}

export function parseCheckoutDetails(value: unknown): CheckoutDetails {
  const record = asRecord(value);

  return {
    address: getString(record, "address") ?? undefined,
    giftMessage: getString(record, "giftMessage") ?? undefined,
    locationType: getString(record, "locationType") ?? undefined,
    recipientName: getString(record, "recipientName") ?? undefined,
    recipientPhone: getString(record, "recipientPhone") ?? undefined,
    senderName: getString(record, "senderName") ?? undefined,
  };
}

export function getMissingCheckoutFields(
  cartIds: string[],
  profile: ShoppingProfile,
  checkout: CheckoutDetails,
) {
  const missing: string[] = [];

  if (cartIds.length === 0) missing.push("cart item");
  if (!checkout.recipientName) missing.push("recipient name");
  if (!checkout.recipientPhone) missing.push("recipient phone");
  if (!checkout.address) missing.push("delivery address");
  if (!profile.city) missing.push("delivery city");
  if (!profile.date) missing.push("delivery date");
  if (!checkout.senderName) missing.push("sender name");

  return missing;
}

export async function getCanonicalCity(
  mcp: Awaited<ReturnType<typeof createCommerceMcpClient>>,
  city: string,
) {
  const cacheKey = city.trim().toLowerCase();

  return getCachedValue(
    cityCache,
    cacheKey,
    CITY_CACHE_TTL_MS,
    MAX_CITY_CACHE_ENTRIES,
    async () => {
      const cityResponse = await mcp.callTool<CatalogCityResponse>(
        commerceTools.listDeliveryCities,
        {
          limit: 1,
          query: city,
          response_format: "json",
        },
      );

      return cityResponse.cities?.[0]?.name ?? city;
    },
  );
}

export async function checkDelivery(
  mcp: Awaited<ReturnType<typeof createCommerceMcpClient>>,
  profile: ShoppingProfile,
  productId?: string,
  canonicalCity?: string,
) {
  if (!profile.city) {
    return null;
  }

  const city = canonicalCity ?? (await getCanonicalCity(mcp, profile.city));

  return mcp.callTool<CatalogDeliveryResponse>(commerceTools.checkDelivery, {
    city,
    delivery_date: profile.date || null,
    product_id: productId ?? null,
    response_format: "json",
  });
}

export async function createCheckoutOrder(
  mcp: Awaited<ReturnType<typeof createCommerceMcpClient>>,
  cartIds: string[],
  profile: ShoppingProfile,
  checkout: CheckoutDetails,
) {
  const city = await getCanonicalCity(mcp, profile.city ?? "");

  const order = await mcp.callTool<CatalogOrderResponse>(
    commerceTools.createOrder,
    {
      cart: cartIds.map((productId) => ({
        product_id: productId,
        quantity: 1,
      })),
      currency: "LKR",
      delivery: {
        address: checkout.address,
        city,
        date: profile.date,
        location_type: toCommerceLocationType(checkout.locationType),
      },
      gift_message: checkout.giftMessage || null,
      recipient: {
        name: checkout.recipientName,
        phone: checkout.recipientPhone,
      },
      response_format: "json",
      sender: {
        anonymous: false,
        name: checkout.senderName,
      },
    },
  );

  return normalizeCheckoutOrderResponse(order);
}
