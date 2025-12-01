# Security & Authentication

**Source of Truth** | **Last Updated**: 2025-11-29

This document defines the security and authentication architecture for AllThrive AI, including OAuth flows, JWT tokens, WebSocket authentication, CSRF protection, and security best practices.

---

## Authentication Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Methods                    │
├─────────────────────────────────────────────────────────────┤
│  1. OAuth 2.0 (Google, GitHub) ← Primary for signup/login  │
│  2. Email/Password              ← Alternative method        │
│  3. JWT Tokens                  ← API authentication        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Token & Session Management                  │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  First-Party     │  │   JWT Tokens     │                │
│  │  Cookies         │  │  (Access/Refresh)│                │
│  │  (sessionid)     │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Security Layers                            │
│  - CSRF Protection (Cookies + Headers)                      │
│  - CORS Policy (Strict origin checks)                       │
│  - Rate Limiting (IP-based)                                 │
│  - Content Security Policy (CSP)                            │
│  - HTTPS/TLS Enforcement                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## OAuth 2.0 Implementation

### Supported Providers

| Provider | Purpose | Scopes | Client Type |
|----------|---------|--------|-------------|
| **Google** | Signup/Login | `profile`, `email` | Web Application |
| **GitHub** | Signup/Login + API access | `user`, `user:email`, `read:user` | OAuth App |

### OAuth Flow (Authorization Code Grant)

**Sequence**:

1. **User clicks "Login with Google/GitHub"**
   ```http
   GET /accounts/google/login/
   ```

2. **Backend redirects to OAuth provider**
   ```http
   HTTP/1.1 302 Found
   Location: https://accounts.google.com/o/oauth2/v2/auth?
     client_id=...&
     redirect_uri=http://localhost:8000/accounts/google/login/callback/&
     scope=profile+email&
     response_type=code&
     state=random_csrf_token
   ```

3. **User authenticates with provider**
   - User logs into Google/GitHub
   - User grants permissions (scopes)

4. **Provider redirects back with authorization code**
   ```http
   HTTP/1.1 302 Found
   Location: http://localhost:8000/accounts/google/login/callback/?
     code=AUTHORIZATION_CODE&
     state=random_csrf_token
   ```

5. **Backend exchanges code for access token**
   ```http
   POST https://oauth2.googleapis.com/token
   Content-Type: application/x-www-form-urlencoded

   code=AUTHORIZATION_CODE&
   client_id=...&
   client_secret=...&
   redirect_uri=http://localhost:8000/accounts/google/login/callback/&
   grant_type=authorization_code
   ```

6. **Provider returns access token**
   ```json
   {
     "access_token": "ya29.a0AfH6SM...",
     "expires_in": 3599,
     "token_type": "Bearer",
     "scope": "profile email",
     "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjRkN..."
   }
   ```

7. **Backend fetches user profile**
   ```http
   GET https://www.googleapis.com/oauth2/v2/userinfo
   Authorization: Bearer ya29.a0AfH6SM...
   ```

   Response:
   ```json
   {
     "id": "102345678901234567890",
     "email": "alice@example.com",
     "verified_email": true,
     "name": "Alice Smith",
     "given_name": "Alice",
     "family_name": "Smith",
     "picture": "https://lh3.googleusercontent.com/..."
   }
   ```

8. **Backend creates/updates user, generates JWT**
   - Check if user exists by email
   - Create new user or link OAuth account
   - Generate JWT access + refresh tokens
   - Set first-party cookies

9. **Redirect to frontend with success**
   ```http
   HTTP/1.1 302 Found
   Location: http://localhost:3000/dashboard
   Set-Cookie: access_token=eyJhbG...; HttpOnly; Secure; SameSite=Lax
   Set-Cookie: refresh_token=eyJhbG...; HttpOnly; Secure; SameSite=Lax
   Set-Cookie: sessionid=abc123; HttpOnly; Secure; SameSite=Lax
   Set-Cookie: csrftoken=xyz789; Secure; SameSite=Lax
   ```

---

### OAuth Configuration

**Django Allauth Settings** (`config/settings.py`):

