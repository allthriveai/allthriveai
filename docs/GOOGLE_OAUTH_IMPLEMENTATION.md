# Google OAuth Implementation Guide

## Overview
This guide provides step-by-step instructions for setting up Google OAuth authentication in the AllThrive AI application.

## Prerequisites
- Google Cloud Console account
- Backend running on port 8000
- Frontend running on port 3000

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 1.2 Create a New Project
1. Click on the project dropdown at the top
2. Click "New Project"
3. Enter project name: "AllThrive AI"
4. Click "Create"

### 1.3 Enable Google+ API
1. Go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 1.4 Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in required fields:
   - **App name**: AllThrive AI
   - **User support email**: your-email@gmail.com
   - **Developer contact**: your-email@gmail.com
4. Click "Save and Continue"
5. **Scopes**: Click "Add or Remove Scopes"
   - Add: `.../auth/userinfo.email`
   - Add: `.../auth/userinfo.profile`
   - Add: `openid`
6. Click "Save and Continue"
7. **Test users** (for development): Add your Gmail test accounts
8. Click "Save and Continue"

### 1.5 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "+ Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. **Name**: AllThrive AI Web Client
5. **Authorized JavaScript origins**:
   ```
   http://localhost:8000
   http://127.0.0.1:8000
   http://localhost:3000
   http://127.0.0.1:3000
   ```
6. **Authorized redirect URIs**:
   ```
   http://localhost:8000/accounts/google/login/callback/
   http://127.0.0.1:8000/accounts/google/login/callback/
   ```
7. Click "Create"
8. **IMPORTANT**: Copy your **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

### 2.1 Backend Configuration
Update `/Users/allierays/Sites/allthriveai/.env`:

```bash
# OAuth 
GOOGLE_CLIENT_ID=961421468702-1tva2usqfgetj0d7uafd3m63hnsio2ig.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### 2.2 Frontend Configuration
Update `frontend/.env`:

```bash
# Google OAuth
VITE_GOOGLE_CLIENT_ID=961421468702-1tva2usqfgetj0d7uafd3m63hnsio2ig.apps.googleusercontent.com
```

## Step 3: Backend Setup

### 3.1 Run Migrations
```bash
cd /Users/allierays/Sites/allthriveai
python manage.py migrate
```

### 3.2 Configure Django Site
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

### 3.3 Start Backend Server
```bash
python manage.py runserver
```

## Step 4: Frontend Setup

### 4.1 Install Dependencies (if needed)
```bash
cd frontend
npm install
```

### 4.2 Start Frontend Server
```bash
npm run dev
```

## Step 5: Test the OAuth Flow

### 5.1 Manual Test
1. Open your browser and go to: http://localhost:3000/auth
2. Click "Continue with Google"
3. You should be redirected to Google's login page
4. Sign in with your Google account
5. After successful authentication, you'll be redirected back to http://localhost:3000/auth/callback
6. The callback page will process the tokens and redirect you to the dashboard

### 5.2 Verify Authentication
1. After successful login, you should see the dashboard at http://localhost:3000/dashboard
2. Check browser cookies - you should see `access_token` and `refresh_token` cookies
3. The backend should recognize you as authenticated

## Architecture

### OAuth Flow
1. User clicks "Continue with Google" on the frontend
2. Frontend redirects to: `http://localhost:8000/accounts/google/login/?process=login`
3. Backend (django-allauth) redirects to Google OAuth
4. User authenticates with Google
5. Google redirects back to: `http://localhost:8000/accounts/google/login/callback/`
6. Backend processes the OAuth callback
7. Backend redirects to: `http://localhost:8000/api/auth/callback/`
8. Backend generates JWT tokens and redirects to: `http://localhost:3000/auth/callback?access=TOKEN&refresh=TOKEN`
9. Frontend callback page receives tokens
10. Frontend refreshes user data and redirects to dashboard

### Key Files

#### Backend
- `config/settings.py`: OAuth configuration, JWT settings, allauth settings
- `core/auth_views.py`: OAuth callback handler (`oauth_callback`)
- `core/urls.py`: OAuth URL patterns
- `config/urls.py`: Includes allauth URLs at `/accounts/`

#### Frontend
- `frontend/src/pages/OAuthCallbackPage.tsx`: Handles OAuth redirect
- `frontend/src/routes/index.tsx`: Defines `/auth/callback` route
- `frontend/src/components/auth/OAuthButtons.tsx`: Google login button
- `frontend/src/pages/LoginPage.tsx`: Login page with OAuth buttons

## Troubleshooting

### Error: "Redirect URI mismatch"
- Ensure your redirect URI in Google Cloud Console exactly matches: `http://localhost:8000/accounts/google/login/callback/`
- Include the trailing slash

### Error: "Invalid client"
- Double-check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correctly set in `.env`
- Restart the backend server after changing `.env`

### Error: "OAuth failed"
- Check browser console for errors
- Verify that both backend and frontend are running
- Check that CORS settings allow `http://localhost:3000`

### User redirected to wrong page
- Verify `LOGIN_REDIRECT_URL` in `config/settings.py` is set to `/api/auth/callback/`
- Check that the frontend callback route exists at `/auth/callback`

### Tokens not being set
- Verify that `SIMPLE_JWT` cookie settings in `config/settings.py` are correct
- Check browser's cookie settings allow first-party cookies
- Inspect network tab to see if Set-Cookie headers are present

## Production Considerations

When deploying to production:

1. **Update Google Cloud Console**:
   - Add production domain to Authorized JavaScript origins
   - Add production callback URL to Authorized redirect URIs

2. **Update Environment Variables**:
   - Set production URLs in both backend and frontend `.env` files
   - Update `CORS_ALLOWED_ORIGINS` in backend
   - Update `frontend_url` in `oauth_callback` function

3. **Enable Secure Cookies**:
   - Set `DEBUG=False` in production
   - Cookies will automatically become secure (HTTPS only)

4. **SSL/HTTPS**:
   - Ensure your production site uses HTTPS
   - Google OAuth requires HTTPS for production domains

## Next Steps

- Add GitHub OAuth (similar process)
- Implement token refresh mechanism
- Add user profile management
- Set up proper error handling and logging
