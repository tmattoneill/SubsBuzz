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
from celery import Celery
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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
            'schedule': '0 7 * * *',  # Daily at 7 AM
        },
        'refresh-oauth-tokens': {
            'task': 'tasks.refresh_oauth_tokens',
            'schedule': '0 */6 * * *',  # Every 6 hours
        },
    },
})

# Import tasks after app configuration
from tasks import generate_daily_digests, refresh_oauth_tokens, process_user_emails

if __name__ == '__main__':
    print("Starting Email Worker Service...")
    print("Available tasks:")
    print("- generate_daily_digests")
    print("- refresh_oauth_tokens") 
    print("- process_user_emails")
    
    # Start worker
    app.start()