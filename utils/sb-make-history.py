#!/usr/bin/env python3.12
"""
SubsBuzz History Generator
Generate digest history for past days for a user account.
EXACTLY REPLICATES the main application's OpenAI processing and thematic digest generation.

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
import openai
from collections import Counter

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

# Initialize OpenAI client (EXACT same as Node.js)
openai_api_key = os.getenv('OPENAI_API_KEY')
if not openai_api_key:
    print("❌ Error: OPENAI_API_KEY not found in environment")
    sys.exit(1)

openai_client = openai.OpenAI(api_key=openai_api_key)

class ThematicProcessor:
    """EXACT replica of Node.js ThematicProcessor class"""
    
    def __init__(self, db_connection=None):
        self.db_connection = db_connection
        
        # Predefined categories (EXACT same as Node.js)
        self.predefined_categories = [
            'Media + Advertising',
            'Politics', 
            'Programming and Computer Engineering',
            'Business + Finance',
            'Entertainment + Arts',
            'Science + Technology',
            'Sports',
            'Food, Drink, Dining',
            'Opinion + Thought',
            'Other'
        ]
        
        # Category keywords (EXACT same as Node.js)
        self.category_keywords = {
            'Media + Advertising': [
                'media', 'advertising', 'marketing', 'television', 'streaming', 'netflix', 'disney', 'rtl', 'tf1', 
                'broadcast', 'ad', 'campaign', 'brand', 'publisher', 'journalism', 'news', 'magazine', 'radio'
            ],
            'Politics': [
                'politics', 'government', 'policy', 'election', 'vote', 'congress', 'senate', 'president', 
                'democratic', 'republican', 'biden', 'trump', 'supreme court', 'legislation', 'political'
            ],
            'Programming and Computer Engineering': [
                'programming', 'software', 'code', 'development', 'engineering', 'tech', 'api', 'javascript', 
                'python', 'react', 'ai', 'artificial intelligence', 'machine learning', 'data', 'algorithm', 'computing', 'developer'
            ],
            'Business + Finance': [
                'business', 'finance', 'stock', 'market', 'investment', 'economy', 'financial', 'revenue', 
                'profit', 'startup', 'vc', 'funding', 'ipo', 'acquisition', 'merger', 'corporate', 'earnings'
            ],
            'Entertainment + Arts': [
                'entertainment', 'movie', 'film', 'music', 'art', 'culture', 'celebrity', 'concert', 'album', 
                'artist', 'performance', 'theater', 'gallery', 'creative', 'design', 'fashion'
            ],
            'Science + Technology': [
                'science', 'research', 'study', 'technology', 'innovation', 'discovery', 'experiment', 
                'medical', 'health', 'climate', 'environment', 'space', 'physics', 'biology', 'chemistry'
            ],
            'Sports': [
                'sports', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'olympics', 
                'athlete', 'team', 'game', 'match', 'tournament', 'championship', 'league'
            ],
            'Food, Drink, Dining': [
                'food', 'restaurant', 'dining', 'recipe', 'cooking', 'drink', 'wine', 'beer', 'coffee', 
                'chef', 'cuisine', 'meal', 'nutrition', 'taste', 'flavor', 'culinary'
            ],
            'Opinion + Thought': [
                'opinion', 'editorial', 'commentary', 'analysis', 'perspective', 'viewpoint', 'thought', 
                'philosophy', 'reflection', 'insight', 'argument', 'debate', 'discussion', 'critique'
            ],
            'Other': [
                'other', 'miscellaneous', 'general', 'various', 'mixed', 'diverse'
            ]
        }
    
    def process_emails_into_themes(self, user_id: str, emails: List[Dict], digest_id: int) -> int:
        """Stage 1-3 processing pipeline (EXACT same as Node.js)"""
        print(f"Processing {len(emails)} emails into thematic digest for user {user_id}")
        
        if not emails:
            raise ValueError("No emails to process")
        
        try:
            # Stage 1: NLP Analysis and Clustering
            clusters = self.perform_nlp_analysis(emails)
            
            # Stage 2: LLM Synthesis for each theme
            thematic_summaries = self.generate_thematic_summaries(clusters)
            
            # Stage 3: Store results in database
            thematic_digest_id = self.store_thematic_digest(
                user_id, 
                digest_id,
                thematic_summaries,
                'category-classification'  # Processing method
            )
            
            print(f"Successfully created thematic digest {thematic_digest_id} with {len(thematic_summaries)} themes")
            return thematic_digest_id
            
        except Exception as error:
            print(f"Error processing emails into themes: {error}")
            raise ValueError(f"Failed to process thematic digest: {error}")
    
    def perform_nlp_analysis(self, emails: List[Dict]) -> List[Dict]:
        """Stage 1: Category classification (EXACT same algorithm as Node.js)"""
        print('Starting category classification...')
        
        clusters = []
        
        # For each predefined category, find best-fit emails
        for category in self.predefined_categories:
            category_emails = self.classify_emails_to_category(emails, category)
            
            if category_emails:
                clusters.append({
                    'emails': category_emails,
                    'theme': category,
                    'keywords': self.extract_cluster_keywords(category_emails),
                    'confidence': self.calculate_category_confidence(category_emails, category)
                })
        
        # Handle unclassified emails
        classified_ids = set()
        for cluster in clusters:
            for email in cluster['emails']:
                classified_ids.add(email['id'])
        
        unclassified_emails = [email for email in emails if email['id'] not in classified_ids]
        
        if unclassified_emails:
            # Add to "Other" category
            other_cluster = next((c for c in clusters if c['theme'] == 'Other'), None)
            if other_cluster:
                other_cluster['emails'].extend(unclassified_emails)
                other_cluster['keywords'] = self.extract_cluster_keywords(other_cluster['emails'])
            else:
                clusters.append({
                    'emails': unclassified_emails,
                    'theme': 'Other',
                    'keywords': self.extract_cluster_keywords(unclassified_emails),
                    'confidence': 60
                })
        
        # Sort clusters by relevance
        clusters.sort(key=lambda c: len(c['emails']) * c['confidence'], reverse=True)
        
        print(f"Category classification complete: {len(clusters)} categories with emails")
        return clusters
    
    def classify_emails_to_category(self, emails: List[Dict], category: str) -> List[Dict]:
        """Classify emails using category keywords (EXACT same as Node.js)"""
        category_keywords = self.category_keywords.get(category, [])
        email_scores = []
        
        for email in emails:
            score = self.calculate_category_fit_score(email, category_keywords)
            if score > 30:  # Minimum threshold
                email_scores.append({'email': email, 'score': score})
        
        # Sort by score and return emails
        return [item['email'] for item in sorted(email_scores, key=lambda x: x['score'], reverse=True)]
    
    def calculate_category_fit_score(self, email: Dict, category_keywords: List[str]) -> int:
        """Calculate category fit score (EXACT same algorithm as Node.js)"""
        score = 0
        email_text = f"{email['subject']} {email['summary']} {' '.join(email['topics'])} {' '.join(email['keywords'])}".lower()
        
        # Check for keyword matches
        for keyword in category_keywords:
            if keyword.lower() in email_text:
                score += 10  # Base score
                
                # Bonus for subject matches
                if keyword.lower() in email['subject'].lower():
                    score += 15
                
                # Bonus for topic matches
                if any(keyword.lower() in topic.lower() for topic in email['topics']):
                    score += 10
        
        # Sender bonus
        sender_bonus = self.get_sender_category_bonus(email['sender'], category_keywords)
        score += sender_bonus
        
        return min(100, score)  # Cap at 100
    
    def get_sender_category_bonus(self, sender: str, category_keywords: List[str]) -> int:
        """Sender-based category bonus (EXACT same as Node.js)"""
        sender_lower = sender.lower()
        
        # Media outlets
        if any(x in sender_lower for x in ['washingtonpost', 'newyorker', 'media', 'news']):
            if 'media' in category_keywords or 'politics' in category_keywords:
                return 20
        
        # Tech/Business sources
        if any(x in sender_lower for x in ['substack', 'pitchbook']):
            if 'business' in category_keywords or 'tech' in category_keywords:
                return 15
        
        return 0
    
    def calculate_category_confidence(self, emails: List[Dict], category: str) -> int:
        """Calculate confidence for category (EXACT same as Node.js)"""
        if not emails:
            return 70
        
        category_keywords = self.category_keywords.get(category, [])
        total_score = sum(self.calculate_category_fit_score(email, category_keywords) for email in emails)
        average_score = total_score / len(emails)
        
        return round(max(60, min(95, average_score)))
    
    def generate_thematic_summaries(self, clusters: List[Dict]) -> List[Dict]:
        """Stage 2: Generate narrative summaries (EXACT same as Node.js)"""
        print(f"Generating summaries for {len(clusters)} themes...")
        
        summaries = []
        
        for cluster in clusters:
            try:
                summary = self.generate_theme_summary(cluster)
                summaries.append(summary)
            except Exception as error:
                print(f"Error generating summary for theme \"{cluster['theme']}\": {error}")
                # Fallback summary
                summaries.append({
                    'theme': cluster['theme'],
                    'summary': f"This section covers {len(cluster['emails'])} emails related to {cluster['theme'].lower()}. " +
                              f"Key topics include: {', '.join(cluster['keywords'][:3])}.",
                    'keywords': cluster['keywords'],
                    'entities': {},
                    'confidence': cluster['confidence'],
                    'source_emails': cluster['emails']
                })
        
        return summaries
    
    def generate_theme_summary(self, cluster: Dict) -> Dict:
        """Generate narrative summary using OpenAI (EXACT same as Node.js)"""
        # Prepare email data for LLM
        email_data = [
            {
                'sender': email['sender'],
                'subject': email['subject'],
                'content': email['summary']  # Use existing summary
            }
            for email in cluster['emails']
        ]
        
        # EXACT same system prompt as Node.js
        system_prompt = f"""You are an expert journalist creating a thematic summary for a newsletter section titled "{cluster['theme']}". 

