import "server-only";

import { personalizationEventWeights } from "./eventWeights";
import type {
  PersonalizationEvent,
  PersonalizationProfile,
} from "./types";

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SESSION_PROFILES = 10_000;
const CATEGORY_DECAY = 0.9;
const MAX_RECENT_PRODUCTS = 20;
const MAX_RECENT_QUERIES = 10;

type StoredProfile = PersonalizationProfile & {
  expiresAt: number;
  priceSignalTotal: number;
  priceSignalWeight: number;
};

declare global {
  var __geniePersonalizationProfiles: Map<string, StoredProfile> | undefined;
}

const profiles =
  globalThis.__geniePersonalizationProfiles ?? new Map<string, StoredProfile>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__geniePersonalizationProfiles = profiles;
}

function createProfile(sessionId: string, now: number): StoredProfile {
  return {
    categoryScores: {},
    expiresAt: now + PROFILE_TTL_MS,
    preferredPriceMax: null,
    preferredPriceMin: null,
    priceSignalTotal: 0,
    priceSignalWeight: 0,
    recentProductIds: [],
    recentQueries: [],
    sessionId,
    updatedAt: new Date(now).toISOString(),
  };
}

function addRecentValue(values: string[], value: string, limit: number) {
  return [value, ...values.filter((item) => item !== value)].slice(0, limit);
}

function pruneProfiles(now: number) {
  for (const [sessionId, profile] of profiles) {
    if (profile.expiresAt <= now) {
      profiles.delete(sessionId);
    }
  }

  if (profiles.size <= MAX_SESSION_PROFILES) {
    return;
  }

  const oldestProfiles = [...profiles.values()]
    .sort((first, second) =>
      first.updatedAt.localeCompare(second.updatedAt),
    )
    .slice(0, profiles.size - MAX_SESSION_PROFILES);

  for (const profile of oldestProfiles) {
    profiles.delete(profile.sessionId);
  }
}

function toPublicProfile(profile: StoredProfile): PersonalizationProfile {
  return {
    categoryScores: { ...profile.categoryScores },
    preferredPriceMax: profile.preferredPriceMax,
    preferredPriceMin: profile.preferredPriceMin,
    recentProductIds: [...profile.recentProductIds],
    recentQueries: [...profile.recentQueries],
    sessionId: profile.sessionId,
    updatedAt: profile.updatedAt,
  };
}

export function recordPersonalizationEvent(
  sessionId: string,
  event: PersonalizationEvent,
) {
  const now = Date.now();
  pruneProfiles(now);

  const existing = profiles.get(sessionId);
  const profile =
    existing && existing.expiresAt > now
      ? existing
      : createProfile(sessionId, now);
  const eventWeight = personalizationEventWeights[event.event];

  for (const category of Object.keys(profile.categoryScores)) {
    profile.categoryScores[category] =
      profile.categoryScores[category] * CATEGORY_DECAY;
  }

  if (event.category) {
    profile.categoryScores[event.category] =
      (profile.categoryScores[event.category] ?? 0) + eventWeight;
  }

  if (event.productId) {
    profile.recentProductIds = addRecentValue(
      profile.recentProductIds,
      event.productId,
      MAX_RECENT_PRODUCTS,
    );
  }

  if (event.query) {
    profile.recentQueries = addRecentValue(
      profile.recentQueries,
      event.query,
      MAX_RECENT_QUERIES,
    );
  }

  if (
    typeof event.price === "number" &&
    Number.isFinite(event.price) &&
    event.price >= 0 &&
    eventWeight > 0 &&
    event.event !== "impression"
  ) {
    profile.priceSignalTotal += event.price * eventWeight;
    profile.priceSignalWeight += eventWeight;
    const preferredPrice =
      profile.priceSignalTotal / profile.priceSignalWeight;
    profile.preferredPriceMin = Math.max(0, Math.round(preferredPrice * 0.75));
    profile.preferredPriceMax = Math.round(preferredPrice * 1.25);
  }

  profile.expiresAt = now + PROFILE_TTL_MS;
  profile.updatedAt = new Date(now).toISOString();
  profiles.set(sessionId, profile);
  return toPublicProfile(profile);
}

export function getPersonalizationProfile(sessionId: string) {
  const now = Date.now();
  const profile = profiles.get(sessionId);

  if (!profile || profile.expiresAt <= now) {
    profiles.delete(sessionId);
    return null;
  }

  return toPublicProfile(profile);
}

