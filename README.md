# GenieAI

GenieAI is a multilingual gift-shopping assistant built with Next.js, React, and TypeScript.

- Keeps provider credentials, the Python service token, and anonymous session IDs on the server.
- Sends browser traffic only to local Next.js API routes.
- Supports English, Sinhala, and Singlish.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Recommendation flow](#recommendation-flow)
- [Mode flows](#mode-flows)
- [Reranking and personalization](#reranking-and-personalization)
- [Fine-tuned reranker model](#fine-tuned-reranker-model)
- [API routes](#api-routes)
- [Repository layout](#repository-layout)
- [Setup](#setup)
- [Important environment variables](#important-environment-variables)
- [Provider responsibilities](#provider-responsibilities)
- [Vercel hosting](#vercel-hosting)

## Features

- Smart Shopping with preference collection and recent user-message context.
- AI cart product analysis that scores each product pairing, identifies weak or duplicate combinations, and suggests a more balanced gift bundle.
- Event Planner with LLM-generated item lists and per-item product requests.
- Gift Box Builder with LLM-generated contents and total-budget allocation.
- RAG ///////////////////
- Hugging Face CrossEncoder relevance ranking for all 12 returned candidates.
- Rule-based session personalization using category, price, and recency signals.
- Product comparison, delivery checks, cart state, and checkout preparation.
- Image search and voice search.
- Gift messages, product-aware downloadable SVG gift cards generation.
- Per-mode persisted chats, preferences, plans, products, and paging state.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[GenieAI UI]
    Events[sessionStorage event queue]
    State[IndexedDB / localStorage]
  end

  subgraph Next.js server
    Commerce[Commerce API]
    Rerank[Reranking service]
    Profile[24-hour session profile]
    Tools[Context, image, voice, gift APIs]
  end

  Python[Python recommendation service]
  HF[Hugging Face CrossEncoder Space]
  Groq[Groq]
  Novita[Hugging Face via Novita]
  MCP[Commerce MCP]

  UI --> Commerce
  UI <--> Events
  UI <--> State
  Commerce -->|query + preferences + history| Python
  Python -->|12 candidates| Commerce
  Commerce --> Rerank
  Rerank --> HF
  Rerank <--> Profile
  Commerce --> Groq
  Tools --> Groq
  Tools --> Novita
  Commerce --> MCP
  Commerce -->|final products + reply| UI
```

- Python retrieves and filters the candidate products.
- Next.js owns the final product order.
- Next.js applies the HF CrossEncoder, personalization rules, and reply generation after Python responds.

## Recommendation flow

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant N as commerce API
  participant P as search API
  participant H as HF reranker
  participant S as Session profile
  participant G as Groq

  B->>N: query, preferences, history, buffered events
  N->>P: query, preferences, history
  P-->>N: products
  N->>S: Deduplicate and apply events
  N->>H: query + products
  H-->>N: raw relevance scores
  N->>S: Read preference signals
  N->>N: Sort products by final score
  N->>G: Generate reply from final products
  N-->>B: reply + final product order
  B->>B: Clear successfully sent events
```

- Context analysis decides whether the latest message requires product search.
- Product requests continue through the search API, HF reranking, and personalization pipeline.
- Greetings, identity or capability questions, general conversation, and delivery-only checks use a text-only Next.js reply.
- Text-only replies skip Python and HF, return an empty product list, and hide existing product cards.

## Mode flows

### Smart Shopping

- Sends the current user query.
- Sends active category, budget, city, occasion, and recipient preferences.
- Sends up to three previous user messages in oldest-to-newest order.
- Excludes assistant messages and the current query from history.
- Sends `[]` when there are no earlier user messages.

### Event Planner

```mermaid
flowchart TD
  A[User submits event preferences] --> B[LLM generates item list]
  B --> C[Choose current item]
  C --> D[Divide selected budget by generated item count]
  D --> E[Request Python products for current item]
  E --> F[HF rerank]
  F --> G[Personalize]
  G --> H[Display final products]
  H -->|Next / Previous item| C
```

- Generates the item list before product search.
- Uses the current generated item as `query`.
- Uses `Events` as the preference category.
- Divides both ends of a budget range by the generated-item count.
- Sends `chatHistory: null`.
- Keeps participants and venue in Next.js unless they materially improve the item query.

### Gift Box Builder

- Generates the box-item list before product search.
- Uses the current generated item as `query`.
- Keeps the selected gift-box theme/category as the preference category.
- Divides the total budget range by the generated-item count.
- Sends `chatHistory: null`.
- Uses the same Next/Previous item behavior as Event Planner.

## Reranking and personalization

### Relevance ranking

- Uses the fine-tuned CrossEncoder model `ramitha2002/genieai-product-reranker`.
- Uses the HF Space `ramitha2002/product-reranker-model-api` and its `/rerank` API.
- Sends every Python candidate with `top_n` equal to the candidate count.
- Uses product name/title, description, and category as model text inputs.
- Treats `rerankerScore` as a raw score that is comparable only within one query.
- Clamps raw scores to `[-20, 20]` before sigmoid normalization.
- Keeps Python order as the relevance baseline when the HF request fails or times out.

### Hyper-personalization

| Event | Weight |
|---|---:|
| `search` | 0.5 |
| `impression` | 0.1 |
| `view` | 1.0 |
| `compare` | 1.5 |
| `add_to_cart` | 3.0 |
| `remove_from_cart` | -1.0 |
| `purchase` | 5.0 |

- Browser events include an `eventId` for retry-safe deduplication.
- The session profile remembers up to 500 event IDs.
- Existing category scores decay by `0.9` when a new event batch is applied.
- Positive interactions with a weight of at least `1` influence price affinity and recent-product tracking.
- A recently interacted product receives a `0.25` repeat penalty.
- Profiles expire after 24 hours of inactivity.
- The current profile store is process-local; use Redis before deploying multiple Next.js instances.

### Score calculation

```text
relevance = sigmoid(rerankerScore)

preferenceScore =
  0.70 × categoryAffinity
  + 0.30 × priceAffinity
  - recentProductPenalty

finalScore = 0.75 × relevance + 0.25 × preferenceScore
```

- Scores are clamped to `[0, 1]`.
- Cold sessions omit `preferenceScore`; final order follows relevance alone.
- Final product data includes `finalScore`.
- Successful HF results also include `rerankerScore`.

## Fine-tuned reranker model

- Starts from the CrossEncoder base model `cross-encoder/ms-marco-MiniLM-L6-v2`.
- Fine-tunes on the public `tasksource/esci` dataset, a processed mirror of Amazon ESCI.
- Uses public data only; no GenieAI customer queries, catalog data, or other private examples are included in training.
- Focuses by default on ten gift-shopping categories:
  - cakes and desserts
  - flower bouquets
  - chocolates and candy
  - perfume and fragrance
  - jewelry
  - fashion and accessories
  - gift baskets and hampers
  - skincare and beauty sets
  - personalized gifts
  - home decor and candles
- Retains whole query groups, including irrelevant candidates, so ranking training reflects real product-search choices.
- Maps ESCI labels to graded relevance: Exact `1.00`, Substitute `0.70`, Complement `0.35`, and Irrelevant `0.00`.
- Uses the official ESCI train/test split.
- Uses two epochs, batch size 32, learning rate `2e-5`, and a maximum input length of 384 by default.
- Evaluates the fine-tuned model against the public base model with NDCG@10, MRR, and HitRate@4.
- Publishes the trained artifact as `ramitha2002/genieai-product-reranker` for hosted inference.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/ai/commerce` | POST | Main commerce orchestration and final ranking |
| `/api/ai/rerank` | POST | Standalone HF and personalization reranking pipeline |
| `/api/ai/context-analysis` | POST | Preference and language extraction |
| `/api/ai/chatbot` | POST | Standalone multilingual chatbot |
| `/api/ai/image-analysis` | POST | Image shopping hints |
| `/api/ai/gift-card` | POST | Safe SVG gift-card generation |
| `/api/ai/voice-messages` | POST | English voice transcription |
| `/api/delivery-prediction` | POST | Delivery prediction support |
| `/api/personalization/session` | GET | HTTP-only anonymous session cookie |

| Commerce task | Python | HF rerank | Purpose |
|---|---:|---:|---|
| `initial` | No | No | Default product showcase |
| `recommend` | Yes | Yes | Final product recommendations |
| `productPageReply` | No | No | Reply for local product paging |
| `eventPlan` | No | No | Event item-list generation |
| `giftBox` | No | No | Gift-box item-list generation |
| `compare` | No | No | Two-product comparison |
| `giftMessage` | No | No | Gift-message text |
| `checkout` | No | No | Checkout preparation |



## Repository layout

```text
GenieAI-frontend/
├── README.md
└── src/
    ├── app/api/ai/
    │   ├── commerce/
    │   ├── rerank/route.ts
    │   ├── context-analysis/route.ts
    │   ├── image-analysis/route.ts
    │   ├── gift-card/route.ts
    │   └── voice-messages/route.ts
    ├── genie-ai/GenieAIController.tsx
    ├── lib/personalization/
    ├── lib/reranking/
    ├── lib/commerceMcp.ts
    ├── lib/groqHosted.ts
    ├── env.local.example
    └── package.json
```

## Setup

Prerequisites:

- Node.js 20 or newer.
- npm.
- Running Python recommendation service.
- Shared token configured in Python and Next.js.
- Groq API key.
- Hugging Face token recommended for the hosted reranker.
- Commerce MCP access for showcase, delivery, comparison, and checkout.

Run from the repository root:

```powershell
Set-Location src
npm install
Copy-Item env.local.example .env.local
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000).
- Restart the server after changing `.env.local`.

## Important environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `GROQ_API_KEY` | Yes | Groq credential; `GROQ_TOKEN` is also accepted |
| `GROQ_PRODUCT_MATCHING_MODEL` | No | Groq model used when Qoder cart analysis fails; defaults to `openai/gpt-oss-120b` |
| `AI_SERVICE_URL` | Yes for recommendations | Python recommendation service URL |
| `AI_SERVICE_TOKEN` | Yes for recommendations | Shared Python service bearer token |
| `HF_TOKEN` | Recommended | Hosted HF reranker and HF Inference access; `HUGGINGFACE_TOKEN` also works |
| `QODER_PAT` | Yes for Qoder features | Server-side Qoder Cloud personal access token |
| `QODER_ENV_ID` | Yes for Qoder features | Qoder Cloud environment ID |
| `QODER_PRODUCT_MATCHING_AGENT_ID` | Yes for cart matching | ID of the `genie-product-matching` agent; falls back to `QODER_AGENT_ID` |

- Keep every value server-only.
- Never use the `NEXT_PUBLIC_` prefix for credentials or service tokens.
- See [`src/env.local.example`](src/env.local.example) for the full optional configuration list.

## Provider responsibilities

| Capability | Provider / model | Fallback or note |
|---|---|---|
| Candidate retrieval and hard filters | Python recommendation service | Returns 12 eligible products |
| Relevance reranking | Fine-tuned CrossEncoder `ramitha2002/genieai-product-reranker` via HF Space `ramitha2002/product-reranker-model-api` | Python order becomes relevance baseline |
| Session personalization | Next.js rule engine | Cold sessions use relevance only |
| Context, commerce replies, guided plans | Groq `openai/gpt-oss-120b` | Local/route fallback behavior |
| Product comparison and English gift messages | Groq `openai/gpt-oss-20b` | Deterministic or generic fallback |
| Sinhala and Singlish responses | Groq `openai/gpt-oss-120b` | HF Novita can assist selected language flows |
| Novita language generation | HF Inference `google/gemma-4-31B-it:novita` | Groq fallback where configured |
| Image analysis | Groq `qwen/qwen3.6-27b` | Filename-derived hints |
| Gift-card art direction | Groq `qwen/qwen3.6-27b` | Backup `qwen/qwen3.8-27b` |
| Voice transcription | Groq `whisper-large-v3-turbo` | Retry response |
| Default showcase, details, delivery, checkout | Commerce MCP | Feature-specific error behavior |
| Read aloud | Browser Speech Synthesis API | No server model |

## Vercel hosting

- Import this repository into Vercel.
- Set the project root directory to `src`.
- Keep the default Next.js build settings.
- Add `GROQ_API_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, and `HF_TOKEN` in **Project Settings → Environment Variables**.
- Configure the same variables for Preview and Production when both environments use recommendations.
- Confirm Vercel functions can reach the Python service, Hugging Face Space, Groq/Novita, and commerce MCP endpoints.
- Use a Vercel function duration compatible with hosted reranking startup.
- Keep every token server-only; do not create `NEXT_PUBLIC_` versions.

## License

- No license file is included yet.
- Add a license before distributing the project publicly.
