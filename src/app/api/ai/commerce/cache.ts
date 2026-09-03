import type { CacheEntry } from "./types";

export function getCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
  maxEntries: number,
  load: () => Promise<T>,
) {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  if (existing) {
    cache.delete(key);
  }

  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }

  const value = load().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });

  return value;
}
