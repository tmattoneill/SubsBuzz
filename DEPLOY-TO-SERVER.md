# 🚀 Manual Deployment Guide for dev.subsbuzz.com

Since automated SSH deployment isn't available, here's a step-by-step manual deployment guide.

## 📦 Step 1: Upload Files to Server

### Option A: Using Git (Recommended)
```bash
# SSH to your server (using your usual username)
ssh your-username@subsbuzz.com

# Navigate to the dev directory
cd /home/webdev/sites/dev.subsbuzz.com

# Clone the repository
git clone https://github.com/tmattoneill/SubsBuzz.git .

# Or if already cloned, pull latest changes
git pull origin main
```

### Option B: Using SCP/RSYNC
```bash
# From your local machine, upload the files
rsync -av --exclude='.git' --exclude='node_modules' --exclude='*.log' \
    /Users/thomasoneill/Library/CloudStorage/Dropbox/dev/SubsBuzz/ \
    your-username@subsbuzz.com:/home/webdev/sites/dev.subsbuzz.com/

# Or using SCP
scp -r /Users/thomasoneill/Library/CloudStorage/Dropbox/dev/SubsBuzz/* \
    your-username@subsbuzz.com:/home/webdev/sites/dev.subsbuzz.com/
```

## ⚙️ Step 2: Configure Environment on Server

SSH to your server and run:

```bash
# Navigate to the development directory
cd /home/webdev/sites/dev.subsbuzz.com

# Copy the environment template
cp .env.dev-staging .env

# Edit with your actual credentials
nano .env
```

### 🔑 Required Environment Variables

Update these in the `.env` file:

```bash
# Google OAuth Credentials (create dev-specific ones)
GOOGLE_CLIENT_ID=your_dev_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_dev_secret_here

# Important: OAuth Redirect URI for development
OAUTH_REDIRECT_URI=https://dev.subsbuzz.com/auth/callback

# OpenAI API Key (can use same as production or separate for cost tracking)
OPENAI_API_KEY=sk-proj-your_key_here

# Firebase Development Project (create separate dev project)
FIREBASE_PROJECT_ID=subsbuzz-dev
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_DEV_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-dev@subsbuzz-dev.iam.gserviceaccount.com

# Firebase Client Configuration
VITE_FIREBASE_API_KEY=your_dev_web_api_key
VITE_FIREBASE_PROJECT_ID=subsbuzz-dev
VITE_FIREBASE_APP_ID=1:123456789:web:your_dev_app_id

# Database passwords (change these!)
POSTGRES_PASSWORD=your_secure_dev_password_2025
```

## 🔒 Step 3: Set Up SSL Certificate

```bash
# Make sure you're in the project directory
cd /home/webdev/sites/dev.subsbuzz.com

# Run the SSL setup script
sudo ./infrastructure/ssl/setup-dev-ssl.sh
```

This will:
- Generate Let's Encrypt certificate for `dev.subsbuzz.com`
- Set up HTTP Basic Auth protection
- Configure nginx with development settings
- Set up automatic certificate renewal

**When prompted:**
- Enter an email for Let's Encrypt notifications
- Create username/password for development access
- Optionally create admin credentials

## 🐳 Step 4: Install Docker (if not already installed)

```bash
# Update system
sudo apt update

# Install Docker
sudo apt install -y docker.io docker-compose-plugin

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add user to docker group (replace 'webdev' with your username)
sudo usermod -aG docker webdev

# Log out and log back in for group changes to take effect
exit
# SSH back in
```

## 🚀 Step 5: Deploy the Application

```bash
# Navigate to the project directory
cd /home/webdev/sites/dev.subsbuzz.com

# Make deployment script executable
chmod +x infrastructure/scripts/deploy-dev.sh

# Run the deployment
./infrastructure/scripts/deploy-dev.sh
```

This script will:
- Create isolated development directory
- Build all Docker images
- Start microservices with health checks
- Verify all endpoints are working
- Display access information

## 🧪 Step 6: Test the Deployment

### Test Basic Access
```bash
# Test SSL certificate
curl -I https://dev.subsbuzz.com

# Test health endpoint (should work without auth)
curl https://dev.subsbuzz.com/health

# Test API endpoint (will prompt for basic auth)
curl -u username:password https://dev.subsbuzz.com/api/health
```

### Test Services Directly
```bash
# Check Docker services
docker-compose -f docker-compose.dev.yml ps

# Test individual services
curl http://localhost:5501/        # Frontend
curl http://localhost:8001/health  # API Gateway
curl http://localhost:3002/health  # Data Server
```

### Check Logs
```bash
# View all service logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f api-gateway

# Check nginx logs
sudo tail -f /var/log/nginx/dev-subsbuzz-access.log
sudo tail -f /var/log/nginx/dev-subsbuzz-error.log
```

## 🔧 Step 7: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project for development OR use existing project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. **Important**: Add this redirect URI:
   ```
   https://dev.subsbuzz.com/auth/callback
   ```
6. Update your `.env` file with the new credentials

## ✅ Step 8: Verify Everything Works

1. **Access the site**: https://dev.subsbuzz.com
   - Should prompt for basic auth credentials
   - Should load the SubsBuzz frontend

2. **Test OAuth login**:
   - Click "Connect Gmail"
   - Should redirect to Google OAuth
   - Should redirect back to dev.subsbuzz.com after authorization

3. **Test API endpoints**:
   - Check health: https://dev.subsbuzz.com/health
   - Test API: https://dev.subsbuzz.com/api/health

## 🛠️ Troubleshooting

### SSL Issues
```bash
# Check certificate status
sudo certbot certificates

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Docker Issues
```bash
# Check Docker status
sudo systemctl status docker

# View Docker logs
docker-compose -f docker-compose.dev.yml logs

# Restart services
docker-compose -f docker-compose.dev.yml restart
```

### Port Conflicts
```bash
# Check what's using development ports
netstat -tlpn | grep 5501
netstat -tlpn | grep 8001
netstat -tlpn | grep 3002
```

### Permission Issues
```bash
# Fix directory permissions
sudo chown -R webdev:webdev /home/webdev/sites/dev.subsbuzz.com
chmod +x infrastructure/scripts/*.sh
```

## 📊 Expected Results

After successful deployment:

- ✅ **Frontend**: https://dev.subsbuzz.com (with basic auth)
- ✅ **API**: https://dev.subsbuzz.com/api/health
- ✅ **SSL**: Valid Let's Encrypt certificate
- ✅ **Docker**: All 6 services running and healthy
- ✅ **OAuth**: Working Gmail authentication
- ✅ **Database**: PostgreSQL accessible via Adminer at port 8080

## 🎯 Next Steps

Once deployment is successful:
1. Test complete OAuth workflow
2. Add monitored email addresses
3. Test digest generation
4. Verify email processing pipeline

## 📞 Need Help?

If you encounter issues:
1. Check the logs: `docker-compose -f docker-compose.dev.yml logs`
2. Verify SSL: `curl -I https://dev.subsbuzz.com`
3. Test Docker: `docker ps`
4. Check nginx: `sudo nginx -t`

The development environment should be fully functional and isolated from your production site!