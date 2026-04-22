/**
 * Known-publications registry used by smart sender parsing (v1).
 *
 * Keyed by `subscription_key` as produced by resolveSubscription:
 *   - Tier 1: List-Id bracketed identifier (lowercased, unwrapped)
 *   - Tier 5: the from address (lowercased)
 *
 * When a lookup hits, the matched entry provides a canonical display_name and
 * a categorySlug that we resolve against the user's own email_categories
 * table. If the user has renamed or deleted the matching category the
 * subscription falls through to the heuristic/inherit layers.
 *
 * Matches the v1 category slugs defined in category-defaults.ts.
 */

export interface Publication {
  /** List-Id value (lowercased, unwrapped from angle brackets) or from address. */
  subscriptionKey: string;
  displayName: string;
  /** Must line up with a slug in DEFAULT_CATEGORIES unless you ship a new default. */
  categorySlug: string;
}

export const PUBLICATIONS: Publication[] = [
  // ── NYT family (SparkPost, List-Id per newsletter) ─────────────────────────
  { subscriptionKey: 'fwd.nytimes.com',              displayName: 'NYT Cooking — Five Weeknight Dishes', categorySlug: 'food-dining' },
  { subscriptionKey: 'cooking.nytimes.com',          displayName: 'NYT Cooking',                        categorySlug: 'food-dining' },
  { subscriptionKey: 'wcd.nytimes.com',              displayName: 'NYT Wirecutter — The Recommendation', categorySlug: 'retail-commerce' },
  { subscriptionKey: 'wirecutter.nytimes.com',       displayName: 'NYT Wirecutter',                     categorySlug: 'retail-commerce' },
  { subscriptionKey: 'dealbook.nytimes.com',         displayName: 'DealBook',                           categorySlug: 'finance' },
  { subscriptionKey: 'morning.nytimes.com',          displayName: 'The Morning (NYT)',                  categorySlug: 'general-news' },
  { subscriptionKey: 'theupshot.nytimes.com',        displayName: 'The Upshot',                         categorySlug: 'general-news' },
  { subscriptionKey: 'onpolitics.nytimes.com',       displayName: 'On Politics',                        categorySlug: 'general-news' },
  { subscriptionKey: 'oped.nytimes.com',             displayName: 'NYT Opinion Today',                  categorySlug: 'general-news' },
  { subscriptionKey: 'tmag.nytimes.com',             displayName: 'T Magazine',                         categorySlug: 'culture-entertainment' },
  { subscriptionKey: 'books.nytimes.com',            displayName: 'NYT Books',                          categorySlug: 'culture-entertainment' },
  { subscriptionKey: 'travel.nytimes.com',           displayName: 'NYT Travel',                         categorySlug: 'travel' },
  { subscriptionKey: 'well.nytimes.com',             displayName: 'Well',                               categorySlug: 'general-news' },
  { subscriptionKey: 'games.nytimes.com',            displayName: 'NYT Games',                          categorySlug: 'culture-entertainment' },

  // ── Washington Post ────────────────────────────────────────────────────────
  { subscriptionKey: 'washingtonpost.com',           displayName: 'The Washington Post',                categorySlug: 'general-news' },

  // ── Substack network (List-Id = <slug>.substack.com) ───────────────────────
  { subscriptionKey: 'stratechery.substack.com',     displayName: 'Stratechery',                        categorySlug: 'industry-news' },
  { subscriptionKey: 'platformer.substack.com',      displayName: 'Platformer',                         categorySlug: 'industry-news' },
  { subscriptionKey: 'casey.substack.com',           displayName: 'Platformer (Casey Newton)',          categorySlug: 'industry-news' },
  { subscriptionKey: 'garbageday.substack.com',      displayName: 'Garbage Day',                        categorySlug: 'culture-entertainment' },
  { subscriptionKey: 'noahpinion.substack.com',      displayName: 'Noahpinion',                         categorySlug: 'finance' },
  { subscriptionKey: 'mattyglesias.substack.com',    displayName: 'Slow Boring',                        categorySlug: 'general-news' },
  { subscriptionKey: 'slowboring.substack.com',      displayName: 'Slow Boring',                        categorySlug: 'general-news' },
  { subscriptionKey: 'heather.substack.com',         displayName: 'Letters from an American',           categorySlug: 'general-news' },
  { subscriptionKey: 'popular.substack.com',         displayName: 'Popular Information',                categorySlug: 'general-news' },
  { subscriptionKey: 'thedispatch.substack.com',     displayName: 'The Dispatch',                       categorySlug: 'general-news' },
  { subscriptionKey: 'bariweiss.substack.com',       displayName: 'The Free Press',                     categorySlug: 'general-news' },
  { subscriptionKey: 'astralcodexten.substack.com',  displayName: 'Astral Codex Ten',                   categorySlug: 'science-technology' },
  { subscriptionKey: 'oneusefulthing.substack.com',  displayName: 'One Useful Thing',                   categorySlug: 'science-technology' },
  { subscriptionKey: 'artificialcorner.substack.com', displayName: 'Artificial Corner',                 categorySlug: 'science-technology' },
  { subscriptionKey: 'everythinginmoderation.substack.com', displayName: 'Everything in Moderation',   categorySlug: 'industry-news' },

  // ── Economist ──────────────────────────────────────────────────────────────
  { subscriptionKey: 'newsletters.economist.com',    displayName: 'The Economist',                      categorySlug: 'general-news' },
  { subscriptionKey: 'economist.com',                displayName: 'The Economist',                      categorySlug: 'general-news' },

  // ── Axios ──────────────────────────────────────────────────────────────────
  { subscriptionKey: 'axios.com',                    displayName: 'Axios',                              categorySlug: 'general-news' },
  { subscriptionKey: 'pro.axios.com',                displayName: 'Axios Pro',                          categorySlug: 'industry-news' },

  // ── Bloomberg ──────────────────────────────────────────────────────────────
  { subscriptionKey: 'mail.bloomberg.com',           displayName: 'Bloomberg',                          categorySlug: 'finance' },
  { subscriptionKey: 'bloomberg.com',                displayName: 'Bloomberg',                          categorySlug: 'finance' },

  // ── Financial Times ────────────────────────────────────────────────────────
  { subscriptionKey: 'ft.com',                       displayName: 'Financial Times',                    categorySlug: 'finance' },
  { subscriptionKey: 'newsletters.ft.com',           displayName: 'Financial Times',                    categorySlug: 'finance' },

  // ── Morning Brew family ────────────────────────────────────────────────────
  { subscriptionKey: 'morningbrew.com',              displayName: 'Morning Brew',                       categorySlug: 'finance' },
  { subscriptionKey: 'retailbrew.morningbrew.com',   displayName: 'Retail Brew',                        categorySlug: 'retail-commerce' },
  { subscriptionKey: 'techbrew.morningbrew.com',     displayName: 'Tech Brew',                          categorySlug: 'science-technology' },
  { subscriptionKey: 'marketingbrew.morningbrew.com', displayName: 'Marketing Brew',                    categorySlug: 'industry-news' },

  // ── Condé Nast ─────────────────────────────────────────────────────────────
  { subscriptionKey: 'newsletter.cntraveler.com',    displayName: 'Condé Nast Traveler',                categorySlug: 'travel' },
  { subscriptionKey: 'newsletter.vanityfair.com',    displayName: 'Vanity Fair',                        categorySlug: 'culture-entertainment' },
  { subscriptionKey: 'newsletter.wired.com',         displayName: 'Wired',                              categorySlug: 'science-technology' },
  { subscriptionKey: 'newsletter.newyorker.com',     displayName: 'The New Yorker',                     categorySlug: 'culture-entertainment' },

  // ── Tech publications ──────────────────────────────────────────────────────
  { subscriptionKey: 'theverge.com',                 displayName: 'The Verge',                          categorySlug: 'science-technology' },
  { subscriptionKey: 'techcrunch.com',               displayName: 'TechCrunch',                         categorySlug: 'science-technology' },
  { subscriptionKey: 'arstechnica.com',              displayName: 'Ars Technica',                       categorySlug: 'science-technology' },
  { subscriptionKey: 'theinformation.com',           displayName: 'The Information',                    categorySlug: 'industry-news' },
  { subscriptionKey: 'hey.theinformation.com',       displayName: 'The Information',                    categorySlug: 'industry-news' },
  { subscriptionKey: 'protocol.com',                 displayName: 'Protocol',                           categorySlug: 'industry-news' },

  // ── Programming ────────────────────────────────────────────────────────────
  { subscriptionKey: 'hacker.substack.com',          displayName: 'Hacker Newsletter',                  categorySlug: 'programming-software' },
  { subscriptionKey: 'javascriptweekly.com',         displayName: 'JavaScript Weekly',                  categorySlug: 'programming-software' },
  { subscriptionKey: 'nodeweekly.com',               displayName: 'Node Weekly',                        categorySlug: 'programming-software' },
  { subscriptionKey: 'reactstatus.com',              displayName: 'React Status',                       categorySlug: 'programming-software' },
  { subscriptionKey: 'pycoder.com',                  displayName: "PyCoder's Weekly",                   categorySlug: 'programming-software' },
  { subscriptionKey: 'rubyweekly.com',               displayName: 'Ruby Weekly',                        categorySlug: 'programming-software' },
  { subscriptionKey: 'golangweekly.com',             displayName: 'Golang Weekly',                      categorySlug: 'programming-software' },
  { subscriptionKey: 'postgresweekly.com',           displayName: 'Postgres Weekly',                    categorySlug: 'programming-software' },

  // ── Food / Cooking ─────────────────────────────────────────────────────────
  { subscriptionKey: 'bonappetit.com',               displayName: 'Bon Appétit',                        categorySlug: 'food-dining' },
  { subscriptionKey: 'epicurious.com',               displayName: 'Epicurious',                         categorySlug: 'food-dining' },
  { subscriptionKey: 'seriouseats.com',              displayName: 'Serious Eats',                       categorySlug: 'food-dining' },
  { subscriptionKey: 'eater.com',                    displayName: 'Eater',                              categorySlug: 'food-dining' },
  { subscriptionKey: 'kingarthurbaking.com',         displayName: 'King Arthur Baking',                 categorySlug: 'food-dining' },
  { subscriptionKey: 'smittenkitchen.substack.com',  displayName: 'Smitten Kitchen',                    categorySlug: 'food-dining' },

  // ── Travel ─────────────────────────────────────────────────────────────────
  { subscriptionKey: 'afar.com',                     displayName: 'AFAR',                               categorySlug: 'travel' },
  { subscriptionKey: 'travelandleisure.com',         displayName: 'Travel + Leisure',                   categorySlug: 'travel' },
  { subscriptionKey: 'lonelyplanet.com',             displayName: 'Lonely Planet',                      categorySlug: 'travel' },

  // ── Science ────────────────────────────────────────────────────────────────
  { subscriptionKey: 'quantamagazine.org',           displayName: 'Quanta Magazine',                    categorySlug: 'science-technology' },
  { subscriptionKey: 'scientificamerican.com',       displayName: 'Scientific American',                categorySlug: 'science-technology' },
  { subscriptionKey: 'nature.com',                   displayName: 'Nature',                             categorySlug: 'science-technology' },

  // ── Consumer electronics / hardware ────────────────────────────────────────
  { subscriptionKey: 'engadget.com',                 displayName: 'Engadget',                           categorySlug: 'consumer-electronics' },
  { subscriptionKey: 'gizmodo.com',                  displayName: 'Gizmodo',                            categorySlug: 'consumer-electronics' },
  { subscriptionKey: 'dpreview.com',                 displayName: 'DPReview',                           categorySlug: 'consumer-electronics' },

  // ── Culture / Media ────────────────────────────────────────────────────────
  { subscriptionKey: 'theatlantic.com',              displayName: 'The Atlantic',                       categorySlug: 'general-news' },
  { subscriptionKey: 'newyorker.com',                displayName: 'The New Yorker',                     categorySlug: 'culture-entertainment' },
  { subscriptionKey: 'vulture.com',                  displayName: 'Vulture',                            categorySlug: 'culture-entertainment' },
  { subscriptionKey: 'pitchfork.com',                displayName: 'Pitchfork',                          categorySlug: 'culture-entertainment' },
  { subscriptionKey: 'rollingstone.com',             displayName: 'Rolling Stone',                      categorySlug: 'culture-entertainment' },

  // ── Business / Industry ────────────────────────────────────────────────────
  { subscriptionKey: 'hbr.org',                      displayName: 'Harvard Business Review',            categorySlug: 'industry-news' },
  { subscriptionKey: 'mckinsey.com',                 displayName: 'McKinsey Insights',                  categorySlug: 'industry-news' },
  { subscriptionKey: 'mail.mckinsey.com',            displayName: 'McKinsey Insights',                  categorySlug: 'industry-news' },
];

// Pre-built map for O(1) lookup.
const _index: Map<string, Publication> = new Map(
  PUBLICATIONS.map((p) => [p.subscriptionKey.toLowerCase(), p]),
);

/**
 * Look up a publication by subscription_key (already lowercased/unwrapped by
 * the caller). Returns undefined when the key is not in the registry.
 */
export function lookupPublication(subscriptionKey: string): Publication | undefined {
  if (!subscriptionKey) return undefined;
  return _index.get(subscriptionKey.toLowerCase());
}
