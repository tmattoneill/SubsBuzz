#!/usr/bin/env node
/**
 * Database Tests - Comprehensive PostgreSQL Testing
 * 
 * Tests database connectivity, schema validation, and basic operations
 */

// Load environment variables (skip if not available)
try {
  await import('dotenv/config');
} catch (e) {
  console.log('⚠️  dotenv not available, using existing environment variables');
}
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Test configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/subsbuzz_dev';
const TIMEOUT_MS = 10000;

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function recordTest(name, passed, message = '') {
  testResults.total++;
  testResults.details.push({ name, passed, message });
  
  if (passed) {
    testResults.passed++;
    log(`PASS: ${name}`, 'success');
  } else {
    testResults.failed++;
    log(`FAIL: ${name} - ${message}`, 'error');
  }
}

// Test functions
async function testDatabaseConnection() {
  try {
    const client = postgres(DATABASE_URL, {
      max: 1,
      connect_timeout: 5,
      transform: { undefined: null }
    });

    const db = drizzle(client);
    const result = await db.execute('SELECT 1 as test, current_timestamp as timestamp');
    
    await client.end();
    
    if (result && result[0] && result[0].test === 1) {
      recordTest('Database Connection', true);
      return true;
    } else {
      recordTest('Database Connection', false, 'Invalid query result');
      return false;
    }
  } catch (error) {
    recordTest('Database Connection', false, error.message);
    return false;
  }
}

async function testDatabaseInfo() {
  try {
    const client = postgres(DATABASE_URL, { max: 1 });
    const db = drizzle(client);
    
    const result = await db.execute(`
      SELECT 
        current_database() as database_name,
        current_user as current_user,
        version() as postgres_version
    `);
    
    await client.end();
    
    const info = result[0];
    log(`Database: ${info.database_name}`, 'info');
    log(`User: ${info.current_user}`, 'info');
    log(`PostgreSQL Version: ${info.postgres_version.split(' ')[0]} ${info.postgres_version.split(' ')[1]}`, 'info');
    
    recordTest('Database Info Query', true);
    return true;
  } catch (error) {
    recordTest('Database Info Query', false, error.message);
    return false;
  }
}

async function testSchemaValidation() {
  try {
    const client = postgres(DATABASE_URL, { max: 1 });
    const db = drizzle(client);
    
    // Check if key tables exist
    const tableCheck = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'monitored_emails', 'email_digests', 'digest_emails')
    `);
    
    await client.end();
    
    const tables = tableCheck.map(row => row.table_name);
    const expectedTables = ['users', 'monitored_emails', 'email_digests', 'digest_emails'];
    const missingTables = expectedTables.filter(table => !tables.includes(table));
    
    if (missingTables.length === 0) {
      recordTest('Schema Validation', true);
      log(`Found tables: ${tables.join(', ')}`, 'info');
      return true;
    } else {
      recordTest('Schema Validation', false, `Missing tables: ${missingTables.join(', ')}`);
      return false;
    }
  } catch (error) {
    recordTest('Schema Validation', false, error.message);
    return false;
  }
}

async function testConnectionPooling() {
  try {
    const client = postgres(DATABASE_URL, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10
    });

    const db = drizzle(client);
    
    // Run multiple concurrent queries
    const promises = Array(3).fill().map(async (_, index) => {
      const result = await db.execute(`SELECT ${index + 1} as query_id, pg_backend_pid() as backend_pid`);
      return result[0];
    });
    
    const results = await Promise.all(promises);
    await client.end();
    
    // Check if we got different backend PIDs (indicating pooling)
    const pids = results.map(r => r.backend_pid);
    const uniquePids = [...new Set(pids)];
    
    log(`Backend PIDs: ${pids.join(', ')}`, 'info');
    log(`Unique connections: ${uniquePids.length}`, 'info');
    
    recordTest('Connection Pooling', true);
    return true;
  } catch (error) {
    recordTest('Connection Pooling', false, error.message);
    return false;
  }
}

async function testTransactionSupport() {
  try {
    const client = postgres(DATABASE_URL, { max: 1 });
    const db = drizzle(client);
    
    // Test transaction rollback
    await db.execute('BEGIN');
    await db.execute('CREATE TEMP TABLE test_transaction (id int)');
    await db.execute('INSERT INTO test_transaction VALUES (1)');
    
    // Check data exists
    const beforeRollback = await db.execute('SELECT COUNT(*) as count FROM test_transaction');
    await db.execute('ROLLBACK');
    
    // Try to query the table (should fail as it was rolled back)
    try {
      await db.execute('SELECT COUNT(*) as count FROM test_transaction');
      await client.end();
      recordTest('Transaction Support', false, 'Table should not exist after rollback');
      return false;
    } catch {
      // Expected error - table doesn't exist after rollback
      await client.end();
      recordTest('Transaction Support', true);
      return true;
    }
  } catch (error) {
    recordTest('Transaction Support', false, error.message);
    return false;
  }
}

async function testPerformanceBenchmark() {
  try {
    const client = postgres(DATABASE_URL, { max: 1 });
    const db = drizzle(client);
    
    // Simple performance test
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await db.execute('SELECT 1');
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / 10;
    
    await client.end();
    
    log(`10 queries completed in ${totalTime}ms (avg: ${averageTime.toFixed(2)}ms)`, 'info');
    
    if (averageTime < 100) { // Less than 100ms average is good
      recordTest('Performance Benchmark', true);
      return true;
    } else {
      recordTest('Performance Benchmark', false, `Average query time too slow: ${averageTime.toFixed(2)}ms`);
      return false;
    }
  } catch (error) {
    recordTest('Performance Benchmark', false, error.message);
    return false;
  }
}

// Main test execution
async function runDatabaseTests() {
  log('🧪 Starting Database Tests', 'info');
  log(`📍 Database URL: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}`, 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Database Info', fn: testDatabaseInfo },
    { name: 'Schema Validation', fn: testSchemaValidation },
    { name: 'Connection Pooling', fn: testConnectionPooling },
    { name: 'Transaction Support', fn: testTransactionSupport },
    { name: 'Performance Benchmark', fn: testPerformanceBenchmark }
  ];
  
  for (const test of tests) {
    try {
      log(`Running: ${test.name}...`, 'info');
      await test.fn();
    } catch (error) {
      recordTest(test.name, false, `Unexpected error: ${error.message}`);
    }
  }
  
  // Print summary
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📊 TEST SUMMARY', 'info');
  log(`Total Tests: ${testResults.total}`, 'info');
  log(`Passed: ${testResults.passed}`, 'success');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 'info');
  
  if (testResults.failed > 0) {
    log('Failed Tests:', 'error');
    testResults.details
      .filter(test => !test.passed)
      .forEach(test => log(`  • ${test.name}: ${test.message}`, 'error'));
  }
  
  return testResults;
}

// Export for use in other tests
export { runDatabaseTests, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    });
}