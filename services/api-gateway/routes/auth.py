"""
Authentication routes for the API Gateway
"""

import logging
from typing import Dict, Any
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
import httpx

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from auth import verify_firebase_token, create_jwt_token, verify_jwt_token
from config import settings

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


class GmailAccessRequest(BaseModel):
    """Request model for Gmail access URL"""
    pass


class GmailAccessResponse(BaseModel):
    """Response model for Gmail access URL"""
    success: bool
    auth_url: str
    message: str


class OAuthCallbackRequest(BaseModel):
    """Request model for OAuth callback"""
    code: str
    state: str


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


@router.post("/gmail-access", response_model=GmailAccessResponse)
async def gmail_access(request: GmailAccessRequest):
    """
    Generate Gmail OAuth authorization URL for user
    
    This endpoint:
    1. Creates a Gmail OAuth authorization URL
    2. Includes offline access for refresh tokens
    3. Returns URL for frontend to redirect user
    
    Note: This endpoint doesn't require authentication since it's used for initial signup
    """
    try:
        # Generate a temporary state for new users
        import uuid
        temp_state = str(uuid.uuid4())
        
        # Build OAuth authorization URL
        auth_params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.OAUTH_REDIRECT_URI,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/gmail.readonly openid email profile",
            "access_type": "offline",
            "prompt": "consent",
            "state": temp_state  # Use temporary state for new users
        }
        
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(auth_params)}"
        
        return GmailAccessResponse(
            success=True,
            auth_url=auth_url,
            message="OAuth URL generated successfully"
        )
        
    except Exception as e:
        logger.error(f"Gmail access URL generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate Gmail access URL"
        )


@router.post("/oauth-callback")
async def oauth_callback(request: OAuthCallbackRequest):
    """
    Handle OAuth callback from Google
    
    This endpoint:
    1. Exchanges authorization code for access/refresh tokens
    2. Stores tokens in database via Data Server
    3. Creates/updates user session
    """
    try:
        # Exchange authorization code for tokens
        token_data = {
            "code": request.code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code"
        }
        
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data=token_data
            )
            
            if not token_response.is_success:
                logger.error(f"Token exchange failed: {token_response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange authorization code"
                )
            
            tokens = token_response.json()
            
            # Get user info from Google
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            
            if not user_info_response.is_success:
                logger.error(f"User info fetch failed: {user_info_response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch user information"
                )
            
            user_info = user_info_response.json()
            
            # Store OAuth tokens in database via Data Server
            # Use email as UID for new users (we'll use Google's user ID as the UID)
            oauth_data = {
                "uid": user_info["id"],  # Use Google's user ID as UID
                "email": user_info["email"],
                "accessToken": tokens["access_token"],
                "refreshToken": tokens.get("refresh_token"),
                "expiresAt": None,  # Will be calculated by Data Server
                "scope": "https://www.googleapis.com/auth/gmail.readonly"
            }
            
            # Store tokens via Data Server
            data_server_response = await client.post(
                f"{settings.DATA_SERVER_URL}/api/storage/oauth-tokens",
                json=oauth_data,
                headers={"x-internal-api-key": settings.INTERNAL_API_SECRET}
            )
            
            if not data_server_response.is_success:
                logger.error(f"Token storage failed: {data_server_response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to store OAuth tokens"
                )
            
            # Create JWT token for user
            jwt_token = create_jwt_token({
                "uid": user_info["id"],
                "email": user_info["email"],
                "email_verified": user_info.get("verified_email", False)
            })
            
            return {
                "success": True,
                "message": "Gmail connected successfully",
                "token": jwt_token,
                "user": {
                    "uid": user_info["id"],
                    "email": user_info["email"],
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture"),
                    "email_verified": user_info.get("verified_email", False)
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OAuth callback processing failed"
        )


@router.get("/callback")
async def oauth_callback_get(code: str, state: str):
    """
    Handle OAuth callback from Google (GET request)
    
    This endpoint handles the callback when Google redirects back to our app
    with the authorization code as query parameters.
    """
    try:
        # Convert to POST request format and process
        request_data = OAuthCallbackRequest(code=code, state=state)
        result = await oauth_callback(request_data)
        
        # If successful, redirect to frontend with success parameter and token
        if result.get("success"):
            # Create a temporary token storage mechanism
            # In a real implementation, you'd want to use secure httpOnly cookies
            token = result.get("token", "")
            return HTMLResponse(
                content=f"""
                <html>
                <head><title>Gmail Connected</title></head>
                <body>
                <h1>Gmail Connected Successfully!</h1>
                <p>Redirecting to your dashboard...</p>
                <script>
                    localStorage.setItem('subsbuzz_token', '{token}');
                    window.location.href = '{settings.UI_URL}?connected=gmail';
                </script>
                </body>
                </html>
                """,
                status_code=200
            )
        else:
            # Show error page
            return HTMLResponse(
                content=f"""
                <html>
                <head><title>OAuth Error</title></head>
                <body>
                <h1>OAuth Error</h1>
                <p>Failed to connect Gmail account.</p>
                <p><a href="{settings.UI_URL}">Return to app</a></p>
                </body>
                </html>
                """,
                status_code=400
            )
    except Exception as e:
        logger.error(f"OAuth callback GET failed: {e}")
        # Return HTML response for browser redirect
        return HTMLResponse(
            content=f"""
            <html>
            <head><title>OAuth Error</title></head>
            <body>
            <h1>OAuth Error</h1>
            <p>Failed to process OAuth callback: {str(e)}</p>
            <p><a href="{settings.UI_URL}">Return to app</a></p>
            </body>
            </html>
            """,
            status_code=500
        )