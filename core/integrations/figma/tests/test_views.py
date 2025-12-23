"""
Tests for Figma integration API views.

Run with: pytest core/integrations/figma/tests/test_views.py -v
"""

from unittest.mock import Mock, patch

import pytest
import requests
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, django_user_model):
    """Create an authenticated API client."""
    user = django_user_model.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
    )
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.mark.django_db
class TestListUserFilesView:
    """Tests for the list_user_files endpoint."""

    def test_unauthenticated_request_returns_401(self, api_client):
        """Test that unauthenticated requests return 401."""
        response = api_client.get('/api/v1/figma/files/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @patch('core.integrations.figma.views.get_user_figma_token')
    def test_no_figma_connection_returns_401(self, mock_get_token, authenticated_client):
        """Test that missing Figma connection returns 401."""
        client, user = authenticated_client
        mock_get_token.return_value = None

        response = client.get('/api/v1/figma/files/')

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['connected'] is False
        assert 'connect' in response.data['error'].lower()

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_successful_connection_returns_user_info(self, mock_service_class, mock_get_token, authenticated_client):
        """Test successful connection returns user info."""
        client, user = authenticated_client
        mock_get_token.return_value = 'valid_token'

        mock_service = Mock()
        mock_service.get_current_user.return_value = {
            'id': 'user123',
            'email': 'figma@example.com',
            'handle': 'figmauser',
            'img_url': 'https://example.com/avatar.png',
        }
        mock_service_class.return_value = mock_service

        response = client.get('/api/v1/figma/files/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert response.data['data']['user']['email'] == 'figma@example.com'

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_expired_token_returns_401(self, mock_service_class, mock_get_token, authenticated_client):
        """Test that expired token returns 401."""
        client, user = authenticated_client
        mock_get_token.return_value = 'expired_token'

        mock_service = Mock()
        mock_response = Mock()
        mock_response.status_code = 401
        mock_service.get_current_user.side_effect = requests.exceptions.HTTPError(response=mock_response)
        mock_service_class.return_value = mock_service

        response = client.get('/api/v1/figma/files/')

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['connected'] is False

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_rate_limit_returns_429(self, mock_service_class, mock_get_token, authenticated_client):
        """Test that rate limit returns 429."""
        client, user = authenticated_client
        mock_get_token.return_value = 'valid_token'

        mock_service = Mock()
        mock_response = Mock()
        mock_response.status_code = 429
        mock_service.get_current_user.side_effect = requests.exceptions.HTTPError(response=mock_response)
        mock_service_class.return_value = mock_service

        response = client.get('/api/v1/figma/files/')

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


@pytest.mark.django_db
class TestGetFilePreviewView:
    """Tests for the get_file_preview endpoint."""

    def test_unauthenticated_request_returns_401(self, api_client):
        """Test that unauthenticated requests return 401."""
        response = api_client.get('/api/v1/figma/files/abc123/preview/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @patch('core.integrations.figma.views.get_user_figma_token')
    def test_no_figma_connection_returns_401(self, mock_get_token, authenticated_client):
        """Test that missing Figma connection returns 401."""
        client, user = authenticated_client
        mock_get_token.return_value = None

        response = client.get('/api/v1/figma/files/abc123/preview/')

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['connected'] is False

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_successful_preview_returns_file_data(self, mock_service_class, mock_get_token, authenticated_client):
        """Test successful preview returns file metadata."""
        client, user = authenticated_client
        mock_get_token.return_value = 'valid_token'

        mock_service = Mock()
        mock_service.get_file.return_value = {
            'name': 'My Design',
            'thumbnailUrl': 'https://example.com/thumb.png',
            'lastModified': '2024-01-15T10:30:00Z',
            'version': '123456',
            'editorType': 'figma',
            'document': {
                'children': [
                    {'id': '1', 'name': 'Page 1', 'type': 'CANVAS'},
                    {'id': '2', 'name': 'Page 2', 'type': 'CANVAS'},
                ]
            },
        }
        mock_service_class.return_value = mock_service

        response = client.get('/api/v1/figma/files/abc123/preview/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert response.data['data']['name'] == 'My Design'
        assert response.data['data']['pageCount'] == 2

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_file_not_found_returns_404(self, mock_service_class, mock_get_token, authenticated_client):
        """Test that file not found returns 404."""
        client, user = authenticated_client
        mock_get_token.return_value = 'valid_token'

        mock_service = Mock()
        mock_response = Mock()
        mock_response.status_code = 404
        mock_service.get_file.side_effect = requests.exceptions.HTTPError(response=mock_response)
        mock_service_class.return_value = mock_service

        response = client.get('/api/v1/figma/files/nonexistent/preview/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_access_denied_returns_403(self, mock_service_class, mock_get_token, authenticated_client):
        """Test that access denied returns 403."""
        client, user = authenticated_client
        mock_get_token.return_value = 'valid_token'

        mock_service = Mock()
        mock_response = Mock()
        mock_response.status_code = 403
        mock_service.get_file.side_effect = requests.exceptions.HTTPError(response=mock_response)
        mock_service_class.return_value = mock_service

        response = client.get('/api/v1/figma/files/private123/preview/')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'needsReconnect' in response.data or 'access' in response.data['error'].lower()

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_slides_url_returns_unsupported_error(self, mock_service_class, mock_get_token, authenticated_client):
        """Test that Slides URLs return unsupported file type error."""
        client, user = authenticated_client
        mock_get_token.return_value = 'valid_token'

        mock_service = Mock()
        mock_response = Mock()
        mock_response.status_code = 403
        mock_service.get_file.side_effect = requests.exceptions.HTTPError(response=mock_response)
        mock_service_class.return_value = mock_service

        # Request with is_slides=true query param
        response = client.get('/api/v1/figma/files/slides123/preview/?is_slides=true')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data.get('unsupportedFileType') == 'slides'

    @patch('core.integrations.figma.views.get_user_figma_token')
    @patch('core.integrations.figma.views.FigmaService')
    def test_expired_token_returns_401(self, mock_service_class, mock_get_token, authenticated_client):
        """Test that expired token returns 401."""
        client, user = authenticated_client
        mock_get_token.return_value = 'expired_token'

        mock_service = Mock()
        mock_response = Mock()
        mock_response.status_code = 401
        mock_service.get_file.side_effect = requests.exceptions.HTTPError(response=mock_response)
        mock_service_class.return_value = mock_service

        response = client.get('/api/v1/figma/files/abc123/preview/')

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['connected'] is False
