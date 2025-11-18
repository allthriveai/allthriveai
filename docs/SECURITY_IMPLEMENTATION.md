# Security Implementation Guide

This document outlines the Django security measures implemented for user profiles and how to use them.

## ✅ Implemented Security Measures

### 1. Production Security Headers
**Location:** `config/settings.py`

- `SECURE_BROWSER_XSS_FILTER` - Prevents XSS attacks
- `SECURE_CONTENT_TYPE_NOSNIFF` - Prevents MIME-type sniffing
- `X_FRAME_OPTIONS = 'DENY'` - Prevents clickjacking
- HSTS settings (production only) - Forces HTTPS
- Content Security Policy (CSP) - Controls resource loading

### 2. Enhanced JWT Security
**Location:** `config/settings.py` - `SIMPLE_JWT`

- Access token lifetime: 15 minutes (reduced from 1 hour)
- SameSite: `Strict` (upgraded from `Lax`)
- HTTPOnly cookies enabled
- Token blacklist enabled for logout/rotation

### 3. Password Validation
**Location:** `config/settings.py` - `AUTH_PASSWORD_VALIDATORS`

- Minimum password length: 12 characters (increased from 8)
- Checks for common passwords
- Validates against user attributes
- Prevents numeric-only passwords

### 4. Input Validation & Sanitization
**Location:** `core/user_models.py`

#### User Model - `clean()` method
- **Bio sanitization:** Uses `bleach` to remove dangerous HTML/JS
- **Allowed HTML tags:** `p`, `br`, `strong`, `em`, `a`, `ul`, `ol`, `li`
- **Bio length limit:** 5000 characters
- **Avatar URL validation:** Only allows trusted domains:
  - githubusercontent.com
  - gravatar.com
  - googleusercontent.com
  - github.com
  - avatars.githubusercontent.com

**To add more allowed avatar domains:**
```python
# In core/user_models.py, User.clean() method
allowed_domains = [
    'your-cdn-domain.com',
    # Add more domains here
]
```

### 5. Audit Logging
**Location:** `core/audit_models.py`

Track security events and profile changes:

#### Usage Example:
```python
from core.models import UserAuditLog

# Log a profile update
UserAuditLog.log_action(
    user=request.user,
    action=UserAuditLog.Action.PROFILE_UPDATE,
    request=request,
    details={'fields_updated': ['bio', 'avatar_url']}
)

# Log a failed login
UserAuditLog.log_action(
    user=user,
    action=UserAuditLog.Action.FAILED_LOGIN,
    request=request,
    success=False
)
```

#### Available Actions:
- `LOGIN`
- `LOGOUT`
- `PROFILE_UPDATE`
- `PASSWORD_CHANGE`
- `EMAIL_CHANGE`
- `ROLE_CHANGE`
- `FAILED_LOGIN`
- `ACCOUNT_LOCKED`
- `OAUTH_LOGIN`

#### Viewing Audit Logs:
```python
# Get user's recent audit logs
user.audit_logs.all()[:10]

# Find suspicious activity
from datetime import timedelta
from django.utils import timezone

recent = timezone.now() - timedelta(hours=1)
failed_logins = UserAuditLog.objects.filter(
    action=UserAuditLog.Action.FAILED_LOGIN,
    timestamp__gte=recent
)
```

### 6. Custom Permissions
**Location:** `core/permissions.py`

#### IsOwnerOrReadOnly
Use for objects with a `user` field (e.g., Projects):
```python
from core.permissions import IsOwnerOrReadOnly

class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
```

#### IsProfileOwner
Use for User profile endpoints:
```python
from core.permissions import IsProfileOwner

class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsProfileOwner]
```

#### CanModifyRole
Prevents role escalation attacks:
```python
from core.permissions import CanModifyRole

class UserUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, CanModifyRole]
```

### 7. Serializer Security
**Location:** `core/auth_serializers.py` & `core/serializers.py`

