# 🚀 Production Deployment & Workflow Strategy

## Overview
This document outlines the complete production deployment strategy, including containerization, CI/CD pipeline, environment management, and production operations.

## Development Workflow

### Git Workflow Strategy
```bash
# Main branches
main          # Production-ready code
develop       # Integration branch
release/*     # Release preparation
feature/*     # Feature development
hotfix/*      # Critical production fixes
```

### Branch Protection Rules
```yaml
# .github/branch-protection.yml
main:
  required_status_checks:
    - test-suite
    - build-check
    - security-scan
  required_pull_request_reviews: 2
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
  restrictions:
    push: [admin-team]
    merge: [admin-team]
```

### Development Process
1. **Feature Development**: Create feature branch from `develop`
2. **Pull Request**: Submit PR to `develop` with comprehensive description
3. **Code Review**: Mandatory review by 2+ team members
4. **Automated Testing**: All tests must pass
5. **Merge**: Squash and merge to `develop`
6. **Release**: Create release branch, test, merge to `main`

## Containerization Strategy

### Multi-Stage Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Set permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5500/health || exit 1

EXPOSE 5500
CMD ["node", "dist/index.js"]
```

### Docker Compose (Development)
```yaml
version: '3.8'

services:
  app:
    build: 
      context: .
      dockerfile: Dockerfile
    ports:
      - "5500:5500"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/subsbuzz_dev
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    networks:
      - subsbuzz-network

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: subsbuzz_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_dev:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - subsbuzz-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_dev:/data
    networks:
      - subsbuzz-network

  adminer:
    image: adminer:latest
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    networks:
      - subsbuzz-network

volumes:
  postgres_dev:
  redis_dev:
  node_modules:

networks:
  subsbuzz-network:
    driver: bridge
```

### Docker Compose (Production)
```yaml
version: '3.8'

services:
  app:
    image: subsbuzz:latest
    ports:
      - "5500:5500"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - subsbuzz-network
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    networks:
      - subsbuzz-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - subsbuzz-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - subsbuzz-network

volumes:
  postgres_data:
  redis_data:

networks:
  subsbuzz-network:
    driver: bridge
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: subsbuzz_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run type checking
      run: npm run check
    
    - name: Run tests
      run: npm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/subsbuzz_test
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Run dependency scan
      uses: snyk/actions/node@master
      with:
        args: --severity-threshold=high

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker image
      run: |
        docker build -t subsbuzz:${{ github.sha }} .
        docker tag subsbuzz:${{ github.sha }} subsbuzz:latest
    
    - name: Test Docker image
      run: |
        docker run --rm subsbuzz:latest npm run check

  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to staging
      run: |
        # Deploy to staging environment
        echo "Deploying to staging..."
    
    - name: Run smoke tests
      run: |
        # Run smoke tests against staging
        echo "Running smoke tests..."
    
    - name: Deploy to production
      run: |
        # Deploy to production
        echo "Deploying to production..."
```

## Environment Management

### Environment Structure
```
environments/
├── development/
│   ├── docker-compose.yml
│   ├── .env.example
│   └── nginx/
├── staging/
│   ├── docker-compose.yml
│   ├── .env.staging
│   └── nginx/
└── production/
    ├── docker-compose.yml
    ├── .env.production
    └── nginx/
```

### Environment Variables
```bash
# environments/production/.env.production
NODE_ENV=production
PORT=5500

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/subsbuzz_prod
REDIS_URL=redis://redis:6379

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Firebase
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Security
SESSION_SECRET=...
ENCRYPTION_KEY=...

# Monitoring
SENTRY_DSN=...
LOG_LEVEL=info
```

### Secrets Management
```bash
# Using Docker Secrets
docker secret create openai_key openai_key.txt
docker secret create google_client_secret google_secret.txt
docker secret create firebase_private_key firebase_key.txt

# Using environment-specific files
.env.development.local
.env.staging.local
.env.production.local
```

## Deployment Strategies

### Blue-Green Deployment
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

# Build new version
docker build -t subsbuzz:$VERSION .

# Deploy to green environment
docker-compose -f docker-compose.green.yml up -d

# Health check
./scripts/health-check.sh green

# Switch traffic
./scripts/switch-traffic.sh green

# Monitor for issues
./scripts/monitor.sh

# If successful, cleanup blue
docker-compose -f docker-compose.blue.yml down
```

