# OAuth and Authentication Testing

## Overview

Comprehensive test suite for OAuth authentication, logout functionality, and cookie management.

## Test Files

1. **`core/tests/test_oauth_auth.py`** - OAuth and authentication tests
2. **`core/tests/test_user_username.py`** - Username and user profile tests (existing)

## Running Tests

### Run All Tests

```bash
# In Docker
docker exec allthriveai_web_1 python manage.py test

# Or with coverage
docker exec allthriveai_web_1 coverage run --source='.' manage.py test
docker exec allthriveai_web_1 coverage report
```

### Run Specific Test Files

```bash
# Run OAuth tests only
docker exec allthriveai_web_1 python manage.py test core.tests.test_oauth_auth

# Run username tests only
docker exec allthriveai_web_1 python manage.py test core.tests.test_user_username
```

### Run Specific Test Cases

```bash
# Run logout tests
docker exec allthriveai_web_1 python manage.py test core.tests.test_oauth_auth.LogoutTestCase

# Run OAuth setup tests
docker exec allthriveai_web_1 python manage.py test core.tests.test_oauth_auth.OAuthSetupTestCase

# Run cookie security tests
docker exec allthriveai_web_1 python manage.py test core.tests.test_oauth_auth.CookieSecurityTestCase
```

### Run Individual Tests

```bash
# Run a single test
docker exec allthriveai_web_1 python manage.py test core.tests.test_oauth_auth.LogoutTestCase.test_logout_clears_cookies
```

## Test Coverage

### OAuth Setup Tests (`OAuthSetupTestCase`)

- ✅ Site configuration for OAuth
- ✅ GitHub OAuth app exists and is configured
- ✅ Google OAuth app exists and is configured
- ✅ OAuth callback URL format validation

### Logout Tests (`LogoutTestCase`)

- ✅ Logout clears authentication cookies
- ✅ Logout works without authentication
- ✅ Logout endpoint only accepts POST requests

### Cookie Security Tests (`CookieSecurityTestCase`)

- ✅ Authentication cookies have HttpOnly flag
- ✅ Cookie domain is properly configured
- ✅ CSRF token cookie is accessible to JavaScript

### OAuth Callback Tests (`OAuthCallbackTestCase`)

- ✅ OAuth callback redirects to frontend with username
- ✅ OAuth callback sets JWT tokens in cookies
- ✅ OAuth callback without authentication redirects to login with error

### CSRF Token Tests (`CSRFTokenTestCase`)

- ✅ CSRF token endpoint returns valid token
- ✅ Logout endpoint handles CSRF token correctly

### User Profile Tests (`UserProfileAccessTestCase`)

- ✅ Authenticated user can access own profile
- ✅ Unauthenticated user cannot access profile endpoint
- ✅ User profiles accessible by username

### Social Account Tests (`SocialAccountLinkingTestCase`)

- ✅ Social account can be linked to user
- ✅ User can have multiple social accounts
- ✅ Social account UID is unique per provider

## Expected Test Results

All tests should pass:
```
Ran 20 tests in X.XXXs

OK
```

## Troubleshooting

### Tests Fail Due to Missing Database

```bash
# Run migrations in test database
docker exec allthriveai_web_1 python manage.py migrate --run-syncdb
```

### Tests Fail Due to Missing OAuth Apps

The tests create their own OAuth apps for testing. If tests fail, check:
- Site configuration: `Site.objects.get(id=1)`
- Django settings: `SITE_ID = 1`

### CSRF Token Tests Fail

Verify CSRF settings:
```python
CSRF_COOKIE_HTTPONLY = False  # Must be False for JS access
CSRF_COOKIE_SAMESITE = 'Lax'
```

### Cookie Tests Fail

Check cookie settings in `config/settings.py`:
```python
COOKIE_DOMAIN = 'localhost'
SIMPLE_JWT = {
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'Lax',
}
```

## Test Database

Django automatically creates a test database for running tests. The test database is isolated from your development database.

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# Example: GitLab CI
test:
  script:
    - docker-compose up -d
    - docker exec allthriveai_web_1 python manage.py test
    - docker exec allthriveai_web_1 coverage report
```

## Coverage Report

Generate a detailed coverage report:

```bash
# Install coverage if not already installed
docker exec allthriveai_web_1 pip install coverage

# Run tests with coverage
docker exec allthriveai_web_1 coverage run --source='core,services' manage.py test

# Generate HTML report
docker exec allthriveai_web_1 coverage html

# View report (generated in htmlcov/)
open htmlcov/index.html
```

## Writing New Tests

### Test Structure

```python
from django.test import TestCase, Client
from django.contrib.auth import get_user_model

User = get_user_model()

class MyTestCase(TestCase):
    """Description of what this test case covers."""
    
    def setUp(self):
        """Set up test fixtures before each test."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client = Client()
    
    def test_something(self):
        """Test that something works correctly."""
        # Arrange
        self.client.force_login(self.user)
        
        # Act
        response = self.client.get('/api/v1/some-endpoint/')
        
        # Assert
        self.assertEqual(response.status_code, 200)
```

### Best Practices

✅ **DO**:
- Use descriptive test names (`test_logout_clears_cookies`)
- Test one thing per test method
- Use `setUp()` for common test fixtures
- Use `tearDown()` for cleanup if needed
- Test both success and failure cases

❌ **DON'T**:
- Test multiple unrelated things in one test
- Rely on test execution order
- Use production database for tests
- Leave test data in the database

## Related Documentation

- [OAUTH_QUICKSTART.md](./OAUTH_QUICKSTART.md) - OAuth setup guide
- [LOGOUT_FIX.md](./LOGOUT_FIX.md) - Logout implementation details
- [OAUTH_FIX_SUMMARY.md](./OAUTH_FIX_SUMMARY.md) - OAuth configuration fix

## Status

✅ **Complete** - Comprehensive test suite for OAuth authentication and logout functionality.
