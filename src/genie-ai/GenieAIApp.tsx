"use client";

import { GenieAIController } from "./GenieAIController";
import { BackendWarmup } from "./BackendWarmup";

export function GenieAIApp() {
  return (
    <>
      <BackendWarmup />
      <GenieAIController />
    </>
  );
}