```python
AUTHENTICATION_BACKENDS = [
    'core.auth.backends.EmailOrUsernameModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

ACCOUNT_ADAPTER = 'core.auth.adapter.CustomAccountAdapter'
SOCIALACCOUNT_ADAPTER = 'core.auth.adapter.CustomSocialAccountAdapter'

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
    },
    'github': {
        'SCOPE': ['user', 'user:email'],
    },
}

SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_STORE_TOKENS = True  # For GitHub API access
```

**Custom Adapters** (`core/auth/adapter.py`):

- **CustomAccountAdapter**: Sets JWT cookies after email/password login
- **CustomSocialAccountAdapter**: Sets JWT cookies after OAuth login

---

### OAuth Provider Setup

**Database Configuration** (via Django Admin or management command):

```python
# Setup via management command
python manage.py setup_github_oauth

# Creates SocialApp record:
SocialApp(
    provider='github',
    name='GitHub',
    client_id='Iv1.abc123...',
    secret='ghp_xyz789...',
    sites=[Site.objects.get(id=1)]
)
```

**Environment Variables**:
```bash
# Google OAuth
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.abc123...
GITHUB_CLIENT_SECRET=ghp_xyz789...
```

---

## JWT Token Management

### Token Types

1. **Access Token**: Short-lived (15 min), used for API authentication
2. **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

### Token Structure

**Access Token Payload**:
```json
{
  "token_type": "access",
  "exp": 1701264000,
  "iat": 1701263100,
  "jti": "abc123...",
  "user_id": 456,
  "username": "alice",
  "email": "alice@example.com"
}
```

**Refresh Token Payload**:
```json
{
  "token_type": "refresh",
  "exp": 1701868800,
  "iat": 1701263100,
  "jti": "xyz789...",
  "user_id": 456
}
```

---

### JWT Configuration

**Settings** (`config/settings.py`):

```python
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_SECURE': not DEBUG,  # HTTPS only in production
    'AUTH_COOKIE_HTTP_ONLY': True,     # Prevent XSS
    'AUTH_COOKIE_SAMESITE': 'Lax',     # CSRF protection
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_DOMAIN': COOKIE_DOMAIN,  # e.g., 'localhost', '.allthrive.ai'
}
```

---

### Token Lifecycle

**Login Flow**:
```python
from services.auth import set_auth_cookies
from rest_framework_simplejwt.tokens import RefreshToken

def login_user(request, user):
    # Generate tokens
    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)
    
    # Set cookies
    response = Response({'message': 'Login successful'})
    response.set_cookie(
        key='access_token',
        value=access,
        httponly=True,
        secure=True,
        samesite='Lax',
        max_age=900  # 15 min
    )
    response.set_cookie(
        key='refresh_token',
        value=str(refresh),
        httponly=True,
        secure=True,
        samesite='Lax',
        max_age=604800  # 7 days
    )
    return response
```

**Token Refresh** (future endpoint):
```http
POST /api/v1/auth/refresh/
Cookie: refresh_token=eyJhbG...

Response:
Set-Cookie: access_token=NEW_ACCESS_TOKEN; ...
```

**Logout Flow**:
```python
from services.auth import clear_auth_cookies

def logout_user(request):
    response = Response({'message': 'Logged out'})
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    response.delete_cookie('sessionid')
    return response
```

---

## WebSocket Authentication

### Architecture

WebSockets use JWT tokens for authentication since HTTP session cookies aren't automatically sent with WebSocket upgrades in all scenarios.

**Middleware**: `core/agents/middleware.py`

### Token Extraction

**Priority Order**:
1. **HTTP Cookies** (preferred for browser clients)
2. **Query Parameters** (fallback for API clients)

**Implementation**:

```python
class JWTAuthMiddleware:
    async def __call__(self, scope, receive, send):
        token = None
        
        # Extract from cookies (primary)
        headers = dict(scope.get('headers', []))
        cookie_header = headers.get(b'cookie', b'').decode()
        if cookie_header:
            cookies = parse_cookies(cookie_header)
            token = cookies.get('access_token')
        
        # Fallback: query parameter
        if not token:
            query_string = scope.get('query_string', b'').decode()
            params = parse_qs(query_string)
            token = params.get('token', [None])[0]
        
        # Authenticate
        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()
        
        return await self.app(scope, receive, send)
```

### Token Validation

