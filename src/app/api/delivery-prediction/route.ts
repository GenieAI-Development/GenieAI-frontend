import { NextResponse } from "next/server";
import { asRecord, getNumber, getString, stripModelThinking } from "@/lib/aiPayload";
import {
  fetchGroqChatWithFallback,
  getGroqApiKey,
  getMissingGroqKeyMessage,
  readGroqError,
} from "@/lib/groqHosted";

export const runtime = "nodejs";

const WAREHOUSE = {
  name: "GenieAI warehouse, Colombo",
  latitude: 6.9271,
  longitude: 79.8612,
};
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const MAX_LOCATION_LENGTH = 160;
const MAX_ITEMS = 12;

type LocationPoint = {
  name: string;
  latitude: number;
  longitude: number;
};

type WeatherSnapshot = {
  condition: string;
  precipitation: number;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
};

function getSriLankaTimeParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    weekday: "long",
    month: "numeric",
    hour: "numeric",
    hour12: false,
    minute: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    dayOfWeek: value("weekday"),
    month: Number(value("month")),
    hour: Number(value("hour")) % 24,
    minute: Number(value("minute")),
  };
}

async function getDrivingRoute(first: LocationPoint, second: LocationPoint) {
  const coordinates = `${first.longitude},${first.latitude};${second.longitude},${second.latitude}`;
  const url = new URL(`${OSRM_ROUTE_URL}/${coordinates}`);
  url.searchParams.set("overview", "false");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("A driving route could not be calculated for this delivery location.");
  const data = asRecord(await response.json());
  const route = asRecord(Array.isArray(data?.routes) ? data.routes[0] : null);
  const distanceMeters = getNumber(route, "distance");
  const durationSeconds = getNumber(route, "duration");
  if (data?.code !== "Ok" || distanceMeters === null || durationSeconds === null) {
    throw new Error("No drivable route was found for this delivery location.");
  }
  return {
    distanceKm: distanceMeters / 1000,
    durationMinutes: durationSeconds / 60,
  };
}

async function geocodeLocation(location: string): Promise<LocationPoint> {
  const url = new URL(OPEN_METEO_GEOCODING_URL);
  url.searchParams.set("name", `${location}, Sri Lanka`);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("countryCode", "LK");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("The delivery location could not be looked up.");
  const data = asRecord(await response.json());
  const results = Array.isArray(data?.results) ? data.results : [];
  const match = asRecord(results[0]);
  const latitude = getNumber(match, "latitude");
  const longitude = getNumber(match, "longitude");
  if (!match || latitude === null || longitude === null) {
    throw new Error("No Sri Lankan location matched that delivery address. Try a nearby town or postcode.");
  }
  const place = [getString(match, "name"), getString(match, "admin1")]
    .filter(Boolean)
    .join(", ");
  return { name: place || location, latitude, longitude };
}

function mapWeatherCondition(weatherCode: number, windSpeed: number) {
  if (windSpeed >= 30) return "Windy";
  if (weatherCode === 0) return "Sunny";
  if (weatherCode === 45 || weatherCode === 48) return "Fog";
  if (weatherCode >= 80) return "Stormy";
  return "Cloudy";
}

async function getWeather(point: LocationPoint): Promise<WeatherSnapshot> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(point.latitude));
  url.searchParams.set("longitude", String(point.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timezone", "Asia/Colombo");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Weather is unavailable for ${point.name}.`);
  const current = asRecord(asRecord(await response.json())?.current);
  const weatherCode = getNumber(current, "weather_code") ?? 0;
  const windSpeed = getNumber(current, "wind_speed_10m") ?? 0;
  return {
    condition: mapWeatherCondition(weatherCode, windSpeed),
    precipitation: getNumber(current, "precipitation") ?? 0,
    temperature: getNumber(current, "temperature_2m") ?? 0,
    weatherCode,
    windSpeed,
  };
}

function getTrafficDensity(hour: number, precipitation: number) {
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 20)) return "High";
  if (precipitation > 0 || (hour >= 10 && hour <= 15)) return "Medium";
  return "Low";
}

function getOrderType(items: string[]) {
  const text = items.join(" ").toLowerCase();
  if (/drink|juice|tea|coffee|beverage/u.test(text)) return "Drinks";
  if (/snack|chocolate|biscuit|sweet|candy/u.test(text)) return "Snack";
  if (/cake|meal|food|lunch|dinner/u.test(text)) return "Meal";
  return "Buffet";
}

function getTravelEstimate({
  routeDurationMinutes,
  traffic,
  weather,
}: {
  routeDurationMinutes: number;
  traffic: string;
  weather: WeatherSnapshot;
}) {
  const trafficDelayMultiplier = traffic === "High" ? 1.35 : traffic === "Medium" ? 1.15 : 1;
  const weatherDelayMultiplier =
    weather.condition === "Stormy"
      ? 1.3
      : weather.condition === "Fog" || weather.condition === "Windy"
        ? 1.15
        : weather.precipitation > 0
          ? 1.1
          : 1;
  const routeMinutes = routeDurationMinutes * trafficDelayMultiplier * weatherDelayMultiplier + 8;

  return Math.max(1, Math.min(1440, Math.round(routeMinutes)));
}

