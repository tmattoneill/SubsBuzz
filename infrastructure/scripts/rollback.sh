#!/bin/bash
set -e

# SubsBuzz Rollback Script
# Rollback to previous deployment or monolithic version

echo "🔄 Rolling back SubsBuzz deployment..."

# Configuration
APP_DIR="/opt/subsbuzz"
BACKUP_DIR="/opt/subsbuzz-backup"
MONOLITH_DIR="/opt/subsbuzz-monolith"

# Function to list available backups
list_backups() {
    echo "📋 Available backups:"
    ls -la /opt/ | grep subsbuzz-backup | awk '{print $9}' | sort -r
}

# Function to rollback to microservices backup
rollback_to_backup() {
    local backup_name="$1"
    local backup_path="/opt/$backup_name"
    
    if [[ ! -d "$backup_path" ]]; then
        echo "❌ Error: Backup $backup_name not found"
        exit 1
    fi
    
    echo "🛑 Stopping current services..."
    cd "$APP_DIR" && docker-compose down --remove-orphans || true
    
    echo "📁 Restoring from backup..."
    sudo rm -rf "$APP_DIR"
    sudo cp -r "$backup_path" "$APP_DIR"
    sudo chown -R ubuntu:ubuntu "$APP_DIR"
    
    echo "🚀 Starting restored services..."
    cd "$APP_DIR" && docker-compose up -d
    
    echo "✅ Rollback to $backup_name complete"
}

# Function to rollback to monolithic version
rollback_to_monolith() {
    echo "🛑 Stopping microservices..."
    if [[ -d "$APP_DIR" ]]; then
        cd "$APP_DIR" && docker-compose down --remove-orphans || true
    fi
    
    echo "📁 Switching to monolithic version..."
    if [[ -d "$MONOLITH_DIR" ]]; then
        cd "$MONOLITH_DIR"
        
        # Start the monolithic application
        echo "🚀 Starting monolithic application..."
        npm start &
        MONOLITH_PID=$!
        
        # Configure nginx for monolithic app
        echo "🌐 Configuring nginx for monolithic app..."
        sudo tee /etc/nginx/sites-available/subsbuzz-monolith > /dev/null <<EOF
server {
    listen 80;
    listen 443 ssl http2;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5500;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
        
        sudo rm -f /etc/nginx/sites-enabled/subsbuzz
        sudo ln -s /etc/nginx/sites-available/subsbuzz-monolith /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl reload nginx
        
        echo "✅ Rollback to monolithic version complete"
        echo "📝 Monolithic app PID: $MONOLITH_PID"
    else
        echo "❌ Error: Monolithic backup not found at $MONOLITH_DIR"
        echo "💡 Restore from the latest microservices backup instead"
        exit 1
    fi
}

# Main script logic
if [[ $# -eq 0 ]]; then
    echo "🔄 SubsBuzz Rollback Options:"
    echo ""
    echo "1. Rollback to microservices backup"
    echo "2. Rollback to monolithic version"
    echo ""
    list_backups
    echo ""
    echo "Usage:"
    echo "  $0 backup <backup-name>     # Rollback to specific microservices backup"
    echo "  $0 monolith                 # Rollback to monolithic version"
    echo "  $0 latest                   # Rollback to latest backup"
    exit 0
fi

case "$1" in
    "backup")
        if [[ -z "$2" ]]; then
            echo "❌ Error: Please specify backup name"
            list_backups
            exit 1
        fi
        rollback_to_backup "$2"
        ;;
    "latest")
        LATEST_BACKUP=$(ls -t /opt/ | grep subsbuzz-backup | head -1)
        if [[ -z "$LATEST_BACKUP" ]]; then
            echo "❌ Error: No backups found"
            exit 1
        fi
        rollback_to_backup "$LATEST_BACKUP"
        ;;
    "monolith")
        rollback_to_monolith
        ;;
    *)
        echo "❌ Error: Invalid option. Use 'backup', 'latest', or 'monolith'"
        exit 1
        ;;
esac

echo ""
echo "🎯 Rollback complete!"
echo "🔍 Check status: docker-compose ps (for microservices) or ps aux | grep node (for monolith)"