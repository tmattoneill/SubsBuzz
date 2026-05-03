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
from dataclasses import dataclass, field
import asyncio
import aiohttp

from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class OAuthRevokedError(Exception):
    """
    Raised when Google's token endpoint returns `invalid_grant` — the refresh
    token has been revoked (Google's 7-day Testing-mode policy, user revocation
    at myaccount.google.com/permissions, password change, or security event).
    Carries the uid + raw reason so callers (tasks.py) can persist
    oauth_tokens.revoked_at and surface a reconnect banner. (TEEPER-204)
    """
    def __init__(self, uid: str, reason: str):
        super().__init__(f"OAuth revoked uid={uid}: {reason}")
        self.uid = uid
        self.reason = reason

@dataclass
class ParsedEmail:
    """Parsed email data structure"""
    id: str
    sender: str
    subject: str
    received_at: str
    content: str
    original_link: Optional[str] = None
    # Smart sender parsing (v1): List-Id is the Tier-1 subscription signal;
    # from display name is used by the data-server to derive a human-readable
    # subscription display name. Both nullable — messages without List-Id
    # fall back to Tier 5 (from address) on the server side.
    list_id: Optional[str] = None
    from_display_name: Optional[str] = None

@dataclass
class NewsletterSender:
    """Newsletter sender information surfaced by the onboarding scan (TEEPER-208).
    `list_id` / `list_unsubscribe` are the strong RFC-2919/2369 signals; the
    suggested_* fields are populated by tasks._scan_for_newsletters_async after
    a publications-registry batch lookup. publication_match=True iff the registry
    knew the sender."""
    email: str
    name: str
    count: int
    latest_subject: str
    has_unsubscribe: bool
    sample_subjects: List[str] = field(default_factory=list)
    list_id: Optional[str] = None
    list_unsubscribe: Optional[str] = None
    suggested_category_slug: Optional[str] = None
    suggested_display_name: Optional[str] = None
    publication_match: bool = False

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

        # Build credentials without expiry (from_authorized_user_info expects a string
        # for expiry but we may have a datetime object — set it on the object instead)
        credentials = Credentials.from_authorized_user_info(token_data)

        if oauth_data.get('expires_at'):
            expires_val = oauth_data['expires_at']
            if isinstance(expires_val, str):
                expires_val = datetime.fromisoformat(expires_val.replace('Z', '+00:00'))
            # google-auth compares expiry to datetime.utcnow() (naive),
            # so strip timezone info to avoid offset-naive/aware comparison errors
            if hasattr(expires_val, 'tzinfo') and expires_val.tzinfo is not None:
                from datetime import timezone as _tz
                expires_val = expires_val.astimezone(_tz.utc).replace(tzinfo=None)
            credentials.expiry = expires_val

        return credentials
    
    async def refresh_oauth_token(self, oauth_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Refresh an OAuth token if it's expired or close to expiring
        Returns updated token data or None if refresh failed.
        Raises OAuthRevokedError if Google returns `invalid_grant` so the cron
        can persist oauth_tokens.revoked_at and stop retrying. (TEEPER-204)
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
            try:
                credentials.refresh(request)
            except RefreshError as e:
                if 'invalid_grant' in str(e):
                    raise OAuthRevokedError(uid=oauth_data.get('uid', ''), reason=str(e)) from e
                raise

            # Return updated token data
            updated_data = {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'expires_at': credentials.expiry.isoformat() if credentials.expiry else None
            }

            print(f"✅ Token refreshed successfully for {oauth_data.get('email', 'unknown')}")
            return updated_data

        except OAuthRevokedError:
            raise
        except Exception as e:
            print(f"❌ Error refreshing token for {oauth_data.get('email', 'unknown')}: {e}")
            return None
    
    async def archive_message(self, message_id: str, oauth_data: Dict[str, Any]) -> bool:
        """
        Archive a Gmail message by removing the INBOX label.
        Equivalent to pressing Archive in Gmail — message moves out of inbox but is not deleted.
        """
        try:
            credentials = self._create_credentials(oauth_data)
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
            service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['INBOX']}
            ).execute()
            return True

        except HttpError as e:
            if e.resp.status == 404:
                # Already deleted/moved — treat as a successful no-op
                print(f"ℹ️  Archive no-op for {message_id}: message not found (already acted on)")
                return True
            if e.resp.status == 403:
                print(f"⚠️  Archive refused for {message_id}: insufficient OAuth scope (need gmail.modify)")
                return False
            print(f"❌ Gmail API error archiving message {message_id}: {e}")
            return False
        except Exception as e:
            print(f"❌ Error archiving message {message_id}: {e}")
            return False

    async def mark_as_read(self, message_id: str, oauth_data: Dict[str, Any]) -> bool:
        """
        Mark a Gmail message as read by removing the UNREAD label.
        Leaves the message in the inbox.
        """
        try:
            credentials = self._create_credentials(oauth_data)
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
            service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            return True

        except HttpError as e:
            if e.resp.status == 404:
                print(f"ℹ️  mark_as_read no-op for {message_id}: message not found")
                return True
            if e.resp.status == 403:
                print(f"⚠️  mark_as_read refused for {message_id}: insufficient OAuth scope (need gmail.modify)")
                return False
            print(f"❌ Gmail API error marking {message_id} as read: {e}")
            return False
        except Exception as e:
            print(f"❌ Error marking {message_id} as read: {e}")
            return False

    async def mark_read_and_archive(self, message_id: str, oauth_data: Dict[str, Any]) -> bool:
        """
        Single Gmail modify call that removes both UNREAD and INBOX labels.
        Saves a round-trip vs calling mark_as_read + archive_message separately.
        """
        try:
            credentials = self._create_credentials(oauth_data)
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
            service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD', 'INBOX']}
            ).execute()
            return True

        except HttpError as e:
            if e.resp.status == 404:
                print(f"ℹ️  mark_read_and_archive no-op for {message_id}: message not found")
                return True
            if e.resp.status == 403:
                print(f"⚠️  mark_read_and_archive refused for {message_id}: insufficient OAuth scope")
                return False
            print(f"❌ Gmail API error on mark_read_and_archive for {message_id}: {e}")
            return False
        except Exception as e:
            print(f"❌ Error on mark_read_and_archive for {message_id}: {e}")
            return False

    async def add_label(self, message_id: str, label_id: str, oauth_data: Dict[str, Any]) -> bool:
        """Apply a label (by ID) to a Gmail message."""
        try:
            credentials = self._create_credentials(oauth_data)
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
            service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': [label_id]}
            ).execute()
            return True

        except HttpError as e:
            if e.resp.status == 404:
                print(f"ℹ️  add_label no-op for {message_id}: message not found")
                return True
            if e.resp.status == 403:
                print(f"⚠️  add_label refused for {message_id}: insufficient OAuth scope")
                return False
            print(f"❌ Gmail API error adding label {label_id} to {message_id}: {e}")
            return False
        except Exception as e:
            print(f"❌ Error adding label {label_id} to {message_id}: {e}")
            return False

    async def trash_message(self, message_id: str, oauth_data: Dict[str, Any]) -> bool:
        """
        Move a Gmail message to Trash. Recoverable for 30 days.
        Requires the gmail.modify OAuth scope.
        """
        try:
            credentials = self._create_credentials(oauth_data)
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
            service.users().messages().trash(userId='me', id=message_id).execute()
            return True

        except HttpError as e:
            if e.resp.status == 404:
                print(f"ℹ️  trash no-op for {message_id}: message not found (already trashed?)")
                return True
            if e.resp.status == 403:
                print(f"⚠️  trash refused for {message_id}: insufficient OAuth scope (need gmail.modify)")
                return False
            print(f"❌ Gmail API error trashing {message_id}: {e}")
            return False
        except Exception as e:
            print(f"❌ Error trashing {message_id}: {e}")
            return False

    async def get_or_create_label(self, label_name: str, oauth_data: Dict[str, Any]) -> Optional[str]:
        """
        Look up a Gmail label by name; create it if it doesn't exist.
        Returns the label ID, or None on failure. No caching — the labels API is cheap
        and self-heals if the user renames or deletes the label in Gmail.
        """
        try:
            credentials = self._create_credentials(oauth_data)
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)

            existing = service.users().labels().list(userId='me').execute()
            for label in existing.get('labels', []):
                if label.get('name') == label_name:
                    return label.get('id')

            created = service.users().labels().create(
                userId='me',
                body={
                    'name': label_name,
                    'labelListVisibility': 'labelShow',
                    'messageListVisibility': 'show'
                }
            ).execute()
            return created.get('id')

        except HttpError as e:
            if e.resp.status == 403:
                print(f"⚠️  get_or_create_label refused for '{label_name}': insufficient OAuth scope")
                return None
            print(f"❌ Gmail API error on get_or_create_label('{label_name}'): {e}")
            return None
        except Exception as e:
            print(f"❌ Error on get_or_create_label('{label_name}'): {e}")
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
                try:
                    credentials.refresh(request)
                except RefreshError as e:
                    if 'invalid_grant' in str(e):
                        raise OAuthRevokedError(uid=oauth_data.get('uid', ''), reason=str(e)) from e
                    raise

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
            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
            
            # Create search query - look back 3 days to avoid missing emails
            three_days_ago = datetime.utcnow() - timedelta(days=3)
            after_date = three_days_ago.strftime('%Y/%m/%d')
            
            # Build query: from:(sender1 OR sender2) after:YYYY/MM/DD
            from_query = ' OR '.join([f'"{sender}"' for sender in valid_senders])
            search_query = f'from:({from_query}) after:{after_date}'
            
            print(f"🔍 Gmail search query: {search_query}")
            
            # Search for messages (with pagination)
            try:
                messages = []
                page_token = None
                while True:
                    request_kwargs = {'userId': 'me', 'q': search_query, 'maxResults': 200}
                    if page_token:
                        request_kwargs['pageToken'] = page_token
                    results = service.users().messages().list(**request_kwargs).execute()
                    messages.extend(results.get('messages', []))
                    page_token = results.get('nextPageToken')
                    if not page_token:
                        break
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

        except OAuthRevokedError:
            # Bubble up so tasks.py can persist revoked_at and skip this user
            # for future cron runs. (TEEPER-204)
            raise
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
        # Smart sender parsing: List-Id is the Tier-1 subscription signal.
        list_id = next((h['value'] for h in headers if h['name'].lower() == 'list-id'), None)

        # Extract sender email + display name. Supports both
        #   "Publisher Name" <sender@example.com>
        # and the bare sender@example.com form. Display name is stripped of
        # quotes and whitespace; empty strings become None.
        sender = ''
        from_display_name: Optional[str] = None
        if from_header:
            if '<' in from_header and '>' in from_header:
                sender = from_header.split('<')[1].split('>')[0].strip()
                prefix = from_header.split('<')[0].strip()
                if prefix:
                    from_display_name = prefix.strip('"').strip("'").strip() or None
            else:
                sender = from_header.split()[-1].strip()

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
            original_link=original_link,
            list_id=list_id.strip() if isinstance(list_id, str) and list_id.strip() else None,
            from_display_name=from_display_name,
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
    
    # ESP from-domain heuristic for the onboarding scan: even without
    # List-Id/List-Unsubscribe, mail from these platforms is almost always a
    # newsletter. Lowercased; matched as suffix on the from-address.
    _NEWSLETTER_ESP_DOMAINS = (
        '@substack.com',
        '@beehiiv.com',
        '@mail.beehiiv.com',
        '@buttondown.email',
        '@convertkit.com',
        '@mailchimp.com',
        '@mailchimpapp.net',
    )

    async def scan_for_newsletters(self, oauth_data: Dict[str, Any]) -> List[NewsletterSender]:
        """
        Scan the user's Gmail for newsletter-shaped messages in the last 72h
        (TEEPER-208). Detection is RFC-2919/2369 header-driven, with ESP-domain
        and body-unsubscribe-link fallbacks. Returns NewsletterSender rows
        carrying the raw signals; the data-server then enriches each with a
        publications-registry suggestion.
        """
        try:
            print(f"🔍 Scanning Gmail for newsletter senders (72h, header-driven)")

            credentials = self._create_credentials(oauth_data)
            if credentials.expired and credentials.refresh_token:
                try:
                    credentials.refresh(Request())
                except RefreshError as e:
                    if 'invalid_grant' in str(e):
                        raise OAuthRevokedError(uid=oauth_data.get('uid', ''), reason=str(e)) from e
                    raise

            service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)

            three_days_ago = datetime.utcnow() - timedelta(days=3)
            after_date = three_days_ago.strftime('%Y/%m/%d')
            # Drop the bare "unsubscribe" keyword: it misses messages where the
            # only unsubscribe signal is the List-Unsubscribe header. -from:me
            # excludes mail you sent yourself in the window.
            search_query = f'after:{after_date} -from:me'

            print(f"🔍 Newsletter search query: {search_query}")

            messages: List[Dict[str, Any]] = []
            page_token = None
            while True:
                req = {'userId': 'me', 'q': search_query, 'maxResults': 200}
                if page_token:
                    req['pageToken'] = page_token
                results = service.users().messages().list(**req).execute()
                messages.extend(results.get('messages', []))
                page_token = results.get('nextPageToken')
                if not page_token or len(messages) >= 500:
                    break

            print(f"📬 Scanning {len(messages)} messages for newsletter signals")
            if not messages:
                return []

            sender_map: Dict[str, Dict[str, Any]] = {}

            for message in messages:
                try:
                    msg = service.users().messages().get(userId='me', id=message['id']).execute()
                    headers = msg['payload'].get('headers', [])

                    def _h(name: str) -> Optional[str]:
                        return next(
                            (h['value'] for h in headers if h['name'].lower() == name.lower()),
                            None,
                        )

                    from_header = _h('from') or ''
                    subject = _h('subject') or ''
                    list_id = _h('list-id')
                    list_unsubscribe = _h('list-unsubscribe')

                    # Parse "Display Name <addr@example.com>" → (name, email)
                    if '<' in from_header and '>' in from_header:
                        sender_name = from_header.split('<')[0].strip().replace('"', '')
                        sender_email = from_header.split('<')[1].split('>')[0].strip().lower()
                    else:
                        sender_email = (from_header.split()[-1] if from_header else '').strip().lower()
                        sender_name = from_header.replace(sender_email, '').strip().replace('<>', '')

                    if not sender_email or '@' not in sender_email:
                        continue

                    matches_esp = any(sender_email.endswith(sfx) for sfx in self._NEWSLETTER_ESP_DOMAINS)
                    has_unsubscribe = await self._check_for_unsubscribe_link(msg['payload'])

                    # A sender qualifies on ANY of these signals.
                    qualifies = bool(list_id) or bool(list_unsubscribe) or matches_esp or has_unsubscribe
                    if not qualifies:
                        continue

                    if sender_email in sender_map:
                        existing = sender_map[sender_email]
                        existing['count'] += 1
                        if has_unsubscribe:
                            existing['has_unsubscribe'] = True
                        if list_id and not existing.get('list_id'):
                            existing['list_id'] = list_id
                        if list_unsubscribe and not existing.get('list_unsubscribe'):
                            existing['list_unsubscribe'] = list_unsubscribe
                        # Keep up to 3 distinct subjects, newest-first.
                        if subject and subject not in existing['sample_subjects']:
                            existing['sample_subjects'].insert(0, subject)
                            existing['sample_subjects'] = existing['sample_subjects'][:3]
                            existing['latest_subject'] = existing['sample_subjects'][0]
                    else:
                        sender_map[sender_email] = {
                            'email': sender_email,
                            'name': sender_name or sender_email,
                            'count': 1,
                            'latest_subject': subject,
                            'has_unsubscribe': has_unsubscribe,
                            'sample_subjects': [subject] if subject else [],
                            'list_id': list_id,
                            'list_unsubscribe': list_unsubscribe,
                        }

                except Exception as e:
                    print(f"⚠️  Error processing scan message {message.get('id', 'unknown')}: {e}")
                    continue

            # Sort by signal strength: registry hits handled later in tasks.py;
            # here we sort by (has_list_id desc, has_list_unsubscribe desc, count desc).
            newsletters = [NewsletterSender(**s) for s in sender_map.values()]
            newsletters.sort(
                key=lambda x: (bool(x.list_id), bool(x.list_unsubscribe), x.count),
                reverse=True,
            )

            print(f"📰 Detected {len(newsletters)} candidate newsletter senders")
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