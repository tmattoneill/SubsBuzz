# SubsBuzz Microservice Refactoring Plan

**Date**: July 2025  
**Status**: In Progress  
**Target Environment**: Ubuntu 24 LTS Dedicated Server  
**Deployment Strategy**: Docker Containers + Nginx Reverse Proxy

## Executive Summary

Transform the monolithic SubsBuzz React/TypeScript application into a scalable microservice architecture consisting of 4 containerized services. This refactoring enables independent scaling, deployment, and maintenance while preserving all existing functionality and business logic.

**Key Goals:**
- Enable independent service scaling across multiple machines
- Preserve all critical business logic (thematic digests, OAuth, etc.)
- Deploy on dedicated Ubuntu 24 LTS server with nginx
- Maintain zero-downtime migrations and rollback capabilities
- Improve system reliability and maintainability

## Current Architecture Analysis

### Monolithic Structure Assessment

**Current Setup:**
- **Single Process**: Node.js/Express server serving both API and React SPA
- **Embedded Frontend**: Vite dev server or static files served by Express
- **Combined Responsibilities**: Email processing, database operations, API routes, authentication, UI serving
- **Database**: PostgreSQL with complex thematic digest schema (dual-tier architecture)
- **Critical Issues**: Disabled cron jobs, missing error handling, no input validation

**Business Logic Complexity:**
```typescript
// Complex 3-stage thematic processing pipeline
Stage 1: NLP Analysis and Email Clustering
Stage 2: LLM Synthesis using GPT-4o-mini  
Stage 3: Database Storage with Source Email Linking
```

**Current File Structure:**
```
SubsBuzz/
├── server/                    # Node.js/Express backend
│   ├── index.ts              # Main server entry point
│   ├── routes.ts             # API routes (685 lines)
│   ├── storage.ts            # Database operations (584 lines)
│   ├── gmail.ts              # Gmail API integration (619 lines)
│   ├── openai.ts             # OpenAI processing (242 lines)
│   ├── thematic-processor.ts # Complex thematic digest logic (504 lines)
│   ├── cron.ts               # Disabled daily digest cron (62 lines)
│   └── auth.ts               # OAuth and session management (148 lines)
├── client/                   # React SPA
├── shared/                   # TypeScript schemas and types
└── docs/                     # Documentation
```

**Critical Functionality to Preserve:**
1. **Thematic Digest Processing**: 3-stage NLP + LLM pipeline for intelligent email clustering
2. **Gmail OAuth Integration**: Token management, refresh handling, email fetching
3. **Database Operations**: Complex joins for thematic sections and source emails
4. **User Authentication**: Session management and Firebase integration
5. **Email Content Extraction**: Advanced HTML parsing and cleanup

## Target Microservice Architecture

### Service Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway    │    │   Data Server   │
│   (React SPA)   │◄──►│   (FastAPI)      │◄──►│   (Node.js)     │
│   Port: 3000    │    │   Port: 8000     │    │   Port: 5000    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        │
                       ┌────────▼────────┐              │
                       │  Email Worker   │              │
                       │   (Python)      │◄─────────────┘
                       │   Background    │
                       └─────────────────┘
                                │
                       ┌────────▼────────┐
                       │   PostgreSQL    │
                       │   + Redis       │
                       └─────────────────┘
