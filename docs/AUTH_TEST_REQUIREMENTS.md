# Authentication Test Requirements

**Date**: 2025-11-22
**Related**: AUTH_REORGANIZATION.md, AUTH_REVIEW_FIXES.md

---

## Overview

This document outlines the test requirements for the authentication refactor. Tests need to be **added** for new services and **updated** for existing functionality that changed.

---

## Test Coverage Analysis

### ✅ Existing Tests (Still Valid)

These tests remain valid and should continue to pass:

#### `core/auth/tests/test_oauth_auth.py`
- ✅ OAuth app configuration
- ✅ Logout cookie clearing
- ✅ CSRF token handling
- ✅ Social account linking
- **Action**: Run and verify still passing

#### `core/auth/tests/test_profile_update.py`
- ✅ Username update validation
- ✅ Profile field updates
- **Action**: Run and verify still passing

---

### ⚠️ Tests That Need Updates

#### 1. `test_oauth_auth.py::OAuthCallbackTestCase`

**Current Issue**: Tests OAuth callback but doesn't verify new centralized token service.

**Update Required**:
```python
def test_oauth_callback_uses_centralized_token_service(self):
    """Test that OAuth callback uses set_auth_cookies from services.auth"""
    from unittest.mock import patch

    with patch('services.auth.tokens.set_auth_cookies') as mock_set_cookies:
        self.client.force_login(self.user)
        response = self.client.get('/api/v1/auth/callback/')

        # Verify centralized service was called
        mock_set_cookies.assert_called_once()
        self.assertEqual(response.status_code, 302)
```

#### 2. `test_oauth_auth.py::LogoutTestCase`

**Current Issue**: Tests logout but doesn't verify new `clear_auth_cookies` service.

**Update Required**:
```python
def test_logout_uses_centralized_clear_service(self):
    """Test that logout uses clear_auth_cookies from services.auth"""
    from unittest.mock import patch

    with patch('services.auth.tokens.clear_auth_cookies') as mock_clear:
        response = self.client.post('/api/v1/auth/logout/')

        # Verify centralized service was called
        mock_clear.assert_called_once()
        self.assertEqual(response.status_code, 200)
```

---

## 🆕 New Tests Required

### Priority 1: Critical Services (Must Have)

#### File: `services/auth/tests/test_tokens.py` (NEW)

```python
"""Tests for centralized JWT token management."""

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from rest_framework.response import Response

from services.auth.tokens import clear_auth_cookies, generate_tokens_for_user, set_auth_cookies

User = get_user_model()


@pytest.mark.django_db
class TestTokenGeneration:
    """Test JWT token generation."""

    def test_generate_tokens_returns_access_and_refresh(self):
        """Test that token generation returns both tokens."""
        user = User.objects.create_user(username='test', email='test@example.com', password='pass')
        tokens = generate_tokens_for_user(user)

        assert 'access' in tokens
        assert 'refresh' in tokens
        assert len(tokens['access']) > 0
        assert len(tokens['refresh']) > 0

    def test_tokens_are_strings(self):
        """Test that tokens are returned as strings."""
        user = User.objects.create_user(username='test', email='test@example.com', password='pass')
        tokens = generate_tokens_for_user(user)

        assert isinstance(tokens['access'], str)
        assert isinstance(tokens['refresh'], str)


@pytest.mark.django_db
class TestSetAuthCookies:
    """Test setting authentication cookies."""

    def test_set_auth_cookies_adds_access_token(self):
        """Test that access token cookie is set."""
        user = User.objects.create_user(username='test', email='test@example.com', password='pass')
        response = Response({'success': True})

        result = set_auth_cookies(response, user)

        # Check cookies are set
        assert settings.SIMPLE_JWT['AUTH_COOKIE'] in result.cookies

    def test_set_auth_cookies_adds_refresh_token(self):
        """Test that refresh token cookie is set."""
        user = User.objects.create_user(username='test', email='test@example.com', password='pass')
        response = Response({'success': True})

        result = set_auth_cookies(response, user)

        assert 'refresh_token' in result.cookies

    def test_cookies_have_correct_settings(self):
        """Test that cookies have proper security settings."""
        user = User.objects.create_user(username='test', email='test@example.com', password='pass')
        response = Response({'success': True})

        result = set_auth_cookies(response, user)

        access_cookie = result.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]
        # Verify httponly, secure, samesite based on settings
        assert access_cookie['httponly'] == settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY']

    def test_set_auth_cookies_returns_response(self):
        """Test that the response is returned."""
        user = User.objects.create_user(username='test', email='test@example.com', password='pass')
        response = Response({'success': True})

        result = set_auth_cookies(response, user)

        assert result is response


@pytest.mark.django_db
class TestClearAuthCookies:
    """Test clearing authentication cookies."""

    def test_clear_auth_cookies_deletes_access_token(self):
        """Test that access token is deleted."""
        response = Response({'message': 'Logged out'})
        result = clear_auth_cookies(response)

        # Cookies should be marked for deletion (empty value)
        assert settings.SIMPLE_JWT['AUTH_COOKIE'] in result.cookies

    def test_clear_auth_cookies_deletes_refresh_token(self):
        """Test that refresh token is deleted."""
        response = Response({'message': 'Logged out'})
        result = clear_auth_cookies(response)

        assert 'refresh_token' in result.cookies

    def test_clear_auth_cookies_deletes_csrf(self):
        """Test that CSRF token is deleted."""
        response = Response({'message': 'Logged out'})
        result = clear_auth_cookies(response)

        assert 'csrftoken' in result.cookies
```

