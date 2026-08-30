import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { asRecord, getString, stripModelThinking } from "@/lib/aiPayload";
import {
  fetchGroqChatWithFallback,
  getGroqApiKey,
  getMissingGroqKeyMessage,
  readGroqError,
} from "@/lib/groqHosted";

export const runtime = "nodejs";

const DEFAULT_GIFT_CARD_MODEL = "qwen/qwen3.6-27b";
const DEFAULT_GIFT_CARD_BACKUP_MODEL = "qwen/qwen3.8-27b";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type GiftCardDesign = {
  accent: string;
  analysis: string;
  background: string;
  headline: string;
  message: string;
  motif: "confetti" | "floral" | "geometric" | "hearts" | "stars";
  primary: string;
};

function assistantContent(payload: unknown) {
  const choices = asRecord(payload)?.choices;
  if (!Array.isArray(choices)) return "";
  const message = asRecord(asRecord(choices[0])?.message);
  return stripModelThinking(getString(message, "content") ?? "").trim();
}

function extractJsonObject(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return start >= 0 && end > start ? clean.slice(start, end + 1) : null;
}

function cleanText(value: string | null | undefined, fallback: string, maxLength: number) {
  return (value?.trim() || fallback).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, maxLength);
}

function cleanColor(value: string | null | undefined, fallback: string) {
  return value && HEX_COLOR.test(value) ? value.toUpperCase() : fallback;
}

