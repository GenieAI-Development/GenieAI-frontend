"use client";

import { useEffect } from "react";

const WARMUP_URL = "/api/backend-warmup";
const WARMUP_SESSION_KEY = "genieai-backend-warmup-requested";

let warmupStarted = false;

export function BackendWarmup() {
  useEffect(() => {
    if (warmupStarted || sessionStorage.getItem(WARMUP_SESSION_KEY)) {
      return;
    }

    warmupStarted = true;
    sessionStorage.setItem(WARMUP_SESSION_KEY, "true");

    void fetch(WARMUP_URL, {
      method: "GET",
      cache: "no-store",
    }).catch(() => {
      // Best-effort warm-up: intentionally ignore errors.
    });
  }, []);

  return null;
}
