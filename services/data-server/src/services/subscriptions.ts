/**
 * Smart sender parsing — subscription resolution.
 *
 * A single monitored email address (monitored_emails row) can fan out into
 * multiple newsletter "subscriptions" — NYT Cooking, Wirecutter and DealBook
 * all arrive from nytdirect@nytimes.com. The subscription key is derived from
 * the strongest header signal available:
 *
 *   Tier 1 — List-Id value (unwrapped + lowercased)
 *   Tier 5 — from address (lowercased)
 *
 * ESP-specific Tiers 2–4 are reserved for v2. Category is resolved in order:
 *   1. Publications registry (services/publications.ts)
 *   2. Keyword heuristic rules (services/publication-heuristics.ts)
 *   3. Inherit from the parent monitored_emails.category_id
 *   4. null (user will categorise it in the UI)
 */

import { and, eq, sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  monitoredEmails,
  emailCategories,
  subscriptions,
  type Subscription,
} from '../db/schema.js';
import { lookupPublication } from './publications.js';
import { classifyByHeuristics } from './publication-heuristics.js';

export interface SubscriptionSignals {
  /** Raw List-Id header value, including any `"human name" <id>` wrapping. Nullable. */
  listId?: string | null;
  /** Lowercased from address (e.g. `nytdirect@nytimes.com`). */
  fromAddress: string;
  /** From header display name, if present. */
  fromDisplayName?: string | null;
  /** Subject line — used for heuristic keyword matching on first-seen subscriptions. */
  subject?: string | null;
}

export interface ResolveSubscriptionResult {
  subscriptionId: number;
  categoryId: number | null;
  isNewSubscription: boolean;
  /** True when this insert brought the parent sender's subscription count from 1 → 2+. */
  isSecondSubscription: boolean;
}

/** Normalised view of a List-Id: separates the bracketed identifier from any human prefix. */
interface ParsedListId {
  /** e.g. `fwd.nytimes.com` — lowercased, no angle brackets. */
  id: string;
  /** e.g. `NYT Cooking — Five Weeknight Dishes`, if the header included a prefix. */
  human: string | null;
}

/**
 * Parse a raw List-Id header value. Handles the three common shapes:
 *   `<fwd.nytimes.com>`
 *   `NYT Cooking <fwd.nytimes.com>`
 *   `fwd.nytimes.com`
 */
export function parseListId(raw: string | null | undefined): ParsedListId | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(?:"?(.+?)"?\s+)?<([^>]+)>\s*$/);
  if (match) {
    const human = (match[1] ?? '').trim();
    const id = match[2].trim().toLowerCase();
    if (!id) return null;
    return { id, human: human || null };
  }

  // No brackets — treat the whole value as the id.
  return { id: trimmed.toLowerCase(), human: null };
}

/**
 * Derive the subscription_key + tier from the strongest available signal.
 * Tier 1 = List-Id. Tier 5 = from address. (ESP-specific Tiers 2–4 are v2.)
 */
export function deriveSubscriptionKey(signals: SubscriptionSignals): { key: string; tier: 1 | 5; parsedListId: ParsedListId | null } {
  const parsed = parseListId(signals.listId);
  if (parsed) return { key: parsed.id, tier: 1, parsedListId: parsed };
  return { key: signals.fromAddress.toLowerCase().trim(), tier: 5, parsedListId: null };
}

/**
 * Look up or create a subscription row for this (userId, subscription_key).
 * Re-running on the same inbound message returns the existing row unchanged
 * apart from the bumped last_seen_at / message_count counters.
 */
