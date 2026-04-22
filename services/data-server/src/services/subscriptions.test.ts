/**
 * Unit tests for the smart sender parsing logic (List-Id parsing,
 * subscription key derivation, registry lookup, keyword heuristics).
 *
 * The DB-touching `resolveSubscription` orchestrator is covered by the
 * end-to-end digest pipeline test — the pure functions exercised here are
 * what make that orchestrator correct.
 *
 * Style mirrors provider.test.ts: no jest/vitest, just node:assert + a
 * results array. Run via `tsx src/services/subscriptions.test.ts`.
 */

import { strict as assert } from 'node:assert';
import { parseListId, deriveSubscriptionKey } from './subscriptions';
import { lookupPublication } from './publications';
import { classifyByHeuristics } from './publication-heuristics';

type TestFn = () => void;
interface Result { name: string; passed: boolean; message?: string; }
const results: Result[] = [];

function test(name: string, fn: TestFn) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (err: any) {
    results.push({ name, passed: false, message: err?.message ?? String(err) });
  }
}

// ── parseListId ──────────────────────────────────────────────────────────────

test('parseListId: bracketed id with human prefix', () => {
  const parsed = parseListId('NYT Cooking <fwd.nytimes.com>');
  assert.deepEqual(parsed, { id: 'fwd.nytimes.com', human: 'NYT Cooking' });
});

test('parseListId: bracketed id without prefix', () => {
  const parsed = parseListId('<fwd.nytimes.com>');
  assert.deepEqual(parsed, { id: 'fwd.nytimes.com', human: null });
});

test('parseListId: quoted human prefix', () => {
  const parsed = parseListId('"Five Weeknight Dishes" <fwd.nytimes.com>');
  assert.deepEqual(parsed, { id: 'fwd.nytimes.com', human: 'Five Weeknight Dishes' });
});

test('parseListId: bare id without brackets', () => {
  const parsed = parseListId('artificialcorner.substack.com');
  assert.deepEqual(parsed, { id: 'artificialcorner.substack.com', human: null });
});

test('parseListId: lowercases the id', () => {
  const parsed = parseListId('<FWD.NyTimes.COM>');
  assert.equal(parsed?.id, 'fwd.nytimes.com');
});

test('parseListId: null / empty returns null', () => {
  assert.equal(parseListId(null), null);
  assert.equal(parseListId(undefined), null);
  assert.equal(parseListId(''), null);
  assert.equal(parseListId('   '), null);
});

// ── deriveSubscriptionKey ────────────────────────────────────────────────────

test('deriveSubscriptionKey: List-Id takes Tier 1', () => {
  const result = deriveSubscriptionKey({
    listId: 'NYT Cooking <fwd.nytimes.com>',
    fromAddress: 'nytdirect@nytimes.com',
  });
  assert.equal(result.key, 'fwd.nytimes.com');
  assert.equal(result.tier, 1);
  assert.equal(result.parsedListId?.human, 'NYT Cooking');
});

test('deriveSubscriptionKey: falls back to from address at Tier 5', () => {
  const result = deriveSubscriptionKey({
    listId: null,
    fromAddress: 'nytdirect@nytimes.com',
  });
  assert.equal(result.key, 'nytdirect@nytimes.com');
  assert.equal(result.tier, 5);
  assert.equal(result.parsedListId, null);
});

test('deriveSubscriptionKey: from address lowercased at Tier 5', () => {
  const result = deriveSubscriptionKey({
    listId: undefined,
    fromAddress: 'NYTDirect@NYTimes.com',
  });
  assert.equal(result.key, 'nytdirect@nytimes.com');
});

test('deriveSubscriptionKey: two NYT newsletters produce distinct Tier 1 keys', () => {
  const cooking = deriveSubscriptionKey({
    listId: '<fwd.nytimes.com>',
    fromAddress: 'nytdirect@nytimes.com',
  });
  const wirecutter = deriveSubscriptionKey({
    listId: '<wcd.nytimes.com>',
    fromAddress: 'nytdirect@nytimes.com',
  });
  assert.notEqual(cooking.key, wirecutter.key);
  assert.equal(cooking.tier, 1);
  assert.equal(wirecutter.tier, 1);
});

// ── publications registry ───────────────────────────────────────────────────

test('lookupPublication: known List-Id resolves to its entry', () => {
  const entry = lookupPublication('fwd.nytimes.com');
  assert.ok(entry, 'expected a registry entry');
  assert.equal(entry!.categorySlug, 'food-dining');
  assert.match(entry!.displayName, /NYT Cooking/i);
});

test('lookupPublication: case-insensitive match', () => {
  const entry = lookupPublication('FWD.NYTIMES.COM');
  assert.ok(entry);
  assert.equal(entry!.subscriptionKey, 'fwd.nytimes.com');
});

test('lookupPublication: unknown key returns undefined', () => {
  const entry = lookupPublication('unknown-publisher.example.com');
  assert.equal(entry, undefined);
});

// ── classifyByHeuristics ────────────────────────────────────────────────────

test('classifyByHeuristics: "cooking" keyword maps to food-dining', () => {
  const slug = classifyByHeuristics({
    displayName: 'Sunday Cooking Digest',
    subject: null,
    listIdHuman: null,
  });
  assert.equal(slug, 'food-dining');
});

test('classifyByHeuristics: wirecutter maps to retail-commerce', () => {
  const slug = classifyByHeuristics({
    displayName: 'Wirecutter Deals',
    subject: null,
    listIdHuman: null,
  });
  assert.equal(slug, 'retail-commerce');
});

test('classifyByHeuristics: dealbook maps to finance', () => {
  const slug = classifyByHeuristics({
    displayName: 'DealBook Morning',
    subject: null,
    listIdHuman: null,
  });
  assert.equal(slug, 'finance');
});

test('classifyByHeuristics: no match returns null', () => {
  const slug = classifyByHeuristics({
    displayName: 'Some random title',
    subject: 'Hi friend',
    listIdHuman: null,
  });
  assert.equal(slug, null);
});

test('classifyByHeuristics: empty input returns null', () => {
  assert.equal(classifyByHeuristics({ displayName: null, subject: null, listIdHuman: null }), null);
});

// ── reporting ───────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;

for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  const detail = r.passed ? '' : ` — ${r.message}`;
  console.log(`${icon} ${r.name}${detail}`);
}

console.log(`\n${passed}/${results.length} passed, ${failed} failed`);

process.exit(failed === 0 ? 0 : 1);
