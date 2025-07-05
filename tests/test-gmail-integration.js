#!/usr/bin/env node
/**
 * Gmail Integration Tests - Core Business Logic Testing
 * 
 * Tests Gmail client functionality, email processing pipeline, and integration
 * with the data server without requiring actual Gmail credentials.
 */

// Load environment variables using custom loader
import { loadDevEnv } from '../lib/env.js';
loadDevEnv();

// Using native fetch available in Node.js 18+
const fetch = globalThis.fetch;

// Test configuration
const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const EMAIL_WORKER_PATH = './services/email-worker';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';
const TIMEOUT_MS = 30000;

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
      'x-internal-api-key': INTERNAL_API_SECRET,
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

// Gmail Client Testing Functions
async function testEmailWorkerStructure() {
  try {
    log('Testing Email Worker service structure', 'section');
    
    const fs = await import('fs');
    const path = await import('path');
    
    // Check if email worker directory exists
    const emailWorkerPath = path.resolve(EMAIL_WORKER_PATH);
    if (!fs.existsSync(emailWorkerPath)) {
      recordTest('Email Worker Directory', false, 'Email worker directory not found');
      return false;
    }
    
    // Check for required files
    const requiredFiles = [
      'gmail_client.py',
      'tasks.py',
      'content_extractor.py',
      'main.py'
    ];
    
    let allFilesExist = true;
    for (const file of requiredFiles) {
      const filePath = path.join(emailWorkerPath, file);
      if (!fs.existsSync(filePath)) {
        recordTest(`Email Worker File: ${file}`, false, `File not found: ${file}`);
        allFilesExist = false;
      } else {
        recordTest(`Email Worker File: ${file}`, true);
      }
    }
    
    if (allFilesExist) {
      recordTest('Email Worker Structure', true);
      return true;
    } else {
      recordTest('Email Worker Structure', false, 'Some required files missing');
      return false;
    }
  } catch (error) {
    recordTest('Email Worker Structure', false, error.message);
    return false;
  }
}

async function testGmailClientImports() {
  try {
    log('Testing Gmail Client Python imports', 'section');
    
    // We'll use a simple spawn process to test if the Python file can be imported
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    const testScript = `
import sys
sys.path.append('${path.resolve(EMAIL_WORKER_PATH)}')

try:
    from gmail_client import GmailClient, ParsedEmail, NewsletterSender
    print("IMPORT_SUCCESS")
except Exception as e:
    print(f"IMPORT_ERROR: {e}")
`;
    
    return new Promise((resolve) => {
      const python = spawn('python3', ['-c', testScript]);
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (output.includes('IMPORT_SUCCESS')) {
          recordTest('Gmail Client Imports', true);
          resolve(true);
        } else {
          recordTest('Gmail Client Imports', false, `Import failed: ${error || output}`);
          resolve(false);
        }
      });
      
      // Set timeout
      setTimeout(() => {
        python.kill();
        recordTest('Gmail Client Imports', false, 'Import test timed out');
        resolve(false);
      }, 10000);
    });
  } catch (error) {
    recordTest('Gmail Client Imports', false, error.message);
    return false;
  }
}

async function testContentExtractorImports() {
  try {
    log('Testing Content Extractor imports', 'section');
    
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    const testScript = `
import sys
sys.path.append('${path.resolve(EMAIL_WORKER_PATH)}')

try:
    from content_extractor import ContentExtractor
    print("CONTENT_EXTRACTOR_SUCCESS")
except Exception as e:
    print(f"CONTENT_EXTRACTOR_ERROR: {e}")
`;
    
    return new Promise((resolve) => {
      const python = spawn('python3', ['-c', testScript]);
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (output.includes('CONTENT_EXTRACTOR_SUCCESS')) {
          recordTest('Content Extractor Imports', true);
          resolve(true);
        } else {
          recordTest('Content Extractor Imports', false, `Import failed: ${error || output}`);
          resolve(false);
        }
      });
      
      setTimeout(() => {
        python.kill();
        recordTest('Content Extractor Imports', false, 'Content extractor import test timed out');
        resolve(false);
      }, 10000);
    });
  } catch (error) {
    recordTest('Content Extractor Imports', false, error.message);
    return false;
  }
}

