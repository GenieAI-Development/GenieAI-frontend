# Hugging Face Product Reranker

Genie AI uses a Hugging Face-hosted cross-encoder to reorder product candidates after RAG retrieval. It improves relevance for the user's English search query without changing live product data.

## Training

| Item | Value |
| --- | --- |
| Base model | `cross-encoder/ms-marco-MiniLM-L6-v2` |
| Training data | Public `tasksource/esci` (processed Amazon ESCI mirror) |
| Training scope | English queries from 10 gift-shopping categories |
| Train / validation pairs | 100,000 / 10,000 |
| Epochs | 2 |
| Batch size | 32 |
| Learning rate | `2e-5` |
| Maximum input length | 384 |
| Published model | [`ramitha2002/genieai-product-reranker`](https://huggingface.co/ramitha2002/genieai-product-reranker) |
| Hosted reranker | [`ramitha2002/product-reranker-model-api`](https://huggingface.co/spaces/ramitha2002/product-reranker-model-api) |

Whole query groups were retained, including irrelevant candidates. ESCI relevance labels were mapped as follows:

```ini
Exact = 1.00
Substitute = 0.70
Complement = 0.35
Irrelevant = 0.00
```

The gift categories are cakes and desserts, flower bouquets, chocolates and candy, perfume and fragrance, jewelry, fashion and accessories, gift baskets and hampers, skincare and beauty sets, personalized gifts, and home decor and candles.

### Fine-tuning evaluation

The fine-tuned model is compared with the public base model using the official ESCI test split. The evaluation measures NDCG@10, MRR, and HitRate@4. No numeric evaluation report is stored in this repository, so this document does not claim unverified metric improvements.

## How it works

1. RAG retrieves the available product candidates.
2. Budget and stock rules remove ineligible products.
3. Genie AI sends the normalized English query and remaining products to the hosted Hugging Face reranker.
4. The reranker returns a relevance score for every candidate.
5. Genie AI returns the reranked products to Groq for the shopping reply.

The integration is implemented in `src/lib/reranking/huggingFace.ts`; score validation and fallback handling are in `src/lib/reranking/service.ts`.

## Calculations

The hosted model's raw reranker score is first constrained to `-20` through `20`, then converted to a 0–1 relevance value:

```text
relevance = 1 / (1 + e^(-clamp(rawScore, -20, 20)))
```

- Products most relevant to the query are promoted.
- Raw model scores are ranking values, not probabilities.
- Candidate lists are reranked before the final product limit is applied; do not reduce them to four first.

## Availability and fallback

Configure the hosted service with:

```bash
HF_RERANKER_URL=https://your-space.hf.space
HF_TOKEN=hf_your_read_token
RERANK_TIMEOUT_SECONDS=90
```

`HUGGINGFACE_TOKEN` is also accepted. Timeout values are limited to 1–120 seconds.

If the hosted reranker fails, times out, or returns an incomplete result, Genie AI keeps the original RAG order, so shopping remains available even when Hugging Face is unavailable.

## Scope

The reranker is used for normal shopping recommendations. Visual/image search uses image-vector similarity directly and does not use this reranker.
