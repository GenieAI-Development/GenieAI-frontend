# GenieAI 3-Minute Demo Video Script

## Video goal

Create a polished three-minute product demo showing how GenieAI turns a natural shopping request into relevant products, supports deeper AI ranking, helps build gifts, and completes the decision journey.

**Format:** 16:9, 1920×1080, 30 fps  
**Target duration:** 3:00  
**Style:** clean product demo, warm and trustworthy, light UI, minimal motion  
**Primary audience:** judges, partners, retailers, and potential users

## Visual identity

Use the existing GenieAI palette throughout titles, captions, transition clips, and callouts:

| Role | Color |
| --- | --- |
| Deep navy | `#0A1F3A` |
| Brand navy | `#0B2748` |
| Royal blue | `#1E4D8C` |
| Soft blue | `#E7EEF7` |
| Gold | `#D6A936` |
| Dark gold | `#B3872F` |
| Warm ivory | `#FAF7F1` |
| White | `#FFFFFF` |
| Body text | `#5B6B7A` |

Use deep navy for title cards, gold for important highlights, warm ivory for backgrounds, and soft blue for supporting graphics. Avoid neon colors, heavy gradients, or unrelated brand colors.

## Recording preparation

Before recording:

- Use a clean browser profile at 100% zoom and 1920×1080 resolution.
- Hide bookmarks, notifications, personal tabs, API keys, and developer tools.
- Prepare realistic products with valid images, prices, descriptions, and stock.
- Clear the GenieAI chat and cart, then set the language to English.
- Keep Standard search selected initially; switch to Extended during the demo.
- Prepare one image of a gift/product for visual search.
- Prepare two products for comparison and two complementary products for cart analysis.
- Add one product to the cart before opening Gift Card creation.
- Record each feature as a separate clean clip with two seconds of extra footage at both ends.
- Move the cursor slowly and click once. Do not type while narration is speaking unless the typing is part of the shot.
- Record real UI interactions. Use generated video only for intros, transitions, and the closing scene.

## Three-minute timeline

### 0:00–0:12 — Opening

**Record/generate:** Begin with an AI-generated branded transition. Resolve into the real GenieAI home screen. Show the logo and the main modes briefly.

**On-screen text:** `GenieAI — Find the right gift, faster.`

**Voice-over:**

> Gift shopping should feel thoughtful, not overwhelming. GenieAI is a multilingual AI shopping assistant that helps people discover, compare, personalize, and prepare the right gift in one conversational experience.

### 0:12–0:35 — Smart Shopping

**Record:** Click the message field, show suggested prompts, then enter: `Find birthday flowers for my mother under Rs. 5,000.` Send the request. Show the response and product cards with actual descriptions.

**Highlight:** Preferences, natural-language request, budget, recipient, occasion, product cards.

**Voice-over:**

> A shopper can describe the recipient, occasion, category, and budget naturally. GenieAI sends the request to its recommendation backend, which combines semantic and keyword retrieval, then filters products using catalogue price, availability, image, and description data.

### 0:35–0:52 — Standard and Extended search

**Record:** Open the mode switcher beside Send. Show Standard and Extended with their helper text. Select Extended and run a second short product query.

**On-screen labels:** `Standard: faster` and `Extended: deeper relevance ranking`

**Voice-over:**

> Standard mode keeps the backend’s fast catalogue ranking. Extended mode adds a fine-tuned Hugging Face CrossEncoder to score how closely every candidate matches the request. It usually adds only two to three seconds and falls back safely if the model is unavailable.

### 0:52–1:10 — Image and voice search

**Record:** Open the plus menu, briefly show image and voice options, upload the prepared image, and show visually similar products. Then show a short cut of voice input filling a search.

**Voice-over:**

> Shoppers can also search using an image or their voice. CLIP embeddings and Supabase vector search find visually similar catalogue products, while AI vision explains the image and suggests useful product intent.

### 1:10–1:30 — Gift Box Builder

**Record:** Open Gift Box Builder. Fill recipient, occasion, type, and budget preferences. Confirm the plan and select one suggested box item to load products.

**Voice-over:**

> Gift Box Builder turns a theme and total budget into a practical item plan. Each item can be searched independently, while the same Standard or Extended ranking preference remains available from the side preferences menu.

### 1:30–1:48 — Compare and cart analysis

**Record:** Select two product cards, open Product Compare, and show the comparison insights. Add complementary products to the cart and open cart analysis.

**Voice-over:**