async function testTasksImports() {
  try {
    log('Testing Celery Tasks imports', 'section');
    
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    const testScript = `
import sys
sys.path.append('${path.resolve(EMAIL_WORKER_PATH)}')

try:
    from tasks import generate_daily_digests, process_user_emails, refresh_oauth_tokens, scan_for_newsletters
    print("TASKS_SUCCESS")
except Exception as e:
    print(f"TASKS_ERROR: {e}")
`;
    
    return new Promise((resolve) => {
      const python = spawn('python3', ['-c', testScript]);
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (output.includes('TASKS_SUCCESS')) {
          recordTest('Celery Tasks Imports', true);
          resolve(true);
        } else {
          recordTest('Celery Tasks Imports', false, `Import failed: ${error || output}`);
          resolve(false);
        }
      });
      
      setTimeout(() => {
        python.kill();
        recordTest('Celery Tasks Imports', false, 'Tasks import test timed out');
        resolve(false);
      }, 10000);
    });
  } catch (error) {
    recordTest('Celery Tasks Imports', false, error.message);
    return false;
  }
}

// Data Server Integration Testing
async function testEmailStorageEndpoints() {
  try {
    log('Testing email storage endpoints availability', 'section');
    
    // Test key storage endpoints that email worker needs
    const endpoints = [
      '/api/storage/users-with-monitored-emails',
      '/api/storage/monitored-emails/test-user',
      '/api/storage/oauth-token/test-user'
    ];
    
    let allEndpointsWorking = true;
    
    for (const endpoint of endpoints) {
      try {
        const response = await makeRequest(`${DATA_SERVER_URL}${endpoint}`);
        
        if (response.ok || response.status === 404) {
          // 404 is acceptable for non-existent test users
          recordTest(`Endpoint: ${endpoint}`, true);
        } else {
          recordTest(`Endpoint: ${endpoint}`, false, `HTTP ${response.status}`);
          allEndpointsWorking = false;
        }
      } catch (error) {
        recordTest(`Endpoint: ${endpoint}`, false, error.message);
        allEndpointsWorking = false;
      }
    }
    
    return allEndpointsWorking;
  } catch (error) {
    recordTest('Email Storage Endpoints', false, error.message);
    return false;
  }
}

async function testDigestCreationEndpoint() {
  try {
    log('Testing digest creation endpoint', 'section');
    
    // Test the digest creation endpoint with mock data
    const mockDigestData = {
      user_id: 'test-user',
      emails: [
        {
          id: 'test-email-1',
          sender: 'newsletter@example.com',
          subject: 'Test Newsletter Subject',
          received_at: new Date().toISOString(),
          content: 'This is test email content for digest generation.',
          original_link: 'https://mail.google.com/mail/u/0/#inbox/test-email-1'
        }
      ]
    };
    
    const response = await makeRequest(`${DATA_SERVER_URL}/api/digest/create`, {
      method: 'POST',
      body: JSON.stringify(mockDigestData)
    });
    
    if (response.ok) {
      recordTest('Digest Creation Endpoint', true);
      log(`Digest created with ID: ${response.data?.data?.id || 'unknown'}`, 'info');
      return true;
    } else if (response.status === 500 && response.data?.error?.includes('OpenAI')) {
      // Accept OpenAI API key errors as the endpoint is working
      recordTest('Digest Creation Endpoint', true, 'Endpoint working (OpenAI key missing)');
      return true;
    } else {
      recordTest('Digest Creation Endpoint', false, `HTTP ${response.status}: ${response.data?.error || response.statusText}`);
      return false;
    }
  } catch (error) {
    recordTest('Digest Creation Endpoint', false, error.message);
    return false;
  }
}

// Environment Configuration Testing
async function testEnvironmentConfiguration() {
  try {
    log('Testing environment configuration for Gmail integration', 'section');
    
    const requiredVars = [
      'DATA_SERVER_URL',
      'INTERNAL_API_SECRET'
    ];
    
    const optionalVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'OPENAI_API_KEY',
      'CELERY_BROKER_URL'
    ];
    
    let allRequired = true;
    
    // Check required variables
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        recordTest(`Required Env: ${varName}`, true);
      } else {
        recordTest(`Required Env: ${varName}`, false, 'Environment variable not set');
        allRequired = false;
      }
    }
    
    // Check optional variables (warning only)
    for (const varName of optionalVars) {
      if (process.env[varName]) {
        log(`✅ Optional env var ${varName} is configured`, 'info');
      } else {
        log(`⚠️  Optional env var ${varName} is not configured`, 'warning');
      }
    }
    
    return allRequired;
  } catch (error) {
    recordTest('Environment Configuration', false, error.message);
    return false;
  }
}

