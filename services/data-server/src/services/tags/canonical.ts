/**
 * Canonical tag registry.
 *
 * Seed list of short (1-2 word) tags the LLM is encouraged to reuse when
 * classifying article content. Each entry has a kebab-case `slug` (the
 * canonical form persisted in the tags table) and a `displayName` (UI casing).
 *
 * The list is intentionally narrow at v1 — speculative padding produces
 * noise. Grow it when real coverage gaps appear in dev/prod, the same
 * discipline as publications.ts.
 *
 * Tags absent from this list can still be created at runtime by the LLM —
 * normalize.ts kebab-cases them, and storage upserts on slug. The registry
 * is a *preference*, not a whitelist.
 */

export interface CanonicalTag {
  slug: string;
  displayName: string;
}

export const CANONICAL_TAGS: CanonicalTag[] = [
  // Tech / AI
  { slug: 'ai', displayName: 'AI' },
  { slug: 'machine-learning', displayName: 'Machine Learning' },
  { slug: 'startups', displayName: 'Startups' },
  { slug: 'big-tech', displayName: 'Big Tech' },
  { slug: 'cloud', displayName: 'Cloud' },
  { slug: 'cybersecurity', displayName: 'Cybersecurity' },
  { slug: 'crypto', displayName: 'Crypto' },
  { slug: 'semiconductors', displayName: 'Semiconductors' },
  { slug: 'social-media', displayName: 'Social Media' },
  { slug: 'open-source', displayName: 'Open Source' },

  // Business / markets
  { slug: 'earnings', displayName: 'Earnings' },
  { slug: 'ipo', displayName: 'IPO' },
  { slug: 'm-and-a', displayName: 'M&A' },
  { slug: 'layoffs', displayName: 'Layoffs' },
  { slug: 'venture-capital', displayName: 'Venture Capital' },
  { slug: 'private-equity', displayName: 'Private Equity' },
  { slug: 'banking', displayName: 'Banking' },
  { slug: 'real-estate', displayName: 'Real Estate' },
  { slug: 'retail', displayName: 'Retail' },
  { slug: 'advertising', displayName: 'Advertising' },

  // Macro / policy
  { slug: 'fed', displayName: 'Fed' },
  { slug: 'inflation', displayName: 'Inflation' },
  { slug: 'interest-rates', displayName: 'Interest Rates' },
  { slug: 'recession', displayName: 'Recession' },
  { slug: 'tariffs', displayName: 'Tariffs' },
  { slug: 'regulation', displayName: 'Regulation' },
  { slug: 'antitrust', displayName: 'Antitrust' },
  { slug: 'taxes', displayName: 'Taxes' },

  // Energy / commodities
  { slug: 'oil', displayName: 'Oil' },
  { slug: 'gas', displayName: 'Gas' },
  { slug: 'energy', displayName: 'Energy' },
  { slug: 'climate', displayName: 'Climate' },
  { slug: 'electric-vehicles', displayName: 'Electric Vehicles' },

  // Geopolitics
  { slug: 'us-politics', displayName: 'US Politics' },
  { slug: 'uk-politics', displayName: 'UK Politics' },
  { slug: 'eu', displayName: 'EU' },
  { slug: 'china', displayName: 'China' },
  { slug: 'russia', displayName: 'Russia' },
  { slug: 'ukraine', displayName: 'Ukraine' },
  { slug: 'middle-east', displayName: 'Middle East' },
  { slug: 'elections', displayName: 'Elections' },

  // Media / culture
  { slug: 'streaming', displayName: 'Streaming' },
  { slug: 'gaming', displayName: 'Gaming' },
  { slug: 'sports', displayName: 'Sports' },
  { slug: 'film', displayName: 'Film' },
  { slug: 'music', displayName: 'Music' },
  { slug: 'publishing', displayName: 'Publishing' },

  // Health / science
  { slug: 'health', displayName: 'Health' },
  { slug: 'biotech', displayName: 'Biotech' },
  { slug: 'pharma', displayName: 'Pharma' },
  { slug: 'space', displayName: 'Space' },
];

export const CANONICAL_TAG_SLUGS: ReadonlyArray<string> = CANONICAL_TAGS.map(t => t.slug);
export const CANONICAL_TAG_DISPLAY_NAMES: ReadonlyArray<string> = CANONICAL_TAGS.map(t => t.displayName);

const BY_SLUG: ReadonlyMap<string, CanonicalTag> = new Map(
  CANONICAL_TAGS.map(t => [t.slug, t]),
);

export function lookupCanonical(slug: string): CanonicalTag | undefined {
  return BY_SLUG.get(slug);
}
