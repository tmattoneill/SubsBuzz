#!/usr/bin/env node
/**
 * Data Server Tests - API Endpoint and Service Testing
 * 
 * Tests the Data Server HTTP endpoints, authentication, and database operations
 */

// Env vars are loaded by tests/run-tests.js when run via `npm test`.
// When run individually, the defaults below apply.
// Using native fetch available in Node.js 18+
const fetch = globalThis.fetch;

// Test configuration
const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';
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

// HTTP helper function
async function makeRequest(endpoint, options = {}) {
  const url = `${DATA_SERVER_URL}${endpoint}`;
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

// Test functions
async function testDataServerStarted() {
  try {
    const response = await makeRequest('/');
    
    if (response.ok && response.data && response.data.service) {
      recordTest('Data Server Started', true);
      log(`Service: ${response.data.service}`, 'info');
      log(`Version: ${response.data.version || 'unknown'}`, 'info');
      return true;
    } else {
      recordTest('Data Server Started', false, `Unexpected response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    recordTest('Data Server Started', false, error.message);
    return false;
  }
}

async function testHealthEndpoint() {
  try {
    const response = await makeRequest('/health');
    
    if (response.ok && response.data && response.data.status === 'healthy') {
      recordTest('Health Endpoint', true);
      log(`Database: ${response.data.database || 'unknown'}`, 'info');
      return true;
    } else {
      recordTest('Health Endpoint', false, `Health check failed: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    recordTest('Health Endpoint', false, error.message);
    return false;
  }
}

async function testInternalAPIAuthentication() {
  try {
    // Test without API key (should fail with 401)
    const unauthorizedResponse = await makeRequest('/api/storage/monitored-emails/test-user');

    if (unauthorizedResponse.status !== 401) {
      recordTest('Internal API Authentication', false, `Should reject without API key, got ${unauthorizedResponse.status}`);
      return false;
    }

    // Test with correct API key (should succeed — empty list is fine)
    const authorizedResponse = await makeRequest('/api/storage/monitored-emails/test-user', {
      headers: {
        'x-internal-api-key': INTERNAL_API_SECRET
      }
    });

    if (authorizedResponse.ok) {
      recordTest('Internal API Authentication', true);
      log(`Authenticated request successful`, 'info');
      return true;
    } else {
      recordTest('Internal API Authentication', false, `Authorized request failed: ${authorizedResponse.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Internal API Authentication', false, error.message);
    return false;
  }
}

async function testAPIEndpointResponses() {
  try {
    const headers = { 'x-internal-api-key': INTERNAL_API_SECRET };

    // Test a real storage endpoint — returns a list (possibly empty) for the user
    const response = await makeRequest('/api/storage/monitored-emails/test-user', { headers });

    if (!response.ok) {
      recordTest('API Endpoint Responses', false, `Storage endpoint failed: ${response.status}`);
      return false;
    }

    // Response should be JSON (array or object)
    const data = response.data;
    if (typeof data !== 'object' || data === null) {
      recordTest('API Endpoint Responses', false, 'Response is not a valid JSON object/array');
      return false;
    }

    log(`Storage endpoint returned: ${Array.isArray(data) ? data.length + ' items' : typeof data}`, 'info');

    recordTest('API Endpoint Responses', true);
    return true;
  } catch (error) {
    recordTest('API Endpoint Responses', false, error.message);
    return false;
  }
}

async function testErrorHandling() {
  try {
    // Test 404 endpoint
    const notFoundResponse = await makeRequest('/api/nonexistent');
    
    if (notFoundResponse.status === 404 || notFoundResponse.status === 401) {
      // Either is acceptable - 401 if auth middleware catches it first
      recordTest('Error Handling - 404', true);
    } else {
      recordTest('Error Handling - 404', false, `Expected 404 or 401, got ${notFoundResponse.status}`);
    }
    
    // Test malformed request against a real endpoint
    const badRequestResponse = await makeRequest('/api/storage/monitored-emails', {
      method: 'POST',
      headers: { 'x-internal-api-key': INTERNAL_API_SECRET },
      body: 'invalid json'
    });
    
    // Should handle bad JSON gracefully
    if (badRequestResponse.status >= 400 && badRequestResponse.status < 500) {
      recordTest('Error Handling - Bad Request', true);
      return true;
    } else {
      recordTest('Error Handling - Bad Request', false, `Expected 4xx error, got ${badRequestResponse.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Error Handling', false, error.message);
    return false;
  }
}

async function testResponseFormat() {
  try {
    // Test JSON response format against health endpoint (no auth needed)
    const response = await makeRequest('/health');

    if (!response.ok) {
      recordTest('Response Format', false, `Request failed: ${response.status}`);
      return false;
    }
    
    // Check Content-Type header
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      recordTest('Response Format', false, `Expected JSON content-type, got: ${contentType}`);
      return false;
    }
    
    // Check if response is valid JSON with expected structure
    const data = response.data;
    if (typeof data !== 'object' || data === null) {
      recordTest('Response Format', false, 'Response is not a valid JSON object');
      return false;
    }
    
    recordTest('Response Format', true);
    return true;
  } catch (error) {
    recordTest('Response Format', false, error.message);
    return false;
  }
}

async function testPerformanceMetrics() {
  try {
    const headers = { 'x-internal-api-key': INTERNAL_API_SECRET };
    const iterations = 10;
    const times = [];
    
    log(`Running ${iterations} performance test requests...`, 'info');
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const response = await makeRequest('/health');
      const endTime = Date.now();
      
      if (response.ok) {
        times.push(endTime - startTime);
      } else {
        recordTest('Performance Metrics', false, `Request ${i + 1} failed`);
        return false;
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    log(`Average response time: ${avgTime.toFixed(2)}ms`, 'info');
    log(`Min: ${minTime}ms, Max: ${maxTime}ms`, 'info');
    
    if (avgTime < 200) { // Less than 200ms average is good
      recordTest('Performance Metrics', true);
      return true;
    } else {
      recordTest('Performance Metrics', false, `Average response time too slow: ${avgTime.toFixed(2)}ms`);
      return false;
    }
  } catch (error) {
    recordTest('Performance Metrics', false, error.message);
    return false;
  }
}

// Main test execution
async function runDataServerTests() {
  log('🧪 Starting Data Server Tests', 'info');
  log(`📍 Data Server URL: ${DATA_SERVER_URL}`, 'info');
  log(`🔑 API Secret: ${INTERNAL_API_SECRET ? 'Configured' : 'Missing'}`, 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const tests = [
    { name: 'Data Server Started', fn: testDataServerStarted },
    { name: 'Health Endpoint', fn: testHealthEndpoint },
    { name: 'Internal API Authentication', fn: testInternalAPIAuthentication },
    { name: 'API Endpoint Responses', fn: testAPIEndpointResponses },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Response Format', fn: testResponseFormat },
    { name: 'Performance Metrics', fn: testPerformanceMetrics }
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
export { runDataServerTests, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDataServerTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    });
}