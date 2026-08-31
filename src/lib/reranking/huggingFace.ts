import "server-only";

import { asRecord, getNumber, getString } from "@/lib/aiPayload";
import type { Product } from "@/lib/productCatalog";

const DEFAULT_SPACE_URL =
  "https://ramitha2002-product-reranker-model-api.hf.space";
const DEFAULT_TIMEOUT_SECONDS = 90;

export type HuggingFaceRerankResult = {
  id: string;
  rerankerScore: number;
};

function getTimeoutMs() {
  const configured = Number(process.env.RERANK_TIMEOUT_SECONDS);
  const seconds = Number.isFinite(configured)
    ? Math.min(120, Math.max(1, configured))
    : DEFAULT_TIMEOUT_SECONDS;
  return seconds * 1000;
}

function getSpaceUrl() {
  return (process.env.HF_RERANKER_URL || DEFAULT_SPACE_URL).replace(/\/+$/, "");
}

function getHeaders() {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
}

function toModelProduct(product: Product) {
  return {
    category: product.category,
    description: product.description,
    id: product.id,
    inStock: product.stock > 0,
    name: product.name,
    price: product.price,
    title: product.name,
  };
}

function unwrapOutput(value: unknown): unknown {
  let output = value;

  if (Array.isArray(output) && output.length === 1) {
    [output] = output;
  }

  if (typeof output === "string") {
    try {
      output = JSON.parse(output) as unknown;
    } catch {
      throw new Error("Hugging Face reranker returned invalid JSON.");
    }
  }

  return output;
}

function parseResults(value: unknown): HuggingFaceRerankResult[] {
  const output = unwrapOutput(value);
  const results = Array.isArray(output)
    ? output
    : asRecord(output)?.results;

  if (!Array.isArray(results)) {
    throw new Error("Hugging Face reranker returned no results array.");
  }

  return results.map((item) => {
    const record = asRecord(item);
    const id = getString(record, "id")?.trim();
    const rerankerScore = getNumber(record, "rerankerScore");

    if (!id || rerankerScore === null || !Number.isFinite(rerankerScore)) {
      throw new Error("Hugging Face reranker returned an invalid result.");
    }

    return { id, rerankerScore };
  });
}

function parseSseResult(body: string) {
  const events = body.split(/\r?\n\r?\n/);

  for (const event of events) {
    const lines = event.split(/\r?\n/);
    const eventName = lines
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");

    if (eventName === "error") {
      throw new Error("Hugging Face reranker job failed.");
    }

    if (eventName === "complete" && data) {
      return JSON.parse(data) as unknown;
    }
  }

  throw new Error("Hugging Face reranker returned no completed result.");
}

export async function rerankWithHuggingFace(
  query: string,
  products: Product[],
) {
  if (products.length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const spaceUrl = getSpaceUrl();
    const submission = await fetch(`${spaceUrl}/gradio_api/call/v2/rerank`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        products: products.map(toModelProduct),
        query,
        top_n: products.length,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!submission.ok) {
      throw new Error(`Hugging Face reranker failed with ${submission.status}.`);
    }

    const eventId = getString(
      asRecord((await submission.json()) as unknown),
      "event_id",
    );
    if (!eventId) {
      throw new Error("Hugging Face reranker returned no event ID.");
    }

    const completion = await fetch(
      `${spaceUrl}/gradio_api/call/rerank/${encodeURIComponent(eventId)}`,
      {
        headers: getHeaders(),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!completion.ok) {
      throw new Error(`Hugging Face reranker stream failed with ${completion.status}.`);
    }

    return parseResults(parseSseResult(await completion.text()));
  } finally {
    clearTimeout(timeoutId);
  }
}
