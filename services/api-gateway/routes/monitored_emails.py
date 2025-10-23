"""
Monitored emails routes for the API Gateway - proxies to Data Server
"""

import logging
from typing import Dict, Any, List

import httpx
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr

from auth import get_current_user
from config import settings
from auth import create_internal_api_headers

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic models
class MonitoredEmailResponse(BaseModel):
    """Response model for monitored email data"""
    success: bool
    data: Any


class MonitoredEmailRequest(BaseModel):
    """Request model for adding monitored email"""
    email: EmailStr
    active: bool = True


class MonitoredEmailUpdate(BaseModel):
    """Request model for updating monitored email"""
    active: bool


# Helper function to proxy requests to Data Server
async def proxy_to_data_server(
    method: str,
    path: str,
    json_data: Dict = None,
    params: Dict = None
) -> Dict[str, Any]:
    """Proxy request to Data Server with internal authentication"""
    
    url = f"{settings.DATA_SERVER_URL.rstrip('/')}/api/{path.lstrip('/')}"
    headers = create_internal_api_headers()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=url,
                json=json_data,
                params=params,
                headers=headers
            )
            
            if response.status_code >= 400:
                logger.error(f"Data Server error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("message", "Service error")
                )
            
            return response.json()
            
    except httpx.RequestError as e:
        logger.error(f"Request error to Data Server: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Data Server unavailable: {str(e)}"
        )


@router.get("/", response_model=MonitoredEmailResponse)
async def get_monitored_emails(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all monitored emails for the current user
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "GET",
            f"storage/monitored-emails/{user_id}"
        )
        
        return MonitoredEmailResponse(
            success=True,
            data=result.get("data", [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monitored emails: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve monitored emails"
        )


@router.post("/", response_model=MonitoredEmailResponse)
async def add_monitored_email(
    request: MonitoredEmailRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Add a new monitored email for the current user
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "POST",
            "storage/monitored-emails",
            json_data={
                "userId": user_id,
                "email": str(request.email),
                "active": request.active
            }
        )
        
        return MonitoredEmailResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding monitored email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add monitored email"
        )


@router.get("/{email_id}", response_model=MonitoredEmailResponse)
async def get_monitored_email(
    email_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get a specific monitored email by ID
    """
    try:
        result = await proxy_to_data_server(
            "GET",
            f"storage/monitored-email/{email_id}"
        )
        
        # Verify the email belongs to the current user
        email_data = result.get("data", {})
        if email_data.get("userId") != current_user["uid"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Monitored email not found"
            )
        
        return MonitoredEmailResponse(
            success=True,
            data=email_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monitored email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve monitored email"
        )


@router.delete("/{email_id}", response_model=MonitoredEmailResponse)
async def remove_monitored_email(
    email_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Remove a monitored email for the current user
    """
    user_id = current_user["uid"]
    
    try:
        # First verify the email belongs to the user
        email_result = await proxy_to_data_server(
            "GET",
            f"storage/monitored-email/{email_id}"
        )
        
        email_data = email_result.get("data", {})
        if email_data.get("userId") != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Monitored email not found"
            )
        
        # Remove the email
        await proxy_to_data_server(
            "DELETE",
            f"storage/monitored-emails/{user_id}/{email_id}"
        )
        
        return MonitoredEmailResponse(
            success=True,
            data={"message": "Monitored email removed successfully"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing monitored email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove monitored email"
        )


@router.post("/trigger-digest")
async def trigger_digest_generation(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Manually trigger digest generation for the current user
    
    This endpoint will trigger the email worker to process emails
    for the current user immediately, rather than waiting for the
    scheduled daily digest generation.
    """
    user_id = current_user["uid"]
    
    try:
        # Get user's monitored emails first
        monitored_emails_result = await proxy_to_data_server(
            "GET",
            f"storage/monitored-emails/{user_id}"
        )
        
        monitored_emails = monitored_emails_result.get("data", [])
        
        if not monitored_emails:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No monitored emails configured. Please add email addresses to monitor first."
            )
        
        # Trigger digest generation via Data Server
        result = await proxy_to_data_server(
            "POST",
            f"digest/generate/{user_id}",
            json_data={
                "monitored_emails": [email["email"] for email in monitored_emails if email.get("active")]
            }
        )
        
        return MonitoredEmailResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering digest generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger digest generation"
        )