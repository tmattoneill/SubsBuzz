"""
Email Worker Celery Tasks

Background tasks for email processing, digest generation, and OAuth token management.
"""

import os
import asyncio
import logging
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from celery import Celery
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

from gmail_client import GmailClient
from content_extractor import ContentExtractor

# Load environment variables
load_dotenv()

# Celery app configuration
app = Celery('email-worker')
app.config_from_object({
    'broker_url': os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    'result_backend': os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    'task_serializer': 'json',
    'accept_content': ['json'],
    'result_serializer': 'json',
    'timezone': 'UTC',
    'enable_utc': True,
})

# Data server configuration
DATA_SERVER_URL = os.getenv('DATA_SERVER_URL', 'http://localhost:5000')
INTERNAL_API_SECRET = os.getenv('INTERNAL_API_SECRET', '')

# Initialize clients
gmail_client = GmailClient()
content_extractor = ContentExtractor()

class DataServerClient:
    """Client for communicating with the data server"""
    
    def __init__(self):
        self.base_url = DATA_SERVER_URL
        self.headers = {
            'Content-Type': 'application/json',
            'X-Internal-API-Key': INTERNAL_API_SECRET
        }
    
    async def get(self, endpoint: str) -> Dict[Any, Any]:
        """GET request to data server"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    async def post(self, endpoint: str, data: Dict[Any, Any]) -> Dict[Any, Any]:
        """POST request to data server"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}{endpoint}",
                json=data,
                headers=self.headers,
                timeout=60.0
            )
            response.raise_for_status()
            return response.json()
    
    async def patch(self, endpoint: str, data: Dict[Any, Any]) -> Dict[Any, Any]:
        """PATCH request to data server"""
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.base_url}{endpoint}",
                json=data,
                headers=self.headers,
                timeout=60.0
            )
            response.raise_for_status()
            return response.json()

data_server = DataServerClient()

