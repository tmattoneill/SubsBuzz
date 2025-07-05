/**
 * Shared Constants for SubsBuzz Microservices
 */

// Service URLs (will be overridden by environment variables)
export const SERVICE_URLS = {
  DATA_SERVER: process.env.DATA_SERVER_URL || 'http://localhost:5000',
  API_GATEWAY: process.env.API_GATEWAY_URL || 'http://localhost:8000',
  FRONTEND: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

// Service Ports
export const SERVICE_PORTS = {
  FRONTEND: 3000,
  API_GATEWAY: 8000,
  DATA_SERVER: 5000,
  POSTGRES: 5432,
  REDIS: 6379,
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH_VERIFY: '/auth/verify',
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  
  // Digests
  DIGEST_LATEST: '/digest/latest',
  DIGEST_GENERATE: '/digest/generate',
  DIGEST_HISTORY: '/digest/history',
  DIGEST_BY_DATE: '/digest/date/:date',
  
  // Monitored Emails
  MONITORED_EMAILS: '/monitored-emails',
  MONITORED_EMAIL_BY_ID: '/monitored-emails/:id',
  
  // Settings
  USER_SETTINGS: '/settings',
  
  // Health Check
  HEALTH: '/health',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// JWT Token Configuration
export const JWT_CONFIG = {
  EXPIRES_IN: '24h',
  ALGORITHM: 'HS256',
  ISSUER: 'subsbuzz-api',
  AUDIENCE: 'subsbuzz-frontend',
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 60,
  AUTH_REQUESTS_PER_MINUTE: 10,
  DIGEST_GENERATION_PER_HOUR: 5,
} as const;

// Database Configuration
export const DATABASE_CONFIG = {
  CONNECTION_TIMEOUT: 30000,
  QUERY_TIMEOUT: 60000,
  MAX_CONNECTIONS: 20,
} as const;

// Redis Configuration
export const REDIS_CONFIG = {
  KEY_PREFIX: 'subsbuzz:',
  SESSION_TTL: 86400, // 24 hours
  CACHE_TTL: 3600, // 1 hour
} as const;

// Email Processing
export const EMAIL_CONFIG = {
  MAX_EMAILS_PER_DIGEST: 100,
  CONTENT_MAX_LENGTH: 50000,
  LOOKBACK_DAYS: 1,
  BATCH_SIZE: 10,
} as const;