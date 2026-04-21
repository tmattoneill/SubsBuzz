# SubsBuzz Frontend

React SPA for the SubsBuzz AI-powered email digest application. Built with Vite, TypeScript, Tailwind CSS, and shadcn/ui components.

## Quick Start

```bash
npm install
npm run dev        # Dev server at http://127.0.0.1:5500
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

## Key Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 5500 |
| `npm run build` | Converts hero images, regenerates manifest, then runs Vite build |
| `npm run generate:hero-manifest` | Convert new PNG/JPG hero images to WebP + update manifest (run after adding images) |

## Article Hero Fallback Images

When an article has no `heroImageUrl` (common — emails often have no image or the extractor missed it), the app falls back to a curated library of category-matched hero images rather than showing a plain gradient.

### Structure

```
public/article-heroes/
├── manifest.json              ← generated, committed alongside images
├── finance/
│   ├── 16_9/                  ← 1440×810 WebP (hero banners, article detail)
│   ├── 3_4/                   ← 600×800  WebP (article cards)
│   └── 1_1/                   ← 600×600  WebP (square thumbnails)
├── general-news/              ← fallback pool for any unmatched category
│   ├── 16_9/
│   ├── 3_4/
│   └── 1_1/
├── science-technology/        ← add images here when ready
├── programming-software/
└── ... (10 categories total)
```

Category directory names match `categorySlugSnapshot` values from the API exactly — no mapping layer needed.

### How it works

1. On page load, `src/lib/article-heroes.ts` fetches `manifest.json` once (cached for the session).
2. When building article card or view data, if `heroImageUrl` is null the utility picks a random image for that category + aspect ratio.
3. Resolution order: **specific category** → **general-news** → **null** (gradient).
4. `HeroArticle`, `ArticleCard`, and `ArticleView` components need no changes — they already handle `null` image by rendering a gradient plate.

### Adding images for a new category

1. Drop source files (PNG, JPG, or WebP) into `public/article-heroes/{category-slug}/{ratio}/`
2. Run `npm run generate:hero-manifest`
3. Commit both the images and the updated `manifest.json`

The `prebuild` hook runs this automatically on every `npm run build`, so source PNGs/JPGs are safe to commit — they'll be converted to WebP and deleted on the next build. Aim for 3+ images per ratio per category so random selection has variety.

### Aspect ratio targets

| Directory | Dimensions | Used for |
|---|---|---|
| `16_9/` | 1440 × 810 | Hero banner, article detail view |
| `3_4/` | 600 × 800 | Article cards |
| `1_1/` | 600 × 600 | Square thumbnails |

Source images can be any size — the build script resizes and crops to these dimensions automatically using `sharp`.
