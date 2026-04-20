/**
 * Unit tests for the LLM provider abstraction (TEEPER-149).
 *
 * This project does not have a dedicated unit-test framework in data-server
 * (no jest/vitest). Tests are executed via `tsx src/services/llm/provider.test.ts`
 * and report pass/fail counts to stdout. The wrapper in `tests/test-llm-provider.js`
 * spawns this file and plugs the result into the existing `tests/run-tests.js`
 * aggregator.
 *
 * Keep the assertions dependency-free (node:assert only) so no new packages are
 * needed — this fits the pattern of the other ad-hoc test scripts in `tests/`.
 */

import { strict as assert } from 'node:assert';
import {
  resolveProvider,
  mergeCompletionParams,
  ProviderConfigError,
} from './provider';

type TestFn = () => void;

interface Result {
  name: string;
  passed: boolean;
  message?: string;
}

const results: Result[] = [];

function test(name: string, fn: TestFn) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (err: any) {
    results.push({ name, passed: false, message: err?.message ?? String(err) });
  }
}

// Save and restore env between tests so we don't pollute the surrounding shell.
const ORIGINAL_DEEPSEEK = process.env.DEEPSEEK_API_KEY;
const ORIGINAL_OPENAI = process.env.OPENAI_API_KEY;

function withEnv(env: Record<string, string | undefined>, fn: TestFn) {
  const snapshot: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) snapshot[k] = process.env[k];
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── resolveProvider ──────────────────────────────────────────────────────────

test('deepseek is the default when llmProvider is unset', () => {
  withEnv({ DEEPSEEK_API_KEY: 'ds-key' }, () => {
    const cfg = resolveProvider({});
    assert.equal(cfg.id, 'deepseek');
    assert.equal(cfg.model, 'deepseek-chat');
    assert.equal(cfg.baseURL, 'https://api.deepseek.com/v1');
    assert.equal(cfg.apiKey, 'ds-key');
    assert.deepEqual(cfg.extraParams, {});
  });
});

test('deepseek throws missing_key when DEEPSEEK_API_KEY is absent', () => {
  withEnv({ DEEPSEEK_API_KEY: undefined }, () => {
    try {
      resolveProvider({ llmProvider: 'deepseek' });
      throw new Error('expected ProviderConfigError');
    } catch (err) {
      assert.ok(err instanceof ProviderConfigError);
      assert.equal((err as ProviderConfigError).code, 'missing_key');
    }
  });
});

test('openai uses the per-user key when supplied', () => {
  withEnv({ OPENAI_API_KEY: 'env-key' }, () => {
    const cfg = resolveProvider({ llmProvider: 'openai', openaiApiKey: 'user-key' });
    assert.equal(cfg.id, 'openai');
    assert.equal(cfg.apiKey, 'user-key');
    assert.equal(cfg.baseURL, undefined);
    assert.equal(cfg.model, 'gpt-5.4-nano');
    assert.equal(cfg.extraParams.reasoning_effort, 'none');
  });
});

test('openai falls back to OPENAI_API_KEY env when no user key', () => {
  withEnv({ OPENAI_API_KEY: 'env-key' }, () => {
    const cfg = resolveProvider({ llmProvider: 'openai' });
    assert.equal(cfg.apiKey, 'env-key');
  });
});

test('openai throws missing_key when neither user key nor env key is set', () => {
  withEnv({ OPENAI_API_KEY: undefined }, () => {
    try {
      resolveProvider({ llmProvider: 'openai' });
      throw new Error('expected ProviderConfigError');
    } catch (err) {
      assert.ok(err instanceof ProviderConfigError);
      assert.equal((err as ProviderConfigError).code, 'missing_key');
    }
  });
});

test('unknown provider throws invalid_provider', () => {
  try {
    resolveProvider({ llmProvider: 'anthropic' as any });
    throw new Error('expected ProviderConfigError');
  } catch (err) {
    assert.ok(err instanceof ProviderConfigError);
    assert.equal((err as ProviderConfigError).code, 'invalid_provider');
  }
});

// ── mergeCompletionParams ─────────────────────────────────────────────────────

test('mergeCompletionParams injects reasoning_effort only for openai', () => {
  withEnv({ OPENAI_API_KEY: 'env-key', DEEPSEEK_API_KEY: 'ds-key' }, () => {
    const openaiCfg = resolveProvider({ llmProvider: 'openai' });
    const openaiMerged = mergeCompletionParams(
      { model: openaiCfg.model, temperature: 0.5 },
      openaiCfg,
    );
    assert.equal(openaiMerged.reasoning_effort, 'none');
    assert.equal(openaiMerged.temperature, 0.5);

    const deepseekCfg = resolveProvider({ llmProvider: 'deepseek' });
    const deepseekMerged = mergeCompletionParams(
      { model: deepseekCfg.model, temperature: 0.5 },
      deepseekCfg,
    );
    assert.equal((deepseekMerged as any).reasoning_effort, undefined);
  });
});

test('base params win on conflicts with extraParams', () => {
  withEnv({ OPENAI_API_KEY: 'env-key' }, () => {
    const cfg = resolveProvider({ llmProvider: 'openai' });
    // Caller explicitly overrides reasoning_effort — base wins.
    const merged = mergeCompletionParams(
      { model: cfg.model, reasoning_effort: 'high' },
      cfg,
    );
    assert.equal((merged as any).reasoning_effort, 'high');
  });
});

// ── reporting ─────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;

for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  const detail = r.passed ? '' : ` — ${r.message}`;
  console.log(`${icon} ${r.name}${detail}`);
}

console.log(`\n${passed}/${results.length} passed, ${failed} failed`);

// Restore env for clean shutdown
process.env.DEEPSEEK_API_KEY = ORIGINAL_DEEPSEEK;
process.env.OPENAI_API_KEY = ORIGINAL_OPENAI;

process.exit(failed === 0 ? 0 : 1);