---

#### File: `services/auth/tests/test_credentials.py` (NEW)

```python
"""Tests for credential-based authentication service."""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from services.auth import (
    AuthValidationError,
    CredentialAuthService,
    UserCreationError,
    UsernameService,
    ValidationService,
)

User = get_user_model()


@pytest.mark.django_db
class TestValidationService:
    """Test input validation and sanitization."""

    def test_sanitize_input_strips_html_tags(self):
        """Test that HTML tags are stripped."""
        result = ValidationService.sanitize_input('<script>alert("xss")</script>Hello')
        assert '<script>' not in result
        assert 'Hello' in result

    def test_sanitize_input_handles_nested_tags(self):
        """Test double-pass tag stripping."""
        result = ValidationService.sanitize_input('&lt;script&gt;alert("xss")&lt;/script&gt;')
        assert 'script' not in result
        assert 'alert' not in result

    def test_validate_email_normalizes_to_lowercase(self):
        """Test email normalization."""
        result = ValidationService.validate_email('TEST@EXAMPLE.COM')
        assert result == 'test@example.com'

    def test_validate_email_strips_whitespace(self):
        """Test email whitespace removal."""
        result = ValidationService.validate_email('  test@example.com  ')
        assert result == 'test@example.com'

    def test_validate_email_rejects_invalid_format(self):
        """Test invalid email rejection."""
        with pytest.raises(AuthValidationError, match='valid email'):
            ValidationService.validate_email('notanemail')

    def test_validate_email_requires_value(self):
        """Test email is required."""
        with pytest.raises(AuthValidationError, match='required'):
            ValidationService.validate_email('')

    def test_validate_name_sanitizes_input(self):
        """Test name sanitization."""
        first, last = ValidationService.validate_name('<b>John</b>', '<i>Doe</i>')
        assert '<b>' not in first
        assert '<i>' not in last
        assert first == 'John'
        assert last == 'Doe'

    def test_validate_name_requires_both(self):
        """Test both names are required."""
        with pytest.raises(AuthValidationError, match='First name'):
            ValidationService.validate_name('', 'Doe')

        with pytest.raises(AuthValidationError, match='Last name'):
            ValidationService.validate_name('John', '')

    def test_validate_name_enforces_length(self):
        """Test name length limits."""
        with pytest.raises(AuthValidationError, match='too long'):
            ValidationService.validate_name('a' * 51, 'Doe')

    def test_validate_password_requires_8_chars(self):
        """Test password length requirement."""
        with pytest.raises(AuthValidationError, match='8 characters'):
            ValidationService.validate_password('short')

    def test_validate_password_requires_letter(self):
        """Test password requires letter."""
        with pytest.raises(AuthValidationError, match='letter'):
            ValidationService.validate_password('12345678')

    def test_validate_password_requires_number(self):
        """Test password requires number."""
        with pytest.raises(AuthValidationError, match='number'):
            ValidationService.validate_password('abcdefgh')

    def test_validate_password_accepts_valid(self):
        """Test valid password passes."""
        ValidationService.validate_password('password123')  # Should not raise


@pytest.mark.django_db
class TestUsernameService:
    """Test username generation and validation."""

    def test_generate_from_email_uses_prefix(self):
        """Test username generated from email prefix."""
        result = UsernameService.generate_from_email('john.doe@example.com')
        assert result == 'johndoe'

    def test_generate_from_email_removes_special_chars(self):
        """Test special characters removed."""
        result = UsernameService.generate_from_email('john+test@example.com')
        assert result == 'johntest'

    def test_generate_from_email_lowercases(self):
        """Test username is lowercase."""
        result = UsernameService.generate_from_email('JohnDoe@example.com')
        assert result == 'johndoe'

    def test_validate_and_normalize_checks_length(self):
        """Test username length validation."""
        with pytest.raises(AuthValidationError, match='3 characters'):
            UsernameService.validate_and_normalize('ab')

    def test_validate_and_normalize_checks_format(self):
        """Test username format validation."""
        with pytest.raises(AuthValidationError, match='lowercase letters'):
            UsernameService.validate_and_normalize('user name')

    def test_validate_and_normalize_checks_availability(self):
        """Test username uniqueness check."""
        User.objects.create_user(username='taken', email='test@example.com', password='pass')

        with pytest.raises(AuthValidationError, match='already taken'):
            UsernameService.validate_and_normalize('taken')

    def test_generate_unique_handles_conflicts(self):
        """Test unique generation with conflicts."""
        User.objects.create_user(username='john', email='john1@example.com', password='pass')

        result = UsernameService.generate_unique_from_email('john@example.com')
        assert result == 'john1'  # Should increment

    def test_generate_unique_gives_up_after_max_attempts(self):
        """Test max attempts limit."""
        # Create john, john1, john2, ... john99
        for i in range(100):
            name = 'john' if i == 0 else f'john{i}'
            User.objects.create_user(username=name, email=f'{name}@example.com', password='pass')

        with pytest.raises(UserCreationError, match='Could not generate'):
            UsernameService.generate_unique_from_email('john@example.com')


@pytest.mark.django_db
class TestCredentialAuthService:
    """Test user creation and authentication."""

    def test_create_user_success(self):
        """Test successful user creation."""
        user = CredentialAuthService.create_user(
            email='test@example.com',
            password='password123',
            first_name='Test',
            last_name='User'
        )

        assert user.email == 'test@example.com'
        assert user.first_name == 'Test'
        assert user.last_name == 'User'
        assert user.username  # Should be generated

    def test_create_user_with_custom_username(self):
        """Test user creation with custom username."""
        user = CredentialAuthService.create_user(
            email='test@example.com',
            password='password123',
            first_name='Test',
            last_name='User',
            username='custom'
        )

        assert user.username == 'custom'

    def test_create_user_sanitizes_names(self):
        """Test that names are sanitized."""
        user = CredentialAuthService.create_user(
            email='test@example.com',
            password='password123',
            first_name='<script>Test</script>',
            last_name='<b>User</b>'
        )

        assert '<script>' not in user.first_name
        assert '<b>' not in user.last_name

    def test_create_user_prevents_duplicate_email(self):
        """Test duplicate email prevention."""
        CredentialAuthService.create_user(
            email='test@example.com',
            password='password123',
            first_name='First',
            last_name='User'
        )

        with pytest.raises(AuthValidationError, match='already exists'):
            CredentialAuthService.create_user(
                email='test@example.com',
                password='password456',
                first_name='Second',
                last_name='User'
            )

    def test_create_user_race_condition_safe(self):
        """Test concurrent user creation with same email."""
        import threading

        users_created = []
        errors = []

        def create_user():
            try:
                user = CredentialAuthService.create_user(
                    email='race@example.com',
                    password='password123',
                    first_name='Test',
                    last_name='User'
                )
                users_created.append(user)
            except AuthValidationError as e:
                errors.append(e)

        # Create 5 threads trying to create same user
        threads = [threading.Thread(target=create_user) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Only one should succeed
        assert len(users_created) == 1
        assert len(errors) == 4

    def test_authenticate_user_success(self):
        """Test successful authentication."""
        CredentialAuthService.create_user(
            email='test@example.com',
            password='password123',
            first_name='Test',
            last_name='User'
        )

        user = CredentialAuthService.authenticate_user('test@example.com', 'password123')
        assert user.email == 'test@example.com'

    def test_authenticate_user_wrong_password(self):
        """Test authentication with wrong password."""
        from services.auth import AuthenticationFailed

        CredentialAuthService.create_user(
            email='test@example.com',
            password='password123',
            first_name='Test',
            last_name='User'
        )

        with pytest.raises(AuthenticationFailed, match='Invalid'):
            CredentialAuthService.authenticate_user('test@example.com', 'wrongpass')

    def test_authenticate_user_nonexistent(self):
        """Test authentication with nonexistent user."""
        from services.auth import AuthenticationFailed

        with pytest.raises(AuthenticationFailed):
            CredentialAuthService.authenticate_user('nonexistent@example.com', 'password123')
```

