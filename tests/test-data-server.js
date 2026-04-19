#!/usr/bin/env node
/**
 * Data Server Tests - API Endpoint and Service Testing
 * 
 * Tests the Data Server HTTP endpoints, authentication, and database operations
 */

// Load env vars from .env.local / .env.dev so module-level reads below
// (INTERNAL_API_SECRET, DATA_SERVER_URL) pick up the real values whether this
// file is run standalone or through run-tests.js.
import './load-env.js';
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
  const mergedOptions = {
    timeout: TIMEOUT_MS,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, mergedOptions);
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

// ─── Email categories (TEEPER-105) ──────────────────────────────────────────
// Covers lazy seeding, slug immutability, cross-user isolation, and
// ON DELETE SET NULL propagation to monitored_emails.

// Data-server routes all wrap responses as { success, data }. Extract payload.
function payload(res) {
  if (res && res.data && typeof res.data === 'object' && 'data' in res.data) return res.data.data;
  return res?.data;
}

async function testCategoriesLazySeed() {
  const headers = { 'x-internal-api-key': INTERNAL_API_SECRET };
  const userId = `test-cat-seed-${Date.now()}`;
  try {
    const r1 = await makeRequest(`/api/storage/email-categories/${userId}`, { headers });
    const list1 = payload(r1);
    if (!r1.ok || !Array.isArray(list1) || list1.length !== 10) {
      recordTest('Categories: lazy seed returns 10 defaults', false,
        `Got ${r1.status}, length=${Array.isArray(list1) ? list1.length : 'n/a'}`);
      return;
    }
    recordTest('Categories: lazy seed returns 10 defaults', true);

    const r2 = await makeRequest(`/api/storage/email-categories/${userId}`, { headers });
    const list2 = payload(r2);
    if (r2.ok && Array.isArray(list2) && list2.length === 10) {
      recordTest('Categories: seed is idempotent', true);
    } else {
      recordTest('Categories: seed is idempotent', false,
        `Second call returned length=${list2?.length}`);
    }
  } catch (error) {
    recordTest('Categories: lazy seed', false, error.message);
  }
}

async function testCategoriesSlugImmutable() {
  const headers = { 'x-internal-api-key': INTERNAL_API_SECRET };
  const userId = `test-cat-slug-${Date.now()}`;
  try {
    // seed first
    await makeRequest(`/api/storage/email-categories/${userId}`, { headers });

    const createRes = await makeRequest('/api/storage/email-categories', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, name: 'Indie Zines' }),
    });
    const created = payload(createRes);
    if (!createRes.ok || !created?.id) {
      recordTest('Categories: slug immutable on rename', false,
        `Create failed: ${createRes.status}`);
      return;
    }
    const originalSlug = created.slug;

    const patchRes = await makeRequest(`/api/storage/email-categories/${created.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ userId, name: 'Zines' }),
    });
    const patched = payload(patchRes);
    if (patchRes.ok && patched?.name === 'Zines' && patched.slug === originalSlug) {
      recordTest('Categories: slug immutable on rename', true);
    } else {
      recordTest('Categories: slug immutable on rename', false,
        `name=${patched?.name} slug=${patched?.slug} (expected slug=${originalSlug})`);
    }
  } catch (error) {
    recordTest('Categories: slug immutable on rename', false, error.message);
  }
}

async function testCategoriesDuplicateName() {
  const headers = { 'x-internal-api-key': INTERNAL_API_SECRET };
  const userId = `test-cat-dup-${Date.now()}`;
  try {
    await makeRequest(`/api/storage/email-categories/${userId}`, { headers });
    const name = `Dup ${Date.now()}`;
    const a = await makeRequest('/api/storage/email-categories', {
      method: 'POST', headers, body: JSON.stringify({ userId, name }),
    });
    const b = await makeRequest('/api/storage/email-categories', {
      method: 'POST', headers, body: JSON.stringify({ userId, name }),
    });
    if (a.ok && b.status === 409) {
      recordTest('Categories: duplicate name returns 409', true);
    } else {
      recordTest('Categories: duplicate name returns 409', false,
        `a=${a.status} b=${b.status}`);
    }
  } catch (error) {
    recordTest('Categories: duplicate name returns 409', false, error.message);
  }
}

async function testCategoriesCrossUserIsolation() {
  const headers = { 'x-internal-api-key': INTERNAL_API_SECRET };
  const userA = `test-cat-isoA-${Date.now()}`;
  const userB = `test-cat-isoB-${Date.now()}`;
  try {
    await makeRequest(`/api/storage/email-categories/${userA}`, { headers });
    const createRes = await makeRequest('/api/storage/email-categories', {
      method: 'POST', headers,
      body: JSON.stringify({ userId: userA, name: `A-only ${Date.now()}` }),
    });
    const created = payload(createRes);
    if (!createRes.ok || !created?.id) {
      recordTest('Categories: cross-user isolation', false, `seed failed ${createRes.status}`);
      return;
    }

    // User B tries to PATCH user A's category. Route scopes by userId in body
    // → should 404 (not found for user B).
    const crossPatch = await makeRequest(`/api/storage/email-categories/${created.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ userId: userB, name: 'hijacked' }),
    });
    if (crossPatch.status === 404) {
      recordTest('Categories: cross-user PATCH is 404', true);
    } else {
      recordTest('Categories: cross-user PATCH is 404', false, `status=${crossPatch.status}`);
    }

    // User B cannot assign user A's category when creating a monitored email.
    const crossAssign = await makeRequest('/api/storage/monitored-emails', {
      method: 'POST', headers,
      body: JSON.stringify({
        userId: userB,
        email: `iso-${Date.now()}@test.dev`,
        active: true,
        categoryId: created.id,
      }),
    });
    if (crossAssign.status >= 400 && crossAssign.status < 500) {
      recordTest('Categories: cross-user monitored-email assign is rejected', true);
    } else {
      recordTest('Categories: cross-user monitored-email assign is rejected', false,
        `status=${crossAssign.status}`);
    }
  } catch (error) {
    recordTest('Categories: cross-user isolation', false, error.message);
  }
}

