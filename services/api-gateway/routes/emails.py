"""
Email action routes for the API Gateway - TEEPER-42

Exposes user-triggered email actions (archive, etc.) that are executed
as Celery tasks via the Redis broker.
"""

import logging
from typing import Dict, Any

from celery import Celery
from fastapi import APIRouter, HTTPException, Depends

from auth import get_current_user
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Celery app bound to the same Redis broker as the email worker
# Used only to dispatch tasks — does not run workers
_celery = Celery(broker=settings.REDIS_URL, backend=settings.REDIS_URL)


@router.post("/{message_id}/archive")
async def archive_email(
    message_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Archive a Gmail message for the current user.

    Removes the INBOX label so the message leaves the inbox without being deleted.
    The action is executed asynchronously via a Celery task.

    Path param:
      message_id — the raw Gmail message ID (last segment of the Gmail URL after #inbox/)
    """
    user_id = current_user["uid"]

    try:
        task = _celery.send_task(
            "tasks.archive_email",
            args=[user_id, message_id],
            queue="celery",
        )
        logger.info("Dispatched archive_email task user=%s message_id=%s task_id=%s", user_id, message_id, task.id)

        return {
            "success": True,
            "message": "Archive task queued",
            "task_id": task.id,
            "message_id": message_id,
        }

    except Exception as e:
        logger.error("Failed to dispatch archive_email task user=%s message_id=%s: %s", user_id, message_id, e)
        raise HTTPException(status_code=503, detail="Could not queue archive task — broker unavailable")
