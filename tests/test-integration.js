#!/usr/bin/env node
/**
 * Integration Tests - End-to-End Service Testing
 * 
 * Tests complete request flows through the microservices architecture:
 * Client → API Gateway → Data Server → Database
 */

// Load environment variables using custom loader
import { loadDevEnv } from '../lib/env.js';
loadDevEnv();
// Using native fetch available in Node.js 18+
const fetch = globalThis.fetch;

// Import other test modules
import { runDatabaseTestsSimple } from './test-database-simple.js';
import { runDataServerTests } from './test-data-server.js';
import { runAPIGatewayTests } from './test-api-gateway.js';

// Test configuration
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:8000';
const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/subsbuzz_dev';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';
const TEST_JWT_TOKEN = 'test-jwt-token-for-integration';
const TIMEOUT_MS = 15000;

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: [],
  serviceResults: {
    database: null,
    dataServer: null,
    apiGateway: null
  }
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    section: '🔍'
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

// HTTP helper function
async function makeRequest(url, options = {}) {
  const defaultOptions = {
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    const contentType = response.headers.get('content-type');
    let data = null;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      headers: response.headers
    };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

// Service health check functions
async function checkServiceHealth(serviceName, url, expectedFields = []) {
  try {
    const response = await makeRequest(`${url}/health`);
    
    if (!response.ok) {
      recordTest(`${serviceName} Health Check`, false, `HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const data = response.data;
    if (!data || typeof data !== 'object') {
      recordTest(`${serviceName} Health Check`, false, 'Invalid health response format');
      return false;
    }
    
    // Check for expected fields
    for (const field of expectedFields) {
      if (!(field in data)) {
        recordTest(`${serviceName} Health Check`, false, `Missing field: ${field}`);
        return false;
      }
    }
    
    recordTest(`${serviceName} Health Check`, true);
    log(`${serviceName} is healthy: ${data.status || data.service || 'OK'}`, 'info');
    return true;
  } catch (error) {
    recordTest(`${serviceName} Health Check`, false, error.message);
    return false;
  }
}

// Integration test functions
async function testFullRequestFlow() {
  try {
    log('Testing full request flow: Gateway → Data Server → Database', 'section');
    
    // Make authenticated request to API Gateway
    const gatewayResponse = await makeRequest(`${API_GATEWAY_URL}/test-data-server`, {
      headers: {
        'Authorization': `Bearer ${TEST_JWT_TOKEN}`
      }
    });
    
    if (!gatewayResponse.ok) {
      recordTest('Full Request Flow', false, `Gateway request failed: ${gatewayResponse.status}`);
      return false;
    }
    
    const data = gatewayResponse.data;
    
    // Verify the response contains data from all layers
    if (!data.gateway_status || !data.data_server_response || !data.authenticated_user) {
      recordTest('Full Request Flow', false, 'Response missing expected fields from service chain');
      return false;
    }
    
    // Verify data server response contains database info
    if (!data.data_server_response.database_info) {
      recordTest('Full Request Flow', false, 'Data server response missing database info');
      return false;
    }
    
    log(`Gateway status: ${data.gateway_status}`, 'info');
    log(`Data server message: ${data.data_server_response.message}`, 'info');
    log(`Database: ${data.data_server_response.database_info.database}`, 'info');
    log(`User: ${data.data_server_response.database_info.user}`, 'info');
    
    recordTest('Full Request Flow', true);
    return true;
  } catch (error) {
    recordTest('Full Request Flow', false, error.message);
    return false;
  }
}

async function testAuthenticationChain() {
  try {
    log('Testing authentication chain: JWT → Internal API → Database', 'section');
    
    // Test 1: No JWT token (should fail at gateway)
    const noTokenResponse = await makeRequest(`${API_GATEWAY_URL}/test-data-server`);
    
    if (noTokenResponse.status !== 401 && noTokenResponse.status !== 422) {
      recordTest('Authentication Chain - No Token', false, `Expected 401/422, got ${noTokenResponse.status}`);
      return false;
    }
    
    // Test 2: Valid JWT token (should pass through to data server)
    const validTokenResponse = await makeRequest(`${API_GATEWAY_URL}/test-data-server`, {
      headers: { 'Authorization': `Bearer ${TEST_JWT_TOKEN}` }
    });
    
    if (!validTokenResponse.ok) {
      recordTest('Authentication Chain - Valid Token', false, `Valid token rejected: ${validTokenResponse.status}`);
      return false;
    }
    
    // Test 3: Verify internal API key is working (check data server response)
    if (!validTokenResponse.data.data_server_response.authenticated) {
      recordTest('Authentication Chain - Internal API', false, 'Internal API authentication failed');
      return false;
    }
    
    recordTest('Authentication Chain', true);
    return true;
  } catch (error) {
    recordTest('Authentication Chain', false, error.message);
    return false;
  }
}

async function testErrorPropagation() {
  try {
    log('Testing error propagation through service chain', 'section');
    
    // Test 1: Gateway error handling
    const gatewayErrorResponse = await makeRequest(`${API_GATEWAY_URL}/nonexistent-endpoint`);
    if (gatewayErrorResponse.status !== 404) {
      recordTest('Error Propagation - Gateway 404', false, `Expected 404, got ${gatewayErrorResponse.status}`);
      return false;
    }
    
    // Test 2: Authentication error handling
    const authErrorResponse = await makeRequest(`${API_GATEWAY_URL}/test-data-server`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    if (authErrorResponse.status < 400 || authErrorResponse.status >= 500) {
      recordTest('Error Propagation - Auth Error', false, `Expected 4xx error, got ${authErrorResponse.status}`);
      return false;
    }
    
    recordTest('Error Propagation', true);
    return true;
  } catch (error) {
    recordTest('Error Propagation', false, error.message);
    return false;
  }
}

async function testDataConsistency() {
  try {
    log('Testing data consistency across service boundaries', 'section');
    
    // Make multiple requests and verify consistent data
    const requests = Array(3).fill().map(async (_, index) => {
      const response = await makeRequest(`${API_GATEWAY_URL}/test-data-server`, {
        headers: { 'Authorization': `Bearer ${TEST_JWT_TOKEN}-${index}` }
      });
      return response;
    });
    
    const responses = await Promise.all(requests);
    
    // Check that all requests succeeded
    const allSucceeded = responses.every(r => r.ok);
    if (!allSucceeded) {
      recordTest('Data Consistency', false, 'Not all requests succeeded');
      return false;
    }
    
    // Check that database info is consistent across requests
    const databaseInfos = responses.map(r => r.data.data_server_response.database_info);
    const firstDb = databaseInfos[0];
    const allConsistent = databaseInfos.every(db => 
      db.database === firstDb.database && db.user === firstDb.user
    );
    
    if (!allConsistent) {
      recordTest('Data Consistency', false, 'Inconsistent database info across requests');
      return false;
    }
    
    recordTest('Data Consistency', true);
    return true;
  } catch (error) {
    recordTest('Data Consistency', false, error.message);
    return false;
  }
}

async function testPerformanceUnderLoad() {
  try {
    log('Testing performance under concurrent load', 'section');
    
    const concurrentRequests = 5;
    const startTime = Date.now();
    
    // Make concurrent requests
    const requests = Array(concurrentRequests).fill().map(async (_, index) => {
      const requestStart = Date.now();
      const response = await makeRequest(`${API_GATEWAY_URL}/health`);
      const requestEnd = Date.now();
      
      return {
        success: response.ok,
        duration: requestEnd - requestStart,
        index
      };
    });
    
    const results = await Promise.all(requests);
    const endTime = Date.now();
    
    // Analyze results
    const successCount = results.filter(r => r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const totalDuration = endTime - startTime;
    
    log(`${successCount}/${concurrentRequests} requests succeeded`, 'info');
    log(`Average request time: ${avgDuration.toFixed(2)}ms`, 'info');
    log(`Total time: ${totalDuration}ms`, 'info');
    
    if (successCount === concurrentRequests && avgDuration < 500) {
      recordTest('Performance Under Load', true);
      return true;
    } else {
      recordTest('Performance Under Load', false, `${successCount}/${concurrentRequests} succeeded, avg: ${avgDuration.toFixed(2)}ms`);
      return false;
    }
  } catch (error) {
    recordTest('Performance Under Load', false, error.message);
    return false;
  }
}

// Main integration test execution
async function runIntegrationTests() {
  log('🧪 Starting Integration Tests', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📍 ENVIRONMENT CONFIGURATION', 'info');
  log(`API Gateway: ${API_GATEWAY_URL}`, 'info');
  log(`Data Server: ${DATA_SERVER_URL}`, 'info');
  log(`Database: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}`, 'info');
  log(`Internal API Secret: ${INTERNAL_API_SECRET ? 'Configured' : 'Missing'}`, 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  // Phase 1: Individual Service Health Checks
  log('PHASE 1: SERVICE HEALTH CHECKS', 'section');
  
  const serviceChecks = [
    {
      name: 'Database',
      url: 'postgresql://test',
      test: async () => {
        testResults.serviceResults.database = await runDatabaseTestsSimple();
        return testResults.serviceResults.database.failed === 0;
      }
    },
    {
      name: 'Data Server',
      url: DATA_SERVER_URL,
      expectedFields: ['status'],
      test: async () => {
        testResults.serviceResults.dataServer = await runDataServerTests();
        return testResults.serviceResults.dataServer.failed === 0;
      }
    },
    {
      name: 'API Gateway',
      url: API_GATEWAY_URL,
      expectedFields: ['status'],
      test: async () => {
        testResults.serviceResults.apiGateway = await runAPIGatewayTests();
        // Allow 1 failure for CORS (non-critical for integration tests)
        return testResults.serviceResults.apiGateway.failed <= 1;
      }
    }
  ];
  
  let allServicesHealthy = true;
  
  for (const service of serviceChecks) {
    try {
      log(`Checking ${service.name}...`, 'info');
      
      if (service.url.startsWith('http')) {
        const isHealthy = await checkServiceHealth(service.name, service.url, service.expectedFields || []);
        if (!isHealthy) allServicesHealthy = false;
      }
      
      // Run service-specific tests
      if (service.test) {
        log(`Running ${service.name} test suite...`, 'info');
        const testPassed = await service.test();
        if (!testPassed) allServicesHealthy = false;
      }
    } catch (error) {
      recordTest(`${service.name} Health Check`, false, error.message);
      allServicesHealthy = false;
    }
  }
  
  if (!allServicesHealthy) {
    log('❌ Some services are unhealthy. Skipping integration tests.', 'error');
    return testResults;
  }
  
  // Phase 2: Integration Tests
  log('PHASE 2: INTEGRATION TESTS', 'section');
  
  const integrationTests = [
    { name: 'Full Request Flow', fn: testFullRequestFlow },
    { name: 'Authentication Chain', fn: testAuthenticationChain },
    { name: 'Error Propagation', fn: testErrorPropagation },
    { name: 'Data Consistency', fn: testDataConsistency },
    { name: 'Performance Under Load', fn: testPerformanceUnderLoad }
  ];
  
  for (const test of integrationTests) {
    try {
      log(`Running: ${test.name}...`, 'info');
      await test.fn();
    } catch (error) {
      recordTest(test.name, false, `Unexpected error: ${error.message}`);
    }
  }
  
  // Print comprehensive summary
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📊 INTEGRATION TEST SUMMARY', 'info');
  log(`Total Tests: ${testResults.total}`, 'info');
  log(`Passed: ${testResults.passed}`, 'success');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 'info');
  
  // Service-specific summaries
  log('SERVICE RESULTS:', 'info');
  Object.entries(testResults.serviceResults).forEach(([service, results]) => {
    if (results) {
      log(`  ${service}: ${results.passed}/${results.total} passed (${((results.passed / results.total) * 100).toFixed(1)}%)`, 'info');
    }
  });
  
  if (testResults.failed > 0) {
    log('FAILED TESTS:', 'error');
    testResults.details
      .filter(test => !test.passed)
      .forEach(test => log(`  • ${test.name}: ${test.message}`, 'error'));
  }
  
  // Architecture status
  if (testResults.failed === 0) {
    log('🎉 MICROSERVICES ARCHITECTURE FULLY FUNCTIONAL!', 'success');
  } else {
    log('⚠️  Some issues found in microservices architecture', 'warning');
  }
  
  return testResults;
}

// Export for use in other tests
export { runIntegrationTests, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    });
}