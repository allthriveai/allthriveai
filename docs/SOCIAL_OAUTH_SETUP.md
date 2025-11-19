# Social OAuth Connections Setup Guide

This guide explains how to set up OAuth integrations for social account linking in AllThrive AI.

## Overview

Users can now connect their external accounts (GitHub, GitLab, LinkedIn, Figma, Hugging Face) to AllThrive AI from their account settings page at `/account/settings/social`.

This feature allows:
- Secure OAuth-based account linking
- Encrypted token storage for API integrations
- Easy connection management (connect/disconnect)
- Future integration with AI agents for enhanced workflows

## Architecture

### Backend Components

1. **Models** (`core/social_models.py`)
   - `SocialConnection` - Stores OAuth tokens and connection metadata
   - `SocialProvider` - Enum of supported providers
   - Token encryption using Django SECRET_KEY

2. **Services** (`services/social_oauth_service.py`)
   - `OAuthProviderConfig` - OAuth endpoint configuration for each provider
   - `SocialOAuthService` - Handles OAuth flows, token exchange, user info fetching

3. **Views** (`core/social_views.py`)
   - List connections
   - Initiate OAuth flow
   - Handle OAuth callbacks
   - Disconnect providers

4. **API Endpoints** (`/api/v1/social/`)
   - `GET /connections/` - List user's connections
   - `GET /providers/` - List available providers
   - `GET /connect/<provider>/` - Start OAuth flow
   - `GET /callback/<provider>/` - OAuth callback handler
   - `POST /disconnect/<provider>/` - Disconnect a provider
   - `GET /status/<provider>/` - Check connection status

### Frontend Components

1. **API Service** (`frontend/src/services/socialApi.ts`)
   - TypeScript interfaces and API functions
   - OAuth popup window management
   - Provider icon/color helpers

2. **UI Component** (`frontend/src/pages/settings/SocialSettingsPage.tsx`)
   - Lists available providers
   - Shows connection status
   - Connect/disconnect buttons
   - OAuth popup flow

## Setup Instructions

### 1. Install Dependencies

The required dependencies are already in `requirements.txt`:
```bash
cryptography>=41.0.0  # For token encryption
requests>=2.31.0       # For OAuth HTTP requests
```

Install with:
```bash
pip install -r requirements.txt
```

### 2. Run Database Migrations

Create and apply migrations for the SocialConnection model:

```bash
# Using Docker
make shell-backend
python manage.py makemigrations
python manage.py migrate

# Or directly if not using Docker
python manage.py makemigrations
python manage.py migrate
```

### 3. Configure OAuth Credentials

Add OAuth credentials to your `.env` file. See `.env.example` for all available options.

#### GitHub OAuth
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set:
   - Application name: AllThrive AI (or your app name)
   - Homepage URL: `http://localhost:8000` (dev) or your production URL
   - Authorization callback URL: `http://localhost:8000/api/v1/social/callback/github/`
4. Copy Client ID and Client Secret to `.env`:

```bash
GITHUB_OAUTH_CLIENT_ID=your_github_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret
```

#### GitLab OAuth
1. Go to https://gitlab.com/oauth/applications
2. Create a new application with:
   - Redirect URI: `http://localhost:8000/api/v1/social/callback/gitlab/`
   - Scopes: `read_user`, `api`
3. Add to `.env`:

```bash
GITLAB_OAUTH_CLIENT_ID=your_gitlab_client_id
GITLAB_OAUTH_CLIENT_SECRET=your_gitlab_client_secret
```

#### LinkedIn OAuth
1. Go to https://www.linkedin.com/developers/apps
2. Create an app
3. Add redirect URL: `http://localhost:8000/api/v1/social/callback/linkedin/`
4. Request access to `r_liteprofile` and `r_emailaddress` scopes
5. Add to `.env`:

```bash
LINKEDIN_OAUTH_CLIENT_ID=your_linkedin_client_id
LINKEDIN_OAUTH_CLIENT_SECRET=your_linkedin_client_secret
```

