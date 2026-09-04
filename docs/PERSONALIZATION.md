# Personalization

Genie AI uses anonymous, session-scoped behaviour to improve the order of products in normal shopping recommendations. It learns lightweight preferences from product interactions; it does not require an account.

## Where it applies

- Applies to normal `recommend` product searches and the internal reranking API.
- Does not apply to visual/image search, which returns vector-similarity matches directly.
- Does not change the product catalog; it only reorders retrieved candidates.

## Flow

1. The browser records product interactions and queues them in `sessionStorage` (up to 100 pending events).
2. On the next recommendation search, queued events are sent with the request.
3. The server updates the anonymous session profile, reranks the retrieved products, and returns the ordered results.
4. Events are cleared from the browser queue only after a successful product-search response.

## Signals collected

Each event can contain the product ID, category, price, result position, active query, and timestamp.

| Event | Weight | Recorded by the UI |
| --- | ---: | --- |
| Impression | 0.1 | Yes, when a result is shown |
| View | 1 | Yes |
| Compare | 1.5 | Yes |
| Add to cart | 3 | Yes |
| Remove from cart | -1 | Yes |
| Purchase | 5 | Yes, at checkout |
| Search | 0.5 | Supported by the API; not currently emitted by the UI |

Duplicate event IDs are ignored. If an ID is unavailable, a timestamp/event/product/query combination is used for deduplication.

## What the profile learns

- **Category affinity:** every accepted event updates the matching category by its weight. Existing category scores decay by 10% whenever a new batch is processed.
- **Price preference:** strong positive product interactions (weight `>= 1`) update a weighted average price. The preferred range is 75%–125% of that average.
- **Recent interactions:** strong positive product interactions retain the latest 20 product IDs to reduce repeated recommendations.
- **Recent queries:** retains the latest 10 queries.

Profile limits: 500 remembered event IDs, 10,000 profiles per server instance, and a 24-hour profile lifetime. Each accepted event refreshes the 24-hour expiry.

## Ranking rules

The final score combines retrieval relevance and the learned profile:

- Without usable signals: relevance only.
- With signals: **75% relevance + 25% preference**.
- Preference is **70% category affinity + 30% price fit**, minus a fixed `0.25` penalty for recently interacted products.

The cross-encoder supplies relevance when available. If it is unavailable, the original candidate order is used as a relevance fallback, while personalization can still apply.