```python
@database_sync_to_async
def get_user_from_token(token_string):
    try:
        # Validate JWT signature and expiry
        access_token = AccessToken(token_string)
        user_id = access_token.get('user_id')
        
        # Fetch user from database
        user = User.objects.get(id=user_id)
        
        if not user.is_active:
            return AnonymousUser()
        
        return user
    except TokenError:
        return AnonymousUser()
```

### Connection Flow

**JavaScript Client**:
```javascript
// Browser automatically sends cookies
const ws = new WebSocket('wss://allthrive.ai/ws/chat/conv-123/');

// Or with explicit token (API clients)
const token = 'eyJhbGci...';
const ws = new WebSocket(`wss://allthrive.ai/ws/chat/conv-123/?token=${token}`);
```

**Connection Validation** (`core/agents/consumers.py`):
```python
async def connect(self):
    # Check authentication
    if not self.scope['user'].is_authenticated:
        await self.close(code=4001)  # Unauthorized
        return
    
    # Validate origin (CSRF)
    headers = dict(self.scope.get('headers', []))
    origin = headers.get(b'origin', b'').decode()
    if origin not in settings.CORS_ALLOWED_ORIGINS:
        await self.close(code=4003)  # Forbidden
        return
    
    await self.accept()
```

---

## CSRF Protection

### Strategy

AllThrive AI uses **double-submit cookie pattern**:
1. Server sets `csrftoken` cookie
2. Frontend reads cookie and includes in `X-CSRFToken` header
3. Server validates header matches cookie

### Configuration

```python
# CSRF settings
CSRF_COOKIE_HTTPONLY = False  # JavaScript needs to read it
CSRF_COOKIE_SECURE = True     # HTTPS only
CSRF_COOKIE_SAMESITE = 'Lax'  # Lax for OAuth flows
CSRF_USE_SESSIONS = False     # Cookie-based CSRF
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'https://allthrive.ai'
]
```

### Frontend Integration

**Get CSRF Token**:
```http
GET /api/v1/auth/csrf/

Response:
{
  "csrfToken": "xyz789..."
}
Set-Cookie: csrftoken=xyz789; Secure; SameSite=Lax
```

**Use in Requests**:
```javascript
// Axios automatically reads csrftoken cookie
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

// Manual fetch
const csrfToken = getCookie('csrftoken');
fetch('/api/v1/me/projects/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': csrfToken
  },
  body: JSON.stringify({...})
});
```

### Exemptions

**Logout endpoint** (safe operation):
```python
@csrf_exempt
@api_view(['POST'])
def logout_view(request):
    # Logout is safe to exempt (only deletes cookies)
    pass
```

**OAuth callbacks** (handled by allauth):
```python
from csp.decorators import csp_exempt

@csp_exempt  # OAuth providers may block CSP
def oauth_callback(request):
    pass
```

---

## CORS Policy

### Configuration

```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',      # Dev frontend
    'http://127.0.0.1:3000',
    'https://allthrive.ai',        # Production
    'https://www.allthrive.ai'
]

CORS_ALLOW_CREDENTIALS = True     # Allow cookies
CORS_PREFLIGHT_MAX_AGE = 86400    # Cache preflight for 24h
```

### Preflight Requests

**Browser sends OPTIONS**:
```http
OPTIONS /api/v1/me/projects/
Origin: http://localhost:3000
Access-Control-Request-Method: POST
Access-Control-Request-Headers: X-CSRFToken,Content-Type
```

**Server responds**:
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: X-CSRFToken, Content-Type, Authorization
Access-Control-Max-Age: 86400
```

---

## Rate Limiting

### Strategies

1. **IP-based**: Prevent brute-force attacks
2. **User-based**: Prevent API abuse
3. **Endpoint-specific**: Protect expensive operations

### Configuration

```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/minute',           # Anonymous users
        'user': '1000/minute',          # Authenticated users
        'public_profile': '60/hour',    # Public profile views
        'quiz_start': '10/hour',        # Quiz attempts
    }
}
```

### Implementation

**Django RateLimit** (view-level):
```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='10/m', method='POST', block=True)
@api_view(['POST'])
def login_view(request):
    # 10 login attempts per minute per IP
    pass

@ratelimit(key='ip', rate='5/h', method='POST', block=True)
def signup(request):
    # 5 signups per hour per IP
    pass
```

**DRF Throttling** (class-based):
```python
from rest_framework.throttling import UserRateThrottle

class QuizStartThrottle(UserRateThrottle):
    scope = 'quiz_start'

class QuizViewSet(viewsets.ModelViewSet):
    throttle_classes = [QuizStartThrottle]
```

