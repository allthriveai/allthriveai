# AllThrive AI Authentication System

## 🎯 Overview

AllThrive AI now has a complete OAuth authentication system with **Gmail (Google)** and **GitHub** login, featuring a comprehensive **role-based permission system**.

## ✨ Features

- 🔐 **OAuth 2.0 Authentication** - Secure login with Google and GitHub
- 👥 **5-Tier Role System** - Explorer, Expert, Mentor, Patron, Admin
- 🍪 **Secure Cookies** - JWT tokens in HTTP-only cookies
- 🎨 **Beautiful UI** - Modern, responsive login page
- 🛡️ **Security First** - CSRF protection, secure sessions
- 📱 **Production Ready** - Configurable for deployment
- 📚 **Full Documentation** - Comprehensive guides included

## 🚀 Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run migrations
python manage.py makemigrations
python manage.py migrate

# 3. Create superuser
python manage.py createsuperuser

# 4. Start servers
python manage.py runserver  # Backend
cd frontend && npm run dev   # Frontend (new terminal)

# 5. Configure OAuth in Django admin
# Visit: http://localhost:8000/admin/
```

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [OAUTH_QUICK_REFERENCE.md](./OAUTH_QUICK_REFERENCE.md) | Quick reference card with common commands |
| [OAUTH_QUICKSTART.md](./OAUTH_QUICKSTART.md) | Step-by-step setup guide |
| [OAUTH_SETUP.md](./OAUTH_SETUP.md) | Detailed configuration guide |
| [OAUTH_IMPLEMENTATION_SUMMARY.md](./OAUTH_IMPLEMENTATION_SUMMARY.md) | Technical implementation details |
| [SIGNUP_FEATURE.md](./SIGNUP_FEATURE.md) | Signup feature documentation |

## 🎭 User Roles

| Role | Level | Description | Use Case |
|------|-------|-------------|----------|
| **Explorer** | 1 | Basic access | New users, free tier |
| **Expert** | 2 | Enhanced features | Paid basic tier |
| **Mentor** | 3 | Advanced capabilities | Professional tier |
| **Patron** | 4 | Premium features | Premium tier |
| **Admin** | 5 | Full access | Administrators |

### Hierarchical Permissions
Higher roles inherit all permissions from lower roles. For example, an **Expert** has all **Explorer** permissions plus additional features.

## 🔑 OAuth Providers

### Google OAuth
- Allows users to sign in with their Gmail account
- Redirect URI: `http://localhost:8000/accounts/google/login/callback/`
- Setup: [Google Cloud Console](https://console.cloud.google.com/)

### GitHub OAuth
- Allows users to sign in with their GitHub account
- Redirect URI: `http://localhost:8000/accounts/github/login/callback/`
- Setup: [GitHub Developer Settings](https://github.com/settings/developers)

## 🌐 API Endpoints

```
POST   /api/auth/signup/      - Create new user account
POST   /api/auth/google/      - Google OAuth login
POST   /api/auth/github/      - GitHub OAuth login
GET    /api/auth/me/          - Get current user info
POST   /api/auth/logout/      - Logout user
GET    /api/auth/profile/     - Get user profile
PATCH  /api/auth/profile/     - Update user profile
GET    /api/auth/urls/        - Get OAuth provider URLs
```

## 🎨 Frontend Components

### Login Page
- Modern, gradient design
- OAuth buttons with provider logos
- Role information display
- Error handling
- Loading states
- Link to signup page

Location: `frontend/src/pages/LoginPage.tsx`

### Signup Page
- Email/password registration form
- OAuth signup options (Google/GitHub)
- Role selection during signup
- Form validation
- Password confirmation
- Error handling
- Redirect to login after success

Location: `frontend/src/pages/SignupPage.tsx`

## 🛠️ Technology Stack

### Backend
- Django 5.x
- django-allauth (OAuth)
- djangorestframework
- djangorestframework-simplejwt (JWT)
- PostgreSQL

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- React Router
- Axios

## 📦 What's Included

### New Files
```
core/user_models.py           - Custom User model with roles
core/auth_serializers.py      - User data serializers
core/auth_views.py            - Authentication views
docs/OAUTH_SETUP.md           - Setup documentation
docs/OAUTH_QUICKSTART.md      - Quick start guide
docs/OAUTH_IMPLEMENTATION_SUMMARY.md  - Technical summary
docs/OAUTH_QUICK_REFERENCE.md - Reference card
docs/AUTH_README.md           - This file
```

### Modified Files
```
requirements.txt              - Added OAuth dependencies
config/settings.py            - OAuth configuration
config/urls.py                - Added allauth routes
core/models.py                - Import custom User
core/urls.py                  - Auth endpoints
core/admin.py                 - User admin interface
frontend/src/types/models.ts  - User types with roles
frontend/src/pages/LoginPage.tsx  - OAuth login UI
frontend/.env                 - API configuration
.env.example                  - OAuth credentials template
```

## 🔒 Security Features

- ✅ HTTP-only cookies for JWT tokens
- ✅ CSRF protection
- ✅ SameSite cookie attribute
- ✅ Secure session configuration
- ✅ First-party cookie authentication
- ✅ OAuth 2.0 protocol
- ✅ Role-based access control

## 🧪 Testing

```bash
# 1. Start both servers
python manage.py runserver    # Terminal 1
cd frontend && npm run dev     # Terminal 2

# 2. Visit login page
# http://localhost:3000/login

# 3. Test OAuth flows
# - Click "Continue with Google"
# - Click "Continue with GitHub"

# 4. Verify in Django admin
# http://localhost:8000/admin/core/user/
```

## 🎓 Usage Examples

### Backend Permission Check
```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expert_only_feature(request):
    if not request.user.has_role_permission('expert'):
        return Response({'error': 'Expert role required'}, status=403)
    
    return Response({'data': 'success'})
```

### Frontend Permission Check
```typescript
import { useAuth } from '@/context/AuthContext';

function PremiumFeature() {
  const { user } = useAuth();
  
  if (user.role !== 'patron' && user.role !== 'admin') {
    return <div>Upgrade to Patron to access this feature</div>;
  }
  
  return <div>Premium content here</div>;
}
```

## 🎯 Next Steps

1. **Get OAuth Credentials**
   - Create apps in Google Cloud Console and GitHub
   - Add credentials to `.env` file

2. **Configure Django Admin**
   - Update Site domain to match your URL
   - Add Social Applications for each provider

3. **Customize Roles**
   - Modify role permissions in `core/user_models.py`
   - Update frontend to show/hide features based on roles

4. **Deploy to Production**
   - Follow the production guide in `OAUTH_SETUP.md`
   - Enable HTTPS
   - Update OAuth redirect URIs

## 🐛 Troubleshooting

### Common Issues

**OAuth redirect mismatch**
- Solution: Ensure redirect URIs in OAuth apps match exactly (include trailing slash)

**User not being created**
- Solution: Check Django admin Site domain matches your URL

**Authentication not persisting**
- Solution: Verify cookies are being set (check browser dev tools)

**"No module named 'allauth'"**
- Solution: `pip install -r requirements.txt`

For more troubleshooting, see [OAUTH_SETUP.md](./OAUTH_SETUP.md)

## 📞 Support

- Check documentation in `/docs` folder
- Review Django logs: `python manage.py runserver`
- Check browser console for frontend errors
- Verify OAuth credentials are correct

## 🎉 Conclusion

Your AllThrive AI application now has a complete, secure, and production-ready authentication system with:

- ✅ Google OAuth login
- ✅ GitHub OAuth login
- ✅ Email/password signup
- ✅ Role-based permissions (5 roles)
- ✅ Beautiful login and signup UI
- ✅ Secure token management
- ✅ Form validation and error handling
- ✅ Comprehensive documentation

Start building amazing features with confidence in your authentication foundation!
