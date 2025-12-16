"""
TDD Tests for LinkedIn Profile Generation Feature.

SCENARIO: As a logged in user on my own profile, when I click "generate profile with AI"
it should first offer "Generate from LinkedIn" or "Tell me more about yourself"

EXPECTED: If I select LinkedIn, the platform makes an AI generated profile from LinkedIn data
FAILURE: The user does not have a rich profile description pulled from LinkedIn
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from core.social.models import SocialConnection, SocialProvider
from core.users.models import User


class TestLinkedInProfileGenerationSources(TestCase):
    """Test that profile generation offers source selection (LinkedIn vs Manual)."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_profile_generation_sources_endpoint_exists(self):
        """Test that there's an endpoint to get available profile generation sources."""
        url = '/api/v1/profile/generate/sources/'
        response = self.api_client.get(url)
        # Should return 200, not 404
        self.assertNotEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_sources_returns_linkedin_when_connected(self):
        """When user has LinkedIn connected, sources should include 'linkedin'."""
        # Create LinkedIn connection
        connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.LINKEDIN,
            provider_user_id='linkedin-123',
            provider_username='John Doe',
        )
        connection.access_token = 'test-token'
        connection.save()

        url = '/api/v1/profile/generate/sources/'
        response = self.api_client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('sources', data)

        source_keys = [s['key'] for s in data['sources']]
        self.assertIn('linkedin', source_keys)
        self.assertIn('manual', source_keys)

        # LinkedIn source should be marked as available
        linkedin_source = next(s for s in data['sources'] if s['key'] == 'linkedin')
        self.assertTrue(linkedin_source['available'])

    def test_sources_linkedin_unavailable_when_not_connected(self):
        """When user has no LinkedIn connection, linkedin source should be unavailable."""
        url = '/api/v1/profile/generate/sources/'
        response = self.api_client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # LinkedIn should be in sources but marked as unavailable
        linkedin_source = next((s for s in data['sources'] if s['key'] == 'linkedin'), None)
        self.assertIsNotNone(linkedin_source)
        self.assertFalse(linkedin_source['available'])

        # Manual should always be available
        manual_source = next(s for s in data['sources'] if s['key'] == 'manual')
        self.assertTrue(manual_source['available'])


