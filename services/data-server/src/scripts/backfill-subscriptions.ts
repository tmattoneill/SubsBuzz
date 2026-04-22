/**
 * One-off backfill for smart sender parsing.
 *
 * Walks every monitored_emails row and creates a single Tier-5 subscription
 * per sender (subscription_key = lowercased from address) inheriting the
 * sender's category. Then walks digest_emails for each sender and stamps
 * subscription_id. All operations are idempotent — re-running the script is
 * a no-op once the initial pass has completed.
 *
 * Why Tier 5 only for the backfill:
 *   - We didn't capture List-Id on pre-feature messages, so we have no Tier 1
 *     signal to split on. Every historical message from a given sender
 *     collapses to one subscription keyed by its from address.
 *   - Existing senders therefore see ZERO UX disruption — one sub per
 *     sender, category inherited, marked user_confirmed so the split banner
 *     never fires retroactively.
 *   - New inbound messages after this ships use Tier 1 (List-Id) when
 *     available and will start producing legitimate splits.
 *
 * Usage:
 *   cd services/data-server
 *   npx tsx src/scripts/backfill-subscriptions.ts
 */

import 'dotenv/config';
import { and, eq, isNull } from 'drizzle-orm';
import { initializeDatabase, closeDatabaseConnection } from '../db';
import {
  monitoredEmails,
  digestEmails,
  subscriptions,
  type Subscription,
} from '../db/schema.js';
import { lookupPublication } from '../services/publications.js';

async function main() {
  const db = initializeDatabase();

  console.log('🔎 Loading monitored_emails…');
  const senders = await db.select().from(monitoredEmails);
  console.log(`   Found ${senders.length} senders`);

  let subsCreated = 0;
  let subsSkipped = 0;
  let emailsLinked = 0;

  for (const sender of senders) {
    const subscriptionKey = sender.email.trim().toLowerCase();

    // Look for an existing subscription for (userId, subscriptionKey).
    const existing = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.userId, sender.userId),
        eq(subscriptions.subscriptionKey, subscriptionKey),
      ))
      .limit(1);

    let subscription: Subscription;
    if (existing.length > 0) {
      subscription = existing[0];
      subsSkipped += 1;
    } else {
      // Registry lookup as a courtesy: if the sender's bare address happens
      // to be a known publication we use its display name. Otherwise fall
      // back to the address itself.
      const registryEntry = lookupPublication(subscriptionKey);
      const displayName = registryEntry?.displayName || sender.email;

      const inserted = await db
        .insert(subscriptions)
        .values({
          userId: sender.userId,
          senderId: sender.id,
          subscriptionKey,
          subscriptionKeyTier: 5,
          displayName,
          displayNameSource: registryEntry ? 'registry' : 'from_address',
          categoryId: sender.categoryId ?? null,
          categorySource: sender.categoryId ? 'inherited_from_sender' : 'none',
          categoryConfidence: sender.categoryId ? 0.4 : null,
          messageCount: 0,
          // Pre-existing senders are implicitly confirmed — we do NOT want
          // the split banner to fire on historical data.
          userConfirmed: true,
        })
        .onConflictDoNothing({ target: [subscriptions.userId, subscriptions.subscriptionKey] })
        .returning();

      if (inserted.length === 0) {
        // Another run (or a concurrent process) got there first; refetch.
        const refetch = await db
          .select()
          .from(subscriptions)
          .where(and(
            eq(subscriptions.userId, sender.userId),
            eq(subscriptions.subscriptionKey, subscriptionKey),
          ))
          .limit(1);
        subscription = refetch[0];
        subsSkipped += 1;
      } else {
        subscription = inserted[0];
        subsCreated += 1;
      }
    }

    // Link digest_emails for this sender to the subscription. Only those
    // with null subscription_id — leave already-linked rows alone.
    const update = await db
      .update(digestEmails)
      .set({ subscriptionId: subscription.id })
      .where(and(eq(digestEmails.sender, sender.email), isNull(digestEmails.subscriptionId)))
      .returning({ id: digestEmails.id });
    emailsLinked += update.length;

    if (update.length > 0 || (existing.length === 0 && subscription)) {
      console.log(`   ✓ ${sender.userId.slice(0, 12)}… ${sender.email} → subscription #${subscription.id}` +
        (update.length > 0 ? ` (linked ${update.length} email${update.length === 1 ? '' : 's'})` : ''));
    }
  }

  console.log('\n📦 Backfill summary');
  console.log(`   subscriptions created:  ${subsCreated}`);
  console.log(`   subscriptions already existed: ${subsSkipped}`);
  console.log(`   digest_emails linked:   ${emailsLinked}`);

  await closeDatabaseConnection();
}

main().catch(async (err) => {
  console.error('❌ Backfill failed:', err);
  try { await closeDatabaseConnection(); } catch {}
  process.exit(1);
});
