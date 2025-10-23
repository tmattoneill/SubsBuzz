#!/usr/bin/env node
/**
 * API Gateway Tests - Authentication and Proxy Testing
 * 
 * Tests the API Gateway HTTP endpoints, JWT authentication, and service proxying
 */

// Load environment variables using custom loader
import { loadDevEnv } from '../lib/env.js';
loadDevEnv();
// Using native fetch available in Node.js 18+
const fetch = globalThis.fetch;

// Test configuration
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:8000';
const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const TEST_JWT_TOKEN = 'test-jwt-token-for-development';
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
  const url = `${API_GATEWAY_URL}${endpoint}`;
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
async function testAPIGatewayStarted() {
  try {
    const response = await makeRequest('/');
    
    if (response.ok && response.data && response.data.service) {
      recordTest('API Gateway Started', true);
      log(`Service: ${response.data.service}`, 'info');
      log(`Version: ${response.data.version || 'unknown'}`, 'info');
      log(`Data Server URL: ${response.data.data_server_url || 'unknown'}`, 'info');
      return true;
    } else {
      recordTest('API Gateway Started', false, `Unexpected response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    recordTest('API Gateway Started', false, error.message);
    return false;
  }
}

async function testHealthEndpoint() {
  try {
    const response = await makeRequest('/health');
    
    if (response.ok && response.data && response.data.status === 'healthy') {
      recordTest('Health Endpoint', true);
      log(`Service: ${response.data.service}`, 'info');
      log(`Data Server: ${response.data.data_server || 'unknown'}`, 'info');
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

async function testAuthenticationRequired() {
  try {
    // Test accessing protected endpoint without token (should fail)
    const unauthorizedResponse = await makeRequest('/test-data-server');
    
    if (unauthorizedResponse.status === 401 || unauthorizedResponse.status === 422) {
      recordTest('Authentication Required', true);
      log(`Correctly rejected unauthorized request: ${unauthorizedResponse.status}`, 'info');
      return true;
    } else {
      recordTest('Authentication Required', false, `Should reject requests without auth token, got ${unauthorizedResponse.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Authentication Required', false, error.message);
    return false;
  }
}

async function testJWTAuthentication() {
  try {
    // Test with Bearer token
    const authorizedResponse = await makeRequest('/test-data-server', {
      headers: {
        'Authorization': `Bearer ${TEST_JWT_TOKEN}`
      }
    });
    
    if (authorizedResponse.ok && authorizedResponse.data) {
      recordTest('JWT Authentication', true);
      log(`Authenticated request successful`, 'info');
      log(`Gateway status: ${authorizedResponse.data.gateway_status || 'unknown'}`, 'info');
      return true;
    } else {
      recordTest('JWT Authentication', false, `Authorized request failed: ${authorizedResponse.status} - ${JSON.stringify(authorizedResponse.data)}`);
      return false;
    }
  } catch (error) {
    recordTest('JWT Authentication', false, error.message);
    return false;
  }
}

async function testServiceProxying() {
  try {
    const headers = { 'Authorization': `Bearer ${TEST_JWT_TOKEN}` };
    
    // Test the proxy endpoint that calls data server
    const proxyResponse = await makeRequest('/test-data-server', { headers });
    
    if (!proxyResponse.ok) {
      recordTest('Service Proxying', false, `Proxy request failed: ${proxyResponse.status}`);
      return false;
    }
    
    const data = proxyResponse.data;
    
    // Check if we got a response that includes data server info
    if (!data.data_server_response || !data.gateway_status) {
      recordTest('Service Proxying', false, 'Proxy response missing expected fields');
      return false;
    }
    
    log(`Gateway status: ${data.gateway_status}`, 'info');
    log(`Data server response: ${JSON.stringify(data.data_server_response)}`, 'info');
    
    recordTest('Service Proxying', true);
    return true;
  } catch (error) {
    recordTest('Service Proxying', false, error.message);
    return false;
  }
}

async function testCORSHeaders() {
  try {
    // Test CORS preflight
    const corsResponse = await makeRequest('/', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
      }
    });
    
    // Check for CORS headers
    const allowOrigin = corsResponse.headers.get('Access-Control-Allow-Origin');
    const allowMethods = corsResponse.headers.get('Access-Control-Allow-Methods');
    
    if (allowOrigin || allowMethods || corsResponse.status === 200) {
      recordTest('CORS Headers', true);
      log(`CORS headers present or endpoint accessible`, 'info');
      return true;
    } else {
      recordTest('CORS Headers', false, 'No CORS headers found');
      return false;
    }
  } catch (error) {
    recordTest('CORS Headers', false, error.message);
    return false;
  }
}

async function testResponseFormat() {
  try {
    const headers = { 'Authorization': `Bearer ${TEST_JWT_TOKEN}` };
    
    // Test JSON response format
    const response = await makeRequest('/test-data-server', { headers });
    
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

async function testErrorHandling() {
  try {
    // Test 404 endpoint
    const notFoundResponse = await makeRequest('/nonexistent-endpoint');
    
    if (notFoundResponse.status === 404) {
      recordTest('Error Handling - 404', true);
    } else {
      recordTest('Error Handling - 404', false, `Expected 404, got ${notFoundResponse.status}`);
    }
    
    // Test malformed auth header
    const badAuthResponse = await makeRequest('/test-data-server', {
      headers: { 'Authorization': 'InvalidTokenFormat' }
    });
    
    if (badAuthResponse.status >= 400 && badAuthResponse.status < 500) {
      recordTest('Error Handling - Bad Auth', true);
      return true;
    } else {
      recordTest('Error Handling - Bad Auth', false, `Expected 4xx error, got ${badAuthResponse.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Error Handling', false, error.message);
    return false;
  }
}

async function testPerformanceMetrics() {
  try {
    const iterations = 5;
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
    
    if (avgTime < 300) { // Less than 300ms average is reasonable for gateway
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
async function runAPIGatewayTests() {
  log('🧪 Starting API Gateway Tests', 'info');
  log(`📍 API Gateway URL: ${API_GATEWAY_URL}`, 'info');
  log(`🔗 Data Server URL: ${DATA_SERVER_URL}`, 'info');
  log(`🎫 Test Token: ${TEST_JWT_TOKEN ? 'Configured' : 'Missing'}`, 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const tests = [
    { name: 'API Gateway Started', fn: testAPIGatewayStarted },
    { name: 'Health Endpoint', fn: testHealthEndpoint },
    { name: 'Authentication Required', fn: testAuthenticationRequired },
    { name: 'JWT Authentication', fn: testJWTAuthentication },
    { name: 'Service Proxying', fn: testServiceProxying },
    { name: 'CORS Headers', fn: testCORSHeaders },
    { name: 'Response Format', fn: testResponseFormat },
    { name: 'Error Handling', fn: testErrorHandling },
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
export { runAPIGatewayTests, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAPIGatewayTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    });
}