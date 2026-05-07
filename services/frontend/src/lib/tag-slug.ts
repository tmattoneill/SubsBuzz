/**
 * Tag slug helper.
 *
 * Mirrors services/data-server/src/services/tags/normalize.ts:toSlug so a
 * tag display name persisted on digest_emails.topics ("Machine Learning")
 * rebuilds the URL-safe slug ("machine-learning") used by /tags/:slug.
 *
 * Keep in sync with the server-side function — they need to produce the
 * same slug for the same input or the link will 404.
 */
export function tagSlug(displayName: string): string {
  return displayName
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
