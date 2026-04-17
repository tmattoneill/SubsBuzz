# SubsBuzz — Brand Guide

Working reference for the SubsBuzz identity. Lives next to the brand assets. Pick this up when touching anything user-facing: the app, marketing copy, emails, social, pitch decks, favicons.

---

## What SubsBuzz is

An AI-powered daily digest of a reader's email newsletters. It takes the noise of dozens of subscription emails and turns them into a single, well-structured intelligence brief each morning. The product is personal, quiet, and disciplined. The brand reflects that.

Domain: subsbuzz.com (production), dev.subsbuzz.com (staging).

---

## The mark

Two lockups live in this directory.

- `logo.png` — tight lockup, bee dominant. Use this when the bee needs to carry the brand on its own (app icon, favicon derivative, social avatar, splash screens).
- `logo-long.png` — horizontal lockup, generous left margin, bee and wordmark balanced. Use this in the app header, footers, email signatures, landing-page hero.

The mark is a stylised bee in motion, rendered in near-black line with gold stripes. It is bold, not cute. It has character — a slight scowl, muscular posture. The wordmark reads `Subs` (black) + `Buzz` (gold).

### Clear space

Keep a margin equal to the height of the "S" in Subs around the full lockup on every side. Do not crowd it with other marks, borders, or text.

### Don't

- Do not recolour the bee. The stripes are gold, the body is near-black. Not terracotta, not brand-accent, not mono.
- Do not separate the bee from the wordmark and then put the wordmark in a different font.
- Do not place the mark on a busy photograph without a solid backing plate.
- Do not add a drop shadow, glow, or bevel.
- Do not stretch the lockup; scale uniformly.

---

## Colour

SubsBuzz runs two palettes side by side, on purpose.

### Brand palette (the logo)

Only the logo uses these. Do not use them as UI fill colours.

| Role          | Value            | Notes                                   |
| ------------- | ---------------- | --------------------------------------- |
| Bee gold      | ~`#F5C518`       | Honey-gold. Bee stripes and "Buzz".     |
| Bee black     | ~`#1A1614`       | Bee outlines and "Subs". Near-black.    |

### UI palette (the app)

The app chrome uses a quieter editorial palette. Cream ground, warm neutrals, terracotta for moments that need weight (CTAs, active filters, "today" markers). Defined in `services/frontend/src/index.css` under the `.story-theme` scope (added 2026-04-17 on branch `ui/story-format`).

| Role                 | Value            | Use                                          |
| -------------------- | ---------------- | -------------------------------------------- |
| Background           | `#faf8f5`        | Page ground. Cream, not white.               |
| Foreground           | `#1a1614`        | Body text and headlines. Same as bee black.  |
| Card                 | `#ffffff`        | Card surfaces, modal backgrounds.            |
| Secondary / muted    | `#e8dfd5`        | Tag pills, secondary chips, dividers.        |
| Muted foreground     | `#6b6460`        | Metadata, timestamps, de-emphasised text.    |
| Accent (terracotta)  | `#d97757`        | Primary CTA, active filter pill, highlights. |
| Input background     | `#f3f0ec`        | Search fields, form inputs.                  |
| Border               | ~12% foreground  | Subtle card and section dividers.            |

### The gold-versus-terracotta tension

The bee is gold. The UI accent is terracotta. These are deliberately different colours doing different jobs.

- **Gold** is the brand mark. It only appears inside the logo. It signals identity.
- **Terracotta** is the UI accent. It signals action — "click this", "this is today's brief", "this filter is on".

Do not introduce gold into UI chrome. Do not introduce terracotta into the logo. If you are ever about to blend them — stop and pick one based on the job at hand.

### Dark mode

Background inverts to near-black, text to off-white, card surfaces stay dark, secondary neutrals desaturate. Terracotta accent is preserved (same `#d97757`) — it reads well on both grounds. Bee gold is preserved in the logo. See `.dark .palette-*` blocks in `services/frontend/src/index.css` for the full set.

### Swapping the palette

The UI palette is deliberately easy to swap. In `services/frontend/src/index.css` there are currently three named palettes, all composable with `.story-theme`:

| Class                  | Accent        | Use                                        |
| ---------------------- | ------------- | ------------------------------------------ |
| `palette-terracotta`   | `#d97757`     | Default. Editorial, warm, Figma-derived.   |
| `palette-gold`         | `~#f5c518`    | Tests the brand-tension question.          |
| `palette-forest`       | `~#316645`    | Quieter, more journalistic comparator.     |

To switch, change the class on the digest view's root wrapper:

```tsx
<div className="story-theme palette-terracotta"> ... </div>
<div className="story-theme palette-gold"> ... </div>
<div className="story-theme palette-forest"> ... </div>
```

To tweak a palette in place: edit the HSL values inside the block. Hex values are in comments for reference. `hslpicker.com` converts hex → HSL.

