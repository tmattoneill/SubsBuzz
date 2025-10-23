"""
Health check utilities for the API Gateway
"""

import logging
import httpx
from datetime import datetime
from typing import Dict, Any
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: str
    service: str
    version: str
    environment: str
    dependencies: Dict[str, str]
    uptime: float


class DependencyHealth:
    """Check health of dependent services"""
    
    def __init__(self):
        self.start_time = datetime.utcnow()
    
    async def check_service(self, service_name: str, url: str) -> str:
        """Check if a service is healthy"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{url}/health")
                
                if response.status_code == 200:
                    logger.debug(f"✅ {service_name} is healthy")
                    return "healthy"
                else:
                    logger.warning(f"⚠️ {service_name} returned status {response.status_code}")
                    return "unhealthy"
                    
        except httpx.RequestError as e:
            logger.warning(f"❌ {service_name} connection failed: {e}")
            return "unreachable"
        except Exception as e:
            logger.error(f"❌ {service_name} health check error: {e}")
            return "error"
    
    async def check_all_dependencies(self) -> Dict[str, str]:
        """Check health of all dependent services"""
        dependencies = {}
        
        # Check Data Server
        dependencies["data-server"] = await self.check_service(
            "Data Server", 
            settings.DATA_SERVER_URL
        )
        
        # Check Email Worker (if available)
        if settings.EMAIL_WORKER_URL:
            dependencies["email-worker"] = await self.check_service(
                "Email Worker",
                settings.EMAIL_WORKER_URL
            )
        else:
            dependencies["email-worker"] = "not-configured"
        
        # Check Firebase (basic configuration check)
        dependencies["firebase"] = self._check_firebase_config()
        
        return dependencies
    
    def _check_firebase_config(self) -> str:
        """Check if Firebase is properly configured"""
        try:
            required_vars = [
                settings.FIREBASE_PROJECT_ID,
                settings.FIREBASE_CLIENT_EMAIL,
                settings.FIREBASE_PRIVATE_KEY
            ]
            
            if all(var for var in required_vars):
                return "configured"
            else:
                return "misconfigured"
                
        except Exception:
            return "error"
    
    def get_uptime(self) -> float:
        """Get service uptime in seconds"""
        return (datetime.utcnow() - self.start_time).total_seconds()


# Global health checker instance
health_checker = DependencyHealth()


async def health_check() -> HealthResponse:
    """
    Comprehensive health check for the API Gateway
    """
    try:
        # Check dependencies
        dependencies = await health_checker.check_all_dependencies()
        
        # Determine overall status
        overall_status = "healthy"
        critical_services = ["data-server"]
        
        for service in critical_services:
            if dependencies.get(service) not in ["healthy", "configured"]:
                overall_status = "unhealthy"
                break
        
        # If no critical failures, check for warnings
        if overall_status == "healthy":
            for service, status in dependencies.items():
                if status in ["unhealthy", "unreachable", "error"]:
                    overall_status = "degraded"
                    break
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.utcnow().isoformat() + "Z",
            service="api-gateway",
            version="2.0.0",
            environment=settings.ENVIRONMENT,
            dependencies=dependencies,
            uptime=health_checker.get_uptime()
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        
        return HealthResponse(
            status="error",
            timestamp=datetime.utcnow().isoformat() + "Z",
            service="api-gateway",
            version="2.0.0",
            environment=settings.ENVIRONMENT,
            dependencies={"error": str(e)},
            uptime=health_checker.get_uptime()
        )