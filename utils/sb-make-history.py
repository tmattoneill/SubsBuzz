#!/usr/bin/env python3.12
"""
SubsBuzz History Generator
Generate digest history for past days for a user account.

Usage: python sb-make-history.py --days [NUM_DAYS] --user [USERNAME] --email-exclude [LIST_EMAIL_SOURCES_TO_NOT_INCLUDE]
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import json
import time
import webbrowser
import hashlib

# Google API imports
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import base64
import re

# Database imports
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import sql

# Environment and config
from dotenv import load_dotenv

# Load environment from parent directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.dev'))

class SubsBuzzHistoryGenerator:
    def __init__(self, user_email: str, days: int, exclude_emails: List[str] = None):
        self.user_email = user_email
        self.days = days
        self.exclude_emails = exclude_emails or []
        self.db_conn = None
        self.gmail_service = None
        self.user_id = None
        
        # OAuth configuration (using existing app credentials from .env)
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = 'http://localhost:8080/auth/callback'
        
        # Database configuration
        self.database_url = os.getenv('DATABASE_URL')
        
        if not self.client_id or not self.client_secret:
            raise ValueError("Missing Google OAuth credentials in environment")
        if not self.database_url:
            raise ValueError("Missing DATABASE_URL in environment")
    
    def create_user_id(self, email: str) -> str:
        """Create a consistent user ID from email address (matching Node.js implementation)"""
        return hashlib.sha256(email.encode()).hexdigest()
    
    def connect_to_database(self):
        """Connect to PostgreSQL database"""
        try:
            self.db_conn = psycopg2.connect(
                self.database_url,
                cursor_factory=RealDictCursor
            )
            print("✅ Connected to PostgreSQL database")
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            sys.exit(1)
    
    def authenticate_gmail(self):
        """Authenticate with Gmail using OAuth2"""
        print(f"🔐 Authenticating Gmail access for: {self.user_email}")
        
        # OAuth 2.0 scopes
        scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ]
        
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=scopes
        )
        flow.redirect_uri = self.redirect_uri
        
        # Get authorization URL and open browser
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            prompt='consent'
        )
        
        print(f"🌐 Opening browser for OAuth authorization...")
        print(f"If browser doesn't open, visit: {auth_url}")
        webbrowser.open(auth_url)
        
        # Get authorization code from user
        auth_code = input("\n📋 Enter the authorization code from the redirect URL: ").strip()
        
        try:
            # Exchange authorization code for credentials
            flow.fetch_token(code=auth_code)
            credentials = flow.credentials
            
            # Build Gmail service
            self.gmail_service = build('gmail', 'v1', credentials=credentials)
            
            # Store OAuth tokens in database (matching Node.js implementation)
            self.store_oauth_tokens(credentials)
            
            print("✅ Gmail authentication successful")
            
        except Exception as e:
            print(f"❌ Gmail authentication failed: {e}")
            sys.exit(1)
    
    def store_oauth_tokens(self, credentials):
        """Store OAuth tokens in database"""
        try:
            cursor = self.db_conn.cursor()
            
            # Get user info to get UID
            user_info_service = build('oauth2', 'v2', credentials=credentials)
            user_info = user_info_service.userinfo().get().execute()
            
            uid = user_info['id']
            email = user_info['email']
            
            # Verify this matches the requested user
            if email.lower() != self.user_email.lower():
                raise ValueError(f"Authenticated email ({email}) doesn't match requested user ({self.user_email})")
            
            self.user_id = self.create_user_id(email)
            
            # Store/update OAuth tokens
            expires_at = None
            if credentials.expiry:
                expires_at = credentials.expiry
            
            cursor.execute("""
                INSERT INTO oauth_tokens (uid, email, access_token, refresh_token, expires_at, scope, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (uid) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    expires_at = EXCLUDED.expires_at,
                    scope = EXCLUDED.scope,
                    updated_at = NOW()
            """, (
                uid,
                email,
                credentials.token,
                credentials.refresh_token,
                expires_at,
                ' '.join(credentials.scopes) if credentials.scopes else None
            ))
            
            self.db_conn.commit()
            print(f"💾 Stored OAuth tokens for {email}")
            
        except Exception as e:
            print(f"❌ Failed to store OAuth tokens: {e}")
            sys.exit(1)
        finally:
            cursor.close()
    
    def get_monitored_emails(self) -> List[str]:
        """Get list of monitored email addresses for the user"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("""
                SELECT email FROM monitored_emails 
                WHERE "user_id" = %s AND active = true
            """, (self.user_id,))
            
            results = cursor.fetchall()
            monitored = [row['email'] for row in results]
            
            # Filter out excluded emails
            filtered = [email for email in monitored if email not in self.exclude_emails]
            
            print(f"📧 Found {len(monitored)} monitored emails ({len(filtered)} after exclusions)")
            return filtered
            
        except Exception as e:
            print(f"❌ Failed to get monitored emails: {e}")
            return []
        finally:
            cursor.close()
    
    def fetch_emails_for_date(self, date: datetime, senders: List[str]) -> List[Dict]:
        """Fetch emails from Gmail for a specific date"""
        try:
            # Create date range (24 hour period)
            start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = start_date + timedelta(days=1)
            
            # Format dates for Gmail search
            after_date = start_date.strftime('%Y/%m/%d')
            before_date = end_date.strftime('%Y/%m/%d')
            
            # Build Gmail search query
            sender_query = ' OR '.join([f'from:"{sender}"' for sender in senders])
            query = f'({sender_query}) after:{after_date} before:{before_date}'
            
            print(f"🔍 Searching emails with query: {query}")
            
            # Search for emails
            result = self.gmail_service.users().messages().list(
                userId='me',
                q=query
            ).execute()
            
            messages = result.get('messages', [])
            print(f"📬 Found {len(messages)} emails for {date.strftime('%Y-%m-%d')}")
            
            emails = []
            for msg in messages:
                # Get full message details
                message = self.gmail_service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='full'
                ).execute()
                
                email_data = self.parse_email_message(message)
                if email_data:
                    emails.append(email_data)
            
            return emails
            
        except Exception as e:
            print(f"❌ Failed to fetch emails for {date.strftime('%Y-%m-%d')}: {e}")
            return []
    
    def parse_email_message(self, message: Dict) -> Optional[Dict]:
        """Parse Gmail message into structured email data"""
        try:
            headers = message['payload'].get('headers', [])
            header_dict = {h['name'].lower(): h['value'] for h in headers}
            
            # Extract basic info
            sender = header_dict.get('from', 'Unknown')
            subject = header_dict.get('subject', 'No Subject')
            date_str = header_dict.get('date', '')
            
            # Parse date
            received_at = datetime.fromtimestamp(
                int(message['internalDate']) / 1000,
                tz=timezone.utc
            )
            
            # Extract email content
            content = self.extract_email_content(message['payload'])
            
            return {
                'id': message['id'],
                'sender': sender,
                'subject': subject,
                'received_at': received_at,
                'content': content,
                'thread_id': message['threadId']
            }
            
        except Exception as e:
            print(f"⚠️ Failed to parse email message: {e}")
            return None
    
    def extract_email_content(self, payload: Dict) -> str:
        """Extract text content from email payload"""
        content_parts = []
        
        def extract_parts(part):
            if part.get('mimeType') == 'text/plain':
                data = part.get('body', {}).get('data')
                if data:
                    decoded = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                    content_parts.append(decoded)
            elif part.get('mimeType') == 'text/html':
                data = part.get('body', {}).get('data')
                if data:
                    decoded = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                    # Convert HTML to text (simplified)
                    text = re.sub(r'<[^>]+>', ' ', decoded)
                    text = re.sub(r'\s+', ' ', text).strip()
                    content_parts.append(text)
            
            # Recursively process parts
            for subpart in part.get('parts', []):
                extract_parts(subpart)
        
        extract_parts(payload)
        
        # Join all content parts
        full_content = '\n\n'.join(content_parts).strip()
        
        # Limit content length (matching Node.js implementation)
        if len(full_content) > 50000:
            full_content = full_content[:50000] + "... [content truncated]"
        
        return full_content or "No content extracted"
    
    def generate_digest_for_date(self, date: datetime, emails: List[Dict]) -> Optional[Dict]:
        """Generate digest for a specific date (simplified version)"""
        if not emails:
            return None
        
        print(f"🤖 Generating digest for {date.strftime('%Y-%m-%d')} with {len(emails)} emails")
        
        # Simple digest generation (in production, this would use OpenAI)
        digest_emails = []
        topics_set = set()
        
        for email in emails:
            # Generate basic summary (truncated content)
            content = email['content']
            summary = content[:500] + "..." if len(content) > 500 else content
            
            # Extract simple topics from subject and content
            topics = self.extract_simple_topics(email['subject'], content)
            keywords = self.extract_keywords(email['subject'], content)
            
            topics_set.update(topics)
            
            digest_email = {
                'sender': email['sender'],
                'subject': email['subject'],
                'received_at': email['received_at'],
                'summary': summary,
                'full_content': content,
                'topics': topics,
                'keywords': keywords,
                'original_link': None
            }
            digest_emails.append(digest_email)
        
        return {
            'date': date,
            'emails_processed': len(emails),
            'topics_identified': len(topics_set),
            'digest_emails': digest_emails
        }
    
    def extract_simple_topics(self, subject: str, content: str) -> List[str]:
        """Extract simple topics from email content"""
        text = (subject + " " + content).lower()
        
        # Simple keyword-based topic extraction
        topics = []
        
        topic_keywords = {
            'technology': ['tech', 'software', 'ai', 'artificial intelligence', 'startup', 'innovation'],
            'business': ['business', 'finance', 'market', 'economy', 'investment', 'revenue'],
            'politics': ['politics', 'government', 'election', 'policy', 'congress', 'senate'],
            'health': ['health', 'medical', 'healthcare', 'medicine', 'wellness'],
            'science': ['science', 'research', 'study', 'discovery', 'experiment'],
            'sports': ['sports', 'game', 'team', 'player', 'match', 'tournament'],
            'entertainment': ['entertainment', 'movie', 'music', 'celebrity', 'show', 'film']
        }
        
        for topic, keywords in topic_keywords.items():
            if any(keyword in text for keyword in keywords):
                topics.append(topic)
        
        return topics[:5]  # Limit to 5 topics
    
    def extract_keywords(self, subject: str, content: str) -> List[str]:
        """Extract keywords from email content"""
        text = (subject + " " + content).lower()
        
        # Simple keyword extraction (remove common words)
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
        }
        
        # Extract words (simplified)
        words = re.findall(r'\b[a-z]{3,}\b', text)
        keywords = [w for w in words if w not in stop_words]
        
        # Get most frequent keywords
        from collections import Counter
        word_counts = Counter(keywords)
        return [word for word, count in word_counts.most_common(10)]
    
    def store_digest_in_database(self, digest_data: Dict) -> int:
        """Store digest data in PostgreSQL database"""
        try:
            cursor = self.db_conn.cursor()
            
            # Insert email digest record
            cursor.execute("""
                INSERT INTO email_digests (user_id, date, emails_processed, topics_identified)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (
                self.user_id,
                digest_data['date'],
                digest_data['emails_processed'],
                digest_data['topics_identified']
            ))
            
            digest_id = cursor.fetchone()['id']
            
            # Insert individual digest emails
            for email_data in digest_data['digest_emails']:
                cursor.execute("""
                    INSERT INTO digest_emails 
                    (digest_id, sender, subject, received_at, summary, full_content, topics, keywords, original_link)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    digest_id,
                    email_data['sender'],
                    email_data['subject'],
                    email_data['received_at'],
                    email_data['summary'],
                    email_data['full_content'],
                    email_data['topics'],
                    email_data['keywords'],
                    email_data['original_link']
                ))
            
            self.db_conn.commit()
            print(f"💾 Stored digest with ID {digest_id} in database")
            return digest_id
            
        except Exception as e:
            print(f"❌ Failed to store digest in database: {e}")
            self.db_conn.rollback()
            return None
        finally:
            cursor.close()
    
    def check_existing_digest(self, date: datetime) -> bool:
        """Check if digest already exists for the date"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("""
                SELECT id FROM email_digests 
                WHERE user_id = %s AND DATE(date) = DATE(%s)
            """, (self.user_id, date))
            
            result = cursor.fetchone()
            return result is not None
            
        except Exception as e:
            print(f"⚠️ Failed to check existing digest: {e}")
            return False
        finally:
            cursor.close()
    
    def delete_existing_digest(self, date: datetime):
        """Delete existing digest for the date"""
        try:
            cursor = self.db_conn.cursor()
            
            # Get digest ID
            cursor.execute("""
                SELECT id FROM email_digests 
                WHERE user_id = %s AND DATE(date) = DATE(%s)
            """, (self.user_id, date))
            
            result = cursor.fetchone()
            if result:
                digest_id = result['id']
                
                # Delete digest emails first (foreign key constraint)
                cursor.execute("DELETE FROM digest_emails WHERE digest_id = %s", (digest_id,))
                
                # Delete digest
                cursor.execute("DELETE FROM email_digests WHERE id = %s", (digest_id,))
                
                self.db_conn.commit()
                print(f"🗑️ Deleted existing digest for {date.strftime('%Y-%m-%d')}")
                
        except Exception as e:
            print(f"⚠️ Failed to delete existing digest: {e}")
            self.db_conn.rollback()
        finally:
            cursor.close()
    
    def verify_completion(self):
        """Verify that all days have been processed"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("""
                SELECT DATE(date) as digest_date, emails_processed, topics_identified 
                FROM email_digests 
                WHERE user_id = %s 
                ORDER BY date DESC
                LIMIT %s
            """, (self.user_id, self.days))
            
            results = cursor.fetchall()
            
            print("\n✅ Verification - Generated Digests:")
            print("=" * 50)
            for row in results:
                print(f"Date: {row['digest_date']} | Emails: {row['emails_processed']} | Topics: {row['topics_identified']}")
            
            print(f"\nTotal digests created: {len(results)}")
            
        except Exception as e:
            print(f"⚠️ Verification failed: {e}")
        finally:
            cursor.close()
    
    def run(self):
        """Main execution method"""
        print("🚀 SubsBuzz History Generator Starting...")
        print(f"User: {self.user_email}")
        print(f"Generating {self.days} days of summaries")
        if self.exclude_emails:
            print(f"Excluding emails: {', '.join(self.exclude_emails)}")
        
        # Setup
        self.connect_to_database()
        self.authenticate_gmail()
        
        # Get monitored email addresses
        monitored_emails = self.get_monitored_emails()
        if not monitored_emails:
            print("❌ No monitored emails found for user")
            return
        
        print(f"📧 Monitoring emails from: {', '.join(monitored_emails)}")
        
        # Process each day
        for day_offset in range(self.days):
            target_date = datetime.now(timezone.utc) - timedelta(days=day_offset + 1)
            print(f"\n📅 Now processing: {target_date.strftime('%Y-%m-%d')}...")
            
            # Check if digest already exists
            if self.check_existing_digest(target_date):
                print(f"⚠️ Digest already exists for {target_date.strftime('%Y-%m-%d')}, overwriting...")
                self.delete_existing_digest(target_date)
            
            # Fetch emails for this date
            emails = self.fetch_emails_for_date(target_date, monitored_emails)
            
            if emails:
                # Generate digest
                digest_data = self.generate_digest_for_date(target_date, emails)
                
                if digest_data:
                    # Store in database
                    digest_id = self.store_digest_in_database(digest_data)
                    if digest_id:
                        print(f"✅ Successfully processed {target_date.strftime('%Y-%m-%d')}")
                    else:
                        print(f"❌ Failed to store digest for {target_date.strftime('%Y-%m-%d')}")
                else:
                    print(f"⚠️ No digest generated for {target_date.strftime('%Y-%m-%d')}")
            else:
                print(f"📭 No emails found for {target_date.strftime('%Y-%m-%d')}")
            
            # Brief pause between requests
            time.sleep(1)
        
        # Verify completion
        self.verify_completion()
        
        print("\n🎉 History generation complete!")


def main():
    parser = argparse.ArgumentParser(
        description="Generate SubsBuzz digest history for past days",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --days 7 --user tmattoneill@gmail.com
  %(prog)s --days 5 --user user@example.com --email-exclude sender1@example.com,sender2@example.com
        """
    )
    
    parser.add_argument(
        '--days',
        type=int,
        required=True,
        help='Number of days to generate history for (1-10)'
    )
    
    parser.add_argument(
        '--user',
        type=str,
        required=True,
        help='User email address for Gmail authentication'
    )
    
    parser.add_argument(
        '--email-exclude',
        type=str,
        default='',
        help='Comma-separated list of email sources to exclude'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.days < 1 or args.days > 10:
        print("❌ Error: Days must be between 1 and 10")
        sys.exit(1)
    
    # Parse excluded emails
    exclude_emails = []
    if args.email_exclude:
        exclude_emails = [email.strip() for email in args.email_exclude.split(',') if email.strip()]
    
    try:
        # Create and run generator
        generator = SubsBuzzHistoryGenerator(
            user_email=args.user,
            days=args.days,
            exclude_emails=exclude_emails
        )
        generator.run()
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()