```

### 1. Email Worker Service (Python)

**Container**: `subsbuzz-email-worker`  
**Purpose**: Background email processing and scheduled tasks  
**No HTTP Interface**: Communicates via Redis queues and direct API calls

**Responsibilities:**
- Gmail API integration and email fetching
- Email content extraction and preprocessing  
- Scheduled digest generation (replacing disabled cron)
- OAuth token refresh handling
- Background task processing with Celery

**Technology Stack:**
```python
# Core Dependencies
Python 3.11+
asyncio           # Concurrent Gmail operations
celery            # Task queue and scheduling
redis             # Message broker and caching
google-api-python-client  # Gmail API integration
beautifulsoup4    # HTML parsing
html2text         # Content extraction
httpx             # HTTP client for API calls
```

**Key Files to Extract:**
- `server/gmail.ts` → `email_worker/gmail_client.py`
- `server/cron.ts` → `email_worker/tasks.py`
- Email content extraction logic → `email_worker/content_extractor.py`

### 2. Data Server (Node.js/TypeScript)

**Container**: `subsbuzz-data-server`  
**Port**: 5000 (internal only)  
**Purpose**: Database operations and business logic

**Responsibilities:**
- All PostgreSQL operations using existing Drizzle ORM
- Thematic digest processing business logic
- Internal REST API for other services
- Data validation and complex query operations

**Technology Stack:**
```typescript
// Preserve Existing Stack
Node.js/TypeScript
Express.js           // Internal API server
Drizzle ORM          // Database operations (no changes)
PostgreSQL           // Database (preserve schema)
Zod                  // Data validation
```

**Key Files to Preserve:**
- `server/storage.ts` → Internal API endpoints
- `server/thematic-processor.ts` → Business logic module  
- `server/openai.ts` → AI processing operations
- `shared/schema.ts` → Database schema (unchanged)

### 3. API Gateway (FastAPI/Python)

**Container**: `subsbuzz-api-gateway`  
**Port**: 8000 (nginx proxied)  
**Purpose**: External API interface and authentication

**Responsibilities:**
- External API for frontend consumption
- JWT-based authentication (replacing Express sessions)
- Request routing to data server
- Rate limiting, validation, and security

**Technology Stack:**
```python
# Modern API Stack
FastAPI              # API framework with auto-docs
Pydantic             # Request/response validation
python-jose[cryptography]  # JWT token handling
httpx                # HTTP client for service communication
redis                # Session storage and caching
```

**API Routes to Migrate:**
```typescript
// From server/routes.ts (685 lines) to FastAPI routes
POST /api/auth/verify-token
POST /api/digest/generate  
GET  /api/monitored-emails
GET  /api/digest/latest
GET  /api/digest/history
GET  /api/settings
```

### 4. Frontend (React - Minimal Changes)

**Container**: `subsbuzz-frontend`  
**Port**: 3000 (nginx proxied)  
**Purpose**: User interface with updated API integration

**Changes Required:**
- API base URL configuration for nginx proxy
- Replace session authentication with JWT tokens
- Add service health monitoring components
- Update error handling for new API responses

**Preserved Components:**
- All existing React components and UI logic
- TanStack Query for data fetching
- Wouter for client-side routing
- Shadcn/ui component library

## Ubuntu 24 LTS Deployment Strategy

### Infrastructure Overview

**Server Setup:**
- **OS**: Ubuntu 24 LTS (dedicated server)
- **Reverse Proxy**: Nginx for SSL termination and routing
- **Container Runtime**: Docker with Docker Compose
- **Process Management**: Systemd service for application lifecycle
- **Database**: PostgreSQL (containerized)
- **Cache/Queue**: Redis (containerized)

### Nginx Configuration

**File**: `/etc/nginx/sites-available/subsbuzz`

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Frontend - React SPA
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support for development
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # API Gateway
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
    
    # Health checks
    location /health {
        proxy_pass http://localhost:8000/health;
        access_log off;
    }
    
    # Security rules
    location ~ /\. {
        deny all;
    }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

### Docker Compose Configuration

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  frontend:
    build: 
      context: .
      dockerfile: services/frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=/api
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
    
  api-gateway:
    build: 
      context: .
      dockerfile: services/api-gateway/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - DATA_SERVER_URL=http://data-server:5000
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - data-server
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    
  data-server:
    build: 
      context: .
      dockerfile: services/data-server/Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    
  email-worker:
    build: 
      context: .
      dockerfile: services/email-worker/Dockerfile
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - DATA_SERVER_URL=http://data-server:5000
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
      - data-server
    restart: unless-stopped
    
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=subsbuzz
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  default:
    name: subsbuzz-network
```

### Systemd Service Management

**File**: `/etc/systemd/system/subsbuzz.service`

