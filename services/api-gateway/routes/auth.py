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

from auth import create_jwt_token, verify_jwt_token
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


# gmail.modify covers: reading messages, changing labels (including UNREAD/INBOX),
# creating labels, and moving messages to Trash. It's the narrowest scope that
# supports the inbox-cleanup feature. Must be kept in sync with the scope list
# in the GCP OAuth Consent Screen.
GMAIL_OAUTH_SCOPES = "https://www.googleapis.com/auth/gmail.modify openid email profile"


# Pydantic models
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


class RefreshRequest(BaseModel):
    """Request model for token refresh via session token"""
    sessionToken: str


async def _get_granted_scopes(uid: str) -> list:
    """
    Fetch the user's stored OAuth scope and split it into a list.
    Returns [] on any failure — the frontend should treat an empty list as
    "no gmail.modify" and prompt for re-consent before allowing cleanup actions.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.DATA_SERVER_URL}/api/storage/oauth-token/{uid}",
                headers={"x-internal-api-key": settings.INTERNAL_API_SECRET}
            )
        if not resp.is_success:
            return []
        token_data = resp.json().get("data", {}) or {}
        # Data-server returns snake_case for worker compatibility; guard for both.
        scope_str = token_data.get("scope") or token_data.get("scopes") or ""
        return [s for s in scope_str.split() if s]
    except Exception as e:
        logger.warning(f"Could not fetch OAuth scopes for uid={uid}: {e}")
        return []


@router.post("/refresh")
async def refresh_token(request: RefreshRequest):
    """
    Refresh JWT token using a long-lived session token stored in the database.
    Does not require a valid JWT — the session token is the credential.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.DATA_SERVER_URL}/api/storage/session-validate",
                json={"sessionToken": request.sessionToken},
                headers={"x-internal-api-key": settings.INTERNAL_API_SECRET}
            )

        if not resp.is_success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token"
            )

        user_data = resp.json().get("data", {})
        new_token = create_jwt_token({
            "uid": user_data["uid"],
            "email": user_data["email"],
            "email_verified": False
        })

        # Include granted scopes so the settings page can decide synchronously
        # whether to prompt for re-consent before enabling cleanup actions.
        scopes = await _get_granted_scopes(user_data["uid"])

        return {
            "success": True,
            "token": new_token,
            "user": {
                "uid": user_data["uid"],
                "email": user_data["email"],
                "scopes": scopes,
            },
            "message": "Token refreshed successfully"
        }

    except HTTPException:
        raise
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
    """Get current user information, including currently-granted OAuth scopes."""
    scopes = await _get_granted_scopes(current_user["uid"])
    return UserResponse(
        success=True,
        user={**current_user, "scopes": scopes}
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
    Validate if the current token is still valid.

    Called on app load. Also returns currently-granted OAuth scopes so the
    frontend (settings page) can decide whether to prompt for re-consent
    before allowing cleanup actions, without a second round-trip.
    """
    scopes = await _get_granted_scopes(current_user["uid"])
    return {
        "success": True,
        "valid": True,
        "uid": current_user["uid"],
        "email": current_user["email"],
        "scopes": scopes,
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
            "scope": GMAIL_OAUTH_SCOPES,
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


@router.post("/reauthorize")
async def reauthorize(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate an OAuth URL that re-prompts Google for consent with the full
    gmail.modify scope set. Used by the settings page when an existing
    gmail.readonly user opts into an inbox-cleanup action.

    include_granted_scopes=true layers the new scope on top of anything the
    user has previously granted, so we don't lose existing grants.
    """
    try:
        # Use the user's UID as the state so the callback can tie this back to them.
        # (The callback looks up by Google's user ID from the token exchange, so state
        # is informational here; we still include it for OAuth conformance.)
        state = current_user["uid"]

        auth_params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.OAUTH_REDIRECT_URI,
            "response_type": "code",
            "scope": GMAIL_OAUTH_SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }

        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(auth_params)}"

        return {
            "success": True,
            "auth_url": auth_url,
            "message": "Re-authorization URL generated",
        }

    except Exception as e:
        logger.error(f"Re-authorization URL generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate re-authorization URL"
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
                # Record the scope Google actually granted (users can de-select scopes
                # on the consent screen), falling back to what we requested.
                "scope": tokens.get("scope") or GMAIL_OAUTH_SCOPES,
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
            uid = user_info["id"]
            jwt_token = create_jwt_token({
                "uid": uid,
                "email": user_info["email"],
                "email_verified": user_info.get("verified_email", False)
            })

            # Create a long-lived session token (30-day, stored in DB)
            session_token = None
            try:
                session_resp = await client.post(
                    f"{settings.DATA_SERVER_URL}/api/storage/session-token/{uid}",
                    headers={"x-internal-api-key": settings.INTERNAL_API_SECRET}
                )
                if session_resp.is_success:
                    session_token = session_resp.json().get("data", {}).get("sessionToken")
            except Exception as e:
                logger.warning(f"Failed to create session token: {e}")

            return {
                "success": True,
                "message": "Gmail connected successfully",
                "token": jwt_token,
                "sessionToken": session_token,
                "user": {
                    "uid": uid,
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