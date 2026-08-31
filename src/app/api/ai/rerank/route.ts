import { NextResponse } from "next/server";
import { asRecord, getString } from "@/lib/aiPayload";
import { getOrCreatePersonalizationSessionId } from "@/lib/personalization/identity";
import { rerankProducts } from "@/lib/reranking/service";
import { normalizePythonProduct } from "../commerce/catalog";
import { parseRankingEvents } from "../commerce/request";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = asRecord((await request.json().catch(() => null)) as unknown);
  const query = getString(body, "query")?.trim().slice(0, 500) ?? "";
  const rawProducts = body?.products;

  if (!query || !Array.isArray(rawProducts) || rawProducts.length === 0) {
    return NextResponse.json(
      { error: "query and at least one product are required." },
      { status: 400 },
    );
  }

  const products = rawProducts
    .slice(0, 30)
    .map(normalizePythonProduct)
    .filter((product): product is NonNullable<typeof product> => product !== null);
  if (products.length === 0) {
    return NextResponse.json(
      { error: "No valid products were supplied." },
      { status: 400 },
    );
  }

  const sessionId = await getOrCreatePersonalizationSessionId();
  const result = await rerankProducts({
    events: parseRankingEvents(body?.events).map((event) => ({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    })),
    products,
    query,
    sessionId,
  });

  return NextResponse.json(result);
}
