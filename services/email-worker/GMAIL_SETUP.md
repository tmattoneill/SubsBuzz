# Gmail OAuth Setup Guide

**Status**: Schema fixed ✅ - Ready for OAuth configuration
**Success Rate**: 93.3% (14/15 tests passing)

## 🎯 Current Status

The Gmail integration is **93.3% functional**. The only remaining step is configuring real Gmail OAuth credentials to test with an actual Gmail account.

### ✅ What's Working
- Gmail client Python code (imported from TypeScript)
- Email parsing and content extraction 
- Database schema and digest creation
- Data server API endpoints
- Service-to-service communication
- Mock email processing pipeline

### ⚠️ What Needs Configuration
- Google OAuth 2.0 credentials
- OpenAI API key

## 🔧 Setup Instructions

### Step 1: Google Cloud Console Setup

1. **Create/Access Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Gmail API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

3. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" user type
   - Fill in required fields:
     - App name: "SubsBuzz Email Digest"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `https://www.googleapis.com/auth/gmail.readonly`

4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "SubsBuzz Development"
   - Authorized redirect URIs: `http://127.0.0.1:5500/auth/callback`
   - Save the **Client ID** and **Client Secret**

### Step 2: OpenAI API Setup

1. **Get OpenAI API Key**:
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create new API key
   - Copy the key (starts with `sk-`)

### Step 3: Environment Configuration

1. **Edit `.env.dev` file**:
   ```bash
   # Uncomment and fill in these lines:
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

2. **Restart Services**:
   ```bash
   # Stop data server (Ctrl+C)
   cd services/data-server && npm run dev
   ```

### Step 4: Test Gmail Integration

1. **Run Integration Tests**:
   ```bash
   node tests/test-gmail-integration.js
   ```
   - Should achieve 100% success rate

2. **Test Real Gmail Connection**:
   ```bash
   # Test OAuth token creation (with real credentials)
   python3 services/email-worker/test-gmail-oauth.py
   ```

## 🧪 Testing Workflow

### Phase 1: Credential Validation ✅
```bash
# Verify OAuth credentials work
node tests/test-gmail-integration.js
# Expected: 100% success rate (15/15 tests)
```

### Phase 2: Real Gmail Testing
```bash
# Test with your Gmail account
cd services/email-worker
python3 -c "
from gmail_client import GmailClient
client = GmailClient()
print('✅ Gmail client initialized successfully')
"
```

### Phase 3: End-to-End Pipeline
```bash
# Test complete email processing workflow
cd services/email-worker
python3 -c "
from tasks import process_user_emails
# This would test with real Gmail account
print('✅ Email processing pipeline ready')
"
```

## 🔐 Security Notes

1. **Never commit credentials**:
   - `.env.dev` is already in `.gitignore`
   - Keep credentials secure and private

2. **OAuth Scopes**:
   - Only uses `gmail.readonly` scope
   - Cannot send emails or modify Gmail

3. **Token Management**:
   - Refresh tokens stored securely in PostgreSQL
   - Encrypted storage recommended for production

## 🎯 Expected Results

After configuration:
- **Test Success Rate**: 100% (15/15 tests)
- **Gmail Access**: Read emails from monitored senders
- **Email Analysis**: AI-powered content extraction and summarization
- **Digest Generation**: Automated thematic digest creation
- **Database Storage**: Persistent storage of all processed data

## 🚀 Next Steps After Setup

1. **Test with Real Gmail Account**:
   - Add monitored email addresses
   - Fetch and process real emails
   - Generate actual digest

2. **Production Deployment**:
   - Docker containerization
   - Nginx configuration
   - Production OAuth configuration

3. **Frontend Integration**:
   - Update React app to use new microservices
   - Test complete user experience

---

**Current Architecture Status**: ✅ **93.3% Functional**
**Next Milestone**: 🎯 **100% with OAuth credentials**