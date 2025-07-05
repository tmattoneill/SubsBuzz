"""
User settings routes for the API Gateway - proxies to Data Server
"""

import logging
from typing import Dict, Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from auth import get_current_user
from config import settings
from auth import create_internal_api_headers

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic models
class SettingsResponse(BaseModel):
    """Response model for user settings"""
    success: bool
    data: Dict[str, Any]


class SettingsUpdateRequest(BaseModel):
    """Request model for updating user settings"""
    dailyDigestEnabled: Optional[bool] = None
    topicClusteringEnabled: Optional[bool] = None
    emailNotificationsEnabled: Optional[bool] = None
    themeMode: Optional[str] = None  # "light", "dark", "system"
    themeColor: Optional[str] = None  # Color scheme preference


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


@router.get("/", response_model=SettingsResponse)
async def get_user_settings(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get user settings for the current user
    
    Returns user preferences including:
    - Daily digest enabled/disabled
    - Topic clustering preferences
    - Email notification settings
    - Theme preferences
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "GET",
            f"storage/user-settings/{user_id}"
        )
        
        return SettingsResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user settings"
        )


@router.patch("/", response_model=SettingsResponse)
async def update_user_settings(
    request: SettingsUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update user settings for the current user
    
    Only provided fields will be updated. Fields not included
    in the request will remain unchanged.
    """
    user_id = current_user["uid"]
    
    # Convert request to dict, excluding None values
    update_data = {
        key: value for key, value in request.dict().items() 
        if value is not None
    }
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid settings provided for update"
        )
    
    try:
        result = await proxy_to_data_server(
            "PATCH",
            f"storage/user-settings/{user_id}",
            json_data=update_data
        )
        
        return SettingsResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user settings"
        )


@router.post("/reset")
async def reset_user_settings(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Reset user settings to default values
    
    This will restore all settings to their default state:
    - Daily digest enabled: true
    - Topic clustering enabled: true
    - Email notifications enabled: false
    - Theme mode: "system"
    - Theme color: "blue"
    """
    user_id = current_user["uid"]
    
    default_settings = {
        "dailyDigestEnabled": True,
        "topicClusteringEnabled": True,
        "emailNotificationsEnabled": False,
        "themeMode": "system",
        "themeColor": "blue"
    }
    
    try:
        result = await proxy_to_data_server(
            "PATCH",
            f"storage/user-settings/{user_id}",
            json_data=default_settings
        )
        
        return SettingsResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset user settings"
        )


@router.get("/preferences/theme")
async def get_theme_preferences(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get theme-specific preferences for the current user
    
    Returns only theme-related settings for faster loading
    """
    user_id = current_user["uid"]
    
    try:
        result = await proxy_to_data_server(
            "GET",
            f"storage/user-settings/{user_id}"
        )
        
        settings_data = result.get("data", {})
        theme_preferences = {
            "themeMode": settings_data.get("themeMode", "system"),
            "themeColor": settings_data.get("themeColor", "blue")
        }
        
        return SettingsResponse(
            success=True,
            data=theme_preferences
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting theme preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve theme preferences"
        )


@router.patch("/preferences/theme")
async def update_theme_preferences(
    themeMode: Optional[str] = None,
    themeColor: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update only theme preferences for the current user
    
    Quick endpoint for updating theme settings without affecting
    other user preferences.
    """
    user_id = current_user["uid"]
    
    # Validate theme values
    valid_theme_modes = ["light", "dark", "system"]
    valid_theme_colors = ["blue", "green", "purple", "orange", "red", "gray"]
    
    update_data = {}
    
    if themeMode is not None:
        if themeMode not in valid_theme_modes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid theme mode. Must be one of: {', '.join(valid_theme_modes)}"
            )
        update_data["themeMode"] = themeMode
    
    if themeColor is not None:
        if themeColor not in valid_theme_colors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid theme color. Must be one of: {', '.join(valid_theme_colors)}"
            )
        update_data["themeColor"] = themeColor
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No theme preferences provided for update"
        )
    
    try:
        result = await proxy_to_data_server(
            "PATCH",
            f"storage/user-settings/{user_id}",
            json_data=update_data
        )
        
        return SettingsResponse(
            success=True,
            data=result.get("data", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating theme preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update theme preferences"
        )