export async function resolveSubscription(
  userId: string,
  senderId: number,
  signals: SubscriptionSignals,
): Promise<ResolveSubscriptionResult> {
  const { key, tier, parsedListId } = deriveSubscriptionKey(signals);

  // Fast path: existing subscription — just bump counters.
  const existingRows = await getDatabase()
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.subscriptionKey, key)))
    .limit(1);

  if (existingRows.length > 0) {
    const row = existingRows[0];
    await getDatabase()
      .update(subscriptions)
      .set({ lastSeenAt: new Date(), messageCount: row.messageCount + 1 })
      .where(eq(subscriptions.id, row.id));
    return {
      subscriptionId: row.id,
      categoryId: row.categoryId ?? null,
      isNewSubscription: false,
      isSecondSubscription: false,
    };
  }

  // Slow path: derive display name + category, insert, detect split.
  const sender = await getDatabase()
    .select({ id: monitoredEmails.id, categoryId: monitoredEmails.categoryId })
    .from(monitoredEmails)
    .where(eq(monitoredEmails.id, senderId))
    .limit(1);
  const senderFallbackCategoryId = sender[0]?.categoryId ?? null;

  const { displayName, displayNameSource } = deriveDisplayName(key, parsedListId, signals);
  const { categoryId, categorySource, categoryConfidence } = await resolveCategory(
    userId,
    key,
    { displayName, subject: signals.subject ?? null, listIdHuman: parsedListId?.human ?? null },
    senderFallbackCategoryId,
  );

  // Count siblings BEFORE inserting so we can decide if this insert is the
  // one that flipped the sender from 1 → 2+ subscriptions.
  const siblingCountBefore = await getDatabase()
    .select({ c: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.senderId, senderId)));
  const siblingsBefore = siblingCountBefore[0]?.c ?? 0;

  const inserted = await getDatabase()
    .insert(subscriptions)
    .values({
      userId,
      senderId,
      subscriptionKey: key,
      subscriptionKeyTier: tier,
      displayName,
      displayNameSource,
      categoryId,
      categorySource,
      categoryConfidence,
      messageCount: 1,
      userConfirmed: false,
    })
    .onConflictDoNothing({ target: [subscriptions.userId, subscriptions.subscriptionKey] })
    .returning();

  // If a concurrent request beat us to it, re-select.
  let row: Subscription;
  if (inserted.length === 0) {
    const refetch = await getDatabase()
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.subscriptionKey, key)))
      .limit(1);
    row = refetch[0];
    // Also bump the counter since this inbound message still counts.
    if (row) {
      await getDatabase()
        .update(subscriptions)
        .set({ lastSeenAt: new Date(), messageCount: row.messageCount + 1 })
        .where(eq(subscriptions.id, row.id));
    }
    return {
      subscriptionId: row.id,
      categoryId: row.categoryId ?? null,
      isNewSubscription: false,
      isSecondSubscription: false,
    };
  }

  row = inserted[0];
  return {
    subscriptionId: row.id,
    categoryId: row.categoryId ?? null,
    isNewSubscription: true,
    isSecondSubscription: siblingsBefore >= 1,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function deriveDisplayName(
  key: string,
  parsedListId: ParsedListId | null,
  signals: SubscriptionSignals,
): { displayName: string; displayNameSource: string } {
  const registryEntry = lookupPublication(key);
  if (registryEntry) {
    return { displayName: registryEntry.displayName, displayNameSource: 'registry' };
  }
  if (parsedListId?.human) {
    return { displayName: parsedListId.human, displayNameSource: 'list_id' };
  }
  if (signals.fromDisplayName && signals.fromDisplayName.trim()) {
    return { displayName: signals.fromDisplayName.trim(), displayNameSource: 'from_name' };
  }
  return { displayName: signals.fromAddress, displayNameSource: 'from_address' };
}

async function resolveCategory(
  userId: string,
  subscriptionKey: string,
  heuristicSignals: { displayName: string; subject: string | null; listIdHuman: string | null },
  senderFallbackCategoryId: number | null,
): Promise<{ categoryId: number | null; categorySource: string; categoryConfidence: number | null }> {
  // 1. Registry — resolve the published slug against the user's category table.
  const registryEntry = lookupPublication(subscriptionKey);
  if (registryEntry) {
    const match = await categoryIdForSlug(userId, registryEntry.categorySlug);
    if (match !== null) {
      return { categoryId: match, categorySource: 'registry', categoryConfidence: 1.0 };
    }
    // Registry matched but user doesn't have the suggested category — fall
    // through. Don't create a new category silently; that's the user's call.
  }

  // 2. Heuristic keyword match against display name + subject + List-Id human.
  const heuristicSlug = classifyByHeuristics(heuristicSignals);
  if (heuristicSlug) {
    const match = await categoryIdForSlug(userId, heuristicSlug);
    if (match !== null) {
      return { categoryId: match, categorySource: 'heuristic', categoryConfidence: 0.6 };
    }
  }

  // 3. Inherit from parent sender.
  if (senderFallbackCategoryId !== null) {
    return {
      categoryId: senderFallbackCategoryId,
      categorySource: 'inherited_from_sender',
      categoryConfidence: 0.4,
    };
  }

  // 4. No category — user will pick one in the UI.
  return { categoryId: null, categorySource: 'none', categoryConfidence: null };
}

async function categoryIdForSlug(userId: string, slug: string): Promise<number | null> {
  const rows = await getDatabase()
    .select({ id: emailCategories.id })
    .from(emailCategories)
    .where(and(eq(emailCategories.userId, userId), eq(emailCategories.slug, slug)))
    .limit(1);
  return rows.length > 0 ? rows[0].id : null;
}