#### UserSerializer - Field-Level Permissions
- Hides `email` and `last_login` from public profiles
- Prevents role modification (read-only unless superuser)
- Dynamically adjusts fields based on request context

#### ProjectSerializer - Input Validation
- Validates JSON content structure
- Limits content size to 100KB (prevents DoS)
- Validates thumbnail URLs

### 8. Database Optimization
**Location:** `core/models.py`

#### Project QuerySet Methods
```python
# Get projects accessible to a user
Project.objects.for_user(request.user)

# Get public showcase projects
Project.objects.public_showcase()

# Get projects by username
Project.objects.by_user('johndoe')
```

#### Database Indexes Added:
- `(user, slug)` - Fast project lookups
- `(is_showcase, is_archived, -created_at)` - Fast public listing
- `(user, -created_at)` - Fast user project listing

## 🚧 To Implement: Rate Limiting

**Package:** `django-ratelimit` (already installed)

### Example Implementation:

```python
# In your views.py
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

# Function-based view
@ratelimit(key='user', rate='10/m', method='POST')
def update_profile(request):
    # Only allow 10 profile updates per minute per user
    pass

# Class-based view
@method_decorator(ratelimit(key='user', rate='5/m', method='POST'), name='post')
class ProjectCreateView(generics.CreateAPIView):
    # Only allow 5 project creations per minute per user
    pass

# Rate limit by IP for anonymous users
@ratelimit(key='ip', rate='20/h', method='POST')
def public_endpoint(request):
    # Only allow 20 requests per hour from same IP
    pass
```

### Rate Limiting Keys:
- `'user'` - Limit by authenticated user
- `'ip'` - Limit by IP address
- `'user_or_ip'` - Limit by user if authenticated, else IP
- Custom: `lambda request: request.user.email`

## 📝 Best Practices

### 1. Always Use Permissions in ViewSets
```python
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsOwnerOrReadOnly

class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
```

### 2. Log Sensitive Actions
```python
def update_profile(request):
    # ... update logic ...
    UserAuditLog.log_action(
        user=request.user,
        action=UserAuditLog.Action.PROFILE_UPDATE,
        request=request
    )
```

### 3. Use Model Validation
The User model now calls `full_clean()` on save, ensuring validation:
```python
# This will raise ValidationError if bio contains malicious content
user.bio = "<script>alert('xss')</script>"
user.save()  # ValidationError raised
```

### 4. Serializer Context
Always pass request in serializer context for field-level permissions:
```python
serializer = UserSerializer(user, context={'request': request})
```

### 5. Production Settings
Before deploying to production:

1. Set `DEBUG=False` in environment
2. Set proper `SECRET_KEY`
3. Configure `ALLOWED_HOSTS`
4. Use HTTPS (security headers will activate)
5. Review CSP directives in settings
6. Consider removing `'unsafe-inline'` from CSP

## 🔒 Environment Variables

Add to your `.env` file:
```bash
DEBUG=False
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

## 🧪 Testing Security

```python
# Test bio sanitization
user = User.objects.create(username='test', bio='<script>alert("xss")</script>')
assert '<script>' not in user.bio

# Test avatar URL validation
from django.core.exceptions import ValidationError
user.avatar_url = 'http://malicious-site.com/avatar.jpg'
try:
    user.save()
except ValidationError:
    # Expected - domain not allowed
    pass
```

## 📊 Monitoring

Query audit logs to detect suspicious activity:
```python
# Find users with many failed logins
from django.db.models import Count

suspicious = UserAuditLog.objects.filter(
    action=UserAuditLog.Action.FAILED_LOGIN,
    success=False
).values('user').annotate(
    count=Count('id')
).filter(count__gte=5)
```

## 🔄 Next Steps

Consider implementing:
1. Two-factor authentication (2FA)
2. Email verification for profile changes
3. Password reset rate limiting
4. IP-based blocking for repeat offenders
5. CAPTCHA for sensitive endpoints
6. Automated security scanning (e.g., django-security)