---

#### File: `services/auth/tests/test_chat_service.py` (NEW)

```python
"""Tests for chat-based authentication service."""

import pytest
from django.contrib.auth import get_user_model
from unittest.mock import MagicMock, patch

from services.auth import AuthValidationError, AuthenticationFailed, SessionError
from services.auth.chat import ChatAuthService

User = get_user_model()


@pytest.mark.django_db
class TestChatAuthService:
    """Test chat authentication service."""

    @patch('services.auth.chat.service.auth_graph')
    def test_get_session_state_returns_dict(self, mock_graph):
        """Test session state retrieval."""
        mock_graph.get_state.return_value.values = {'step': 'welcome', 'email': None}

        state = ChatAuthService.get_session_state('test-session')

        assert isinstance(state, dict)
        mock_graph.get_state.assert_called_once()

    @patch('services.auth.chat.service.auth_graph')
    def test_update_session_state_calls_graph(self, mock_graph):
        """Test session state update."""
        mock_graph.update_state.return_value.values = {'step': 'email'}

        ChatAuthService.update_session_state('test-session', {'step': 'email'})

        mock_graph.update_state.assert_called_once()

    @patch('services.auth.chat.service.auth_graph')
    def test_finalize_signup_creates_user(self, mock_graph):
        """Test signup finalization creates user."""
        mock_graph.get_state.return_value.values = {
            'mode': 'signup',
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'username': 'testuser',
            'password_validated': True
        }

        user = ChatAuthService.finalize_signup('test-session', 'password123')

        assert user.email == 'test@example.com'
        assert user.username == 'testuser'

    @patch('services.auth.chat.service.auth_graph')
    def test_finalize_signup_requires_password_validated(self, mock_graph):
        """Test signup requires password validation."""
        mock_graph.get_state.return_value.values = {
            'mode': 'signup',
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'password_validated': False  # Not validated!
        }

        with pytest.raises(SessionError, match='not validated'):
            ChatAuthService.finalize_signup('test-session', 'password123')

    @patch('services.auth.chat.service.auth_graph')
    def test_finalize_login_authenticates_user(self, mock_graph):
        """Test login finalization."""
        # Create existing user
        User.objects.create_user(
            username='existing',
            email='test@example.com',
            password='password123'
        )

        mock_graph.get_state.return_value.values = {
            'mode': 'login',
            'email': 'test@example.com',
            'password_validated': True
        }

        user = ChatAuthService.finalize_login('test-session', 'password123')

        assert user.email == 'test@example.com'

    @patch('services.auth.chat.service.auth_graph')
    def test_finalize_session_routes_to_login(self, mock_graph):
        """Test finalize routes to login for login mode."""
        User.objects.create_user(
            username='existing',
            email='test@example.com',
            password='password123'
        )

        mock_graph.get_state.return_value.values = {
            'mode': 'login',
            'email': 'test@example.com',
            'password_validated': True
        }

        user = ChatAuthService.finalize_session('test-session', 'password123')

        assert user.email == 'test@example.com'

    @patch('services.auth.chat.service.auth_graph')
    def test_finalize_session_routes_to_signup(self, mock_graph):
        """Test finalize routes to signup for signup mode."""
        mock_graph.get_state.return_value.values = {
            'mode': 'signup',
            'email': 'new@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'username': 'newuser',
            'password_validated': True
        }

        user = ChatAuthService.finalize_session('test-session', 'password123')

        assert user.email == 'new@example.com'
```

