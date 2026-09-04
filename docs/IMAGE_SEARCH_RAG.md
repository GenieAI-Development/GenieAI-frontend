# Image Search RAG

Image Search finds catalog products that look similar to an uploaded image. It uses CLIP image embeddings and Supabase pgvector; it is separate from text RAG and does not use the shopping reranker or personalization.

## Architecture

```text
Product image URLs → CLIP 512-dimension embeddings → Supabase pgvector
Uploaded image → CLIP 512-dimension embedding → cosine similarity search → top products
```

Each product image has its own vector. At query time, the best-matching image represents that product, then results are deduplicated to one result per product.

## Database


| Database object | Purpose |
| --- | --- |
| `kapruka_gift_product_image_urls` view | Combines `image_url` and `images[]`, normalizes supported URL shapes, and removes duplicate URLs per product. |
| `kapruka_gift_product_image_embeddings` table | Stores one normalized 512-dimension CLIP vector per unique product image. |
| `match_kapruka_gift_product_images` RPC | Returns the highest-similarity image for each in-stock product, ordered by cosine similarity. |

The embeddings table uses an HNSW cosine index. It stores the source URL, URL key, image-byte hash, image position, source update time, embedding model, and embedding time. It is service-role only; browser roles cannot read it directly.

The default ingestion model is `openai/clip-vit-base-patch32`.

## Search flow

1. The user uploads an image in the visual-search UI.
2. `/api/ai/image-search` validates that it is an image no larger than 4 MB.
3. The Next.js server loads `Xenova/clip-vit-base-patch32` with CPU `q8` inference, creates and L2-normalizes a 512-dimension vector.
4. The server calls the Supabase RPC with the matching embedding-model label and requests four in-stock products.
5. The API returns results only when the best cosine similarity meets the confidence threshold; otherwise the UI says no matching products were found in the system.

The model is loaded lazily on the first image search, so normal page loads do not download it.

## Rules and configuration

| Setting | Default | Rule |
| --- | --- | --- |
| `IMAGE_MATCH_THRESHOLD` | `0.65` | Best similarity must be at least this value. Valid range: `-1` to `1`. |
| `CLIP_IMAGE_MODEL` | `Xenova/clip-vit-base-patch32` | Runtime image-embedding model. Must produce 512 dimensions. |
| `PRODUCT_IMAGE_EMBEDDING_MODEL` | `openai/clip-vit-base-patch32` | Stored-vector model label sent to the RPC. |
| Results per visual search | `4` | Fixed maximum returned to the UI. |
| API duration | `120 seconds` | Node.js route limit. |
| Supabase search timeout | `10 seconds` | RPC request timeout. |

Cosine similarity is calculated by pgvector as:

```text
similarity = 1 - cosineDistance(queryEmbedding, productImageEmbedding)
```

Both stored and uploaded vectors are normalized. If embedding, Supabase, or matching fails, the API returns an empty low-confidence result rather than invoking the Groq image-search fallback.

## Limits

- Only images that have been backfilled can be found.
- Only products currently marked in stock are returned.
- This is visual similarity, not exact product identification or availability confirmation.
- Preferences, cross-encoder reranking, and Groq shopping fallback are intentionally not applied to visual search.

Implementation: `src/app/api/ai/image-search/route.ts`, `src/lib/clipImageEmbedding.ts`, and `src/lib/supabaseImageSearch.ts`.
