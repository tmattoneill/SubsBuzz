# SubsBuzz

AI-powered email digest application that monitors Gmail accounts and generates intelligent summaries of newsletters, updates, and important communications.

## Overview

SubsBuzz automatically processes emails from monitored senders, uses OpenAI to generate summaries and extract topics, and presents them in a clean, organized dashboard. Perfect for managing newsletter subscriptions, vendor updates, and other regular email communications.

## Features

- **Email Monitoring**: Configure specific email addresses to monitor
- **AI-Powered Analysis**: OpenAI integration for intelligent email summarization
- **Topic Extraction**: Automatic categorization and keyword identification
- **Daily Digests**: Automated daily digest generation at 7:00 AM
- **Gmail Integration**: OAuth authentication with Gmail API access
- **Modern UI**: React-based dashboard with light/dark theme support
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Technology Stack

### Frontend
- React 18 with TypeScript
- Wouter for routing
- TanStack Query for data fetching
- Tailwind CSS for styling
- Shadcn/ui component library
- Vite for build tooling

### Backend
- Node.js with Express and TypeScript
- Firebase Admin for authentication
- Google APIs for Gmail integration
- OpenAI API for email analysis
- Drizzle ORM for database operations
- Node-cron for scheduled tasks

### Database
- PostgreSQL (production)
- Memory storage (development)

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Google Cloud Console project with Gmail API enabled
- Firebase project (for authentication)
- PostgreSQL database (for production)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/tmattoneill/SubsBuzz.git
cd SubsBuzz
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
cp .env.example .env.dev
```

Edit `.env.dev` with your credentials:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your_key_here

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret_here

# Firebase Configuration (optional for development)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com

# Client Firebase Configuration
VITE_FIREBASE_API_KEY=your_web_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=1:123456789:web:your_app_id
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://127.0.0.1:5500`

## Configuration

### Email Monitoring

The application comes pre-configured to monitor these email sources:
- `daily@pivot5.ai` - Tech industry updates
- `eletters@om.adexchanger.com` - Digital advertising news
- `email@washingtonpost.com` - News updates

You can modify monitored email addresses through the settings page in the application.

### Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API and Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://127.0.0.1:5500/auth/callback`
6. Copy Client ID and Client Secret to your `.env.dev` file

### Firebase Setup (Optional)

For production authentication:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication with Google provider
3. Generate service account key from Project Settings > Service Accounts
4. Add Firebase credentials to your environment file

## Development

### Available Scripts

```bash
npm run dev              # Development server with hot reload
npm run dev:load-env     # Development with explicit env file loading
npm run build            # Production build
npm run start            # Start production server
npm run start:prod       # Start with production environment
npm run check            # TypeScript type checking
npm run db:push          # Push database schema changes
```

### Project Structure

```
SubsBuzz/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── lib/            # Utilities and configurations
│   │   └── hooks/          # Custom React hooks
├── server/                 # Backend Express application
│   ├── auth.ts            # Authentication logic
│   ├── routes.ts          # API route handlers
│   ├── gmail.ts           # Gmail API integration
│   ├── openai.ts          # OpenAI API integration
│   ├── storage.ts         # Database operations
│   └── cron.ts            # Scheduled tasks
├── shared/                 # Shared types and schemas
└── migrations/             # Database migrations
```

### Database Schema

The application uses the following main tables:
- `users` - User accounts
- `monitored_emails` - Email addresses to monitor
- `email_digests` - Generated digest summaries
- `digest_emails` - Individual processed emails
- `user_settings` - User preferences
- `oauth_tokens` - Stored authentication tokens

## API Endpoints

### Authentication
- `POST /api/auth/verify-token` - Verify Firebase ID token
- `POST /api/auth/gmail-access` - Request Gmail OAuth URL
- `POST /api/auth/store-tokens` - Store OAuth tokens

### Digest Management
- `GET /api/digest/latest` - Get most recent digest
- `POST /api/digest/generate` - Manually generate new digest

### Settings
- `GET /api/monitored-emails` - List monitored email addresses
- `POST /api/monitored-emails` - Add new monitored email
- `DELETE /api/monitored-emails/:id` - Remove monitored email
- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update user settings

## Production Deployment

### Environment Setup

1. Create production environment file:
```bash
cp .env.example .env.prod
```

2. Configure production credentials in `.env.prod`

3. Set up PostgreSQL database and update `DATABASE_URL`

### Build and Deploy

```bash
npm run build
npm run start
```

### Environment Variables

See `SECURITY.md` for complete list of required environment variables and security best practices.

## Development Mode Features

- **Mock Data**: Realistic sample emails for testing
- **Memory Storage**: No database required for development
- **Firebase Bypass**: Authentication can be bypassed in development
- **Hot Reload**: Automatic server and client reloading

## Troubleshooting

### Common Issues

**Authentication Errors**
- Verify all environment variables are set correctly
- Check Firebase project configuration
- Ensure OAuth redirect URIs match Google Console settings

**Email Fetching Issues**
- Confirm Gmail API is enabled in Google Cloud Console
- Verify OAuth scopes include Gmail read access
- Check that monitored email addresses are valid

**Build Failures**
- Run `npm run check` to identify TypeScript errors
- Ensure all dependencies are installed with `npm install`
- Verify environment variables are properly formatted

### Logs

Application logs include:
- Firebase initialization status
- Gmail API connection attempts
- OpenAI API responses
- Digest generation progress
- Authentication events

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

This application handles sensitive email data and API credentials. Please review `SECURITY.md` for security best practices and credential management guidelines.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions, issues, or feature requests, please open an issue on GitHub or refer to the documentation in the `CLAUDE.md` file for development guidance.