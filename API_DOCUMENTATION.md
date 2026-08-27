# Kapruka Genie API Documentation

This document is the source-based HTTP API reference for the Kapruka Genie application in this repository. It documents every public application API route under `src/app/api`, including request fields, response fields, validation, task-specific behavior, upstream services, fallbacks, and errors.

## Contents

1. [API overview](#api-overview)
2. [Common conventions](#common-conventions)
3. [Shared data models](#shared-data-models)
4. [`POST /api/ai/chatbot`](#post-apiaichatbot)
5. [`POST /api/ai/context-analysis`](#post-apiaicontext-analysis)
6. [`POST /api/ai/image-analysis`](#post-apiaimage-analysis)
7. [`POST /api/ai/voice-messages`](#post-apiaivoice-messages)
8. [`POST /api/ai/commerce`](#post-apiaicommerce)
9. [Environment variables](#environment-variables)
10. [External provider behavior](#external-provider-behavior)
11. [Security and operational notes](#security-and-operational-notes)

## API overview

| Method | Path | Content type | Purpose | Main upstream service |
|---|---|---|---|---|
| `POST` | `/api/ai/chatbot` | `application/json` | Short multilingual shopping chat | Groq; Hugging Face/Novita for configured Tanglish replies |
| `POST` | `/api/ai/context-analysis` | `application/json` | Extract budget, recipient, occasion, and gift type | Local heuristics plus Groq |
| `POST` | `/api/ai/image-analysis` | `multipart/form-data` | Analyze a shopping image and produce search hints | Groq vision |
| `POST` | `/api/ai/voice-messages` | `multipart/form-data` | Transcribe English audio | Groq Whisper |
| `POST` | `/api/ai/commerce` | `application/json` | Product search, planning, comparison, tracking, checkout, and gift-message orchestration | Kapruka MCP, Groq, and Hugging Face/Novita |

All five routes use the Next.js Node.js runtime. No route exports a `GET`, `PUT`, `PATCH`, or `DELETE` handler.

## Common conventions

### Base URL

For local development, the base URL is:

```text
http://localhost:3000
```

Example full endpoint:

```text
http://localhost:3000/api/ai/commerce
```

In production, replace the base URL with the deployed application origin.

### Authentication

The application API routes do **not** currently authenticate incoming clients. Provider credentials are server-side environment variables and must never be sent by the browser:

- `GROQ_API_KEY` or `GROQ_TOKEN`
- `HF_TOKEN` or `HUGGINGFACE_TOKEN`

There is also no application-level authorization, request quota, or rate limiter in these route handlers. See [Security and operational notes](#security-and-operational-notes) before exposing them publicly.

### Request and response format

- JSON endpoints expect `Content-Type: application/json`.
- File endpoints expect browser-compatible `multipart/form-data`. Let the HTTP client generate the multipart boundary.
- Responses are JSON, including errors.
- JSON parsing failures are generally treated as an empty request object and then fail the endpoint's normal required-field validation.
- Unknown JSON fields are ignored.
- Unless noted otherwise, strings are accepted without a documented maximum request length.

### Error envelope

Most failures use:

```json
{
  "error": "Human-readable error message"
}
```

Some provider errors additionally include `model`, and the voice retry response includes `retry`.

### Language values

The canonical application language values are:

```text
English | Sinhala | Singlish | Tanglish
```

- `Sinhala` responses use Sinhala script.
- `Singlish` means conversational Sinhala written with Latin characters.
- `Tanglish` means conversational Tamil, optionally mixed with simple English, written with Latin characters.
- Invalid or omitted language values fall back to `English` unless an endpoint says otherwise.

### Currency and dates

- Commerce operations use `LKR`.
- Dates use `YYYY-MM-DD`.
- The commerce API changes an invalid or past non-empty profile date to the server's current local date.
- An omitted or empty profile date remains absent.

## Shared data models

### Error

| Field | Type | Required | Description |
|---|---|---:|---|
| `error` | string | Yes | Human-readable failure message. |
| `model` | string | No | Model used when the failure came from a model-backed endpoint. |
| `retry` | boolean | No | `true` only when voice input should be recorded again. |

### Chat message

| Field | Type | Required | Description |
|---|---|---:|---|
| `role` | string enum | Yes | Chatbot accepts `system`, `user`, or `assistant`. Commerce history accepts only `user` or `assistant`. |
| `content` | string | Yes | Message text. Empty content is discarded. Model `<think>` content is stripped in the chatbot endpoint. |

### Shopping profile

| Field | Type | Required | Description |
|---|---|---:|---|
| `budget` | string | No | Preset or natural-language budget, for example `Under Rs. 2,500` or `under LKR 6000`. |
| `category` | string | No | Product category or gift type. |
| `city` | string | No | Delivery city. The commerce API canonicalizes it with Kapruka MCP when needed. |
| `date` | string | No | Delivery date in `YYYY-MM-DD`. A past or invalid non-empty value becomes today. |
| `occasion` | string | No | Occasion such as `Birthday`. |
| `recipient` | string | No | Recipient such as `Female`, `Child`, or a natural-language relationship. |

The frontend's profile also has an `interests` field. The current commerce route does not parse or use that field.

### Extended preferences

| Field | Type | Required | Description |
|---|---|---:|---|
| `budget` | string | No | Detailed budget preference. |
| `giftType` | string | No | Detailed product/gift type. |
| `occasion` | string | No | Detailed occasion. |
| `recipient` | string | No | Detailed recipient. |

Each accepted value is whitespace-normalized and limited to 120 characters by the server. The frontend may also submit `lastRepliedCount` and `replyCount`; the API ignores them.

### Product

| Field | Type | Description |
|---|---|---|
| `id` | string | Kapruka product ID. |
| `name` | string | Product name. |
| `imageUrl` | string | Product image URL or `/product-images/gift-box.svg` fallback. |
| `category` | string | Category name, or `Kapruka` if absent upstream. |
| `price` | number | Numeric product price. |
| `currency` | string | Currency code, normally `LKR`. |
| `stock` | number | Normalized stock flag: `1` when upstream `in_stock` is true, otherwise `0`. |
| `stockLabel` | string | `In stock`, `In stock (<level>)`, or `Out of stock`. |
| `eta` | string | Currently always `Delivery checked by Kapruka MCP`. |
| `description` | string | Upstream summary or a fallback description. |
| `url` | string | Product URL or `https://www.kapruka.com` fallback. |
| `apiDetails` | array | Flattened raw upstream product fields as `{ "label": string, "value": string }`. Nesting is represented with dotted labels. |

### Commerce recommendation

| Field | Type | Description |
|---|---|---|
| `id` | string | ID of a product returned in the same response. Invented IDs are removed. |
| `fitScore` | integer | Normalized score from 0 to 100. Model scores from 0 to 10 are multiplied by 10. |
| `reason` | string | Explanation of fit. |

### Analytics

| Field | Type | Description |
|---|---|---|
| `buyBoxHealth` | string | Catalog/cart readiness summary. |
| `conversionSignal` | string | Inferred user stage or intent. |
| `nextBestAction` | string | Suggested UI or user action. |
| `risk` | string | Main catalog, stock, delivery, or checkout caveat. |

## `POST /api/ai/chatbot`

Generates one short multilingual shopping-assistant reply. This is a lightweight chat endpoint; it does not return products or call Kapruka MCP.

### Request

```json
{
  "messages": [
    { "role": "user", "content": "How do I choose a birthday gift?" }
  ],
  "selectedLanguage": "English"
}
```

| Field | Type | Required | Default | Details |
|---|---|---:|---|---|
| `messages` | Chat message[] | Yes | `[]` | The final 10 valid messages are used. At least one must have role `user`. Valid roles are `system`, `user`, and `assistant`; invalid items and empty content are discarded. |
| `selectedLanguage` | language enum | No | `English` | Authoritative response language. |
| `language` | language enum | No | `English` | Backward-compatible alias used only when `selectedLanguage` is absent. |

If both language fields are supplied, `selectedLanguage` wins.

### Success response — `200 OK`

```json
{
  "reply": "Start with the recipient's interests, your budget, and how personal you want the gift to feel.",
  "model": "openai/gpt-oss-120b"
}
```

| Field | Type | Description |
|---|---|---|
| `reply` | string | One short paragraph. The prompt prevents product names, IDs, prices, lists, and explicit product recommendations because the UI handles product cards separately. |
| `model` | string | Model that produced the reply. |

### Provider routing

- When `selectedLanguage` is `Tanglish` and a Hugging Face token is configured, the endpoint tries Hugging Face Inference Providers via Novita first.
- A successful Novita reply is returned immediately.
- Novita rate limits, timeouts, unavailable responses, malformed responses, and empty replies silently fall back to Groq.
- All other languages use Groq directly.
- Groq may automatically retry configured backup models on `429`, `502`, `503`, or `504`.

### Errors

| Status | Condition | Example error |
|---:|---|---|
| `400` | No valid user message remains after parsing. | `Send at least one user message.` |
| `500` | Groq is needed but no Groq key is configured. | `Missing GROQ_API_KEY...` |
| Upstream status | Groq returns a non-success response. | Groq error text; response also includes `model`. |
| `502` | Groq returns an empty usable reply. | `Groq returned an empty chat response.` |

### cURL example

```bash
curl -X POST http://localhost:3000/api/ai/chatbot \
  -H "Content-Type: application/json" \
  -d '{"selectedLanguage":"English","messages":[{"role":"user","content":"How do I choose a birthday gift?"}]}'
```

## `POST /api/ai/context-analysis`

Extracts shopping preferences from the latest user message. Local rules are combined with Groq analysis, and existing context fills only values omitted by the new message.

### Request

```json
{
  "message": "I need flowers for my wife's birthday under Rs. 5000",
  "selectedLanguage": "English",
  "context": {
    "budget": null,
    "category": null,
    "occasion": null,
    "recipient": null
  }
}
```

| Field | Type | Required | Default | Details |
|---|---|---:|---|---|
| `message` | string | Yes | — | Latest user message. Empty or non-string values fail validation. |
| `selectedLanguage` | language enum | No | `English` | Authoritative language; the model is told not to detect or override it. |
| `context` | object | No | `{}` | Existing `budget`, `category`, `occasion`, and `recipient`. Existing values fill details omitted by the latest message. |

### Normalized values

| Field | Accepted output values |
|---|---|
| `budget` | `Under Rs. 2,500`, `Rs. 2,500 - 5,000`, `Rs. 5,000 - 10,000`, `Above Rs. 10,000`, `Other`, or `null` |
| `category` | `Flowers`, `Cakes`, `Chocolate`, `Electronics`, `Perfumes`, `Fashion`, `Other`, or `null` |
| `occasion` | `Birthday`, `Anniversary`, `Wedding`, `Graduation`, `Other`, or `null` |
| `recipient` | `Male`, `Female`, `Child`, `Couple`, `Other`, or `null` |
| `detectedLanguage` | `English`, `Sinhala`, `Singlish`, or `Tanglish`; this mirrors `selectedLanguage` |

`requestedGiftType` preserves a short English name when the user explicitly requests a specific gift type outside the known categories. `missingFields` checks only `budget`, `recipient`, and `occasion`; category is not required.

### Success response — `200 OK`

```json
{
  "budget": "Rs. 2,500 - 5,000",
  "category": "Flowers",
  "detectedLanguage": "English",
  "occasion": "Birthday",
  "recipient": "Female",
  "requestedGiftType": null,
  "missingFields": []
}
```

| Field | Type | Description |
|---|---|---|
| `budget` | string or null | Normalized budget. |
| `category` | string or null | Normalized gift category. |
| `detectedLanguage` | language enum | Selected language, treated as authoritative. |
| `occasion` | string or null | Normalized occasion. |
| `recipient` | string or null | Normalized recipient. |
| `requestedGiftType` | string or null | Specific non-preset gift type when supplied. |
| `missingFields` | string[] | Missing members of `budget`, `recipient`, and `occasion`. |
| `warning` | string | Present only when no Groq key is configured and local-only analysis was used. |

### No-key fallback

Unlike most model endpoints, this route returns `200 OK` without a Groq key. It uses local English/Sinhala-aware heuristics and existing context, then adds:

```json
{
  "warning": "Missing GROQ_API_KEY. Add it to src/.env.local, then restart npm run dev."
}
```

The local analyzer recognizes common budget phrases and numeric LKR amounts, recipient relationships, common occasions, and known gift categories. Groq broadens extraction for natural language and non-English transliterations.

### Errors

| Status | Condition | Example error |
|---:|---|---|
| `400` | `message` is missing or empty. | `Send a user message to analyze.` |
| Upstream status | Groq analysis fails. | Parsed Groq error text. |
| `502` | Groq returns an empty analysis. | `Groq returned an empty context analysis.` |

### cURL example

```bash
curl -X POST http://localhost:3000/api/ai/context-analysis \
  -H "Content-Type: application/json" \
  -d '{"message":"I need flowers for my wife birthday under Rs. 5000","selectedLanguage":"English","context":{}}'
```

## `POST /api/ai/image-analysis`

Accepts one image, asks a Groq vision model for shopping-oriented labels and product search hints, and returns normalized JSON.

### Request

Content type: `multipart/form-data`

| Form field | Type | Required | Limits | Description |
|---|---|---:|---|---|
| `image` | file | Yes | Maximum 4 MiB (`4 * 1024 * 1024` bytes) | Image to analyze. The route does not explicitly whitelist MIME types. If the file has no MIME type, it is sent upstream as `image/jpeg`. |

Do not manually set the multipart boundary when using `FormData`.

### Success response — `200 OK`

```json
{
  "summary": "A bouquet of red roses wrapped for gifting.",
  "labels": [
    { "label": "red roses", "score": 0.98 },
    { "label": "bouquet", "score": 0.95 }
  ],
  "visibleText": [],
  "productHints": ["rose bouquet", "anniversary flowers"],
  "searchQuery": "red rose bouquet",
  "model": "qwen/qwen3.6-27b"
}
```

| Field | Type | Limits/description |
|---|---|---|
| `summary` | string | Concise visual summary. |
| `labels` | `{ label: string, score: number }[]` | Up to 5 valid labels. The parser requires both fields but does not clamp scores. |
| `visibleText` | string[] | Up to 8 text fragments read from the image. |
| `productHints` | string[] | Up to 5 product-search hints. |
| `searchQuery` | string | Short query suitable for commerce search. |
| `model` | string | Vision model used. |
| `fallback` | boolean | Present as `true` when filename-based fallback analysis was used. |

### Temporary-provider fallback — `200 OK`

If all vision attempts end in `429`, `502`, `503`, or `504`, the route returns a filename-derived result rather than an HTTP error:

```json
{
  "fallback": true,
  "labels": [{ "label": "roses", "score": 0.2 }],
  "productHints": ["roses", "gift", "flowers", "cake", "chocolate"],
  "searchQuery": "roses",
  "summary": "Vision is temporarily unavailable, so I searched for roses-related gift ideas.",
  "visibleText": [],
  "model": "qwen/qwen3.6-27b"
}
```

The fallback derives up to five useful terms from the uploaded filename and adds generic gift hints. Therefore, descriptive filenames improve fallback search quality.

### Provider behavior

- The primary model is `GROQ_VISION_MODEL` or `qwen/qwen3.6-27b`.
- Vision backups are `GROQ_VISION_BACKUP_MODEL` and then the built-in Qwen default, with duplicates removed.
- The first request asks Groq for strict JSON mode.
- If Groq returns `400` specifically because it failed to generate JSON, the route retries without strict JSON mode.
- Other `400` responses are returned to the caller.

### Errors

| Status | Condition | Example error |
|---:|---|---|
| `400` | `image` is absent or is not a file. | `Upload an image file.` |
| `413` | Image is larger than 4 MiB. | `Image is too large...` |
| `500` | Groq key is missing. This check occurs before form parsing. | `Missing GROQ_API_KEY...` |
| Upstream status | Non-temporary Groq failure. | Groq error text plus `model`. |
| `502` | Successful Groq response has no usable content. | `Groq returned an empty vision response.` |

### cURL example

```bash
curl -X POST http://localhost:3000/api/ai/image-analysis \
  -F "image=@/absolute/path/to/rose-bouquet.jpg"
```

## `POST /api/ai/voice-messages`

Transcribes English speech to text. This route does not synthesize speech; assistant read-aloud is performed by the browser's speech engine.

### Request

Content type: `multipart/form-data`

| Form field | Type | Required | Value/limits | Description |
|---|---|---:|---|---|
| `audio` | file | Yes | Maximum 12 MiB (`12 * 1024 * 1024` bytes) | Recorded or uploaded audio. |
| `language` | string | Yes | Must be exactly `en` | Only English voice search is supported. |

The audio file is forwarded to Groq using its original filename, or `kapruka-voice.webm` when no filename exists. Groq is asked for `verbose_json`.

### Success response — `200 OK`

```json
{
  "language": "en",
  "model": "whisper-large-v3-turbo",
  "transcript": "Find a birthday cake under five thousand rupees."
}
```

The model is fixed to `whisper-large-v3-turbo` and cannot be changed per request or with an environment variable.

### Unclear or non-English response — `422 Unprocessable Entity`

```json
{
  "error": "We couldn't clearly recognize that voice message. Please try again in English.",
  "model": "whisper-large-v3-turbo",
  "retry": true
}
```

The route rejects empty transcripts, punctuation-only output, common inaudible/noise markers, detected languages other than English, and transcripts without at least two adjacent Latin letters.

### Errors

| Status | Condition | Example error |
|---:|---|---|
| `400` | `audio` is missing or not a file. | `Record or upload an audio file.` |
| `400` | `language` is missing or is not exactly `en`. | `Voice search supports English only.` |
| `413` | Audio is larger than 12 MiB. | `Audio is too large...` |
| `415` | Request `Content-Type` does not contain `multipart/form-data`. | `This route only transcribes audio...` |
| `422` | Audio cannot be reliably recognized as English speech. | Retry response shown above. |
| `500` | Groq key is missing. | `Missing GROQ_API_KEY...` |
| Upstream status | Groq transcription fails. | Groq error text plus `model`. |

### cURL example

```bash
curl -X POST http://localhost:3000/api/ai/voice-messages \
  -F "audio=@/absolute/path/to/request.webm" \
  -F "language=en"
```

## `POST /api/ai/commerce`

The commerce endpoint is a task-based orchestration API. It searches the live Kapruka catalog, ranks results, produces mode-specific plans, checks delivery, compares products, tracks orders, creates guest checkout links, and generates gift-card messages.

### Supported task values

| `task` | Purpose | Requires Kapruka MCP | AI behavior |
|---|---|---:|---|
| `initial` | Load initial live products. | Yes | Does not require Groq. |
| `recommend` | General product search and shopping response. Default task. | Yes | Groq; Novita may supply non-English direct reply. |
| `eventPlan` | Event Planner search, response, and optional `eventPlan` checklist. | Yes | Same orchestration path as `recommend`, with event-mode prompt behavior. |
| `giftBox` | Gift Box Builder search, response, and optional `eventPlan` checklist data. | Yes | Same orchestration path as `recommend`, with gift-box-mode prompt behavior. |
| `compare` | Load and compare 2–3 exact Kapruka product IDs. | Yes | Groq comparison with deterministic local fallback. |
| `checkout` | Create a Kapruka guest checkout link. | Yes | No model call is required. |
| `track` | Look up a Kapruka order and optionally generate a next-step suggestion. | Yes | Groq suggestion is optional. |
| `giftMessage` | Generate a gift-card message. | No | Novita for non-English when configured, then Groq fallback. |

The API does not strictly validate `task`. An omitted task becomes `recommend`; an unknown string goes through the general recommendation orchestration and is passed to the model.

### General request schema

```json
{
  "task": "recommend",
  "mode": "Smart Shopping",
  "language": "English",
  "query": "birthday flowers",
  "userMessage": "Find birthday flowers for my wife under Rs. 5000",
  "preserveProfile": false,
  "cartIds": [],
  "productIds": [],
  "conversationHistory": [
    { "role": "user", "content": "I need a birthday gift" },
    { "role": "assistant", "content": "What kind of gift would you like?" }
  ],
  "profile": {
    "budget": "Rs. 2,500 - 5,000",
    "category": "Flowers",
    "city": "Colombo",
    "date": "2026-09-01",
    "occasion": "Birthday",
    "recipient": "Female"
  },
  "extendedPreferences": {
    "budget": "Rs. 2,500 - 5,000",
    "giftType": "Flowers",
    "occasion": "Birthday",
    "recipient": "Female"
  }
}
```

| Field | Type | Required | Default/limit | Description |
|---|---|---:|---|---|
| `task` | string | No | `recommend` | Operation to perform. See task table above. |
| `mode` | string | No | `Smart Shopping` | UI mode. Common values are `Smart Shopping`, `Event Planner`, `Gift Box Builder`, `Product Compare`, `Order Tracking`, and `Gift Message`. Not strictly validated. |
| `language` | language enum | No | `English` | Authoritative reply language. Invalid values become English. |
| `query` | string | No | `""` | Product query, tracking number, or task input. |
| `userMessage` | string | No | `query` | Exact conversational message. Used for intent/preference analysis and delivery detection. |
| `preserveProfile` | boolean | No | `false` | Only literal `true` preserves the submitted profile instead of refreshing it with detected current-message preferences. |
| `cartIds` | string[] | Task-specific | Up to 30 | Product IDs in the cart. Non-string/empty members are removed. Required for checkout. |
| `productIds` | string[] | Task-specific | Up to 3 | Exact product IDs for comparison. |
| `conversationHistory` | Chat message[] | No | Final 3 valid items | Only `user` and `assistant` roles are retained. |
| `profile` | Shopping profile | No | `{}` | Current budget, category, delivery, occasion, and recipient state. |
| `extendedPreferences` | Extended preferences | No | Profile values | General/Smart Shopping detailed preferences. |
| `eventUserPreference` | Extended preferences | No | Falls back to `extendedPreferences` | Used when `mode` contains `Event`. |
| `giftUserPreference` | Extended preferences | No | Falls back to `extendedPreferences` | Used when `mode` contains `Gift Box`. |
| `checkout` | Checkout details | Checkout only | `{}` | Recipient and delivery details. |
| `giftMessagePreferences` | Gift message preferences | Gift message only | `{}` | Language, size, tone, and free-text guidance. |

Mode preference selection is substring-based and case-sensitive: a mode containing `Event` uses `eventUserPreference`, while a mode containing `Gift Box` uses `giftUserPreference`.

### Common success response

General recommendation, event planning, and gift-box responses can contain:

```json
{
  "analytics": {
    "buyBoxHealth": "Ranked live products ready",
    "conversionSignal": "Active shopping request",
    "nextBestAction": "Review the recommended cards",
    "risk": "Price and stock can change"
  },
  "chips": ["Suggest more", "Find chocolates"],
  "detectedLanguage": "English",
  "delivery": null,
  "eventPlan": [],
  "giftMessage": "",
  "mcp": {
    "endpoint": "https://mcp.kapruka.com/mcp",
    "searchQuery": "flowers",
    "tools": ["kapruka_search_products"]
  },
  "mode": "Smart Shopping",
  "preferences": {
    "budget": "Rs. 2,500 - 5,000",
    "category": "Flowers",
    "occasion": "Birthday",
    "recipient": "Female"
  },
  "extendedPreferences": {
    "budget": "Rs. 2,500 - 5,000",
    "giftType": "Flowers",
    "occasion": "Birthday",
    "recipient": "Female"
  },
  "products": [],
  "recommendations": [],
  "reply": "I found options that fit your request.",
  "tracking": ""
}
```

| Field | Type | Presence | Description |
|---|---|---|---|
| `analytics` | Analytics | Always in normal task responses | Locally generated state summary. Exact strings vary by task/outcome. |
| `chips` | string[] | Always in normal task responses | Next-action UI chips. General results return at most two locally selected chips. Event/Gift Box results return `Next item` and `Suggest more`. |
| `detectedLanguage` | language enum | General orchestration | Selected language after normalization. |
| `delivery` | Delivery or null | Search/initial flows | Delivery result only when the current `userMessage` requests delivery and a city can be resolved. |
| `eventPlan` | string[] | Always via common/fallback shape | Up to 8 AI-generated planning lines. Often empty outside planning modes. |
| `giftMessage` | string | Always via common/fallback shape | Generated gift text for gift-message task; otherwise usually empty. |
| `mcp` | object | Search/initial flows | Search query and MCP tool names used. `endpoint` in the response is currently the hard-coded default URL, even if `KAPRUKA_MCP_URL` overrides the actual server call. |
| `mode` | string | Always in normal task responses | Active mode. |
| `preferences` | object | General orchestration | Effective `budget`, `category`, `occasion`, and `recipient`, with missing values represented as empty strings. |
| `extendedPreferences` | object | General modes | Returned for modes that do not contain `Event` or `Gift Box`. |
| `eventUserPreference` | object | Event modes | Returned instead of `extendedPreferences`. |
| `giftUserPreference` | object | Gift Box modes | Returned instead of `extendedPreferences`. |
| `products` | Product[] | Task-dependent | Up to 3 products in most successful responses. Some no-match responses can return fewer or none. |
| `recommendations` | Recommendation[] | Task-dependent | Up to 4 parsed recommendations, but response products are normally the first 3 ranked items. |
| `reply` | string | Always in normal task responses | Short conversational response. Product-specific names/IDs/prices are removed in general chat replies. |
| `tracking` | string | Always via common/fallback shape | Raw tracking markdown for tracking task; otherwise empty. |
| `checkout` | Checkout response | Checkout only | Kapruka checkout result. |

### Delivery object

| Field | Type | Description |
|---|---|---|
| `available` | boolean | Whether delivery is available. |
| `checked_date` | string | Date checked upstream. |
| `city` | string | Canonical delivery city. |
| `currency` | string | Rate currency. |
| `next_available_date` | string or null | Alternative delivery date. |
| `perishable_warning` | string or null | Warning for perishable items. |
| `rate` | number | Delivery charge/rate. |
| `reason` | string or null | Availability explanation. |
| `result` | string | Optional raw upstream result. |

Delivery is checked only if `userMessage` contains delivery/shipping/arrival language and `profile.city` is present. The first returned product ID is checked, falling back to the first cart ID. The API calls `kapruka_list_delivery_cities` before `kapruka_check_delivery`; failed delivery checks become `delivery: null` without failing the entire recommendation request.

### Product search and budget behavior

- Live searches call `kapruka_search_products` with `currency: "LKR"`, `in_stock_only: true`, `limit: 8`, `sort: "relevance"`, and JSON response format.
- Known categories expand into multiple search terms. Results are de-duplicated by ID and filtered for category relevance.
- Search results are cached in memory for 45 seconds, with at most 100 entries.
- Canonical city lookups are cached for 24 hours, with at most 100 entries.
- Recognized budget forms include ranges, `under`, `below`, `up to`, `above`, `over`, currency-prefixed amounts, `budget ...`, and plausible standalone amounts.
- Budgeted results must be in LKR and inside the normalized minimum/maximum.
- The current implementation does not return above-budget nearby substitutes when no exact budget match exists; it returns no products for that search.

### `initial` task

Loads initial live catalog cards without requiring Groq.

Request:

```json
{
  "task": "initial",
  "mode": "Smart Shopping",
  "query": "gift",
  "cartIds": [],
  "profile": {}
}
```

Behavior:

- Calls Kapruka product search.
- Returns up to 3 products.
- Produces local fallback recommendations with scores `92`, `88`, and `84`.
- Returns `chips: []`, `delivery: null`, and `reply: "Kapruka loaded products."`.
- Does not call Groq or Novita.

### `recommend` task

Main Smart Shopping operation.

Request:

```json
{
  "task": "recommend",
  "mode": "Smart Shopping",
  "language": "English",
  "query": "flowers",
  "userMessage": "Find flowers for my wife under Rs. 5000 and deliver to Colombo",
  "profile": {
    "budget": "Rs. 2,500 - 5,000",
    "category": "Flowers",
    "city": "Colombo",
    "date": "2026-09-01",
    "occasion": "Birthday",
    "recipient": "Female"
  },
  "extendedPreferences": {
    "budget": "Rs. 2,500 - 5,000",
    "giftType": "Flowers",
    "occasion": "Birthday",
    "recipient": "Female"
  },
  "conversationHistory": []
}
```

Behavior:

1. Optionally analyzes the current message with Groq, bounded by a 4-second local race timeout.
2. Merges local budget/occasion/recipient detection with model analysis and submitted preferences.
3. Searches and filters live Kapruka products.
4. Optionally resolves a city and checks delivery.
5. Uses Groq to rank products and formulate structured output.
6. For non-English replies, may use a fast Novita direct reply if it returns within the short selection window.
7. Returns locally generated analytics and chips.

If Groq's final commerce call fails or returns empty output, the endpoint normally returns `200 OK` with fallback recommendations and any safe direct reply rather than propagating the Groq status.

If no products are found and no Groq key exists, the endpoint returns `200 OK` with an explanatory no-match response. If products exist but Groq is unavailable because no key is configured, it returns `500`.

### `eventPlan` task

Uses the same request schema and orchestration as `recommend`, but is normally paired with `mode: "Event Planner"` and `eventUserPreference`.

```json
{
  "task": "eventPlan",
  "mode": "Event Planner",
  "language": "English",
  "query": "birthday party supplies",
  "userMessage": "Plan a birthday event for 20 people",
  "profile": {
    "budget": "Rs. 5,000 - 10,000",
    "category": "Birthday party supplies",
    "occasion": "Birthday",
    "recipient": "Other"
  },
  "eventUserPreference": {
    "budget": "Rs. 5,000 - 10,000",
    "giftType": "Birthday party supplies",
    "occasion": "Birthday",
    "recipient": "20 guests"
  }
}
```

The response uses `eventUserPreference`, returns chips `Next item` and `Suggest more`, and may contain up to 8 `eventPlan` checklist lines. The model is instructed to keep the checklist out of the conversational `reply`.

### `giftBox` task

Uses the same orchestration as `recommend`, normally with `mode: "Gift Box Builder"` and `giftUserPreference`.

```json
{
  "task": "giftBox",
  "mode": "Gift Box Builder",
  "language": "English",
  "query": "chocolate gift box",
  "userMessage": "Build a chocolate gift box for my sister",
  "profile": {
    "budget": "Rs. 5,000 - 10,000",
    "category": "Chocolate",
    "occasion": "Birthday",
    "recipient": "Female"
  },
  "giftUserPreference": {
    "budget": "Rs. 5,000 - 10,000",
    "giftType": "Chocolate",
    "occasion": "Birthday",
    "recipient": "Sister"
  }
}
```

The response uses `giftUserPreference`, returns chips `Next item` and `Suggest more`, and can use `eventPlan` as the structured guided-item list.

### `compare` task

Loads exact products with `kapruka_get_product` and compares them.

```json
{
  "task": "compare",
  "mode": "Product Compare",
  "language": "English",
  "productIds": ["PRODUCT_ID_1", "PRODUCT_ID_2"],
  "query": "PRODUCT_ID_1 PRODUCT_ID_2",
  "profile": {}
}
```

Rules and behavior:

- At most 3 IDs are accepted.
- The exact special comparison path requires at least 2 IDs.
- IDs are fetched concurrently with a 7-second local timeout per product.
- Requested and returned IDs are compared after removing whitespace and uppercasing.
- Duplicate or mismatched results are removed.
- If fewer than 2 products resolve, the route still returns `200 OK` with an explanatory reply, any matched products, and no recommendations.
- With 2 or more products, Groq has a 6-second local comparison timeout.
- If Groq is unavailable, times out, or returns unusable output, a deterministic English comparison of the first two products is returned.
- Successful comparison returns up to 3 products. Each recommendation has `fitScore: 80`, and the same final comparison paragraph is used as its reason.

Supplying fewer than 2 `productIds` does not return a validation error; it falls through to the general commerce flow with `task: "compare"`.

### `track` task

Looks up an order with `kapruka_track_order`.

```json
{
  "task": "track",
  "mode": "Order Tracking",
  "language": "English",
  "query": "ORDER_123456",
  "profile": {}
}
```

Order-number parsing accepts the first case-insensitive token that:

- begins and ends with an alphanumeric character;
- contains only alphanumeric characters, `_`, or `-`;
- has 6–50 total characters.

If no token matches, the endpoint returns `200 OK` without calling the tracking tool:

```json
{
  "tracking": "Enter the Kapruka order number from the confirmation email or order complete page.",
  "products": [],
  "chips": []
}
```

When an order number is found:

- `tracking` contains the raw markdown returned by Kapruka MCP.
- `reply` contains an optional Groq-generated next-step suggestion.
- A missing Groq key or model failure leaves `reply` empty but does not fail tracking.
- Kapruka MCP failures are returned through the commerce endpoint's `502` catch-all.

### `checkout` task

Creates a guest checkout link with `kapruka_create_order`.

Request:

```json
{
  "task": "checkout",
  "mode": "Smart Shopping",
  "language": "English",
  "cartIds": ["PRODUCT_ID_1", "PRODUCT_ID_2"],
  "profile": {
    "city": "Colombo",
    "date": "2026-09-01"
  },
  "checkout": {
    "recipientName": "Nimali Perera",
    "recipientPhone": "+94771234567",
    "address": "10 Example Road",
    "senderName": "Kamal",
    "locationType": "House",
    "giftMessage": "Happy birthday!"
  }
}
```

Checkout details:

| Field | Type | Required | Description |
|---|---|---:|---|
| `recipientName` | string | Yes | Recipient's name. |
| `recipientPhone` | string | Yes | Recipient phone. The API route itself does not validate phone format. |
| `address` | string | Yes | Delivery address. |
| `senderName` | string | Yes | Sender's name. |
| `locationType` | string | No | Defaults upstream to `house`. Lowercased, parenthetical text removed, spaces changed to `_`. Common UI values include `House`, `Apartment`, `Office`, `Hospital`, `School`, `Funeral Home`, `Wedding Reception`, and `Other(Including Hotels)`. |
| `giftMessage` | string | No | Optional gift message included in the order. |

The API also requires at least one `cartIds` item and `profile.city` plus `profile.date`. Missing fields return one combined `400` error.

Every cart ID is sent with quantity `1`; the API does not currently accept per-item quantities. Orders use `LKR`, and the sender is always non-anonymous.

Success response — `200 OK`:

```json
{
  "analytics": {
    "buyBoxHealth": "Checkout link created",
    "conversionSignal": "Ready for payment",
    "nextBestAction": "Open the Kapruka click-to-pay URL",
    "risk": "Checkout link expires after 60 minutes"
  },
  "checkout": {
    "checkout_url": "https://example.com/checkout/...",
    "expires_at": "2026-08-27T13:00:00Z",
    "order_ref": "...",
    "result": "...",
    "summary": {
      "addons_total": 0,
      "currency": "LKR",
      "delivery_fee": 500,
      "grand_total": 8500,
      "items_total": 8000
    }
  },
  "chips": [],
  "mode": "Smart Shopping",
  "products": [],
  "reply": "Kapruka created a guest-checkout link."
}
```

The normalized `checkout_url` is selected from upstream `checkout_url`, `checkoutUrl`, `click_to_pay_url`, or the first HTTP(S) URL found in `result`. The MCP client deliberately does not retry `kapruka_create_order` after an expired-session failure, avoiding accidental duplicate orders.

### `giftMessage` task

Generates one gift-card message and does not initialize Kapruka MCP.

```json
{
  "task": "giftMessage",
  "mode": "Gift Message",
  "language": "English",
  "query": "Write a warm birthday message",
  "profile": {
    "occasion": "Birthday",
    "recipient": "Sister"
  },
  "giftMessagePreferences": {
    "language": "English",
    "size": "Short",
    "tone": "Warm",
    "suggestions": "Mention how proud I am of her"
  }
}
```

| Preference | Type | Required | Typical UI values | Description |
|---|---|---:|---|---|
| `language` | string | No | `English`, `Sinhala`, `Singlish`, `Tanglish` | Gift-message output language. Any value other than case-insensitive `english` attempts Novita first when a token exists. |
| `size` | string | No | `Short`, `Medium`, `Long` | Requested message length. Not strictly validated. |
| `tone` | string | No | `Warm`, `Romantic`, `Funny`, `Formal` | Requested tone. Not strictly validated. |
| `suggestions` | string | No | Free text | Details to incorporate. |

Success response — `200 OK`:

```json
{
  "analytics": {
    "buyBoxHealth": "Kapruka ready",
    "conversionSignal": "Waiting for a catalog match",
    "nextBestAction": "Search the catalog",
    "risk": "Catalog results may change"
  },
  "chips": [],
  "eventPlan": [],
  "giftMessage": "Wishing you a wonderful birthday filled with joy and beautiful memories.",
  "mode": "Gift Message",
  "products": [],
  "recommendations": [],
  "reply": "Gift message generated.",
  "tracking": ""
}
```

Routing:

- Non-English messages try Hugging Face/Novita first when a Hugging Face token exists.
- English messages use Groq.
- Failed/empty Novita output falls back to language-specific Groq.
- If neither provider key is configured, the route still returns `200 OK` with a generic English gift message.
- If a Groq key exists but the selected generation chain returns no valid message, the route returns `502` instead of the generic fallback.

### Commerce errors

| Status | Condition | Shape/notes |
|---:|---|---|
| `400` | Checkout is missing cart, recipient, address, city, date, or sender data. | `{ "error": "Add ... before creating a Kapruka checkout link." }` |
| `500` | General product flow has products but needs Groq and no Groq key is configured. | Missing-key error. |
| `502` | Gift-message Groq chain returns no valid result. | Gift-message-specific error. |
| `502` | Any uncaught MCP, search, tracking, checkout, or orchestration error. | `{ "error": error.message }`; unknown errors use `Kapruka commerce request failed.` |

Several degraded states intentionally remain `200 OK`: initial local recommendations, comparison fallback, tracking without an AI suggestion, context/model fallback inside recommendation, no-match response without Groq, and gift-message fallback when no provider key exists.

### Commerce cURL examples

Recommend:

```bash
curl -X POST http://localhost:3000/api/ai/commerce \
  -H "Content-Type: application/json" \
  -d '{"task":"recommend","mode":"Smart Shopping","language":"English","query":"flowers","userMessage":"Find flowers under Rs. 5000","profile":{"budget":"Rs. 2,500 - 5,000","category":"Flowers"},"extendedPreferences":{"budget":"Rs. 2,500 - 5,000","giftType":"Flowers","occasion":"Birthday","recipient":"Female"}}'
```

Track:

```bash
curl -X POST http://localhost:3000/api/ai/commerce \
  -H "Content-Type: application/json" \
  -d '{"task":"track","mode":"Order Tracking","language":"English","query":"ORDER_123456"}'
```

Compare:

```bash
curl -X POST http://localhost:3000/api/ai/commerce \
  -H "Content-Type: application/json" \
  -d '{"task":"compare","mode":"Product Compare","language":"English","productIds":["PRODUCT_ID_1","PRODUCT_ID_2"],"query":"PRODUCT_ID_1 PRODUCT_ID_2"}'
```

## Environment variables

### Credentials

| Variable | Required | Used by | Notes |
|---|---:|---|---|
| `GROQ_API_KEY` | Usually | All Groq-backed routes | Preferred Groq credential name. |
| `GROQ_TOKEN` | No | All Groq-backed routes | Fallback alias for `GROQ_API_KEY`. |
| `HF_TOKEN` | No | Chat and gift-message Novita routing | Preferred Hugging Face credential name. |
| `HUGGINGFACE_TOKEN` | No | Chat and gift-message Novita routing | Fallback alias for `HF_TOKEN`. |

### Provider and timeout configuration

| Variable | Default | Effective bounds/behavior |
|---|---|---|
| `KAPRUKA_MCP_URL` | `https://mcp.kapruka.com/mcp` | Actual MCP endpoint. |
| `MCP_REQUEST_TIMEOUT_MS` | `4000` | Clamped to 2,000–15,000 ms. |
| `GROQ_REQUEST_TIMEOUT_MS` | `5000` | Per-attempt timeout, clamped to 3,000–30,000 ms. |
| `GROQ_TOTAL_TIMEOUT_MS` | `10000` | Total retry-chain timeout, clamped to 10,000–60,000 ms. |
| `HF_NOVITA_REPLY_TIMEOUT_MS` | `4500` | Clamped to 1,500–10,000 ms. |

### Text models

| Variable | Route/purpose | Code default |
|---|---|---|
| `HF_NOVITA_REPLY_MODEL` | Novita chat and gift messages | Helper default is `google/gemma-4-31B-it:novita`; `env.local.example` recommends `Qwen/Qwen2.5-72B-Instruct:novita`. |
| `GROQ_REPLY_MODEL` | Standalone chatbot | `openai/gpt-oss-120b` |
| `GROQ_PROCESSING_MODEL` | Context analysis, tracking, comparison | `llama-3.3-70b-versatile` through endpoint fallbacks |
| `GROQ_CONTEXT_MODEL` | Context analysis fallback selector | `llama-3.3-70b-versatile` |
| `GROQ_COMMERCE_MODEL` | Tracking/comparison fallback selector | `llama-3.3-70b-versatile` |
| `GROQ_ENGLISH_CHAT_MODEL` | English commerce reply | `openai/gpt-oss-120b` |
| `GROQ_SINHALA_CHAT_MODEL` | Sinhala commerce reply | `openai/gpt-oss-120b` |
| `GROQ_SINGLISH_CHAT_MODEL` | Singlish commerce reply | `llama-3.3-70b-versatile` |
| `GROQ_GIFT_MESSAGE_MODEL` | English gift message | `llama-3.3-70b-versatile` |
| `GROQ_SINHALA_GIFT_MESSAGE_MODEL` | Sinhala gift message | `openai/gpt-oss-120b` |
| `GROQ_SINGLISH_GIFT_MESSAGE_MODEL` | Singlish and Tanglish gift-message Groq fallback | `llama-3.3-70b-versatile` |
| `GROQ_BACKUP_MODEL` | First general text backup | Unset; example config uses `qwen/qwen3.6-27b` |
| `GROQ_BACKUP_MODELS` | Additional comma-separated text backups | Unset |

Built-in general text backups, de-duplicated and capped to four total model attempts, are:

```text
qwen/qwen3.6-27b
llama-3.1-8b-instant
openai/gpt-oss-120b
openai/gpt-oss-20b
```

### Vision models

| Variable | Default |
|---|---|
| `GROQ_VISION_MODEL` | `qwen/qwen3.6-27b` |
| `GROQ_VISION_BACKUP_MODEL` | `qwen/qwen3.6-27b` |

Voice transcription always uses `whisper-large-v3-turbo` and has no model environment override.

## External provider behavior

### Groq

- Chat completions URL: `https://api.groq.com/openai/v1/chat/completions`
- Transcriptions URL: `https://api.groq.com/openai/v1/audio/transcriptions`
- Requests use `Authorization: Bearer <server key>` and disable fetch caching.
- Chat requests retry only `429`, `502`, `503`, and `504` with backup models.
- A non-retryable error from the primary model is returned immediately.
- Network failures become synthetic `503` responses; attempt timeouts become synthetic `504` responses.
- If all retryable attempts fail, the helper returns a synthetic `503` with a generic temporary-unavailability message.

### Hugging Face Inference Providers via Novita

- URL: `https://router.huggingface.co/v1/chat/completions`
- Used as an optional reply path, not a required service.
- Any non-success response, malformed response, timeout, network failure, or empty reply becomes `null` and triggers the route's Groq or local fallback.

### Kapruka MCP

- Default URL: `https://mcp.kapruka.com/mcp`
- Protocol version: `2025-03-26`
- Transport accepts either JSON or SSE-style `text/event-stream` responses.
- Sessions are initialized with client name `kapruka-genie`, version `0.1.0`.
- A session is reused for up to 10 minutes.
- Expired/invalid sessions are automatically reinitialized and retried for tools other than `kapruka_create_order`.
- MCP tool arguments are wrapped as `arguments: { params: ... }`.

Tools used by the commerce endpoint:

| Tool | Used for |
|---|---|
| `kapruka_search_products` | Live catalog searches. |
| `kapruka_get_product` | Exact product loading for comparisons. |
| `kapruka_list_delivery_cities` | City canonicalization. |
| `kapruka_check_delivery` | Product/date/city delivery availability. |
| `kapruka_track_order` | Order tracking in markdown format. |
| `kapruka_create_order` | Guest checkout creation. |

## Security and operational notes

1. **Protect the routes before public deployment.** They currently accept unauthenticated requests that can consume paid provider quotas and, for checkout, initiate order-link creation.
2. **Add rate limiting and abuse controls.** No route-level throttling is implemented.
3. **Keep provider keys server-side.** Never expose `.env.local`, keys, tokens, or authorization headers to client code.
4. **Validate uploads by MIME type and content when security matters.** Current image/audio validation checks that the part is a `File` and enforces byte size, but does not perform file-signature validation.
5. **Treat AI text as untrusted output.** The code normalizes and filters several model fields, but consumers should still escape output according to its rendering context.
6. **Checkout validation is minimal in the API.** The UI validates phone data, but direct API clients can submit any non-empty phone string. Add server-side format validation for production.
7. **No idempotency key is accepted for checkout.** The MCP client avoids retrying order creation after session errors, but clients should still prevent duplicate submissions.
8. **In-memory caches are instance-local.** Product and city caches reset on restart and are not shared across serverless instances.
9. **Prices, stock, delivery, and checkout details are live and can change.** Always use the latest response rather than persisting availability assumptions.

## Source files

This reference was derived from:

- `src/app/api/ai/chatbot/route.ts`
- `src/app/api/ai/context-analysis/route.ts`
- `src/app/api/ai/image-analysis/route.ts`
- `src/app/api/ai/voice-messages/route.ts`
- `src/app/api/ai/commerce/route.ts`
- `src/lib/aiPayload.ts`
- `src/lib/groqHosted.ts`
- `src/lib/huggingFaceNovita.ts`
- `src/lib/kaprukaMcp.ts`
- `src/lib/productCatalog.ts`
- `src/lib/deliveryLocations.ts`
- `src/kapruka-genie/KaprukaGenieApp.tsx`
- `src/env.local.example`

