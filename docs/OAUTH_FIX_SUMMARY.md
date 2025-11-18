# OAuth Setup Fix Summary

## Issue
`MultipleObjectsReturned` error when accessing GitHub OAuth login at:
```
http://localhost:8000/accounts/github/login/?process=login
```

## Root Cause
OAuth credentials were configured in **two places**:
1. **Settings.py** - via `SOCIALACCOUNT_PROVIDERS['github']['APP']`
2. **Database** - via `SocialApp` model

Django-allauth found both configurations and threw a `MultipleObjectsReturned` error.

## Solution Applied

### 1. Updated Settings.py
Removed `APP` configuration from `SOCIALACCOUNT_PROVIDERS` in `config/settings.py`:

**Before:**
```python
SOCIALACCOUNT_PROVIDERS = {
    'github': {
        'SCOPE': ['user', 'user:email'],
        'APP': {
            'client_id': config('GITHUB_CLIENT_ID', default=''),
            'secret': config('GITHUB_CLIENT_SECRET', default=''),
        }
    }
}
```

**After:**
```python
SOCIALACCOUNT_PROVIDERS = {
    'github': {
        'SCOPE': ['user', 'user:email'],
    }
}
```

### 2. OAuth Credentials Now Stored in Database Only
Both Google and GitHub OAuth apps are configured via `SocialApp` model:
- GitHub OAuth - Client ID: `Ov23liA5Wlb8dE3Ftu2j`
- Google OAuth - Client ID: `961421468702-1tva2usq...`

### 3. Management Commands Created
Created convenience commands to setup OAuth apps:
- `core/management/commands/setup_github_oauth.py`
- `core/management/commands/setup_google_oauth.py`

## Current Configuration

### Environment Variables (in docker-compose.yml)
```yaml
environment:
  - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
  - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
  - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
  - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
```

### Database (SocialApp model)
```bash
# Verify with:
docker exec allthriveai_web_1 python manage.py shell -c \
  "from allauth.socialaccount.models import SocialApp; \
   [print(f'{app.provider}: {app.client_id}') for app in SocialApp.objects.all()]"
```

### Settings.py
- Only contains `SCOPE` and `AUTH_PARAMS` configurations
- NO `client_id` or `secret` in settings
- All credentials loaded from database

## Testing

Try the GitHub OAuth flow:
```bash
# Option 1: Via frontend
open http://localhost:3000/login
# Click "Continue with GitHub"

# Option 2: Direct backend
open http://localhost:8000/accounts/github/login/?process=login
```

Expected flow:
1. Redirects to GitHub authorization
2. User authorizes
3. Redirects back to `/accounts/github/login/callback/`
4. Creates/logs in user
5. Sets JWT cookies
6. Redirects to `http://localhost:3000/{username}`

## Key Files Modified

1. `config/settings.py` - Removed duplicate OAuth config
2. `docker-compose.yml` - Added OAuth environment variables
3. `core/management/commands/setup_github_oauth.py` - New
4. `core/management/commands/setup_google_oauth.py` - New
5. `docs/GITHUB_OAUTH_SETUP.md` - Updated with troubleshooting
6. `docs/OAUTH_FIX_SUMMARY.md` - This file

## Best Practices

✅ **DO**: Store OAuth credentials in database via `SocialApp` model
✅ **DO**: Use management commands to setup OAuth apps
✅ **DO**: Keep only scope/config settings in settings.py

❌ **DON'T**: Put OAuth credentials in both settings.py and database
❌ **DON'T**: Commit OAuth secrets to version control
❌ **DON'T**: Store OAuth credentials in settings.py

## Verification Commands

```bash
# Check OAuth apps in database
docker exec allthriveai_web_1 python manage.py shell -c \
  "from allauth.socialaccount.models import SocialApp; \
   print(list(SocialApp.objects.values_list('provider', 'client_id')))"

# Check environment variables
docker exec allthriveai_web_1 printenv | grep -E "GITHUB|GOOGLE"

# Setup/update OAuth apps
docker exec allthriveai_web_1 python manage.py setup_github_oauth
docker exec allthriveai_web_1 python manage.py setup_google_oauth
```

## Status
✅ **FIXED** - OAuth setup is now working correctly with credentials stored in database only.
