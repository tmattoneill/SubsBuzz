/**
 * Keyword-based fallback category resolver used when the publications
 * registry doesn't have an entry for a subscription_key. Runs over the
 * display_name + List-Id human-readable part + subject line of the first
 * message seen for the subscription.
 *
 * Returns a category slug that lines up with DEFAULT_CATEGORIES (see
 * category-defaults.ts). If no rule matches, returns null and the caller
 * falls through to inherit-from-sender.
 */

interface HeuristicRule {
  /** Case-insensitive regex tested against the combined haystack. */
  pattern: RegExp;
  categorySlug: string;
}

const RULES: HeuristicRule[] = [
  // Food / Cooking
  { pattern: /\b(cooking|recipe|recipes|baking|kitchen|weeknight|dinner|breakfast|food ?&|chef)\b/i, categorySlug: 'food-dining' },

  // Travel
  { pattern: /\b(travel|traveler|itinerary|vacation|destinations|hotels?|flights?|getaway)\b/i, categorySlug: 'travel' },

  // Finance / Markets
  { pattern: /\b(dealbook|finance|markets?|economy|economic|trader|equit(y|ies)|earnings|investor|stocks?)\b/i, categorySlug: 'finance' },

  // Retail / Shopping
  { pattern: /\b(wirecutter|recommendation|best-?(of|for)|deals?|shopping|retail|commerce|product review)\b/i, categorySlug: 'retail-commerce' },

  // Programming / Software
  { pattern: /\b(javascript|typescript|python|ruby|golang|rust|postgres|devops|kubernetes|docker|react|vue|svelte|framework|weekly digest|weekly dev|hacker news)\b/i, categorySlug: 'programming-software' },

  // Consumer electronics
  { pattern: /\b(gadget|unboxing|review (of )?the (new )?[a-z]+ (pro|max|plus|ultra))\b/i, categorySlug: 'consumer-electronics' },

  // Science / Technology (checked after more specific programming/electronics rules)
  { pattern: /\b(science|research|ai|artificial intelligence|machine learning|quantum|climate|genom|neur|biotech|robotics)\b/i, categorySlug: 'science-technology' },

  // Industry / Business
  { pattern: /\b(industry|strategy|leadership|product manag|enterprise|b2b|saas|startup|founders?)\b/i, categorySlug: 'industry-news' },

  // Culture / Entertainment
  { pattern: /\b(film|movie|tv (show|series)|streaming|music|album|concert|books?|novel|literary|arts?|culture|theatre|theater)\b/i, categorySlug: 'culture-entertainment' },

  // General news (last — catches anything newsy that didn't hit a more specific rule)
  { pattern: /\b(politics|election|senate|congress|parliament|white house|supreme court|policy|washington|daily news|briefing)\b/i, categorySlug: 'general-news' },
];

/**
 * Given free-text signals from the subscription (display name, subject, etc.)
 * return the first matching category slug or null.
 */
export function classifyByHeuristics(signals: {
  displayName?: string | null;
  subject?: string | null;
  listIdHuman?: string | null;
}): string | null {
  const haystack = [signals.displayName, signals.subject, signals.listIdHuman]
    .filter(Boolean)
    .join(' ');
  if (!haystack.trim()) return null;
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.categorySlug;
  }
  return null;
}
