"""
Tests for Figma import functionality in project agent tools.

These tests verify that Figma imports:
1. Set the correct "Design" category
2. Add "Figma" to the "Built With" tools
3. Properly detect and route Figma URLs

Run with: pytest services/agents/project/tests/test_figma_import.py -v
"""

from unittest.mock import Mock, patch

import pytest


class TestFigmaURLDetection:
    """Tests for Figma URL detection in _detect_url_domain_type."""

    def test_figma_design_url(self):
        """Test Figma /design/ URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.figma.com/design/abc123/My-Design') == 'figma'

    def test_figma_file_url(self):
        """Test Figma /file/ URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.figma.com/file/abc123/My-Design') == 'figma'

    def test_figma_make_url(self):
        """Test Figma /make/ (Slides) URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.figma.com/make/abc123/My-Slides') == 'figma'

    def test_figma_without_www(self):
        """Test Figma URL without www prefix."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://figma.com/design/abc123') == 'figma'

    def test_figma_site_subdomain(self):
        """Test Figma .figma.site subdomain detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://my-portfolio.figma.site') == 'figma'
        assert _detect_url_domain_type('https://my-portfolio.figma.site/about') == 'figma'

    def test_figma_proto_url(self):
        """Test Figma /proto/ URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.figma.com/proto/abc123/Prototype') == 'figma'

    def test_figma_board_url(self):
        """Test Figma /board/ (FigJam) URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.figma.com/board/abc123/Board') == 'figma'


@pytest.mark.django_db
class TestHandleFigmaImport:
    """Tests for _handle_figma_import function."""

    @pytest.fixture
    def mock_user(self, django_user_model):
        """Create a test user."""
        return django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    @pytest.fixture
    def agent_state(self, mock_user):
        """Create agent state with user context."""
        return {
            'messages': [],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

    def test_figma_import_calls_generic_import(self, mock_user, agent_state):
        """Test that Figma import delegates to generic import."""
        from services.agents.project.tools import _handle_figma_import

        with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
            mock_generic.return_value = {
                'success': True,
                'project_id': 123,
                'url': '/testuser/my-design',
            }

            with patch('core.projects.models.Project.objects.get') as mock_get:
                mock_project = Mock()
                mock_project.categories = Mock()
                mock_project.tools = Mock()
                mock_get.return_value = mock_project

                with patch('core.taxonomy.models.Taxonomy.objects.get') as mock_tax:
                    mock_category = Mock()
                    mock_category.id = 71
                    mock_tax.return_value = mock_category

                    with patch('core.projects.models.Tool.objects.get') as mock_tool_get:
                        mock_tool = Mock()
                        mock_tool_get.return_value = mock_tool

                        result = _handle_figma_import(
                            url='https://www.figma.com/design/abc123/My-Design',
                            user=mock_user,
                            is_showcase=True,
                            is_private=False,
                            state=agent_state,
                        )

                        # Verify generic import was called with is_owned=True
                        mock_generic.assert_called_once()
                        call_kwargs = mock_generic.call_args.kwargs
                        # Figma imports should always be marked as owned
                        assert call_kwargs.get('is_owned') is True
                        # URL should be passed
                        assert call_kwargs.get('url') == 'https://www.figma.com/design/abc123/My-Design'

    def test_figma_import_sets_design_category(self, mock_user, agent_state):
        """Test that Figma import sets Design category on project."""
        from services.agents.project.tools import _handle_figma_import

        with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
            mock_generic.return_value = {
                'success': True,
                'project_id': 123,
                'url': '/testuser/my-design',
            }

            with patch('core.projects.models.Project.objects.get') as mock_get:
                mock_project = Mock()
                mock_project.categories = Mock()
                mock_project.tools = Mock()
                mock_get.return_value = mock_project

                with patch('core.taxonomy.models.Taxonomy.objects.get') as mock_tax:
                    mock_category = Mock()
                    mock_category.id = 71
                    mock_tax.return_value = mock_category

                    with patch('core.projects.models.Tool.objects.get') as mock_tool_get:
                        mock_tool = Mock()
                        mock_tool_get.return_value = mock_tool

                        _handle_figma_import(
                            url='https://www.figma.com/design/abc123/My-Design',
                            user=mock_user,
                            is_showcase=True,
                            is_private=False,
                            state=agent_state,
                        )

                        # Verify category was set
                        mock_project.categories.clear.assert_called_once()
                        mock_project.categories.add.assert_called_once_with(mock_category)

    def test_figma_import_adds_figma_tool(self, mock_user, agent_state):
        """Test that Figma import adds Figma to Built With tools."""
        from services.agents.project.tools import _handle_figma_import

        with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
            mock_generic.return_value = {
                'success': True,
                'project_id': 123,
                'url': '/testuser/my-design',
            }

            with patch('core.projects.models.Project.objects.get') as mock_get:
                mock_project = Mock()
                mock_project.categories = Mock()
                mock_project.tools = Mock()
                mock_get.return_value = mock_project

                with patch('core.taxonomy.models.Taxonomy.objects.get') as mock_tax:
                    mock_category = Mock()
                    mock_category.id = 71
                    mock_tax.return_value = mock_category

                    with patch('core.projects.models.Tool.objects.get') as mock_tool_get:
                        mock_tool = Mock()
                        mock_tool.name = 'Figma'
                        mock_tool_get.return_value = mock_tool

                        _handle_figma_import(
                            url='https://www.figma.com/design/abc123/My-Design',
                            user=mock_user,
                            is_showcase=True,
                            is_private=False,
                            state=agent_state,
                        )

                        # Verify Figma tool was added
                        mock_project.tools.add.assert_called_once_with(mock_tool)

    def test_figma_import_handles_missing_design_category(self, mock_user, agent_state):
        """Test that missing Design category is handled gracefully."""
        from core.taxonomy.models import Taxonomy
        from services.agents.project.tools import _handle_figma_import

        with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
            mock_generic.return_value = {
                'success': True,
                'project_id': 123,
                'url': '/testuser/my-design',
            }

            with patch('core.projects.models.Project.objects.get') as mock_get:
                mock_project = Mock()
                mock_project.categories = Mock()
                mock_project.tools = Mock()
                mock_get.return_value = mock_project

                with patch('core.taxonomy.models.Taxonomy.objects.get') as mock_tax:
                    mock_tax.side_effect = Taxonomy.DoesNotExist()

                    with patch('core.projects.models.Tool.objects.get') as mock_tool_get:
                        mock_tool = Mock()
                        mock_tool_get.return_value = mock_tool

                        # Should not raise, just log warning
                        result = _handle_figma_import(
                            url='https://www.figma.com/design/abc123/My-Design',
                            user=mock_user,
                            is_showcase=True,
                            is_private=False,
                            state=agent_state,
                        )

                        assert result['success'] is True

    def test_figma_import_handles_missing_figma_tool(self, mock_user, agent_state):
        """Test that missing Figma tool is handled gracefully."""
        from core.projects.models import Tool
        from services.agents.project.tools import _handle_figma_import

        with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
            mock_generic.return_value = {
                'success': True,
                'project_id': 123,
                'url': '/testuser/my-design',
            }

            with patch('core.projects.models.Project.objects.get') as mock_get:
                mock_project = Mock()
                mock_project.categories = Mock()
                mock_project.tools = Mock()
                mock_get.return_value = mock_project

                with patch('core.taxonomy.models.Taxonomy.objects.get') as mock_tax:
                    mock_category = Mock()
                    mock_tax.return_value = mock_category

                    with patch('core.projects.models.Tool.objects.get') as mock_tool_get:
                        mock_tool_get.side_effect = Tool.DoesNotExist()

                        # Should not raise, just log warning
                        result = _handle_figma_import(
                            url='https://www.figma.com/design/abc123/My-Design',
                            user=mock_user,
                            is_showcase=True,
                            is_private=False,
                            state=agent_state,
                        )

                        assert result['success'] is True

    def test_figma_import_success_message(self, mock_user, agent_state):
        """Test that successful Figma import has correct message."""
        from services.agents.project.tools import _handle_figma_import

        with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
            mock_generic.return_value = {
                'success': True,
                'project_id': 123,
                'url': '/testuser/my-design',
                'message': 'Imported successfully',
            }

            with patch('core.projects.models.Project.objects.get') as mock_get:
                mock_project = Mock()
                mock_project.categories = Mock()
                mock_project.tools = Mock()
                mock_get.return_value = mock_project

                with patch('core.taxonomy.models.Taxonomy.objects.get') as mock_tax:
                    mock_category = Mock()
                    mock_tax.return_value = mock_category

                    with patch('core.projects.models.Tool.objects.get') as mock_tool_get:
                        mock_tool = Mock()
                        mock_tool_get.return_value = mock_tool

                        result = _handle_figma_import(
                            url='https://www.figma.com/design/abc123/My-Design',
                            user=mock_user,
                            is_showcase=True,
                            is_private=False,
                            state=agent_state,
                        )

                        assert result['success'] is True
                        assert 'Figma' in result['message']

    def test_figma_import_failure_propagates(self, mock_user, agent_state):
        """Test that failed generic import is properly returned."""
        from services.agents.project.tools import _handle_figma_import

        with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
            mock_generic.return_value = {
                'success': False,
                'error': 'Failed to scrape URL',
            }

            result = _handle_figma_import(
                url='https://www.figma.com/design/abc123/My-Design',
                user=mock_user,
                is_showcase=True,
                is_private=False,
                state=agent_state,
            )

            assert result['success'] is False
            assert 'error' in result


@pytest.mark.django_db
class TestImportFromURLFigmaRouting:
    """Tests for import_from_url routing Figma URLs correctly."""

    @pytest.fixture
    def mock_user(self, django_user_model):
        """Create a test user."""
        return django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    @pytest.fixture
    def agent_state(self, mock_user):
        """Create agent state with user context."""
        return {
            'messages': [],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

    def test_figma_url_routes_to_figma_handler(self, mock_user, agent_state):
        """Test that Figma URLs are routed to _handle_figma_import."""
        from services.agents.project.tools import import_from_url

        with patch('services.agents.project.tools._handle_figma_import') as mock_handler:
            mock_handler.return_value = {
                'success': True,
                'url': '/testuser/my-design',
            }

            import_from_url.func(
                url='https://www.figma.com/design/abc123/My-Design',
                state=agent_state,
            )

            mock_handler.assert_called_once()

    def test_figma_site_url_routes_to_figma_handler(self, mock_user, agent_state):
        """Test that .figma.site URLs are routed to _handle_figma_import."""
        from services.agents.project.tools import import_from_url

        with patch('services.agents.project.tools._handle_figma_import') as mock_handler:
            mock_handler.return_value = {
                'success': True,
                'url': '/testuser/my-portfolio',
            }

            import_from_url.func(
                url='https://my-portfolio.figma.site',
                state=agent_state,
            )

            mock_handler.assert_called_once()
