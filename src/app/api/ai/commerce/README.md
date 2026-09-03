# Commerce API modules

`route.ts` is the `/api/ai/commerce` endpoint. It validates the request, selects the task flow, and returns the HTTP response.

| File | Responsibility |
| --- | --- |
| `analysis.ts` | Interprets the latest message and extracts language, intent, and preference updates. |
| `preferences.ts` | Normalizes preferences, budget filters, search terms, and product relevance. |
| `catalog.ts` | Searches and ranks catalog products, including cached product lookups. |
| `recommendations.ts` | Builds and sanitizes AI replies, recommendations, and gift-message preferences. |
| `comparison.ts` | Creates deterministic and AI-generated product comparison insights. |
| `checkout.ts` | Validates checkout data, resolves delivery cities, checks delivery, and creates orders. |
| `commerce.ts` | Coordinates the main Groq/Novita commerce response. |
| `generation.ts` | Generates gift messages and product-page replies. |
| `request.ts` | Parses request fields, events, history, and produces local response metadata. |
| `ai.ts` | Shared AI-response parsing helpers. |
| `cache.ts` | Shared in-memory async cache helper. |
| `constants.ts` | Commerce models, limits, supported tasks, and fixed response defaults. |
| `types.ts` | Shared commerce request, catalog, and response types. |

Keep new commerce logic in the closest matching module; add a new module only when it represents a distinct responsibility.
