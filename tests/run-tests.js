#!/usr/bin/env node
/**
 * Test Runner - Orchestrates All Microservices Tests
 * 
 * Runs tests systematically and provides comprehensive reporting
 */

// Load environment variables using custom loader
import { loadDevEnv } from '../lib/env.js';
loadDevEnv();
import { runDatabaseTestsSimple as runDatabaseTests } from './test-database-simple.js';
import { runDataServerTests } from './test-data-server.js';
import { runAPIGatewayTests } from './test-api-gateway.js';
import { runIntegrationTests } from './test-integration.js';

// Test configuration
const TEST_MODE = process.env.TEST_MODE || 'full'; // full, quick, individual
const GENERATE_REPORT = process.env.GENERATE_REPORT !== 'false';

// Results tracking
let overallResults = {
  startTime: Date.now(),
  endTime: null,
  suites: {},
  summary: {
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    successRate: 0
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
    header: '🚀',
    separator: '━'
  }[type] || '📋';
  
  if (type === 'separator') {
    console.log('━'.repeat(80));
  } else {
    console.log(`${prefix} [${timestamp}] ${message}`);
  }
}

function printHeader(title) {
  log('', 'separator');
  log(`${title.toUpperCase()}`, 'header');
  log('', 'separator');
}

async function runTestSuite(name, testFunction, description) {
  log(`Starting ${name}...`, 'info');
  log(`${description}`, 'info');
  
  const startTime = Date.now();
  
  try {
    const results = await testFunction();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    overallResults.suites[name] = {
      ...results,
      duration,
      description
    };
    
    // Update overall summary
    overallResults.summary.totalTests += results.total;
    overallResults.summary.totalPassed += results.passed;
    overallResults.summary.totalFailed += results.failed;
    
    const successRate = results.total > 0 ? (results.passed / results.total) * 100 : 0;
    
    log(`${name} completed in ${duration}ms`, 'info');
    log(`Results: ${results.passed}/${results.total} passed (${successRate.toFixed(1)}%)`, 
        results.failed === 0 ? 'success' : 'warning');
    
    return results;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    overallResults.suites[name] = {
      total: 1,
      passed: 0,
      failed: 1,
      details: [{ name: 'Suite Execution', passed: false, message: error.message }],
      duration,
      description,
      error: error.message
    };
    
    overallResults.summary.totalTests += 1;
    overallResults.summary.totalFailed += 1;
    
    log(`${name} failed after ${duration}ms: ${error.message}`, 'error');
    return overallResults.suites[name];
  }
}

