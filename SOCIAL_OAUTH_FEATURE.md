# Social OAuth Connections Feature

## Overview

This feature enables users to securely connect their external social and development accounts (GitHub, GitLab, LinkedIn, Figma, Hugging Face) to AllThrive AI.

**⭐ GitHub Integration:** When users connect GitHub, they can automatically sync their repositories as AllThrive projects with one click!

## What's New

### User-Facing Features
- **Social Settings Page** at `/account/settings/social`
- Connect/disconnect OAuth accounts with one click
- View connected account status and usernames
- Secure popup-based OAuth flow
- Real-time connection status updates
- **GitHub Repo Sync** - Automatically import GitHub repos as projects
- Sync status showing number of repositories imported

### Technical Implementation
- ✅ Encrypted OAuth token storage (Fernet encryption)
- ✅ Secure OAuth 2.0 flows with CSRF protection
- ✅ Support for 6 providers (5 active + Midjourney placeholder)
- ✅ RESTful API endpoints for connection management
- ✅ TypeScript frontend with type-safe API service
- ✅ Database model with soft deletes and indexing
- ✅ Comprehensive error handling and validation

## Files Created/Modified

### Backend (Django)
- `core/social_models.py` - SocialConnection model with encryption
- `core/social_views.py` - API views for OAuth flows
- `core/github_sync_views.py` - API views for GitHub sync
- `services/social_oauth_service.py` - OAuth service layer
- `services/github_sync_service.py` - GitHub repository sync service
- `core/auth_serializers.py` - Added social_connections field
- `core/urls.py` - Added /api/v1/social/ and /api/v1/github/ routes
- `config/settings.py` - Added OAuth provider credentials

### Frontend (React/TypeScript)
- `frontend/src/services/socialApi.ts` - API service and types
- `frontend/src/pages/settings/SocialSettingsPage.tsx` - UI component

### Configuration & Documentation
- `.env.example` - OAuth credential placeholders
- `requirements.txt` - Added `requests>=2.31.0`
- `docs/SOCIAL_OAUTH_SETUP.md` - Complete OAuth setup guide
- `docs/GITHUB_SYNC.md` - GitHub sync feature documentation
- `SETUP_SOCIAL_OAUTH.sh` - Quick setup script

### Bug Fixes
- Fixed `GripVerticalIcon` import error in ContentBlocks.tsx (changed to `Bars3Icon`)

## Quick Setup

### 1. Run Migrations
```bash
# If using Docker
make shell-backend
python manage.py makemigrations
python manage.py migrate
exit

# Or use the setup script
./SETUP_SOCIAL_OAUTH.sh
```

### 2. Configure OAuth Apps

For each provider you want to enable, create an OAuth application and add credentials to `.env`:

**Example for GitHub:**
1. Go to https://github.com/settings/developers
2. Create new OAuth App with callback: `http://localhost:8000/api/v1/social/callback/github/`
3. Add to `.env`:
   ```bash
   GITHUB_OAUTH_CLIENT_ID=your_client_id
   GITHUB_OAUTH_CLIENT_SECRET=your_client_secret
   ```

See `docs/SOCIAL_OAUTH_SETUP.md` for detailed instructions for all providers.

### 3. Test the Feature

1. Start your development environment
2. Log in to AllThrive AI
3. Navigate to Account Settings → Social Profiles
4. Click "Connect" on any configured provider
5. Complete OAuth flow in popup window

## API Endpoints

```
GET    /api/v1/social/providers/             - List available providers
GET    /api/v1/social/connections/           - List user's connections
GET    /api/v1/social/connect/<provider>/    - Initiate OAuth flow
GET    /api/v1/social/callback/<provider>/   - OAuth callback handler
POST   /api/v1/social/disconnect/<provider>/ - Disconnect provider
GET    /api/v1/social/status/<provider>/     - Connection status

GET    /api/v1/github/sync/status/           - Get GitHub sync status
POST   /api/v1/github/sync/trigger/          - Trigger repository sync
GET    /api/v1/github/repos/                 - List GitHub repositories
POST   /api/v1/github/sync/repo/             - Sync single repository
```

All endpoints require authentication except callback (which validates state token).

## Supported Providers

| Provider | Status | OAuth Documentation |
|----------|--------|-------------------|
| GitHub | ✅ Active | https://docs.github.com/en/apps/oauth-apps |
| GitLab | ✅ Active | https://docs.gitlab.com/ee/api/oauth2.html |
| LinkedIn | ✅ Active | https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication |
| Figma | ✅ Active | https://www.figma.com/developers/api#oauth2 |
| Hugging Face | ✅ Active | https://huggingface.co/docs/hub/oauth |
| Midjourney | 🚧 Coming Soon | No public API yet |

## Security Features

- **Token Encryption**: All access/refresh tokens encrypted using Fernet
- **CSRF Protection**: State tokens validated on OAuth callbacks
- **Secure Storage**: Tokens stored as binary fields, decrypted on access
- **Soft Deletes**: Connections marked inactive instead of deleted
- **HTTPS Required**: Production deployments must use HTTPS

## Developer Usage

Access connected accounts in your code:

```python
from core.social_models import SocialConnection, SocialProvider

# Get GitHub connection
github = SocialConnection.objects.filter(
    user=request.user,
    provider=SocialProvider.GITHUB,
    is_active=True
).first()

if github:
    # Tokens are automatically decrypted
    token = github.access_token
    username = github.provider_username
    
    # Use token for API calls
    import requests
    response = requests.get(
        'https://api.github.com/user/repos',
        headers={'Authorization': f'Bearer {token}'}
    )
```

## Future Enhancements

Potential features for future development:
- Automatic token refresh
- AI agent integration (use connected accounts for workflows)
- Webhook support for provider events
- Additional providers (Slack, Discord, Twitter/X)
- Connection health monitoring dashboard
- Usage analytics per connection

## Troubleshooting

**Issue**: OAuth popup blocked
- **Solution**: Allow popups for localhost in browser settings

**Issue**: "Invalid provider" error
- **Solution**: Ensure OAuth credentials are set in `.env`

**Issue**: Callback fails with "invalid_state"
- **Solution**: Check that Redis is running (state tokens cached there)

**Issue**: Connection not appearing after OAuth
- **Solution**: Check browser console and Django logs for errors

See `docs/SOCIAL_OAUTH_SETUP.md` for more troubleshooting tips.

## Testing

Manual testing checklist:
- [ ] Provider list loads correctly
- [ ] Connect button opens OAuth popup
- [ ] OAuth flow completes successfully
- [ ] Connection shows as "Connected" after flow
- [ ] Provider username displayed correctly
- [ ] Disconnect button removes connection
- [ ] Page state refreshes after connect/disconnect
- [ ] Error handling works (try without credentials)

## Documentation

- **OAuth Setup Guide**: `docs/SOCIAL_OAUTH_SETUP.md`
- **GitHub Sync Guide**: `docs/GITHUB_SYNC.md`
- **Environment Example**: `.env.example`
- **API Endpoints**: `core/social_views.py`, `core/github_sync_views.py`
- **Service Logic**: `services/social_oauth_service.py`, `services/github_sync_service.py`
- **Data Models**: `core/social_models.py`
- **Frontend API**: `frontend/src/services/socialApi.ts`

## Questions?

For implementation details, see the comprehensive setup guide:
```bash
cat docs/SOCIAL_OAUTH_SETUP.md
```
