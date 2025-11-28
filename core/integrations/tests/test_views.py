"""Tests for integration API endpoints."""

from unittest.mock import patch

from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.projects.models import Project

User = get_user_model()


class IntegrationViewsTestCase(TestCase):
    """Test integration API endpoints."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        # Create GitHub social app
        self.github_app = SocialApp.objects.create(
            provider='github', name='GitHub', client_id='test_client_id', secret='test_secret'
        )

        # Create GitHub social account
        self.social_account = SocialAccount.objects.create(user=self.user, provider='github', uid='12345')

        # Create social token
        self.social_token = SocialToken.objects.create(
            account=self.social_account, app=self.github_app, token='test_token_123'
        )

    def test_import_from_url_unauthenticated(self):
        """Test import requires authentication."""
        response = self.client.post('/api/integrations/import-from-url/', {'url': 'https://github.com/test/repo'})
        self.assertEqual(response.status_code, 401)

    @patch('core.integrations.github.integration.GitHubIntegration.import_project')
    def test_import_from_url_success(self, mock_import):
        """Test successful import via API."""
        self.client.force_authenticate(user=self.user)

        # Mock successful import
        mock_import.return_value = {
            'success': True,
            'task_id': 'test-task-id',
            'platform': 'github',
            'message': 'Importing test/repo...',
        }

        response = self.client.post(
            '/api/integrations/import-from-url/', {'url': 'https://github.com/test/repo', 'is_showcase': True}
        )

        self.assertEqual(response.status_code, 202)
        self.assertIn('task_id', response.data)

    def test_import_duplicate_error(self):
        """Test duplicate import returns proper error."""
        self.client.force_authenticate(user=self.user)

        # Create existing project
        Project.objects.create(user=self.user, title='Test Project', external_url='https://github.com/test/repo')

        response = self.client.post('/api/integrations/import-from-url/', {'url': 'https://github.com/test/repo'})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['error_code'], 'DUPLICATE_IMPORT')

    def test_import_invalid_url(self):
        """Test invalid URL handling."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/integrations/import-from-url/', {'url': 'not-a-valid-url'})

        self.assertEqual(response.status_code, 400)

    def test_import_no_github_connection(self):
        """Test import without GitHub connection."""
        # Create user without GitHub connection
        user2 = User.objects.create_user(
            username='noconnection', email='noconnection@example.com', password='testpass123'
        )
        self.client.force_authenticate(user=user2)

        response = self.client.post('/api/integrations/import-from-url/', {'url': 'https://github.com/test/repo'})

        self.assertEqual(response.status_code, 401)  # AUTH_REQUIRED returns 401 (Unauthorized)
        self.assertEqual(response.data['error_code'], 'AUTH_REQUIRED')


# TODO: Add tests for task status endpoint
# TODO: Add tests for list integrations endpoint
