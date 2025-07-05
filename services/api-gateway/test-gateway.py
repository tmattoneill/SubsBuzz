#!/usr/bin/env python3
"""
Simple test for API Gateway to verify basic connectivity
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Create FastAPI app
app = FastAPI(title="Test API Gateway", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "service": "SubsBuzz API Gateway (Test)",
        "version": "2.0.0",
        "status": "healthy"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": "2025-07-05T08:30:00Z",
        "service": "api-gateway-test",
        "version": "2.0.0",
        "dependencies": {
            "data-server": "unknown",
            "firebase": "mock"
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)