**Custom Cache-Based** (signup):
```python
def signup(request):
    ip_address = request.META.get('REMOTE_ADDR')
    cache_key = f'signup_attempts:{ip_address}'
    attempts = cache.get(cache_key, 0)
    
    if attempts >= 5:
        return Response(
            {'error': 'Too many signup attempts'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    
    cache.set(cache_key, attempts + 1, 3600)  # 1 hour
```

---

## Password Security

### Validation Rules

```python
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 12}  # Minimum 12 characters
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]
```

### Password Hashing

**Algorithm**: PBKDF2-SHA256 (Django default)

**Settings**:
```python
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]
```

**Never store plaintext**:
```python
# ❌ NEVER DO THIS
user.password = request.data['password']

# ✅ Always hash
user.set_password(request.data['password'])
user.save()
```

---

## Timing Attack Prevention

### Login/Signup Timing Consistency

**Problem**: Attackers can enumerate users by measuring response times.

**Solution**: Constant-time responses.

```python
import time

def login_view(request):
    start_time = time.time()
    
    # ... authentication logic ...
    
    # Ensure minimum response time (100ms)
    elapsed = time.time() - start_time
    if elapsed < 0.1:
        time.sleep(0.1 - elapsed)
    
    return response
```

**Benefits**:
- User exists check: same time
- Invalid password: same time
- Prevents user enumeration

---

## Content Security Policy (CSP)

### Configuration

```python
CONTENT_SECURITY_POLICY = {
    'DIRECTIVES': {
        'default-src': ("'self'",),
        'script-src': ("'self'", "'unsafe-inline'"),  # Consider removing unsafe-inline
        'style-src': ("'self'", "'unsafe-inline'"),
        'img-src': ("'self'", 'data:', 'https:'),
        'connect-src': ("'self'", 'http://localhost:3000', 'wss://allthrive.ai'),
        'font-src': ("'self'", 'data:'),
        'frame-ancestors': ("'none'",),  # Prevent clickjacking
        'report-uri': '/api/v1/csp-report/',
    }
}
```

### CSP Violation Reporting

**Endpoint** (`core/views/core_views.py`):
```python
@csrf_exempt
@api_view(['POST'])
def csp_report(request):
    report = request.data
    logger.warning(f'CSP violation: {report}')
    
    # Store in database (optional)
    CSPViolation.objects.create(
        document_uri=report.get('csp-report', {}).get('document-uri'),
        violated_directive=report.get('csp-report', {}).get('violated-directive'),
        blocked_uri=report.get('csp-report', {}).get('blocked-uri')
    )
    
    return Response(status=204)
```

---

## Security Headers

### Middleware Configuration

```python
# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# HTTPS Enforcement (production)
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

### Response Headers

**Typical Response**:
```http
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; ...
```

---

## Audit Logging

### User Audit Log

**Model** (`core/audits/models.py`):
```python
class UserAuditLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = 'login', 'Login'
        LOGOUT = 'logout', 'Logout'
        FAILED_LOGIN = 'failed_login', 'Failed Login'
        PASSWORD_CHANGE = 'password_change', 'Password Change'
        PROFILE_UPDATE = 'profile_update', 'Profile Update'
        OAUTH_LINK = 'oauth_link', 'OAuth Account Linked'
    
    user = ForeignKey(User, on_delete=CASCADE)
    action = CharField(max_length=50, choices=Action.choices)
    ip_address = GenericIPAddressField()
    user_agent = TextField()
    success = BooleanField(default=True)
    details = JSONField(default=dict)
    timestamp = DateTimeField(auto_now_add=True)
```

**Usage**:
```python
UserAuditLog.log_action(
    user=user,
    action=UserAuditLog.Action.LOGIN,
    request=request,
    details={'method': 'oauth', 'provider': 'github'},
    success=True
)
```

---

## Secure Data Handling

### Sensitive Data

**Never log**:
- Passwords (plaintext or hashed)
- JWT tokens
- OAuth access tokens
- API keys
- CSRF tokens

**Safe logging**:
```python
# ❌ NEVER
logger.info(f'User logged in: {user.email}, password: {password}')

