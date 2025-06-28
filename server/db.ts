import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Only require DATABASE_URL if not in development mode
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'development') {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create pool and db only if DATABASE_URL is available
export const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool 
  ? drizzle({ client: pool, schema })
  : null;
