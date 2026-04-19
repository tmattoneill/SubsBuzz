"""
Email categories routes — proxy to Data Server.

User-scoped categories for monitored-email senders (TEEPER-105).
The data-server lazy-seeds 10 defaults on first GET; slugs are immutable
after create so /category/:slug URLs never 404 on rename.
"""

import logging
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth import create_internal_api_headers, get_current_user
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class CategoryResponse(BaseModel):
    success: bool
    data: Any


class CreateCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    color: Optional[str] = None
    sortOrder: Optional[int] = None


class UpdateCategoryRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    color: Optional[str] = None
    sortOrder: Optional[int] = None


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
                # Surface data-server error codes (409 DUPLICATE, 400 INVALID_CATEGORY, etc.)
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


@router.get("", response_model=CategoryResponse)
async def list_categories(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["uid"]
    result = await proxy_to_data_server("GET", f"storage/email-categories/{user_id}")
    return CategoryResponse(success=True, data=result.get("data", []))


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    request: CreateCategoryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    payload: Dict[str, Any] = {"userId": user_id, "name": request.name}
    if request.color is not None:
        payload["color"] = request.color
    if request.sortOrder is not None:
        payload["sortOrder"] = request.sortOrder
    result = await proxy_to_data_server("POST", "storage/email-categories", json_data=payload)
    return CategoryResponse(success=True, data=result.get("data", {}))


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    request: UpdateCategoryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    # Ownership is enforced server-side: the data-server scopes the UPDATE by
    # (id, userId) and returns 404 if the row doesn't belong to this user.
    payload: Dict[str, Any] = {"userId": user_id}
    if request.name is not None:
        payload["name"] = request.name
    if request.color is not None:
        payload["color"] = request.color
    if request.sortOrder is not None:
        payload["sortOrder"] = request.sortOrder
    result = await proxy_to_data_server("PATCH", f"storage/email-categories/{category_id}", json_data=payload)
    return CategoryResponse(success=True, data=result.get("data", {}))


@router.delete("/{category_id}", response_model=CategoryResponse)
async def delete_category(
    category_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["uid"]
    await proxy_to_data_server(
        "DELETE",
        f"storage/email-categories/{category_id}",
        json_data={"userId": user_id},
    )
    return CategoryResponse(success=True, data=None)