```ini
[Unit]
Description=SubsBuzz Microservices Application
Requires=docker.service
After=docker.service
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/subsbuzz
EnvironmentFile=/opt/subsbuzz/.env
ExecStartPre=/usr/bin/docker-compose pull
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
ExecReload=/usr/bin/docker-compose restart
TimeoutStartSec=300
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
```

## Implementation Plan

### Phase 1: Service Extraction (2-3 hours)

#### Step 1.1: Email Worker Service (45 minutes)

**Extract Gmail Integration:**
```python
# email_worker/gmail_client.py
class GmailClient:
    async def fetch_emails(self, monitored_senders: List[str], user_uid: str) -> List[ParsedEmail]:
        # Extract from server/gmail.ts lines 205-303
        
    async def scan_for_newsletters(self, user_uid: str) -> List[NewsletterSender]:
        # Extract from server/gmail.ts lines 49-163
```

**Celery Task Setup:**
```python
# email_worker/tasks.py
@celery.task
def generate_daily_digest(user_id: str):
    # Replace server/cron.ts functionality
    
@celery.task  
def refresh_oauth_tokens():
    # Automated token refresh
```

**Content Extraction:**
```python
# email_worker/content_extractor.py
class ContentExtractor:
    async def extract_newsletter_content(self, raw_content: str) -> str:
        # Extract from server/gmail.ts lines 360-617
```

#### Step 1.2: Data Server API (60 minutes)

**Storage API Endpoints:**
```typescript
// data_server/routes/storage.ts
router.get('/monitored-emails/:userId', getMonitoredEmails);
router.post('/monitored-emails', addMonitoredEmail);
router.get('/digest/:userId/latest', getLatestDigest);
router.post('/digest', createDigest);
// ... all storage operations from server/storage.ts
```

**Thematic Processing:**
```typescript
// data_server/services/thematic-processor.ts
// Preserve existing ThematicProcessor class (504 lines)
// Expose via internal API endpoints
```

#### Step 1.3: API Gateway (45 minutes)

**FastAPI Routes:**
```python
# api_gateway/main.py
from fastapi import FastAPI, Depends
from .auth import get_current_user
from .routes import auth, digest, settings

app = FastAPI(title="SubsBuzz API", version="2.0.0")

app.include_router(auth.router, prefix="/auth")
app.include_router(digest.router, prefix="/digest", dependencies=[Depends(get_current_user)])
app.include_router(settings.router, prefix="/settings", dependencies=[Depends(get_current_user)])
```

**JWT Authentication:**
```python
# api_gateway/auth.py
from jose import JWTError, jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer

async def get_current_user(token: str = Depends(HTTPBearer())):
    # Replace Express session with JWT validation
```

#### Step 1.4: Frontend Updates (30 minutes)

**API Client Configuration:**
```typescript
// frontend/src/lib/api-client.ts
const API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000';

// Update all API calls to use JWT tokens
class ApiClient {
  private token: string | null = null;
  
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }
  
  async request(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };
    
    return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  }
}
```

### Phase 2: Infrastructure & Deployment (1.5 hours)

#### Step 2.1: Docker Configuration (45 minutes)

**Frontend Dockerfile:**
```dockerfile
# services/frontend/Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

**Data Server Dockerfile:**
```dockerfile
# services/data-server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/server/index.js"]
```

**API Gateway Dockerfile:**
```dockerfile
# services/api-gateway/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Email Worker Dockerfile:**
```dockerfile
# services/email-worker/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["celery", "worker", "-A", "main", "--loglevel=info"]
```

#### Step 2.2: Ubuntu Server Setup (45 minutes)

**Server Initialization Script:**
```bash
#!/bin/bash
# infrastructure/scripts/setup-ubuntu.sh

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Create application directory
sudo mkdir -p /opt/subsbuzz
sudo chown ubuntu:ubuntu /opt/subsbuzz

# Copy configuration files
sudo cp /opt/subsbuzz/infrastructure/nginx/subsbuzz.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/subsbuzz /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Enable services
sudo systemctl enable nginx
sudo systemctl enable subsbuzz

echo "Ubuntu server setup complete!"
```

### Phase 3: Testing & Optimization (1 hour)

#### Step 3.1: Integration Testing (30 minutes)

