/**
 * Tag persistence.
 *
 * Idempotent upsert into `tags` by slug, then write `article_tags` rows
 * linking each tag to a digest_email. Used after addDigestEmail when the LLM
 * has produced normalized tags for an article.
 *
 * Concurrency: many articles in a single digest run upsert tags in parallel
 * (Promise.all in generateDigest). The unique constraint on tags.slug + the
 * onConflictDoUpdate path makes that safe — Postgres serializes per-row, no
 * duplicate-key errors, and the RETURNING gives us the id whether the row
 * was just inserted or already existed.
 */

import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { tags, articleTags, type Tag } from '../../db/schema.js';
import type { NormalizedTag } from './normalize';

interface UpsertedTag extends NormalizedTag {
  id: number;
}

function ensureDb() {
  if (!db) throw new Error('Database not configured. DATABASE_URL is required for tag storage.');
  return db;
}

async function upsertTagBySlug(tag: NormalizedTag): Promise<UpsertedTag> {
  const database = ensureDb();

  // ON CONFLICT DO UPDATE so RETURNING fires whether the row was just
  // inserted or already existed. usage_count is bumped on every persist so
  // the counter reflects how many articles a tag has been applied to.
  const rows = await database
    .insert(tags)
    .values({ slug: tag.slug, displayName: tag.displayName, usageCount: 1 })
    .onConflictDoUpdate({
      target: tags.slug,
      set: { usageCount: sql`${tags.usageCount} + 1` },
    })
    .returning({
      id: tags.id,
      slug: tags.slug,
      displayName: tags.displayName,
    });

  const row = rows[0];
  if (!row) throw new Error(`upsertTagBySlug: no row returned for ${tag.slug}`);
  return { id: row.id, slug: row.slug, displayName: row.displayName };
}

export async function upsertTags(input: NormalizedTag[]): Promise<UpsertedTag[]> {
  if (input.length === 0) return [];
  return Promise.all(input.map(upsertTagBySlug));
}

export async function linkArticleTags(
  digestEmailId: number,
  tagIds: number[],
): Promise<void> {
  if (tagIds.length === 0) return;
  const database = ensureDb();

  await database
    .insert(articleTags)
    .values(tagIds.map(tagId => ({ digestEmailId, tagId })))
    .onConflictDoNothing();
}

export async function persistTagsForArticle(
  digestEmailId: number,
  normalizedTags: NormalizedTag[],
): Promise<void> {
  if (normalizedTags.length === 0) return;
  const upserted = await upsertTags(normalizedTags);
  await linkArticleTags(digestEmailId, upserted.map(t => t.id));
}

/**
 * Fetch every digest_email tagged with this slug, scoped to the user, newest
 * first. Used by the /tags/:slug page.
 */
export async function getDigestEmailsByTagSlug(
  userId: string,
  slug: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const database = ensureDb();
  const rows = await database.execute(sql`
    SELECT
      de.id,
      de.digest_id          AS "digestId",
      de.sender,
      de.source,
      de.subject,
      de.received_at        AS "receivedAt",
      de.snippet,
      de.summary,
      de.summary_html       AS "summaryHtml",
      de.full_content       AS "fullContent",
      de.topics,
      de.keywords,
      de.original_link      AS "originalLink",
      de.gmail_message_id   AS "gmailMessageId",
      de.hero_image_url     AS "heroImageUrl",
      de.category_id        AS "categoryId",
      de.category_name_snapshot AS "categoryNameSnapshot",
      de.category_slug_snapshot AS "categorySlugSnapshot"
    FROM digest_emails de
    INNER JOIN article_tags at ON at.digest_email_id = de.id
    INNER JOIN tags t          ON t.id = at.tag_id
    INNER JOIN email_digests d ON d.id = de.digest_id
    WHERE d.user_id = ${userId}
      AND t.slug = ${slug}
    ORDER BY de.received_at DESC
    LIMIT ${limit}
  `);
  // postgres-js returns rows directly; node-postgres wraps them in `.rows`.
  return ((rows as any).rows ?? rows) as Array<Record<string, unknown>>;
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  const database = ensureDb();
  const rows = await database
    .select()
    .from(tags)
    .where(sql`${tags.slug} = ${slug}`)
    .limit(1);
  return rows[0] ?? null;
}
