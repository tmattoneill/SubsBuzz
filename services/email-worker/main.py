"""
Email Worker Service - Background Email Processing

This service handles:
- Gmail API integration and email fetching
- Email content extraction and preprocessing  
- Scheduled digest generation (replacing disabled cron)
- OAuth token refresh handling
- Background task processing with Celery
"""

import os
import asyncio
import logging
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Structured logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%SZ',
)

logger = logging.getLogger(__name__)

# Celery configuration
app = Celery('email-worker')
app.config_from_object({
    'broker_url': os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    'result_backend': os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    'task_serializer': 'json',
    'accept_content': ['json'],
    'result_serializer': 'json',
    'timezone': 'UTC',
    'enable_utc': True,
    'beat_schedule': {
        'daily-digest-generation': {
            'task': 'tasks.generate_daily_digests',
            'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM UTC
        },
        'refresh-oauth-tokens': {
            'task': 'tasks.refresh_oauth_tokens',
            'schedule': crontab(minute=0, hour='*/6'),  # Every 6 hours
        },
    },
})

# Import tasks after app configuration
from tasks import generate_daily_digests, refresh_oauth_tokens, process_user_emails

if __name__ == '__main__':
    logger.info("Starting Email Worker Service")
    logger.info("Beat schedule: digest=daily@03:00UTC, token-refresh=every-6h")
    logger.info("Available tasks: generate_daily_digests, refresh_oauth_tokens, process_user_emails")

    # Start worker
    app.start()