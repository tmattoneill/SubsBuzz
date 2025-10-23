#!/usr/bin/env python3
"""
Simple API Gateway Test
Test the basic FastAPI structure without complex dependencies
"""

import os
import sys
import asyncio
import httpx
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import HTTPBearer
import uvicorn

# Simple configuration
DATA_SERVER_URL = os.getenv('DATA_SERVER_URL', 'http://localhost:3001')
INTERNAL_API_SECRET = os.getenv('INTERNAL_API_SECRET', 'subsbuzz-internal-api-secret-dev-testing')
JWT_SECRET = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-for-development-testing')

app = FastAPI(
    title="SubsBuzz API Gateway",
    version="2.0.0",
    description="External API gateway for SubsBuzz microservices"
)

security = HTTPBearer(auto_error=False)

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        # Test connection to data server
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{DATA_SERVER_URL}/health",
                headers={"x-internal-api-key": INTERNAL_API_SECRET},
                timeout=5.0
            )
        
        data_server_status = "healthy" if response.status_code == 200 else "unhealthy"
        
        return {
            "status": "healthy",
            "service": "SubsBuzz API Gateway",
            "version": "2.0.0",
            "data_server": data_server_status,
            "data_server_url": DATA_SERVER_URL
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "SubsBuzz API Gateway", 
            "error": str(e),
            "data_server": "unreachable"
        }

# Simple auth dependency (mock for testing)
async def get_current_user(token: str = Depends(security)):
    # For testing, we'll accept any bearer token
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"user_id": "test-user", "email": "test@example.com"}

# Test endpoint that calls data server
@app.get("/test-data-server")
async def test_data_server(user = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{DATA_SERVER_URL}/api/test",
                headers={"x-internal-api-key": INTERNAL_API_SECRET},
                timeout=10.0
            )
            
        if response.status_code == 200:
            return {
                "gateway_status": "working",
                "data_server_response": response.json(),
                "authenticated_user": user
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Data server error: {response.text}"
            )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Data server unreachable: {str(e)}")

# Root endpoint
@app.get("/")
async def root():
    return {
        "service": "SubsBuzz API Gateway",
        "version": "2.0.0", 
        "status": "running",
        "data_server_url": DATA_SERVER_URL
    }

if __name__ == "__main__":
    port = int(os.getenv('PORT', 8000))
    print(f"🚀 Starting API Gateway on port {port}")
    print(f"🔗 Data Server URL: {DATA_SERVER_URL}")
    print(f"🔑 Internal API Secret: {'Configured' if INTERNAL_API_SECRET else 'Missing'}")
    
    uvicorn.run(
        "simple-gateway:app",
        host="0.0.0.0", 
        port=port,
        reload=True,
        log_level="info"
    )