/**
 * Default categories seeded on first GET /api/storage/email-categories/:userId.
 * Slugs are immutable — renaming a category updates `name` only, so URLs
 * (/category/:slug) never 404 after a rename. Keep slugs URL-safe and stable.
 */

export interface DefaultCategory {
  name: string;
  slug: string;
  sortOrder: number;
  color: string | null;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'General News',           slug: 'general-news',           sortOrder: 10,  color: null },
  { name: 'Culture & Entertainment', slug: 'culture-entertainment', sortOrder: 20,  color: null },
  { name: 'Industry News',          slug: 'industry-news',          sortOrder: 30,  color: null },
  { name: 'Finance',                slug: 'finance',                sortOrder: 40,  color: null },
  { name: 'Retail + Commerce',      slug: 'retail-commerce',        sortOrder: 50,  color: null },
  { name: 'Travel',                 slug: 'travel',                 sortOrder: 60,  color: null },
  { name: 'Science + Technology',   slug: 'science-technology',     sortOrder: 70,  color: null },
  { name: 'Programming + Software', slug: 'programming-software',   sortOrder: 80,  color: null },
  { name: 'Consumer Electronics',   slug: 'consumer-electronics',   sortOrder: 90,  color: null },
  { name: 'Food + Dining',          slug: 'food-dining',            sortOrder: 100, color: null },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
