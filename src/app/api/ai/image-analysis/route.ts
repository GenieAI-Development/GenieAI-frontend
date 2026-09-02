import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const AGENT_URL =
  "https://api.qoder.com/v1/agents/genie-image-search/run";

const GENERIC_HINTS = ["gift", "flowers", "cake", "chocolate"];

type AgentResponse = {
  summary?: string;
  labels?: Array<{ label: string; score: number }>;
  visibleText?: string[];
  productHints?: string[];
  searchQuery?: string;
};

function cleanFallbackTerms(value: string) {
  return value
    .split(/[^a-z0-9]+/)
    .map((term) => term.trim().toLowerCase())
    .filter(
      (term) =>
        term.length >= 3 &&
        !/^\d+$/.test(term) &&
        !/^\d+x\d+$/i.test(term) &&
        !/^(img|image|photo|picture|screenshot|screen|scan|upload|whatsapp|document|file|jpeg|jpg|png|webp|heic|easy|final|copy|edited|edit|new|version|draft|small|large|wide|tall)$/.test(
          term,
        ),
    );
}

function buildFallbackAnalysis(file: File) {
  const baseName = file.name
    .replace(/\.[a-z0-9]+$/i, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const preferredTerms = cleanFallbackTerms(baseName).filter((term) =>
    /cake|chocolate|flower|flowers|rose|roses|perfume|gift|watch|hamper|bouquet|party|balloon|teddy|mug|jewel|jewellery|toy/i.test(
      term,
    ),
  );
  const terms = [
    ...new Set([...preferredTerms, ...cleanFallbackTerms(baseName)]),
  ].slice(0, 5);
  const productHints = [...new Set([...terms, ...GENERIC_HINTS])].slice(0, 5);
  const searchQuery = terms.slice(0, 3).join(" ") || "gift";
  const focus = terms[0] ?? "gift";

  return {
    fallback: true,
    labels: terms.slice(0, 3).map((term) => ({ label: term, score: 0.2 })),
    productHints,
    searchQuery,
    summary:
      terms.length > 0
        ? `Vision is temporarily unavailable, so I searched for ${focus}-related gift ideas.`
        : "Vision is temporarily unavailable, so I searched for general gift ideas instead.",
    visibleText: [],
  };
}

export async function POST(request: Request) {
  const agentKey = process.env.QODER_AGENT_KEY;
  if (!agentKey) {
    return NextResponse.json(
      { error: "Agent API key is not configured." },
      { status: 500 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Upload an image file." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Maximum size is 4 MB." },
      { status: 413 },
    );
  }

  const imageBytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || "image/jpeg"};base64,${imageBytes.toString("base64")}`;

  try {
    const response = await fetch(AGENT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: dataUrl }),
    });

    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }

    const result = (await response.json()) as { output?: string | AgentResponse };
    const parsed: AgentResponse =
      typeof result.output === "string"
        ? JSON.parse(result.output)
        : result.output ?? {};

    return NextResponse.json({
      summary: parsed.summary ?? "",
      labels: Array.isArray(parsed.labels) ? parsed.labels.slice(0, 5) : [],
      visibleText: Array.isArray(parsed.visibleText)
        ? parsed.visibleText.slice(0, 8)
        : [],
      productHints: Array.isArray(parsed.productHints)
        ? parsed.productHints.slice(0, 5)
        : [],
      searchQuery: parsed.searchQuery ?? "",
    });
  } catch {
    return NextResponse.json(buildFallbackAnalysis(file));
  }
}
