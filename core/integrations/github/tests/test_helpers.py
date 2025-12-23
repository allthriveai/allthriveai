"""
Unit tests for GitHub integration helper functions.

CRITICAL: These tests ensure the GitHub token refresh and URL parsing work correctly.
Token refresh is essential for GitHub App OAuth flow where tokens expire after 8 hours.

Run with: pytest core/integrations/github/tests/test_helpers.py -v
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone

from core.integrations.github.helpers import (
    _refresh_github_token,
    get_user_github_token,
    parse_github_url,
)


class ParseGitHubURLTest(TestCase):
    """Tests for parse_github_url function."""

    def test_parse_https_url(self):
        """Test parsing standard HTTPS GitHub URLs."""
        owner, repo = parse_github_url('https://github.com/AllieRays/allthriveai')
        self.assertEqual(owner, 'AllieRays')
        self.assertEqual(repo, 'allthriveai')

    def test_parse_https_url_with_trailing_slash(self):
        """Test parsing URL with trailing slash."""
        owner, repo = parse_github_url('https://github.com/AllieRays/allthriveai/')
        self.assertEqual(owner, 'AllieRays')
        self.assertEqual(repo, 'allthriveai')

    def test_parse_git_url(self):
        """Test parsing git@ style URLs."""
        owner, repo = parse_github_url('git@github.com:AllieRays/allthriveai.git')
        self.assertEqual(owner, 'AllieRays')
        self.assertEqual(repo, 'allthriveai')

    def test_parse_url_with_git_extension(self):
        """Test parsing URL with .git extension."""
        owner, repo = parse_github_url('https://github.com/user/repo.git')
        self.assertEqual(owner, 'user')
        self.assertEqual(repo, 'repo')

    def test_parse_url_with_dots_in_repo_name(self):
        """Test parsing URL with dots in repository name (e.g., next.js)."""
        owner, repo = parse_github_url('https://github.com/vercel/next.js')
        self.assertEqual(owner, 'vercel')
        self.assertEqual(repo, 'next.js')

    def test_parse_url_with_hyphens(self):
        """Test parsing URL with hyphens in owner and repo names."""
        owner, repo = parse_github_url('https://github.com/some-user/my-awesome-repo')
        self.assertEqual(owner, 'some-user')
        self.assertEqual(repo, 'my-awesome-repo')

    def test_parse_url_with_underscores(self):
        """Test parsing URL with underscores in repo name."""
        owner, repo = parse_github_url('https://github.com/user/my_repo_name')
        self.assertEqual(owner, 'user')
        self.assertEqual(repo, 'my_repo_name')

    def test_invalid_url_gitlab_raises_error(self):
        """Test that GitLab URLs raise ValueError."""
        with self.assertRaises(ValueError) as context:
            parse_github_url('https://gitlab.com/user/repo')
        self.assertIn('Invalid GitHub URL', str(context.exception))

    def test_invalid_url_bitbucket_raises_error(self):
        """Test that Bitbucket URLs raise ValueError."""
        with self.assertRaises(ValueError):
            parse_github_url('https://bitbucket.org/user/repo')

    def test_invalid_url_not_a_url_raises_error(self):
        """Test that non-URL strings raise ValueError."""
        with self.assertRaises(ValueError):
            parse_github_url('not-a-url')

    def test_invalid_url_empty_string_raises_error(self):
        """Test that empty string raises ValueError."""
        with self.assertRaises(ValueError):
            parse_github_url('')

    def test_invalid_url_github_without_repo_raises_error(self):
        """Test that GitHub URL without repo raises ValueError."""
        with self.assertRaises(ValueError):
            parse_github_url('https://github.com/user')

    def test_parse_url_case_sensitivity(self):
        """Test that URL parsing preserves case in owner/repo names."""
        owner, repo = parse_github_url('https://github.com/MyUser/MyRepo')
        self.assertEqual(owner, 'MyUser')
        self.assertEqual(repo, 'MyRepo')


class RefreshGitHubTokenTest(TestCase):
    """Tests for _refresh_github_token function."""

    def setUp(self):
        """Set up mock social token."""
        self.mock_token = MagicMock()
        self.mock_token.token = 'ghu_old_token_123'
        self.mock_token.token_secret = 'ghr_refresh_token_456'
        self.mock_token.account_id = 1

    def test_token_refresh_without_refresh_token(self):
        """Test that refresh fails gracefully without refresh token."""
        self.mock_token.token_secret = None

        result = _refresh_github_token(self.mock_token)

        self.assertIsNone(result)
        self.mock_token.save.assert_not_called()

    def test_token_refresh_with_empty_refresh_token(self):
        """Test that refresh fails gracefully with empty refresh token."""
        self.mock_token.token_secret = ''

        result = _refresh_github_token(self.mock_token)

        self.assertIsNone(result)

    @override_settings(GITHUB_CLIENT_ID='', GITHUB_CLIENT_SECRET='')
    def test_token_refresh_without_app_credentials(self):
        """Test handling when SocialApp is not found and no settings."""
        # Mock the import to raise an exception
        with patch.dict('sys.modules', {'allauth.socialaccount.models': MagicMock()}):
            # The function should handle the exception internally
            result = _refresh_github_token(self.mock_token)
            # It will either fail to find credentials or succeed with the mock
            # The key is it shouldn't raise an exception

    @override_settings(GITHUB_CLIENT_ID='test_client_id', GITHUB_CLIENT_SECRET='test_secret')
    @patch('requests.post')
    def test_successful_token_refresh(self, mock_post):
        """Test successful token refresh with valid refresh token."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'ghu_new_token_789',
            'refresh_token': 'ghr_new_refresh_abc',
            'expires_in': 28800,
        }
        mock_post.return_value = mock_response

        new_token = _refresh_github_token(self.mock_token)

        self.assertEqual(new_token, 'ghu_new_token_789')
        self.mock_token.save.assert_called_once()
        self.assertEqual(self.mock_token.token, 'ghu_new_token_789')
        self.assertEqual(self.mock_token.token_secret, 'ghr_new_refresh_abc')

    @override_settings(GITHUB_CLIENT_ID='test_client_id', GITHUB_CLIENT_SECRET='test_secret')
    @patch('requests.post')
    def test_token_refresh_updates_expiration(self, mock_post):
        """Test that token refresh properly sets expiration time."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'ghu_new_token',
            'expires_in': 28800,  # 8 hours
        }
        mock_post.return_value = mock_response

        before_call = timezone.now()
        _refresh_github_token(self.mock_token)
        after_call = timezone.now()

        # Check that expires_at was set to approximately 8 hours from now
        expected_min = before_call + timedelta(seconds=28800)
        expected_max = after_call + timedelta(seconds=28800)
        self.assertGreaterEqual(self.mock_token.expires_at, expected_min)
        self.assertLessEqual(self.mock_token.expires_at, expected_max)

    @override_settings(GITHUB_CLIENT_ID='test_client_id', GITHUB_CLIENT_SECRET='test_secret')
    @patch('requests.post')
    def test_token_refresh_api_error(self, mock_post):
        """Test handling of API error during token refresh."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = 'Bad Request'
        mock_post.return_value = mock_response

        result = _refresh_github_token(self.mock_token)

        self.assertIsNone(result)

    @override_settings(GITHUB_CLIENT_ID='test_client_id', GITHUB_CLIENT_SECRET='test_secret')
    @patch('requests.post')
    def test_token_refresh_github_error_response(self, mock_post):
        """Test handling of GitHub error in response body."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'error': 'bad_refresh_token',
            'error_description': 'The refresh token has expired',
        }
        mock_post.return_value = mock_response

        result = _refresh_github_token(self.mock_token)

        self.assertIsNone(result)

    @override_settings(GITHUB_CLIENT_ID='test_client_id', GITHUB_CLIENT_SECRET='test_secret')
    @patch('requests.post')
    def test_token_refresh_network_error(self, mock_post):
        """Test handling of network error during token refresh."""
        mock_post.side_effect = Exception('Network error')

        result = _refresh_github_token(self.mock_token)

        self.assertIsNone(result)

    @override_settings(GITHUB_CLIENT_ID='settings_client_id', GITHUB_CLIENT_SECRET='settings_secret')
    @patch('requests.post')
    def test_token_refresh_uses_settings_credentials(self, mock_post):
        """Test that settings credentials are used if available."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'ghu_new_token',
            'expires_in': 28800,
        }
        mock_post.return_value = mock_response

        _refresh_github_token(self.mock_token)

        # Verify the correct credentials were used
        call_args = mock_post.call_args
        self.assertEqual(call_args[1]['data']['client_id'], 'settings_client_id')
        self.assertEqual(call_args[1]['data']['client_secret'], 'settings_secret')