async function testCategoryDeleteSetsNull() {
  const headers = { 'x-internal-api-key': INTERNAL_API_SECRET };
  const userId = `test-cat-del-${Date.now()}`;
  try {
    await makeRequest(`/api/storage/email-categories/${userId}`, { headers });
    const catRes = await makeRequest('/api/storage/email-categories', {
      method: 'POST', headers,
      body: JSON.stringify({ userId, name: `Ephemeral ${Date.now()}` }),
    });
    const cat = payload(catRes);
    if (!catRes.ok || !cat?.id) {
      recordTest('Categories: delete sets monitored_emails.category_id NULL', false,
        `seed ${catRes.status}`);
      return;
    }
    const senderRes = await makeRequest('/api/storage/monitored-emails', {
      method: 'POST', headers,
      body: JSON.stringify({
        userId, email: `del-${Date.now()}@test.dev`, active: true, categoryId: cat.id,
      }),
    });
    const sender = payload(senderRes);
    if (!senderRes.ok || !sender?.id) {
      recordTest('Categories: delete sets monitored_emails.category_id NULL', false,
        `sender create ${senderRes.status}`);
      return;
    }

    const del = await makeRequest(`/api/storage/email-categories/${cat.id}`, {
      method: 'DELETE', headers,
      body: JSON.stringify({ userId }),
    });
    if (!del.ok) {
      recordTest('Categories: delete sets monitored_emails.category_id NULL', false,
        `delete ${del.status}`);
      return;
    }

    const listRes = await makeRequest(`/api/storage/monitored-emails/${userId}`, { headers });
    const list = payload(listRes);
    const row = Array.isArray(list) ? list.find((s) => s.id === sender.id) : null;
    if (row && row.categoryId == null) {
      recordTest('Categories: delete sets monitored_emails.category_id NULL', true);
    } else {
      recordTest('Categories: delete sets monitored_emails.category_id NULL', false,
        `row=${JSON.stringify(row)}`);
    }
  } catch (error) {
    recordTest('Categories: delete sets monitored_emails.category_id NULL', false, error.message);
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
    { name: 'Categories: lazy seed', fn: testCategoriesLazySeed },
    { name: 'Categories: slug immutable', fn: testCategoriesSlugImmutable },
    { name: 'Categories: duplicate name', fn: testCategoriesDuplicateName },
    { name: 'Categories: cross-user isolation', fn: testCategoriesCrossUserIsolation },
    { name: 'Categories: delete sets NULL', fn: testCategoryDeleteSetsNull },
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