**Service Communication Tests:**
```python
# tests/integration/test_service_communication.py
import pytest
import httpx

async def test_frontend_to_api_gateway():
    # Test frontend can reach API gateway through nginx
    
async def test_api_gateway_to_data_server():
    # Test API gateway can communicate with data server
    
async def test_email_worker_to_data_server():
    # Test email worker can send data to data server
```

**End-to-End User Flow Tests:**
```python
# tests/e2e/test_user_flows.py
async def test_user_registration_and_digest_generation():
    # Complete user journey from registration to digest viewing
    
async def test_oauth_flow():
    # Gmail OAuth integration test
```

#### Step 3.2: Performance & Monitoring (30 minutes)

**Health Check Implementation:**
```python
# Shared health check format for all services
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "api-gateway",
        "version": "2.0.0"
    }
```

**Basic Monitoring Setup:**
```bash
# infrastructure/scripts/setup-monitoring.sh
# Install Prometheus, Grafana, or basic log aggregation
# Set up service metrics collection
# Configure alerting for service failures
```

## Critical Migration Considerations

### Data Preservation Strategy

**PostgreSQL Schema (Zero Changes):**
- All existing tables preserved exactly as-is
- Existing data remains intact and accessible
- No migration scripts needed for database structure
- Drizzle ORM configuration unchanged

**OAuth Token Migration:**
```typescript
// Preserve existing OAuth tokens during service transition
// tokens remain in postgres `oauth_tokens` table
// Data server maintains same token refresh logic
// API gateway validates tokens through data server
```

**Session to JWT Migration:**
```python
# Convert existing Express sessions to JWT tokens
# Preserve user authentication state during transition
# Implement graceful fallback for existing sessions
```

### Service Communication Security

**Internal API Authentication:**
```typescript
// Data server internal API security
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

function authenticateInternalRequest(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-internal-api-key'];
  if (token !== INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized internal request' });
  }
  next();
}
```

**Service Discovery:**
```yaml
# Docker Compose networking ensures services can find each other
# Environment variables provide service URLs
# Health checks ensure service availability
```

### Rollback Procedures

**Service Rollback Strategy:**
```bash
# infrastructure/scripts/rollback.sh
#!/bin/bash

# Stop new services
docker-compose down

# Restart monolithic application
cd /opt/subsbuzz-backup
npm start

# Restore nginx configuration
sudo cp nginx-monolith.conf /etc/nginx/sites-available/subsbuzz
sudo systemctl reload nginx
```

**Database Rollback:**
- No database changes means no rollback needed
- Data remains compatible with monolithic version
- Can switch between architectures without data loss

### Error Handling & Resilience

**Circuit Breaker Pattern:**
```python
# api_gateway/utils/circuit_breaker.py
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
```

**Retry Logic:**
```python
# Exponential backoff for service communication
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def call_data_server(endpoint: str, data: dict):
    # HTTP client with automatic retries
```

**Graceful Degradation:**
```typescript
// Frontend handles service failures gracefully
if (apiResponse.status === 503) {
  showMaintenanceMessage();
  fallbackToLocalCache();
}
```

## Production Readiness Checklist

### Infrastructure Requirements

