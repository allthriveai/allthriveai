# OAuth Implementation - Fixed (November 2025)

## Overview

The OAuth authentication flow has been properly implemented using django-allauth with custom adapters and middleware to set JWT tokens in HTTP-only cookies.

## Architecture

### Flow Diagram

```
User clicks "Continue with Google/GitHub"
    ↓
Frontend redirects to: /accounts/google/login/?process=login
    ↓
django-allauth redirects to: Google/GitHub OAuth provider
    ↓
User authenticates with OAuth provider
    ↓
Provider redirects back to: /accounts/google/login/callback/
    ↓
django-allauth processes OAuth callback and creates/retrieves user
    ↓
Django fires user_logged_in signal
    ↓
OAuthJWTMiddleware signal handler generates JWT tokens
    ↓
OAuthJWTMiddleware sets tokens as HTTP-only cookies
    ↓
CustomAccountAdapter redirects to: http://localhost:3000/{username}
    ↓
Frontend has JWT cookies and can make authenticated API requests
```

## Key Components

### 1. Custom Allauth Adapters (`core/auth/adapter.py`)

**CustomAccountAdapter**:
- Handles redirect URLs after login
- Redirects to frontend with user's profile page

**CustomSocialAccountAdapter**:
- Handles OAuth-specific behavior
- Populates user data from OAuth provider
- Handles OAuth errors gracefully

### 2. OAuth JWT Middleware (`core/auth/oauth_middleware.py`)

**Signal Handler (`set_jwt_cookies_on_login`)**:
- Listens for `user_logged_in` signal
- Generates JWT tokens when OAuth callback completes
- Stores tokens in request for middleware to set

**Middleware (`OAuthJWTMiddleware`)**:
- Intercepts response after OAuth login
- Sets JWT access and refresh tokens as HTTP-only cookies
- Applies proper security settings (domain, SameSite, secure)

### 3. Settings Configuration (`config/settings.py`)

```python
# Custom adapters
ACCOUNT_ADAPTER = 'core.auth.adapter.CustomAccountAdapter'
SOCIALACCOUNT_ADAPTER = 'core.auth.adapter.CustomSocialAccountAdapter'

# Middleware stack (includes OAuthJWTMiddleware)
MIDDLEWARE = [
    ...
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.auth.oauth_middleware.OAuthJWTMiddleware',  # Sets JWT cookies
    ...
]

# OAuth settings
ACCOUNT_EMAIL_VERIFICATION = 'optional'  # OAuth providers verify email
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_STORE_TOKENS = False
```

## URLs

### OAuth Login URLs (handled by django-allauth)
- **Google**: `http://localhost:8000/accounts/google/login/?process=login`
- **GitHub**: `http://localhost:8000/accounts/github/login/?process=login`

### OAuth Callback URLs (configured in OAuth providers)
- **Google**: `http://localhost:8000/accounts/google/login/callback/`
- **GitHub**: `http://localhost:8000/accounts/github/login/callback/`

### Frontend URLs
- **Login page**: `http://localhost:3000/login`
- **Post-login redirect**: `http://localhost:3000/{username}`

## Security Features

### HTTP-Only Cookies
- JWT tokens stored in HTTP-only cookies (not accessible to JavaScript)
- Prevents XSS attacks from stealing tokens

### Cookie Configuration
```python
# Access token cookie
key: 'access_token'
domain: 'localhost'  # Shared between frontend and backend
httponly: True
secure: False (dev) / True (production)
samesite: 'Lax'  # Allows OAuth redirects
max_age: 15 minutes

# Refresh token cookie
key: 'refresh_token'
domain: 'localhost'
httponly: True
secure: False (dev) / True (production)
samesite: 'Lax'
max_age: 7 days
```

### CSRF Protection
- SameSite=Lax provides CSRF protection
- CSRF token cookie for additional protection on state-changing requests

## Testing

### Manual Testing Steps

1. **Start backend and frontend**:
   ```bash
   docker-compose up
   cd frontend && npm run dev
   ```

2. **Navigate to login page**: `http://localhost:3000/login`

3. **Click "Continue with Google" or "Continue with GitHub"**

4. **Complete OAuth flow with provider**

5. **Verify redirect**: Should redirect to `http://localhost:3000/{username}`

6. **Check cookies**: Open browser DevTools → Application → Cookies
   - Should see `access_token` cookie (HTTP-only)
   - Should see `refresh_token` cookie (HTTP-only)
   - Should see `sessionid` cookie

7. **Test authenticated requests**: Navigate to protected routes
   - Frontend should automatically include cookies
   - Backend should authenticate via JWT

### Debugging

**Check backend logs**:
```bash
docker-compose logs -f web | grep -E "(OAuth|JWT|user_logged_in)"
```

**Check if OAuth is configured**:
```bash
docker-compose exec web python manage.py shell -c "from allauth.socialaccount.models import SocialApp; print(list(SocialApp.objects.values()))"
```

## What Changed

### Removed
- ❌ `GoogleLogin` API view (unused, wrong pattern)
- ❌ `GitHubLogin` API view (unused, wrong pattern)
- ❌ Manual JWT token setting in view responses
- ❌ Confusing `oauth_callback` manual redirect

### Added
- ✅ `CustomAccountAdapter` for login redirects
- ✅ `CustomSocialAccountAdapter` for OAuth behavior
- ✅ `OAuthJWTMiddleware` for automatic JWT cookie setting
- ✅ Signal handler for detecting OAuth login
- ✅ Proper separation of concerns

### Benefits
1. **Cleaner**: Single responsibility for each component
2. **Automatic**: JWT tokens set without manual intervention
3. **Consistent**: Works the same for Google and GitHub
4. **Secure**: Proper cookie settings and CSRF protection
5. **Maintainable**: Standard django-allauth patterns

## Common Issues

### Cookies not being set
- Check cookie domain matches between frontend and backend
- Verify `COOKIE_DOMAIN` setting in `.env`
- Check browser DevTools → Application → Cookies

### OAuth redirect fails
- Verify callback URLs in Google/GitHub OAuth app settings
- Check `FRONTEND_URL` setting in `.env`
- Ensure URLs include/exclude trailing slashes consistently

### "Invalid token" errors
- Token may have expired (15 minute lifetime)
- Check clock sync on your machine
- Verify JWT settings in `config/settings.py`

### Database has no OAuth apps
```bash
docker-compose exec web python manage.py setup_google_oauth
docker-compose exec web python manage.py setup_github_oauth
```

## Production Deployment

### Environment Variables
```bash
# OAuth providers
GOOGLE_CLIENT_ID=your-production-client-id
GOOGLE_CLIENT_SECRET=your-production-client-secret
GITHUB_CLIENT_ID=your-production-client-id
GITHUB_CLIENT_SECRET=your-production-client-secret

# URLs
FRONTEND_URL=https://app.yourdomain.com
BACKEND_URL=https://api.yourdomain.com
COOKIE_DOMAIN=.yourdomain.com  # Note the leading dot

# Security
DEBUG=False
SECURE_SSL_REDIRECT=True
```

### OAuth Provider Configuration
Update redirect URIs in Google Cloud Console and GitHub:
- Google: `https://api.yourdomain.com/accounts/google/login/callback/`
- GitHub: `https://api.yourdomain.com/accounts/github/login/callback/`

## Further Reading

- [django-allauth Documentation](https://django-allauth.readthedocs.io/)
- [djangorestframework-simplejwt Documentation](https://django-rest-framework-simplejwt.readthedocs.io/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
