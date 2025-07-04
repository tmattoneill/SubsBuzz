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

### sb-user-history.py

**Purpose**: View digest summaries for a specific user on specific days from the database.

**Usage**:
```bash
python sb-user-history.py --user [USERNAME] --days [NUM_DAYS] --from-date [DATE] --head [LINES_TO_DISPLAY]
```

**Parameters**:
- `--user`: User email address to view summaries for (required)
- `--days`: Number of days to look back (1-10, default: 1)
- `--from-date`: Date to look back from in YYYY-MM-DD format (default: today)
- `--head`: Number of lines to display per summary (default: 10)

**Examples**:
```bash
# View today's digest for a user
python sb-user-history.py --user tmattoneill@gmail.com

# View last 7 days of digests
python sb-user-history.py --user tmattoneill@gmail.com --days 7

# View 3 days starting from a specific date
python sb-user-history.py --user tmattoneill@gmail.com --days 3 --from-date 2025-07-01

# View with more summary text (20 lines per digest)
python sb-user-history.py --user tmattoneill@gmail.com --days 5 --head 20
```

**Output Example**:
```
User: tmattoneill@gmail.com
==================================================
Date: 2025-07-03
Type: Thematic Digest
Meta: Sections: 4, Source emails: 6
Summary:

## Media + Advertising
The Washington Post highlighted new developments in streaming media, with Netflix announcing major changes to their content strategy...

## Programming and Computer Engineering  
Several updates in the tech world emerged this week, including new AI developments and software engineering practices...

Keywords: media, streaming, technology, AI
--------------------------------------------------
Date: 2025-07-02
Type: Regular Digest
Meta: Emails processed: 4, Topics: 3
Summary:

### From: email@washingtonpost.com
Subject: Morning Newsletter
Political developments continue to shape the landscape as new legislation moves through Congress...

Topics: politics, government, policy
--------------------------------------------------

Displayed 2 digest(s) for 2 days
Summary text limited to first 10 lines per digest
```

**Features**:
- **Smart Digest Detection**: Prioritizes thematic digests when available, falls back to regular email digests
- **Flexible Date Ranges**: View single day or up to 10 days of history
- **Text Truncation**: Control output length with `--head` parameter
- **User Validation**: Checks if user exists in database before querying
- **Multiple Digest Formats**: Handles both thematic and regular digest formats
- **Error Handling**: Clear error messages for missing users or data

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