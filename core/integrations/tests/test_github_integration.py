"""Unit tests for GitHubIntegration."""

from django.test import TestCase

from core.integrations.base.exceptions import IntegrationValidationError
from core.integrations.github.integration import GitHubIntegration


class GitHubIntegrationTestCase(TestCase):
    """Test GitHubIntegration functionality."""

    def setUp(self):
        """Set up test instance."""
        self.integration = GitHubIntegration()

    def test_name_property(self):
        """Test integration name property."""
        self.assertEqual(self.integration.name, 'github')

    def test_display_name_property(self):
        """Test integration display name property."""
        self.assertEqual(self.integration.display_name, 'GitHub')

    def test_normalize_valid_url(self):
        """Test URL normalization with valid GitHub URLs."""
        test_cases = [
            ('https://github.com/user/repo', 'https://github.com/user/repo'),
            ('https://github.com/user/repo/', 'https://github.com/user/repo'),
            ('https://github.com/user/repo.git', 'https://github.com/user/repo'),
            ('git@github.com:user/repo.git', 'https://github.com/user/repo'),
        ]

        for input_url, expected_url in test_cases:
            with self.subTest(input_url=input_url):
                normalized = self.integration.normalize_project_url(input_url)
                self.assertEqual(normalized, expected_url)

    def test_normalize_invalid_url(self):
        """Test URL normalization with invalid URLs."""
        invalid_urls = [
            'https://gitlab.com/user/repo',  # Not GitHub
            'https://github.com/user',  # Missing repo
            'not-a-url',  # Invalid format
            '',  # Empty string
        ]

        for invalid_url in invalid_urls:
            with self.subTest(invalid_url=invalid_url):
                with self.assertRaises(IntegrationValidationError):
                    self.integration.normalize_project_url(invalid_url)

    def test_extract_project_identifier(self):
        """Test extracting owner and repo from URL."""
        url = 'https://github.com/octocat/hello-world'
        result = self.integration.extract_project_identifier(url)

        self.assertEqual(result['owner'], 'octocat')
        self.assertEqual(result['repo'], 'hello-world')

    def test_extract_project_identifier_invalid_url(self):
        """Test extracting from invalid URL raises error."""
        with self.assertRaises(IntegrationValidationError):
            self.integration.extract_project_identifier('https://gitlab.com/user/repo')

    def test_supports_url_valid(self):
        """Test URL support detection for valid GitHub URLs."""
        valid_urls = [
            'https://github.com/user/repo',
            'https://github.com/user/repo.git',
            'git@github.com:user/repo.git',
        ]

        for url in valid_urls:
            with self.subTest(url=url):
                self.assertTrue(self.integration.supports_url(url))

    def test_supports_url_invalid(self):
        """Test URL support detection for invalid URLs."""
        invalid_urls = [
            'https://gitlab.com/user/repo',
            'https://bitbucket.org/user/repo',
            'not-a-url',
        ]

        for url in invalid_urls:
            with self.subTest(url=url):
                self.assertFalse(self.integration.supports_url(url))


class IntegrationRegistryTestCase(TestCase):
    """Test IntegrationRegistry functionality."""

    def test_github_registered(self):
        """Test that GitHubIntegration is registered."""
        from core.integrations.registry import IntegrationRegistry

        registered = IntegrationRegistry.list_all()
        self.assertIn('github', registered)

    def test_get_github_integration(self):
        """Test getting GitHub integration by name."""
        from core.integrations.registry import IntegrationRegistry

        integration_class = IntegrationRegistry.get('github')
        self.assertIsNotNone(integration_class)
        self.assertEqual(integration_class().name, 'github')

    def test_get_integration_for_github_url(self):
        """Test getting integration by URL."""
        from core.integrations.registry import IntegrationRegistry

        url = 'https://github.com/user/repo'
        integration_class = IntegrationRegistry.get_for_url(url)

        self.assertIsNotNone(integration_class)
        self.assertEqual(integration_class().name, 'github')
