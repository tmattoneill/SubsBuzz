"""
Authentication routes for the API Gateway
"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from ..auth import verify_firebase_token, create_jwt_token, verify_jwt_token
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


# Pydantic models
class FirebaseAuthRequest(BaseModel):
    """Request model for Firebase authentication"""
    firebase_token: str


class AuthResponse(BaseModel):
    """Response model for authentication"""
    success: bool
    token: str
    user: Dict[str, Any]
    message: str


class UserResponse(BaseModel):
    """Response model for user information"""
    success: bool
    user: Dict[str, Any]


# Dependency to get current user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Extract and verify JWT token from Authorization header"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = verify_jwt_token(credentials.credentials)
        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/firebase", response_model=AuthResponse)
async def firebase_auth(request: FirebaseAuthRequest):
    """
    Authenticate with Firebase token and return JWT
    
    This endpoint:
    1. Verifies the Firebase ID token
    2. Creates a JWT token for API access
    3. Returns user information and JWT
    """
    try:
        # Verify Firebase token
        user_data = await verify_firebase_token(request.firebase_token)
        
        # Create JWT token
        jwt_token = create_jwt_token({
            "uid": user_data["uid"],
            "email": user_data["email"],
            "email_verified": user_data.get("email_verified", False)
        })
        
        return AuthResponse(
            success=True,
            token=jwt_token,
            user={
                "uid": user_data["uid"],
                "email": user_data["email"],
                "name": user_data.get("name"),
                "picture": user_data.get("picture"),
                "email_verified": user_data.get("email_verified", False),
                "provider": user_data.get("provider")
            },
            message="Authentication successful"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firebase authentication failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Refresh JWT token for authenticated user
    """
    try:
        # Create new JWT token
        new_token = create_jwt_token({
            "uid": current_user["uid"],
            "email": current_user["email"],
            "email_verified": current_user.get("email_verified", False)
        })
        
        return AuthResponse(
            success=True,
            token=new_token,
            user=current_user,
            message="Token refreshed successfully"
        )
        
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get current user information"""
    return UserResponse(
        success=True,
        user=current_user
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side token removal)
    
    Since JWTs are stateless, logout is handled client-side by removing the token.
    This endpoint exists for consistency with the frontend expectations.
    """
    return {
        "success": True,
        "message": "Logout successful. Please remove the token from client storage."
    }


@router.get("/validate")
async def validate_token(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Validate if the current token is still valid
    
    This endpoint can be used by the frontend to check token validity
    without retrieving user information.
    """
    return {
        "success": True,
        "valid": True,
        "uid": current_user["uid"],
        "email": current_user["email"]
    }