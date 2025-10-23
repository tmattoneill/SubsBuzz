"""
Gmail Client for Email Worker Service

Handles Gmail API integration, OAuth token management, and email fetching.
Extracted from server/gmail.ts with Python implementation.
"""

import os
import json
import base64
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import asyncio
import aiohttp

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

@dataclass
class ParsedEmail:
    """Parsed email data structure"""
    id: str
    sender: str
    subject: str
    received_at: str
    content: str
    original_link: Optional[str] = None

@dataclass
class NewsletterSender:
    """Newsletter sender information"""
    email: str
    name: str
    count: int
    latest_subject: str
    has_unsubscribe: bool

class GmailClient:
    """Gmail API client for email processing"""
    
    def __init__(self):
        self.client_id = os.getenv('GOOGLE_CLIENT_ID', '')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET', '')
        self.redirect_uri = os.getenv('OAUTH_REDIRECT_URI', 'http://127.0.0.1:5500/auth/callback')
        
        if not self.client_id or not self.client_secret:
            raise ValueError("Google OAuth credentials not configured")
    
    def _create_credentials(self, oauth_data: Dict[str, Any]) -> Credentials:
        """Create Google OAuth credentials from stored token data"""
        token_data = {
            'token': oauth_data['access_token'],
            'refresh_token': oauth_data.get('refresh_token'),
            'token_uri': 'https://oauth2.googleapis.com/token',
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }
        
        if oauth_data.get('expires_at'):
            # Convert expires_at to expiry if provided
            if isinstance(oauth_data['expires_at'], str):
                expires_at = datetime.fromisoformat(oauth_data['expires_at'].replace('Z', '+00:00'))
            else:
                expires_at = oauth_data['expires_at']
            token_data['expiry'] = expires_at
        
        return Credentials.from_authorized_user_info(token_data)
    
    async def refresh_oauth_token(self, oauth_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Refresh an OAuth token if it's expired or close to expiring
        Returns updated token data or None if refresh failed
        """
        try:
            credentials = self._create_credentials(oauth_data)
            
            # Check if token needs refresh
            if not credentials.expired:
                print(f"🔑 Token for {oauth_data.get('email', 'unknown')} is still valid")
                return None
            
            # Refresh the token
            print(f"🔄 Refreshing token for {oauth_data.get('email', 'unknown')}")
            request = Request()
            credentials.refresh(request)
            
            # Return updated token data
            updated_data = {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'expires_at': credentials.expiry.isoformat() if credentials.expiry else None
            }
            
            print(f"✅ Token refreshed successfully for {oauth_data.get('email', 'unknown')}")
            return updated_data
            
        except Exception as e:
            print(f"❌ Error refreshing token for {oauth_data.get('email', 'unknown')}: {e}")
            return None
    
    async def fetch_emails(self, monitored_senders: List[str], oauth_data: Dict[str, Any], save_refreshed_token_callback=None) -> List[ParsedEmail]:
        """
        Fetch emails from Gmail API for monitored senders
        Extracted from server/gmail.ts fetchEmails function
        """
        try:
            print(f"📧 Fetching emails from {len(monitored_senders)} monitored senders")
            
            # Filter out empty sender emails
            valid_senders = [sender.strip() for sender in monitored_senders if sender.strip()]
            
            if not valid_senders:
                print("📭 No valid sender emails provided")
                return []
            
            # Create credentials
            credentials = self._create_credentials(oauth_data)
            
            # Refresh token if needed
            if credentials.expired and credentials.refresh_token:
                print("🔄 Refreshing expired token...")
                request = Request()
                credentials.refresh(request)
                
                # Save refreshed token back to database if callback provided
                if save_refreshed_token_callback:
                    refreshed_token_data = {
                        'access_token': credentials.token,
                        'refresh_token': credentials.refresh_token,
                        'expires_at': credentials.expiry.isoformat() if credentials.expiry else None
                    }
                    await save_refreshed_token_callback(refreshed_token_data)
                    print(f"✅ Saved refreshed token for {oauth_data.get('email', 'unknown')}")
            
            # Build Gmail service
            service = build('gmail', 'v1', credentials=credentials)
            
            # Create search query - look back 24 hours
            one_day_ago = datetime.utcnow() - timedelta(days=1)
            after_date = one_day_ago.strftime('%Y/%m/%d')
            
            # Build query: from:(sender1 OR sender2) after:YYYY/MM/DD
            from_query = ' OR '.join([f'"{sender}"' for sender in valid_senders])
            search_query = f'from:({from_query}) after:{after_date}'
            
            print(f"🔍 Gmail search query: {search_query}")
            
            # Search for messages
            try:
                results = service.users().messages().list(
                    userId='me',
                    q=search_query
                ).execute()
                
                messages = results.get('messages', [])
                print(f"📬 Found {len(messages)} matching emails")
                
                if not messages:
                    return []
                
                # Fetch message details
                emails = []
                for message in messages:
                    try:
                        message_data = service.users().messages().get(
                            userId='me',
                            id=message['id']
                        ).execute()
                        
                        parsed_email = await self._parse_gmail_message(message_data)
                        
                        # Only include emails from monitored senders
                        if any(sender in parsed_email.sender for sender in valid_senders):
                            emails.append(parsed_email)
                            
                    except Exception as e:
                        print(f"⚠️  Error processing message {message.get('id', 'unknown')}: {e}")
                        continue
                
                print(f"✅ Successfully processed {len(emails)} emails")
                return emails
                
            except HttpError as e:
                print(f"❌ Gmail API error: {e}")
                return []
                
        except Exception as e:
            print(f"❌ Error fetching emails: {e}")
            return []
    
    async def _parse_gmail_message(self, message_data: Dict[str, Any]) -> ParsedEmail:
        """
        Parse Gmail API message into ParsedEmail format
        Extracted from server/gmail.ts parseGmailMessage function
        """
        headers = message_data['payload'].get('headers', [])
        
        # Extract metadata from headers
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
        from_header = next((h['value'] for h in headers if h['name'].lower() == 'from'), '')
        date_header = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')
        
        # Extract sender email
        if '<' in from_header and '>' in from_header:
            sender = from_header.split('<')[1].split('>')[0]
        else:
            sender = from_header.split()[-1] if from_header else ''
        
        # Extract email content
        content = await self._extract_message_content(message_data['payload'])
        
        # Parse received date
        try:
            received_at = datetime.strptime(date_header, '%a, %d %b %Y %H:%M:%S %z').isoformat()
        except:
            received_at = datetime.utcnow().isoformat()
        
        # Create Gmail link
        original_link = f"https://mail.google.com/mail/u/0/#inbox/{message_data['id']}"
        
        return ParsedEmail(
            id=message_data['id'],
            sender=sender,
            subject=subject,
            received_at=received_at,
            content=content,
            original_link=original_link
        )
    
    async def _extract_message_content(self, payload: Dict[str, Any]) -> str:
        """Extract text content from Gmail message payload"""
        content = ''
        
        try:
            # Check if message has body data
            if payload.get('body') and payload['body'].get('data'):
                content = base64.urlsafe_b64decode(
                    payload['body']['data'].encode('ASCII')
                ).decode('utf-8')
            
            # Check parts for multipart messages
            elif payload.get('parts'):
                # Prefer HTML over plain text for newsletters
                html_part = None
                text_part = None
                
                for part in payload['parts']:
                    mime_type = part.get('mimeType', '')
                    if mime_type == 'text/html' and part.get('body', {}).get('data'):
                        html_part = part
                    elif mime_type == 'text/plain' and part.get('body', {}).get('data'):
                        text_part = part
                
                # Use HTML part if available, otherwise text part
                preferred_part = html_part or text_part
                if preferred_part and preferred_part.get('body', {}).get('data'):
                    content = base64.urlsafe_b64decode(
                        preferred_part['body']['data'].encode('ASCII')
                    ).decode('utf-8')
            
            return content.strip()
            
        except Exception as e:
            print(f"⚠️  Error extracting message content: {e}")
            return ''
    
    async def scan_for_newsletters(self, oauth_data: Dict[str, Any]) -> List[NewsletterSender]:
        """
        Scan Gmail for potential newsletter senders
        Extracted from server/gmail.ts scanForNewsletters function
        """
        try:
            print(f"🔍 Scanning Gmail for newsletter senders")
            
            # Create credentials
            credentials = self._create_credentials(oauth_data)
            
            # Refresh token if needed
            if credentials.expired and credentials.refresh_token:
                request = Request()
                credentials.refresh(request)
            
            # Build Gmail service
            service = build('gmail', 'v1', credentials=credentials)
            
            # Look back 3 days for emails with unsubscribe mentions
            three_days_ago = datetime.utcnow() - timedelta(days=3)
            after_date = three_days_ago.strftime('%Y/%m/%d')
            search_query = f'after:{after_date} unsubscribe'
            
            print(f"🔍 Newsletter search query: {search_query}")
            
            # Search for messages
            results = service.users().messages().list(
                userId='me',
                q=search_query,
                maxResults=100  # Limit to avoid overwhelming API
            ).execute()
            
            messages = results.get('messages', [])
            print(f"📬 Found {len(messages)} potential newsletter emails")
            
            if not messages:
                return []
            
            # Group emails by sender
            sender_map = {}
            
            for message in messages:
                try:
                    message_data = service.users().messages().get(
                        userId='me',
                        id=message['id']
                    ).execute()
                    
                    headers = message_data['payload'].get('headers', [])
                    from_header = next((h['value'] for h in headers if h['name'].lower() == 'from'), '')
                    subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '')
                    
                    # Extract sender info
                    if '<' in from_header and '>' in from_header:
                        sender_name = from_header.split('<')[0].strip().replace('"', '')
                        sender_email = from_header.split('<')[1].split('>')[0]
                    else:
                        sender_email = from_header.split()[-1] if from_header else ''
                        sender_name = from_header.replace(sender_email, '').strip().replace('<>', '')
                    
                    if not sender_email:
                        continue
                    
                    # Check if email has unsubscribe content
                    has_unsubscribe = await self._check_for_unsubscribe_link(message_data['payload'])
                    
                    # Group by sender email
                    if sender_email in sender_map:
                        existing = sender_map[sender_email]
                        existing['count'] += 1
                        if has_unsubscribe:
                            existing['has_unsubscribe'] = True
                        existing['latest_subject'] = subject
                    else:
                        sender_map[sender_email] = {
                            'email': sender_email,
                            'name': sender_name or sender_email,
                            'count': 1,
                            'latest_subject': subject,
                            'has_unsubscribe': has_unsubscribe
                        }
                
                except Exception as e:
                    print(f"⚠️  Error processing newsletter message {message.get('id', 'unknown')}: {e}")
                    continue
            
            # Convert to list and filter for newsletters with unsubscribe links
            newsletters = [
                NewsletterSender(**sender_data)
                for sender_data in sender_map.values()
                if sender_data['has_unsubscribe']
            ]
            
            # Sort by email count (most frequent first)
            newsletters.sort(key=lambda x: x.count, reverse=True)
            
            print(f"📰 Found {len(newsletters)} potential newsletter senders")
            return newsletters
            
        except Exception as e:
            print(f"❌ Error scanning for newsletters: {e}")
            return []
    
    async def _check_for_unsubscribe_link(self, payload: Dict[str, Any]) -> bool:
        """Check if an email contains unsubscribe links"""
        try:
            content = await self._extract_message_content(payload)
            
            if not content:
                return False
            
            # Check for common unsubscribe patterns
            unsubscribe_patterns = [
                'unsubscribe',
                'opt-out',
                'manage.*preferences',
                'email.*preferences',
                'subscription.*settings',
                'remove.*from.*list',
                'list-unsubscribe'
            ]
            
            content_lower = content.lower()
            return any(pattern in content_lower for pattern in unsubscribe_patterns)
            
        except Exception as e:
            print(f"⚠️  Error checking for unsubscribe link: {e}")
            return False