> Product Compare summarizes meaningful differences without inventing missing facts. In the cart, an integrated Qoder Cloud Agent evaluates the full bundle, scores its overall fit, and suggests improvements before checkout.

### 1:48–2:10 — Gift message and Gift Card

**Record:** Open Gift Message and generate a short message. Switch to Gift Card, choose the cart product, click `Use voice`, say a short preference sentence, stop recording, review the filled fields, and generate the card.

**Suggested spoken input:** `Create an elegant floral birthday card for my mother, from Nimal, with a warm message.`

**Voice-over:**

> GenieAI can write a personalized gift message and create a product-matched Gift Card. Card details can be filled by voice, reviewed manually, and combined with the product’s colors and visual context before generation.

### 2:10–2:28 — Delivery and checkout

**Record:** Open Delivery Prediction and show a completed estimate. Open the cart, begin checkout, and show the voice-assisted delivery form. Stop before any real payment action.

**Voice-over:**

> Delivery Prediction estimates preparation and travel conditions. Checkout preparation collects recipient and delivery information, with optional voice-assisted form filling, while keeping the final confirmation under the shopper’s control.

### 2:28–2:43 — Profile and personalization

**Record:** Open Profile on a mobile-width viewport, then show Favorites, Wishlist, and Previous Orders. Briefly show the responsive header and saved-item counts.

**Voice-over:**

> Favorites, Wishlist activity, product views, cart actions, and purchases improve recommendations through anonymous session personalization. Saved products and completed orders remain available in the shopper’s local profile.

### 2:43–3:00 — Architecture and closing

**Record/generate:** Use a short branded transition from the UI into a simple architecture graphic: `Next.js → Python RAG → optional HF reranking → personalized results`. End on the GenieAI logo and live app URL.

**On-screen text:** `Conversational discovery. Relevant products. Thoughtful gifting.`

**Voice-over:**

> GenieAI combines a responsive Next.js experience, a Python retrieval service, Qdrant, BM25, Supabase, Groq, Qwen, Hugging Face, CLIP, and Qoder Cloud Agents. The result is a resilient, explainable shopping journey built to make every gift easier to discover and more meaningful to give.

## Complete voice-over script

Use the scene narration above in sequence. Target **130–140 words per minute**, with short pauses after each feature name. The full narration should remain close to 360–400 words so visuals have room to breathe.

### AI voice generation prompt

Use this prompt in an AI voice tool or as the custom-voice performance description in Google Flow:

```text
Generate a polished product-demo narration in clear international English. Use a warm, confident, approachable voice, approximately 30–40 years old, with a neutral accent and natural technology-presenter delivery. Speak at 135 words per minute. Keep the tone helpful and optimistic, not theatrical or sales-heavy. Add brief pauses after feature names and between scenes. Pronounce “GenieAI” as “Genie A-I,” “Qoder” as “Coder,” “Qdrant” as “Q-drant,” “Groq” as “Grock,” and “Hugging Face” normally. Do not add music, sound effects, extra words, or improvised claims. Export clean mono or stereo WAV at 48 kHz.
```

Generate narration scene-by-scene rather than as one long file. This makes timing corrections and re-recording easier. Normalize speech around `-16 LUFS` and keep peaks below `-1 dB`.

## Google Flow setup

Google Flow supports short clips created from text, ingredients, start/end frames, and existing video. Use generated clips as transitions around real screen recordings. Use Scenebuilder to arrange and trim the generated clips, or export them into the main editor with the screen recordings.

Recommended setup:

- Orientation: landscape, 16:9.
- Clip length: 4–8 seconds per transition.
- Generate two variations and keep the cleaner one.
- Upload the GenieAI logo and a clean UI screenshot as visual ingredients.
- For UI-to-transition shots, use the final frame of the screen recording as the start frame.
- For transition-to-UI shots, use the first frame of the next screen recording as the end frame.
- Do not ask Flow to reproduce readable product interfaces or exact UI text.

## Google Flow master style prompt

```text
Create a premium, minimal technology-product film for “GenieAI,” an AI gift-shopping assistant. Use a light, elegant visual system with warm ivory #FAF7F1 and white #FFFFFF backgrounds, deep navy #0A1F3A and #0B2748 typography and shapes, royal blue #1E4D8C accents, soft blue #E7EEF7 surfaces, and restrained gold #D6A936 and #B3872F highlights. Visual motifs: conversational message cards, elegant product-card silhouettes, soft search waves, connected data nodes, subtle gift ribbons, and precise ranking lines. Smooth 2.5D motion, gentle depth, clean studio lighting, soft shadows, slow camera movement, premium SaaS launch-film quality. Preserve generous negative space for titles. No people, no fake dashboards, no distorted text, no neon colors, no dark cyberpunk look, no excessive particles, no logos other than the supplied GenieAI logo, and no invented product claims. Landscape 16:9, cinematic but restrained, consistent across every clip.
```

