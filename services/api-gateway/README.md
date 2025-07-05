# SubsBuzz API Gateway

The API Gateway is the public-facing service in the SubsBuzz microservices architecture, handling authentication, request routing, and external API access.

## Overview

The API Gateway provides:
- **Firebase Authentication** - OAuth integration with JWT token management
- **Request Routing** - Proxies requests to internal services (Data Server, Email Worker)
- **Security** - Rate limiting, CORS, security headers, input validation
- **API Documentation** - Swagger/OpenAPI documentation at `/docs`
- **Health Monitoring** - Service health checks and dependency monitoring

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your Firebase and service configuration

# Development mode with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Environment Variables

Required environment variables (see `.env.example`):

### Authentication
- `JWT_SECRET_KEY` - Secret key for JWT token signing
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email

### Service Communication
- `INTERNAL_API_SECRET` - Shared secret for internal service communication
- `DATA_SERVER_URL` - URL of the Data Server (default: http://localhost:3001)
- `EMAIL_WORKER_URL` - URL of the Email Worker (default: http://localhost:5555)

### Security & Performance
- `CORS_ORIGINS` - Allowed CORS origins (comma-separated)
- `RATE_LIMIT_REQUESTS` - Max requests per hour per IP
- `ALLOWED_HOSTS` - Trusted host domains

## API Endpoints

### Authentication
- `POST /auth/firebase` - Authenticate with Firebase token
- `POST /auth/refresh` - Refresh JWT token
- `GET /auth/me` - Get current user info
- `GET /auth/validate` - Validate current token

### Digests
- `GET /digest/latest` - Get latest digest (thematic or regular)
- `GET /digest/detailed` - Get latest detailed digest (individual emails)
- `GET /digest/history` - Get digest history with pagination
- `GET /digest/date/{date}` - Get digest for specific date
- `POST /digest/create` - Create digest from emails
- `POST /digest/thematic/process` - Process emails into thematic digest

### Monitored Emails
- `GET /monitored-emails/` - Get monitored email addresses
- `POST /monitored-emails/` - Add monitored email address
- `DELETE /monitored-emails/{id}` - Remove monitored email
- `POST /monitored-emails/trigger-digest` - Manually trigger digest generation

### Settings
- `GET /settings/` - Get user settings
- `PATCH /settings/` - Update user settings
- `POST /settings/reset` - Reset to default settings
- `GET /settings/preferences/theme` - Get theme preferences
- `PATCH /settings/preferences/theme` - Update theme preferences

### System
- `GET /health` - Service health check
- `GET /` - Service information
- `GET /docs` - Swagger documentation

## Authentication Flow

1. **Frontend Authentication**:
   ```javascript
   // Authenticate with Firebase
   const firebaseToken = await firebase.auth().currentUser.getIdToken();
   
   // Exchange for JWT
   const response = await fetch('/auth/firebase', {
     method: 'POST',
     body: JSON.stringify({ firebase_token: firebaseToken })
   });
   
   const { token } = await response.json();
   ```

2. **API Requests**:
   ```javascript
   // Use JWT for all subsequent requests
   const response = await fetch('/digest/latest', {
     headers: {
       'Authorization': `Bearer ${token}`
     }
   });
   ```

## Service Communication

The API Gateway communicates with internal services using:

```python
# Internal API headers
headers = {
    "x-internal-api-key": INTERNAL_API_SECRET,
    "Content-Type": "application/json"
}

# Proxy to Data Server
response = await httpx.post(
    f"{DATA_SERVER_URL}/api/storage/monitored-emails",
    json=data,
    headers=headers
)
```

## Security Features

- **Rate Limiting**: 100 requests per hour per IP (configurable)
- **CORS Protection**: Configurable allowed origins
- **Security Headers**: XSS protection, frame options, content type sniffing
- **Request Validation**: Pydantic models for all inputs
- **JWT Tokens**: Stateless authentication with expiration
- **Internal Auth**: Shared secret for service-to-service communication

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "service": "api-gateway"
}
```

## Monitoring & Health

- **Health Endpoint**: `/health` checks all dependencies
- **Structured Logging**: Request/response logging with timing
- **Request IDs**: Unique ID for request tracing
- **Service Dependencies**: Monitors Data Server and Email Worker health

Health check response:
```json
{
  "status": "healthy",
  "dependencies": {
    "data-server": "healthy",
    "email-worker": "healthy",
    "firebase": "configured"
  },
  "uptime": 3600.5
}
```

## Development

```bash
# Type checking (optional)
pip install mypy
mypy main.py

# Format code
pip install black
black .

# Run tests (when available)
pytest

# API documentation
# Visit http://localhost:8000/docs for interactive docs
```

## Docker

```bash
# Build image
docker build -t subsbuzz-api-gateway .

# Run container
docker run -p 8000:8000 \
  -e FIREBASE_PROJECT_ID="your-project" \
  -e JWT_SECRET_KEY="your-secret" \
  -e DATA_SERVER_URL="http://data-server:3001" \
  subsbuzz-api-gateway
```

## Architecture

The API Gateway follows a clean architecture pattern:

```
services/api-gateway/
├── main.py                    # FastAPI application setup
├── config.py                  # Configuration management
├── auth.py                    # Authentication utilities
├── health.py                  # Health check logic
├── middleware.py              # Custom middleware
├── routes/                    # API route handlers
│   ├── auth.py               # Authentication endpoints
│   ├── digest.py             # Digest management
│   ├── monitored_emails.py   # Email monitoring
│   └── settings.py           # User preferences
├── requirements.txt           # Python dependencies
└── README.md                 # This file
```

## Integration with Frontend

The API Gateway is designed to work seamlessly with the React frontend:

1. **Authentication**: Firebase OAuth → JWT tokens
2. **API Calls**: All frontend requests go through the gateway
3. **Error Handling**: Standardized error responses
4. **CORS**: Configured for frontend domains
5. **Documentation**: Swagger docs for API exploration

## Deployment

For production deployment:

1. Set up Firebase service account
2. Configure environment variables
3. Set up SSL/TLS termination (nginx)
4. Configure rate limiting and monitoring
5. Set up log aggregation

The API Gateway is stateless and can be horizontally scaled as needed.