async function getPreparationEstimate(items: string[], weather: WeatherSnapshot) {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error(getMissingGroqKeyMessage());
  const primaryModel = process.env.GROQ_DELIVERY_MODEL || "qwen/qwen3.6-27b";
  const { model, response } = await fetchGroqChatWithFallback(apiKey, {
    model: primaryModel,
    temperature: 0.7,
    max_completion_tokens: 320,
    reasoning_effort: "none",
    messages: [
      {
        role: "system",
        content:
          "Estimate total order-readiness time for a Sri Lankan gift order before the delivery agent can leave the GenieAI warehouse in Colombo. Include supplier or vendor lead time to bring every item to the warehouse, production time for made-to-order goods such as cakes, receiving and quality checks, consolidation, safe packing, perishability, item count, and weather handling. All items are prepared and sourced in parallel. Never add supplier lead times item by item: use only the slowest item lead time, then add one final warehouse consolidation and packing step. Do not include last-mile travel from the warehouse to the customer. Preparation may take hours or multiple days. Reply on one line only in this exact format: MINUTES | short reason mentioning the main lead-time item. MINUTES must be one integer from 15 to 43200. Do not return JSON or markdown.",
      },
      { role: "user", content: JSON.stringify({ items, destinationWeather: weather }) },
    ],
  });
  if (!response.ok) throw new Error(await readGroqError(response));
  const body = asRecord(await response.json());
  const message = asRecord(Array.isArray(body?.choices) ? asRecord(body.choices[0])?.message : null);
  const content = stripModelThinking(getString(message, "content") ?? "").trim();
  const minuteMatch = content.match(/\b(\d{1,5})\b/u);
  const itemText = items.join(" ").toLowerCase();
  const isCustomOrder = /custom|personalized|engraved|bespoke/u.test(itemText);
  const hasCake = /cake|bakery|dessert/u.test(itemText);
  const hasSpecialSupplierItem = /flower|bouquet|jewellery|jewelry/u.test(itemText);
  const supplierLeadMinutes = isCustomOrder
    ? 2 * 24 * 60
    : hasCake
      ? 24 * 60
      : hasSpecialSupplierItem
        ? 12 * 60
        : 3 * 60;
  const consolidationMinutes = 30 + Math.min(30, Math.max(0, items.length - 1) * 5);
  const minimumReadinessMinutes = Math.min(43200, supplierLeadMinutes + consolidationMinutes);
  const modelMinutes = minuteMatch ? Number(minuteMatch[1]) : minimumReadinessMinutes;
  const minutes = Math.max(modelMinutes, minimumReadinessMinutes);
  const separatorIndex = content.indexOf("|");
  const reason =
    separatorIndex >= 0
      ? content.slice(separatorIndex + 1).trim()
      : content.replace(minuteMatch?.[0] ?? "", "").replace(/^\s*(?:minutes?|[-:|])\s*/iu, "").trim();
  const minimumReason = isCustomOrder
    ? "A custom item requires supplier production and delivery to the Colombo warehouse before final checks and packing."
    : hasCake
      ? "The cake requires production and supplier delivery to the Colombo warehouse before final checks and packing."
      : hasSpecialSupplierItem
        ? "The supplier item must reach the Colombo warehouse before conditioning, checks, and packing."
        : "Items must reach the Colombo warehouse before receiving checks and final packing.";
  return {
    minutes: Math.max(15, Math.min(43200, Math.round(minutes))),
    groqSuggestedMinutes: Math.max(15, Math.min(43200, Math.round(modelMinutes))),
    minimumReadinessMinutes,
    reason:
      modelMinutes < minimumReadinessMinutes
        ? minimumReason
        : reason ||
      "Includes supplier delivery to the Colombo warehouse, receiving checks, and final packing.",
    model,
  };
}

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const location = getString(body, "location")?.trim();
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const items = rawItems
      .map((item) => typeof item === "string" ? item.trim().slice(0, 180) : "")
      .filter(Boolean)
      .slice(0, MAX_ITEMS);
    if (!location || location.length > MAX_LOCATION_LENGTH) {
      return NextResponse.json({ error: "Enter a valid delivery location." }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Add at least one cart product or describe the order." }, { status: 400 });
    }

    const destination = await geocodeLocation(location);
    const [warehouseWeather, destinationWeather] = await Promise.all([
      getWeather(WAREHOUSE),
      getWeather(destination),
    ]);
    const time = getSriLankaTimeParts();
    const route = await getDrivingRoute(WAREHOUSE, destination);
    const traffic = getTrafficDensity(time.hour, Math.max(warehouseWeather.precipitation, destinationWeather.precipitation));
    const preparation = await getPreparationEstimate(items, destinationWeather);
    const travelMinutes = getTravelEstimate({
      routeDurationMinutes: route.durationMinutes,
      traffic,
      weather: destinationWeather,
    });
    const totalMinutes = Math.round(travelMinutes + preparation.minutes);
    const arrivalAt = new Date(Date.now() + totalMinutes * 60_000).toISOString();

    return NextResponse.json({
      warehouse: WAREHOUSE,
      destination,
      weather: { warehouse: warehouseWeather, destination: destinationWeather, source: "Open-Meteo" },
      inputs: {
        distanceKm: Number(route.distanceKm.toFixed(2)),
        routeDurationMinutes: Math.round(route.durationMinutes),
        traffic,
        orderType: getOrderType(items),
        itemCount: items.length,
        preparationStrategy: "parallel",
      },
      prediction: {
        travelMinutes: Math.round(travelMinutes),
        preparationMinutes: preparation.minutes,
        groqSuggestedPreparationMinutes: preparation.groqSuggestedMinutes,
        minimumReadinessMinutes: preparation.minimumReadinessMinutes,
        totalMinutes,
        arrivalAt,
        preparationReason: preparation.reason,
        preparationModel: preparation.model,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery prediction failed.";
    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
}
