# AI models and fallbacks

This documents the current code defaults. `src/.env.local` has no model
overrides, so these are also the active models in this workspace.

## Shared Groq fallback behavior

Most text calls use this candidate order:

1. Route primary model
2. `GROQ_BACKUP_MODEL`, if configured
3. `GROQ_BACKUP_MODELS`, if configured
4. `qwen/qwen3.6-27b`
5. `openai/gpt-oss-120b`
6. `openai/gpt-oss-20b`

Duplicates are removed and only the first four distinct models are attempted.
Fallbacks run for timeouts, network errors, or HTTP 429/502/503/504.

## Next.js routes

| Usage | Primary | Fallbacks |
|---|---|---|
| Commerce/context analysis | `openai/gpt-oss-120b` | Shared chain |
| English commerce replies | `openai/gpt-oss-120b` | `qwen/qwen3.6-27b` → `openai/gpt-oss-20b` |
| Sinhala commerce replies | `openai/gpt-oss-120b` | Same as English; eligible requests prefer a valid Novita reply |
| Singlish commerce replies | `openai/gpt-oss-120b` | `qwen/qwen3.6-27b` → `openai/gpt-oss-20b`; eligible requests prefer Novita |
| Product comparison | `openai/gpt-oss-20b` | `openai/gpt-oss-120b` only |
| English gift message | `openai/gpt-oss-20b` | `openai/gpt-oss-120b` only |
| Sinhala gift message | Novita, then `openai/gpt-oss-120b` | Shared Groq chain after Novita |
| Singlish gift message | Novita, then `openai/gpt-oss-120b` | Shared Groq chain after Novita |
| Standalone chatbot | `openai/gpt-oss-120b` | Shared chain |
| Image analysis | `qwen/qwen3.6-27b` | No distinct default backup; JSON-mode failures retry without JSON mode |
| Gift Card analysis | `qwen/qwen3.6-27b` | `qwen/qwen3.8-27b`; may retry without JSON mode and then text-only |
| Voice transcription | `whisper-large-v3-turbo` | None |

## Novita

- Code default: `google/gemma-4-31B-it:novita`
- Used for eligible Sinhala/Singlish direct replies and non-English gift messages.
- Failures fall through to the Groq reply.
- `Qwen/Qwen2.5-72B-Instruct:novita` in `env.local.example` is an optional
  override, not the code default.

## Reranker

- Training base: `cross-encoder/ms-marco-MiniLM-L6-v2`
- Local evaluation artifact: `models/genieai-product-reranker/final`
- Published example: `ramitha2002/genieai-product-reranker`
- Service failure preserves the original retrieval order.

## No-model paths

Supabase initial products, Kapruka MCP operations, local product paging,
analytics, reply chips, browser read-aloud, and SVG rendering do not use an AI
model.
