"""
Tests for Figma API service.

Run with: pytest core/integrations/figma/tests/test_service.py -v
"""

from unittest.mock import Mock, patch

import pytest
import requests


class TestFigmaService:
    """Tests for the FigmaService class."""

    def test_init_sets_headers(self):
        """Test that initialization sets proper authorization headers."""
        from core.integrations.figma.service import FigmaService

        service = FigmaService('test_token_123')

        assert service.access_token == 'test_token_123'
        assert service.headers['Authorization'] == 'Bearer test_token_123'
        assert service.headers['Accept'] == 'application/json'

    @patch('core.integrations.figma.service.requests.get')
    def test_get_current_user(self, mock_get):
        """Test fetching current user info."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'id': 'user123',
            'email': 'test@example.com',
            'handle': 'testuser',
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_current_user()

        assert result['id'] == 'user123'
        assert result['email'] == 'test@example.com'
        mock_get.assert_called_once()

    @patch('core.integrations.figma.service.requests.get')
    def test_get_file(self, mock_get):
        """Test fetching a Figma file."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'name': 'My Design',
            'document': {'children': []},
            'components': {},
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_file('abc123', depth=2)

        assert result['name'] == 'My Design'
        # Verify depth param was passed
        call_args = mock_get.call_args
        assert call_args.kwargs['params']['depth'] == 2

    @patch('core.integrations.figma.service.requests.get')
    def test_get_file_images(self, mock_get):
        """Test exporting images from a file."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'images': {
                '1:1': 'https://example.com/image1.png',
                '1:2': 'https://example.com/image2.png',
            }
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_file_images('abc123', node_ids=['1:1', '1:2'], scale=2)

        assert '1:1' in result['images']
        call_args = mock_get.call_args
        assert call_args.kwargs['params']['scale'] == 2
        assert call_args.kwargs['params']['ids'] == '1:1,1:2'

    @patch('core.integrations.figma.service.requests.get')
    def test_http_error_handling(self, mock_get):
        """Test that HTTP errors are properly raised."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.text = 'Access denied'
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError(response=mock_response)
        mock_get.return_value = mock_response

        service = FigmaService('invalid_token')

        with pytest.raises(requests.exceptions.HTTPError):
            service.get_current_user()

    @patch('core.integrations.figma.service.requests.get')
    def test_request_timeout_handling(self, mock_get):
        """Test that request timeouts are properly raised."""
        from core.integrations.figma.service import FigmaService

        mock_get.side_effect = requests.exceptions.Timeout()

        service = FigmaService('test_token')

        with pytest.raises(requests.exceptions.RequestException):
            service.get_current_user()

    @patch('core.integrations.figma.service.requests.get')
    def test_get_file_components(self, mock_get):
        """Test fetching file components."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'meta': {
                'components': [
                    {'key': 'comp1', 'name': 'Button'},
                    {'key': 'comp2', 'name': 'Card'},
                ]
            }
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_file_components('abc123')

        assert 'meta' in result
        assert len(result['meta']['components']) == 2

    @patch('core.integrations.figma.service.requests.get')
    def test_get_file_styles(self, mock_get):
        """Test fetching file styles."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'meta': {
                'styles': [
                    {'key': 'style1', 'name': 'Primary Color'},
                ]
            }
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_file_styles('abc123')

        assert 'meta' in result

    @patch('core.integrations.figma.service.requests.get')
    def test_get_file_versions(self, mock_get):
        """Test fetching file version history."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'versions': [
                {'id': 'v1', 'created_at': '2024-01-01T00:00:00Z'},
                {'id': 'v2', 'created_at': '2024-01-02T00:00:00Z'},
            ]
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_file_versions('abc123')

        assert len(result['versions']) == 2

    @patch('core.integrations.figma.service.requests.get')
    def test_get_file_metadata(self, mock_get):
        """Test fetching minimal file metadata."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'name': 'My Design',
            'lastModified': '2024-01-15T10:30:00Z',
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_file_metadata('abc123')

        assert result['name'] == 'My Design'
        # Verify depth=0 was passed for minimal data
        call_args = mock_get.call_args
        assert call_args.kwargs['params']['depth'] == 0

    @patch('core.integrations.figma.service.requests.get')
    def test_get_file_nodes(self, mock_get):
        """Test fetching specific nodes from a file."""
        from core.integrations.figma.service import FigmaService

        mock_response = Mock()
        mock_response.json.return_value = {
            'nodes': {
                '1:1': {'document': {'name': 'Frame 1'}},
                '1:2': {'document': {'name': 'Frame 2'}},
            }
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        service = FigmaService('test_token')
        result = service.get_file_nodes('abc123', ['1:1', '1:2'])

        assert '1:1' in result['nodes']
        call_args = mock_get.call_args
        assert call_args.kwargs['params']['ids'] == '1:1,1:2'