### Rolling Updates
```yaml
# docker-compose.yml - Rolling update configuration
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
    failure_action: rollback
    max_failure_ratio: 0.1
  rollback_config:
    parallelism: 1
    delay: 10s
```

### Database Migrations
```bash
#!/bin/bash
# scripts/migrate.sh

# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run db:push

# Verify migration
npm run db:verify
```

## Production Infrastructure

### Load Balancer Configuration
```nginx
# nginx/nginx.conf
upstream app {
    server app1:5500;
    server app2:5500;
    server app3:5500;
}

server {
    listen 80;
    server_name subsbuzz.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name subsbuzz.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Health Checks
```typescript
// server/health.ts
export const healthCheck = async (req: Request, res: Response) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    openai: await checkOpenAI(),
    gmail: await checkGmailAPI(),
    disk: await checkDiskSpace(),
    memory: await checkMemoryUsage(),
  };

  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
};
```

## Monitoring & Observability

### Monitoring Stack
```yaml
# monitoring/docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    
  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    environment:
      - DATA_SOURCE_NAME=postgresql://user:password@postgres:5432/subsbuzz?sslmode=disable
    ports:
      - "9187:9187"

volumes:
  grafana_data:
```

### Logging Strategy
```typescript
// server/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## Backup & Recovery

### Database Backup
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/subsbuzz_$TIMESTAMP.sql"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to cloud storage
aws s3 cp $BACKUP_FILE.gz s3://subsbuzz-backups/

# Clean old backups (keep last 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

### Disaster Recovery
```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1

# Stop application
docker-compose down

# Restore database
gunzip -c $BACKUP_FILE | psql $DATABASE_URL

# Restart application
docker-compose up -d

# Verify restoration
./scripts/health-check.sh
```

## Security Considerations

### SSL/TLS Configuration
```nginx
# nginx/ssl.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_stapling on;
ssl_stapling_verify on;
```

### Security Headers
```typescript
// server/middleware/security.ts
import helmet from 'helmet';

export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});
```

## Performance Optimization

### CDN Configuration
```yaml
# CDN configuration for static assets
cloudfront:
  origins:
    - domain: subsbuzz.com
      path: /static
  behaviors:
    - path: "*.js"
      cache_policy: max-age=31536000
    - path: "*.css"
      cache_policy: max-age=31536000
    - path: "*.png"
      cache_policy: max-age=31536000
```

### Database Optimization
```sql
-- Database performance indexes
CREATE INDEX CONCURRENTLY idx_digest_emails_digest_id ON digest_emails(digest_id);
CREATE INDEX CONCURRENTLY idx_digest_emails_sender ON digest_emails(sender);
CREATE INDEX CONCURRENTLY idx_digest_emails_received_at ON digest_emails(received_at);
CREATE INDEX CONCURRENTLY idx_thematic_sections_digest_id ON thematic_sections(thematic_digest_id);
```

## Deployment Checklist

### Pre-Deployment
- [ ] Run full test suite
- [ ] Security audit passed
- [ ] Database migrations prepared
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Backup created

### Deployment
- [ ] Deploy to staging
- [ ] Smoke tests passed
- [ ] Performance tests passed
- [ ] Deploy to production
- [ ] Health checks passed
- [ ] Monitoring active

### Post-Deployment
- [ ] Application responding correctly
- [ ] All features working
- [ ] Performance within acceptable limits
- [ ] Error rates normal
- [ ] User notifications sent (if applicable)
- [ ] Documentation updated

## Rollback Strategy

### Automatic Rollback
```bash
#!/bin/bash
# scripts/auto-rollback.sh

# Monitor error rate
ERROR_RATE=$(curl -s http://localhost:5500/metrics | grep error_rate | awk '{print $2}')

if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
  echo "Error rate too high, rolling back..."
  docker-compose -f docker-compose.previous.yml up -d
  ./scripts/health-check.sh
fi
```

### Manual Rollback
```bash
#!/bin/bash
# scripts/rollback.sh

VERSION=$1

# Switch to previous version
docker-compose down
docker tag subsbuzz:$VERSION subsbuzz:current
docker-compose up -d

# Verify rollback
./scripts/health-check.sh
```

This comprehensive deployment strategy ensures reliable, secure, and scalable production operations for SubsBuzz.