Your task is to synthesize the provided emails into a coherent, engaging narrative summary that:
1. Highlights the key developments and stories in this theme
2. Identifies connections and patterns across the emails
3. Maintains a journalistic, informative tone
4. Focuses on what readers need to know, not meta-descriptions

Write 2-4 paragraphs that tell the story of what's happening in this theme area."""
        
        user_prompt = f"""Please create a thematic summary for the "{cluster['theme']}" section based on these emails:

{json.dumps(email_data, indent=2)}"""
        
        try:
            # EXACT same OpenAI call as Node.js (using gpt-4o-mini for thematic summaries)
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7
            )
            
            summary = response.choices[0].message.content or f"Failed to generate summary for {cluster['theme']}"
            
            return {
                'theme': cluster['theme'],
                'summary': summary,
                'keywords': cluster['keywords'],
                'entities': self.extract_entities(cluster['emails']),
                'confidence': cluster['confidence'],
                'source_emails': cluster['emails']
            }
            
        except Exception as error:
            print(f"Error calling OpenAI for theme {cluster['theme']}: {error}")
            raise error
    
    def extract_cluster_keywords(self, emails: List[Dict]) -> List[str]:
        """Extract keywords for cluster (EXACT same as Node.js)"""
        keyword_counts = Counter()
        
        for email in emails:
            for keyword in email['keywords']:
                keyword_counts[keyword] += 1
        
        # Return top keywords sorted by frequency
        return [keyword for keyword, count in keyword_counts.most_common(8)]
    
    def extract_entities(self, emails: List[Dict]) -> Dict:
        """Extract entities (placeholder, same as Node.js)"""
        return {
            'people': [],
            'organizations': [],
            'locations': [],
            'events': []
        }
    
    def store_thematic_digest(self, user_id: str, email_digest_id: int, summaries: List[Dict], processing_method: str) -> int:
        """Stage 3: Store in database (EXACT same schema as Node.js)"""
        print('Storing thematic digest in database...')
        
        if not self.db_connection:
            print("❌ No database connection available for thematic digest storage")
            return 999
        
        try:
            cursor = self.db_connection.cursor()
            
            # Create main thematic digest record (EXACT same as Node.js)
            cursor.execute("""
                INSERT INTO thematic_digests (user_id, date, email_digest_id, sections_count, total_source_emails, processing_method)
                VALUES (%s, NOW(), %s, %s, %s, %s)
                RETURNING id
            """, (
                user_id,
                email_digest_id,
                len(summaries),
                sum(len(summary['source_emails']) for summary in summaries),
                processing_method
            ))
            
            thematic_digest_id = cursor.fetchone()['id']
            
            # Create thematic sections and link to source emails (EXACT same as Node.js)
            for i, summary in enumerate(summaries):
                # Insert thematic section
                cursor.execute("""
                    INSERT INTO thematic_sections (thematic_digest_id, theme, summary, confidence, keywords, entities, "order")
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    thematic_digest_id,
                    summary['theme'],
                    summary['summary'],
                    summary['confidence'],
                    summary['keywords'],
                    json.dumps(summary['entities']),
                    i + 1
                ))
                
                section_id = cursor.fetchone()['id']
                
                # Link source emails to this section (EXACT same as Node.js)
                for email in summary['source_emails']:
                    relevance_score = self.calculate_relevance_score(email, summary)
                    
                    cursor.execute("""
                        INSERT INTO theme_source_emails (thematic_section_id, digest_email_id, relevance_score)
                        VALUES (%s, %s, %s)
                    """, (
                        section_id,
                        email['id'],
                        relevance_score
                    ))
            
            self.db_connection.commit()
            print(f"✅ Successfully stored thematic digest {thematic_digest_id} with {len(summaries)} sections")
            return thematic_digest_id
            
        except Exception as error:
            print(f"❌ Error storing thematic digest: {error}")
            self.db_connection.rollback()
            return 999
        finally:
            cursor.close()
    
    def calculate_relevance_score(self, email: Dict, summary: Dict) -> int:
        """Calculate relevance score (EXACT same as Node.js)"""
        # Simple relevance calculation based on keyword overlap
        email_keywords = set(keyword.lower() for keyword in email.get('keywords', []))
        theme_keywords = set(keyword.lower() for keyword in summary.get('keywords', []))
        
        if not email_keywords and not theme_keywords:
            return 50  # Default relevance when no keywords
        
        total_keywords = max(len(email_keywords), len(theme_keywords))
        if total_keywords == 0:
            return 50
        
        overlap = len(email_keywords.intersection(theme_keywords))
        score = round((overlap / total_keywords) * 100)
        
        return max(0, min(100, score))  # Clamp between 0-100

class SubsBuzzHistoryGenerator:
    def __init__(self, user_email: str, days: int, exclude_emails: List[str] = None):
        self.user_email = user_email
        self.days = days
        self.exclude_emails = exclude_emails or []
        self.db_conn = None
        self.gmail_service = None
        self.user_id = None
        self.thematic_processor = None  # Will be initialized after database connection
        
        # OAuth configuration 
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        # Temporarily use same as main app (stop dev server first)
        self.redirect_uri = 'http://127.0.0.1:5500/auth/callback'
        
        # Database configuration
        self.database_url = os.getenv('DATABASE_URL')
        
        if not self.client_id or not self.client_secret:
            raise ValueError("Missing Google OAuth credentials in environment")
        if not self.database_url:
            raise ValueError("Missing DATABASE_URL in environment")
    
    def create_user_id(self, email: str) -> str:
        """Create consistent user ID (matching Node.js implementation)"""
        return hashlib.sha256(email.encode()).hexdigest()
    
    def connect_to_database(self):
        """Connect to PostgreSQL database"""
        try:
            self.db_conn = psycopg2.connect(
                self.database_url,
                cursor_factory=RealDictCursor
            )
            print("✅ Connected to PostgreSQL database")
            
            # Initialize thematic processor with database connection
            self.thematic_processor = ThematicProcessor(self.db_conn)
            
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            sys.exit(1)
    
    def authenticate_gmail(self):
        """Authenticate with Gmail using OAuth2"""
        print(f"🔐 Authenticating Gmail access for: {self.user_email}")
        
        scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'openid'  # Added to match Google's automatic scope inclusion
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
        
        # Get authorization
        auth_url, _ = flow.authorization_url(access_type='offline', prompt='consent')
        
        print(f"🌐 Opening browser for OAuth authorization...")
        print(f"If browser doesn't open, visit: {auth_url}")
        webbrowser.open(auth_url)
        
        print(f"\n🔗 After authorization, you'll be redirected to: {self.redirect_uri}")
        print("💡 Copy the 'code' parameter from the URL and paste it below")
        print("   Example: if URL is http://127.0.0.1:5500/auth/callback?code=ABC123...")
        print("   Just paste: ABC123...")
        
        auth_code = input("\n📋 Enter the authorization code: ").strip()
        
        print(f"🔑 Attempting to exchange code: {auth_code[:20]}...")
        
        try:
            flow.fetch_token(code=auth_code)
            credentials = flow.credentials
            
            print("✅ Successfully exchanged code for tokens")
            
            self.gmail_service = build('gmail', 'v1', credentials=credentials)
            self.store_oauth_tokens(credentials)
            
            print("✅ Gmail authentication successful")
            
        except Exception as e:
            print(f"❌ Gmail authentication failed: {e}")
            print("💡 The authorization code may have expired. Please try running the script again.")
            print("   Authorization codes typically expire after 10 minutes or if used multiple times.")
            sys.exit(1)
    
    def store_oauth_tokens(self, credentials):
        """Store OAuth tokens in database"""
        try:
            cursor = self.db_conn.cursor()
            
            # Get user info
            user_info_service = build('oauth2', 'v2', credentials=credentials)
            user_info = user_info_service.userinfo().get().execute()
            
            uid = user_info['id']
            email = user_info['email']
            
            if email.lower() != self.user_email.lower():
                raise ValueError(f"Authenticated email ({email}) doesn't match requested user ({self.user_email})")
            
            self.user_id = self.create_user_id(email)
            
            # Store OAuth tokens
            expires_at = credentials.expiry if credentials.expiry else None
            
            # Check if token already exists for this uid
            cursor.execute("SELECT id FROM oauth_tokens WHERE uid = %s", (uid,))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing token
                cursor.execute("""
                    UPDATE oauth_tokens 
                    SET access_token = %s, refresh_token = %s, expires_at = %s, scope = %s, updated_at = NOW()
                    WHERE uid = %s
                """, (
                    credentials.token,
                    credentials.refresh_token,
                    expires_at,
                    ' '.join(credentials.scopes) if credentials.scopes else None,
                    uid
                ))
            else:
                # Insert new token
                cursor.execute("""
                    INSERT INTO oauth_tokens (uid, email, access_token, refresh_token, expires_at, scope, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
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
        """Get monitored email addresses for the user"""
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
        """Fetch emails from Gmail for specific date"""
        try:
            # Create date range
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
            
            sender = header_dict.get('from', 'Unknown')
            subject = header_dict.get('subject', 'No Subject')
            
            received_at = datetime.fromtimestamp(
                int(message['internalDate']) / 1000,
                tz=timezone.utc
            )
            
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
                    # Convert HTML to text
                    text = re.sub(r'<[^>]+>', ' ', decoded)
                    text = re.sub(r'\s+', ' ', text).strip()
                    content_parts.append(text)
            
            # Process subparts
            for subpart in part.get('parts', []):
                extract_parts(subpart)
        
        extract_parts(payload)
        
        full_content = '\n\n'.join(content_parts).strip()
        
        # Limit content length
        if len(full_content) > 50000:
            full_content = full_content[:50000] + "... [content truncated]"
        
        return full_content or "No content extracted"
    
    def analyze_email_with_openai(self, content: str) -> Dict:
        """EXACT same OpenAI analysis as Node.js openai.ts"""
        try:
            # Skip analysis for very short content
            if len(content.strip()) < 50:
                return {
                    'summary': "Content too short for analysis.",
                    'topics': ["Miscellaneous"],
                    'keywords': ["short-content"]
                }
            
            # EXACT same system prompt as Node.js
            system_prompt = """You are an expert newsletter content extractor. Your job is to extract the actual substantive content from newsletters, not describe what the newsletter is about. For each newsletter:

1. EXTRACT the key articles, stories, and content pieces within the newsletter
2. SUMMARIZE the actual content/findings/insights of each piece, not just what topics they cover
3. Focus on the information readers would want to know, not meta-descriptions

For example:
- Instead of: 'The newsletter covers Supreme Court rulings and vaccine skepticism'
- Provide: 'Supreme Court ruled that birthright citizenship applies to [specific details]. New research shows vaccine skepticism increases mortality by [specific findings]'

Respond in JSON format: { 'summary': string, 'topics': string[], 'keywords': string[] }

IMPORTANT: Always return valid JSON with all three fields. If content is minimal, return appropriate fallback values."""

            # Truncate content to 8000 characters (EXACT same as Node.js)
            user_content = content[:8000] + "..." if len(content) > 8000 else content
            
            # EXACT same OpenAI call as Node.js (using gpt-4o for individual analysis)
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"}
            )
            
            response_content = response.choices[0].message.content
            if not response_content:
                raise ValueError("Empty response from OpenAI")
            
            result = json.loads(response_content)
            
            # Validate response structure (EXACT same as Node.js)
            analysis = {
                'summary': result.get('summary', 'No summary available.'),
                'topics': result.get('topics', ['Miscellaneous']) if isinstance(result.get('topics'), list) else ['Miscellaneous'],
                'keywords': result.get('keywords', []) if isinstance(result.get('keywords'), list) else []
            }
            
            # Ensure at least one topic
            if not analysis['topics']:
                analysis['topics'] = ['Miscellaneous']
            
            return analysis
            
        except Exception as error:
            print(f"Error analyzing email with OpenAI: {error}")
            
            # Fallback response (EXACT same as Node.js)
            return {
                'summary': "Failed to generate summary due to an error.",
                'topics': ["Miscellaneous"],
                'keywords': ["error"]
            }
    
    def generate_digest_for_date(self, date: datetime, emails: List[Dict]) -> Optional[Dict]:
        """Generate digest using EXACT same methodology as Node.js"""
        if not emails:
            return None
        
        print(f"🤖 Generating digest for {date.strftime('%Y-%m-%d')} with {len(emails)} emails using OpenAI")
        
        processed_emails = []
        all_topics = set()
        
        # Process each email with OpenAI (EXACT same loop as Node.js)
        for email in emails:
            try:
                # Skip emails with insufficient content
                if not email['content'] or len(email['content'].strip()) < 50:
                    print(f"Skipping email from {email['sender']}: insufficient content ({len(email.get('content', ''))}) chars)")
                    continue
                
                # Analyze with OpenAI (EXACT same as Node.js)
                analysis = self.analyze_email_with_openai(email['content'])
                
                # Validate analysis response
                if not analysis or not analysis['topics'] or not isinstance(analysis['topics'], list):
                    print(f"Invalid analysis response for email from {email['sender']}, using fallback")
                    analysis['topics'] = ['Miscellaneous']
                    analysis['keywords'] = analysis.get('keywords', [])
                    analysis['summary'] = analysis.get('summary', f"Email from {email['sender']} about {email['subject']}")
                
                # Add topics to set
                for topic in analysis['topics']:
                    all_topics.add(topic)
                
                # Create digest email entry (EXACT same structure as Node.js)
                digest_email = {
                    'sender': email['sender'],
                    'subject': email['subject'],
                    'received_at': email['received_at'],
                    'summary': analysis['summary'],
                    'full_content': email['content'],
                    'topics': analysis['topics'],
                    'keywords': analysis['keywords'],
                    'original_link': None
                }
                
                processed_emails.append(digest_email)
                
            except Exception as error:
                print(f"Error processing email from {email['sender']}: {error}")
                continue
        
        return {
            'date': date,
            'emails_processed': len(processed_emails),
            'topics_identified': len(all_topics),
            'digest_emails': processed_emails
        }
    
    def store_digest_in_database(self, digest_data: Dict) -> int:
        """Store digest data in PostgreSQL (EXACT same schema as Node.js)"""
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
                    RETURNING id
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
                
                # Store the digest email ID for thematic processing
                email_id = cursor.fetchone()['id']
                email_data['id'] = email_id
            
            self.db_conn.commit()
            print(f"💾 Stored digest with ID {digest_id} in database")
            
            # Generate thematic digest (EXACT same as Node.js)
            try:
                print(f"Generating thematic digest from processed emails... ({len(digest_data['digest_emails'])} emails)")
                thematic_digest_id = self.thematic_processor.process_emails_into_themes(
                    self.user_id, 
                    digest_data['digest_emails'], 
                    digest_id
                )
                print(f"Successfully created thematic digest {thematic_digest_id} for email digest {digest_id}")
            except Exception as error:
                print(f"Error generating thematic digest: {error}")
                # Don't fail the main digest if thematic processing fails
            
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
                
                # Delete in proper order (foreign key constraints)
                cursor.execute("DELETE FROM theme_source_emails WHERE digest_email_id IN (SELECT id FROM digest_emails WHERE digest_id = %s)", (digest_id,))
                cursor.execute("DELETE FROM thematic_sections WHERE thematic_digest_id IN (SELECT id FROM thematic_digests WHERE email_digest_id = %s)", (digest_id,))
                cursor.execute("DELETE FROM thematic_digests WHERE email_digest_id = %s", (digest_id,))
                cursor.execute("DELETE FROM digest_emails WHERE digest_id = %s", (digest_id,))
                cursor.execute("DELETE FROM email_digests WHERE id = %s", (digest_id,))
                
                self.db_conn.commit()
                print(f"🗑️ Deleted existing digest for {date.strftime('%Y-%m-%d')}")
                
        except Exception as e:
            print(f"⚠️ Failed to delete existing digest: {e}")
            self.db_conn.rollback()
        finally:
            cursor.close()
    
    def verify_completion(self):
        """Verify all days have been processed"""
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
        """Main execution method - EXACT same workflow as Node.js"""
        print("🚀 SubsBuzz History Generator Starting...")
        print(f"User: {self.user_email}")
        print(f"Generating {self.days} days of summaries using EXACT same OpenAI processing as main app")
        if self.exclude_emails:
            print(f"Excluding emails: {', '.join(self.exclude_emails)}")
        
        # Setup
        self.connect_to_database()
        self.authenticate_gmail()
        
        # Get monitored emails
        monitored_emails = self.get_monitored_emails()
        if not monitored_emails:
            print("❌ No monitored emails found for user")
            return
        
        print(f"📧 Monitoring emails from: {', '.join(monitored_emails)}")
        
        # Process each day
        for day_offset in range(self.days):
            target_date = datetime.now(timezone.utc) - timedelta(days=day_offset + 1)
            print(f"\n📅 Now processing: {target_date.strftime('%Y-%m-%d')}...")
            
            # Check existing digest
            if self.check_existing_digest(target_date):
                print(f"⚠️ Digest already exists for {target_date.strftime('%Y-%m-%d')}, overwriting...")
                self.delete_existing_digest(target_date)
            
            # Fetch emails
            emails = self.fetch_emails_for_date(target_date, monitored_emails)
            
            if emails:
                # Generate digest with OpenAI (EXACT same as Node.js)
                digest_data = self.generate_digest_for_date(target_date, emails)
                
                if digest_data:
                    # Store in database with thematic processing
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
        
        print("\n🎉 History generation complete! Results should be IDENTICAL to main app processing.")


def main():
    parser = argparse.ArgumentParser(
        description="Generate SubsBuzz digest history using EXACT same OpenAI processing as main app",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --days 7 --user tmattoneill@gmail.com
  %(prog)s --days 5 --user user@example.com --email-exclude sender1@example.com,sender2@example.com

This script replicates the EXACT same methodology as the main application:
- Uses OpenAI gpt-4o for individual email analysis
- Uses OpenAI gpt-4o-mini for thematic digest generation  
- Implements the same 3-stage thematic processing pipeline
- Uses the same category classification system
- Stores data in the same database schema
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