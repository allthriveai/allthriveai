# OAuth Quick Reference Card

## 🚀 Quick Setup Commands

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run migrations
python manage.py makemigrations
python manage.py migrate

# 3. Create superuser
python manage.py createsuperuser

# 4. Start backend
python manage.py runserver

# 5. Start frontend (new terminal)
cd frontend && npm run dev
```

## 🔑 OAuth URLs

### Get Credentials
- **Google**: https://console.cloud.google.com/apis/credentials
- **GitHub**: https://github.com/settings/developers

### Redirect URIs (for OAuth apps)
```
http://localhost:8000/accounts/google/login/callback/
http://localhost:8000/accounts/github/login/callback/
```

## 📋 Environment Variables (.env)

```bash
# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Django
SECRET_KEY=your-secret-key
DEBUG=True
```

## 🎭 User Roles

| Role     | Level | Description          |
|----------|-------|----------------------|
| Explorer | 1     | Basic access         |
| Expert   | 2     | Enhanced features    |
| Mentor   | 3     | Advanced features    |
| Patron   | 4     | Premium features     |
| Admin    | 5     | Full access          |

## 🌐 API Endpoints

```
POST   /api/auth/google/        - Google OAuth
POST   /api/auth/github/        - GitHub OAuth
GET    /api/auth/me/            - Current user info
POST   /api/auth/logout/        - Logout
GET    /api/auth/profile/       - Get profile
PATCH  /api/auth/profile/       - Update profile
GET    /api/auth/urls/          - OAuth URLs
```

## 🎨 Frontend Routes

```
/login      - Login page with OAuth buttons
/dashboard  - Protected route (requires auth)
```

## 🔍 Django Admin URLs

```
http://localhost:8000/admin/           - Admin home
http://localhost:8000/admin/sites/     - Update site domain
http://localhost:8000/admin/socialaccount/socialapp/  - OAuth apps
http://localhost:8000/admin/core/user/ - User management
```

## 🐛 Common Issues & Fixes

### "No module named 'allauth'"
```bash
pip install django-allauth dj-rest-auth djangorestframework-simplejwt
```

### "Relation 'core_user' does not exist"
```bash
python manage.py makemigrations core
python manage.py migrate
```

### OAuth redirect error
- Check redirect URIs match exactly (include trailing slash)
- Verify Site domain in Django admin is correct

### "Social application not found"
- Add social application in Django admin
- Make sure provider name is correct (case-sensitive)

## 📝 Quick Test

1. Go to: http://localhost:3000/login
2. Click "Continue with Google" or "Continue with GitHub"
3. Complete OAuth flow
4. Should redirect to dashboard

## 🔒 Security Checklist

- [ ] Use environment variables for secrets
- [ ] Enable HTTPS in production
- [ ] Set DEBUG=False in production
- [ ] Use strong SECRET_KEY
- [ ] Enable cookie security (SECURE=True)
- [ ] Configure CORS properly

## 📚 Documentation

- **Setup Guide**: `docs/OAUTH_SETUP.md`
- **Quick Start**: `docs/OAUTH_QUICKSTART.md`
- **Summary**: `docs/OAUTH_IMPLEMENTATION_SUMMARY.md`

## 🎯 Permission Check Examples

### Backend (Django)
```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view(request):
    if not request.user.has_role_permission('expert'):
        return Response({'error': 'Requires Expert role'}, status=403)
    return Response({'data': 'success'})
```

### Frontend (React)
```typescript
const { user } = useAuth();

if (user.role === 'admin') {
  // Show admin features
}
```

## 🎪 Role Change (Django Admin)

1. Go to http://localhost:8000/admin/core/user/
2. Click on a user
3. Change "Role" field
4. Save

## 💡 Tips

- Default role for new users: **Explorer**
- Tokens stored in HTTP-only cookies
- JWT expires after 1 hour (configurable)
- Refresh token valid for 7 days
- Use Django admin to manage users and roles
