"""
Tests for intent detection API endpoint

Run with: pytest core/agents/tests/test_intent_api.py -v
"""

from unittest.mock import Mock, patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
class TestIntentDetectionAPI:
    """Test /api/v1/agents/detect-intent/ endpoint"""

    def setup_method(self):
        """Setup test fixtures"""
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.url = reverse('detect_intent')

    def test_requires_authentication(self):
        """Test endpoint requires authentication"""
        response = self.client.post(self.url, {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_requires_message(self):
        """Test endpoint requires message parameter"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data

    def test_rejects_empty_message(self):
        """Test endpoint rejects empty message"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {'message': ''})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data

    @patch('core.agents.views.get_intent_service')
    def test_detects_support_intent(self, mock_get_service):
        """Test API returns support intent"""
        # Mock the intent service
        mock_service = Mock()
        mock_service.detect_intent.return_value = 'support'
        mock_service.get_mode_transition_message.return_value = 'How can I help you today?'
        mock_get_service.return_value = mock_service

        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {'message': 'How do I add a project?'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['intent'] == 'support'
        assert 'transition_message' in response.data
        mock_service.detect_intent.assert_called_once()

    @patch('core.agents.views.get_intent_service')
    def test_detects_project_creation_intent(self, mock_get_service):
        """Test API returns project-creation intent"""
        mock_service = Mock()
        mock_service.detect_intent.return_value = 'project-creation'
        mock_service.get_mode_transition_message.return_value = "Let's create a new project!"
        mock_get_service.return_value = mock_service

        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {'message': 'Create a project from GitHub'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['intent'] == 'project-creation'

    @patch('core.agents.views.get_intent_service')
    def test_detects_discovery_intent(self, mock_get_service):
        """Test API returns discovery intent"""
        mock_service = Mock()
        mock_service.detect_intent.return_value = 'discovery'
        mock_service.get_mode_transition_message.return_value = 'I can help you explore projects.'
        mock_get_service.return_value = mock_service

        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {'message': 'Show me AI projects'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['intent'] == 'discovery'

    @patch('core.agents.views.get_intent_service')
    def test_with_conversation_history(self, mock_get_service):
        """Test API accepts conversation history"""
        mock_service = Mock()
        mock_service.detect_intent.return_value = 'support'
        mock_service.get_mode_transition_message.return_value = 'How can I help?'
        mock_get_service.return_value = mock_service

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            self.url,
            {
                'message': 'What about projects?',
                'conversation_history': [{'sender': 'user', 'content': 'Hi'}, {'sender': 'agent', 'content': 'Hello!'}],
            },
        )

        assert response.status_code == status.HTTP_200_OK
        # Verify history was passed to service
        call_args = mock_service.detect_intent.call_args
        assert call_args[1]['conversation_history'] is not None

    @patch('core.agents.views.get_intent_service')
    def test_with_integration_type(self, mock_get_service):
        """Test API accepts integration type"""
        mock_service = Mock()
        mock_service.detect_intent.return_value = 'project-creation'
        mock_service.get_mode_transition_message.return_value = "Let's import from GitHub!"
        mock_get_service.return_value = mock_service

        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {'message': 'Import this repo', 'integration_type': 'github'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['intent'] == 'project-creation'
        # Verify integration_type was passed
        call_args = mock_service.detect_intent.call_args
        assert call_args[1]['integration_type'] == 'github'

    @patch('core.agents.views.get_intent_service')
    def test_handles_service_error(self, mock_get_service):
        """Test API handles service errors gracefully"""
        mock_service = Mock()
        mock_service.detect_intent.side_effect = Exception('Service error')
        mock_get_service.return_value = mock_service

        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {'message': 'Test message'})

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert 'error' in response.data

    def test_response_format(self):
        """Test API response has correct format"""
        with patch('core.agents.views.get_intent_service') as mock_get_service:
            mock_service = Mock()
            mock_service.detect_intent.return_value = 'support'
            mock_service.get_mode_transition_message.return_value = 'How can I help?'
            mock_get_service.return_value = mock_service

            self.client.force_authenticate(user=self.user)
            response = self.client.post(self.url, {'message': 'Help me'})

            assert response.status_code == status.HTTP_200_OK
            assert 'intent' in response.data
            assert 'transition_message' in response.data
            assert isinstance(response.data['intent'], str)
            assert isinstance(response.data['transition_message'], str)
