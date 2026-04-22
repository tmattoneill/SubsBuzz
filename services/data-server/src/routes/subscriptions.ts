/**
 * Subscriptions Routes - Internal API
 *
 * Smart sender parsing (v1). A subscription sits under a monitored_emails
 * parent and owns the category — so a single sender like nytdirect@nytimes.com
 * can fan out into NYT Cooking (Food), Wirecutter (Retail), and DealBook
 * (Finance). Created automatically by resolveSubscription at digest-create
 * time; exposed here for the Email Handling tree UI and recategorise flows.
 */

import { Router, Request, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { asyncHandler } from '../middleware/error';
import { getDatabase } from '../db';
import {
  subscriptions,
  monitoredEmails,
  digestEmails,
  emailCategories,
} from '../db/schema.js';

const router = Router();

const apiResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
});

const apiError = (message: string, code?: string) => ({
  success: false,
  error: message,
  ...(code && { code }),
});

// GET /api/subscriptions/:userId — list every subscription for the user,
// grouped with parent sender info. Frontend uses this to render the
// Email Handling tree (1 sub = flat row, 2+ = expandable parent).
router.get('/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const rows = await getDatabase()
    .select({
      id: subscriptions.id,
      senderId: subscriptions.senderId,
      senderEmail: monitoredEmails.email,
      senderActive: monitoredEmails.active,
      senderCategoryId: monitoredEmails.categoryId,
      senderSplitBannerDismissedAt: monitoredEmails.splitBannerDismissedAt,
      subscriptionKey: subscriptions.subscriptionKey,
      subscriptionKeyTier: subscriptions.subscriptionKeyTier,
      displayName: subscriptions.displayName,
      displayNameSource: subscriptions.displayNameSource,
      categoryId: subscriptions.categoryId,
      categorySource: subscriptions.categorySource,
      categoryConfidence: subscriptions.categoryConfidence,
      firstSeenAt: subscriptions.firstSeenAt,
      lastSeenAt: subscriptions.lastSeenAt,
      messageCount: subscriptions.messageCount,
      userConfirmed: subscriptions.userConfirmed,
    })
    .from(subscriptions)
    .innerJoin(monitoredEmails, eq(subscriptions.senderId, monitoredEmails.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(monitoredEmails.email, subscriptions.firstSeenAt);

  return res.json(apiResponse(rows));
}));

// PATCH /api/subscriptions/:id — update category, display name, or mark confirmed.
// userId must be supplied in the body to scope the update (subscriptions don't
// carry a session, so we enforce ownership explicitly here).
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json(apiError('Invalid id', 'INVALID_ID'));
  const { userId, categoryId, displayName, userConfirmed } = req.body;
  if (!userId) return res.status(400).json(apiError('userId is required', 'MISSING_FIELDS'));

  // Build the update set conditionally so undefined fields leave DB values alone.
  const updates: Record<string, unknown> = {};
  if (categoryId !== undefined) {
    updates.categoryId = categoryId === null ? null : Number(categoryId);
    updates.categorySource = 'user';
    updates.categoryConfidence = 1.0;
  }
  if (typeof displayName === 'string' && displayName.trim()) {
    updates.displayName = displayName.trim();
    updates.displayNameSource = 'user_override';
  }
  if (typeof userConfirmed === 'boolean') {
    updates.userConfirmed = userConfirmed;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json(apiError('No updatable fields provided', 'NO_CHANGES'));
  }

  const result = await getDatabase()
    .update(subscriptions)
    .set(updates)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning();

  if (result.length === 0) {
    return res.status(404).json(apiError('Subscription not found', 'NOT_FOUND'));
  }
  return res.json(apiResponse(result[0]));
}));

// DELETE /api/subscriptions/:id — remove one subscription under a parent
// sender. digest_emails.subscription_id FK is ON DELETE SET NULL so historical
// rows remain intact (with their snapshot columns) but become orphaned.
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json(apiError('Invalid id', 'INVALID_ID'));
  const userId = (req.query.userId as string | undefined) ?? req.body?.userId;
  if (!userId) return res.status(400).json(apiError('userId is required', 'MISSING_FIELDS'));

  const deleted = await getDatabase()
    .delete(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning({ id: subscriptions.id });

  if (deleted.length === 0) {
    return res.status(404).json(apiError('Subscription not found', 'NOT_FOUND'));
  }
  return res.json(apiResponse({ id: deleted[0].id }, 'Subscription deleted'));
}));

