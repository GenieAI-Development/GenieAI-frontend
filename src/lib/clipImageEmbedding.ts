const DEFAULT_MODEL = "Xenova/clip-vit-base-patch32";
const EXPECTED_DIMENSIONS = 512;

type FeatureTensor = {
  data: ArrayLike<number>;
  dims?: number[];
};

type ImageFeatureExtractor = (
  image: Blob,
) => Promise<FeatureTensor>;

let extractorPromise: Promise<ImageFeatureExtractor> | null = null;

export function getClipImageModel() {
  return process.env.CLIP_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
}

async function loadExtractor(): Promise<ImageFeatureExtractor> {
  const { pipeline } = await import("@huggingface/transformers");
  const extractor = await pipeline(
    "image-feature-extraction",
    getClipImageModel(),
    {
      device: "cpu",
      dtype: "q8",
    },
  );

  return extractor as unknown as ImageFeatureExtractor;
}

function getExtractor() {
  extractorPromise ??= loadExtractor().catch((error) => {
    extractorPromise = null;
    throw error;
  });
  return extractorPromise;
}

export async function warmClipImageModel() {
  await getExtractor();
  return getClipImageModel();
}

function normalize(values: number[]) {
  const magnitude = Math.sqrt(
    values.reduce((total, value) => total + value * value, 0),
  );

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("CLIP returned an invalid zero-length image vector.");
  }

  return values.map((value) => value / magnitude);
}

export async function embedImageWithClip(
  bytes: ArrayBuffer,
  mimeType: string,
) {
  const extractor = await getExtractor();
  const image = new Blob([bytes], { type: mimeType || "image/jpeg" });
  const output = await extractor(image);
  const vector = Array.from(output.data, Number);

  if (
    vector.length !== EXPECTED_DIMENSIONS ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Expected a ${EXPECTED_DIMENSIONS}-dimensional CLIP image vector, received ${vector.length}.`,
    );
  }

  return normalize(vector);
}
