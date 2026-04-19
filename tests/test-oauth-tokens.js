#!/usr/bin/env node
/**
 * OAuth Token Persistence Tests - TEEPER-43
 *
 * Tests DB-backed OAuth session token storage, retrieval, refresh, and validation.
 * Covers the 30-day session token flow introduced with persistent OAuth sessions.
 *
 * Env vars are loaded automatically via ./load-env.js whether this file runs
 * standalone or through run-tests.js.
 */

import './load-env.js';
const fetch = globalThis.fetch;

const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';
const TIMEOUT_MS = 10000;

// Unique test UID to avoid colliding with real data
const TEST_UID = `test-oauth-${Date.now()}`;
const TEST_EMAIL = `oauth-test-${Date.now()}@test.example.com`;

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Shared state across tests
let storedSessionToken = null;

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = { info: '📋', success: '✅', error: '❌', warning: '⚠️' }[type] || '📋';
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

async function makeRequest(endpoint, options = {}) {
  const url = `${DATA_SERVER_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-internal-api-key': INTERNAL_API_SECRET,
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      timeout: TIMEOUT_MS,
      ...options,
      headers: defaultHeaders
    });
    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error.message };
  }
}

// ==================== TESTS ====================

async function testStoreOAuthToken() {
  log('Testing: Store OAuth token (POST /api/storage/oauth-tokens)');

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour from now
  const result = await makeRequest('/api/storage/oauth-tokens', {
    method: 'POST',
    body: JSON.stringify({
      uid: TEST_UID,
      email: TEST_EMAIL,
      accessToken: 'test-access-token-abc123',
      refreshToken: 'test-refresh-token-xyz789',
      expiresAt,
      scope: 'https://www.googleapis.com/auth/gmail.readonly'
    })
  });

  recordTest(
    'POST /oauth-tokens returns 201',
    result.status === 201,
    `Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`
  );

  recordTest(
    'POST /oauth-tokens returns token data',
    result.ok && result.data?.data?.uid === TEST_UID,
    `uid mismatch or missing: ${JSON.stringify(result.data?.data)}`
  );
}

async function testGetOAuthToken() {
  log('Testing: Get OAuth token (GET /api/storage/oauth-token/:uid)');

  const result = await makeRequest(`/api/storage/oauth-token/${TEST_UID}`);

  recordTest(
    'GET /oauth-token/:uid returns 200',
    result.status === 200,
    `Expected 200, got ${result.status}: ${JSON.stringify(result.data)}`
  );

  const token = result.data?.data;
  recordTest(
    'GET /oauth-token/:uid returns snake_case fields',
    token && 'access_token' in token && 'refresh_token' in token && 'expires_at' in token,
    `Missing snake_case fields: ${JSON.stringify(token)}`
  );

  recordTest(
    'GET /oauth-token/:uid uid matches',
    token?.uid === TEST_UID,
    `uid mismatch: expected ${TEST_UID}, got ${token?.uid}`
  );
}

async function testUpsertOAuthToken() {
  log('Testing: Upsert OAuth token (POST with same UID updates, not duplicates)');

  const newAccessToken = 'test-access-token-UPDATED';
  const result = await makeRequest('/api/storage/oauth-tokens', {
    method: 'POST',
    body: JSON.stringify({
      uid: TEST_UID,
      email: TEST_EMAIL,
      accessToken: newAccessToken,
      refreshToken: 'test-refresh-token-xyz789',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: 'https://www.googleapis.com/auth/gmail.readonly'
    })
  });

  recordTest(
    'POST /oauth-tokens upsert returns 201',
    result.status === 201,
    `Expected 201, got ${result.status}`
  );

  // Verify the token was updated (not duplicated) by re-fetching
  const getResult = await makeRequest(`/api/storage/oauth-token/${TEST_UID}`);
  recordTest(
    'Upsert updates existing token (no duplicate)',
    getResult.data?.data?.access_token === newAccessToken,
    `access_token not updated: ${getResult.data?.data?.access_token}`
  );
}

async function testPatchOAuthToken() {
  log('Testing: Patch OAuth token (PATCH /api/storage/oauth-token/:uid)');

  const patchedToken = 'test-access-token-PATCHED';
  const result = await makeRequest(`/api/storage/oauth-token/${TEST_UID}`, {
    method: 'PATCH',
    body: JSON.stringify({ accessToken: patchedToken })
  });

  recordTest(
    'PATCH /oauth-token/:uid returns 200',
    result.status === 200,
    `Expected 200, got ${result.status}: ${JSON.stringify(result.data)}`
  );

  // Verify the patch took effect
  const getResult = await makeRequest(`/api/storage/oauth-token/${TEST_UID}`);
  recordTest(
    'PATCH /oauth-token/:uid updates accessToken',
    getResult.data?.data?.access_token === patchedToken,
    `access_token not patched: ${getResult.data?.data?.access_token}`
  );
}

async function testGetExpiringTokens() {
  log('Testing: Get expiring tokens (GET /api/storage/oauth-tokens/expiring)');

  // Query for tokens expiring within the next 2 hours — our test token expires in ~1 hour
  const before = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const result = await makeRequest(`/api/storage/oauth-tokens/expiring?before=${encodeURIComponent(before)}`);

  recordTest(
    'GET /oauth-tokens/expiring returns 200',
    result.status === 200,
    `Expected 200, got ${result.status}: ${JSON.stringify(result.data)}`
  );

  const tokens = result.data?.data;
  const hasTestToken = Array.isArray(tokens) && tokens.some(t => t.uid === TEST_UID);
  recordTest(
    'GET /oauth-tokens/expiring includes test token expiring within window',
    hasTestToken,
    `Test token not found in expiring list (${tokens?.length ?? 0} tokens returned)`
  );

  // Missing 'before' param should return 400
  const badResult = await makeRequest('/api/storage/oauth-tokens/expiring');
  recordTest(
    'GET /oauth-tokens/expiring without before param returns 400',
    badResult.status === 400,
    `Expected 400, got ${badResult.status}`
  );
}

async function testCreateSessionToken() {
  log('Testing: Create session token (POST /api/storage/session-token/:uid)');

  const result = await makeRequest(`/api/storage/session-token/${TEST_UID}`, {
    method: 'POST'
  });

  recordTest(
    'POST /session-token/:uid returns 200',
    result.status === 200,
    `Expected 200, got ${result.status}: ${JSON.stringify(result.data)}`
  );

  const sessionData = result.data?.data;
  recordTest(
    'POST /session-token/:uid returns sessionToken',
    sessionData && typeof sessionData.sessionToken === 'string' && sessionData.sessionToken.length > 0,
    `sessionToken missing or empty: ${JSON.stringify(sessionData)}`
  );

  if (sessionData?.sessionToken) {
    storedSessionToken = sessionData.sessionToken;

    // Verify expiry is approximately 30 days from now (within 1 minute tolerance)
    const expiresAt = new Date(sessionData.sessionExpiresAt);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const diffMs = Math.abs(expiresAt - thirtyDaysFromNow);
    recordTest(
      'Session token expires approximately 30 days from now',
      diffMs < 60 * 1000,
      `sessionExpiresAt ${sessionData.sessionExpiresAt} not ~30 days from now (diff: ${diffMs}ms)`
    );
  }
}

async function testValidateSessionToken() {
  log('Testing: Validate session token (POST /api/storage/session-validate)');

  if (!storedSessionToken) {
    recordTest('POST /session-validate with valid token returns 200', false, 'No session token available from prior test');
    recordTest('POST /session-validate with invalid token returns 401', false, 'No session token available from prior test');
    return;
  }

  // Valid token
  const validResult = await makeRequest('/api/storage/session-validate', {
    method: 'POST',
    body: JSON.stringify({ sessionToken: storedSessionToken })
  });

  recordTest(
    'POST /session-validate with valid token returns 200',
    validResult.status === 200,
    `Expected 200, got ${validResult.status}: ${JSON.stringify(validResult.data)}`
  );

  // Invalid token
  const invalidResult = await makeRequest('/api/storage/session-validate', {
    method: 'POST',
    body: JSON.stringify({ sessionToken: 'definitely-not-a-real-token' })
  });

  recordTest(
    'POST /session-validate with invalid token returns 401',
    invalidResult.status === 401,
    `Expected 401, got ${invalidResult.status}`
  );

  // Missing token
  const missingResult = await makeRequest('/api/storage/session-validate', {
    method: 'POST',
    body: JSON.stringify({})
  });

  recordTest(
    'POST /session-validate without sessionToken returns 400',
    missingResult.status === 400,
    `Expected 400, got ${missingResult.status}`
  );
}

async function testGetNonExistentToken() {
  log('Testing: Get non-existent token returns 404');

  const result = await makeRequest('/api/storage/oauth-token/uid-that-does-not-exist');
  recordTest(
    'GET /oauth-token/:uid for unknown UID returns 404',
    result.status === 404,
    `Expected 404, got ${result.status}`
  );
}

// ==================== RUNNER ====================

export async function runOAuthTokenTests() {
  log('━'.repeat(80));
  log('OAuth Token Persistence Tests (TEEPER-43)');
  log('━'.repeat(80));
  log(`Test UID: ${TEST_UID}`);
  log(`Data Server: ${DATA_SERVER_URL}`);

  await testStoreOAuthToken();
  await testGetOAuthToken();
  await testUpsertOAuthToken();
  await testPatchOAuthToken();
  await testGetExpiringTokens();
  await testCreateSessionToken();
  await testValidateSessionToken();
  await testGetNonExistentToken();

  log('━'.repeat(80));
  log(`OAuth Token Tests complete: ${testResults.passed}/${testResults.total} passed`);

  return testResults;
}

// Standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runOAuthTokenTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}
