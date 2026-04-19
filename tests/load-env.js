// Side-effect-only module: load env vars into process.env before any other
// test module reads them at import time. Prefer .env.local (local Mac with
// ./start-all.sh) and fall back to .env.dev (remote dev server).
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const __envFile = existsSync(resolve(__root, '.env.local'))
  ? resolve(__root, '.env.local')
  : resolve(__root, '.env.dev');

if (existsSync(__envFile)) {
  for (const line of readFileSync(__envFile, 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawVal.replace(/^["'](.*)["']$/, '$1');
  }
}
