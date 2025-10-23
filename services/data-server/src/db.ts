/**
 * Database Connection - Drizzle ORM Setup
 * 
 * Handles PostgreSQL connection for the data server
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema.js';

let db: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize database connection
 */
export function initializeDatabase(): ReturnType<typeof drizzle> {
  if (db) {
    return db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('🔌 Connecting to PostgreSQL database...');

  try {
    // Create postgres client
    const client = postgres(databaseUrl, {
      max: 10, // Maximum connections in pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
      transform: {
        undefined: null, // Transform undefined to null for PostgreSQL
      },
      onnotice: (notice) => {
        console.log('PostgreSQL Notice:', notice);
      }
    });

    // Create Drizzle instance
    db = drizzle(client, { 
      schema,
      logger: process.env.NODE_ENV === 'development' 
    });

    console.log('✅ Database connection established');
    return db;

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Get database instance (creates if not exists)
 */
export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const database = getDatabase();
    
    // Simple query to test connection using sql from drizzle-orm
    const result = await database.execute('SELECT 1 as test');
    
    console.log('✅ Database connection test passed');
    return true;

  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

/**
 * Close database connection
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (db) {
    try {
      // Get the underlying client
      const client = (db as any).client;
      if (client && typeof client.end === 'function') {
        await client.end();
      }
      
      db = null;
      console.log('🔌 Database connection closed');
      
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing database connection...');
  await closeDatabaseConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing database connection...');
  await closeDatabaseConnection();
  process.exit(0);
});

// Export the database instance
export { db };

// Initialize database connection immediately
export default getDatabase();