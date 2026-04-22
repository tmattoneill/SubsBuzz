/**
 * Manual smoke test: drive resolveSubscription end-to-end against the local DB.
 *
 * Simulates three inbound messages to the same nytdirect@nytimes.com sender
 * (from real List-Id values): NYT Cooking → Wirecutter → a repeat of NYT
 * Cooking. Expected outcomes:
 *   1) First call creates subscription A (Tier 1, fwd.nytimes.com).
 *      isNewSubscription=true, isSecondSubscription=false (only 1 sub yet).
 *   2) Second call creates subscription B (Tier 1, wcd.nytimes.com).
 *      isNewSubscription=true, isSecondSubscription=true (split detected!).
 *   3) Third call hits the fast path — no new subscription, counter bumped.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/scripts/smoke-resolve-subscription.ts <userId> <senderId>
 *
 * Cleanup:
 *   DELETE FROM subscriptions WHERE subscription_key IN ('fwd.nytimes.com','wcd.nytimes.com');
 */

import 'dotenv/config';
import { initializeDatabase, closeDatabaseConnection } from '../db';
import { resolveSubscription } from '../services/subscriptions';

async function main() {
  const userId = process.argv[2];
  const senderId = parseInt(process.argv[3] ?? '', 10);
  if (!userId || !Number.isFinite(senderId)) {
    console.error('Usage: tsx src/scripts/smoke-resolve-subscription.ts <userId> <senderId>');
    process.exit(2);
  }

  initializeDatabase();
  console.log(`\n▶ userId=${userId.slice(0, 12)}…  senderId=${senderId}\n`);

  const a = await resolveSubscription(userId, senderId, {
    listId: 'NYT Cooking <fwd.nytimes.com>',
    fromAddress: 'nytdirect@nytimes.com',
    fromDisplayName: 'NYT Cooking',
    subject: 'Five Weeknight Dishes',
  });
  console.log('1) NYT Cooking ->', a);

  const b = await resolveSubscription(userId, senderId, {
    listId: 'NYT Wirecutter <wcd.nytimes.com>',
    fromAddress: 'nytdirect@nytimes.com',
    fromDisplayName: 'NYT Wirecutter',
    subject: 'The Recommendation',
  });
  console.log('2) Wirecutter  ->', b);

  const c = await resolveSubscription(userId, senderId, {
    listId: 'NYT Cooking <fwd.nytimes.com>',
    fromAddress: 'nytdirect@nytimes.com',
    fromDisplayName: 'NYT Cooking',
    subject: 'Another dinner idea',
  });
  console.log('3) NYT Cooking (repeat) ->', c);

  await closeDatabaseConnection();
}

main().catch(async (err) => {
  console.error('❌ Smoke failed:', err);
  try { await closeDatabaseConnection(); } catch {}
  process.exit(1);
});
