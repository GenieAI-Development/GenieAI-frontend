# Alibaba Qoder Credits in GenieAI

This document records how Alibaba Qoder credits supported the development of GenieAI. It describes the work completed with Qoder; it does not represent a metered credit statement.

## Summary

Qoder was used both as an integrated cloud agent in the product and as an automation assistant during development. Its work supported product analysis, RAG preparation, image-intent generation, Hugging Face reranker preparation, technical planning, and documentation.

## Related project areas

| Area | Qoder contribution |
| --- | --- |
| Cart analysis | Integrated Qoder Cloud Agent for product/bundle analysis. |
| RAG | Automation support for catalogue and retrieval-data preparation. |
| Database population | Automation support for populating and validating catalogue/database records. |
| Image search | Automation support for image-intent generation. |
| HF reranking | Data preparation and fine-tuning/integration pipeline planning. |
| Architecture | Plans, architecture diagrams, and entity diagrams. |
| Documentation | Drafting and refining technical project documentation. |
| Models | Primary model for image analysis and shared model for text generation |

## In-product cloud agent

### Cart analysis and product matching

The integrated Qoder Cloud Agent powers the cart-analysis workflow. It receives the selected cart products and produces a bundle-level assessment, match insights, and practical improvement suggestions.

The frontend communicates with Qoder through the server-side Cloud Agent integration in `src/lib/qoderCloudAgent.ts`. Credentials and agent configuration stay in server environment variables; they are never exposed to the browser.

## Development automations

### RAG catalogue preparation

Qoder automations helped prepare data for the recommendation RAG workflow. This included structuring catalogue content, checking product information, and supporting the preparation of retrieval-ready records used by the Python recommendation service.

### Database population

Qoder automations also supported the population and validation of catalogue data used by the recommendation system. This work helped prepare product records for the database/cache layer so retrieval, availability checks, pricing, images, and product descriptions could be used consistently across the application.

### Image-intent generation

Qoder automations were used to generate and refine image-search intents. These intents help translate visual product cues into useful retrieval terms and product hints for GenieAI's image-search experience.

### Hugging Face reranker preparation

Qoder automations supported the fine-tuned Hugging Face CrossEncoder work:

- Preparing and organizing training data.
- Defining the fine-tuning pipeline.
- Producing supporting implementation plans and integration guidance.
- Preparing the hosted reranker workflow used by Extended search mode.

The resulting model is used only for optional Extended search ranking; Standard search skips the Hugging Face reranking call.

## Planning and design support

Qoder was also used to create and refine development plans, including:

- Application and service architecture diagrams.
- Data/entity relationship diagrams.
- RAG, ranking, personalization, and integration plans.
- Implementation breakdowns for frontend and backend work.

These artifacts helped define the boundaries between the Next.js application, Python recommendation backend, catalog data stores, and Hugging Face ranking service.

## Documentation support

Qoder contributed to project documentation by helping draft, organize, and refine technical guides, API/integration notes, implementation plans, and architecture explanations. All documentation remains subject to project review and should be kept aligned with the deployed implementation.

## Qwen models used by GenieAI

The project also uses Qwen models through Groq. These are project runtime models, separate from Qoder credit usage:

| Model | GenieAI use |
| --- | --- |
| `qwen/qwen3.6-27b` | Shared Groq fallback for text generation; primary model for image analysis and delivery prediction. |
| `qwen/qwen3.8-27b` |  Gift Card analysis. |