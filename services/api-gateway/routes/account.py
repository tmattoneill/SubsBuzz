"""
Account routes for the API Gateway.

DELETE /api/account — hard-delete the current user's account and all
associated data. The caller MUST be authenticated as the user whose
account is being deleted; client-side confirmation (typing the user's
email back) is enforced in the frontend modal.
"""

import logging
from typing import Any, Dict

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user, create_internal_api_headers
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.delete("")
async def delete_account(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Hard-delete every row owned by the current user. Cascades through
    oauth_tokens, monitored_emails, user_settings, email_digests +
    digest_emails, thematic_* + theme_source_emails, subscriptions, and
    email_categories. Once this returns, the user's session is also
    effectively dead (the JWT still has 60min TTL but every API call that
    needs oauth_tokens / user_settings will 401/404).

    Frontend should call this and then immediately clear local tokens +
    redirect to /login.
    """
    user_id = current_user["uid"]
    email = current_user.get("email", "(unknown)")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(
                f"{settings.DATA_SERVER_URL}/api/storage/account/{user_id}",
                headers=create_internal_api_headers(),
            )

        if not resp.is_success:
            logger.error(
                "Account delete failed user=%s email=%s status=%s body=%s",
                user_id, email, resp.status_code, resp.text,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Account deletion failed — your data is still intact. Please try again or contact support.",
            )

        body = resp.json()
        deleted = body.get("data", {}).get("deleted", {})
        logger.warning(
            "Account deleted user=%s email=%s deleted=%s",
            user_id, email, deleted,
        )
        return {"success": True, "deleted": deleted}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Account delete exception user=%s: %s", user_id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account deletion failed unexpectedly.",
        )
