# OAuth Authentication Setup Guide

This guide will help you set up Gmail (Google) and GitHub OAuth authentication for AllThrive AI.

## Overview

AllThrive AI uses OAuth 2.0 for authentication with:
- **Google OAuth** - For Gmail login
- **GitHub OAuth** - For GitHub login

Users are assigned one of five roles upon registration:
- **Explorer** - Basic permissions (default)
- **Expert** - Enhanced features
- **Mentor** - Advanced capabilities
- **Patron** - Premium features
- **Admin** - Full access to all features

## Prerequisites

1. Django backend running (default: http://localhost:8000)
2. React frontend running (default: http://localhost:3000)
3. Google Cloud Platform account
4. GitHub account

## 1. Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Configure the OAuth consent screen if prompted
6. Select **Web application** as the application type
7. Add the following to **Authorized redirect URIs**:
   ```
   http://localhost:8000/accounts/google/login/callback/
   http://localhost:8000/api/auth/google/callback/
   ```
8. For production, also add:
   ```
   https://yourdomain.com/accounts/google/login/callback/
   https://yourdomain.com/api/auth/google/callback/
   ```

### Step 2: Configure Environment Variables

Add the following to your `.env` file:
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 2. GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - **Application name**: AllThrive AI (or your app name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:8000/accounts/github/login/callback/`
4. Click **Register application**
5. Generate a new client secret

### Step 2: Configure Environment Variables

Add the following to your `.env` file:
```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## 3. Backend Configuration

The backend is already configured with django-allauth. The key settings are in `config/settings.py`:

```python
AUTH_USER_MODEL = 'core.User'
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

### Configure OAuth Providers in Django Admin

1. Start the Django server: `python manage.py runserver`
2. Navigate to: http://localhost:8000/admin/
3. Login with your superuser credentials
4. Go to **Sites** and update the domain to `localhost:8000`
5. Go to **Social applications** > **Add social application**

#### For Google:
- **Provider**: Google
- **Name**: Google OAuth
- **Client id**: Your Google Client ID
- **Secret key**: Your Google Client Secret
- **Sites**: Select your site (localhost:8000)

#### For GitHub:
- **Provider**: GitHub
- **Name**: GitHub OAuth
- **Client id**: Your GitHub Client ID
- **Secret key**: Your GitHub Client Secret
- **Sites**: Select your site (localhost:8000)

## 4. Frontend Configuration

The frontend is already configured in `frontend/src/pages/LoginPage.tsx`.

Ensure your `frontend/.env` has:
```bash
VITE_API_URL=http://localhost:8000
```

## 5. Testing the OAuth Flow

### Start the Application

1. **Backend** (in root directory):
   ```bash
   python manage.py runserver
   ```

2. **Frontend** (in frontend directory):
   ```bash
   npm run dev
   ```

### Test Login

1. Navigate to http://localhost:3000/login
2. Click **Continue with Google** or **Continue with GitHub**
3. Complete the OAuth flow
4. You should be redirected back to the dashboard as an authenticated user

## 6. User Roles

By default, new users are assigned the **Explorer** role. You can change user roles in the Django admin:

1. Go to http://localhost:8000/admin/
2. Navigate to **Core** > **Users**
3. Click on a user
4. Change the **Role** field
5. Save

### Role Hierarchy

The roles have a hierarchical permission system:
- Explorer (Level 1) - Basic access
- Expert (Level 2) - Can access Expert features
- Mentor (Level 3) - Can access Mentor features
- Patron (Level 4) - Premium features
- Admin (Level 5) - Full access

Higher roles inherit permissions from lower roles.

## 7. Production Deployment

For production, make sure to:

1. Update OAuth redirect URIs with your production domain
2. Set `DEBUG=False` in your Django settings
3. Use HTTPS for all OAuth callbacks
4. Set `AUTH_COOKIE_SECURE=True` in JWT settings
5. Update CORS settings to allow your production frontend domain
6. Use environment variables for all secrets

### Production Environment Variables

```bash
DEBUG=False
ALLOWED_HOSTS=yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
GOOGLE_CLIENT_ID=your-production-google-client-id
GOOGLE_CLIENT_SECRET=your-production-google-client-secret
GITHUB_CLIENT_ID=your-production-github-client-id
GITHUB_CLIENT_SECRET=your-production-github-client-secret
```

## 8. Troubleshooting

### Common Issues

**OAuth redirect mismatch error:**
- Ensure the redirect URIs in Google/GitHub match exactly with your backend URL
- Check that the callback URL includes the trailing slash

**CSRF token issues:**
- Make sure CORS is properly configured
- Check that cookies are being set properly

**User not being created:**
- Check Django logs for errors
- Verify database migrations have been run
- Ensure the Site domain in Django admin is correct

**OAuth provider not found:**
- Verify you've added the social application in Django admin
- Check that the provider names match exactly (case-sensitive)

## API Endpoints

The following authentication endpoints are available:

- `GET /api/auth/urls/` - Get OAuth provider URLs
- `GET /api/auth/me/` - Get current user info
- `POST /api/auth/logout/` - Logout user
- `GET /api/auth/profile/` - Get user profile
- `PATCH /api/auth/profile/` - Update user profile
- `POST /api/auth/google/` - Google OAuth callback
- `POST /api/auth/github/` - GitHub OAuth callback

## Security Best Practices

1. Never commit `.env` files to version control
2. Use strong, unique secrets for production
3. Enable HTTPS in production
4. Set HTTP-only cookies for JWT tokens
5. Implement rate limiting on authentication endpoints
6. Regularly rotate OAuth secrets
7. Monitor authentication logs for suspicious activity

## Further Reading

- [Django Allauth Documentation](https://django-allauth.readthedocs.io/)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [Django REST Framework JWT](https://django-rest-framework-simplejwt.readthedocs.io/)