class TestLinkedInProfileGeneration(TestCase):
    """Test generating profile from LinkedIn data."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

        # Create LinkedIn connection
        self.connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.LINKEDIN,
            provider_user_id='linkedin-123',
            provider_username='Jane Developer',
            provider_email='jane@example.com',
            extra_data={
                'given_name': 'Jane',
                'family_name': 'Developer',
            },
        )
        self.connection.access_token = 'test-linkedin-token'
        self.connection.save()

    @patch('core.integrations.linkedin.service.LinkedInService')
    def test_generate_from_linkedin_endpoint_exists(self, mock_service_class):
        """Test that there's an endpoint to generate profile from LinkedIn."""
        url = '/api/v1/profile/generate/from-linkedin/'
        response = self.api_client.post(url)
        # Should return something other than 404
        self.assertNotEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch('core.integrations.linkedin.service.LinkedInService')
    def test_generate_from_linkedin_fetches_profile(self, mock_service_class):
        """Test that generating from LinkedIn fetches the user's LinkedIn profile."""
        # Mock LinkedIn service using fetch_userinfo (OpenID Connect compatible endpoint)
        mock_service = MagicMock()
        mock_service.fetch_userinfo.return_value = {
            'id': 'linkedin-123',
            'first_name': 'Jane',
            'last_name': 'Developer',
            'full_name': 'Jane Developer',
            'given_name': 'Jane',
            'family_name': 'Developer',
            'email': 'jane@example.com',
            'avatar_url': 'https://media.linkedin.com/avatar.jpg',
            'picture': 'https://media.linkedin.com/avatar.jpg',
        }
        mock_service_class.return_value = mock_service

        url = '/api/v1/profile/generate/from-linkedin/'
        response = self.api_client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Service should have been called with fetch_userinfo (not deprecated fetch_profile_with_email)
        mock_service.fetch_userinfo.assert_called_once()

    @patch('core.integrations.linkedin.service.LinkedInService')
    @patch('services.agents.profile.agent.generate_profile')
    def test_generate_from_linkedin_creates_profile_sections(self, mock_generate, mock_service_class):
        """Test that LinkedIn data is used to generate profile sections."""
        # Mock LinkedIn service using fetch_userinfo (OpenID Connect compatible endpoint)
        mock_service = MagicMock()
        mock_service.fetch_userinfo.return_value = {
            'id': 'linkedin-123',
            'first_name': 'Jane',
            'last_name': 'Developer',
            'full_name': 'Jane Developer',
            'given_name': 'Jane',
            'family_name': 'Developer',
            'email': 'jane@example.com',
            'avatar_url': 'https://media.linkedin.com/avatar.jpg',
            'picture': 'https://media.linkedin.com/avatar.jpg',
        }
        mock_service_class.return_value = mock_service

        # Mock profile generation
        mock_generate.return_value = {
            'sections': [
                {
                    'id': 'section-1',
                    'type': 'about',
                    'visible': True,
                    'order': 0,
                    'content': {
                        'bio': 'Passionate developer with 10+ years of experience.',
                        'tagline': 'Senior Software Engineer at TechCorp',
                    },
                }
            ]
        }

        url = '/api/v1/profile/generate/from-linkedin/'
        response = self.api_client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('sections', data)
        self.assertTrue(len(data['sections']) > 0)

    def test_generate_from_linkedin_fails_without_connection(self):
        """Test that generating from LinkedIn fails if user has no LinkedIn connection."""
        # Delete the connection
        self.connection.delete()

        url = '/api/v1/profile/generate/from-linkedin/'
        response = self.api_client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('error', data)


