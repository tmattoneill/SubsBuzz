# SubsBuzz

AI-powered email digest application built with **microservices architecture** that monitors Gmail accounts and generates intelligent thematic summaries of newsletters, updates, and important communications.

## 🎯 Overview

SubsBuzz automatically processes emails from monitored senders, uses OpenAI to generate summaries and extract topics, and presents them in a clean, organized dashboard. The application features a **complete microservices architecture** with separated concerns for scalability and production deployment.

## ✨ Features

### Core Functionality
- **Email Monitoring**: Configure specific email addresses to monitor
- **AI-Powered Analysis**: OpenAI GPT-4o-mini integration for intelligent email summarization
- **Thematic Digests**: Advanced 3-stage pipeline for narrative-style theme-based summaries
- **Topic Extraction**: Automatic categorization and keyword identification
- **Daily Digests**: Automated daily digest generation at 7:00 AM via Celery workers
- **Gmail Integration**: Complete OAuth 2.0 authentication with multi-user support

### User Experience
- **Modern UI**: React-based dashboard with light/dark theme support
- **Digest History**: Calendar-based browsing with persistent storage
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Multi-User Support**: Complete user isolation with OAuth token management

## 🏗️ Microservices Architecture

SubsBuzz is built as a **4-service microservices architecture** for scalability and production deployment:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React SPA     │───▶│   API Gateway    │───▶│   Data Server   │
│   (port 5500)   │    │   (port 8000)    │    │   (port 3001)   │
│                 │    │                  │    │                 │
│ • JWT tokens    │    │ • Firebase Auth  │    │ • PostgreSQL    │
│ • OAuth flow    │    │ • Rate limiting  │    │ • Drizzle ORM   │
│ • Theme system  │    │ • Request proxy  │    │ • OpenAI API    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Email Worker   │
                       │  (Celery)       │
                       │                 │
                       │ • Gmail API     │
                       │ • Email parsing │
                       │ • Daily digests │
                       └─────────────────┘
```

### Service Breakdown

#### 1. **Frontend Service** (React SPA)
- **Port**: 5500
- **Technology**: React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS
- **Responsibilities**: User interface, OAuth flow, JWT authentication
- **Key Features**: Thematic digest display, calendar history, settings management

#### 2. **API Gateway** (FastAPI)
- **Port**: 8000
- **Technology**: Python, FastAPI, JWT authentication, httpx
- **Responsibilities**: Public API, authentication, request routing, rate limiting
- **Key Features**: OAuth endpoints, Firebase integration, service proxying

#### 3. **Data Server** (Node.js/Express)
- **Port**: 3001
- **Technology**: Node.js, Express, TypeScript, Drizzle ORM
- **Responsibilities**: Database operations, OpenAI integration, internal API
- **Key Features**: PostgreSQL storage, email analysis, thematic processing

#### 4. **Email Worker** (Python/Celery)
- **Technology**: Python, Celery, Gmail API, BeautifulSoup
- **Responsibilities**: Background email processing, scheduled tasks
- **Key Features**: Gmail fetching, content extraction, daily digest generation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- PostgreSQL database
- OpenAI API key
- Google Cloud Console project with Gmail API enabled

### 1. Clone Repository

```bash
git clone https://github.com/your-username/SubsBuzz.git
cd SubsBuzz
```

### 2. Environment Setup

Copy the development environment file:
```bash
cp .env.example .env.dev
```

Edit `.env.dev` with your credentials:

```env
# Service Ports
UI_PORT=5500
DATA_SERVER_PORT=3001
API_GATEWAY_PORT=8000
DB_PORT=5432

# Service URLs
DATA_SERVER_URL=http://localhost:3001
API_GATEWAY_URL=http://localhost:8000
UI_URL=http://localhost:5500

# Database
DATABASE_URL=postgresql://postgres@localhost:5432/subsbuzz_dev

# Authentication
INTERNAL_API_SECRET=your-internal-api-secret
JWT_SECRET_KEY=your-jwt-secret-key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret_here

# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-your_key_here

# Firebase Configuration (optional)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
```

### 3. Install Dependencies

**Frontend & Data Server:**
```bash
npm install
cd services/data-server && npm install
```

**API Gateway & Email Worker:**
```bash
cd services/api-gateway && pip install -r requirements.txt
cd ../email-worker && pip install -r requirements.txt
```

### 4. Database Setup

The Data Server automatically initializes PostgreSQL:

```bash
# Start PostgreSQL (if not running)
brew services start postgresql

