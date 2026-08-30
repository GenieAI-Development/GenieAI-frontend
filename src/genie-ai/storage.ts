import type { StoredChatState } from "./types";

const CHAT_DB_NAME = "genie-ai-chat";
const CHAT_STORE_NAME = "chat-state";
const CHAT_STATE_KEY = "current";
const CHAT_STORAGE_KEY = "genie-ai-chat-state";
export const INITIAL_CATALOG_VERSION = "supabase-cakes-flowers-v2";
export const INTRO_PANEL_STORAGE_KEY = "genie-ai-intro-panel-date";
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

export async function readStoredChatState() {
  if (typeof indexedDB === "undefined") {
    const storedValue = localStorage.getItem(CHAT_STORAGE_KEY);
    return storedValue ? (JSON.parse(storedValue) as StoredChatState) : null;
  }

  const database = await openChatDatabase();

  return new Promise<StoredChatState | null>((resolve, reject) => {
    const transaction = database.transaction(CHAT_STORE_NAME, "readonly");
    const request = transaction
      .objectStore(CHAT_STORE_NAME)
      .get(CHAT_STATE_KEY);

    request.onsuccess = () =>
      resolve((request.result as StoredChatState) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function writeStoredChatState(state: StoredChatState) {
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

export async function clearStoredChatState() {
  localStorage.removeItem(CHAT_STORAGE_KEY);

  if (typeof indexedDB === "undefined") {
    return;
  }

  const database = await openChatDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CHAT_STORE_NAME, "readwrite");
    const request = transaction
      .objectStore(CHAT_STORE_NAME)
      .delete(CHAT_STATE_KEY);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
