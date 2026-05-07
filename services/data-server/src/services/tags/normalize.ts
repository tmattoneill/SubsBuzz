/**
 * Tag normalization.
 *
 * The LLM is prompted to return short, lowercase tags that match the canonical
 * registry where possible. This module is the safety net: it lowercases,
 * collapses whitespace, strips noisy punctuation, drops anything that isn't a
 * 1-2 word tag, and dedupes. Output is always a URL-safe kebab-case `slug`
 * plus a humanised `displayName` we can persist directly.
 *
 * Free-form tags from the LLM ("AI / Machine Learning", "Federal Reserve.",
 * "the US Federal Reserve") are squashed and let upsertTags decide whether
 * they map to an existing slug or get created fresh.
 */

import { lookupCanonical, type CanonicalTag } from './canonical';
import { applyAlias } from './aliases';

const MAX_TAGS_PER_ARTICLE = 5;
const MAX_WORDS_PER_TAG = 2;
const MAX_CHARS_PER_TAG = 28;

export interface NormalizedTag {
  slug: string;
  displayName: string;
}

/**
 * Lowercase + strip punctuation + collapse whitespace, then join with hyphens.
 * Ampersands become "and" so "M&A" → "m-and-a".
 */
export function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[‘’“”]/g, '')
    .replace(/[.,!?;:()"']/g, ' ')
    .replace(/[–—_/]/g, ' ')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

function toDisplayName(slug: string): string {
  // Preserve the canonical casing if we know this slug.
  const canonical = lookupCanonical(slug);
  if (canonical) return canonical.displayName;
  // Otherwise: title-case each word, with a few short-word exceptions kept
  // lowercase ("of", "and") so emergent tags don't read like newspaper
  // headlines. Single-word tags get capitalized normally.
  const lowercaseShort = new Set(['of', 'and', 'the', 'in', 'on', 'for']);
  return slug
    .split('-')
    .map((word, i) =>
      i > 0 && lowercaseShort.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

export function normalizeTag(raw: unknown): NormalizedTag | null {
  if (typeof raw !== 'string') return null;
  const rawSlug = toSlug(raw);
  if (!rawSlug) return null;

  // Synonym collapse before any other validation: "artificial-intelligence"
  // becomes "ai", "mergers" becomes "m-and-a". The post-alias slug is what
  // gets length-checked and word-counted, so an alias mapping to a canonical
  // 1-2 word tag is always accepted even if the raw input was longer.
  const slug = applyAlias(rawSlug);

  // Word count is the hyphen-separated piece count, ignoring filler joiners
  // like "and" so "m-and-a" still counts as a single tag.
  const wordCount = slug.split('-').filter(w => w !== 'and').length;
  if (wordCount < 1 || wordCount > MAX_WORDS_PER_TAG) return null;
  if (slug.length > MAX_CHARS_PER_TAG) return null;
  // No purely-numeric tags ("2024", "100"), no single-letter tags.
  if (/^\d+$/.test(slug)) return null;
  if (slug.length < 2) return null;

  return { slug, displayName: toDisplayName(slug) };
}

export function normalizeTagList(raws: unknown): NormalizedTag[] {
  if (!Array.isArray(raws)) return [];
  const seen = new Set<string>();
  const out: NormalizedTag[] = [];
  for (const raw of raws) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    if (seen.has(tag.slug)) continue;
    seen.add(tag.slug);
    out.push(tag);
    if (out.length >= MAX_TAGS_PER_ARTICLE) break;
  }
  return out;
}

export const TAG_LIMITS = {
  maxPerArticle: MAX_TAGS_PER_ARTICLE,
  maxWords: MAX_WORDS_PER_TAG,
  maxChars: MAX_CHARS_PER_TAG,
} as const;

export type { CanonicalTag };
