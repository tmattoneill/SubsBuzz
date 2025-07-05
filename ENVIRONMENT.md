# Environment Variable System

## ✅ SOLVED: Custom Environment Loader

We implemented a custom environment variable loader (`lib/env.js`) that replaces the problematic dotenv package.

### Usage

```javascript
// For development
import { loadDevEnv } from '../lib/env.js';
loadDevEnv();

// For production  
import { loadProdEnv } from '../lib/env.js';
loadProdEnv();

// Auto-detect based on NODE_ENV
import { autoLoadEnv } from '../lib/env.js';
autoLoadEnv();

// For Docker
import { loadDockerEnv } from '../lib/docker-env.js';
loadDockerEnv();
```

### Environment Files

- `.env.dev` - Development configuration
- `.env.prod` - Production configuration  
- `.env` - Generic fallback

### Docker Integration

The custom loader is Docker-ready and handles:
- Environment variable validation
- Production/development mode detection
- Container environment precedence

### Port Configuration (LOCKED)

```env
# Service Ports
UI_PORT=5500          # React development server
DATA_SERVER_PORT=3001 # Node.js data server  
API_GATEWAY_PORT=8000 # Python FastAPI gateway
DB_PORT=5432          # PostgreSQL database

# Service URLs
DATA_SERVER_URL=http://localhost:3001
API_GATEWAY_URL=http://localhost:8000
UI_URL=http://localhost:5500
```

### Benefits

- ✅ No external package dependencies
- ✅ Works in any environment (local, Docker, production)
- ✅ Validates required variables
- ✅ Proper error handling
- ✅ Supports comments and quotes in .env files
- ✅ Environment precedence (process.env > .env file)