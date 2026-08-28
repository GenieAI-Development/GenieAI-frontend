# GenieAI API

Concise HTTP reference for the public API routes.

## Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/ai/chatbot` | Multilingual shopping chat |
| `POST` | `/api/ai/context-analysis` | Extract shopping preferences from text |
| `POST` | `/api/ai/image-analysis` | Analyze an image for product-search hints |
| `POST` | `/api/ai/voice-messages` | Transcribe English audio |
| `POST` | `/api/ai/commerce` | Search, compare, plan, track, and check out |

Use your deployed application origin as the base URL:

```text
{BASE_URL}/api/ai/...
```

## Conventions

- JSON endpoints require `Content-Type: application/json`.
- Upload endpoints require `multipart/form-data`. Let the HTTP client set the boundary.
- All responses are JSON.
- Supported languages: `English`, `Sinhala`, and `Singlish`.
- Commerce prices use `LKR`; dates use `YYYY-MM-DD`.
- Incoming requests are currently unauthenticated.

Most errors use:

```json
{ "error": "Human-readable message" }
```

## Chatbot

`POST /api/ai/chatbot`

Returns one short shopping-assistant reply.

### Request

```json
{
  "selectedLanguage": "English",
  "messages": [
    { "role": "user", "content": "How do I choose a birthday gift?" }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| `messages` | array | Yes | Final 10 valid messages. Roles: `system`, `user`, `assistant`. At least one user message is required. |
| `selectedLanguage` | string | No | Defaults to `English`. `language` is accepted as a legacy alias. |

### Response — `200`

```json
{
  "reply": "Start with the recipient's interests and your budget.",
  "model": "openai/gpt-oss-120b"
}
```

Errors: `400` for no valid user message, `500` for missing provider credentials, and upstream/`502` errors for generation failures.

## Context analysis

`POST /api/ai/context-analysis`

Extracts shopping preferences from the latest user message. Existing context fills details not mentioned in the new message.

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

| Field | Type | Required | Notes |
|---|---|---:|---|
| `message` | string | Yes | Latest user message. |
| `selectedLanguage` | string | No | Defaults to `English`. |
| `context` | object | No | Existing `budget`, `category`, `occasion`, and `recipient`. |

### Response — `200`

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

Normalized values:

- `budget`: `Under Rs. 2,500`, `Rs. 2,500 - 5,000`, `Rs. 5,000 - 10,000`, `Above Rs. 10,000`, `Other`, or `null`
- `category`: `Flowers`, `Cakes`, `Chocolate`, `Electronics`, `Perfumes`, `Fashion`, `Other`, or `null`
- `occasion`: `Birthday`, `Anniversary`, `Wedding`, `Graduation`, `Other`, or `null`
- `recipient`: `Male`, `Female`, `Child`, `Couple`, `Other`, or `null`

Without AI credentials, this endpoint still returns `200` using local analysis and includes a `warning` field. It returns `400` when `message` is empty.

## Image analysis

`POST /api/ai/image-analysis`

Analyzes an image and returns product-search hints.

### Request

Send `multipart/form-data` with one field:

| Field | Type | Required | Limit |
|---|---|---:|---:|
| `image` | file | Yes | 4 MiB |

### Response — `200`

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

If vision is temporarily unavailable, the endpoint may return `200` with `"fallback": true` and filename-based search hints.

Errors: `400` for a missing file, `413` above the size limit, `500` for missing credentials, and upstream/`502` errors for analysis failures.

## Voice transcription

`POST /api/ai/voice-messages`

Transcribes English speech. It does not generate audio.

### Request

Send `multipart/form-data`:

| Field | Type | Required | Value/limit |
|---|---|---:|---|
| `audio` | file | Yes | Maximum 12 MiB |
| `language` | string | Yes | Must be `en` |

### Response — `200`

```json
{
  "language": "en",
  "model": "whisper-large-v3-turbo",
  "transcript": "Find a birthday cake under five thousand rupees."
}
```

Unclear or non-English audio returns `422`:

```json
{
  "error": "We couldn't clearly recognize that voice message. Please try again in English.",
  "model": "whisper-large-v3-turbo",
  "retry": true
}
```

Other errors: `400` for invalid fields, `413` above the size limit, `415` for the wrong content type, and `500` for missing credentials.

## Commerce

`POST /api/ai/commerce`

A task-based endpoint for the live Kapruka catalog.

### Tasks

| Task | Purpose | Key input |
|---|---|---|
| `initial` | Load initial products | `query` |
| `recommend` | Search and recommend products | `query`, `userMessage`, preferences |
| `eventPlan` | Search and create an event checklist | `eventUserPreference` |
| `giftBox` | Search and build a gift-box list | `giftUserPreference` |
| `compare` | Compare 2–3 products | `productIds` |
| `track` | Track an order | Order number in `query` |
| `checkout` | Create a guest-checkout link | `cartIds`, `profile`, `checkout` |
| `giftMessage` | Generate a gift-card message | `giftMessagePreferences` |

`task` defaults to `recommend`.

### Common request

```json
{
  "task": "recommend",
  "mode": "Smart Shopping",
  "language": "English",
  "query": "birthday flowers",
  "userMessage": "Find flowers for my wife under Rs. 5000",
  "cartIds": [],
  "productIds": [],
  "conversationHistory": [],
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

| Field | Type | Notes |
|---|---|---|
| `task` | string | Defaults to `recommend`. |
| `mode` | string | Common values: `Smart Shopping`, `Event Planner`, `Gift Box Builder`, `Product Compare`, `Gift Message`. |
| `language` | string | Defaults to `English`. |
| `query` | string | Search text or task input. |
| `userMessage` | string | Exact conversational message; defaults to `query`. |
| `profile` | object | `budget`, `category`, `city`, `date`, `occasion`, `recipient`. |
| `extendedPreferences` | object | `budget`, `giftType`, `occasion`, `recipient`. |
| `eventUserPreference` | object | Preferences for Event Planner. |
| `giftUserPreference` | object | Preferences for Gift Box Builder. |
| `cartIds` | string[] | Up to 30 product IDs; required for checkout. |
| `productIds` | string[] | Up to 3 exact product IDs for comparison. |
| `conversationHistory` | array | Final 3 valid user/assistant messages. |
| `preserveProfile` | boolean | Keep submitted profile values when `true`. |

### Common response — `200`

```json
{
  "mode": "Smart Shopping",
  "reply": "I found options that fit your request.",
  "detectedLanguage": "English",
  "products": [],
  "recommendations": [],
  "chips": ["Suggest more"],
  "delivery": null,
  "eventPlan": [],
  "giftMessage": "",
  "analytics": {
    "buyBoxHealth": "Ranked live products ready",
    "conversionSignal": "Active shopping request",
    "nextBestAction": "Review the recommended cards",
    "risk": "Price and stock can change"
  }
}
```

Products include `id`, `name`, `imageUrl`, `category`, `price`, `currency`, `stock`, `stockLabel`, `description`, and `url`. Recommendations include `id`, `fitScore` (`0–100`), and `reason`.

### Compare

```json
{
  "task": "compare",
  "mode": "Product Compare",
  "language": "English",
  "productIds": ["PRODUCT_ID_1", "PRODUCT_ID_2"]
}
```

At least two valid product IDs are needed for the exact comparison flow. Unavailable products are omitted; comparison may use a local fallback.

### Checkout

```json
{
  "task": "checkout",
  "cartIds": ["PRODUCT_ID_1"],
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

Required: at least one `cartIds` item, `profile.city`, `profile.date`, `recipientName`, `recipientPhone`, `address`, and `senderName`. Each cart item has quantity `1`.

A successful response includes:

```json
{
  "reply": "Kapruka created a guest-checkout link.",
  "checkout": {
    "checkout_url": "https://example.com/checkout/...",
    "expires_at": "2026-08-27T13:00:00Z",
    "order_ref": "...",
    "summary": {
      "currency": "LKR",
      "items_total": 8000,
      "delivery_fee": 500,
      "grand_total": 8500
    }
  }
}
```

### Gift message

```json
{
  "task": "giftMessage",
  "mode": "Gift Message",
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

The generated text is returned in `giftMessage`.

### Commerce errors

| Status | Meaning |
|---:|---|
| `400` | Checkout data is incomplete. |
| `500` | A required AI credential is missing. |
| `502` | Catalog, checkout, or provider operation failed. |

Some degraded states intentionally return `200`, including local recommendations, comparison fallback, and gift-message fallback.

## Command-line examples

JSON request:

```bash
curl -X POST "{BASE_URL}/api/ai/chatbot" \
  -H "Content-Type: application/json" \
  -d '{"selectedLanguage":"English","messages":[{"role":"user","content":"Help me choose a gift"}]}'
```

File upload:

```bash
curl -X POST "{BASE_URL}/api/ai/image-analysis" \
  -F "image=@/path/to/image.jpg"
```

## Server configuration

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq chat, vision, and transcription access. `GROQ_TOKEN` is also accepted. |
| `HF_TOKEN` | Optional non-English generation through Hugging Face. `HUGGINGFACE_TOKEN` is also accepted. |
| `KAPRUKA_MCP_URL` | Optional Kapruka MCP endpoint override. |
| `GROQ_REPLY_MODEL` | Optional chatbot model override. |
| `GROQ_VISION_MODEL` | Optional image-analysis model override. |

Keep credentials on the server and never include them in client requests.

## Production notes

- Add authentication, authorization, and rate limiting before public deployment.
- Validate file signatures and MIME types for uploads.
- Validate checkout phone numbers and addresses on the server.
- Prevent duplicate checkout submissions; no idempotency key is currently supported.
- Treat AI output as untrusted text and escape it for its rendering context.
- Prices, stock, delivery availability, and checkout details can change; use the latest response.
