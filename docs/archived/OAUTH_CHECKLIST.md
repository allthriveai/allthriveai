# Google OAuth Setup Checklist

## ✅ Configuration Updated

### Backend Files
- [x] `.env` - Google OAuth credentials configured
- [x] `config/settings.py` - LOGIN_REDIRECT_URL added
- [x] `core/auth_views.py` - oauth_callback function added
- [x] `core/urls.py` - oauth_callback route added

### Frontend Files
- [x] `frontend/.env` - Google Client ID added
- [x] `frontend/src/pages/OAuthCallbackPage.tsx` - Created
- [x] `frontend/src/routes/index.tsx` - OAuth callback route added

## 🔑 Environment Variables

### Backend (`.env`)
```bash
GOOGLE_CLIENT_ID=961421468702-1tva2usqfgetj0d7uafd3m63hnsio2ig.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### Frontend (`frontend/.env`)
```bash
VITE_GOOGLE_CLIENT_ID=961421468702-1tva2usqfgetj0d7uafd3m63hnsio2ig.apps.googleusercontent.com
```

## 📋 Setup Steps Required

### 1. Run Backend Migrations
```bash
cd /Users/allierays/Sites/allthriveai
python manage.py migrate
```

### 2. Configure Django Site
```bash
python manage.py shell
```

Then run:
```python
from django.contrib.sites.models import Site
site = Site.objects.get(id=1)
site.domain = 'localhost:8000'
site.name = 'AllThrive AI Local'
site.save()
exit()
```

### 3. Verify Google Cloud Console Settings
- Authorized JavaScript origins:
  - `http://localhost:8000`
  - `http://localhost:3000`
- Authorized redirect URIs:
  - `http://localhost:8000/accounts/google/login/callback/`

### 4. Start Servers
```bash
# Terminal 1 - Backend
cd /Users/allierays/Sites/allthriveai
python manage.py runserver

# Terminal 2 - Frontend
cd /Users/allierays/Sites/allthriveai/frontend
npm run dev
```

### 5. Test OAuth Flow
1. Go to: http://localhost:3000/auth
2. Click "Continue with Google"
3. Sign in with Google
4. Verify redirect to dashboard

## 🔍 Verification

### Check that:
- [ ] Backend server is running on port 8000
- [ ] Frontend server is running on port 3000
- [ ] Google OAuth credentials are in `.env` files
- [ ] Django migrations are applied
- [ ] Django Site is configured
- [ ] OAuth callback page exists at `/auth/callback`

### Test flow:
1. [ ] Navigate to http://localhost:3000/auth
2. [ ] Click "Continue with Google"
3. [ ] Redirected to Google login
4. [ ] Sign in with Google account
5. [ ] Redirected back to http://localhost:3000/auth/callback
6. [ ] See loading spinner
7. [ ] Redirected to http://localhost:3000/dashboard
8. [ ] Can access protected routes

## 🐛 Quick Troubleshooting

| Error | Solution |
|-------|----------|
| "Redirect URI mismatch" | Check Google Cloud Console redirect URIs match exactly |
| "Invalid client" | Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env |
| "OAuth failed" | Check both servers are running, check browser console |
| Stuck on callback page | Check network tab for errors, verify backend is responding |
| Not authenticated after redirect | Verify cookies are being set (check browser dev tools) |

## 📚 Documentation

For detailed information, see:
- [GOOGLE_OAUTH_IMPLEMENTATION.md](./GOOGLE_OAUTH_IMPLEMENTATION.md) - Complete setup guide
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - Original setup instructions

## 🎯 Quick Commands

```bash
# Check if Django site is configured
python manage.py shell -c "from django.contrib.sites.models import Site; print(Site.objects.get(id=1).domain)"

# Test backend OAuth endpoint
curl http://localhost:8000/accounts/google/login/

# Check frontend environment
cd frontend && grep VITE_GOOGLE_CLIENT_ID .env

# Restart backend (after .env changes)
# Ctrl+C, then:
python manage.py runserver

# Restart frontend (after .env changes)
# Ctrl+C, then:
npm run dev
```