class GetUserGitHubTokenTest(TestCase):
    """Tests for get_user_github_token function."""

    def setUp(self):
        """Set up test user and mocks."""
        from django.contrib.auth import get_user_model

        User = get_user_model()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

    def test_returns_none_for_no_connection(self):
        """Test that None is returned when user has no GitHub connection."""
        # User has no social accounts, so should return None
        result = get_user_github_token(self.user)
        self.assertIsNone(result)

    @patch('allauth.socialaccount.models.SocialToken.objects.get')
    @patch('allauth.socialaccount.models.SocialAccount.objects.get')
    def test_returns_valid_token(self, mock_get_account, mock_get_token):
        """Test that valid token is returned for connected user."""
        mock_account = MagicMock()
        mock_get_account.return_value = mock_account

        mock_token = MagicMock()
        mock_token.token = 'gho_valid_token_123'
        mock_token.expires_at = None  # OAuth app tokens don't expire
        mock_get_token.return_value = mock_token

        result = get_user_github_token(self.user)

        self.assertEqual(result, 'gho_valid_token_123')

    @patch('core.integrations.github.helpers._refresh_github_token')
    @patch('allauth.socialaccount.models.SocialToken.objects.get')
    @patch('allauth.socialaccount.models.SocialAccount.objects.get')
    def test_refreshes_expired_github_app_token(self, mock_get_account, mock_get_token, mock_refresh):
        """Test that expired GitHub App token (ghu_...) is automatically refreshed."""
        mock_account = MagicMock()
        mock_get_account.return_value = mock_account

        # Expired token
        mock_token = MagicMock()
        mock_token.token = 'ghu_expired_token'
        mock_token.expires_at = timezone.now() - timedelta(hours=1)  # Expired 1 hour ago
        mock_get_token.return_value = mock_token

        # Refresh returns new token
        mock_refresh.return_value = 'ghu_new_refreshed_token'

        result = get_user_github_token(self.user)

        mock_refresh.assert_called_once_with(mock_token)
        self.assertEqual(result, 'ghu_new_refreshed_token')

    @patch('core.integrations.github.helpers._refresh_github_token')
    @patch('allauth.socialaccount.models.SocialToken.objects.get')
    @patch('allauth.socialaccount.models.SocialAccount.objects.get')
    def test_returns_none_when_refresh_fails(self, mock_get_account, mock_get_token, mock_refresh):
        """Test that None is returned when token refresh fails."""
        mock_account = MagicMock()
        mock_get_account.return_value = mock_account

        mock_token = MagicMock()
        mock_token.token = 'ghu_expired_token'
        mock_token.expires_at = timezone.now() - timedelta(hours=1)
        mock_get_token.return_value = mock_token

        mock_refresh.return_value = None  # Refresh failed

        result = get_user_github_token(self.user)

        self.assertIsNone(result)

    @patch('allauth.socialaccount.models.SocialToken.objects.get')
    @patch('allauth.socialaccount.models.SocialAccount.objects.get')
    def test_does_not_refresh_oauth_app_token(self, mock_get_account, mock_get_token):
        """Test that OAuth App tokens (gho_...) are not refreshed even if expired."""
        mock_account = MagicMock()
        mock_get_account.return_value = mock_account

        # OAuth App token (never expires in practice, but test the logic)
        mock_token = MagicMock()
        mock_token.token = 'gho_oauth_app_token'
        mock_token.expires_at = timezone.now() - timedelta(hours=1)  # Even if "expired"
        mock_get_token.return_value = mock_token

        with patch('core.integrations.github.helpers._refresh_github_token') as mock_refresh:
            result = get_user_github_token(self.user)

            # Should NOT attempt refresh for gho_ tokens
            mock_refresh.assert_not_called()
            self.assertEqual(result, 'gho_oauth_app_token')

    @patch('allauth.socialaccount.models.SocialToken.objects.get')
    @patch('allauth.socialaccount.models.SocialAccount.objects.get')
    def test_uses_non_expired_github_app_token(self, mock_get_account, mock_get_token):
        """Test that non-expired GitHub App token is used directly."""
        mock_account = MagicMock()
        mock_get_account.return_value = mock_account

        mock_token = MagicMock()
        mock_token.token = 'ghu_valid_app_token'
        mock_token.expires_at = timezone.now() + timedelta(hours=4)  # Still valid
        mock_get_token.return_value = mock_token

        with patch('core.integrations.github.helpers._refresh_github_token') as mock_refresh:
            result = get_user_github_token(self.user)

            mock_refresh.assert_not_called()
            self.assertEqual(result, 'ghu_valid_app_token')

    def test_falls_back_to_social_connection(self):
        """Test fallback to SocialConnection when allauth token not found."""
        from core.social.models import SocialConnection, SocialProvider

        # Create a SocialConnection for the user
        connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.GITHUB,
            provider_user_id='github_user_123',
            is_active=True,
        )
        # Set the encrypted access token directly
        connection.access_token = 'connection_token_xyz'
        connection.save()

        result = get_user_github_token(self.user)

        self.assertEqual(result, 'connection_token_xyz')

        # Cleanup
        connection.delete()
