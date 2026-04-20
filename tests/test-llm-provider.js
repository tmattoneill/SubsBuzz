#!/usr/bin/env node
/**
 * LLM Provider Tests (TEEPER-149) — wrapper that spawns the actual unit-test
 * file at services/data-server/src/services/llm/provider.test.ts under tsx,
 * parses the `N/M passed` summary line, and returns the shape expected by
 * tests/run-tests.js. Kept as a wrapper so the unit tests themselves live next
 * to the code they test (and can be run standalone with `npm run test:unit`).
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_SERVER_DIR = path.resolve(__dirname, '../services/data-server');

export async function runLlmProviderTests() {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/services/llm/provider.test.ts'], {
      cwd: DATA_SERVER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      // Parse each "✅ name" / "❌ name — reason" line into test details.
      const details = [];
      for (const line of stdout.split('\n')) {
        const passMatch = line.match(/^✅\s+(.+)$/);
        const failMatch = line.match(/^❌\s+(.+?)(?:\s+—\s+(.+))?$/);
        if (passMatch) {
          details.push({ name: passMatch[1].trim(), passed: true });
        } else if (failMatch) {
          details.push({
            name: failMatch[1].trim(),
            passed: false,
            message: failMatch[2] ?? 'assertion failed',
          });
        }
      }

      const summary = stdout.match(/(\d+)\/(\d+)\s+passed,\s+(\d+)\s+failed/);
      const total = summary ? parseInt(summary[2], 10) : details.length;
      const passed = summary ? parseInt(summary[1], 10) : details.filter(d => d.passed).length;
      const failed = summary ? parseInt(summary[3], 10) : (total - passed);

      if (code !== 0 && details.length === 0) {
        // The subprocess crashed before producing test output — surface stderr.
        details.push({
          name: 'Provider test runner',
          passed: false,
          message: stderr.trim() || `Exited with code ${code}`,
        });
      }

      resolve({
        passed,
        failed,
        total: total || details.length,
        details,
      });
    });
  });
}

// Command-line execution — mirrors the other tests/test-*.js files.
if (import.meta.url === `file://${process.argv[1]}`) {
  runLlmProviderTests().then((results) => {
    console.log(`\nLLM Provider: ${results.passed}/${results.total} passed`);
    process.exit(results.failed === 0 ? 0 : 1);
  });
}