@app.task(bind=True, retry_kwargs={'max_retries': 3, 'countdown': 60})
def generate_daily_digests(self):
    """
    Generate daily digests for all active users
    Replaces the disabled cron job functionality
    """
    try:
        logger.info("Starting daily digest generation task_id=%s", self.request.id)
        start = datetime.utcnow()

        result = asyncio.run(_generate_daily_digests_async())

        duration = (datetime.utcnow() - start).total_seconds()
        logger.info("Daily digest generation complete duration=%.1fs users=%d", duration, result.get('total_users', 0))
        return result

    except Exception as exc:
        logger.error("Daily digest generation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc)

async def _generate_daily_digests_async():
    """Async implementation of daily digest generation"""
    try:
        # Get all users with active monitored emails
        users_response = await data_server.get('/api/storage/users-with-monitored-emails')
        users = users_response.get('data', [])
        
        logger.info("Found %d users with monitored emails", len(users))
        
        results = []
        for user in users:
            user_id = user['id']
            
            try:
                # Check user settings
                settings_response = await data_server.get(f'/api/storage/user-settings/{user_id}')
                settings = settings_response.get('data', {})
                
                if not settings.get('dailyDigestEnabled', True):
                    logger.info("Skipping user=%s: daily digest disabled", user_id)
                    continue
                
                # Process emails for this user
                result = await process_user_emails_async(user_id)
                results.append({
                    'user_id': user_id,
                    'status': 'success',
                    'emails_processed': result.get('emails_processed', 0),
                    'digest_created': result.get('digest_created', False)
                })
                
            except Exception as e:
                logger.error("Error processing user=%s: %s", user_id, e, exc_info=True)
                results.append({
                    'user_id': user_id,
                    'status': 'error',
                    'error': str(e)
                })

        return {
            'total_users': len(users),
            'results': results,
            'completed_at': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Fatal error in _generate_daily_digests_async: %s", e, exc_info=True)
        raise

@app.task(bind=True, retry_kwargs={'max_retries': 3, 'countdown': 30})
def process_user_emails(self, user_id: str):
    """
    Process emails for a specific user
    Can be called manually or as part of daily digest generation
    """
    try:
        logger.info("Processing emails user=%s task_id=%s", user_id, self.request.id)
        start = datetime.utcnow()

        result = asyncio.run(process_user_emails_async(user_id))

        duration = (datetime.utcnow() - start).total_seconds()
        logger.info("Email processing complete user=%s emails=%d duration=%.1fs", user_id, result.get('emails_processed', 0), duration)
        return result

    except Exception as exc:
        logger.error("Email processing failed user=%s: %s", user_id, exc, exc_info=True)
        raise self.retry(exc=exc)

async def process_user_emails_async(user_id: str) -> Dict[str, Any]:
    """Async implementation of user email processing"""
    try:
        # Idempotency guard: skip if a digest already exists for today (UTC).
        # Defence-in-depth against (a) duplicate cron invocations, (b) manual
        # spam-clicks of "Generate Digest", and (c) past instances of the
        # storage.getUsersWithMonitoredEmails Nx-loop bug. Without this, each
        # repeat run incurs full Gmail + OpenAI cost and overwrites the prior
        # digest in place (storage.createEmailDigest deletes-and-replaces on
        # same-day collision, masking the duplication in the data).
        today_str = datetime.utcnow().strftime('%Y-%m-%d')
        try:
            await data_server.get(f'/api/storage/email-digest/{user_id}/date/{today_str}')
            logger.info("Digest already exists user=%s date=%s — skipping", user_id, today_str)
            return {
                'emails_processed': 0,
                'digest_created': False,
                'reason': 'already_processed_today',
            }
        except httpx.HTTPStatusError as e:
            if e.response.status_code != 404:
                # Real error (5xx, auth, etc.) — log and bail rather than
                # silently proceeding into a possibly-duplicate run.
                logger.error("Idempotency check failed user=%s status=%d: %s", user_id, e.response.status_code, e)
                raise
            # 404 = no digest yet today — proceed normally.

        # Get user's monitored emails
        monitored_response = await data_server.get(f'/api/storage/monitored-emails/{user_id}')
        monitored_emails = monitored_response.get('data', [])
        
        # Filter for active emails only
        active_emails = [email['email'] for email in monitored_emails if email.get('active', True)]
        
        if not active_emails:
            logger.info("No active monitored emails user=%s", user_id)
            return {'emails_processed': 0, 'digest_created': False}

        logger.info("Found %d active monitored emails user=%s", len(active_emails), user_id)
        
        # Get user's OAuth token for Gmail access
        oauth_response = await data_server.get(f'/api/storage/oauth-token/{user_id}')
        oauth_data = oauth_response.get('data')
        
        if not oauth_data:
            logger.warning("No OAuth token found user=%s", user_id)
            return {'emails_processed': 0, 'digest_created': False, 'error': 'No OAuth token'}
        
        # Create callback to save refreshed tokens
        async def save_token_callback(refreshed_token_data):
            """Save refreshed token back to database"""
            try:
                update_response = await data_server.patch(f'/api/storage/oauth-token/{user_id}', {
                    'accessToken': refreshed_token_data['access_token'],
                    'refreshToken': refreshed_token_data.get('refresh_token'),
                    'expiresAt': refreshed_token_data.get('expires_at')
                })
                if not update_response.get('success'):
                    logger.warning("Failed to save refreshed token user=%s", user_id)
            except Exception as e:
                logger.error("Error saving refreshed token user=%s: %s", user_id, e, exc_info=True)

        # Fetch emails from Gmail with token refresh callback
        emails = await gmail_client.fetch_emails(active_emails, oauth_data, save_token_callback)
        
        if not emails:
            logger.info("No new emails found user=%s", user_id)
            return {'emails_processed': 0, 'digest_created': False}

        logger.info("Fetched %d emails user=%s", len(emails), user_id)

        # Process email content
        processed_emails = []
        for email in emails:
            try:
                # Convert ParsedEmail dataclass to dict for processing.
                # gmail_message_id is persisted to digest_emails so post-digest cleanup
                # tasks can act on the source Gmail message.
                email_dict = {
                    'id': email.id,
                    'gmail_message_id': email.id,
                    'sender': email.sender,
                    'subject': email.subject,
                    'received_at': email.received_at,
                    'content': email.content,
                    'original_link': email.original_link
                }

                # Extract hero image BEFORE replacing content with plain text
                # (hero extraction needs the original HTML; content extraction strips it)
                hero_image_url = content_extractor.extract_hero_image(email_dict['content'])
                if hero_image_url:
                    logger.info("hero_image extracted for %s: %s", email.id, hero_image_url)

                # Extract and clean content
                extracted_content = await content_extractor.extract_newsletter_content(email_dict['content'])

                # Update email with extracted content + hero image URL
                email_dict['content'] = extracted_content
                email_dict['hero_image_url'] = hero_image_url
                processed_emails.append(email_dict)

            except Exception as e:
                logger.warning("Error processing email id=%s: %s", email.id, e)
                continue

        logger.info("Content extraction complete user=%s emails=%d", user_id, len(processed_emails))

        # Snapshot the user's inbox-cleanup preference BEFORE kicking off the digest,
        # so a mid-flight settings change can't cause unexpected cleanup actions.
        cleanup_action = 'none'
        cleanup_label_name = 'SubsBuzz'
        try:
            settings_response = await data_server.get(f'/api/storage/user-settings/{user_id}')
            settings = settings_response.get('data') or {}
            cleanup_action = settings.get('inboxCleanupAction') or 'none'
            cleanup_label_name = settings.get('inboxCleanupLabelName') or 'SubsBuzz'
        except Exception as e:
            logger.warning("Could not load cleanup settings user=%s (defaulting to 'none'): %s", user_id, e)

        # Send processed emails to data server for digest generation
        digest_payload = {
            'user_id': user_id,
            'emails': processed_emails
        }

        digest_response = await data_server.post('/api/digest/create', digest_payload)
        digest_result = digest_response.get('data', {})

        # Enqueue per-message cleanup tasks (snapshot action + label into task args).
        # Per-message for retry isolation — one failed message doesn't block the rest.
        if cleanup_action != 'none':
            enqueued = 0
            for processed in processed_emails:
                gmail_id = processed.get('gmail_message_id')
                if not gmail_id:
                    continue
                cleanup_digest_email.delay(user_id, gmail_id, cleanup_action, cleanup_label_name)
                enqueued += 1
            logger.info("Enqueued %d cleanup tasks user=%s action=%s", enqueued, user_id, cleanup_action)

        return {
            'emails_processed': len(processed_emails),
            'digest_created': True,
            'digest_id': digest_result.get('id'),
            'topics_identified': digest_result.get('topicsIdentified', 0),
            'cleanup_action': cleanup_action,
        }
        
    except Exception as e:
        logger.error("Fatal error in process_user_emails_async user=%s: %s", user_id, e, exc_info=True)
        raise

@app.task(bind=True, retry_kwargs={'max_retries': 3, 'countdown': 120})
def refresh_oauth_tokens(self):
    """
    Refresh OAuth tokens that are close to expiring
    Runs every 6 hours to ensure tokens stay valid
    """
    try:
        logger.info("Starting OAuth token refresh task_id=%s", self.request.id)
        start = datetime.utcnow()

        result = asyncio.run(_refresh_oauth_tokens_async())

        duration = (datetime.utcnow() - start).total_seconds()
        logger.info("OAuth token refresh complete tokens=%d duration=%.1fs", result.get('tokens_checked', 0), duration)
        return result

    except Exception as exc:
        logger.error("OAuth token refresh failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc)

async def _refresh_oauth_tokens_async():
    """Async implementation of OAuth token refresh"""
    try:
        # Get tokens that expire within the next 6 hours
        expiry_threshold = datetime.utcnow() + timedelta(hours=6)
        
        tokens_response = await data_server.get(f'/api/storage/oauth-tokens/expiring?before={expiry_threshold.isoformat()}')
        tokens = tokens_response.get('data', [])
        
        logger.info("Found %d tokens to refresh", len(tokens))
        
        results = []
        for token_data in tokens:
            try:
                # Attempt to refresh the token
                refreshed = await gmail_client.refresh_oauth_token(token_data)
                
                if refreshed:
                    # Update token in database using correct endpoint and field names
                    update_response = await data_server.patch(f'/api/storage/oauth-token/{token_data["uid"]}', {
                        'accessToken': refreshed['access_token'],
                        'refreshToken': refreshed.get('refresh_token'),
                        'expiresAt': refreshed.get('expires_at')
                    })
                    
                    if update_response.get('success'):
                        logger.info("Token refreshed and stored email=%s", token_data['email'])
                    
                    results.append({
                        'uid': token_data['uid'],
                        'email': token_data['email'],
                        'status': 'refreshed'
                    })
                else:
                    results.append({
                        'uid': token_data['uid'],
                        'email': token_data['email'],
                        'status': 'failed'
                    })
                    
            except Exception as e:
                logger.error("Error refreshing token email=%s: %s", token_data.get('email', 'unknown'), e, exc_info=True)
                results.append({
                    'uid': token_data['uid'],
                    'email': token_data['email'],
                    'status': 'error',
                    'error': str(e)
                })
        
        return {
            'tokens_checked': len(tokens),
            'results': results,
            'completed_at': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Fatal error in _refresh_oauth_tokens_async: %s", e, exc_info=True)
        raise

@app.task(bind=True, retry_kwargs={'max_retries': 2, 'countdown': 30})
def archive_email(self, user_id: str, gmail_message_id: str):
    """
    Archive a Gmail message for a user (removes INBOX label).
    Triggered by the API Gateway when the user clicks Archive in the UI.
    """
    try:
        logger.info("Archiving message user=%s message_id=%s task_id=%s", user_id, gmail_message_id, self.request.id)
        return asyncio.run(_archive_email_async(user_id, gmail_message_id))
    except Exception as exc:
        logger.error("Archive task failed user=%s message_id=%s: %s", user_id, gmail_message_id, exc, exc_info=True)
        raise self.retry(exc=exc)

async def _archive_email_async(user_id: str, gmail_message_id: str) -> Dict[str, Any]:
    """Async implementation of email archiving"""
    try:
        oauth_response = await data_server.get(f'/api/storage/oauth-token/{user_id}')
        oauth_data = oauth_response.get('data')

        if not oauth_data:
            logger.warning("No OAuth token found for archive user=%s", user_id)
            return {'success': False, 'error': 'No OAuth token'}

        success = await gmail_client.archive_message(gmail_message_id, oauth_data)
        if success:
            logger.info("Message archived user=%s message_id=%s", user_id, gmail_message_id)
        else:
            logger.warning("Archive returned False user=%s message_id=%s", user_id, gmail_message_id)

        return {'success': success, 'message_id': gmail_message_id}

    except Exception as e:
        logger.error("_archive_email_async failed user=%s message_id=%s: %s", user_id, gmail_message_id, e, exc_info=True)
        raise

# Actions supported by the inbox-cleanup feature. Keep in sync with:
# - services/data-server/src/db/schema.ts (userSettings.inboxCleanupAction default)
# - services/api-gateway/routes/settings.py (SettingsUpdateRequest validation)
CLEANUP_ACTIONS = {'none', 'mark_read', 'mark_read_archive', 'mark_read_label_archive', 'trash'}

@app.task(bind=True, retry_kwargs={'max_retries': 2, 'countdown': 30})
def cleanup_digest_email(self, user_id: str, gmail_message_id: str, action: str, label_name: str = 'SubsBuzz'):
    """
    Post-digest cleanup of a source Gmail message.
    Action + label_name are snapshotted at enqueue time so the task is immune
    to mid-flight settings changes. See process_user_emails_async for the enqueue site.
    """
    try:
        logger.info(
            "Cleanup user=%s message_id=%s action=%s task_id=%s",
            user_id, gmail_message_id, action, self.request.id
        )
        return asyncio.run(_cleanup_digest_email_async(user_id, gmail_message_id, action, label_name))
    except Exception as exc:
        logger.error(
            "Cleanup task failed user=%s message_id=%s action=%s: %s",
            user_id, gmail_message_id, action, exc, exc_info=True
        )
        raise self.retry(exc=exc)

async def _cleanup_digest_email_async(
    user_id: str,
    gmail_message_id: str,
    action: str,
    label_name: str
) -> Dict[str, Any]:
    """Async implementation of per-message cleanup."""
    if action == 'none':
        return {'success': True, 'action': 'none', 'skipped': True}

    if action not in CLEANUP_ACTIONS:
        logger.warning("Unknown cleanup action=%s user=%s — skipping", action, user_id)
        return {'success': False, 'action': action, 'error': 'unknown_action'}

    try:
        oauth_response = await data_server.get(f'/api/storage/oauth-token/{user_id}')
        oauth_data = oauth_response.get('data')

        if not oauth_data:
            logger.warning("No OAuth token for cleanup user=%s", user_id)
            return {'success': False, 'action': action, 'error': 'no_oauth_token'}

        # Scope guard: non-'none' actions all require gmail.modify. If the stored scope
        # predates the feature (gmail.readonly only), log a warning and no-op rather than
        # hammering Gmail with guaranteed-403 requests.
        granted_scope = (oauth_data.get('scope') or '')
        if 'gmail.modify' not in granted_scope and 'mail.google.com' not in granted_scope:
            logger.warning(
                "Skipping cleanup user=%s action=%s: stored OAuth scope lacks gmail.modify (has='%s')",
                user_id, action, granted_scope
            )
            return {'success': False, 'action': action, 'error': 'insufficient_scope'}

        success = False

        if action == 'mark_read':
            success = await gmail_client.mark_as_read(gmail_message_id, oauth_data)

        elif action == 'mark_read_archive':
            # Single Gmail modify call removes both UNREAD and INBOX labels.
            success = await gmail_client.mark_read_and_archive(gmail_message_id, oauth_data)

        elif action == 'mark_read_label_archive':
            label_id = await gmail_client.get_or_create_label(label_name, oauth_data)
            if not label_id:
                logger.warning(
                    "Cleanup could not resolve label='%s' user=%s message_id=%s — skipping label step",
                    label_name, user_id, gmail_message_id
                )
                # Fall back to mark_read_archive — the user still gets the cleanup effect.
                success = await gmail_client.mark_read_and_archive(gmail_message_id, oauth_data)
            else:
                # Label first (additive, safe even if later steps no-op), then read+archive.
                label_ok = await gmail_client.add_label(gmail_message_id, label_id, oauth_data)
                archive_ok = await gmail_client.mark_read_and_archive(gmail_message_id, oauth_data)
                success = label_ok and archive_ok

        elif action == 'trash':
            success = await gmail_client.trash_message(gmail_message_id, oauth_data)

        if success:
            logger.info("Cleanup done user=%s message_id=%s action=%s", user_id, gmail_message_id, action)
        else:
            logger.warning("Cleanup returned False user=%s message_id=%s action=%s", user_id, gmail_message_id, action)

        return {'success': success, 'action': action, 'message_id': gmail_message_id}

    except Exception as e:
        logger.error(
            "_cleanup_digest_email_async failed user=%s message_id=%s action=%s: %s",
            user_id, gmail_message_id, action, e, exc_info=True
        )
        raise

@app.task(bind=True, retry_kwargs={'max_retries': 2, 'countdown': 60})
def scan_for_newsletters(self, user_id: str):
    """
    Scan user's Gmail for potential newsletter sources
    Used during onboarding to discover newsletter subscriptions
    """
    try:
        logger.info("Scanning for newsletters user=%s task_id=%s", user_id, self.request.id)

        return asyncio.run(_scan_for_newsletters_async(user_id))

    except Exception as exc:
        logger.error("Newsletter scan failed user=%s: %s", user_id, exc, exc_info=True)
        raise self.retry(exc=exc)

async def _scan_for_newsletters_async(user_id: str) -> Dict[str, Any]:
    """Async implementation of newsletter scanning"""
    try:
        # Get user's OAuth token
        oauth_response = await data_server.get(f'/api/storage/oauth-token/{user_id}')
        oauth_data = oauth_response.get('data')

        if not oauth_data:
            return {'newsletters': [], 'error': 'No OAuth token'}

        # Scan for newsletters using Gmail client
        newsletters = await gmail_client.scan_for_newsletters(oauth_data)

        logger.info("Found %d potential newsletter sources user=%s", len(newsletters), user_id)

        return {
            'newsletters': newsletters,
            'count': len(newsletters),
            'scanned_at': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Newsletter scan async failed user=%s: %s", user_id, e, exc_info=True)
        raise

# Register tasks with Celery
if __name__ == '__main__':
    logger.info("Available Celery tasks: generate_daily_digests, process_user_emails, refresh_oauth_tokens, archive_email, cleanup_digest_email, scan_for_newsletters")