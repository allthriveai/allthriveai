"""Tests for GitHub integration main class."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.integrations.github.integration import GitHubIntegration

User = get_user_model()


class GitHubIntegrationTestCase(TestCase):
    """Test GitHub integration."""

    def setUp(self):
        """Set up test user."""
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.integration = GitHubIntegration()

    def test_can_handle_github_urls(self):
        """Test GitHub URL detection."""
        self.assertTrue(self.integration.can_handle('https://github.com/owner/repo'))
        self.assertTrue(self.integration.can_handle('http://github.com/owner/repo'))
        self.assertFalse(self.integration.can_handle('https://gitlab.com/owner/repo'))
        self.assertFalse(self.integration.can_handle('invalid-url'))

    def test_parse_github_url(self):
        """Test GitHub URL parsing."""
        owner, repo = self.integration.parse_url('https://github.com/testowner/testrepo')
        self.assertEqual(owner, 'testowner')
        self.assertEqual(repo, 'testrepo')

    def test_parse_github_url_with_trailing_slash(self):
        """Test URL parsing with trailing slash."""
        owner, repo = self.integration.parse_url('https://github.com/testowner/testrepo/')
        self.assertEqual(owner, 'testowner')
        self.assertEqual(repo, 'testrepo')

    def test_parse_github_url_invalid(self):
        """Test invalid URL parsing."""
        with self.assertRaises(ValueError):
            self.integration.parse_url('https://github.com/incomplete')

    @patch('core.integrations.github.integration.get_integration_token')
    def test_import_project_no_token(self, mock_get_token):
        """Test import fails without GitHub token."""
        mock_get_token.return_value = None

        result = self.integration.import_project(
            user_id=self.user.id, url='https://github.com/test/repo', is_showcase=True
        )

        self.assertFalse(result.get('success'))
        self.assertEqual(result.get('error_code'), 'AUTH_REQUIRED')


# TODO: Add more tests for:
# - Successful import flow (mocked)
# - Duplicate detection
# - Lock acquisition/release
# - Error handling
