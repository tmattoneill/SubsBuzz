#!/usr/bin/env node
/**
 * Simple Database Test - Direct PostgreSQL Connection
 */

// No additional imports needed - using only Node.js built-ins

// Test configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/subsbuzz_dev';

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

// Test PostgreSQL via psql command
async function testPostgreSQLConnection() {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    log('Testing PostgreSQL connection via psql...', 'info');
    
    // Extract connection parts from URL
    const url = new URL(DATABASE_URL);
    const host = url.hostname || 'localhost';
    const port = url.port || '5432';
    const database = url.pathname.substring(1);
    const username = url.username || 'postgres';
    
    const command = `psql -h ${host} -p ${port} -U ${username} -d ${database} -c "SELECT 1 as test, current_timestamp as time;"`;
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, PGPASSWORD: url.password || '' }
    });
    
    if (stdout.includes('test') && stdout.includes('1')) {
      recordTest('PostgreSQL Connection', true);
      log(`Connected to database: ${database}@${host}:${port}`, 'info');
      return true;
    } else {
      recordTest('PostgreSQL Connection', false, `Unexpected output: ${stdout}`);
      return false;
    }
  } catch (error) {
    recordTest('PostgreSQL Connection', false, error.message);
    return false;
  }
}

// Test PostgreSQL service is running
async function testPostgreSQLService() {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    log('Checking if PostgreSQL service is running...', 'info');
    
    const { stdout } = await execAsync('brew services list | grep postgresql || pgrep postgres || echo "not_found"');
    
    if (stdout.includes('started') || stdout.match(/\d+/)) {
      recordTest('PostgreSQL Service', true);
      log('PostgreSQL service is running', 'info');
      return true;
    } else {
      recordTest('PostgreSQL Service', false, 'PostgreSQL service not detected');
      return false;
    }
  } catch (error) {
    recordTest('PostgreSQL Service', false, error.message);
    return false;
  }
}

// Main test execution
async function runDatabaseTests() {
  log('🧪 Starting Simple Database Tests', 'info');
  log(`📍 Database URL: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}`, 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const tests = [
    { name: 'PostgreSQL Service', fn: testPostgreSQLService },
    { name: 'PostgreSQL Connection', fn: testPostgreSQLConnection }
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
export { runDatabaseTests as runDatabaseTestsSimple, testResults };

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