"""
Onboarding routes for the API Gateway (TEEPER-208).

POST /scan          → enqueue a 72h Gmail newsletter scan via Celery
GET  /scan/{id}     → poll for the scan result
"""

import logging
from typing import Any, Dict

from celery import Celery
from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Celery client bound to the same Redis broker as the email worker. Used only
# to send + retrieve task results — does not run workers itself.
_celery = Celery(broker=settings.REDIS_URL, backend=settings.REDIS_URL)


@router.post("/scan")
async def kick_off_scan(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Kick off a newsletter scan over the current user's last 72h of Gmail.
    Returns a task_id immediately; poll GET /scan/{task_id} for the result.
    """
    user_id = current_user["uid"]
    try:
        task = _celery.send_task(
            "tasks.scan_for_newsletters",
            args=[user_id],
            queue="celery",
        )
        logger.info("Dispatched scan_for_newsletters task user=%s task_id=%s", user_id, task.id)
        return {"success": True, "task_id": task.id, "status": "queued"}
    except Exception as e:
        logger.error("Failed to dispatch scan task user=%s: %s", user_id, e)
        raise HTTPException(status_code=503, detail="Could not queue scan task — broker unavailable")


@router.get("/scan/{task_id}")
async def get_scan_result(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Fetch the status / result of a previously-dispatched scan. The response
    shape is `{status: 'pending'|'done'|'failed', result?: {...}, error?: str}`.
    The frontend polls this every ~2s while the modal sits on the SCANNING step.
    """
    try:
        res = AsyncResult(task_id, app=_celery)
        if not res.ready():
            return {"status": "pending", "task_id": task_id}
        if res.failed():
            return {"status": "failed", "task_id": task_id, "error": str(res.result)}
        # Successful: result is the dict returned by _scan_for_newsletters_async.
        return {"status": "done", "task_id": task_id, "result": res.result}
    except Exception as e:
        logger.error("Failed to read scan result task_id=%s: %s", task_id, e)
        raise HTTPException(status_code=503, detail="Could not fetch scan result")
