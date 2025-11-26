# OAuth Login - Quick Start

Quick guide to get OAuth authentication working in development.

## 1. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

## 2. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

## 3. Create Superuser

```bash
python manage.py createsuperuser
```

## 4. Configure OAuth Providers

### Option A: Using Django Admin (Recommended)

1. Start the backend:
   ```bash
   python manage.py runserver
   ```

2. Go to http://localhost:8000/admin/

3. Login with your superuser credentials

4. **Update Site:**
   - Go to **Sites**
   - Click on `example.com`
   - Change Domain to: `localhost:8000`
   - Change Display name to: `AllThrive AI`
   - Save

5. **Add Google OAuth:**
   - Go to **Social applications** > **Add**
   - Provider: `Google`
   - Name: `Google OAuth`
   - Client id: `your-google-client-id`
   - Secret key: `your-google-client-secret`
   - Sites: Select `localhost:8000`
   - Save

6. **Add GitHub OAuth:**
   - Go to **Social applications** > **Add**
   - Provider: `GitHub`
   - Name: `GitHub OAuth`
   - Client id: `your-github-client-id`
   - Secret key: `your-github-client-secret`
   - Sites: Select `localhost:8000`
   - Save

### Option B: Using Environment Variables

Add to your `.env` file:
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## 5. Get OAuth Credentials

### Google:
1. Go to https://console.cloud.google.com/
2. Create/select a project
3. Enable Google+ API
4. Create OAuth client credentials
5. Add redirect URI: `http://localhost:8000/accounts/google/login/callback/`

### GitHub:
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Callback URL: `http://localhost:8000/accounts/github/login/callback/`

## 6. Start the Application

Terminal 1 (Backend):
```bash
python manage.py runserver
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

## 7. Test Login

1. Go to http://localhost:3000/login
2. Click "Continue with Google" or "Continue with GitHub"
3. Complete OAuth flow
4. You'll be redirected to the dashboard

## User Roles

New users default to **Explorer** role. Change roles in Django admin:
- http://localhost:8000/admin/core/user/

## Troubleshooting

**"No module named 'allauth'"**
```bash
pip install django-allauth dj-rest-auth djangorestframework-simplejwt
```

**"Relation 'core_user' does not exist"**
```bash
python manage.py makemigrations core
python manage.py migrate
```

**"Social application not found"**
- Make sure you've added the social application in Django admin
- Check that the Site domain is correct

**OAuth redirect error**
- Verify redirect URIs match exactly in Google/GitHub settings
- Include the trailing slash

## Next Steps

See [OAUTH_SETUP.md](./OAUTH_SETUP.md) for detailed configuration and production deployment.
