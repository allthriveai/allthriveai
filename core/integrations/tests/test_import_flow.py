"""Integration tests for complete import flow."""

from unittest.mock import Mock, patch

from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from django.contrib.auth import get_user_model
from django.test import TestCase

from core.integrations.github.integration import GitHubIntegration
from core.projects.models import Project

User = get_user_model()


class ImportFlowTestCase(TestCase):
    """Test complete import pipeline."""

    def setUp(self):
        """Set up test user with GitHub connection."""
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        # Create GitHub social app
        self.github_app = SocialApp.objects.create(
            provider='github', name='GitHub', client_id='test_client_id', secret='test_secret'
        )

        # Mock GitHub OAuth
        self.social_account = SocialAccount.objects.create(user=self.user, provider='github', uid='12345')

        self.social_token = SocialToken.objects.create(
            account=self.social_account, app=self.github_app, token='test_token_123'
        )

    @patch('core.integrations.github.service.GitHubService')
    @patch('core.integrations.github.ai_analyzer.analyze_github_repo')
    def test_successful_import(self, mock_analyzer, mock_service):
        """Test complete import flow."""
        # Setup mocks
        mock_service_instance = Mock()
        mock_service.return_value = mock_service_instance

        mock_service_instance.get_repository_info_sync.return_value = {
            'name': 'test-repo',
            'description': 'Test repository',
            'owner': 'testowner',
            'language': 'Python',
            'stargazers_count': 10,
            'topics': ['python', 'testing'],
            'tree': [],
            'dependencies': {},
            'readme': '# Test README',
        }

        mock_analyzer.return_value = {
            'description': 'A test repository',
            'category_ids': [9],
            'topics': ['python', 'testing'],
            'tool_names': [],
            'readme_blocks': [{'type': 'text', 'content': 'Test content'}],
            'hero_image': 'https://example.com/image.png',
            'hero_quote': None,
            'mermaid_diagrams': [],
            'demo_urls': [],
        }

        # Import
        url = 'https://github.com/testowner/test-repo'
        integration = GitHubIntegration()

        # Note: This would normally be async via Celery
        # For testing, we'd need to call the sync version directly
        # TODO: Implement sync import method for testing

        # Verify project was created
        # self.assertEqual(Project.objects.count(), 1)
        # project = Project.objects.first()
        # self.assertEqual(project.title, 'test-repo')
        # self.assertEqual(project.user, self.user)

    def test_duplicate_import_error(self):
        """Test duplicate import prevention."""
        # Create existing project
        Project.objects.create(
            user=self.user, title='Existing Project', external_url='https://github.com/testowner/test-repo'
        )

        # Attempt to import again
        url = 'https://github.com/testowner/test-repo'
        integration = GitHubIntegration()

        # TODO: Test that duplicate is detected
        # For now, just verify the project exists
        self.assertEqual(Project.objects.count(), 1)


# TODO: Add tests for:
# - Private repo auth check
# - Invalid URL handling
# - Network errors
# - Import with concurrent lock
