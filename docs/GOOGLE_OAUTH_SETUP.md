# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth to allow users to sign up and log in with their Gmail accounts.

## Prerequisites

✅ Your Django project already has:
- `django-allauth` installed
- Google provider configured in `INSTALLED_APPS`
- OAuth settings in `settings.py`

## Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project**
   - Click on the project dropdown at the top
   - Click "New Project" or select an existing one
   - Give it a name like "AllThrive AI"

3. **Enable Google+ API** (required for OAuth)
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace)
   - Fill in required fields:
     - **App name**: AllThrive AI
     - **User support email**: your-email@gmail.com
     - **Developer contact**: your-email@gmail.com
   - Click "Save and Continue"
   - **Scopes**: Click "Add or Remove Scopes"
     - Add: `.../auth/userinfo.email`
     - Add: `.../auth/userinfo.profile`
   - Click "Save and Continue"
   - **Test users** (optional for development): Add your test Gmail accounts
   - Click "Save and Continue"

5. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "+ Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application"
   - **Name**: AllThrive AI Web Client
   - **Authorized JavaScript origins**:
     ```
     http://localhost:8000
     http://127.0.0.1:8000
     http://localhost:3000
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:8000/accounts/google/login/callback/
     http://127.0.0.1:8000/accounts/google/login/callback/
     ```
   - Click "Create"
   - **IMPORTANT**: Copy your **Client ID** and **Client Secret**

## Step 2: Update Your `.env` File

Add the credentials to your `.env` file:

```bash
# OAuth Provider Configuration
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
```

Replace `YOUR_CLIENT_ID_HERE` and `YOUR_CLIENT_SECRET_HERE` with the actual values from Step 1.

## Step 3: Run Database Migrations

The `django-allauth` app requires database tables:

```bash
python manage.py migrate
```

## Step 4: Create Django Site (Important!)

Django Allauth requires the Sites framework to be configured:

```bash
python manage.py shell
```

Then run:

```python
from django.contrib.sites.models import Site

# Update or create site with ID=1
site = Site.objects.get(id=1)
site.domain = 'localhost:8000'
site.name = 'AllThrive AI Local'
site.save()

exit()
```

## Step 5: Configure URLs

Check that your `config/urls.py` includes allauth URLs:

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),  # Add this line
    path('api/', include('core.urls')),
    # ... other patterns
]
```

## Step 6: Test the OAuth Flow

### Option A: Test via Django Admin (Recommended for setup)

1. Start your server:
   ```bash
   python manage.py runserver
   ```

2. Visit: http://localhost:8000/accounts/google/login/

3. You should be redirected to Google's login page

4. After login, you'll be redirected back to your app

### Option B: Test via Frontend

Create a simple login button in your frontend:

```html
<!-- In your frontend (React example) -->
<a href="http://localhost:8000/accounts/google/login/"
   className="google-login-btn">
  Sign in with Google
</a>
```

## Step 7: Handle OAuth Callback in Your Frontend

After successful OAuth login, users are redirected to `/accounts/profile/` by default. You'll want to customize this.

### Update Django Settings

Add to `config/settings.py`:

```python
# Redirect after social login
LOGIN_REDIRECT_URL = '/api/auth/google/callback/'  # Your custom callback
ACCOUNT_LOGOUT_REDIRECT_URL = '/'
```

### Create Custom Callback View

Create `core/views/auth.py`:

```python
from django.shortcuts import redirect
from django.contrib.auth import login
from allauth.socialaccount.models import SocialAccount
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import HttpResponse