#### Figma OAuth
1. Go to https://www.figma.com/developers/apps
2. Create a new app
3. Set callback URL: `http://localhost:8000/api/v1/social/callback/figma/`
4. Add to `.env`:

```bash
FIGMA_OAUTH_CLIENT_ID=your_figma_client_id
FIGMA_OAUTH_CLIENT_SECRET=your_figma_client_secret
```

#### Hugging Face OAuth
1. Go to https://huggingface.co/settings/connected-applications
2. Create a new OAuth app
3. Set redirect URI: `http://localhost:8000/api/v1/social/callback/huggingface/`
4. Add to `.env`:

```bash
HUGGINGFACE_OAUTH_CLIENT_ID=your_huggingface_client_id
HUGGINGFACE_OAUTH_CLIENT_SECRET=your_huggingface_client_secret
```

#### Midjourney
Midjourney does not currently have a public OAuth API. The UI will show "Coming Soon" for this provider.

### 4. Production Setup

For production deployment:

1. **Use HTTPS** - OAuth requires secure URLs in production
2. **Update Callback URLs** - Change all callback URLs to your production domain:
   ```
   https://api.yourdomain.com/api/v1/social/callback/<provider>/
   ```
3. **Secure Cookies** - Ensure these settings in production:
   ```python
   SESSION_COOKIE_SECURE = True
   CSRF_COOKIE_SECURE = True
   SECURE_SSL_REDIRECT = True
   ```
4. **Environment Variables** - Never commit OAuth credentials to version control

## Security Features

### Token Encryption
- All OAuth access and refresh tokens are encrypted using Fernet (symmetric encryption)
- Encryption key is derived from Django's SECRET_KEY
- Tokens are stored as binary fields and only decrypted when needed

### CSRF Protection
- OAuth state tokens are generated and validated
- State tokens are stored in Redis cache with 10-minute expiry
- Each OAuth flow is tied to the initiating user

### Secure Storage
- `is_active` flag for soft deletes
- Unique constraint on (user, provider)
- Database indexes for performance
- JSON field for provider-specific metadata

## Usage

### For Users
1. Go to Account Settings → Social Profiles
2. Click "Connect" on any available provider
3. Complete OAuth flow in popup window
4. Connection appears as "Connected" with provider username
5. Click "Disconnect" to remove connection

### For Developers

**Accessing Connected Accounts:**
```python
from core.social_models import SocialConnection, SocialProvider

# Get user's GitHub connection
github_conn = SocialConnection.objects.filter(
    user=user,
    provider=SocialProvider.GITHUB,
    is_active=True
).first()

if github_conn:
    access_token = github_conn.access_token  # Auto-decrypted
    username = github_conn.provider_username
    # Use token for API calls
```

**Checking Token Expiry:**
```python
if github_conn.is_token_expired():
    # Handle token refresh or re-authentication
    pass
```

**Getting Scopes:**
```python
scopes = github_conn.get_scopes_list()
# ['read:user', 'user:email']
```

## Troubleshooting

### "Invalid provider" error
- Check that OAuth credentials are set in `.env`
- Verify provider key matches `SocialProvider` enum values

### OAuth callback fails
- Verify callback URL matches exactly in OAuth app settings
- Check that frontend URL is set correctly in `FRONTEND_URL`
- Ensure Redis is running (for state token validation)

### Tokens not working
- Check if token is expired: `connection.is_token_expired()`
- Verify scopes requested match those granted by user
- Some providers require token refresh (implement refresh flow)

### Connection not appearing
- Check browser console for frontend errors
- Verify migrations have been applied
- Check that user is authenticated

## Future Enhancements

Potential features to add:
- Token refresh automation
- Webhook support for provider events
- AI agent integration for automated workflows
- Additional providers (Slack, Discord, etc.)
- Connection health monitoring
- Usage analytics per connection

## API Reference

See the full API documentation in the backend:
- `core/social_views.py` - View implementations
- `services/social_oauth_service.py` - OAuth service logic
- `core/social_models.py` - Data models

Frontend TypeScript types:
- `frontend/src/services/socialApi.ts` - API interfaces and functions