# ✅ SAFE
logger.info(f'User logged in: {user.email}, method: oauth')
```

### Environment Variables

**Store secrets in `.env`**:
```bash
SECRET_KEY=...
OPENAI_API_KEY=...
GITHUB_CLIENT_SECRET=...
DATABASE_URL=postgresql://...
```

**Never commit**:
- `.env` files
- `secrets.json`
- Any hardcoded credentials

---

## OAuth Token Storage

### SocialToken Model

**Django Allauth** stores OAuth tokens securely:

```python
from allauth.socialaccount.models import SocialToken

# Retrieve user's GitHub token
social_account = user.socialaccount_set.filter(provider='github').first()
if social_account:
    token = SocialToken.objects.get(account=social_account)
    github_api_call(token.token)
```

**Use Cases**:
- GitHub repository imports
- YouTube video fetching
- Figma file access

**Security**:
- Tokens stored encrypted in database
- Scoped to provider permissions
- Refreshed automatically (if supported)

---

## API Security Best Practices

### 1. Always Use HTTPS

```python
# Production only
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

### 2. Validate Input

```python
from rest_framework import serializers

class ProjectSerializer(serializers.ModelSerializer):
    title = serializers.CharField(max_length=100)
    external_url = serializers.URLField(required=False)
    
    def validate_title(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError('Title too short')
        return value
```

### 3. Sanitize Output

```python
import bleach

def sanitize_html(content):
    allowed_tags = ['p', 'strong', 'em', 'a', 'code', 'pre']
    return bleach.clean(content, tags=allowed_tags, strip=True)
```

### 4. Use Permissions

```python
from rest_framework.permissions import IsAuthenticated

class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        # Only allow users to create their own projects
        serializer.save(user=self.request.user)
```

### 5. Implement Rate Limiting

```python
@ratelimit(key='user', rate='10/h')
def expensive_operation(request):
    pass
```

---

## Incident Response

### Security Breach Checklist

1. **Identify** the breach scope
2. **Contain** by blocking affected accounts/IPs
3. **Rotate** all secrets (API keys, JWT secret, DB passwords)
4. **Notify** affected users
5. **Analyze** logs to determine root cause
6. **Patch** vulnerabilities
7. **Document** incident and response

### Secret Rotation

**JWT Secret Key**:
```bash
# Generate new secret
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Update .env
SECRET_KEY=new_secret_key

# Restart servers (invalidates all JWTs)
docker-compose restart backend celery
```

**Database Password**:
```sql
-- Rotate DB password
ALTER USER allthrive_user WITH PASSWORD 'new_secure_password';
```

**API Keys**:
- Rotate OpenAI, Anthropic keys from provider dashboard
- Update environment variables
- Restart services

---

## Testing Security

### Unit Tests

**Test authentication**:
```python
def test_login_requires_password():
    response = client.post('/api/v1/auth/login/', {
        'email': 'alice@example.com'
    })
    assert response.status_code == 400

def test_invalid_jwt_rejected():
    client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token')
    response = client.get('/api/v1/auth/me/')
    assert response.status_code == 401
```

### Security Audits

**Tools**:
- `bandit` - Python security linter
- `safety` - Check dependencies for vulnerabilities
- `OWASP ZAP` - Penetration testing

**Commands**:
```bash
# Scan code for security issues
bandit -r core/ services/

# Check dependencies
safety check

# Run OWASP ZAP (API scan)
docker run -v $(pwd):/zap/wrk/:rw \
  -t owasp/zap2docker-stable \
  zap-api-scan.py -t http://localhost:8000/api/v1/openapi.json
```

---

## Future Enhancements

### Planned Security Features

1. **Two-Factor Authentication (2FA)**: TOTP via authenticator apps
2. **Magic Links**: Passwordless email login
3. **Session Management Dashboard**: Active sessions, device tracking
4. **API Key Management**: User-generated API keys for third-party apps
5. **Security Notifications**: Email alerts for suspicious activity
6. **OAuth Refresh Tokens**: Refresh expired access tokens automatically
7. **Device Fingerprinting**: Detect anomalous login locations/devices

### Compliance

- **GDPR**: User data export, right to deletion
- **CCPA**: California consumer privacy
- **SOC 2**: Security audit certification (future)

---

**Version**: 1.0  
**Status**: Stable  
**Review Cadence**: Quarterly
