"""
Unit tests for GitHub integration views.

CRITICAL: These tests ensure the GitHub API endpoints work correctly.
They cover repository listing, import flow, and app installation callbacks.

Run with: pytest core/integrations/github/tests/test_views.py -v
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.tests.base import BaseAuthenticatedTestCase
from core.users.models import User


class ListUserReposViewTest(BaseAuthenticatedTestCase):
    """Tests for list_user_repos view."""

    def setUp(self):
        """Set up test client and user."""
        super().setUp()
        self.url = reverse('github_repos')

    @patch('core.integrations.github.views.get_user_github_token')
    def test_returns_401_when_github_not_connected(self, mock_get_token):
        """Test that 401 is returned when user has no GitHub connection."""
        mock_get_token.return_value = None

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
        self.assertIn('GitHub not connected', response.data['error'])

    @patch('core.integrations.github.views.requests.get')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_returns_repos_when_installations_exist(self, mock_get_token, mock_requests_get):
        """Test successful repo listing with GitHub App installations."""
        mock_get_token.return_value = 'ghu_valid_token'

        # Mock installations response
        mock_install_response = MagicMock()
        mock_install_response.status_code = 200
        mock_install_response.json.return_value = {
            'installations': [
                {'id': 12345, 'account': {'login': 'testuser', 'type': 'User'}, 'repository_selection': 'selected'}
            ]
        }
        mock_install_response.raise_for_status = MagicMock()

        # Mock repos response
        mock_repos_response = MagicMock()
        mock_repos_response.status_code = 200
        mock_repos_response.json.return_value = {
            'repositories': [
                {
                    'id': 1,
                    'name': 'test-repo',
                    'full_name': 'testuser/test-repo',
                    'description': 'A test repository',
                    'html_url': 'https://github.com/testuser/test-repo',
                    'language': 'Python',
                    'stargazers_count': 10,
                    'forks_count': 2,
                    'private': False,
                    'updated_at': '2024-01-01T00:00:00Z',
                }
            ]
        }

        # Side effect to return different responses for different URLs
        def side_effect(url, *args, **kwargs):
            if 'installations' in url and 'repositories' not in url:
                return mock_install_response
            elif 'repositories' in url:
                return mock_repos_response
            return mock_install_response

        mock_requests_get.side_effect = side_effect

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['count'], 1)
        self.assertEqual(response.data['data']['repositories'][0]['name'], 'test-repo')

    @patch('core.integrations.github.views.requests.get')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_prompts_install_when_no_installations(self, mock_get_token, mock_requests_get):
        """Test that install prompt is returned when no GitHub App installations exist."""
        mock_get_token.return_value = 'ghu_valid_token'

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'installations': []}
        mock_response.raise_for_status = MagicMock()
        mock_requests_get.return_value = mock_response

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['success'])
        self.assertTrue(response.data['needs_installation'])
        self.assertIn('install_url', response.data)

    @patch('core.integrations.github.views.requests.get')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_returns_401_when_token_invalid(self, mock_get_token, mock_requests_get):
        """Test that 401 is returned when GitHub token is invalid/expired."""
        mock_get_token.return_value = 'ghu_expired_token'

        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_requests_get.return_value = mock_response

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('invalid or expired', response.data['error'])

    def test_requires_authentication(self):
        """Test that unauthenticated requests are rejected."""
        self.client.logout()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ImportGitHubRepoAsyncViewTest(BaseAuthenticatedTestCase):
    """Tests for import_github_repo_async view."""

    def setUp(self):
        """Set up test client and user."""
        super().setUp()
        self.url = reverse('github_import')

    def test_requires_authentication(self):
        """Test that unauthenticated requests are rejected."""
        self.client.logout()

        response = self.client.post(self.url, {'url': 'https://github.com/user/repo'})

        # DRF returns 401 for unauthenticated or 403 for CSRF issues
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_returns_400_when_url_missing(self):
        """Test that 400 is returned when URL is not provided."""
        response = self.client.post(self.url, {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'MISSING_URL')

    def test_returns_400_for_invalid_github_url(self):
        """Test that 400 is returned for non-GitHub URLs."""
        response = self.client.post(self.url, {'url': 'https://gitlab.com/user/repo'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'INVALID_URL')

    @patch('core.integrations.tasks.import_github_repo_task.delay')
    @patch('core.integrations.github.views.cache')
    def test_returns_409_when_import_in_progress(self, mock_cache, mock_delay):
        """Test that 409 is returned when user already has import in progress."""
        mock_cache.get.return_value = True  # Lock exists

        response = self.client.post(self.url, {'url': 'https://github.com/user/repo'})

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['error_code'], 'IMPORT_IN_PROGRESS')
        mock_delay.assert_not_called()

    @patch('core.integrations.github.views.Project.objects.filter')
    @patch('core.integrations.github.views.cache')
    def test_returns_409_for_duplicate_import(self, mock_cache, mock_filter):
        """Test that 409 is returned when project already exists."""
        mock_cache.get.return_value = False  # No lock

        # Existing project
        mock_project = MagicMock()
        mock_project.id = 1
        mock_project.title = 'Existing Project'
        mock_project.slug = 'existing-project'
        mock_filter.return_value.first.return_value = mock_project

        response = self.client.post(self.url, {'url': 'https://github.com/user/repo'})

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['error_code'], 'DUPLICATE_IMPORT')
        self.assertIn('project', response.data)

    @patch('core.integrations.tasks.import_github_repo_task.delay')
    @patch('core.integrations.github.views.Project.objects.filter')
    @patch('core.integrations.github.views.cache')
    def test_successful_import_queuing(self, mock_cache, mock_filter, mock_delay):
        """Test successful import task queuing."""
        mock_cache.get.return_value = False  # No lock
        mock_filter.return_value.first.return_value = None  # No existing project

        mock_task = MagicMock()
        mock_task.id = 'task-123'
        mock_delay.return_value = mock_task

        response = self.client.post(self.url, {'url': 'https://github.com/testuser/testrepo', 'is_showcase': True})

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['task_id'], 'task-123')
        mock_delay.assert_called_once()
        mock_cache.set.assert_called()  # Lock was acquired


class GitHubAppInstallationCallbackViewTest(TestCase):
    """Tests for github_app_installation_callback view."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.url = reverse('github_app_callback')

    @patch('core.integrations.github.views.settings')
    def test_redirects_with_error_when_no_installation_id(self, mock_settings):
        """Test that callback redirects with error when installation_id is missing."""
        mock_settings.FRONTEND_URL = 'http://localhost:3000'

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn('github_error=no_installation_id', response.url)

    @patch('core.integrations.github.views.settings')
    def test_redirects_with_error_for_invalid_installation_id(self, mock_settings):
        """Test that callback redirects with error for non-numeric installation_id."""
        mock_settings.FRONTEND_URL = 'http://localhost:3000'

        response = self.client.get(f'{self.url}?installation_id=not-a-number')

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn('github_error=invalid_installation_id', response.url)

    @patch('core.integrations.github.views.GitHubAppInstallation.objects.update_or_create')
    @patch('core.integrations.github.views.get_user_github_token')
    @patch('core.integrations.github.views.settings')
    def test_successful_installation_callback(self, mock_settings, mock_get_token, mock_update_or_create):
        """Test successful GitHub App installation callback."""
        mock_settings.FRONTEND_URL = 'http://localhost:3000'
        mock_get_token.return_value = None  # No token, skip API call

        mock_installation = MagicMock()
        mock_update_or_create.return_value = (mock_installation, True)

        response = self.client.get(f'{self.url}?installation_id=12345&setup_action=install')

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn('github_installed=true', response.url)
        mock_update_or_create.assert_called_once()


