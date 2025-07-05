// Simple test to verify database connection works
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/subsbuzz_dev';

console.log('🔌 Testing database connection...');
console.log('📍 Database URL:', DATABASE_URL.replace(/\/\/.*@/, '//***@'));

try {
  // Create postgres client
  const client = postgres(DATABASE_URL, {
    max: 1, // Single connection for test
    transform: {
      undefined: null,
    }
  });

  // Create Drizzle instance
  const db = drizzle(client);

  // Test query
  const result = await db.execute('SELECT 1 as test, current_timestamp as time');
  
  console.log('✅ Database connection successful!');
  console.log('📊 Query result:', result[0]);
  
  // Clean shutdown
  await client.end();
  console.log('🔌 Connection closed');
  
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
}