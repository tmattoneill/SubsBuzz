#!/bin/bash
set -e

# SubsBuzz Ubuntu 24 LTS Server Setup Script
# This script prepares the server for SubsBuzz microservices deployment

echo "🚀 Setting up Ubuntu 24 LTS server for SubsBuzz..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
echo "🔧 Installing essential packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    htop \
    ufw \
    fail2ban

# Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    sudo apt install -y docker.io docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker ubuntu
    echo "✅ Docker installed successfully"
else
    echo "✅ Docker already installed"
fi

# Install Nginx
echo "🌐 Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    echo "✅ Nginx installed successfully"
else
    echo "✅ Nginx already installed"
fi

# Install Certbot for SSL certificates
echo "🔒 Installing Certbot for SSL..."
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed successfully"
else
    echo "✅ Certbot already installed"
fi

# Configure UFW firewall
echo "🔥 Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
echo "✅ Firewall configured"

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/subsbuzz
sudo chown ubuntu:ubuntu /opt/subsbuzz
echo "✅ Application directory created"

# Create log directories
echo "📋 Creating log directories..."
sudo mkdir -p /var/log/subsbuzz
sudo chown ubuntu:ubuntu /var/log/subsbuzz
echo "✅ Log directories created"

# Configure log rotation
echo "🔄 Setting up log rotation..."
sudo tee /etc/logrotate.d/subsbuzz > /dev/null <<EOF
/var/log/subsbuzz/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload subsbuzz || true
    endscript
}
EOF
echo "✅ Log rotation configured"

# Configure fail2ban for additional security
echo "🛡️  Configuring fail2ban..."
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
echo "✅ Fail2ban configured"

# Set up automatic security updates
echo "🔄 Setting up automatic security updates..."
sudo apt install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades
sudo systemctl enable unattended-upgrades
echo "✅ Automatic security updates enabled"

# Display next steps
echo ""
echo "🎉 Ubuntu server setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your SubsBuzz application files to /opt/subsbuzz"
echo "2. Create your .env file with production secrets"
echo "3. Configure nginx with your domain:"
echo "   sudo cp /opt/subsbuzz/infrastructure/nginx/subsbuzz.conf /etc/nginx/sites-available/"
echo "   sudo ln -s /etc/nginx/sites-available/subsbuzz /etc/nginx/sites-enabled/"
echo "   sudo rm /etc/nginx/sites-enabled/default"
echo "4. Set up SSL certificate:"
echo "   sudo certbot --nginx -d your-domain.com"
echo "5. Install and enable the SubsBuzz systemd service:"
echo "   sudo cp /opt/subsbuzz/infrastructure/systemd/subsbuzz.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable subsbuzz"
echo "   sudo systemctl start subsbuzz"
echo ""
echo "📊 Server status:"
echo "🐳 Docker: $(docker --version)"
echo "🌐 Nginx: $(nginx -v 2>&1)"
echo "🔒 Certbot: $(certbot --version)"
echo "🔥 UFW: $(sudo ufw status)"