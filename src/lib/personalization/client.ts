import type { PersonalizationEventType } from "./types";

export type ClientPersonalizationEvent = {
  category?: string;
  event: PersonalizationEventType;
  position?: number;
  price?: number;
  productId?: string;
  query?: string;
};

export type PendingPersonalizationEvent = ClientPersonalizationEvent & {
  eventId: string;
  timestamp: string;
};

const EVENT_QUEUE_KEY = "genieai:pending-personalization-events";
const MAX_PENDING_EVENTS = 100;
let memoryQueue: PendingPersonalizationEvent[] = [];

function isPendingEvent(value: unknown): value is PendingPersonalizationEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Partial<PendingPersonalizationEvent>;
  return typeof event.event === "string" && typeof event.timestamp === "string";
}

function readQueue() {
  if (typeof window === "undefined") {
    return memoryQueue;
  }

  try {
    const stored = window.sessionStorage.getItem(EVENT_QUEUE_KEY);
    if (!stored) {
      return memoryQueue;
    }

    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) {
      memoryQueue = parsed.filter(isPendingEvent).slice(-MAX_PENDING_EVENTS);
    }
  } catch {
    // Keep the in-memory queue when sessionStorage is unavailable or invalid.
  }

  return memoryQueue;
}

function writeQueue(events: PendingPersonalizationEvent[]) {
  memoryQueue = events.slice(-MAX_PENDING_EVENTS);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(memoryQueue));
  } catch {
    // The in-memory queue remains available for the current page lifecycle.
  }
}

export function initializePersonalizationSession() {
  return fetch("/api/personalization/session", {
    cache: "no-store",
    credentials: "same-origin",
  }).then(() => undefined);
}

export function trackPersonalizationEvent(event: ClientPersonalizationEvent) {
  const current = readQueue();
  const isDuplicateImpression =
    event.event === "impression" &&
    current.some(
      (queued) =>
        queued.event === "impression" &&
        queued.productId === event.productId &&
        queued.query === event.query,
    );

  if (!isDuplicateImpression) {
    writeQueue([
      ...current,
      {
        ...event,
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  return Promise.resolve();
}

export function getPendingEvents() {
  return [...readQueue()];
}

export function clearPendingEvents(events = getPendingEvents()) {
  const sentTimestamps = new Set(events.map((event) => event.timestamp));
  writeQueue(
    readQueue().filter((event) => !sentTimestamps.has(event.timestamp)),
  );
}
