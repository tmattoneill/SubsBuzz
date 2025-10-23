#!/usr/bin/env python3.12
"""
SubsBuzz User History Viewer
View digest summaries for a specific user on specific days from the database.

Usage: python sb-user-history.py --days [NUM_DAYS: 1] --from-date [DATE_TO_LOOK_BACK_FROM: TODAY] --head [LINES_TO_DISPLAY: 10] --user [USERNAME]
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import hashlib

# Database imports
import psycopg2
from psycopg2.extras import RealDictCursor

# Environment and config
from dotenv import load_dotenv

# Load environment from parent directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.dev'))

class SubsBuzzHistoryViewer:
    def __init__(self, user_email: str, days: int = 1, from_date: str = None, head_lines: int = 10):
        self.user_email = user_email
        self.days = days
        self.head_lines = head_lines
        self.db_conn = None
        self.user_id = None
        
        # Parse from_date or use today
        if from_date:
            try:
                self.from_date = datetime.strptime(from_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            except ValueError:
                raise ValueError(f"Invalid date format: {from_date}. Use YYYY-MM-DD format.")
        else:
            self.from_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Database configuration
        self.database_url = os.getenv('DATABASE_URL')
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
            print(f"✅ Connected to database")
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            sys.exit(1)
    
    def check_user_exists(self) -> bool:
        """Check if user exists in the database"""
        try:
            cursor = self.db_conn.cursor()
            
            # Check both monitored_emails and oauth_tokens tables
            cursor.execute("""
                SELECT COUNT(*) as count FROM (
                    SELECT user_id FROM monitored_emails WHERE user_id = %s
                    UNION
                    SELECT %s WHERE EXISTS (SELECT 1 FROM oauth_tokens WHERE email = %s)
                ) AS user_check
            """, (self.user_id, self.user_id, self.user_email))
            
            result = cursor.fetchone()
            return result['count'] > 0
            
        except Exception as e:
            print(f"❌ Error checking user existence: {e}")
            return False
        finally:
            cursor.close()
    
    def get_digest_summaries(self) -> List[Dict]:
        """Get digest summaries for the specified date range"""
        try:
            cursor = self.db_conn.cursor()
            
            # Calculate date range
            end_date = self.from_date
            start_date = end_date - timedelta(days=self.days - 1)
            
            # First try to get thematic digests (preferred)
            cursor.execute("""
                SELECT 
                    td.date,
                    td.sections_count,
                    td.total_source_emails,
                    td.processing_method,
                    ARRAY_AGG(
                        json_build_object(
                            'theme', ts.theme,
                            'summary', ts.summary,
                            'confidence', ts.confidence,
                            'keywords', ts.keywords,
                            'order', ts.order
                        ) ORDER BY ts.order
                    ) as sections
                FROM thematic_digests td
                LEFT JOIN thematic_sections ts ON td.id = ts.thematic_digest_id
                WHERE td.user_id = %s 
                    AND DATE(td.date) >= DATE(%s) 
                    AND DATE(td.date) <= DATE(%s)
                GROUP BY td.id, td.date, td.sections_count, td.total_source_emails, td.processing_method
                ORDER BY td.date DESC
            """, (self.user_id, start_date, end_date))
            
            thematic_results = cursor.fetchall()
            
            if thematic_results:
                return [self.format_thematic_digest(row) for row in thematic_results]
            
            # Fallback to regular email digests if no thematic digests found
            cursor.execute("""
                SELECT 
                    ed.date,
                    ed.emails_processed,
                    ed.topics_identified,
                    ARRAY_AGG(
                        json_build_object(
                            'sender', de.sender,
                            'subject', de.subject,
                            'summary', de.summary,
                            'topics', de.topics,
                            'keywords', de.keywords
                        ) ORDER BY de.received_at DESC
                    ) as emails
                FROM email_digests ed
                LEFT JOIN digest_emails de ON ed.id = de.digest_id
                WHERE ed.user_id = %s 
                    AND DATE(ed.date) >= DATE(%s) 
                    AND DATE(ed.date) <= DATE(%s)
                GROUP BY ed.id, ed.date, ed.emails_processed, ed.topics_identified
                ORDER BY ed.date DESC
            """, (self.user_id, start_date, end_date))
            
            regular_results = cursor.fetchall()
            
            return [self.format_regular_digest(row) for row in regular_results]
            
        except Exception as e:
            print(f"❌ Error retrieving digest summaries: {e}")
            return []
        finally:
            cursor.close()
    
    def format_thematic_digest(self, row: Dict) -> Dict:
        """Format thematic digest data for display"""
        sections_text = ""
        
        if row['sections'] and row['sections'][0]:  # Check if sections exist
            for section in row['sections']:
                if section and 'theme' in section:  # Ensure section is valid
                    sections_text += f"\n## {section['theme']}\n"
                    if section.get('summary'):
                        sections_text += f"{section['summary']}\n"
                    if section.get('keywords'):
                        sections_text += f"Keywords: {', '.join(section['keywords'])}\n"
        
        return {
            'date': row['date'].strftime('%Y-%m-%d'),
            'type': 'thematic',
            'summary': sections_text.strip() or "No thematic summary available",
            'meta': f"Sections: {row['sections_count']}, Source emails: {row['total_source_emails']}"
        }
    
    def format_regular_digest(self, row: Dict) -> Dict:
        """Format regular digest data for display"""
        emails_text = ""
        
        if row['emails'] and row['emails'][0]:  # Check if emails exist
            for email in row['emails']:
                if email and 'sender' in email:  # Ensure email is valid
                    emails_text += f"\n### From: {email['sender']}\n"
                    if email.get('subject'):
                        emails_text += f"Subject: {email['subject']}\n"
                    if email.get('summary'):
                        emails_text += f"{email['summary']}\n"
                    if email.get('topics'):
                        emails_text += f"Topics: {', '.join(email['topics'])}\n"
                    emails_text += "\n"
        
        return {
            'date': row['date'].strftime('%Y-%m-%d'),
            'type': 'regular', 
            'summary': emails_text.strip() or "No email summaries available",
            'meta': f"Emails processed: {row['emails_processed']}, Topics: {row['topics_identified']}"
        }
    
    def truncate_text(self, text: str, max_lines: int) -> str:
        """Truncate text to specified number of lines"""
        if not text:
            return ""
        
        lines = text.split('\n')
        if len(lines) <= max_lines:
            return text
        
        truncated = '\n'.join(lines[:max_lines])
        return f"{truncated}\n..."
    
    def display_summaries(self, summaries: List[Dict]):
        """Display formatted summaries"""
        if not summaries:
            print(f"No summaries found for {self.user_email} in that date span")
            return
        
        print(f"User: {self.user_email}")
        print("=" * 50)
        
        for summary in summaries:
            print(f"Date: {summary['date']}")
            print(f"Type: {summary['type'].title()} Digest")
            print(f"Meta: {summary['meta']}")
            print("Summary:")
            
            # Apply head line limit
            truncated_summary = self.truncate_text(summary['summary'], self.head_lines)
            print(truncated_summary)
            
            print("-" * 50)
        
        print(f"\nDisplayed {len(summaries)} digest(s) for {self.days} day(s)")
        if self.head_lines < 1000:  # Assume unlimited if very high
            print(f"Summary text limited to first {self.head_lines} lines per digest")
    
    def run(self):
        """Main execution method"""
        # Setup
        self.connect_to_database()
        self.user_id = self.create_user_id(self.user_email)
        
        # Check if user exists
        if not self.check_user_exists():
            print(f"No user {self.user_email} found.")
            return
        
        # Get and display summaries
        summaries = self.get_digest_summaries()
        self.display_summaries(summaries)


def main():
    parser = argparse.ArgumentParser(
        description="View SubsBuzz digest summaries for a specific user and date range",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --user tmattoneill@gmail.com
  %(prog)s --user tmattoneill@gmail.com --days 7
  %(prog)s --user tmattoneill@gmail.com --days 3 --from-date 2025-07-01
  %(prog)s --user tmattoneill@gmail.com --days 5 --head 20
        """
    )
    
    parser.add_argument(
        '--user',
        type=str,
        required=True,
        help='User email address to view summaries for'
    )
    
    parser.add_argument(
        '--days',
        type=int,
        default=1,
        help='Number of days to look back (default: 1, max: 10)'
    )
    
    parser.add_argument(
        '--from-date',
        type=str,
        help='Date to look back from in YYYY-MM-DD format (default: today)'
    )
    
    parser.add_argument(
        '--head',
        type=int,
        default=10,
        help='Number of lines to display per summary (default: 10)'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.days < 1 or args.days > 10:
        print("❌ Error: Days must be between 1 and 10")
        sys.exit(1)
    
    if args.head < 1:
        print("❌ Error: Head lines must be at least 1")
        sys.exit(1)
    
    try:
        # Create and run viewer
        viewer = SubsBuzzHistoryViewer(
            user_email=args.user,
            days=args.days,
            from_date=args.from_date,
            head_lines=args.head
        )
        viewer.run()
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()