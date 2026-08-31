import { NextResponse } from "next/server";
import { asRecord, getNumber, getString } from "@/lib/aiPayload";
import { getOrCreatePersonalizationSessionId } from "@/lib/personalization/identity";
import { parseProfile, parseRankingEvents } from "../../commerce/request";
import { rankCommerceProducts } from "../integration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = asRecord(await request.json().catch(() => null));
  const query = getString(body, "query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "A non-empty query is required." },
      { status: 400 },
    );
  }

  try {
    const preferenceRecord = asRecord(body?.preferences);
    const parsedProfile = parseProfile(preferenceRecord);
    const result = await rankCommerceProducts({
      events: parseRankingEvents(body?.events),
      preferences: {
        ...parsedProfile,
        budgetMax: getNumber(preferenceRecord, "budgetMax") ?? undefined,
        budgetMin: getNumber(preferenceRecord, "budgetMin") ?? undefined,
        deliveryCity:
          getString(preferenceRecord, "deliveryCity") ?? parsedProfile.city,
      },
      query,
      sessionId: await getOrCreatePersonalizationSessionId(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Product ranking failed.",
      },
      { status: 502 },
    );
  }
}