// POST /api/subscriptions/sender/:senderId/dismiss-banner — record that the
// user acknowledged the split-detection banner for this sender (via "Looks
// good" / "Adjust" / explicit close). 48h auto-dismiss is enforced on the
// frontend using first_seen_at; no server-side cron needed.
router.post('/sender/:senderId/dismiss-banner', asyncHandler(async (req: Request, res: Response) => {
  const senderId = parseInt(req.params.senderId, 10);
  if (isNaN(senderId)) return res.status(400).json(apiError('Invalid senderId', 'INVALID_ID'));
  const userId = (req.body?.userId as string | undefined) ?? (req.query.userId as string | undefined);
  if (!userId) return res.status(400).json(apiError('userId is required', 'MISSING_FIELDS'));

  const result = await getDatabase()
    .update(monitoredEmails)
    .set({ splitBannerDismissedAt: new Date() })
    .where(and(eq(monitoredEmails.id, senderId), eq(monitoredEmails.userId, userId)))
    .returning({ id: monitoredEmails.id });

  if (result.length === 0) {
    return res.status(404).json(apiError('Sender not found', 'NOT_FOUND'));
  }

  // Also mark every subscription under this sender as user_confirmed — the
  // dismissal implicitly endorses the current split.
  await getDatabase()
    .update(subscriptions)
    .set({ userConfirmed: true })
    .where(and(eq(subscriptions.senderId, senderId), eq(subscriptions.userId, userId)));

  return res.json(apiResponse({ senderId: result[0].id }, 'Banner dismissed'));
}));

// PATCH /api/subscriptions/digest-email/:id/recategorise — shortcut for the
// "Recategorise" action on an article card. The categorise applies to the
// underlying subscription, so all historical and future digest_emails under
// that subscription pick up the new category on their next render.
router.patch('/digest-email/:id/recategorise', asyncHandler(async (req: Request, res: Response) => {
  const digestEmailId = parseInt(req.params.id, 10);
  if (isNaN(digestEmailId)) return res.status(400).json(apiError('Invalid id', 'INVALID_ID'));
  const { userId, categoryId } = req.body;
  if (!userId) return res.status(400).json(apiError('userId is required', 'MISSING_FIELDS'));
  if (categoryId !== null && typeof categoryId !== 'number') {
    return res.status(400).json(apiError('categoryId must be a number or null', 'INVALID_CATEGORY'));
  }

  // Find the digest_emails row and its subscription_id. We then update the
  // subscription, not the single email — the categorise is meant to propagate.
  const rows = await getDatabase()
    .select({
      id: digestEmails.id,
      subscriptionId: digestEmails.subscriptionId,
    })
    .from(digestEmails)
    .where(eq(digestEmails.id, digestEmailId))
    .limit(1);
  if (rows.length === 0) {
    return res.status(404).json(apiError('Digest email not found', 'NOT_FOUND'));
  }
  const subscriptionId = rows[0].subscriptionId;
  if (!subscriptionId) {
    // Pre-feature or orphaned row — just update the one email's snapshot fields.
    let nameSnap: string | null = null;
    let slugSnap: string | null = null;
    if (categoryId !== null) {
      const cat = await getDatabase()
        .select({ name: emailCategories.name, slug: emailCategories.slug })
        .from(emailCategories)
        .where(and(eq(emailCategories.id, categoryId), eq(emailCategories.userId, userId)))
        .limit(1);
      if (cat.length === 0) return res.status(404).json(apiError('Category not found', 'NOT_FOUND'));
      nameSnap = cat[0].name;
      slugSnap = cat[0].slug;
    }
    await getDatabase()
      .update(digestEmails)
      .set({ categoryId, categoryNameSnapshot: nameSnap, categorySlugSnapshot: slugSnap })
      .where(eq(digestEmails.id, digestEmailId));
    return res.json(apiResponse({ digestEmailId, subscriptionId: null, categoryId }));
  }

  // Verify the subscription belongs to this user before mutating.
  const subRow = await getDatabase()
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)))
    .limit(1);
  if (subRow.length === 0) {
    return res.status(404).json(apiError('Subscription not found for user', 'NOT_FOUND'));
  }

  await getDatabase()
    .update(subscriptions)
    .set({ categoryId, categorySource: 'user', categoryConfidence: 1.0, userConfirmed: true })
    .where(eq(subscriptions.id, subscriptionId));

  // Also update the snapshot columns on every digest_emails row tied to this
  // subscription so /category/:slug reads are immediately consistent.
  let nameSnap: string | null = null;
  let slugSnap: string | null = null;
  if (categoryId !== null) {
    const cat = await getDatabase()
      .select({ name: emailCategories.name, slug: emailCategories.slug })
      .from(emailCategories)
      .where(and(eq(emailCategories.id, categoryId), eq(emailCategories.userId, userId)))
      .limit(1);
    if (cat.length === 0) return res.status(404).json(apiError('Category not found', 'NOT_FOUND'));
    nameSnap = cat[0].name;
    slugSnap = cat[0].slug;
  }
  await getDatabase()
    .update(digestEmails)
    .set({ categoryId, categoryNameSnapshot: nameSnap, categorySlugSnapshot: slugSnap })
    .where(eq(digestEmails.subscriptionId, subscriptionId));

  return res.json(apiResponse({ digestEmailId, subscriptionId, categoryId }));
}));

export { router as subscriptionsRoutes };
