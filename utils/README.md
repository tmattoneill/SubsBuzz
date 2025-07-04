# SubsBuzz Utilities

This directory contains utility scripts for SubsBuzz administration and maintenance.

## Setup

1. **Python Environment**: Uses Python 3.12 with virtual environment
   ```bash
   python3.12 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Environment Configuration**: Uses `.env.dev` from parent directory
   - Requires DATABASE_URL for PostgreSQL connection
   - Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Gmail OAuth

## Scripts

### sb-make-history.py

**Purpose**: Generate digest history for past days to populate a user's historical data.

**Usage**:
```bash
python sb-make-history.py --days [NUM_DAYS] --user [USERNAME] --email-exclude [LIST_EMAIL_SOURCES_TO_NOT_INCLUDE]
```

**Parameters**:
- `--days`: Number of days to generate history for (1-10)
- `--user`: User email address for Gmail authentication
- `--email-exclude`: Comma-separated list of email sources to exclude (optional)

**Examples**:
```bash
# Generate 7 days of history for a user
python sb-make-history.py --days 7 --user tmattoneill@gmail.com

# Generate 5 days excluding specific senders
python sb-make-history.py --days 5 --user user@example.com --email-exclude sender1@example.com,sender2@example.com
```

**Authentication Process**:
1. Script will open a browser for Google OAuth
2. User authenticates with their Gmail account
3. Authorization code is entered back into the script
4. OAuth tokens are stored in the database

**Functionality**:
- Fetches emails from user's monitored email sources
- Generates digest summaries for each day
- Stores results directly in PostgreSQL database
- Overwrites existing digests for specified dates
- Provides progress updates during processing
- Verifies completion by checking database records

**Output Example**:
```
🚀 SubsBuzz History Generator Starting...
User: tmattoneill@gmail.com
Generating 7 days of summaries
🔐 Authenticating Gmail access for: tmattoneill@gmail.com
✅ Gmail authentication successful
📧 Found 5 monitored emails (5 after exclusions)
📧 Monitoring emails from: sender1@example.com, sender2@example.com

📅 Now processing: 2025-06-25...
🔍 Searching emails with query: (from:"sender1@example.com" OR from:"sender2@example.com") after:2025/06/25 before:2025/06/26
📬 Found 3 emails for 2025-06-25
🤖 Generating digest for 2025-06-25 with 3 emails
💾 Stored digest with ID 42 in database
✅ Successfully processed 2025-06-25

✅ Verification - Generated Digests:
==================================================
Date: 2025-06-25 | Emails: 3 | Topics: 2
Date: 2025-06-24 | Emails: 5 | Topics: 3
...

🎉 History generation complete!
```

## Requirements

- Python 3.12+
- PostgreSQL database (configured via DATABASE_URL)
- Google OAuth credentials for Gmail API access
- Active internet connection for OAuth and Gmail API calls

## Security Notes

- OAuth tokens are securely stored in the database
- Script requires user interaction for initial authentication
- No sensitive data is logged or stored in plain text
- Database connections use environment-configured credentials