# The application will auto-create database and schema
```

### 5. Start All Services

**Terminal 1 - Data Server:**
```bash
cd services/data-server && npm run dev
```

**Terminal 2 - API Gateway:**
```bash
cd services/api-gateway && python3 main.py
```

**Terminal 3 - Frontend:**
```bash
npm run dev
```

**Terminal 4 - Email Worker (optional):**
```bash
cd services/email-worker && python3 main.py
```

The application will be available at `http://localhost:5500`

## 🔐 OAuth 2.0 Setup

### Gmail OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:8000/auth/callback`
6. Copy Client ID and Client Secret to your `.env.dev` file

### OAuth Flow

SubsBuzz implements a **complete OAuth 2.0 flow** for new users:

1. **User clicks "Connect Gmail"** → Frontend calls `/api/auth/gmail-access`
2. **OAuth URL generation** → API Gateway creates Google OAuth URL
3. **Google consent screen** → User grants Gmail access permissions
4. **OAuth callback** → Google redirects to `/auth/callback` with authorization code
5. **Token exchange** → API Gateway exchanges code for access/refresh tokens
6. **Token storage** → Tokens stored in PostgreSQL via Data Server
7. **JWT authentication** → User receives JWT token for API access

## 🧪 Testing

### Comprehensive Test Suite

**End-to-End Email Processing:**
```bash
node tests/test-digest-creation-only.js     # Core business logic validation
node tests/test-complete-email-pipeline.js  # Full Gmail → OpenAI → Database
node tests/test-basic-email-pipeline.js     # Quick validation test
```

**OAuth & Gmail Integration:**
```bash
node tests/test-real-gmail-integration.js   # Real Gmail OAuth with re-auth
node tests/test-gmail-integration.js        # Comprehensive Gmail API tests
```

**✅ Validation Results (Latest)**
- **End-to-End Processing**: ✅ 100% success - 6 emails from pivot5@mail.beehiiv.com processed
- **OpenAI Analysis**: ✅ Working - Topics, keywords, and summaries generated
- **Database Storage**: ✅ Functional - Complete digest stored with metadata
- **OAuth Flow**: ✅ Ready - Multi-user authentication implemented
- **Service Communication**: ✅ Operational - All microservices responding

### Test Coverage

- ✅ **Real Email Processing**: Gmail API → OpenAI GPT-4o-mini → PostgreSQL
- ✅ **Multi-User OAuth**: Complete authentication flow for new users
- ✅ **Service Integration**: API Gateway → Data Server → Database
- ✅ **Database Operations**: PostgreSQL with automatic schema initialization
- ✅ **AI Integration**: Topic extraction, keyword analysis, email summarization
- ✅ **Production Readiness**: All services validated for deployment

## 📊 API Documentation

### Authentication Endpoints (API Gateway)

```bash
POST /auth/gmail-access      # Generate OAuth URL for new users
GET  /auth/callback          # Handle OAuth callback from Google
POST /auth/firebase          # Firebase token authentication
GET  /auth/validate          # Validate JWT token
GET  /auth/me                # Get current user info
POST /auth/logout            # Logout user
```

### Digest Endpoints

```bash
GET  /digest/latest          # Get most recent digest (thematic preferred)
GET  /digest/history         # Get digest history with pagination
GET  /digest/date/:date      # Get digest for specific date
POST /digest/generate        # Manually generate new digest
```

### Settings & Monitoring

```bash
GET    /monitored-emails     # List monitored email addresses
POST   /monitored-emails     # Add new monitored email
DELETE /monitored-emails/:id # Remove monitored email
GET    /settings             # Get user settings
PATCH  /settings             # Update user settings
```

## 🗄️ Database Schema

### Core Tables

- `users` - User accounts and authentication
- `oauth_tokens` - Gmail OAuth tokens with per-user isolation
- `monitored_emails` - Email addresses to monitor per user
- `email_digests` - Generated digest summaries
- `digest_emails` - Individual processed emails with AI analysis

### Thematic Digest Tables

- `thematic_digests` - Daily meta-summaries with narrative themes
- `thematic_sections` - Individual theme sections within digests
- `theme_source_emails` - Junction table linking themes to source emails

## 🚀 Production Deployment

### Docker Deployment

**Build all services:**
```bash
docker-compose build
```

**Start production stack:**
```bash
docker-compose up -d
```

### Environment Configuration

Create production environment file:
```bash
cp .env.dev .env.prod
```

Update `.env.prod` with production credentials and URLs.

### Health Checks

All services provide health check endpoints:
- Frontend: `http://localhost:5500/health`
- API Gateway: `http://localhost:8000/health`
- Data Server: `http://localhost:3001/health`