## Google Flow transition prompts

### Opening transition

```text
Using the supplied GenieAI logo as the visual reference, begin on a warm ivory background. Thin royal-blue conversational lines sweep inward and form a soft-blue message card. A restrained gold ribbon arcs around the card and resolves into the GenieAI logo. Slow centered push-in, soft studio shadows, premium minimal SaaS motion design. End with clean negative space below the logo for the title “Find the right gift, faster.” Use the GenieAI palette exactly. No extra text or icons.
```

### Search-to-ranking transition

```text
Start from the supplied GenieAI search-results screenshot. Pull back gently as product-card silhouettes separate into a clean horizontal row. Fine royal-blue lines scan each card; small gold relevance markers reorder them smoothly from candidate results into a ranked list. Warm ivory background, deep navy structure, soft-blue panels, restrained gold accents. End on an abstract ranked stack that can cut back to the Extended search recording. Do not alter or regenerate readable UI text.
```

### Image-search transition

```text
A clean product photograph on a white card dissolves into a precise grid of soft-blue visual vectors. The vectors travel through a minimal navy search field and reconnect into four visually similar product-card silhouettes with small gold match indicators. Elegant technical motion, slow lateral camera move, warm ivory background, no readable generated text.
```

### Gift Box transition

```text
On a warm ivory studio background, several minimal gift-item cards glide together into a refined open gift box. A thin gold ribbon connects the cards while subtle navy and royal-blue data lines indicate budget allocation and item matching. Soft shadows, restrained movement, premium retail technology aesthetic, no people and no generated labels.
```

### Architecture closing transition

```text
Create a simple left-to-right technology flow using abstract labeled zones represented by clean shapes: browser conversation, Next.js orchestration, Python retrieval, vector and keyword search, optional relevance ranking, and personalized product results. Use navy connecting lines, soft-blue service cards, and one gold highlight moving through the pipeline. Keep the design minimal and leave space for editor-added labels. Finish by collapsing the flow into the supplied GenieAI logo on warm ivory, with a subtle gold glow and no generated text.
```

## Editing and transition plan

- Use hard cuts for actions inside the same feature.
- Use 6–10 frame cross-dissolves between closely related UI screens.
- Use the generated Flow clips only at 0:00, 0:35, 0:52, 1:10, and 2:43 if pacing allows.
- Keep generated transitions between 2 and 4 seconds in the final cut, even if the source clips are longer.
- Add a subtle click sound at key selections and a soft whoosh under generated transitions.
- Keep background music instrumental and low: approximately `-28 to -24 LUFS` under narration.
- Duck music by another 3–5 dB during dense narration.
- Add captions for the complete narration. Use a maximum of two lines and highlight only feature names in gold.
- Use editor-created text overlays; do not rely on AI-generated text inside video clips.

## On-screen callouts

Use only short, verifiable labels:

- `Natural-language shopping`
- `Standard: faster catalogue ranking`
- `Extended: HF relevance ranking`
- `Image + voice search`
- `Gift Box planning`
- `AI product comparison`
- `Qoder cart analysis`
- `Voice-filled Gift Card details`
- `Anonymous personalization`
- `Safe ranking fallback`

## Final quality checklist

- Final runtime is between 2:55 and 3:05.
- All product names, prices, descriptions, and availability come from real recordings.
- No API keys, personal information, test phone numbers, or private URLs are visible.
- Narration matches the action currently on screen.
- Captions are proofread and remain inside safe margins.
- UI text is readable on both desktop and mobile playback.
- The Standard/Extended distinction is accurate.
- Generated transitions use the exact GenieAI palette.
- Audio is clear on headphones and phone speakers.
- Export an H.264 MP4 at 1080p with a high-quality bitrate, plus a captioned backup copy.

## Source note

Google Flow currently supports video creation from text prompts, visual ingredients, frames, and existing videos, plus scene arrangement and trimming in Scenebuilder. Feature and model availability can vary by plan and region, so confirm the active model, supported generation mode, clip length, and credit cost before generation.

