# OAuth 2.0 Gmail Integration Guide

**Purpose**: System prompt for a Code Assistant (LLM) to implement OAuth 2.0–based Gmail access in a TypeScript + React frontend and Python backend worker. This guide is your reference for building, testing, and securing end-to-end Gmail monitoring without requiring repeated user interactions.

---

## 1. Project Context

* **Frontend**: TypeScript + React
* **Backend**: Python (FastAPI or similar)
* **Worker**: Scheduled (daily or continuous) job polling Gmail API
* **Goal**: Allow users to link their Gmail via Google OAuth and enable a server-side worker to fetch emails from specific senders autonomously.

---

## 2. High-Level Flow Diagram

1. **User action**: Click “Connect Gmail” in the React UI.
2. **OAuth consent**: Google shows consent screen (offline access).
3. **Code exchange**: Frontend receives an authorization code, sends it to backend.
4. **Token exchange**: Backend exchanges code for access & refresh tokens.
5. **Persist tokens**: Backend securely stores the refresh token in PostgreSQL.
6. **Worker execution**: Scheduled job loads stored refresh tokens, obtains fresh access tokens, calls Gmail API, processes emails, and writes results to PostgreSQL.

---

## 3. Frontend Implementation (TS + React)

### 3.1 Dependencies

* `@react-oauth/google` or equivalent OAuth2 library
* `axios` or built-in `fetch` for HTTP requests

### 3.2 Configuration

* `.env` (in project root):

  ```env
  REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
  REACT_APP_API_URL=https://api.yoursite.com
  ```
* Ensure `.env` is loaded at build time.

### 3.3 OAuth Flow Setup

1. **Render Connect Button**:

   ```tsx
   import { useGoogleLogin } from '@react-oauth/google';

   const GmailConnect = () => {
     const login = useGoogleLogin({
       onSuccess: handleSuccess,
       onError: handleError,
       scope: 'https://www.googleapis.com/auth/gmail.readonly',
       access_type: 'offline',
       prompt: 'consent',
     });

     return <button onClick={() => login()}>Connect Gmail</button>;
   };
   ```
2. **Handle Success**:

   ```ts
   const handleSuccess = (tokenResponse) => {
     axios.post(
       `${process.env.REACT_APP_API_URL}/auth/google`,
       { code: tokenResponse.code }
     );
   };
   ```
3. **Error Handling**: Display friendly UI message for failures.

---

## 4. Backend Implementation (Python)

### 4.1 Dependencies & Configuration

* Install via `pip`:

  ```bash
  pip install fastapi uvicorn google-auth google-auth-oauthlib google-api-python-client python-dotenv sqlalchemy psycopg2-binary alembic
  ```
* `.env`:

  ```env
  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your-client-secret
  DATABASE_URL=postgresql://user:pass@host:port/dbname
  ```
* Load env vars with `python-dotenv` at startup.

### 4.2 Auth Endpoint: `/auth/google`

1. **Receive** JSON `{ code: string }` from frontend.
2. **Exchange** authorization code for tokens:

   ```python
   from google_auth_oauthlib.flow import Flow

   flow = Flow.from_client_config(
     client_config={
       'web': {
         'client_id': CLIENT_ID,
         'client_secret': CLIENT_SECRET,
         'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
         'token_uri': 'https://oauth2.googleapis.com/token',
       }
     },
     scopes=['https://www.googleapis.com/auth/gmail.readonly'],
     redirect_uri='postmessage'
   )
   flow.fetch_token(code=code)
   creds = flow.credentials
   ```
3. **Persist** `refresh_token` and metadata in PostgreSQL (see Section 5).
4. **Respond** to frontend with session info (JWT or cookie).

### 4.3 Token Refresh Utility

```python
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

def refresh_credentials(user_id: int) -> Credentials:
    rt, metadata = load_refresh_token(user_id)
    creds = Credentials(
        token=None,
        refresh_token=rt,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET
    )
    creds.refresh(Request())
    update_token_metadata(user_id, creds.expiry)
    return creds
```

### 4.4 Worker Service

1. **Scheduler**: Use `APScheduler`, `Celery Beat`, or system `cron`.
2. **Fetch & Process**:

   ```python
   for user in get_active_users():
       creds = refresh_credentials(user.id)
       service = build('gmail', 'v1', credentials=creds)
       msgs = (
           service.users()
                  .messages()
                  .list(userId='me', q='from:specific@sender.com')
                  .execute()
       )
       process_and_store(user.id, msgs)
   ```
3. **Error Handling**:

   * On `RefreshError` or API errors: log, mark token invalid, notify user.
   * Retry with exponential backoff for transient failures.

---

## 5. Database Schema & Storage Plan

All persistent data resides in PostgreSQL. Use `SQLAlchemy` + `Alembic` for schema & migrations.

### 5.1 Tables & Fields

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  token_scope TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_refreshed TIMESTAMPTZ
);

CREATE TABLE email_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  sender_email VARCHAR(255),
  subject TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);
```

### 5.2 Access Patterns

* **Users**: queried when starting a job.
* **Tokens**: loaded & updated on each refresh.
* **Email messages**: inserted if new; queried for history/debug.

### 5.3 Indexing & Performance

* Index `oauth_tokens.user_id` and `email_messages.user_id` for fast lookups.
* Index `email_messages.received_at` if time-based queries are common.

### 5.4 Migrations

* Use `alembic init` then generate revisions for each table change.
* Automate migrations in CI/CD.

---

## 6. Security & Best Practices

* **Encryption**: Encrypt `refresh_token` column using application-level AES-256 or a KMS.
* **Least Privilege**: Request only `gmail.readonly` scope unless writes are needed.
* **Secret Management**: Keep client secrets out of code; use Vault or environment variables.
* **Consent Screen**: Configure OAuth consent in Google Cloud Console; verify scopes.
* **Revocation Handling**: Detect revoked tokens (401); alert users via email/UI.

---

## 7. Testing Strategy

* **Unit Tests**: Mock OAuth flows (`flow.fetch_token`, `creds.refresh`), DB operations.
* **Integration Tests**: Use Google OAuth sandbox projects; test code exchange end-to-end.
* **E2E Tests**: Simulate user login, token storage, worker run, and DB inserts.

---

## 8. Documentation & Checkpoints

* **README.md**: Append OAuth and database setup steps.
* **SECURITY.md**: Document encryption and token-handling policies.
* **CHECKPOINT.md**: Define test cases for auth endpoints, worker execution, and DB state.

---

## 9. LLM Assistant Instructions

* **Follow** this guide step by step.
* **Generate** frontend (React) and backend (FastAPI) modules.
* **Implement** secure token storage and refresh logic.
* **Build** DB schema, migrations, and data-access layers.
* **Add** tests covering each component.
* **Update** docs (`README.md`, `SECURITY.md`, `CHECKPOINT.md`).