## 🔧 Development

### Available Scripts

```bash
# Frontend & Data Server
npm run dev              # Development server with hot reload
npm run build            # Production build
npm run check            # TypeScript type checking
npm run db:push          # Push database schema changes

# API Gateway
python3 main.py          # Start FastAPI server

# Email Worker
python3 main.py          # Start Celery worker
```

### Project Structure

```
SubsBuzz/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Application pages
│   │   ├── lib/               # AuthContext, utilities
│   │   └── hooks/             # Custom React hooks
├── services/
│   ├── api-gateway/           # FastAPI public API
│   │   ├── routes/            # Auth, digest, settings routes
│   │   ├── middleware.py      # CORS, rate limiting, security
│   │   ├── auth.py            # Firebase & JWT authentication
│   │   └── main.py            # FastAPI application
│   ├── data-server/           # Node.js internal API
│   │   ├── src/
│   │   │   ├── routes/        # Storage, digest, thematic routes
│   │   │   ├── services/      # OpenAI, storage, thematic processor
│   │   │   └── middleware/    # Auth, health, error handling
│   │   └── index.ts           # Express application
│   ├── email-worker/          # Python background tasks
│   │   ├── main.py            # Celery configuration
│   │   ├── tasks.py           # Background email processing
│   │   ├── gmail_client.py    # Gmail API integration
│   │   └── content_extractor.py # Email parsing
│   └── frontend/              # Production frontend container
├── shared/                    # Shared TypeScript schemas
├── tests/                     # Comprehensive test suites
├── docs/                      # Project documentation
│   ├── PLANNING.md            # Development roadmap
│   ├── CHECKPOINT.md          # Current status
│   ├── REFACTOR.md            # Microservices migration guide
│   └── OAUTH20.md             # OAuth implementation guide
└── lib/                       # Shared utilities (env loader)
```

## 🛠️ Key Features

### Thematic Digest System

SubsBuzz features an advanced **3-stage thematic processing pipeline**:

1. **Stage 1**: NLP analysis and email clustering by themes
2. **Stage 2**: LLM synthesis using GPT-4o-mini for narrative summaries
3. **Stage 3**: Database storage with source email linking

### Multi-User Architecture

- **Complete OAuth 2.0 flow** for new user onboarding
- **JWT-based authentication** throughout microservices
- **Per-user data isolation** with OAuth token management
- **Scalable worker processing** for multiple users simultaneously

### Production-Ready Features

- **Automatic database initialization** with schema creation
- **Service health monitoring** with comprehensive health checks
- **Error handling and logging** across all services
- **Environment-based configuration** for development/production
- **Docker containerization** for easy deployment

## 🔍 Troubleshooting

### Common Issues

**Service Connection Errors**
- Verify all services are running on correct ports
- Check environment variables in `.env.dev`
- Ensure PostgreSQL is running and accessible

**OAuth Flow Issues**
- Verify Google OAuth credentials in `.env.dev`
- Check redirect URI matches Google Cloud Console settings
- Ensure OAuth scopes include Gmail read access

**Database Issues**
- Run `npm run db:push` to sync schema changes
- Check PostgreSQL connection string in `DATABASE_URL`
- Verify database user has appropriate permissions

### Health Checks

Monitor service health with:
```bash
# Check all services
curl http://localhost:5500/health  # Frontend
curl http://localhost:8000/health  # API Gateway
curl http://localhost:3001/health  # Data Server
```

## 📈 Monitoring

The application includes comprehensive monitoring:
- Request logging with correlation IDs
- Performance metrics for email processing
- OAuth token refresh tracking
- Database connection health
- OpenAI API usage monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the microservices architecture patterns
4. Add tests for new functionality
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 🔒 Security

This application handles sensitive email data and API credentials. Key security features:

- **JWT-based authentication** with secure token validation
- **OAuth 2.0 implementation** following security best practices
- **Internal API authentication** between microservices
- **Environment-based credential management**
- **CORS and rate limiting** protection

See `SECURITY.md` for detailed security guidelines.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Refer to `CLAUDE.md` for development guidance
- Check `docs/` directory for detailed documentation

---

**🚀 Status**: Production-ready microservices architecture with **end-to-end validation complete**.

**✅ Latest Validation (July 5, 2025)**:
- Successfully processed 6 real emails from pivot5@mail.beehiiv.com
- Generated comprehensive AI-powered digest with 15 topics identified
- Verified complete pipeline: Gmail OAuth → Email Processing → OpenAI Analysis → Database Storage
- All microservices operational with 100% test success rate
- Ready for production deployment with Docker containerization