"""Integration tests for GitHub repository import via MCP.

Tests the full import flow from URL to project creation.
"""

from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.projects.models import Project

User = get_user_model()


def make_async_return(value):
    """Helper to create async function that returns a value."""

    async def _async_return():
        return value

    return _async_return()


class GitHubImportIntegrationTestCase(TestCase):
    """Integration tests for GitHub import endpoint."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.client.force_authenticate(user=self.user)

        # Test data
        self.test_url = 'https://github.com/testowner/testrepo'
        self.test_owner = 'testowner'
        self.test_repo = 'testrepo'

    def test_import_github_repo_missing_url(self):
        """Test import fails without URL."""
        response = self.client.post('/api/v1/github/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('Repository URL is required', response.data['error'])

    def test_import_github_repo_invalid_url(self):
        """Test import fails with invalid GitHub URL."""
        response = self.client.post('/api/v1/github/import/', {'url': 'https://gitlab.com/owner/repo'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('Invalid GitHub URL', response.data['error'])

    @patch('core.integrations.github.views.get_user_github_token')
    def test_import_github_repo_no_token(self, mock_get_token):
        """Test import fails when user hasn't connected GitHub."""
        mock_get_token.return_value = None

        response = self.client.post('/api/v1/github/import/', {'url': self.test_url}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])
        self.assertIn('GitHub not connected', response.data['error'])

    @patch('core.integrations.github.views.analyze_github_repo')
    @patch('core.integrations.github.views.normalize_mcp_repo_data')
    @patch('core.integrations.github.views.GitHubMCPService')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_import_github_repo_success(self, mock_get_token, mock_mcp_service_class, mock_normalize, mock_analyze):
        """Test successful repository import via MCP."""
        # Mock user token
        mock_get_token.return_value = 'test_token_12345'

        # Mock MCP service
        mock_service = Mock()
        mock_mcp_service_class.return_value = mock_service

        # Mock repository data from MCP
        mock_repo_files = {
            'readme': '# Test Repo\n\nA test repository.',
            'tree': [{'path': 'src/main.py', 'type': 'blob'}, {'path': 'requirements.txt', 'type': 'blob'}],
            'dependencies': {'requirements.txt': 'django==4.2.0\ncelery==5.3.0'},
            'tech_stack': {'languages': {'Python': 'primary'}, 'frameworks': ['Django'], 'tools': ['Docker']},
        }
        mock_service.get_repository_info_sync.return_value = mock_repo_files

        # Mock normalized repo data (async function)
        mock_normalize.return_value = make_async_return(
            {
                'name': 'testrepo',
                'description': 'A test repository',
                'language': 'Python',
                'topics': ['django', 'python'],
                'stargazers_count': 42,
                'forks_count': 10,
                'html_url': self.test_url,
            }
        )

        # Mock AI analysis
        mock_analyze.return_value = {
            'description': 'An AI-analyzed description of the repository.',
            'category_ids': [],
            'topics': ['django', 'python'],
            'tool_names': ['Docker'],
            'readme_blocks': [],
            'mermaid_diagrams': [],
            'demo_urls': [],
        }

        # Make request
        response = self.client.post(
            '/api/v1/github/import/', {'url': self.test_url, 'is_showcase': True}, format='json'
        )

        # Verify response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('project_id', response.data['data'])
        self.assertIn('slug', response.data['data'])
        self.assertIn('url', response.data['data'])

        # Verify project was created
        project = Project.objects.get(id=response.data['data']['project_id'])
        self.assertEqual(project.user, self.user)
        self.assertEqual(project.external_url, self.test_url)
        self.assertEqual(project.type, Project.ProjectType.GITHUB_REPO)
        self.assertTrue(project.is_showcase)
        self.assertTrue(project.is_published)  # Showcase items published immediately

        # Verify MCP service was called correctly
        mock_mcp_service_class.assert_called_once_with('test_token_12345')
        mock_service.get_repository_info_sync.assert_called_once_with(self.test_owner, self.test_repo)

        # Verify project content structure
        self.assertIn('github', project.content)
        self.assertEqual(project.content['github']['owner'], self.test_owner)
        self.assertEqual(project.content['github']['repo'], self.test_repo)
        self.assertIn('readme', project.content['github'])
        self.assertIn('tree', project.content['github'])
        self.assertIn('dependencies', project.content['github'])
        self.assertIn('tech_stack', project.content['github'])

    @patch('core.integrations.github.views.normalize_mcp_repo_data')
    @patch('core.integrations.github.views.GitHubMCPService')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_import_github_repo_duplicate(self, mock_get_token, mock_mcp_service_class, mock_normalize):
        """Test import fails when repository already imported."""
        mock_get_token.return_value = 'test_token_12345'
        # Create existing project
        existing_project = Project.objects.create(
            user=self.user,
            title='Existing Repo',
            description='Already imported',
            type=Project.ProjectType.GITHUB_REPO,
            external_url=self.test_url,
        )

        # Try to import again
        response = self.client.post('/api/v1/github/import/', {'url': self.test_url}, format='json')

        # Verify error response
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['success'])
        self.assertIn('already imported', response.data['error'])

        # Verify existing project data is returned
        self.assertEqual(response.data['data']['project_id'], existing_project.id)
        self.assertEqual(response.data['data']['slug'], existing_project.slug)

    @patch('core.integrations.github.views.GitHubMCPService')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_import_github_repo_mcp_error_handling(self, mock_get_token, mock_mcp_service_class):
        """Test import handles MCP service errors gracefully."""
        mock_get_token.return_value = 'test_token_12345'

        # Mock MCP service to raise an exception
        mock_service = Mock()
        mock_service.get_repository_info_sync.side_effect = Exception('MCP service error')
        mock_mcp_service_class.return_value = mock_service

        # Make request
        response = self.client.post('/api/v1/github/import/', {'url': self.test_url}, format='json')

        # Verify error handling
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertFalse(response.data['success'])
        self.assertIn('Failed to import repository', response.data['error'])

    @patch('core.integrations.github.views.analyze_github_repo')
    @patch('core.integrations.github.views.normalize_mcp_repo_data')
    @patch('core.integrations.github.views.GitHubMCPService')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_import_github_repo_with_various_urls(
        self, mock_get_token, mock_mcp_service_class, mock_normalize, mock_analyze
    ):
        """Test import handles various GitHub URL formats."""
        mock_get_token.return_value = 'test_token_12345'

        # Setup minimal mocks
        mock_service = Mock()
        mock_service.get_repository_info_sync.return_value = {
            'readme': '',
            'tree': [],
            'dependencies': {},
            'tech_stack': {},
        }
        mock_mcp_service_class.return_value = mock_service

        mock_normalize.return_value = make_async_return(
            {
                'name': 'repo',
                'description': '',
                'language': 'Python',
                'topics': [],
                'stargazers_count': 0,
                'forks_count': 0,
                'html_url': 'https://github.com/owner/repo',
            }
        )

        mock_analyze.return_value = {
            'description': 'Test',
            'category_ids': [],
            'topics': [],
            'tool_names': [],
            'readme_blocks': [],
            'mermaid_diagrams': [],
            'demo_urls': [],
        }

        # Test different URL formats
        test_urls = [
            'https://github.com/owner/repo',
            'https://github.com/owner/repo/',
            'https://github.com/owner/repo.git',
            'git@github.com:owner/repo.git',
        ]

        for url in test_urls:
            with self.subTest(url=url):
                response = self.client.post('/api/v1/github/import/', {'url': url}, format='json')

                # Should succeed or already exist
                self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_409_CONFLICT])

    def test_import_requires_authentication(self):
        """Test import endpoint requires authentication."""
        self.client.force_authenticate(user=None)

        response = self.client.post('/api/v1/github/import/', {'url': self.test_url}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('core.integrations.github.views.analyze_github_repo')
    @patch('core.integrations.github.views.normalize_mcp_repo_data')
    @patch('core.integrations.github.views.GitHubMCPService')
    @patch('core.integrations.github.views.get_user_github_token')
    def test_import_playground_item_not_published(
        self, mock_get_token, mock_mcp_service_class, mock_normalize, mock_analyze
    ):
        """Test playground items (is_showcase=false) remain unpublished."""
        mock_get_token.return_value = 'test_token_12345'

        # Setup mocks
        mock_service = Mock()
        mock_service.get_repository_info_sync.return_value = {
            'readme': '# Playground Project',
            'tree': [],
            'dependencies': {},
            'tech_stack': {},
        }
        mock_mcp_service_class.return_value = mock_service

        mock_normalize.return_value = make_async_return(
            {
                'name': 'playground-repo',
                'description': 'A playground project',
                'language': 'Python',
                'topics': [],
                'stargazers_count': 5,
                'forks_count': 1,
                'html_url': 'https://github.com/owner/playground-repo',
            }
        )

        mock_analyze.return_value = {
            'description': 'Experimental playground project',
            'category_ids': [],
            'topics': [],
            'tool_names': [],
            'readme_blocks': [],
            'mermaid_diagrams': [],
            'demo_urls': [],
        }

        # Make request with is_showcase=false
        response = self.client.post(
            '/api/v1/github/import/',
            {'url': 'https://github.com/owner/playground-repo', 'is_showcase': False},
            format='json',
        )

        # Verify response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        # Verify project was created as unpublished draft
        project = Project.objects.get(id=response.data['data']['project_id'])
        self.assertFalse(project.is_showcase)
        self.assertFalse(project.is_published)  # Playground items remain as drafts
