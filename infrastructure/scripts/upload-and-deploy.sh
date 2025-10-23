#!/bin/bash
set -e

# SubsBuzz Server Upload and Deployment Script
# Uploads files to server and runs development deployment

echo "🚀 SubsBuzz Development Deployment to dev.subsbuzz.com"

# Configuration
SERVER="subsbuzz"      # Your SSH host alias from ~/.ssh/config
USER=""                # Not needed when using SSH host alias
DEV_DIR="/home/webdev/sites/dev.subsbuzz.com"
DEPLOY_DATE=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Pre-flight checks
log "🔍 Running pre-flight checks..."

# Check if we're in the SubsBuzz directory
if [[ ! -f "docker-compose.dev.yml" ]]; then
    error "docker-compose.dev.yml not found. Run this script from the SubsBuzz root directory."
fi

# Check if we can reach the server
log "🌐 Testing connection to $SERVER..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" "echo 'Connection successful'" 2>/dev/null; then
    error "Cannot connect to $SERVER. Please check your SSH configuration."
fi

success "Pre-flight checks passed"

# Create deployment package
log "📦 Creating deployment package..."
TEMP_DIR=$(mktemp -d)
PACKAGE_FILE="subsbuzz-dev-$DEPLOY_DATE.tar.gz"

# Copy files to temp directory (excluding unnecessary files)
rsync -av \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.env*' \
    --exclude='logs/' \
    --exclude='tmp/' \
    . "$TEMP_DIR/"

# Create compressed package
cd "$TEMP_DIR"
tar -czf "/tmp/$PACKAGE_FILE" .
cd - > /dev/null

success "Package created: /tmp/$PACKAGE_FILE"

# Upload package to server
log "📤 Uploading package to server..."
scp "/tmp/$PACKAGE_FILE" "$SERVER:/tmp/"
success "Package uploaded to server"

# Extract and deploy on server
log "🚀 Deploying on server..."

ssh "$SERVER" << EOF
set -e

echo "🔧 Setting up deployment environment..."

# Create backup of existing directory if it has content
if [[ -d "$DEV_DIR" ]] && [[ "\$(ls -A $DEV_DIR 2>/dev/null)" ]]; then
    echo "💾 Creating backup of existing files..."
    sudo cp -r "$DEV_DIR" "/tmp/dev-backup-$DEPLOY_DATE" || true
fi

# Create/clean development directory
sudo mkdir -p "$DEV_DIR"
sudo rm -rf "$DEV_DIR"/*

# Extract new files
echo "📁 Extracting files..."
cd "$DEV_DIR"
sudo tar -xzf "/tmp/$PACKAGE_FILE"
sudo chown -R webdev:webdev "$DEV_DIR"

# Copy environment template
echo "⚙️  Setting up environment template..."
cp .env.dev-staging .env
echo "⚠️  IMPORTANT: Edit .env file with your actual credentials before deployment!"

echo "✅ Files extracted to $DEV_DIR"
echo ""
echo "📋 Next steps:"
echo "1. Edit environment file: nano $DEV_DIR/.env"
echo "2. Set up SSL certificate: sudo $DEV_DIR/infrastructure/ssl/setup-dev-ssl.sh"
echo "3. Run deployment: cd $DEV_DIR && ./infrastructure/scripts/deploy-dev.sh"
echo ""
EOF

success "Files deployed to server"

# Cleanup local temp files
rm -rf "$TEMP_DIR"
rm -f "/tmp/$PACKAGE_FILE"

# Display next steps
echo ""
log "🎯 Deployment package uploaded successfully!"
echo ""
echo "📋 Next steps on the server:"
echo ""
echo "1. 🔐 SSH to server:"
echo "   ssh $SERVER"
echo ""
echo "2. ⚙️  Configure environment:"
echo "   cd $DEV_DIR"
echo "   nano .env"
echo "   # Add your actual credentials:"
echo "   # - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
echo "   # - OPENAI_API_KEY"
echo "   # - FIREBASE credentials"
echo ""
echo "3. 🔒 Set up SSL certificate:"
echo "   sudo ./infrastructure/ssl/setup-dev-ssl.sh"
echo ""
echo "4. 🚀 Deploy the application:"
echo "   ./infrastructure/scripts/deploy-dev.sh"
echo ""
echo "5. 🌐 Access your development environment:"
echo "   https://dev.subsbuzz.com"
echo ""

warning "Remember to configure OAuth redirect URI in Google Cloud Console:"
echo "   https://dev.subsbuzz.com/auth/callback"

echo ""
success "🎉 Ready for server-side deployment!"