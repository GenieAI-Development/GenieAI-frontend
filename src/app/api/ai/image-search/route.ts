import { NextResponse } from "next/server";
import {
  embedImageWithClip,
  getClipImageModel,
} from "@/lib/clipImageEmbedding";
import { matchKaprukaProductImages } from "@/lib/supabaseImageSearch";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DEFAULT_MATCH_THRESHOLD = 0.65;

function getMatchThreshold() {
  const configured = Number(process.env.IMAGE_MATCH_THRESHOLD);
  return Number.isFinite(configured) && configured >= -1 && configured <= 1
    ? configured
    : DEFAULT_MATCH_THRESHOLD;
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Upload an image file." },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "The uploaded file must be an image." },
      { status: 415 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Keep image uploads under 4 MB." },
      { status: 413 },
    );
  }

  const model = getClipImageModel();

  try {
    const embedding = await embedImageWithClip(
      await file.arrayBuffer(),
      file.type,
    );
    const products = await matchKaprukaProductImages(embedding, 4);
    const topScore = products[0]?.similarity ?? null;
    const lowConfidence =
      topScore === null || topScore < getMatchThreshold();

    return NextResponse.json({
      products: lowConfidence ? [] : products,
      topScore,
      lowConfidence,
      model,
    });
  } catch (error) {
    console.error("CLIP image search failed; using vision fallback.", error);
    return NextResponse.json({
      products: [],
      topScore: null,
      lowConfidence: true,
      fallback: true,
      model,
    });
  }
}
