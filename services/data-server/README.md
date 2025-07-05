# SubsBuzz Data Server

The Data Server is a core microservice in the SubsBuzz architecture that handles all database operations, business logic, and complex data processing.

## Overview

The Data Server provides an internal REST API for:
- PostgreSQL database operations using Drizzle ORM
- Thematic digest processing with OpenAI integration
- User settings and preferences management
- OAuth token storage and management
- Email digest creation and retrieval

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for AI processing
- `INTERNAL_API_SECRET` - Shared secret for service-to-service auth
- `PORT` - Server port (default: 3001)

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Storage Operations
- `GET /api/storage/monitored-emails/:userId` - Get monitored emails
- `POST /api/storage/monitored-emails` - Add monitored email
- `GET /api/storage/email-digests/:userId` - Get email digests
- `POST /api/storage/email-digests` - Create email digest

### Digest Operations
- `GET /api/digest/latest/:userId` - Get latest digest (thematic or regular)
- `POST /api/digest/create` - Create digest from emails
- `GET /api/digest/history/:userId` - Get digest history
- `GET /api/digest/date/:userId/:date` - Get digest by date

### Thematic Processing
- `POST /api/thematic/process` - Process emails into thematic digest
- `GET /api/thematic/latest/:userId` - Get latest thematic digest
- `GET /api/thematic/analytics/:userId` - Get processing analytics

## Authentication

All API endpoints (except `/health`) require internal service authentication:

```bash
curl -H "x-internal-api-key: your-secret-key" \
     http://localhost:3001/api/storage/monitored-emails/user123
```

## Database Schema

The Data Server uses the shared schema from `../../shared/schema.ts` which includes:

- Users and authentication
- Monitored email addresses
- Email digests and individual emails
- Thematic digests and sections
- User settings and OAuth tokens

## Development

```bash
# Type checking
npm run check

# Database operations
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio

# Health check
npm run health
```

## Docker

```bash
# Build image
docker build -t subsbuzz-data-server .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e OPENAI_API_KEY="sk-..." \
  subsbuzz-data-server
```

## Service Communication

The Data Server is designed to be called by:
- **Email Worker** - For storing processed emails and creating digests
- **API Gateway** - For retrieving user data and digest information
- **Frontend** - Via API Gateway for user interface operations

## Monitoring

- Health endpoint: `/health`
- Structured logging with Morgan
- Database connection monitoring
- OpenAI API status checking

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "service": "data-server"
}
```

## Architecture

The Data Server follows a layered architecture:

```
src/
├── index.ts              # Express server setup
├── db.ts                 # Database connection
├── middleware/           # Express middleware
│   ├── auth.ts          # Internal API authentication
│   ├── error.ts         # Error handling
│   └── health.ts        # Health checks
├── routes/              # API route handlers
│   ├── storage.ts       # Database operations
│   ├── digest.ts        # Digest processing
│   └── thematic.ts      # Thematic operations
└── services/            # Business logic
    ├── storage.ts       # Database abstraction
    ├── openai.ts        # AI processing
    └── thematic-processor.ts # Thematic logic
```