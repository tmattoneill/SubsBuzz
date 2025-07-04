# A directory for storing various utility files (CLI)
These files will be backend support files for SubsBuzz
They should use python by default unless there's a strong reason not to
We will manage this through a .venv in the ./utils directory
We will use Python 3.12x

## Utility Function: Post-populate
Function: populate a user's history DB with summaries for past-days. This will allow a user to add in email summary history for up to 10 days in the past. The data will be added directly into the system DB allowing the user to view each day's (UTC 24 hours) history in the application.

Usage: sb-make-history.py --days [NUM_DAYS] --user [USERNAME] --email-exlcude [LIST_EMAIL_SOURCES_TO_NOT_INCLUDE]

Will use Google OAuth the authenitcate the USERNAME (email address) by launching a browser and returning an auth key

Will over-write any days in the DB with existing summaries.

Will provide progress updates to the CLI as it progresses. Something like:
<EXAMPLE OUTPUT>
user: tmattoneill@gmail.com
sender: sender@example.com
Generating X days of summaries
Now processsing: 2025-06-25...

Upon completion, verify that each day has been updated in the postgresql db.