function parseDesign(text: string): GiftCardDesign | null {
  const json = extractJsonObject(text);
  if (!json) return null;

  try {
    const record = asRecord(JSON.parse(json) as unknown);
    if (!record) return null;
    const requestedMotif = getString(record, "motif")?.toLowerCase();
    const motif = ["confetti", "floral", "geometric", "hearts", "stars"].includes(
      requestedMotif ?? "",
    )
      ? (requestedMotif as GiftCardDesign["motif"])
      : "stars";

    return {
      accent: cleanColor(getString(record, "accent"), "#D6A936"),
      analysis: cleanText(getString(record, "analysis"), "Matched to the selected gift.", 240),
      background: cleanColor(getString(record, "background"), "#FAF7F1"),
      headline: cleanText(getString(record, "headline"), "A Gift for You", 70),
      message: cleanText(getString(record, "message"), "With warmest wishes, just for you.", 360),
      motif,
      primary: cleanColor(getString(record, "primary"), "#0B2748"),
    };
  } catch {
    return null;
  }
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function wrapText(value: string, maxCharacters: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(" ").length > lines.join(" ").length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, "")}…`;
  }
  return lines;
}

function motifMarkup(motif: GiftCardDesign["motif"], accent: string, primary: string) {
  if (motif === "hearts") {
    return `<path d="M95 110c-38-33-70 19 0 70 70-51 38-103 0-70Z" fill="${accent}" opacity=".28"/><path d="M1090 620c-47-41-87 23 0 86 87-63 47-127 0-86Z" fill="${primary}" opacity=".15"/>`;
  }
  if (motif === "floral") {
    return `<g fill="${accent}" opacity=".24"><circle cx="92" cy="110" r="33"/><circle cx="145" cy="110" r="33"/><circle cx="118" cy="68" r="33"/><circle cx="118" cy="150" r="33"/></g><g fill="${primary}" opacity=".14"><circle cx="1080" cy="664" r="40"/><circle cx="1142" cy="664" r="40"/><circle cx="1111" cy="614" r="40"/><circle cx="1111" cy="715" r="40"/></g>`;
  }
  if (motif === "geometric") {
    return `<path d="M0 0h270L0 270Z" fill="${accent}" opacity=".2"/><path d="m1200 800-290-290h290Z" fill="${primary}" opacity=".12"/><circle cx="1080" cy="120" r="70" fill="none" stroke="${accent}" stroke-width="14" opacity=".35"/>`;
  }
  if (motif === "confetti") {
    return `<g stroke-linecap="round" stroke-width="14" opacity=".55"><path d="m90 105 34 18M173 70l-8 38M1080 104l31-24M1112 170l42 8M98 670l32-30M1080 680l15 38" stroke="${accent}"/><path d="m154 160 28-25M1040 156l-6-42M160 710l-34-14M1138 620l-34 17" stroke="${primary}"/></g>`;
  }
  return `<g fill="${accent}" opacity=".35"><path d="m105 55 14 34 35 14-35 14-14 34-14-34-35-14 35-14Z"/><path d="m1090 610 18 43 43 18-43 18-18 43-18-43-43-18 43-18Z"/><path d="m1085 80 9 21 21 9-21 9-9 21-9-21-21-9 21-9Z"/></g>`;
}

function renderCardSvg(
  design: GiftCardDesign,
  receiverName: string,
  senderName: string,
) {
  const headlineLines = wrapText(design.headline, 26, 2);
  const messageLines = wrapText(design.message, 54, 5);
  const headline = headlineLines.map((line, index) => `<tspan x="600" dy="${index === 0 ? 0 : 68}">${escapeXml(line)}</tspan>`).join("");
  const message = messageLines.map((line, index) => `<tspan x="600" dy="${index === 0 ? 0 : 42}">${escapeXml(line)}</tspan>`).join("");
  const receiver = receiverName
    ? `<text x="600" y="130" text-anchor="middle" fill="${design.primary}" fill-opacity=".72" font-family="Inter, Noto Sans Sinhala, Arial, sans-serif" font-size="24" font-weight="600">To ${escapeXml(receiverName)}</text>`
    : "";
  const sender = senderName
    ? `<text x="600" y="716" text-anchor="middle" fill="${design.primary}" fill-opacity=".72" font-family="Inter, Noto Sans Sinhala, Arial, sans-serif" font-size="23" font-weight="600">From ${escapeXml(senderName)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="Generated gift card">
  <defs><linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${design.background}"/><stop offset="1" stop-color="${design.accent}" stop-opacity=".22"/></linearGradient></defs>
  <rect width="1200" height="800" rx="42" fill="url(#card-bg)"/>
  <rect x="34" y="34" width="1132" height="732" rx="30" fill="none" stroke="${design.primary}" stroke-opacity=".18" stroke-width="3"/>
  ${motifMarkup(design.motif, design.accent, design.primary)}
  ${receiver}
  <text x="600" y="245" text-anchor="middle" fill="${design.primary}" font-family="Inter, Noto Sans Sinhala, Arial, sans-serif" font-size="62" font-weight="700">${headline}</text>
  <rect x="505" y="350" width="190" height="6" rx="3" fill="${design.accent}"/>
  <text x="600" y="425" text-anchor="middle" fill="${design.primary}" font-family="Inter, Noto Sans Sinhala, Arial, sans-serif" font-size="31" font-weight="400">${message}</text>
  ${sender}
  </svg>`;
}

async function localSvgContext(imageUrl: string) {
  if (!imageUrl.startsWith("/")) return "";
  const relativePath = imageUrl.split(/[?#]/, 1)[0].replace(/^\/+/, "");
  const publicRoot = path.resolve(process.cwd(), "public");
  const resolvedPath = path.resolve(publicRoot, relativePath);
  if (!resolvedPath.startsWith(`${publicRoot}${path.sep}`) || !resolvedPath.toLowerCase().endsWith(".svg")) return "";
  return (await readFile(resolvedPath, "utf8").catch(() => "")).slice(0, 12000);
}

export async function POST(request: Request) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: getMissingGroqKeyMessage() }, { status: 500 });
  }

  const body = asRecord((await request.json().catch(() => null)) as unknown);
  const product = asRecord(body?.product);
  const preferences = asRecord(body?.preferences);
  const productName = cleanText(getString(product, "name"), "Selected gift", 120);
  const productDescription = cleanText(getString(product, "description"), "", 700);
  const productIdValue = product?.id;
  const productId =
    typeof productIdValue === "string" || typeof productIdValue === "number"
      ? String(productIdValue).trim()
      : "";
  const imageUrl = (
    getString(product, "imageUrl") ??
    getString(product, "image_url") ??
    getString(product, "image") ??
    ""
  ).trim();
  const receiverName = cleanText(getString(preferences, "receiverName"), "", 60);
  const senderName = cleanText(getString(preferences, "senderName"), "", 60);

  if (!productId || !imageUrl) {
    return NextResponse.json(
      {
        error: !productId
          ? "The selected cart product has no product ID."
          : "The selected cart product has no image URL.",
      },
      { status: 400 },
    );
  }

  const svgContext = await localSvgContext(imageUrl);
  const textPrompt = `/no_think\nYou are GenieAI's gift-card art director. Analyze the selected product image and create a matching gift-card direction. Match its dominant colors, visual theme, mood, and context while respecting the user's preferences. Write the requested card copy in ${cleanText(getString(preferences, "language"), "English", 20)}. Return one JSON object only with this schema: {"analysis":"brief visual rationale","background":"#RRGGBB","primary":"#RRGGBB","accent":"#RRGGBB","motif":"stars|hearts|floral|confetti|geometric","headline":"short card headline","message":"finished card message"}. Use readable, contrasting colors. Do not return SVG, HTML, markdown, or extra keys.\n\nInput: ${JSON.stringify({ product: { name: productName, description: productDescription }, preferences, svgSource: svgContext || undefined })}`;
  const content: Array<Record<string, unknown>> = [{ type: "text", text: textPrompt }];
  if (!svgContext && (/^https?:\/\//i.test(imageUrl) || /^data:image\/(?:png|jpe?g|webp);base64,/i.test(imageUrl))) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const model = process.env.GROQ_GIFT_CARD_MODEL ?? process.env.GROQ_VISION_MODEL ?? DEFAULT_GIFT_CARD_MODEL;
  let { model: usedModel, response } = await fetchGroqChatWithFallback(
    apiKey,
    {
      model,
      messages: [{ role: "user", content }],
      temperature: 0.55,
      max_completion_tokens: 700,
      response_format: { type: "json_object" },
    },
    [process.env.GROQ_GIFT_CARD_BACKUP_MODEL, process.env.GROQ_VISION_BACKUP_MODEL, DEFAULT_GIFT_CARD_BACKUP_MODEL],
  );

  if (response.status === 400) {
    ({ model: usedModel, response } = await fetchGroqChatWithFallback(
      apiKey,
      {
        model,
        messages: [{ role: "user", content }],
        temperature: 0.55,
        max_completion_tokens: 700,
      },
      [process.env.GROQ_GIFT_CARD_BACKUP_MODEL, process.env.GROQ_VISION_BACKUP_MODEL, DEFAULT_GIFT_CARD_BACKUP_MODEL],
    ));
  }

  if (response.status === 400 && content.length > 1) {
    ({ model: usedModel, response } = await fetchGroqChatWithFallback(
      apiKey,
      {
        model,
        messages: [{ role: "user", content: [content[0]] }],
        temperature: 0.55,
        max_completion_tokens: 700,
      },
      [process.env.GROQ_GIFT_CARD_BACKUP_MODEL, DEFAULT_GIFT_CARD_BACKUP_MODEL],
    ));
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: await readGroqError(response), model: usedModel },
      { status: response.status >= 500 ? response.status : 502 },
    );
  }

  const design = parseDesign(assistantContent((await response.json()) as unknown));
  if (!design) {
    return NextResponse.json({ error: "Groq did not return a valid gift-card design.", model: usedModel }, { status: 502 });
  }

  const svg = renderCardSvg(design, receiverName, senderName);
  return NextResponse.json({
    analysis: design.analysis,
    imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    message: design.message,
    model: usedModel,
    palette: [design.background, design.primary, design.accent],
  });
}
