# GenieAI Project Brief

## Problem

Gift shopping is often slow and uncertain. Shoppers must search through large catalogues, compare options, check price and availability, and decide whether an item fits the recipient, occasion, and budget. This is especially difficult when requests are conversational, multilingual, or based on an image rather than an exact product name.

## Solution

GenieAI is a multilingual AI shopping assistant that turns a natural-language or image-based request into relevant, purchasable gift options. It supports Smart Shopping, Gift Box planning, product comparison, cart analysis, delivery preparation, voice input, and product-matched Gift Card creation.

The recommendation flow combines:

1. A Python FastAPI service to understand the request with OpenAI `gpt-4.1-mini` (falling back to `gpt-5-mini`), embed the full search message with `text-embedding-3-small`, then retrieve and filter eligible products using Qdrant, BM25, reciprocal-rank fusion, Supabase catalogue data, stock, price, and image checks.
2. A Next.js application to manage the chat experience, preferences, personalization, product UI, and commerce workflows.
3. An optional Hugging Face CrossEncoder in Extended search mode to improve the relevance order of candidates.

Users can choose Standard search for faster catalogue ranking or Extended search for additional HF relevance ranking, which usually adds 2–3 seconds.

## AI usage

### AI technologies

| AI technology | How GenieAI uses it |
| --- | --- |
| Groq models | Commerce replies, query/context analysis, product comparison, image analysis, delivery prediction, Gift Card preferences, and voice transcription. |
| Python backend OpenAI models | `gpt-4.1-mini` for structured query understanding and recommendation planning, `gpt-5-mini` as fallback, and `text-embedding-3-small` for Qdrant query embeddings. |
| Qwen models | Shared Groq fallback, image analysis, delivery prediction, and Gift Card analysis fallback. |
| Hugging Face CrossEncoder | Optional Extended-mode product relevance reranking after backend retrieval and filtering. |
| RAG | Qdrant dense retrieval plus BM25 lexical retrieval, combined with reciprocal-rank fusion. |
| CLIP + pgvector | Local CLIP image embeddings and Supabase pgvector visual similarity search. |
| Supabase catalogue cache | Product descriptions, prices, stock, images, and filtering data for recommendation results. |
| Personalization | Anonymous session signals from impressions, views, Favorites, Wishlist activity, cart actions, and purchases. |
| Qoder Cloud Agent | Integrated cart/product-bundle analysis and matching insights. |
| Qoder automations | RAG and database preparation, image-intent generation, HF reranker data/pipeline preparation, planning, diagrams, and documentation. |

### Model inventory

| Provider | Model | Purpose |
| --- | --- | --- |
| OpenAI, Python backend | `gpt-4.1-mini` | Primary structured query understanding and recommendation planning: category, price limits, stock requirements, constraints, and category/index plan. |
| OpenAI, Python backend | `gpt-5-mini` | Fallback when the primary planner fails validation or API execution after retries. |
| OpenAI, Python backend | `text-embedding-3-small` | Embeds the user's full search message for Qdrant dense retrieval. |
| Groq | `openai/gpt-oss-120b` | Commerce/context analysis, English commerce replies, standalone chat, cart product matching, and several fallback paths. |
| Groq | `openai/gpt-oss-20b` | Product comparison, English gift messages, Gift Card voice-detail extraction, and fallback paths. |
| Groq | `qwen/qwen3.6-27b` | Shared text fallback, image analysis, delivery prediction, and Gift Card analysis. |
| Groq | `qwen/qwen3.8-27b` | Gift Card analysis fallback. |
| Groq | `whisper-large-v3-turbo` | Voice transcription for chat, checkout, and Gift Card detail filling. |
| Hugging Face / Novita | `google/gemma-4-31B-it:novita` | Eligible Sinhala and Singlish replies and non-English gift messages before Groq fallback. |
| Hugging Face / Novita | `Qwen/Qwen2.5-72B-Instruct:novita` | Optional environment override for the Novita reply model. |
| Hugging Face | `cross-encoder/ms-marco-MiniLM-L6-v2` | Base model fine-tuned for product relevance ranking. |
| Hugging Face | `ramitha2002/genieai-product-reranker` | Fine-tuned product reranker published for hosted inference. |
| Transformers.js | `Xenova/clip-vit-base-patch32` | 512-dimensional image embeddings for visual product search. |

### Fine-tuned reranker

GenieAI fine-tuned `cross-encoder/ms-marco-MiniLM-L6-v2` using public `tasksource/esci` data for English gift-product relevance. The training set covered ten gift-shopping categories and used 100,000 training pairs plus 10,000 validation pairs. Training used two epochs, batch size 32, a learning rate of `2e-5`, and maximum input length 384. The resulting model, `ramitha2002/genieai-product-reranker`, is hosted through the `ramitha2002/product-reranker-model-api` Hugging Face Space.

The reranker is used only in Extended search mode. Standard mode preserves fast backend ranking, and Extended mode safely preserves that original order if the hosted model is unavailable.

For the code-level defaults and fallbacks, see [AI models and fallbacks](AI_USAGE_AND_MODELS.md). For the reranker’s data and integration details, see [HF Product Reranker](HF_RERANKER.md).

## Impact

- Reduces product discovery effort by converting a gift need into filtered, ranked product cards.
- Helps shoppers make better decisions with budget, availability, recipient, and occasion context.
- Supports multilingual and voice-led interactions for a more accessible shopping experience.
- Provides a faster Standard mode and a higher-relevance Extended mode, so users can choose the right speed/quality trade-off.
- Reuses interaction signals such as views, Favorites, Wishlist activity, cart actions, and purchases to improve future ranking within an anonymous session.
- Keeps core product retrieval resilient: if HF reranking is unavailable, GenieAI preserves the backend order and continues the shopping flow.

## Roadmap

1. **Improve catalogue freshness:** automate more frequent product, price, stock, image, and description synchronization.
2. **Evaluate ranking quality:** record and compare retrieval and reranking metrics such as NDCG, MRR, click-through rate, and conversion signals.
3. **Expand personalization:** add user-controlled preference editing, clearer recommendation explanations, and opt-in cross-session profiles.
4. **Improve multilingual support:** extend voice input and quality validation for Sinhala and Singlish workflows.
5. **Operationalize model monitoring:** add provider latency, availability, error, and fallback dashboards for Groq, HF, Qoder, and the Python backend.
6. **Scale recommendation infrastructure:** move the reranker and retrieval components to monitored production services with predictable capacity and observability.