class SyncGitHubInstallationsViewTest(BaseAuthenticatedTestCase):
    """Tests for sync_github_installations view."""

    def setUp(self):
        """Set up test client and user."""
        super().setUp()
        self.url = reverse('github_sync_installations')

    @patch('core.integrations.github.views.get_user_github_token')
    def test_returns_401_when_github_not_connected(self, mock_get_token):
        """Test that 401 is returned when user has no GitHub connection."""
        mock_get_token.return_value = None

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('core.integrations.github.views.requests.get')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_syncs_installations_successfully(self, mock_get_token, mock_requests_get):
        """Test successful installation sync."""
        mock_get_token.return_value = 'ghu_valid_token'

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'installations': [
                {
                    'id': 12345,
                    'account': {'login': 'testuser', 'type': 'User'},
                    'repository_selection': 'selected',
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()
        mock_requests_get.return_value = mock_response

        with patch('core.integrations.github.views.GitHubAppInstallation.objects.update_or_create') as mock_update:
            mock_update.return_value = (MagicMock(), True)

            response = self.client.get(self.url)

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data['success'])
            self.assertEqual(response.data['data']['count'], 1)


class GetGitHubAppInstallURLViewTest(BaseAuthenticatedTestCase):
    """Tests for get_github_app_install_url view."""

    def setUp(self):
        """Set up test client and user."""
        super().setUp()
        self.url = reverse('github_app_install_url')

    @patch('core.integrations.github.views.settings')
    def test_returns_install_url(self, mock_settings):
        """Test that install URL is returned correctly."""
        mock_settings.GITHUB_APP_SLUG = 'all-thrive-ai'

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('https://github.com/apps/all-thrive-ai', response.data['data']['install_url'])
        self.assertEqual(response.data['data']['app_slug'], 'all-thrive-ai')


class GetTaskStatusViewTest(BaseAuthenticatedTestCase):
    """Tests for get_task_status view."""

    def setUp(self):
        """Set up test client and user."""
        super().setUp()

    @patch('celery.result.AsyncResult')
    def test_returns_pending_status(self, mock_async_result):
        """Test that pending task status is returned correctly."""
        mock_task = MagicMock()
        mock_task.status = 'PENDING'
        mock_task.successful.return_value = False
        mock_task.failed.return_value = False
        mock_async_result.return_value = mock_task

        url = reverse('task_status', kwargs={'task_id': 'test-task-123'})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['task_id'], 'test-task-123')
        self.assertEqual(response.data['status'], 'PENDING')

    @patch('celery.result.AsyncResult')
    def test_returns_success_result(self, mock_async_result):
        """Test that successful task result is returned correctly."""
        mock_task = MagicMock()
        mock_task.status = 'SUCCESS'
        mock_task.successful.return_value = True
        mock_task.failed.return_value = False
        mock_task.result = {
            'success': True,
            'project': {'id': 1, 'title': 'Test Project', 'slug': 'test-project'},
        }
        mock_async_result.return_value = mock_task

        url = reverse('task_status', kwargs={'task_id': 'test-task-123'})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'SUCCESS')
        self.assertIn('result', response.data)

    @patch('celery.result.AsyncResult')
    def test_returns_failure_error(self, mock_async_result):
        """Test that failed task error is returned correctly."""
        mock_task = MagicMock()
        mock_task.status = 'FAILURE'
        mock_task.successful.return_value = False
        mock_task.failed.return_value = True
        mock_task.info = Exception('Import failed: rate limit exceeded')
        mock_async_result.return_value = mock_task

        url = reverse('task_status', kwargs={'task_id': 'test-task-123'})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'FAILURE')
        self.assertIn('error', response.data)
