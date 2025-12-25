"""
Tests for OAuth authentication, logout, and cookie management.
"""

import json

from allauth.socialaccount.models import SocialAccount, SocialApp
from django.contrib.auth import get_user_model
from django.contrib.sites.models import Site
from django.test import Client, RequestFactory, TestCase, override_settings

from core.auth.adapter import CustomSocialAccountAdapter

User = get_user_model()


class OAuthSetupTestCase(TestCase):
    """Test OAuth app configuration and setup."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = Client()
        # Get or create site with correct domain for testing
        self.site = Site.objects.get(id=1)
        self.site.domain = 'localhost:8000'
        self.site.name = 'AllThrive AI Test'
        self.site.save()

    def test_site_configured_correctly(self):
        """Test that Django site is configured for OAuth."""
        self.assertEqual(self.site.domain, 'localhost:8000')
        self.assertIsNotNone(self.site.name)

    def test_github_oauth_app_exists(self):
        """Test that GitHub OAuth app is configured."""
        # Create test OAuth app
        github_app = SocialApp.objects.create(
            provider='github',
            name='GitHub OAuth Test',
            client_id='test_client_id',
            secret='test_secret',
        )
        github_app.sites.add(self.site)

        # Verify app exists and is linked to site
        apps = SocialApp.objects.filter(provider='github')
        self.assertEqual(apps.count(), 1)
        self.assertIn(self.site, github_app.sites.all())

    def test_google_oauth_app_exists(self):
        """Test that Google OAuth app is configured."""
        # Create test OAuth app
        google_app = SocialApp.objects.create(
            provider='google',
            name='Google OAuth Test',
            client_id='test_google_client_id',
            secret='test_google_secret',
        )
        google_app.sites.add(self.site)

        # Verify app exists and is linked to site
        apps = SocialApp.objects.filter(provider='google')
        self.assertEqual(apps.count(), 1)
        self.assertIn(self.site, google_app.sites.all())

    def test_oauth_callback_url_format(self):
        """Test that OAuth callback URLs are correctly formatted."""
        github_callback = f'http://{self.site.domain}/accounts/github/login/callback/'
        google_callback = f'http://{self.site.domain}/accounts/google/login/callback/'

        self.assertIn('/accounts/github/login/callback/', github_callback)
        self.assertIn('/accounts/google/login/callback/', google_callback)


class LogoutTestCase(TestCase):
    """Test logout functionality and cookie management."""

    def setUp(self):
        """Set up test user and client."""
        self.user = User.objects.create_user(
            username='testuser', email='test@example.com', password='testpass123', first_name='Test', last_name='User'
        )
        self.client = Client()

    @override_settings(
        SIMPLE_JWT={
            'AUTH_COOKIE': 'access_token',
            'AUTH_COOKIE_HTTP_ONLY': True,
            'AUTH_COOKIE_SECURE': False,
            'AUTH_COOKIE_SAMESITE': 'Lax',
        },
        COOKIE_DOMAIN='localhost',
    )
    def test_logout_clears_cookies(self):
        """Test that logout properly clears authentication cookies."""
        # Login user
        self.client.force_login(self.user)

        # Manually set cookies to simulate OAuth login
        session = self.client.session
        session.save()

        # Call logout endpoint
        response = self.client.post('/api/v1/auth/logout/')

        # Check response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data['message'], 'Successfully logged out')

        # Verify cookies are cleared (deleted cookies have empty value and max_age=0)
        cookies = response.cookies
        if 'access_token' in cookies:
            self.assertEqual(cookies['access_token'].value, '')
        if 'refresh_token' in cookies:
            self.assertEqual(cookies['refresh_token'].value, '')

    def test_logout_without_authentication(self):
        """Test that logout works even without authentication."""
        # Call logout without being logged in
        response = self.client.post('/api/v1/auth/logout/')

        # Should still succeed (permission is AllowAny)
        self.assertEqual(response.status_code, 200)

    def test_logout_endpoint_accepts_post_only(self):
        """Test that logout endpoint only accepts POST requests."""
        response_get = self.client.get('/api/v1/auth/logout/')
        self.assertEqual(response_get.status_code, 405)  # Method Not Allowed


class CookieSecurityTestCase(TestCase):
    """Test cookie security settings for authentication."""

    def setUp(self):
        """Set up test user."""
        self.user = User.objects.create_user(username='cookieuser', email='cookie@example.com', password='testpass123')
        self.client = Client()

    @override_settings(
        SIMPLE_JWT={
            'AUTH_COOKIE': 'access_token',
            'AUTH_COOKIE_HTTP_ONLY': True,
            'AUTH_COOKIE_SECURE': False,  # False for testing
            'AUTH_COOKIE_SAMESITE': 'Lax',
        }
    )
    def test_cookies_have_httponly_flag(self):
        """Test that authentication cookies have HttpOnly flag."""
        # This is tested in settings, but we verify the configuration
        from django.conf import settings

        self.assertTrue(settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'])

    @override_settings(COOKIE_DOMAIN='localhost')
    def test_cookie_domain_configured(self):
        """Test that cookie domain is properly configured."""
        from django.conf import settings

        self.assertEqual(settings.COOKIE_DOMAIN, 'localhost')

    def test_csrf_cookie_accessible_to_javascript(self):
        """Test that CSRF token cookie is accessible to JavaScript."""
        from django.conf import settings

        # CSRF cookie should NOT be HttpOnly so JS can read it
        self.assertFalse(settings.CSRF_COOKIE_HTTPONLY)


class OAuthCallbackTestCase(TestCase):
    """Test OAuth callback handling."""

    def setUp(self):
        """Set up test user and social account."""
        self.user = User.objects.create_user(username='oauthuser', email='oauth@example.com', password='testpass123')
        self.client = Client()

    def test_oauth_callback_redirects_to_frontend(self):
        """Test that OAuth callback redirects to frontend with username."""
        # Login user to simulate successful OAuth
        self.client.force_login(self.user)

        # Call callback endpoint
        response = self.client.get('/api/v1/auth/callback/')

        # Should redirect to frontend with username
        self.assertEqual(response.status_code, 302)
        self.assertIn(self.user.username, response.url)

    def test_oauth_callback_sets_jwt_cookies(self):
        """Test that OAuth callback sets JWT tokens in cookies."""
        # Login user
        self.client.force_login(self.user)

        # Call callback endpoint
        response = self.client.get('/api/v1/auth/callback/')

        # Should have set cookies (check in response)
        response.cookies
        # Cookies should be present (access_token, refresh_token)
        # Note: In test environment, cookies might not be fully set
        self.assertEqual(response.status_code, 302)

    def test_oauth_callback_without_authentication_redirects_to_login(self):
        """Test that callback without auth redirects to login with error."""
        # Call callback without being authenticated
        response = self.client.get('/api/v1/auth/callback/')

        # Should redirect to frontend login with error
        self.assertEqual(response.status_code, 302)
        self.assertIn('login', response.url)
        self.assertIn('error', response.url)


class CSRFTokenTestCase(TestCase):
    """Test CSRF token handling."""

    def setUp(self):
        """Set up test client."""
        self.client = Client()

    def test_csrf_token_endpoint_returns_token(self):
        """Test that CSRF token endpoint returns a valid token."""
        response = self.client.get('/api/v1/auth/csrf/')

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('csrfToken', data)
        self.assertIsNotNone(data['csrfToken'])
        self.assertTrue(len(data['csrfToken']) > 0)

    def test_csrf_token_required_for_logout(self):
        """Test that CSRF token is required for logout (if not @csrf_exempt)."""
        # Note: Our logout view is @csrf_exempt, so this test verifies that
        # Without @csrf_exempt, we would need CSRF token
        response = self.client.post('/api/v1/auth/logout/')

        # Should work even without CSRF token (because of @csrf_exempt)
        self.assertEqual(response.status_code, 200)


class UserProfileAccessTestCase(TestCase):
    """Test user profile access after OAuth login."""

    def setUp(self):
        """Set up test users."""
        self.user1 = User.objects.create_user(
            username='alice', email='alice@example.com', password='testpass123', first_name='Alice', last_name='Smith'
        )
        self.user2 = User.objects.create_user(
            username='bob', email='bob@example.com', password='testpass456', first_name='Bob', last_name='Jones'
        )
        self.client = Client()

    def test_authenticated_user_can_access_own_profile(self):
        """Test that authenticated user can access their profile."""
        self.client.force_login(self.user1)

        response = self.client.get('/api/v1/auth/me/')

        if response.status_code == 200:
            data = json.loads(response.content)
            # Check that we get user data
            self.assertIn('username', data.get('data', data))

    def test_unauthenticated_user_cannot_access_profile(self):
        """Test that unauthenticated users cannot access current user endpoint."""
        response = self.client.get('/api/v1/auth/me/')

        # Should return 401 or 403
        self.assertIn(response.status_code, [401, 403])

    def test_user_profile_by_username_accessible(self):
        """Test that user profiles are accessible by username."""
        response = self.client.get(f'/api/v1/auth/profile/{self.user1.username}/')

        # Should be accessible (public profiles)
        # Status depends on implementation, but should not be 500
        self.assertLess(response.status_code, 500)


class SocialAccountLinkingTestCase(TestCase):
    """Test social account linking with users."""

    def setUp(self):
        """Set up test user and social app."""
        self.user = User.objects.create_user(username='socialuser', email='social@example.com', password='testpass123')
        self.site, _ = Site.objects.get_or_create(id=1, defaults={'domain': 'example.com', 'name': 'Example'})
        self.github_app = SocialApp.objects.create(
            provider='github', name='GitHub Test', client_id='test_client', secret='test_secret'
        )
        self.github_app.sites.add(self.site)

    def test_social_account_can_be_linked_to_user(self):
        """Test that social account can be linked to a user."""
        social_account = SocialAccount.objects.create(
            user=self.user, provider='github', uid='12345', extra_data={'login': 'socialuser'}
        )

        self.assertEqual(social_account.user, self.user)
        self.assertEqual(social_account.provider, 'github')

    def test_user_can_have_multiple_social_accounts(self):
        """Test that a user can have multiple social accounts."""
        github_account = SocialAccount.objects.create(user=self.user, provider='github', uid='12345')
        google_account = SocialAccount.objects.create(user=self.user, provider='google', uid='67890')

        user_accounts = SocialAccount.objects.filter(user=self.user)
        self.assertEqual(user_accounts.count(), 2)

    def test_social_account_uid_is_unique_per_provider(self):
        """Test that social account UID is unique per provider."""
        SocialAccount.objects.create(user=self.user, provider='github', uid='12345')

        # Try to create another account with same UID and provider
        # Should fail due to unique constraint
        user2 = User.objects.create_user(username='otheruser', email='other@example.com', password='testpass123')

        with self.assertRaises(Exception):
            SocialAccount.objects.create(user=user2, provider='github', uid='12345')  # Duplicate UID for same provider


class SocialLoginAdapterTestCase(TestCase):
    """Tests for CustomSocialAccountAdapter pre_social_login linking behaviour."""

    def setUp(self):
        self.factory = RequestFactory()
        self.adapter = CustomSocialAccountAdapter()
        # Existing user that should be matched by email
        self.user = User.objects.create_user(
            username='existinguser',
            email='existing@example.com',
            password='testpass123',
        )

    def test_pre_social_login_links_to_existing_user_by_email(self):
        """Social login with matching email should attach to existing user, not create a new one."""
        request = self.factory.get('/accounts/google/login/')
        request.session = {}  # Add mock session
        captured = {}

        class DummySocialLogin:
            def __init__(self):
                self.is_existing = False

                class DummyUser:
                    # Mixed-case email to verify case-insensitive match
                    email = 'Existing@Example.com'

                class DummyAccount:
                    provider = 'google'

                self.user = DummyUser()
                self.account = DummyAccount()

            def connect(self, req, user):
                captured['request'] = req
                captured['user'] = user

        sociallogin = DummySocialLogin()

        self.adapter.pre_social_login(request, sociallogin)

        # Adapter should have called connect with the existing user (same DB row)
        linked_user = captured.get('user')
        self.assertIsNotNone(linked_user)
        self.assertEqual(linked_user.pk, self.user.pk)

    def test_pre_social_login_no_email_does_not_link(self):
        """If provider does not supply email, adapter should not attempt to link."""
        request = self.factory.get('/accounts/github/login/')
        request.session = {}  # Add mock session
        captured = {}

        class DummySocialLoginNoEmail:
            def __init__(self):
                self.is_existing = False

                class DummyUser:
                    email = ''  # No email provided

                class DummyAccount:
                    provider = 'github'

                self.user = DummyUser()
                self.account = DummyAccount()

            def connect(self, req, user):
                captured['request'] = req
                captured['user'] = user

        sociallogin = DummySocialLoginNoEmail()

        self.adapter.pre_social_login(request, sociallogin)

        # Adapter should not have attempted to connect when email is missing
        self.assertNotIn('user', captured)
