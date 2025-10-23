# 🚀 SubsBuzz Development Deployment Guide

Complete guide for deploying SubsBuzz to `dev.subsbuzz.com` with isolated Docker environment.

## 🎯 Overview

This deployment creates a completely isolated development environment that:
- ✅ **Does NOT interfere** with production subsbuzz.com
- ✅ **Uses different ports** (5501, 8001, 3002, 5433, 6380)
- ✅ **Has password protection** via HTTP Basic Auth
- ✅ **Includes SSL certificate** via Let's Encrypt
- ✅ **Runs in Docker containers** for consistency
- ✅ **Supports hot reloading** for development

## 📋 Prerequisites

1. **Server Access**: SSH access to the subsbuzz.com server
2. **Domain Setup**: `dev.subsbuzz.com` DNS pointing to server IP
3. **Credentials**: Google OAuth, OpenAI API, and Firebase credentials
4. **Tools**: Docker, Docker Compose, nginx, certbot

## 🚀 Quick Deployment

### Step 1: Server Preparation

```bash
# SSH to your server
ssh user@your-server

# Upload SubsBuzz files to server
rsync -av --exclude='.git' --exclude='node_modules' . user@your-server:/tmp/subsbuzz/
```

### Step 2: SSL Certificate Setup

```bash
# On the server, run the SSL setup script
cd /tmp/subsbuzz
sudo ./infrastructure/ssl/setup-dev-ssl.sh
```

This will:
- Generate Let's Encrypt certificate for `dev.subsbuzz.com`
- Set up HTTP Basic Auth credentials
- Configure nginx with the development configuration

### Step 3: Environment Configuration

```bash
# Copy and edit the development environment file
cp .env.dev-staging .env.dev-staging.local

# Edit with your actual credentials
nano .env.dev-staging.local
```

**Required Environment Variables:**
```bash
# Google OAuth (create separate dev credentials)
GOOGLE_CLIENT_ID=your_dev_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_dev_secret_here

# OAuth Redirect URI (IMPORTANT!)
OAUTH_REDIRECT_URI=https://dev.subsbuzz.com/auth/callback

# OpenAI API Key
OPENAI_API_KEY=sk-proj-your_key_here

# Firebase Development Project
FIREBASE_PROJECT_ID=subsbuzz-dev
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_DEV_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-dev@subsbuzz-dev.iam.gserviceaccount.com
VITE_FIREBASE_API_KEY=your_dev_web_api_key
VITE_FIREBASE_PROJECT_ID=subsbuzz-dev
VITE_FIREBASE_APP_ID=1:123456789:web:your_dev_app_id
```

### Step 4: Deploy with Docker

```bash
# Run the automated deployment script
./infrastructure/scripts/deploy-dev.sh
```

This script will:
- Create isolated development directory
- Build Docker images for all services
- Start containers with health checks
- Verify all endpoints are working
- Display access information

## 🔧 Manual Deployment Steps

If you prefer manual control:

### 1. Setup Development Directory

```bash
sudo mkdir -p /opt/subsbuzz-dev
sudo cp -r . /opt/subsbuzz-dev/
cd /opt/subsbuzz-dev
cp .env.dev-staging .env
```

### 2. Configure Environment

Edit `.env` with your development credentials:

```bash
nano .env
```

### 3. Deploy Services

```bash
# Build and start all services
docker-compose -f docker-compose.dev.yml up -d --build

# Check service status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## 🌐 Service Architecture

### Port Allocation

| Service | Production | Development | External Access |
|---------|------------|-------------|-----------------|
| Frontend | 5500 | 5501 | https://dev.subsbuzz.com |
| API Gateway | 8000 | 8001 | https://dev.subsbuzz.com/api |
| Data Server | 3001 | 3002 | Internal only |
| PostgreSQL | 5432 | 5433 | Internal only |
| Redis | 6379 | 6380 | Internal only |
| Adminer | - | 8080 | http://dev.subsbuzz.com:8080 |

### Docker Network

Development uses isolated network `subsbuzz-dev-network` (172.20.0.0/16) to prevent conflicts.

## 🔐 Security Configuration

### HTTP Basic Auth

Development environment is protected with HTTP Basic Auth:
- **Setup**: During SSL configuration
- **Username/Password**: Set during `setup-dev-ssl.sh`
- **Access**: Required for all non-health endpoints

### SSL Certificate

- **Domain**: dev.subsbuzz.com
- **Provider**: Let's Encrypt
- **Renewal**: Automatic via cron
- **Protocols**: TLS 1.2, TLS 1.3

## 🧪 Testing & Validation

### Health Checks

```bash
# Test all service health
curl -f https://dev.subsbuzz.com/health

# Individual service checks
curl -f http://localhost:5501/  # Frontend
curl -f http://localhost:8001/health  # API Gateway
curl -f http://localhost:3002/health  # Data Server
```

### OAuth Integration

1. **Configure Google OAuth**:
   - Go to Google Cloud Console
   - Create new OAuth 2.0 credentials for development
   - Add redirect URI: `https://dev.subsbuzz.com/auth/callback`

2. **Test OAuth Flow**:
   - Visit `https://dev.subsbuzz.com`
   - Click "Connect Gmail"
   - Complete OAuth authorization
   - Verify successful login

### Database Testing

```bash
# Connect to development database
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d subsbuzz_dev

# Or use Adminer web interface
# Visit: http://dev.subsbuzz.com:8080
# Server: postgres, Username: postgres, Database: subsbuzz_dev
```

## 🛠️ Development Workflow

### Code Updates

```bash
# Update code on server
rsync -av --exclude='.git' --exclude='node_modules' . user@server:/opt/subsbuzz-dev/

# Rebuild and restart services
cd /opt/subsbuzz-dev
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d --build
```

### Log Monitoring

```bash
# View all service logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f api-gateway
docker-compose -f docker-compose.dev.yml logs -f data-server

# View nginx logs
sudo tail -f /var/log/nginx/dev-subsbuzz-access.log
sudo tail -f /var/log/nginx/dev-subsbuzz-error.log
```

### Database Management

```bash
# Access database shell
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d subsbuzz_dev

# Run database migrations
docker-compose -f docker-compose.dev.yml exec data-server npm run db:push

# Backup database
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U postgres subsbuzz_dev > dev-backup.sql
```

## 🔄 Maintenance Commands

### Service Management

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Restart specific service
docker-compose -f docker-compose.dev.yml restart api-gateway

# Scale services (if needed)
docker-compose -f docker-compose.dev.yml up -d --scale frontend=2

# Update single service
docker-compose -f docker-compose.dev.yml up -d --no-deps frontend
```

### Cleanup

```bash
# Remove all development containers and volumes
docker-compose -f docker-compose.dev.yml down -v

# Clean up unused Docker resources
docker system prune -a

# Remove development directory
sudo rm -rf /opt/subsbuzz-dev
```

### SSL Certificate Management

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

## 📊 Monitoring & Debugging

### Health Dashboard

Monitor service health at:
- **Overall**: https://dev.subsbuzz.com/health
- **API Gateway**: http://localhost:8001/health
- **Data Server**: http://localhost:3002/health

### Performance Monitoring

```bash
# View Docker stats
docker stats

# Check system resources
htop

# View nginx status
sudo systemctl status nginx
```

### Common Issues

**Port Conflicts**:
```bash
# Check what's using a port
netstat -tlpn | grep 5501
lsof -i :5501
```

**SSL Issues**:
```bash
# Test SSL certificate
openssl s_client -connect dev.subsbuzz.com:443 -servername dev.subsbuzz.com

# Check nginx configuration
sudo nginx -t
```

**Docker Issues**:
```bash
# View Docker daemon logs
sudo journalctl -u docker.service

# Check Docker network
docker network ls
docker network inspect subsbuzz-dev-network
```

## 🎯 Production Transition

When ready to deploy to production:

1. **Test thoroughly** on development environment
2. **Update environment** variables for production
3. **Modify ports** back to production values (5500, 8000, 3001)
4. **Update OAuth** redirect URIs to production domain
5. **Run production** deployment script

## 📞 Support

For issues:
1. Check logs: `docker-compose -f docker-compose.dev.yml logs`
2. Verify health: `curl https://dev.subsbuzz.com/health`
3. Test connectivity: `curl -I https://dev.subsbuzz.com`
4. Review nginx: `sudo tail -f /var/log/nginx/dev-subsbuzz-error.log`

## 📋 Checklist

Development deployment checklist:

- [ ] DNS configured for dev.subsbuzz.com
- [ ] SSL certificate generated and working
- [ ] HTTP Basic Auth configured
- [ ] Environment variables set correctly
- [ ] Google OAuth configured with dev redirect URI
- [ ] All Docker services healthy
- [ ] Frontend accessible at https://dev.subsbuzz.com
- [ ] API endpoints responding correctly
- [ ] OAuth login flow working
- [ ] Database accessible and initialized
- [ ] Log monitoring setup

🎉 **Development environment ready for testing!**