---

### Priority 2: Integration Tests (Should Have)

#### File: `core/auth/tests/test_auth_integration.py` (NEW)

```python
"""Integration tests for complete authentication flows."""

import pytest
from django.core.cache import cache
from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestCacheBasedPasswordFlow:
    """Test password caching with TTL."""

    def test_password_stored_in_cache_with_ttl(self):
        """Test password is cached with expiry."""
        session_id = 'test-session'
        password = 'testpass123'

        # Store password
        cache.set(f'auth_password_{session_id}', password, timeout=300)

        # Retrieve immediately
        cached = cache.get(f'auth_password_{session_id}')
        assert cached == password

    def test_password_cleared_after_ttl(self):
        """Test password expires after TTL."""
        import time

        session_id = 'test-session'
        password = 'testpass123'

        # Store with 1 second TTL
        cache.set(f'auth_password_{session_id}', password, timeout=1)

        # Wait for expiry
        time.sleep(2)

        # Should be None
        cached = cache.get(f'auth_password_{session_id}')
        assert cached is None

    def test_password_cleanup_on_success(self):
        """Test password is cleared after successful use."""
        session_id = 'test-session'
        password = 'testpass123'

        cache.set(f'auth_password_{session_id}', password, timeout=300)

        # Clean up
        cache.delete(f'auth_password_{session_id}')

        # Should be gone
        cached = cache.get(f'auth_password_{session_id}')
        assert cached is None


@pytest.mark.django_db
class TestCompleteAuthFlows:
    """Test complete authentication workflows."""

    def test_oauth_flow_sets_cookies(self):
        """Test OAuth flow from start to finish."""
        client = Client()
        user = User.objects.create_user(
            username='oauthuser',
            email='oauth@example.com',
            password='testpass123'
        )

        # Simulate OAuth login
        client.force_login(user)

        # Call callback
        response = client.get('/api/v1/auth/callback/')

        # Should set cookies and redirect
        assert response.status_code == 302
        assert user.username in response.url

    def test_logout_clears_all_cookies(self):
        """Test logout clears all auth cookies."""
        client = Client()
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        client.force_login(user)

        # Logout
        response = client.post('/api/v1/auth/logout/')

        # Should clear cookies
        assert response.status_code == 200
        # Cookies should be deleted (empty value)
        for cookie_name in ['access_token', 'refresh_token', 'csrftoken']:
            if cookie_name in response.cookies:
                assert response.cookies[cookie_name].value == ''
```

