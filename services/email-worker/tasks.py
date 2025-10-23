"""
Email Worker Celery Tasks

Background tasks for email processing, digest generation, and OAuth token management.
"""

import os
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from celery import Celery
from dotenv import load_dotenv

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
        print(f"🔄 Starting daily digest generation at {datetime.utcnow()}")
        
        # Run the async function in the event loop
        return asyncio.run(_generate_daily_digests_async())
        
    except Exception as exc:
        print(f"❌ Error in daily digest generation: {exc}")
        raise self.retry(exc=exc)

async def _generate_daily_digests_async():
    """Async implementation of daily digest generation"""
    try:
        # Get all users with active monitored emails
        users_response = await data_server.get('/api/storage/users-with-monitored-emails')
        users = users_response.get('data', [])
        
        print(f"📊 Found {len(users)} users with monitored emails")
        
        results = []
        for user in users:
            user_id = user['id']
            
            try:
                # Check user settings
                settings_response = await data_server.get(f'/api/storage/user-settings/{user_id}')
                settings = settings_response.get('data', {})
                
                if not settings.get('dailyDigestEnabled', True):
                    print(f"⏭️  Skipping user {user_id}: daily digest disabled")
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
                print(f"❌ Error processing user {user_id}: {e}")
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
        print(f"❌ Error in daily digest generation: {e}")
        raise

@app.task(bind=True, retry_kwargs={'max_retries': 3, 'countdown': 30})
def process_user_emails(self, user_id: str):
    """
    Process emails for a specific user
    Can be called manually or as part of daily digest generation
    """
    try:
        print(f"📧 Processing emails for user {user_id}")
        
        # Run the async function in the event loop
        return asyncio.run(process_user_emails_async(user_id))
        
    except Exception as exc:
        print(f"❌ Error processing emails for user {user_id}: {exc}")
        raise self.retry(exc=exc)

async def process_user_emails_async(user_id: str) -> Dict[str, Any]:
    """Async implementation of user email processing"""
    try:
        # Get user's monitored emails
        monitored_response = await data_server.get(f'/api/storage/monitored-emails/{user_id}')
        monitored_emails = monitored_response.get('data', [])
        
        # Filter for active emails only
        active_emails = [email['email'] for email in monitored_emails if email.get('active', True)]
        
        if not active_emails:
            print(f"📭 No active monitored emails for user {user_id}")
            return {'emails_processed': 0, 'digest_created': False}
        
        print(f"📬 Found {len(active_emails)} active monitored emails for user {user_id}")
        
        # Get user's OAuth token for Gmail access
        oauth_response = await data_server.get(f'/api/storage/oauth-token/{user_id}')
        oauth_data = oauth_response.get('data')
        
        if not oauth_data:
            print(f"🔑 No OAuth token found for user {user_id}")
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
                    print(f"⚠️ Failed to save refreshed token for user {user_id}")
            except Exception as e:
                print(f"❌ Error saving refreshed token for user {user_id}: {e}")

        # Fetch emails from Gmail with token refresh callback
        emails = await gmail_client.fetch_emails(active_emails, oauth_data, save_token_callback)
        
        if not emails:
            print(f"📭 No new emails found for user {user_id}")
            return {'emails_processed': 0, 'digest_created': False}
        
        print(f"📧 Fetched {len(emails)} emails for user {user_id}")

        # Process email content
        processed_emails = []
        for email in emails:
            try:
                # Convert ParsedEmail dataclass to dict for processing
                email_dict = {
                    'id': email.id,
                    'sender': email.sender,
                    'subject': email.subject,
                    'received_at': email.received_at,
                    'content': email.content,
                    'original_link': email.original_link
                }

                # Extract and clean content
                extracted_content = await content_extractor.extract_newsletter_content(email_dict['content'])

                # Update email with extracted content
                email_dict['content'] = extracted_content
                processed_emails.append(email_dict)

            except Exception as e:
                print(f"⚠️  Error processing email {email.id}: {e}")
                continue
        
        print(f"✅ Processed {len(processed_emails)} emails for user {user_id}")
        
        # Send processed emails to data server for digest generation
        digest_payload = {
            'user_id': user_id,
            'emails': processed_emails
        }
        
        digest_response = await data_server.post('/api/digest/create', digest_payload)
        digest_result = digest_response.get('data', {})
        
        return {
            'emails_processed': len(processed_emails),
            'digest_created': True,
            'digest_id': digest_result.get('id'),
            'topics_identified': digest_result.get('topicsIdentified', 0)
        }
        
    except Exception as e:
        print(f"❌ Error in process_user_emails_async for user {user_id}: {e}")
        raise

@app.task(bind=True, retry_kwargs={'max_retries': 3, 'countdown': 120})
def refresh_oauth_tokens(self):
    """
    Refresh OAuth tokens that are close to expiring
    Runs every 6 hours to ensure tokens stay valid
    """
    try:
        print(f"🔄 Starting OAuth token refresh at {datetime.utcnow()}")
        
        return asyncio.run(_refresh_oauth_tokens_async())
        
    except Exception as exc:
        print(f"❌ Error in OAuth token refresh: {exc}")
        raise self.retry(exc=exc)

async def _refresh_oauth_tokens_async():
    """Async implementation of OAuth token refresh"""
    try:
        # Get tokens that expire within the next 6 hours
        expiry_threshold = datetime.utcnow() + timedelta(hours=6)
        
        tokens_response = await data_server.get(f'/api/storage/oauth-tokens/expiring?before={expiry_threshold.isoformat()}')
        tokens = tokens_response.get('data', [])
        
        print(f"🔑 Found {len(tokens)} tokens to refresh")
        
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
                        print(f"✅ Updated token for {token_data['email']} in database")
                    
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
                print(f"❌ Error refreshing token for {token_data.get('email', 'unknown')}: {e}")
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
        print(f"❌ Error in OAuth token refresh: {e}")
        raise

@app.task(bind=True, retry_kwargs={'max_retries': 2, 'countdown': 60})
def scan_for_newsletters(self, user_id: str):
    """
    Scan user's Gmail for potential newsletter sources
    Used during onboarding to discover newsletter subscriptions
    """
    try:
        print(f"🔍 Scanning for newsletters for user {user_id}")
        
        return asyncio.run(_scan_for_newsletters_async(user_id))
        
    except Exception as exc:
        print(f"❌ Error scanning newsletters for user {user_id}: {exc}")
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
        
        print(f"📰 Found {len(newsletters)} potential newsletter sources for user {user_id}")
        
        return {
            'newsletters': newsletters,
            'count': len(newsletters),
            'scanned_at': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error scanning newsletters for user {user_id}: {e}")
        raise

# Register tasks with Celery
if __name__ == '__main__':
    print("📋 Available Celery tasks:")
    print("  - generate_daily_digests")
    print("  - process_user_emails")
    print("  - refresh_oauth_tokens")
    print("  - scan_for_newsletters")