**Server Specifications:**
- [ ] Ubuntu 24 LTS installed and updated
- [ ] Minimum 4GB RAM, 2 CPU cores
- [ ] 20GB+ available disk space
- [ ] SSL certificate configured (Let's Encrypt)
- [ ] Firewall configured (UFW with ports 80, 443, 22)

**Dependencies Installed:**
- [ ] Docker Engine 24.0+
- [ ] Docker Compose Plugin
- [ ] Nginx 1.18+
- [ ] Certbot for SSL certificates
- [ ] UFW firewall configured

### Application Deployment

**Service Health:**
- [ ] All 4 services start successfully
- [ ] Health check endpoints respond
- [ ] Database connections established
- [ ] Redis connections established
- [ ] Inter-service communication working

**Data Migration:**
- [ ] PostgreSQL data intact and accessible
- [ ] OAuth tokens preserved and functional
- [ ] User settings migrated correctly
- [ ] Digest history accessible

**Security Configuration:**
- [ ] JWT tokens properly configured
- [ ] Internal API authentication enabled
- [ ] Environment variables secured
- [ ] SSL certificates valid
- [ ] Rate limiting configured

### Monitoring & Maintenance

**Logging:**
- [ ] Centralized log collection configured
- [ ] Error tracking operational
- [ ] Performance metrics collected
- [ ] Audit logging enabled

**Backup & Recovery:**
- [ ] PostgreSQL backup scripts scheduled
- [ ] Configuration backup procedures
- [ ] Recovery procedures tested
- [ ] Rollback procedures documented

**Operational Procedures:**
- [ ] Service restart procedures documented
- [ ] Update deployment process defined
- [ ] Monitoring dashboard accessible
- [ ] Alert notifications configured

## Post-Migration Optimization

### Performance Improvements

**Database Optimization:**
```sql
-- Add missing indexes for frequently queried columns
CREATE INDEX CONCURRENTLY idx_email_digests_user_date ON email_digests(user_id, date DESC);
CREATE INDEX CONCURRENTLY idx_thematic_digests_user_date ON thematic_digests(user_id, date DESC);
```

**Caching Strategy:**
```python
# Redis caching for frequently accessed data
@cache(expire=300)  # 5 minute cache
async def get_user_settings(user_id: str):
    return await data_server_client.get(f"/users/{user_id}/settings")
```

**Resource Limits:**
```yaml
# Docker resource limits
services:
  api-gateway:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

### Scaling Strategies

**Horizontal Scaling:**
```yaml
# Multiple instances of services
services:
  api-gateway:
    deploy:
      replicas: 2
  email-worker:
    deploy:
      replicas: 3  # Scale based on email volume
```

**Load Balancing:**
```nginx
# Nginx upstream configuration
upstream api_backend {
    server localhost:8000;
    server localhost:8001;
    server localhost:8002;
}
```

## Appendix

### Directory Structure

**Final Project Layout:**
```
subsbuzz/
├── services/
│   ├── frontend/                 # React SPA
│   │   ├── src/                 # Existing client code
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   ├── api-gateway/             # FastAPI external interface
│   │   ├── main.py
│   │   ├── routes/
│   │   ├── auth.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── data-server/             # Node.js internal API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   └── email-worker/            # Python background processing
│       ├── main.py
│       ├── tasks.py
│       ├── gmail_client.py
│       ├── requirements.txt
│       └── Dockerfile
├── shared/
│   ├── schemas/                 # Shared data models
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Common utilities
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml
│   ├── nginx/
│   │   └── subsbuzz.conf
│   ├── scripts/
│   │   ├── setup-ubuntu.sh
│   │   ├── deploy.sh
│   │   └── rollback.sh
│   └── systemd/
│       └── subsbuzz.service
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── unit/
├── docs/
│   ├── REFACTOR.md             # This document
│   ├── API.md                  # API documentation
│   └── DEPLOYMENT.md           # Deployment guide
├── docker-compose.yml
├── .env.example
└── README.md
```

### Environment Variables

**Required Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/subsbuzz

# Authentication
JWT_SECRET=your-jwt-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_REDIRECT_URI=https://your-domain.com/auth/callback

# External APIs
OPENAI_API_KEY=your-openai-api-key

# Redis
REDIS_URL=redis://localhost:6379/0

# Internal API Security
INTERNAL_API_SECRET=internal-api-secret-key

# Service URLs (for inter-service communication)
DATA_SERVER_URL=http://data-server:5000
```

### Development vs Production Configuration

**Development (docker-compose.dev.yml):**
```yaml
# Override for development with hot reloading, debug ports, etc.
services:
  frontend:
    volumes:
      - ./services/frontend/src:/app/src
    environment:
      - NODE_ENV=development
```

**Production (docker-compose.yml):**
```yaml
# Optimized builds, security hardening, resource limits
services:
  frontend:
    deploy:
      resources:
        limits:
          memory: 256M
```

---

**Document Revision**: v1.0  
**Last Updated**: December 2024  
**Next Review**: Post-implementation (Q1 2025)