function generateReport() {
  overallResults.endTime = Date.now();
  const totalDuration = overallResults.endTime - overallResults.startTime;
  
  overallResults.summary.successRate = overallResults.summary.totalTests > 0 
    ? (overallResults.summary.totalPassed / overallResults.summary.totalTests) * 100 
    : 0;
  
  printHeader('COMPREHENSIVE TEST REPORT');
  
  // Overall summary
  log('OVERALL SUMMARY', 'info');
  log(`Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`, 'info');
  log(`Total Tests: ${overallResults.summary.totalTests}`, 'info');
  log(`Passed: ${overallResults.summary.totalPassed}`, 'success');
  log(`Failed: ${overallResults.summary.totalFailed}`, overallResults.summary.totalFailed > 0 ? 'error' : 'info');
  log(`Success Rate: ${overallResults.summary.successRate.toFixed(1)}%`, 'info');
  
  log('', 'separator');
  
  // Suite-by-suite breakdown
  log('SUITE BREAKDOWN', 'info');
  Object.entries(overallResults.suites).forEach(([suiteName, results]) => {
    const successRate = results.total > 0 ? (results.passed / results.total) * 100 : 0;
    const status = results.failed === 0 ? '✅' : '❌';
    
    log(`${status} ${suiteName}: ${results.passed}/${results.total} (${successRate.toFixed(1)}%) - ${results.duration}ms`, 'info');
    
    if (results.error) {
      log(`    Error: ${results.error}`, 'error');
    }
    
    if (results.failed > 0 && results.details) {
      const failedTests = results.details.filter(test => !test.passed);
      failedTests.forEach(test => {
        log(`    ❌ ${test.name}: ${test.message}`, 'error');
      });
    }
  });
  
  log('', 'separator');
  
  // Service status assessment
  log('MICROSERVICES STATUS ASSESSMENT', 'info');
  
  const databaseOk = overallResults.suites['Database Tests']?.failed === 0;
  const dataServerOk = overallResults.suites['Data Server Tests']?.failed === 0;
  const apiGatewayOk = overallResults.suites['API Gateway Tests']?.failed === 0;
  const integrationOk = overallResults.suites['Integration Tests']?.failed === 0;
  
  log(`Database Layer: ${databaseOk ? '✅ Operational' : '❌ Issues Found'}`, databaseOk ? 'success' : 'error');
  log(`Data Server: ${dataServerOk ? '✅ Operational' : '❌ Issues Found'}`, dataServerOk ? 'success' : 'error');
  log(`API Gateway: ${apiGatewayOk ? '✅ Operational' : '❌ Issues Found'}`, apiGatewayOk ? 'success' : 'error');
  log(`Integration: ${integrationOk ? '✅ All Systems Go' : '❌ Service Communication Issues'}`, integrationOk ? 'success' : 'error');
  
  // Overall architecture assessment
  const architectureHealthy = databaseOk && dataServerOk && apiGatewayOk && integrationOk;
  
  log('', 'separator');
  if (architectureHealthy) {
    log('🎉 MICROSERVICES ARCHITECTURE: FULLY OPERATIONAL', 'success');
    log('Ready for production deployment and frontend integration!', 'success');
  } else {
    log('⚠️  MICROSERVICES ARCHITECTURE: NEEDS ATTENTION', 'warning');
    log('Some services have issues that should be resolved before proceeding.', 'warning');
  }
  
  return overallResults;
}

async function runAllTests() {
  printHeader('SUBSBUZZ MICROSERVICES TEST SUITE');
  
  log('Test Configuration:', 'info');
  log(`Mode: ${TEST_MODE}`, 'info');
  log(`Report Generation: ${GENERATE_REPORT ? 'Enabled' : 'Disabled'}`, 'info');
  log(`Node.js Version: ${process.version}`, 'info');
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'info');
  
  const testSuites = [
    {
      name: 'Database Tests',
      function: runDatabaseTests,
      description: 'PostgreSQL connectivity, schema validation, and performance testing'
    },
    {
      name: 'Data Server Tests',
      function: runDataServerTests,
      description: 'API endpoints, authentication, and database operations testing'
    },
    {
      name: 'API Gateway Tests',
      function: runAPIGatewayTests,
      description: 'JWT authentication, service proxying, and gateway functionality testing'
    },
    {
      name: 'Integration Tests',
      function: runIntegrationTests,
      description: 'End-to-end request flows and service communication testing'
    }
  ];
  
  // Run test suites sequentially
  for (const suite of testSuites) {
    try {
      await runTestSuite(suite.name, suite.function, suite.description);
      
      // Add delay between suites to avoid resource conflicts
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      log(`Failed to run ${suite.name}: ${error.message}`, 'error');
    }
  }
  
  // Generate comprehensive report
  if (GENERATE_REPORT) {
    const report = generateReport();
    
    // Save report to file
    try {
      const reportContent = JSON.stringify(report, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportFile = `test-report-${timestamp}.json`;
      
      // Note: In a real implementation, you'd write this to a file
      log(`Report data ready (${reportContent.length} characters)`, 'info');
      log(`Would save to: ${reportFile}`, 'info');
    } catch (error) {
      log(`Failed to save report: ${error.message}`, 'warning');
    }
  }
  
  return overallResults;
}

// Export for programmatic use
export { runAllTests, overallResults };

// Command-line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then((results) => {
      const exitCode = results.summary.totalFailed > 0 ? 1 : 0;
      log(`Exiting with code ${exitCode}`, exitCode === 0 ? 'success' : 'error');
      process.exit(exitCode);
    })
    .catch((error) => {
      log(`Fatal error: ${error.message}`, 'error');
      console.error(error.stack);
      process.exit(1);
    });
}