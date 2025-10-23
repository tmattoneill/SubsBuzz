# SubsBuzz Microservices Test Execution Guide

## 🎯 Test Suite Overview

We have created a comprehensive testing framework with 4 test suites:

1. **Database Tests** - PostgreSQL connectivity and performance
2. **Data Server Tests** - API endpoints and internal authentication  
3. **API Gateway Tests** - JWT authentication and service proxying
4. **Integration Tests** - End-to-end service communication

## 🚀 Prerequisites

### 1. Services Must Be Running

Before running tests, ensure all services are operational:

```bash
# Terminal 1: Data Server
cd services/data-server
node server-test.js

# Terminal 2: API Gateway  
cd services/api-gateway
python3 simple-gateway.py

# Terminal 3: PostgreSQL (if not already running)
brew services start postgresql@14
```

### 2. Environment Variables

Ensure these are configured:
- `DATABASE_URL=postgresql://postgres@localhost:5432/subsbuzz_dev`
- `DATA_SERVER_URL=http://localhost:3001` 
- `API_GATEWAY_URL=http://localhost:8000`
- `INTERNAL_API_SECRET=subsbuzz-internal-api-secret-dev-testing`

## 🧪 Individual Test Execution Commands

### Test 1: Database Tests
**Purpose**: Verify PostgreSQL connectivity, schema, and performance
**Duration**: ~30 seconds
**Command**:
```bash
node tests/test-database.js
```

**Expected Output**: ✅ All database operations working
**Analysis Points**:
- Connection establishment time
- Database schema validation
- Query performance metrics
- Transaction support verification

---

### Test 2: Data Server Tests  
**Purpose**: Verify API endpoints, authentication, and database operations
**Duration**: ~45 seconds
**Prerequisites**: Data Server must be running on port 3001
**Command**:
```bash
node tests/test-data-server.js
```

**Expected Output**: ✅ All API endpoints responding correctly
**Analysis Points**:
- HTTP endpoint functionality
- Internal API key authentication
- Response format consistency
- Error handling behavior

---

### Test 3: API Gateway Tests
**Purpose**: Verify JWT authentication, CORS, and service proxying  
**Duration**: ~30 seconds
**Prerequisites**: API Gateway must be running on port 8000
**Command**:
```bash
node tests/test-api-gateway.js
```

**Expected Output**: ✅ Authentication and proxying working
**Analysis Points**:
- JWT token handling
- Authentication rejection behavior
- Service proxy functionality
- CORS configuration

---

### Test 4: Integration Tests
**Purpose**: End-to-end request flow validation
**Duration**: ~90 seconds  
**Prerequisites**: All services running (Database, Data Server, API Gateway)
**Command**:
```bash
node tests/test-integration.js
```

**Expected Output**: ✅ Full microservices communication working
**Analysis Points**:
- Complete request flow: Gateway → Data Server → Database
- Authentication chain validation
- Error propagation through services
- Performance under concurrent load

---

### Test 5: Complete Test Suite
**Purpose**: Run all tests systematically with comprehensive reporting
**Duration**: ~3 minutes
**Command**:
```bash
node tests/run-tests.js
```

**Expected Output**: ✅ Comprehensive test report with architecture assessment

## 📊 Test Analysis Framework

After each test execution, please analyze:

### ✅ Success Indicators
- All tests passing (green checkmarks)
- Response times under acceptable thresholds
- Proper error handling for invalid requests
- Consistent data across service boundaries

### ⚠️ Warning Signs  
- Any failing tests (red X marks)
- Slow response times (>200ms for simple requests)
- Authentication bypasses or security issues
- Inconsistent responses between requests

### 🔍 Key Metrics to Review
- **Database**: Connection time, query performance
- **Data Server**: Response times, authentication success rate
- **API Gateway**: Proxy latency, JWT validation
- **Integration**: End-to-end latency, error propagation

## 🚨 Troubleshooting

### Common Issues

**"Connection refused" errors**:
- Check if services are running on correct ports
- Verify no firewall blocking localhost connections

**"Database connection failed"**:
- Ensure PostgreSQL is running: `brew services start postgresql@14`
- Verify database exists: `createdb subsbuzz_dev`

**"Authentication failed"**:
- Check environment variables are loaded
- Verify API secrets match between services

**"Tests timeout"**:
- Ensure services started successfully
- Check for port conflicts with other applications

## 📋 Execution Checklist

Before running tests:
- [ ] PostgreSQL service running
- [ ] Data Server responding on http://localhost:3001/health  
- [ ] API Gateway responding on http://localhost:8000/health
- [ ] Environment variables configured
- [ ] No other applications using ports 3001, 8000

## 🎯 Next Steps After Testing

1. **All Tests Pass**: Ready for frontend integration
2. **Some Tests Fail**: Review failures, fix issues, re-test
3. **Performance Issues**: Optimize slow components
4. **Security Concerns**: Address authentication/authorization gaps

The testing framework provides comprehensive validation of our microservices architecture before proceeding with frontend integration and production deployment.