def google_callback(request):
    """
    Handle Google OAuth callback and redirect to frontend with JWT tokens
    """
    if request.user.is_authenticated:
        # Generate JWT tokens
        refresh = RefreshToken.for_user(request.user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        # Get user info from social account
        try:
            social_account = SocialAccount.objects.get(user=request.user, provider='google')
            extra_data = social_account.extra_data
            email = extra_data.get('email', '')
            name = extra_data.get('name', '')
        except SocialAccount.DoesNotExist:
            email = request.user.email
            name = request.user.get_full_name()

        # Redirect to frontend with tokens
        frontend_url = f"http://localhost:3000/auth/callback?access_token={access_token}&refresh_token={refresh_token}&email={email}&name={name}"
        return redirect(frontend_url)
    else:
        # OAuth failed, redirect to login page
        return redirect('http://localhost:3000/login?error=oauth_failed')
```

Add URL pattern in `core/urls.py`:

```python
from django.urls import path
from core.views.auth import google_callback

urlpatterns = [
    path('auth/google/callback/', google_callback, name='google_callback'),
    # ... other patterns
]
```

## Step 8: Frontend Integration

### React Example

```javascript
// Login button component
export function GoogleLoginButton() {
  const handleGoogleLogin = () => {
    // Redirect to Django OAuth endpoint
    window.location.href = 'http://localhost:8000/accounts/google/login/';
  };

  return (
    <button onClick={handleGoogleLogin} className="google-btn">
      <img src="/google-icon.svg" alt="Google" />
      Sign in with Google
    </button>
  );
}

// Callback handler page (e.g., /auth/callback)
export function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const email = params.get('email');
    const name = params.get('name');

    if (accessToken && refreshToken) {
      // Store tokens
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_email', email);
      localStorage.setItem('user_name', name);

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      // Handle error
      window.location.href = '/login?error=true';
    }
  }, []);

  return <div>Loading...</div>;
}
```

## Step 9: Production Setup

When deploying to production:

1. **Update Google OAuth Credentials**
   - Go back to Google Cloud Console → Credentials
   - Add production URLs to "Authorized redirect URIs":
     ```
     https://yourdomain.com/accounts/google/login/callback/
     ```

2. **Update Django Site**
   ```bash
   python manage.py shell
   ```
   ```python
   from django.contrib.sites.models import Site
   site = Site.objects.get(id=1)
   site.domain = 'yourdomain.com'
   site.name = 'AllThrive AI Production'
   site.save()
   ```

3. **Update Environment Variables**
   - Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in production
   - Update `CORS_ALLOWED_ORIGINS` to include your production frontend URL

## Troubleshooting

### Error: "redirect_uri_mismatch"
- **Cause**: The redirect URI doesn't match what's configured in Google Console
- **Fix**: Make sure the callback URL in Google Console exactly matches your Django URL (including trailing slash)

### Error: "The app is not verified"
- **Cause**: Your OAuth consent screen is in testing mode
- **Fix**: Either add test users in Google Console, or publish your OAuth app

### Error: "Site matching query does not exist"
- **Cause**: Django Sites framework not configured
- **Fix**: Run Step 4 again to create/update the Site object

### Users can't sign up
- **Check**: `SOCIALACCOUNT_AUTO_SIGNUP = True` in settings.py
- **Check**: `ACCOUNT_EMAIL_VERIFICATION = 'optional'` (not 'mandatory')

### JWT tokens not working
- **Check**: Make sure `rest_framework_simplejwt` is in `INSTALLED_APPS`
- **Check**: JWT authentication is in `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`

## API Endpoints Reference

Once configured, you'll have these OAuth endpoints:

- **Google Login**: `GET /accounts/google/login/`
- **Google Callback**: `GET /accounts/google/login/callback/`
- **Logout**: `POST /accounts/logout/`

## Testing Checklist

- [ ] Created Google OAuth credentials
- [ ] Added credentials to `.env` file
- [ ] Ran migrations
- [ ] Configured Django Site
- [ ] Can click "Sign in with Google" and see Google's login page
- [ ] After Google login, redirected back to app
- [ ] User created in Django admin
- [ ] JWT tokens generated
- [ ] Frontend receives tokens and user info
- [ ] Can make authenticated API calls with the token

## Security Best Practices

1. **Never commit** `.env` file with real credentials
2. **Use HTTPS** in production (required by Google OAuth)
3. **Rotate secrets** if they're ever exposed
4. **Restrict API key usage** in Google Console (HTTP referrers, IP addresses)
5. **Set short token expiration** for access tokens (currently 1 hour)
6. **Use httpOnly cookies** for token storage (alternatively)

## Next Steps

- [ ] Add social account linking (allow users to connect multiple OAuth providers)
- [ ] Implement email verification for non-OAuth signups
- [ ] Add profile pictures from Google
- [ ] Implement "Sign in with GitHub" (already configured in settings)

## Additional Resources

- [Django Allauth Documentation](https://django-allauth.readthedocs.io/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Django Sites Framework](https://docs.djangoproject.com/en/5.0/ref/contrib/sites/)
