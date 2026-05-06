export type AspectRatio = "16_9" | "3_4" | "1_1";

export interface HeroManifest {
  version: number;
  generated: string;
  categories: Record<string, Record<string, string[]>>;
}

const MANIFEST_URL = "/article-heroes/manifest.json";
const BASE_URL = "/article-heroes/";
const FALLBACK_CATEGORY = "general-news";

// Hero images upscaled past their native resolution pixelate badly (see Image
// #3 / 2026-05-04). Below this natural width, we step down to manifest art.
// 400 is empirically the boundary where common 320px masthead/illustration
// assets get rejected without false-positiving editorial photos (which are
// typically ≥600 native).
export const MIN_HERO_NATURAL_WIDTH = 400;

// Width:height ratio above which an image is treated as a banner / masthead
// strip rather than an editorial hero. Mirrors the backend masthead filter.
export const HERO_BANNER_RATIO_THRESHOLD = 3.5;

// Mirror of the backend _HERO_URL_BLACKLIST — rejects tracking pixels, logos,
// publisher banner assets, and known ad-network domains. Stored heroImageUrl
// values pre-dating the backend filter may match these; treat them as null so
// the manifest fallback is used instead.
//
// Notes on impression-tracker patterns:
//   - sli\.<publisher>\.com — "subscriber link insertion" tracker subdomain
//     (e.g. sli.washingtonpost.com); always serves invisible 1x1 pixels.
//   - \/imp\? — generic /imp? tracker endpoint regardless of query params.
//     Earlier version required li= which missed WaPo's s=...&e=... shape.
const HERO_URL_REJECT =
  /pixel|tracking|beacon|open\.gif|spacer|transparent|1x1|analytics|googletagmanager|doubleclick|\/logo|\/avatar|\/icon|\/unsub|\/footer|\/email-images\/[^?]*-(header|alert|banner|promo)-|link\.(cntraveler|wired|newyorker|vogue|vanityfair|gq|bonappetit|architecturaldigest|self|glamour|epicurious|teenvogue|allure|pitchfork|them|arstechnica)\.com\/img\/|liveintent\.|sli\.[a-z0-9-]+\.com|\/imp\?/i;

export function isGoodHeroUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return !HERO_URL_REJECT.test(url);
}

let manifestPromise: Promise<HeroManifest | null> | null = null;

function pickRandom<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function warmHeroManifest(): Promise<HeroManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((r) => (r.ok ? (r.json() as Promise<HeroManifest>) : null))
      .catch(() => null);
  }
  return manifestPromise;
}

/**
 * Sync resolution after the manifest has been loaded via warmHeroManifest.
 * Returns null if the manifest isn't loaded yet or no image exists for the
 * given category+ratio — callers should fall back to the gradient plate.
 *
 * Resolution order:
 *   1. Random image from matching category + ratio
 *   2. Random image from general-news + ratio
 *   3. null
 */
export function getArticleHeroFallbackSync(
  manifest: HeroManifest | null,
  categorySlug: string | null | undefined,
  ratio: AspectRatio,
): string | null {
  if (!manifest) return null;

  const { categories } = manifest;

  if (categorySlug) {
    const pick = pickRandom(categories[categorySlug]?.[ratio] ?? []);
    if (pick) return BASE_URL + pick;
  }

  const fallbackPick = pickRandom(categories[FALLBACK_CATEGORY]?.[ratio] ?? []);
  if (fallbackPick) return BASE_URL + fallbackPick;

  return null;
}
