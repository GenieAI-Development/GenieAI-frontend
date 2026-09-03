import { NextResponse } from "next/server";
import { getOrCreatePersonalizationSessionId } from "@/lib/personalization/identity";
import { getPersonalizationProfile } from "@/lib/personalization/profileStore";

export const runtime = "nodejs";

export async function GET() {
  const sessionId = await getOrCreatePersonalizationSessionId();
  return NextResponse.json({
    hasProfile: Boolean(getPersonalizationProfile(sessionId)),
    ready: true,
  });
}