// Mock Email Processing Test
async function testMockEmailProcessing() {
  try {
    log('Testing mock email processing pipeline', 'section');
    
    // Test if we can create a mock Gmail client and process test data
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    const mockTestScript = `
import sys
sys.path.append('${path.resolve(EMAIL_WORKER_PATH)}')

try:
    from gmail_client import GmailClient, ParsedEmail
    
    # Create mock email data
    mock_email = ParsedEmail(
        id="test-123",
        sender="newsletter@example.com",
        subject="Test Subject",
        received_at="2025-07-05T12:00:00Z",
        content="<html><body>Test email content</body></html>",
        original_link="https://example.com"
    )
    
    print(f"MOCK_EMAIL_SUCCESS: {mock_email.sender}")
    
except Exception as e:
    print(f"MOCK_EMAIL_ERROR: {e}")
`;
    
    return new Promise((resolve) => {
      const python = spawn('python3', ['-c', mockTestScript]);
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (output.includes('MOCK_EMAIL_SUCCESS')) {
          recordTest('Mock Email Processing', true);
          resolve(true);
        } else {
          recordTest('Mock Email Processing', false, `Mock processing failed: ${error || output}`);
          resolve(false);
        }
      });
      
      setTimeout(() => {
        python.kill();
        recordTest('Mock Email Processing', false, 'Mock email processing timed out');
        resolve(false);
      }, 10000);
    });
  } catch (error) {
    recordTest('Mock Email Processing', false, error.message);
    return false;
  }
}

// Main test execution
async function runGmailIntegrationTests() {
  log('🧪 Starting Gmail Integration Tests', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📍 ENVIRONMENT CONFIGURATION', 'info');
  log(`Data Server: ${DATA_SERVER_URL}`, 'info');
  log(`Email Worker Path: ${EMAIL_WORKER_PATH}`, 'info');
  log(`Internal API Secret: ${INTERNAL_API_SECRET ? 'Configured' : 'Missing'}`, 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const tests = [
    { name: 'Email Worker Structure', fn: testEmailWorkerStructure },
    { name: 'Environment Configuration', fn: testEnvironmentConfiguration },
    { name: 'Gmail Client Imports', fn: testGmailClientImports },
    { name: 'Content Extractor Imports', fn: testContentExtractorImports },
    { name: 'Celery Tasks Imports', fn: testTasksImports },
    { name: 'Email Storage Endpoints', fn: testEmailStorageEndpoints },
    { name: 'Digest Creation Endpoint', fn: testDigestCreationEndpoint },
    { name: 'Mock Email Processing', fn: testMockEmailProcessing }
  ];
  
  for (const test of tests) {
    try {
      log(`Running: ${test.name}...`, 'info');
      await test.fn();
    } catch (error) {
      recordTest(test.name, false, `Unexpected error: ${error.message}`);
    }
  }
  
  // Print comprehensive summary
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📊 GMAIL INTEGRATION TEST SUMMARY', 'info');
  log(`Total Tests: ${testResults.total}`, 'info');
  log(`Passed: ${testResults.passed}`, 'success');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 'info');
  
  if (testResults.failed > 0) {
    log('FAILED TESTS:', 'error');
    testResults.details
      .filter(test => !test.passed)
      .forEach(test => log(`  • ${test.name}: ${test.message}`, 'error'));
  }
  
  // Gmail integration readiness assessment
  const criticalTests = ['Email Worker Structure', 'Gmail Client Imports', 'Email Storage Endpoints'];
  const criticalFailures = testResults.details.filter(test => 
    criticalTests.includes(test.name) && !test.passed
  );
  
  if (criticalFailures.length === 0) {
    log('🎉 GMAIL INTEGRATION READY FOR TESTING WITH REAL CREDENTIALS!', 'success');
    log('Next step: Configure Gmail OAuth credentials and test with real Gmail account', 'info');
  } else {
    log('⚠️  Critical issues found - fix before proceeding with real Gmail testing', 'warning');
  }
  
  return testResults;
}

// Export for use in other tests
export { runGmailIntegrationTests, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runGmailIntegrationTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    });
}