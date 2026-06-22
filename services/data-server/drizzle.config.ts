import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables
config();

// drizzle-kit migrations need session-level features that Neon's PgBouncer pooler
// (the `-pooler` host) does not support — running db:migrate against the pooler can
// fail or behave oddly (see NEON_MIGRATION_PLAN.md). Runtime services use the pooler
// (DATABASE_URL); migrations must use the DIRECT host. Prefer an explicit
// DATABASE_DIRECT_URL; otherwise derive it by stripping `-pooler` from DATABASE_URL.
const runtimeUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/subsbuzz_dev';
const migrationUrl = process.env.DATABASE_DIRECT_URL || runtimeUrl.replace('-pooler', '');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: migrationUrl,
  },
  verbose: true,
  strict: true,
});