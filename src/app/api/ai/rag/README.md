# Product RAG API

This directory implements semantic product retrieval, Groq relevance reranking, and event-based personalization. Its public server endpoint is:

```text
POST /api/ai/rag/search
```

The implementation uses Supabase Postgres with `pgvector`. The browser calls the Next.js endpoint, never the database or embedding services directly. The commerce API also calls the same pipeline internally through `commerce/catalog.ts`, so its frontend contract is unchanged.

## Current status

Implemented:

- The source product table is `public.kapruka_gift_products`.
- The source key is `assigned_category + product_id`.
- [`scripts/kapruka_product_embeddings.sql`](../../../../../scripts/kapruka_product_embeddings.sql) creates the pgvector embedding table, index, and protected similarity-search RPC.
- [`scripts/vectorize_kapruka_products.py`](../../../../../scripts/vectorize_kapruka_products.py) reads all source products and performs resumable embedding upserts.
- The selected embedding model is English-only `sentence-transformers/all-MiniLM-L6-v2` with 384 dimensions.
- Query embedding, vector retrieval, keyword fallback, Groq reranking, event-based personalization, and commerce integration are implemented in this directory.

Deployment setup still required: run the SQL, run the one-time backfill, and configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `HF_TOKEN`, and `GROQ_TOKEN` or `GROQ_API_KEY` on the server.

## Structure

```text
rag/
├── README.md          # Architecture, setup, and fallback behavior
├── search/route.ts    # POST /api/ai/rag/search
├── vectorization.ts   # Hosted query embedding logic
├── retrieval.ts       # Supabase vector search and keyword fallback
├── filters.ts         # Query construction and category normalization
├── reranking.ts       # Groq relevance reranking
├── personalization.ts # Event-based scoring and final reranking
├── integration.ts     # Full pipeline and fallback coordination
└── types.ts           # Internal request and response contracts
```

## 1. Product vectorization

### Purpose

Convert each product's searchable text into an embedding and store it beside the product ID. Vectorization runs when a product is created or when searchable product content changes; it should not run for every user request.

### Searchable product text

Build one normalized string from the fields that describe what the product is:

```text
Title: Pink Rose Bouquet
Description: Fresh pink roses arranged for birthdays and celebrations.
Category: Flowers
```

Do not place changing operational values such as stock, price, delivery status, or popularity inside the embedding text. Store those values as normal database columns so they can be filtered deterministically.

### Embedding model

The first version uses `sentence-transformers/all-MiniLM-L6-v2`: an English-only, 384-dimension sentence-embedding model. The backfill normalizes product vectors. Query vectors must use the same model and normalization setting.

Changing the embedding model later requires re-vectorizing every stored product into a new vector column or collection version. Vectors produced by different models must not be compared.

### Embedding database fields

```text
kapruka_gift_product_embeddings
├── assigned_category  text, primary-key part
├── product_id          text, primary-key part
├── searchable_text    text
├── embedding          vector(384)
├── embedding_model    text
├── content_hash       text
├── source_updated_at  timestamptz
├── embedded_at        timestamptz
└── source foreign key → kapruka_gift_products
```

`content_hash` prevents unnecessary repeat embedding. `embedding_model` records which model generated the vector. Product details such as name, description, price, stock, image URL, and product URL remain in `kapruka_gift_products` and are retrieved by ID after the vector search.

### Vectorization flow

```text
Product created or updated
        ↓
Build normalized searchable text
        ↓
Compare content hash with stored hash
        ↓
Generate embedding only when content changed
        ↓
Upsert product ID, text, metadata, and embedding into Supabase
```

### One-time backfill

Run the SQL setup first, then run:

```powershell
python -m pip install sentence-transformers
python .\scripts\vectorize_kapruka_products.py
```

The script reads all product rows in pages, creates embeddings in batches, upserts them by the source composite key, retries transient Supabase failures, and stores a checkpoint after each completed page. It can safely be rerun.

The backfill process is:

1. Read products in small pages.
2. Build the searchable text for each product.
3. Generate embeddings in controlled batches.
4. Upsert rows into `kapruka_gift_product_embeddings`.
5. Record failures for retry.
6. Verify every active product has an embedding.

## 2. Product retrieval

### Input

The RAG search endpoint receives the analyzed query and structured preferences—not raw chat history.

```json
{
  "query": "birthday flowers for mother",
  "preferences": {
    "category": "Flowers",
    "budgetMin": 2500,
    "budgetMax": 6000,
    "deliveryCity": "Colombo",
    "occasion": "Birthday",
    "recipient": "Mother"
  }
}
```

The current pipeline retrieves at least 20 candidates when available and returns at most 12 final products. These server-controlled limits are not accepted from browser input.

### Query preparation

Build a concise semantic query from the analyzed user request and useful descriptive preferences:

```text
birthday flower gift for mother
```

Use category, occasion, recipient, and gift type when they improve meaning. Keep budget, stock, and delivery requirements as filters instead of relying on semantic similarity to enforce them.

### Retrieval flow

```text
Analyzed query + preferences
        ↓
Build normalized semantic query
        ↓
Embed query with the same model used for products
        ↓
Call a Supabase Postgres RPC with the query vector
        ↓
Apply indexed payload/column filters
        ↓
Order eligible rows by vector similarity
        ↓
Return at least 20 eligible product IDs and similarity scores
        ↓
Fetch or join complete product records in the same order
```

### Hard filters

Apply these as database or deterministic application filters:

- Product is in stock.
- Price is within the requested minimum and maximum.
- Category matches when the user explicitly selected one.
- Delivery filtering will be added when reliable product delivery metadata exists.

Filtering happens before Groq reranking. Keyword and live-catalog fallbacks supplement short vector results where possible. If fewer than 20 valid products exist across all sources, the pipeline returns the available products rather than adding invalid ones.

### RPC result

```json
[
  {
    "product_id": "product-45",
    "similarity": 0.89
  }
]
```

## 3. Groq relevance reranking

The Groq LLM reranker receives the analyzed query and valid RAG candidates. It ranks only query-product relevance and selects the best 12.

```text
At least 20 valid RAG candidates
        ↓
Groq ranks each query-product pair
        ↓
Sort by relevance score
        ↓
Keep the best 12 products
```

Groq does not enforce stock, budget, category, delivery, or personalization. If Groq is missing, fails, times out, or returns invalid product IDs, the pipeline preserves the RAG candidate order and takes the first 12.

## 4. Personalization reranking

The personalization layer receives only the 12 products selected by Groq. It uses the current request's events and the anonymous session profile to reorder those same products.

It must not introduce new products, restore filtered products, or violate hard constraints. When the request contains no event data, the entire personalization step is skipped and the Groq order is preserved.

```text
12 Groq-ranked products
        ↓
Load profile and session interaction signals
        ↓
Calculate personalization scores
        ↓
Rerank the same 12 products
        ↓
Return the final ordered 12
```

### Final search response

```json
{
  "products": [
    {
      "id": "product-45",
      "name": "Pink Rose Bouquet",
      "description": "Fresh pink roses for birthdays.",
      "price": 4500,
      "category": "Flowers",
      "stock": 1,
      "stockLabel": "In stock"
    }
  ],
  "meta": {
    "personalized": true,
    "rerankerFallback": false,
    "retrievalFallback": false,
    "source": "supabase-vector"
  }
}
```

### Retrieval fallback

The implemented fallback chain is:

1. Supabase pgvector semantic search.
2. Filtered Supabase keyword/category search if embedding or vector search fails, or to supplement a vector result with fewer than 20 products.
3. Existing live commerce catalog when called through `commerce/catalog.ts` and Supabase still has fewer than 20 candidates.
4. Original candidate order if Groq reranking fails.
5. No-op personalization when no event data exists.

## 5. Commerce integration

### Ownership

```text
commerce/analysis.ts
    Analyzes language, intent, and preferences.

rag/search/route.ts
    Accepts the analyzed query and returns retrieved products.

commerce/catalog.ts
    Calls the RAG search layer and normalizes its product response.

commerce/route.ts
    Coordinates the recommendation task and returns the API response.
```

The commerce route should not know how embeddings or vector similarity work. It should depend only on a typed retrieval function.

### Integration function

```text
rankCommerceProducts({
  query,
  preferences,
  events,
  sessionId,
  fallbackCandidates
})
```

This function belongs in the RAG module. `commerce/catalog.ts` calls it and converts the returned records into the existing commerce `Product` model.

### End-to-end flow

```text
Browser sends shopping message
        ↓
/api/ai/commerce analyzes the request
        ↓
Commerce builds query + structured preferences
        ↓
Commerce calls the internal RAG retrieval function
        ↓
RAG embeds the query and searches Supabase pgvector
        ↓
RAG returns at least 20 eligible products when available
        ↓
Groq reranks them and selects the best 12
        ↓
Personalization reranks those same 12 products
        ↓
Commerce generates the assistant reply
        ↓
Frontend receives product cards and reply
```

### Security boundaries

- Generate embeddings and query Supabase only from trusted server or Edge Function code.
- Never expose the Supabase service-role key to the browser.
- Validate query length, preferences, and result limits.
- Use parameterized Supabase RPC calls.
- Keep row-level security enabled for browser-accessible tables.
- Log failures without logging secrets or full sensitive user messages.

## Implementation checklist

### Vectorization

- [x] Create the SQL setup for the Supabase `vector` extension, embedding table, and index.
- [x] Choose and record the English embedding model and dimensions.
- [x] Create product text normalization, content hashing, and embedding upsert tooling.
- [ ] Run the SQL setup in Supabase.
- [ ] Backfill embeddings for all active products.
- [ ] Add synchronization for future product changes.

### Retrieval

- [x] Define typed search request and response contracts.
- [x] Implement query normalization and embedding.
- [x] Create the Supabase similarity-search RPC.
- [x] Add stock, category, and budget filters.
- [x] Return at least 20 valid products in similarity order when available.
- [x] Add filtered Supabase and live-catalog fallbacks.
- [ ] Add delivery filtering when reliable product delivery metadata is stored.
- [ ] Add retrieval tests and relevance test queries.

### Reranking and personalization

- [x] Integrate Groq as the relevance reranker.
- [x] Rerank the valid RAG candidate pool and select the best 12.
- [x] Load and update the anonymous session profile from interaction events.
- [x] Personalize the order of those same 12 products.
- [x] Preserve the Groq order when no event data is supplied.
- [x] Ensure neither stage can bypass hard filters or add new products.

### Integration

- [x] Add `POST /api/ai/rag/search`.
- [x] Add the internal `rankCommerceProducts()` function.
- [x] Connect `commerce/catalog.ts` to the RAG module.
- [x] Preserve the existing commerce product response contract.
- [x] Add bounded requests and fallback metadata.
- [ ] Add an end-to-end commerce recommendation test.