---

### Priority 3: Edge Cases & Error Scenarios (Nice to Have)

#### File: `services/auth/tests/test_edge_cases.py` (NEW)

```python
"""Test edge cases and error scenarios."""

import pytest
from services.auth import AuthValidationError, ValidationService


class TestXSSPrevention:
    """Test XSS attack prevention."""

    def test_script_tag_stripped(self):
        """Test script tags are removed."""
        result = ValidationService.sanitize_input('<script>alert("xss")</script>')
        assert 'script' not in result.lower()

    def test_img_tag_with_onerror_stripped(self):
        """Test malicious img tags stripped."""
        result = ValidationService.sanitize_input('<img src=x onerror="alert(1)">')
        assert 'onerror' not in result

    def test_encoded_script_tag_stripped(self):
        """Test encoded tags are unescaped then stripped."""
        result = ValidationService.sanitize_input('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
        assert 'script' not in result.lower()
        assert 'alert' not in result.lower()

    def test_nested_tags_stripped(self):
        """Test deeply nested tags."""
        result = ValidationService.sanitize_input('<div><p><span><script>bad</script></span></p></div>Good')
        assert 'Good' in result
        assert 'script' not in result
        assert 'div' not in result


class TestConcurrencyEdgeCases:
    """Test concurrent operation handling."""

    @pytest.mark.django_db
    def test_concurrent_username_generation(self):
        """Test username generation under concurrent load."""
        from services.auth import CredentialAuthService
        import threading

        users = []
        errors = []

        def create_user(index):
            try:
                user = CredentialAuthService.create_user(
                    email=f'user{index}@example.com',
                    password='password123',
                    first_name='Test',
                    last_name=f'User{index}'
                )
                users.append(user)
            except Exception as e:
                errors.append(e)

        # Create 10 users concurrently
        threads = [threading.Thread(target=create_user, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All should succeed with unique usernames
        assert len(users) == 10
        assert len(errors) == 0

        usernames = [u.username for u in users]
        assert len(usernames) == len(set(usernames))  # All unique
```

