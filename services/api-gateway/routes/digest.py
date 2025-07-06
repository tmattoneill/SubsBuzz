"""
Digest routes for the API Gateway - proxies to Data Server
"""

import logging
from typing import Dict, Any, Optional, List

import httpx
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel

from auth import get_current_user
from config import settings
from auth import create_internal_api_headers

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic models
class DigestResponse(BaseModel):
    """Response model for digest data"""
    success: bool
    data: Dict[str, Any]


class DigestListResponse(BaseModel):
    """Response model for digest lists"""
    success: bool
    data: Dict[str, Any]
    total: Optional[int] = None


class EmailDigestRequest(BaseModel):
    """Request model for creating email digests"""
    emails: List[Dict[str, Any]]


class ThematicProcessRequest(BaseModel):
    """Request model for thematic processing"""
    emails: List[Dict[str, Any]]
    email_digest_id: Optional[int] = None


# Helper function to proxy requests to Data Server
async def proxy_to_data_server(
    method: str,
    path: str,
    json_data: Optional[Dict] = None,
    params: Optional[Dict] = None
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


@router.get("/latest", response_model=DigestResponse)
async def get_latest_digest(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the latest digest for the current user
    
    Prioritizes thematic digests, falls back to regular digests
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "GET",
            f"digest/latest/{user_id}"
        )
        
        return DigestResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting latest digest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve latest digest"
        )


@router.get("/detailed", response_model=DigestResponse)
async def get_detailed_digest(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the latest detailed digest (individual emails) for the current user
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "GET",
            f"digest/detailed/{user_id}"
        )
        
        return DigestResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting detailed digest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve detailed digest"
        )


@router.get("/history", response_model=DigestListResponse)
async def get_digest_history(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: Optional[int] = Query(None, description="Number of digests to return"),
    offset: Optional[int] = Query(None, description="Number of digests to skip")
):
    """
    Get digest history for the current user
    """
    user_id = current_user["uid"]
    
    try:
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        
        result = await proxy_to_data_server(
            "GET",
            f"digest/history/{user_id}",
            params=params
        )
        
        return DigestListResponse(
            success=True,
            data=result.get("data", {}),
            total=result.get("data", {}).get("total")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting digest history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve digest history"
        )


@router.get("/date/{date}", response_model=DigestResponse)
async def get_digest_by_date(
    date: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get digest for a specific date (YYYY-MM-DD format)
    
    Returns thematic digest if available, otherwise regular digest
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "GET",
            f"digest/date/{user_id}/{date}"
        )
        
        return DigestResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting digest by date: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve digest for date"
        )


@router.post("/create", response_model=DigestResponse)
async def create_digest(
    request: EmailDigestRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new digest from provided emails
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "POST",
            "digest/create",
            json_data={
                "user_id": user_id,
                "emails": request.emails
            }
        )
        
        return DigestResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating digest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create digest"
        )


@router.post("/generate", response_model=DigestResponse)
async def generate_digest(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate a new digest automatically by fetching recent emails
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "POST",
            "digest/generate",
            json_data={
                "user_id": user_id
            }
        )
        
        return DigestResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating digest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate digest"
        )


@router.post("/thematic/process", response_model=DigestResponse)
async def process_thematic_digest(
    request: ThematicProcessRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Process emails into a thematic digest using AI analysis
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "POST",
            "digest/thematic/process",
            json_data={
                "userId": user_id,
                "emails": request.emails,
                "emailDigestId": request.email_digest_id
            }
        )
        
        return DigestResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing thematic digest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process thematic digest"
        )


@router.get("/stats", response_model=DigestResponse)
async def get_digest_stats(
    current_user: Dict[str, Any] = Depends(get_current_user),
    period: Optional[str] = Query(None, description="Time period: day, week, month, year")
):
    """
    Get digest statistics for the current user
    """
    user_id = current_user["uid"]
    
    try:
        params = {}
        if period:
            params["period"] = period
        
        result = await proxy_to_data_server(
            "GET",
            f"digest/stats/{user_id}",
            params=params
        )
        
        return DigestResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting digest stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve digest statistics"
        )


@router.get("/available-dates", response_model=DigestResponse)
async def get_available_digest_dates(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all dates that have digests available for the current user
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "GET",
            f"storage/available-digest-dates/{user_id}"
        )
        
        return DigestResponse(
            success=True,
            data={"dates": result.get("data", [])}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available digest dates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve available digest dates"
        )