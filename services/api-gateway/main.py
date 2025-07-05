"""
FastAPI Gateway Service - Main Application

This service provides:
- Public-facing REST API with JWT authentication
- Route proxying to internal services (Data Server, Email Worker)
- Firebase authentication integration
- Rate limiting and request validation
- API documentation with Swagger/OpenAPI
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
import httpx
from pydantic import BaseModel

from auth import verify_firebase_token, create_jwt_token, verify_jwt_token
from middleware import LoggingMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware, RequestIDMiddleware
from config import settings
from health import health_check, HealthResponse
from routes import auth as auth_routes, digest, monitored_emails, settings as settings_routes

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# HTTP client for service communication
http_client: Optional[httpx.AsyncClient] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    global http_client
    
    # Startup
    logger.info("🚀 Starting API Gateway...")
    http_client = httpx.AsyncClient(
        timeout=30.0,
        headers={
            "x-internal-api-key": settings.INTERNAL_API_SECRET,
            "user-agent": "SubsBuzz-API-Gateway/2.0"
        }
    )
    logger.info("✅ HTTP client initialized")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down API Gateway...")
    if http_client:
        await http_client.aclose()
    logger.info("✅ Cleanup complete")


# FastAPI application
app = FastAPI(
    title="SubsBuzz API Gateway",
    description="Public API gateway for SubsBuzz email digest application",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Security
security = HTTPBearer(auto_error=False)

# Middleware setup (order matters!)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.RATE_LIMIT_REQUESTS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)


# Pydantic models
class ErrorResponse(BaseModel):
    error: bool = True
    message: str
    code: Optional[str] = None
    timestamp: str
    service: str = "api-gateway"


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            message=exc.detail,
            code="HTTP_ERROR",
            timestamp=getattr(request.state, 'timestamp', ''),
        ).dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            message="Internal server error",
            code="INTERNAL_ERROR",
            timestamp=getattr(request.state, 'timestamp', ''),
        ).dict()
    )


# ==================== HEALTH & STATUS ====================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_endpoint():
    """API Gateway health check"""
    return await health_check()


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with service information"""
    return {
        "service": "SubsBuzz API Gateway",
        "version": "2.0.0",
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health"
    }


# ==================== INCLUDE ROUTERS ====================

app.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(digest.router, prefix="/api/digest", tags=["Digests"])
app.include_router(monitored_emails.router, prefix="/api/monitored-emails", tags=["Monitored Emails"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["Settings"])

# Add callback route at root level (to match frontend expectation)
app.include_router(auth_routes.router, prefix="", tags=["OAuth Callback"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True if settings.ENVIRONMENT == "development" else False,
        log_level=settings.LOG_LEVEL.lower()
    )