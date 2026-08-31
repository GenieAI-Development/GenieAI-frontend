import "server-only";

const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSIONS = 384;
const DEFAULT_HF_INFERENCE_ROOT =
  "https://router.huggingface.co/hf-inference/models";

function getEmbeddingEndpoint() {
  return (
    process.env.HF_EMBEDDING_URL?.trim() ||
    `${DEFAULT_HF_INFERENCE_ROOT}/${EMBEDDING_MODEL}/pipeline/feature-extraction`
  );
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value * value, 0),
  );

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("The embedding service returned an empty vector.");
  }

  return vector.map((value) => value / magnitude);
}

export async function embedProductQuery(query: string) {
  const token = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN;

  if (!token) {
    throw new Error("Query embedding requires HF_TOKEN.");
  }

  const response = await fetch(getEmbeddingEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: query,
      normalize: true,
      truncate: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Query embedding failed with ${response.status}.`);
  }

  const body = (await response.json()) as unknown;
  const candidate =
    Array.isArray(body) && Array.isArray(body[0]) ? body[0] : body;

  if (
    !Array.isArray(candidate) ||
    candidate.length !== EMBEDDING_DIMENSIONS ||
    !candidate.every(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
  ) {
    throw new Error("The embedding service returned an invalid vector.");
  }

  return normalizeVector(candidate);
}

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };
