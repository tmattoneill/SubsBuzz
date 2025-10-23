#!/bin/bash
set -e

# SubsBuzz Deployment Script
# Deploy the SubsBuzz microservices to Ubuntu 24 LTS server

echo "🚀 Deploying SubsBuzz microservices..."

# Configuration
APP_DIR="/opt/subsbuzz"
BACKUP_DIR="/opt/subsbuzz-backup"
DEPLOY_DATE=$(date +%Y%m%d_%H%M%S)

# Check if we're in the right directory
if [[ ! -f "docker-compose.yml" ]]; then
    echo "❌ Error: docker-compose.yml not found. Run this script from the SubsBuzz root directory."
    exit 1
fi

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    echo "❌ Error: .env file not found. Copy .env.example to .env and configure it first."
    exit 1
fi

# Create backup of current deployment
if [[ -d "$APP_DIR" ]]; then
    echo "💾 Creating backup of current deployment..."
    sudo cp -r "$APP_DIR" "$BACKUP_DIR-$DEPLOY_DATE"
    echo "✅ Backup created at $BACKUP_DIR-$DEPLOY_DATE"
fi

# Copy files to application directory
echo "📁 Copying application files..."
sudo mkdir -p "$APP_DIR"
sudo cp -r . "$APP_DIR/"
sudo chown -R ubuntu:ubuntu "$APP_DIR"
echo "✅ Files copied to $APP_DIR"

# Change to application directory
cd "$APP_DIR"

# Pull latest Docker images
echo "🐳 Pulling Docker images..."
docker-compose pull --quiet
echo "✅ Docker images updated"

# Stop existing services
echo "🛑 Stopping existing services..."
docker-compose down --remove-orphans || true
echo "✅ Services stopped"

# Start services
echo "🚀 Starting services..."
docker-compose up -d --remove-orphans
echo "✅ Services started"

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
SERVICES=("frontend" "api-gateway" "data-server" "postgres" "redis")
HEALTHY=true

for service in "${SERVICES[@]}"; do
    if docker-compose ps "$service" | grep -q "Up (healthy)"; then
        echo "✅ $service: healthy"
    else
        echo "❌ $service: unhealthy"
        HEALTHY=false
    fi
done

if [[ "$HEALTHY" == "true" ]]; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "📊 Service status:"
    docker-compose ps
    echo ""
    echo "🌐 Application URLs:"
    echo "Frontend: https://your-domain.com"
    echo "API: https://your-domain.com/api"
    echo "Health: https://your-domain.com/health"
    echo ""
    echo "📋 Logs:"
    echo "docker-compose logs -f [service-name]"
else
    echo ""
    echo "❌ Deployment failed! Some services are unhealthy."
    echo "📋 Check logs: docker-compose logs"
    echo "🔄 Rollback: sudo ./infrastructure/scripts/rollback.sh"
    exit 1
fi

# Clean up old Docker images and containers
echo "🧹 Cleaning up old Docker images..."
docker system prune -f --filter "until=24h"
echo "✅ Cleanup complete"

# Configure nginx if not already done
if [[ ! -f "/etc/nginx/sites-enabled/subsbuzz" ]]; then
    echo "🌐 Configuring nginx..."
    sudo cp infrastructure/nginx/subsbuzz.conf /etc/nginx/sites-available/
    sudo ln -s /etc/nginx/sites-available/subsbuzz /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx configured"
fi

# Install systemd service if not already done
if [[ ! -f "/etc/systemd/system/subsbuzz.service" ]]; then
    echo "⚙️  Installing systemd service..."
    sudo cp infrastructure/systemd/subsbuzz.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable subsbuzz
    echo "✅ Systemd service installed"
fi

echo ""
echo "🎯 Deployment complete! Your SubsBuzz application is now running."