---

## Test Execution Plan

### Phase 1: Run Existing Tests
```bash
# Verify existing tests still pass
python manage.py test core.auth.tests.test_oauth_auth
python manage.py test core.auth.tests.test_profile_update
```

**Expected**: All existing tests should pass without modification.

---

### Phase 2: Add Critical Service Tests
```bash
# Create and run new service tests
python manage.py test services.auth.tests.test_tokens
python manage.py test services.auth.tests.test_credentials
python manage.py test services.auth.tests.test_chat_service
```

**Priority**: HIGH - These test the core refactored functionality.

---

### Phase 3: Add Integration Tests
```bash
python manage.py test core.auth.tests.test_auth_integration
```

**Priority**: MEDIUM - These verify end-to-end flows.

---

### Phase 4: Add Edge Case Tests
```bash
python manage.py test services.auth.tests.test_edge_cases
```

**Priority**: LOW - Nice to have for production confidence.

---

## Test Coverage Goals

### Minimum Acceptable Coverage
- **Services**: 80% line coverage
- **Views**: 70% line coverage (integration tests)
- **Critical paths**: 100% (password handling, token generation)

### Ideal Coverage
- **Services**: 90%+ line coverage
- **Views**: 85%+ line coverage
- **All exception paths tested**

---

## Test Fixtures & Utilities

### Shared Fixtures

Create `services/auth/tests/conftest.py`:

```python
"""Shared test fixtures for auth tests."""

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def user():
    """Create a test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User'
    )


@pytest.fixture
def api_client():
    """Create an API client."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, user):
    """Create an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def mock_auth_graph():
    """Mock LangGraph for chat auth tests."""
    from unittest.mock import MagicMock
    return MagicMock()
```

---

## Continuous Testing

### Pre-commit Hook
Add to `.pre-commit-config.yaml`:
```yaml
- repo: local
  hooks:
    - id: run-auth-tests
      name: Run auth tests
      entry: python manage.py test services.auth.tests core.auth.tests
      language: system
      pass_filenames: false
```

### CI/CD Pipeline
Add to `.gitlab-ci.yml` or GitHub Actions:
```yaml
test-auth:
  script:
    - python manage.py test services.auth.tests --keepdb
    - python manage.py test core.auth.tests --keepdb
  coverage: '/TOTAL.*\s+(\d+%)$/'
```

---

## Summary

### Tests to Add
- ✅ 6 new test files
- ✅ ~40 new test methods
- ✅ Coverage for all new services

### Tests to Update
- ⚠️ 2 existing test classes need mock verification

### Estimated Effort
- **Writing tests**: 6-8 hours
- **Debugging/fixing**: 2-3 hours
- **Total**: 8-11 hours

### Priority Order
1. **Critical** (4 hours): Service tests (tokens, credentials, chat)
2. **Important** (2 hours): Integration tests
3. **Nice to have** (2 hours): Edge cases, concurrency tests

---

## Next Steps

1. Create `services/auth/tests/` directory
2. Implement Priority 1 tests (tokens, credentials, chat)
3. Run existing tests to verify no regressions
4. Implement Priority 2 integration tests
5. Achieve 80%+ coverage on services
6. Add to CI/CD pipeline

**Ready to implement these tests for production deployment.**
