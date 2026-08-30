import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const PERSONALIZATION_SESSION_COOKIE = "genie_personalization_session";

export async function getOrCreatePersonalizationSessionId() {
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get(
    PERSONALIZATION_SESSION_COOKIE,
  )?.value;

  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = randomUUID();
  cookieStore.set(PERSONALIZATION_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return sessionId;
}

