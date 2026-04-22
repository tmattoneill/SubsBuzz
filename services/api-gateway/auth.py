"""
Authentication utilities for JWT token management
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import jwt
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer

from config import settings

logger = logging.getLogger(__name__)


def create_jwt_token(user_data: Dict[str, Any]) -> str:
    """
    Create JWT token for API access
    """
    try:
        # Token payload
        payload = {
            "uid": user_data["uid"],
            "email": user_data["email"],
            "email_verified": user_data.get("email_verified", False),
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
            "iss": "subsbuzz-api-gateway",
            "aud": "subsbuzz-services"
        }
        
        # Create token
        token = jwt.encode(
            payload, 
            settings.JWT_SECRET_KEY, 
            algorithm=settings.JWT_ALGORITHM
        )
        
        logger.info(f"JWT token created for user: {user_data['email']}")
        return token
        
    except Exception as e:
        logger.error(f"JWT token creation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token creation failed"
        )


def verify_jwt_token(token: str) -> Dict[str, Any]:
    """
    Verify JWT token and return payload
    """
    try:
        logger.info(f"Verifying JWT token with secret: {settings.JWT_SECRET_KEY[:10]}...")
        logger.info(f"JWT algorithm: {settings.JWT_ALGORITHM}")
        
        # Decode and verify token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience="subsbuzz-services",
            issuer="subsbuzz-api-gateway"
        )
        
        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.utcnow() > datetime.fromtimestamp(exp):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"JWT token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed"
        )


def get_user_id_from_token(token: str) -> str:
    """
    Extract user ID from JWT token
    """
    try:
        payload = verify_jwt_token(token)
        return payload["uid"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user ID from token"
        )


def create_internal_api_headers() -> Dict[str, str]:
    """
    Create headers for internal API communication
    """
    return {
        "x-internal-api-key": settings.INTERNAL_API_SECRET,
        "Content-Type": "application/json"
    }


# Bearer token security scheme
security = HTTPBearer()


async def get_current_user(request: Request, token: HTTPBearer = Depends(security)) -> Dict[str, Any]:
    """
    Get current user from JWT token
    """
    try:
        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        logger.info(f"Auth header received: {auth_header[:50] if auth_header else 'None'}...")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning("Missing or invalid authorization header format")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )
        
        token_value = auth_header.split(" ")[1]
        logger.info(f"Extracted token (first 50 chars): {token_value[:50]}...")
        
        # Verify JWT token
        payload = verify_jwt_token(token_value)
        logger.info(f"JWT verification successful for user: {payload.get('email')}")
        
        return {
            "uid": payload["uid"],
            "email": payload["email"],
            "email_verified": payload.get("email_verified", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )