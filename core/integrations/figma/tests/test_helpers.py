"""
Tests for Figma integration helper functions.

Run with: pytest core/integrations/figma/tests/test_helpers.py -v
"""

import pytest


class TestParseFigmaUrl:
    """Tests for the parse_figma_url helper function."""

    def test_parse_file_url_basic(self):
        """Test parsing a basic Figma file URL."""
        from core.integrations.figma.helpers import parse_figma_url

        result = parse_figma_url('https://www.figma.com/file/abc123/My-Design')
        assert result is not None
        assert result['type'] == 'file'
        assert result['key'] == 'abc123'
        assert result['name'] == 'My-Design'

    def test_parse_design_url(self):
        """Test parsing a Figma /design/ URL format."""
        from core.integrations.figma.helpers import parse_figma_url

        result = parse_figma_url('https://www.figma.com/design/xyz789/Cool-Project')
        assert result is not None
        assert result['type'] == 'file'
        assert result['key'] == 'xyz789'
        assert result['name'] == 'Cool-Project'

    def test_parse_file_url_without_www(self):
        """Test parsing URL without www prefix."""
        from core.integrations.figma.helpers import parse_figma_url

        result = parse_figma_url('https://figma.com/file/abc123/Design')
        assert result is not None
        assert result['type'] == 'file'
        assert result['key'] == 'abc123'

    def test_parse_file_url_with_query_params(self):
        """Test parsing URL with query parameters."""
        from core.integrations.figma.helpers import parse_figma_url

        result = parse_figma_url('https://www.figma.com/file/abc123/Design?node-id=0-1&mode=design')
        assert result is not None
        assert result['type'] == 'file'
        assert result['key'] == 'abc123'

    def test_parse_file_url_no_name(self):
        """Test parsing URL without file name."""
        from core.integrations.figma.helpers import parse_figma_url

        result = parse_figma_url('https://www.figma.com/file/abc123')
        assert result is not None
        assert result['type'] == 'file'
        assert result['key'] == 'abc123'
        assert result['name'] is None

    def test_parse_project_url(self):
        """Test parsing a Figma project URL."""
        from core.integrations.figma.helpers import parse_figma_url

        result = parse_figma_url('https://www.figma.com/files/project/12345/My-Project')
        assert result is not None
        assert result['type'] == 'project'
        assert result['key'] == '12345'
        assert result['name'] == 'My-Project'

    def test_parse_invalid_url_returns_none(self):
        """Test that invalid URLs return None."""
        from core.integrations.figma.helpers import parse_figma_url

        assert parse_figma_url('https://google.com') is None
        assert parse_figma_url('https://github.com/user/repo') is None
        assert parse_figma_url('not a url') is None
        assert parse_figma_url('') is None
        assert parse_figma_url(None) is None

    def test_parse_file_url_complex_name(self):
        """Test parsing URL with complex file name containing special characters."""
        from core.integrations.figma.helpers import parse_figma_url

        result = parse_figma_url('https://www.figma.com/design/abc123/My-Design-v2.0-(Final)')
        assert result is not None
        assert result['type'] == 'file'
        assert result['key'] == 'abc123'


class TestExtractDesignInfo:
    """Tests for the extract_design_info helper function."""

    def test_extract_basic_info(self):
        """Test extracting basic design info from file data."""
        from core.integrations.figma.helpers import extract_design_info

        file_data = {
            'document': {
                'name': 'My Design',
                'children': [
                    {'id': '1', 'name': 'Page 1', 'type': 'CANVAS'},
                    {'id': '2', 'name': 'Page 2', 'type': 'CANVAS'},
                ],
            },
            'components': {'comp1': {}, 'comp2': {}, 'comp3': {}},
            'styles': {'style1': {}, 'style2': {}},
        }

        result = extract_design_info(file_data)

        assert result['pageCount'] == 2
        assert result['componentCount'] == 3
        assert result['styleCount'] == 2
        assert result['documentName'] == 'My Design'
        assert len(result['pages']) == 2
        assert result['pages'][0]['name'] == 'Page 1'

    def test_extract_empty_document(self):
        """Test extracting info from empty document."""
        from core.integrations.figma.helpers import extract_design_info

        file_data = {'document': {}, 'components': {}, 'styles': {}}

        result = extract_design_info(file_data)

        assert result['pageCount'] == 0
        assert result['componentCount'] == 0
        assert result['styleCount'] == 0

    def test_extract_filters_non_canvas_children(self):
        """Test that non-CANVAS children are filtered out."""
        from core.integrations.figma.helpers import extract_design_info

        file_data = {
            'document': {
                'children': [
                    {'id': '1', 'name': 'Page 1', 'type': 'CANVAS'},
                    {'id': '2', 'name': 'Frame', 'type': 'FRAME'},
                    {'id': '3', 'name': 'Component', 'type': 'COMPONENT'},
                ],
            },
            'components': {},
            'styles': {},
        }

        result = extract_design_info(file_data)

        # Only CANVAS types should be counted as pages
        assert result['pageCount'] == 1


class TestDetectDesignType:
    """Tests for the detect_design_type helper function."""

    def test_detect_figjam_as_whiteboard(self):
        """Test that FigJam files are detected as whiteboard."""
        from core.integrations.figma.helpers import detect_design_type

        file_data = {'editor_type': 'figjam'}
        assert detect_design_type(file_data) == 'whiteboard'

    def test_detect_slides_as_presentation(self):
        """Test that Slides files are detected as presentation."""
        from core.integrations.figma.helpers import detect_design_type

        file_data = {'editor_type': 'slides'}
        assert detect_design_type(file_data) == 'presentation'

    def test_detect_design_system(self):
        """Test that files with many components are detected as design system."""
        from core.integrations.figma.helpers import detect_design_type

        file_data = {
            'editor_type': 'figma',
            'components': {f'comp{i}': {} for i in range(60)},
        }
        assert detect_design_type(file_data) == 'design_system'

    def test_detect_ui_design(self):
        """Test that files with moderate components are detected as UI design."""
        from core.integrations.figma.helpers import detect_design_type

        file_data = {
            'editor_type': 'figma',
            'components': {f'comp{i}': {} for i in range(25)},
        }
        assert detect_design_type(file_data) == 'ui_design'

    def test_detect_simple_design(self):
        """Test that files with few components are detected as design."""
        from core.integrations.figma.helpers import detect_design_type

        file_data = {
            'editor_type': 'figma',
            'components': {'comp1': {}, 'comp2': {}},
        }
        assert detect_design_type(file_data) == 'design'


class TestFormatFigmaFileForFrontend:
    """Tests for formatting Figma file data for frontend display."""

    def test_format_basic_file(self):
        """Test formatting a basic Figma file."""
        from core.integrations.figma.helpers import format_figma_file_for_frontend

        file_data = {
            'name': 'My Design',
            'key': 'abc123',
            'thumbnail_url': 'https://example.com/thumb.png',
            'last_modified': '2024-01-15T10:30:00Z',
            'version': '123456',
            'editor_type': 'figma',
            'role': 'owner',
        }

        result = format_figma_file_for_frontend(file_data)

        assert result['name'] == 'My Design'
        assert result['key'] == 'abc123'
        assert result['thumbnailUrl'] == 'https://example.com/thumb.png'
        assert result['lastModified'] == '2024-01-15T10:30:00Z'
        assert result['version'] == '123456'
        assert result['editorType'] == 'figma'
        assert result['role'] == 'owner'

    def test_format_file_with_missing_fields(self):
        """Test formatting handles missing fields gracefully."""
        from core.integrations.figma.helpers import format_figma_file_for_frontend

        file_data = {'name': 'Minimal Design'}

        result = format_figma_file_for_frontend(file_data)

        assert result['name'] == 'Minimal Design'
        assert result['key'] == ''
        assert result['thumbnailUrl'] == ''
        assert result['editorType'] == 'figma'  # Default


@pytest.mark.django_db
class TestGetUserFigmaToken:
    """Tests for get_user_figma_token function."""

    def test_returns_none_when_no_connection(self, django_user_model):
        """Test that None is returned when user has no Figma connection."""
        from core.integrations.figma.helpers import get_user_figma_token

        user = django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        result = get_user_figma_token(user)
        assert result is None

    def test_returns_token_from_social_connection(self, django_user_model):
        """Test that token is returned from SocialConnection."""
        from core.integrations.figma.helpers import get_user_figma_token
        from core.social.models import SocialConnection, SocialProvider

        user = django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        # Create a Figma connection
        SocialConnection.objects.create(
            user=user,
            provider=SocialProvider.FIGMA,
            access_token='figma_token_123',
            is_active=True,
        )

        result = get_user_figma_token(user)
        assert result == 'figma_token_123'

    def test_returns_none_for_inactive_connection(self, django_user_model):
        """Test that inactive connections are ignored."""
        from core.integrations.figma.helpers import get_user_figma_token
        from core.social.models import SocialConnection, SocialProvider

        user = django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        # Create an inactive Figma connection
        SocialConnection.objects.create(
            user=user,
            provider=SocialProvider.FIGMA,
            access_token='figma_token_123',
            is_active=False,
        )

        result = get_user_figma_token(user)
        assert result is None