class TestLinkedInDataGathering(TestCase):
    """Test the LinkedIn data gathering tool for profile generation."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        # Create LinkedIn connection
        self.connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.LINKEDIN,
            provider_user_id='linkedin-123',
            provider_username='Jane Developer',
        )
        self.connection.access_token = 'test-token'
        self.connection.save()

    @patch('core.integrations.linkedin.service.LinkedInService')
    def test_gather_linkedin_data_tool_exists(self, mock_service_class):
        """Test that gather_linkedin_data tool exists in profile tools."""
        from services.agents.profile.tools import gather_linkedin_data

        self.assertTrue(callable(gather_linkedin_data))

    @patch('core.integrations.linkedin.service.LinkedInService')
    def test_gather_linkedin_data_returns_profile_info(self, mock_service_class):
        """Test that gather_linkedin_data returns LinkedIn profile information."""
        from services.agents.profile.tools import gather_linkedin_data

        # Mock LinkedIn service using fetch_userinfo (OpenID Connect compatible endpoint)
        mock_service = MagicMock()
        mock_service.fetch_userinfo.return_value = {
            'id': 'linkedin-123',
            'first_name': 'Jane',
            'last_name': 'Developer',
            'full_name': 'Jane Developer',
            'given_name': 'Jane',
            'family_name': 'Developer',
            'avatar_url': 'https://media.linkedin.com/avatar.jpg',
        }
        mock_service_class.return_value = mock_service

        result = gather_linkedin_data(self.user.id)

        self.assertIn('linkedin_profile', result)
        self.assertEqual(result['linkedin_profile']['full_name'], 'Jane Developer')
        self.assertEqual(result['linkedin_profile']['given_name'], 'Jane')

    @patch('core.integrations.linkedin.service.LinkedInService')
    def test_gather_linkedin_data_handles_missing_connection(self, mock_service_class):
        """Test gather_linkedin_data gracefully handles missing LinkedIn connection."""
        from services.agents.profile.tools import gather_linkedin_data

        # Delete the connection
        self.connection.delete()

        result = gather_linkedin_data(self.user.id)

        self.assertIn('linkedin_profile', result)
        self.assertIsNone(result['linkedin_profile'])


class TestProfileGenerationWithLinkedInContext(TestCase):
    """Test that profile generation agent can use LinkedIn context."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Jane',
            last_name='Developer',
        )
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

        # Create LinkedIn connection with rich data
        self.connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.LINKEDIN,
            provider_user_id='linkedin-123',
            provider_username='Jane Developer',
            extra_data={
                'headline': 'Senior Software Engineer at TechCorp',
                'summary': 'Building the future of AI-powered development tools.',
            },
        )
        self.connection.access_token = 'test-token'
        self.connection.save()

    @patch('core.integrations.linkedin.service.LinkedInService')
    @override_settings(OPENAI_API_KEY='test-key')
    def test_profile_agent_includes_linkedin_in_gathered_data(self, mock_service_class):
        """Test that profile agent's gather_user_data includes LinkedIn info when available."""
        from services.agents.profile.tools import gather_user_data

        # Mock LinkedIn service using fetch_userinfo (OpenID Connect compatible endpoint)
        mock_service = MagicMock()
        mock_service.fetch_userinfo.return_value = {
            'id': 'linkedin-123',
            'full_name': 'Jane Developer',
            'given_name': 'Jane',
            'family_name': 'Developer',
            'avatar_url': 'https://media.linkedin.com/avatar.jpg',
        }
        mock_service_class.return_value = mock_service

        # Call gather_user_data with proper state dict (as the tool expects)
        state = {'user_id': self.user.id, 'username': self.user.username}
        result = gather_user_data.func(
            include_projects=True,
            include_achievements=True,
            include_interests=True,
            state=state,
        )

        # Should include linkedin_profile in the gathered data
        self.assertIn('linkedin_profile', result)

    @patch('core.integrations.linkedin.service.LinkedInService')
    def test_generated_bio_uses_linkedin_data(self, mock_service_class):
        """Test that generated profile incorporates LinkedIn data."""
        # Mock LinkedIn service using fetch_userinfo (OpenID Connect compatible endpoint)
        mock_service = MagicMock()
        mock_service.fetch_userinfo.return_value = {
            'id': 'linkedin-123',
            'full_name': 'Jane Developer',
            'given_name': 'Jane',
            'family_name': 'Developer',
            'avatar_url': 'https://media.linkedin.com/avatar.jpg',
        }
        mock_service_class.return_value = mock_service

        url = '/api/v1/profile/generate/from-linkedin/'
        response = self.api_client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # The generated content should include sections
        self.assertIn('sections', data)
        # Find the about section
        about_section = next((s for s in data.get('sections', []) if s.get('type') == 'about'), None)
        self.assertIsNotNone(about_section, "Should have an 'about' section generated")


class TestFrontendSourceSelection(TestCase):
    """Test that frontend receives proper data for source selection UI."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_sources_response_has_proper_structure(self):
        """Test that sources endpoint returns properly structured data for UI."""
        # Create LinkedIn connection
        connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.LINKEDIN,
            provider_user_id='linkedin-123',
            provider_username='Test User',
        )
        connection.access_token = 'test-token'
        connection.save()

        url = '/api/v1/profile/generate/sources/'
        response = self.api_client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Check structure
        self.assertIn('sources', data)
        for source in data['sources']:
            self.assertIn('key', source)
            self.assertIn('label', source)
            self.assertIn('description', source)
            self.assertIn('available', source)
            self.assertIn('icon', source)

    def test_linkedin_source_has_user_name(self):
        """Test that LinkedIn source includes the connected user's name."""
        connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.LINKEDIN,
            provider_user_id='linkedin-123',
            provider_username='Jane Developer',
        )
        connection.access_token = 'test-token'
        connection.save()

        url = '/api/v1/profile/generate/sources/'
        response = self.api_client.get(url)

        data = response.json()
        linkedin_source = next(s for s in data['sources'] if s['key'] == 'linkedin')

        # Should include the connected account name
        self.assertIn('connectedAs', linkedin_source)
        self.assertEqual(linkedin_source['connectedAs'], 'Jane Developer')
