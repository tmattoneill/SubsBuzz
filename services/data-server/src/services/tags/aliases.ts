/**
 * Tag synonym aliases.
 *
 * Maps common LLM-emitted synonyms to canonical slugs. Applied in
 * normalize.ts after slugification, before the tag is upserted into the
 * tags table. Without this, "artificial-intelligence" and "ai" would
 * coexist as separate rows even though they mean the same thing.
 *
 * Be conservative — only add entries for unambiguous synonyms. When in
 * doubt, leave the LLM's choice alone and let synonym sprawl surface in
 * the dashboard before forcing a merge.
 *
 * Both keys and values are kebab-case slugs.
 */
export const TAG_ALIASES: Readonly<Record<string, string>> = {
  // AI
  'artificial-intelligence': 'ai',
  'a-i': 'ai',
  'generative-ai': 'ai',
  'gen-ai': 'ai',
  // Machine learning
  'ml': 'machine-learning',
  // Business / markets
  'merger': 'm-and-a',
  'mergers': 'm-and-a',
  'acquisition': 'm-and-a',
  'acquisitions': 'm-and-a',
  'mergers-and-acquisitions': 'm-and-a',
  'venture': 'venture-capital',
  'vc': 'venture-capital',
  'pe': 'private-equity',
  // Macro
  'federal-reserve': 'fed',
  'fed-reserve': 'fed',
  // Geopolitics
  'us': 'us-politics',
  'united-states': 'us-politics',
  'uk': 'uk-politics',
  'britain': 'uk-politics',
  'great-britain': 'uk-politics',
  'european-union': 'eu',
  'election': 'elections',
  // Crypto
  'bitcoin': 'crypto',
  'ethereum': 'crypto',
  'cryptocurrency': 'crypto',
  // Semiconductors
  'chip': 'semiconductors',
  'chips': 'semiconductors',
  'semiconductor': 'semiconductors',
  // EVs
  'ev': 'electric-vehicles',
  'evs': 'electric-vehicles',
  // Retail
  'e-commerce': 'retail',
  'ecommerce': 'retail',
  // Media
  'movies': 'film',
  'cinema': 'film',
  'esports': 'gaming',
  'video-games': 'gaming',
  // Health
  'pharmaceuticals': 'pharma',
  'pharmaceutical': 'pharma',
  // Cyber
  'cyber-security': 'cybersecurity',
  'infosec': 'cybersecurity',
};

export function applyAlias(slug: string): string {
  return TAG_ALIASES[slug] ?? slug;
}