To add a new palette: copy a `.palette-*` block, rename it, change the values, add a `.dark .palette-*` pair below. That's it.

---

## Typography

Two families, split by role.

### Display — Crimson Pro (serif)

Weights loaded: 400, 600, 700.

Use for headlines, section titles, hero copy, and the daily brief's H1. Carries the editorial weight — this is what makes the product feel like a magazine rather than a dashboard.

Tailwind utility: `font-display`.

Example:

- `Your Daily Intelligence Brief`
- `The Future of AI-Powered Productivity`
- `Latest from Your Sources`

### Body — Outfit (sans)

Weights loaded: 400, 500, 600, 700.

Use for body copy, metadata, UI labels, buttons, tags, navigation. Clean, geometric, readable at small sizes.

Tailwind utility: `font-body`.

### Fallback

Inter remains the default `font-sans` for parts of the app that have not yet adopted the story-format theme (settings, history, etc.). Do not mix Inter and Outfit inside the same layout.

### Scale

Follow the Tailwind scale. Headlines run large (`text-4xl` to `text-5xl`) in display serif. Body runs `text-base` in Outfit. Metadata runs `text-sm` or `text-xs`, muted.

---

## Voice

SubsBuzz speaks the way a good editor writes. Direct, plain, confident, never chatty. British English throughout.

Do:

- Use plain Anglo-Saxon words where possible. "Send", "read", "today", "quiet".
- Use active voice. "We analysed 180 emails" beats "180 emails were analysed".
- Write in sentences and paragraphs, not bullet-soup, for anything above UI microcopy.
- Keep a firm tone. Decisions are made, not suggested.
- Cite the source count when surfacing summaries ("180 sources analysed"). Credibility matters.

Do not:

- Use clichés: "leverage", "unlock", "empower", "synergy", "ecosystem", "game-changer".
- Use em dashes.
- Use "it's not X, it's Y" constructions.
- Apologise for the product or hedge. "Sorry if this is wrong — let us know!" has no place.
- Use emojis in UI copy, emails, or documents. Ever.

Reference points: Strunk & White, Zinsser (On Writing Well), The Economist house style.

---

## Imagery

Editorial photography, not stock-banality. Every image should look like it belongs next to a headline.

### Current state (2026-04-17)

The digest view shows a lead image on each card. Until real email imagery is wired in:

- Hero article and article cards use stock images keyed to extracted keywords.
- Fallback: a neutral gradient plate using `--secondary` and `--muted` tokens.

### Next step

Pull real images from source emails when available: first inline `<img>` with a reasonable aspect ratio, height > 160px, not a tracking pixel, not a logo. Fall back to keyword-keyed stock when no usable image exists. Fall back again to the gradient plate.

### Style rules

- No bright, oversaturated stock. If it looks like a 2012 tech-blog header, reject it.
- No people pointing at laptops.
- Prefer abstract, editorial, or object photography over staged scenes.
- Subtle vignetting on hero images is acceptable. No other filters.

---

## Iconography

Line icons only, from `lucide-react`. Weight matches Outfit body — stroke width 1.5-2px. Icons sit inline with text at `size-4` or `size-5`.

Do not use filled icons, multicolour icons, or Fontawesome. Do not mix icon libraries.

---

## Favicon and app icon

Derived from `logo.png` (bee-dominant lockup), cropped square, bee centred. Near-black background optional for dark OS themes. The wordmark is not used in favicons — too much detail at 16px / 32px.

---

## Motion

Motion is a finishing layer, not the main event. Use `framer-motion` for:

- Subtle hover lifts on cards (`y: -4`, 300ms ease).
- Staggered fade-in on grid load (100ms between cards).
- Animated active indicator on the topic filter.

Do not use motion for:

- Loading spinners on fast operations. Use a static skeleton.
- Attention-grabbing bounces, wiggles, or pulses.
- Anything that repeats.

Easing preset: `[0.22, 1, 0.36, 1]` (expo-out-ish). Default duration: 300-600ms.

---

## Assets index

| File               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `logo.png`         | Tight bee-dominant lockup. Avatar-scale.   |
| `logo-long.png`    | Horizontal lockup. Header-scale.           |

Source files (SVG / Figma source) do not yet live in this repo. When they do, add them here and note which is the master.

---

## Open questions

- [ ] Do we have vector sources (SVG, Figma) for the bee? PNGs are what we have today. At some point we will want SVG for crisp scaling and for favicons.
- [ ] What is the exact hex of the bee gold? Current value `~#F5C518` is eyeballed from the PNG. Confirm from source file when available.
- [ ] Tagline. "Your Daily Intelligence Brief" is a UI headline, not a brand tagline. If we need a tagline for landing pages, it has not been written yet.

---

## Change log

- 2026-04-17 — First draft. Covers logo, colour (brand + UI split), typography, voice, imagery, motion. Written after adding `.story-theme` token scope in `services/frontend/src/index.css`.
