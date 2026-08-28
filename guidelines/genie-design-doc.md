# Genie Gifting — Design Documentation

A concierge-style gift shopping UI for Kapruka, redesigned around a
**Ceylon sapphire + gift-ribbon gold** identity — a deliberate move away
from the source product's purple/yellow palette, chosen because sapphire
and gold read as premium and locally rooted (Sri Lanka's gem trade)
without leaning on stock e-commerce clichés.

---

## 1. Color system

### Light mode (default)

| Token | Hex | Use |
|---|---|---|
| `--sapphire-950` | `#0A1F3A` | Header/nav surface, primary text-on-color, user message bubble |
| `--sapphire-800` | `#123661` | Price text |
| `--sapphire-700` | `#1E4D8C` | Primary interactive (links, active icons) |
| `--sapphire-500` | `#3D74B8` | Secondary accents, hover borders |
| `--sapphire-100` | `#E7EEF7` | Tinted backgrounds (hover, illustration fills) |
| `--gold-600` | `#B3872F` | CTA gradient end, ribbon/ label accents |
| `--gold-500` | `#C89B3C` | CTA gradient start, active nav state |
| `--gold-300` | `#E4C878` | Highlights, text selection |
| `--gold-100` | `#F6ECD3` | Illustration fills |
| `--cream-100` | `#FAF7F1` | Page background |
| `--cream-50` | `#FFFFFF` | Card/panel surface |
| `--ink-900` | `#16202B` | Primary text |
| `--ink-600` | `#3E4A56` | Secondary text |
| `--ink-500` | `#5B6B7A` | Muted text, placeholders |
| `--ink-300` | `#9AA7B2` | Disabled/faint text, icons |
| `--line` | `#E4E1D8` | Borders, dividers |
| `--success-600` / `--success-100` | `#2F8F5B` / `#E4F3EA` | In-stock state |
| `--warn-600` / `--warn-100` | `#B25A2E` / `#F7E9DF` | Low-stock state |

### Dark mode

Dark mode inverts the surface scale while keeping sapphire as the brand
anchor (it becomes the *background*, not just the accent) and warms the
gold slightly so it doesn't look neon on a dark field.

| Token | Hex | Use |
|---|---|---|
| `--sapphire-950` | `#050E1C` | Page background |
| `--sapphire-800` | `#0E2340` | Header / nav / card surface |
| `--sapphire-700` | `#16334F` | Raised surface (panels, composer) |
| `--sapphire-500` | `#5C8FCB` | Primary interactive, links |
| `--sapphire-100` | `#16334F` | Tinted fills (illustration backgrounds) |
| `--gold-600` | `#D8A83F` | CTA gradient start |
| `--gold-500` | `#E8C673` | CTA gradient end, active nav state |
| `--gold-300` | `#F2DFA0` | Highlights, selection |
| `--cream-100` | `#0B1A2E` | Page background (alias, matches sapphire-950) |
| `--cream-50` | `#0E2340` | Card/panel surface (alias, matches sapphire-800) |
| `--ink-900` | `#F3F1EA` | Primary text |
| `--ink-600` | `#C7CDD6` | Secondary text |
| `--ink-500` | `#8EA0B3` | Muted text, placeholders |
| `--ink-300` | `#5B6B7A` | Disabled/faint text |
| `--line` | `rgba(255,255,255,0.12)` | Borders, dividers |
| `--success-600` / `--success-100` | `#5FCB93` / `rgba(47,143,91,0.18)` | In-stock state |
| `--warn-600` / `--warn-100` | `#E08A5C` / `rgba(178,90,46,0.2)` | Low-stock state |

**Implementation note:** because the prototype already reads every color
through CSS custom properties, dark mode is a drop-in — add
`[data-theme="dark"]` (or `@media (prefers-color-scheme: dark)`) as a
second `:root` block redefining the same variable names above; no
component CSS needs to change. Card art gradients and shadow opacities
should be reduced slightly in dark mode (shadows read as too heavy on
dark surfaces) — halve the shadow alpha values as a starting point.

---

## 2. Typography

| Role | Typeface | Weights used | Where |
|---|---|---|---|
| Display | **Fraunces** (serif, optical-size axis) | 500–700 | Panel headings, section titles — used sparingly for warmth against the otherwise clean UI |
| Body / UI | **Inter** | 400–700 | All interface text, buttons, labels |
| Utility / data | **IBM Plex Mono** | 400–500 | Product IDs, prices in the cart summary — signals "this is a precise, transactional number" |

Type scale (desktop): 23px (page-level heading, now removed from this
build but reserved for future section headers) → 16–18px (panel/brand
headings) → 14–14.5px (body, card titles) → 12–13px (meta, labels) →
10.5–11px (eyebrows, IDs, badges).

---

## 3. Layout

```
Desktop (>1024px)
┌─────────────────────────────────────────────┐
│ Header: brand · status · language · cart     │
├───────┬───────────────────────────────────────┤
│ Nav   │ Chat thread (fixed viewport height,   │
│ rail  │ only this column scrolls)             │
│ (icon │  → assistant msg: left, gold thread   │
│  +    │    line, avatar node                  │
│ label)│  → user msg: right-aligned, sapphire  │
│       │    bubble, own avatar                 │
│ Prefs │  → product recommendations: 4-col     │
│ item  │    grid with ribbon-corner tags       │
│       ├───────────────────────────────────────┤
│       │ Composer (sticky, mic/photo/send)     │
└───────┴───────────────────────────────────────┘
Cart & Preferences = off-canvas panels (slide from
right), opened from the header cart icon and the nav
rail's Preferences item — available on desktop and
mobile identically.
```

```
Mobile (≤760px)
┌─────────────────────────────┐
│ Header (compact)             │
├───────────────────────────────┤
│ Chat thread (fills viewport, │
│ internal scroll only)        │
│  → product cards: horizontal │
│    swipeable row, snap-      │
│    scroll, ~1.3 cards visible│
├───────────────────────────────┤
│ Composer (sticky)             │
├───────────────────────────────┤
│ Bottom tab bar: Shopping ·    │
│ Events · Box Builder ·        │
│ Compare · Preferences         │
└───────────────────────────────┘
Cart/Preferences panels become full-width sheets.
```

**Signature element:** the *gifting thread* — a gold vertical line
connecting the assistant's avatar nodes down the conversation, evoking a
ribbon rather than a generic chat scrollback. Product cards carry a
diagonal **ribbon-corner tag** (an actual clipped-path ribbon shape, not
a pill badge) naming the occasion they were matched to.

---

## 4. Components at a glance

- **Buttons:** gold gradient = primary commerce action (Add to cart,
  Apply); outlined cream = secondary (View, Close); solid sapphire =
  navigational/system (Send).
- **Cards:** cream surface, 18px radius, soft shadow, lift 4px on
  hover; ribbon tag top-left, stock chip top-right (green = in stock,
  warm terracotta = low stock — never red, to stay off-brand-alarming).
- **Off-canvas panels (Cart, Preferences):** identical shell (header +
  close + scrollable body), 380px max width, slide-in with a scrim;
  triggered from the header (cart, both breakpoints) and the nav rail /
  bottom bar (preferences, both breakpoints) — no duplicate entry
  points.
- **Chat bubbles:** assistant = cream with border, left-aligned, sits
  on the gold thread line; user = solid sapphire, right-aligned, own
  avatar, no thread line (keeps the ribbon motif reserved for Genie's
  side of the conversation).

---

## 5. Accessibility & responsiveness checklist

- All interactive elements have visible `:focus-visible` rings
  (sapphire, 2px offset).
- `prefers-reduced-motion` disables pulse/hover/entry animations.
- Form inputs are set to `font-size:16px` to prevent iOS Safari's
  auto-zoom-on-focus — this is what keeps the mobile experience
  pinch-zoom-free.
- No fixed pixel widths outside components meant to be fixed (panels,
  rail); everything else uses fluid grid/flex so nothing requires
  horizontal scrolling except the intentionally swipeable product row
  on mobile.
- Color pairs (text/background) hold at least 4.5:1 contrast in both
  light and dark palettes above.

---

## 6. Files

- `genie-redesign-v3.html` — current interactive prototype (open
  directly in a browser; resize or use device toolbar to see the
  breakpoint at 760px).
