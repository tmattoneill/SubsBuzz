"""
Subscriptions routes — proxy to Data Server.

Smart sender parsing (v1). Subscriptions sit under a monitored_emails parent
and carry the category — so a single address like nytdirect@nytimes.com can
fan out into NYT Cooking, Wirecutter, and DealBook, each in its own category.
"""

import logging
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import create_internal_api_headers, get_current_user
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class SubscriptionResponse(BaseModel):
    success: bool
    data: Any


class UpdateSubscriptionRequest(BaseModel):
    categoryId: Optional[int] = None
    displayName: Optional[str] = None
    userConfirmed: Optional[bool] = None


class RecategoriseRequest(BaseModel):
    categoryId: Optional[int] = None


class MergeSubscriptionsRequest(BaseModel):
    keepSubscriptionId: int


async def proxy_to_data_server(
    method: str,
    path: str,
    json_data: Optional[Dict] = None,
    params: Optional[Dict] = None,
) -> Dict[str, Any]:
    url = f"{settings.DATA_SERVER_URL.rstrip('/')}/api/{path.lstrip('/')}"
    headers = create_internal_api_headers()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(method, url, json=json_data, params=params, headers=headers)
            if response.status_code >= 400:
                try:
                    payload = response.json()
                    detail = payload.get("error") or payload.get("message") or "Service error"
                except Exception:
                    detail = response.text or "Service error"
                raise HTTPException(status_code=response.status_code, detail=detail)
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Data Server request failed: {e}")
        raise HTTPException(status_code=503, detail=f"Data Server unavailable: {str(e)}")


@router.get("", response_model=SubscriptionResponse)
async def list_subscriptions(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["uid"]
    result = await proxy_to_data_server("GET", f"subscriptions/{user_id}")
    return SubscriptionResponse(success=True, data=result.get("data", []))


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: int,
    request: UpdateSubscriptionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    payload: Dict[str, Any] = {"userId": user_id}
    # categoryId: None is a valid "clear category" request, so include it
    # explicitly when the caller provided it (either as a real int or
    # explicit null) rather than suppressing on None.
    data = request.dict(exclude_unset=True)
    payload.update(data)
    result = await proxy_to_data_server("PATCH", f"subscriptions/{subscription_id}", json_data=payload)
    return SubscriptionResponse(success=True, data=result.get("data", {}))


@router.delete("/{subscription_id}", response_model=SubscriptionResponse)
async def delete_subscription(
    subscription_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    await proxy_to_data_server(
        "DELETE",
        f"subscriptions/{subscription_id}",
        json_data={"userId": user_id},
    )
    return SubscriptionResponse(success=True, data=None)


@router.post("/sender/{sender_id}/dismiss-banner", response_model=SubscriptionResponse)
async def dismiss_banner(
    sender_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    result = await proxy_to_data_server(
        "POST",
        f"subscriptions/sender/{sender_id}/dismiss-banner",
        json_data={"userId": user_id},
    )
    return SubscriptionResponse(success=True, data=result.get("data", {}))


@router.post("/sender/{sender_id}/merge", response_model=SubscriptionResponse)
async def merge_subscriptions(
    sender_id: int,
    request: MergeSubscriptionsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    payload = {"userId": user_id, "keepSubscriptionId": request.keepSubscriptionId}
    result = await proxy_to_data_server(
        "POST",
        f"subscriptions/sender/{sender_id}/merge",
        json_data=payload,
    )
    return SubscriptionResponse(success=True, data=result.get("data", {}))


@router.patch("/digest-email/{digest_email_id}/recategorise", response_model=SubscriptionResponse)
async def recategorise_digest_email(
    digest_email_id: int,
    request: RecategoriseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    payload = {"userId": user_id, "categoryId": request.categoryId}
    result = await proxy_to_data_server(
        "PATCH",
        f"subscriptions/digest-email/{digest_email_id}/recategorise",
        json_data=payload,
    )
    return SubscriptionResponse(success=True, data=result.get("data", {}))
