"""
Tests for project agent tools.

Run with: pytest services/project_agent/tests/test_tools.py -v
"""

from unittest.mock import Mock, patch

import pytest
import requests

from services.agents.project.tools import (
    create_project,
    extract_url_info,
    fetch_github_metadata,
)


@pytest.mark.django_db
class TestCreateProjectTool:
    """Tests for create_project tool.

    Note: We test the underlying function directly (create_project.func) rather than
    using .invoke() because LangGraph's InjectedState requires the state parameter to be
    injected by ToolNode. The underlying function correctly accepts state
    and is what LangGraph's ToolNode calls during agent execution.
    """

    def test_create_project_success(self, mock_user, agent_state):
        """Test successful project creation."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            # Mock successful project creation
            mock_project = Mock()
            mock_project.id = 123
            mock_project.slug = 'my-ai-project'
            mock_project.title = 'My AI Project'
            mock_project.user.username = mock_user.username
            mock_service.create_project.return_value = (mock_project, None)

            # Call the underlying function directly with state
            # This is how LangGraph's ToolNode calls it
            result = create_project.func(
                title='My AI Project',
                project_type='github_repo',
                description='A cool AI project',
                is_showcase=True,
                state=agent_state,
            )

            assert result['success'] is True
            assert result['project_id'] == 123
            assert result['slug'] == 'my-ai-project'
            assert result['title'] == 'My AI Project'
            assert 'url' in result
            mock_service.create_project.assert_called_once()

    def test_create_project_no_state(self):
        """Test project creation fails without state."""
        # Call underlying function directly
        result = create_project.func(
            title='My Project',
            project_type='github_repo',
            state=None,
        )

        assert result['success'] is False
        assert 'not authenticated' in result['error'].lower()

    def test_create_project_no_user_id_in_state(self):
        """Test project creation fails without user_id in state."""
        state = {'messages': [], 'username': 'test'}

        result = create_project.func(
            title='My Project',
            project_type='github_repo',
            state=state,
        )

        assert result['success'] is False
        assert 'not authenticated' in result['error'].lower()

    def test_create_project_service_error(self, agent_state):
        """Test handling of service errors."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.create_project.return_value = (None, 'Database error')

            result = create_project.func(
                title='My Project',
                project_type='github_repo',
                state=agent_state,
            )

            assert result['success'] is False
            assert result['error'] == 'Database error'


@pytest.mark.django_db
class TestFetchGitHubMetadataTool:
    """Tests for fetch_github_metadata tool."""

    def test_fetch_github_metadata_success(self, github_api_response):
        """Test successful GitHub metadata fetch."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = True

            with patch('services.agents.project.tools.cache') as mock_cache:
                mock_cache.get.return_value = None  # Cache miss

                with patch('services.agents.project.tools.requests.get') as mock_get:
                    mock_response = Mock()
                    mock_response.status_code = 200
                    mock_response.json.return_value = github_api_response
                    mock_get.return_value = mock_response

                    result = fetch_github_metadata.invoke({'url': 'https://github.com/user/awesome-project'})

                    assert result['success'] is True
                    assert result['title'] == 'awesome-project'
                    assert result['description'] == 'An awesome AI project'
                    assert result['language'] == 'Python'
                    assert result['stars'] == 150
                    assert result['forks'] == 25
                    assert result['project_type'] == 'github_repo'
                    mock_cache.set.assert_called_once()  # Should cache result

    def test_fetch_github_metadata_invalid_url(self):
        """Test handling of invalid GitHub URL."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = False

            result = fetch_github_metadata.invoke({'url': 'https://not-github.com/repo'})

            assert result['success'] is False
            assert 'invalid' in result['error'].lower()

    def test_fetch_github_metadata_cached(self, github_api_response):
        """Test that cached results are returned."""
        cached_result = {
            'success': True,
            'title': 'cached-project',
            'description': 'From cache',
            'language': 'Python',
            'stars': 100,
            'forks': 10,
            'topics': [],
            'homepage': '',
            'project_type': 'github_repo',
        }

        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = True

            with patch('services.agents.project.tools.cache') as mock_cache:
                mock_cache.get.return_value = cached_result

                result = fetch_github_metadata.invoke({'url': 'https://github.com/user/cached-project'})

                assert result['success'] is True
                assert result['title'] == 'cached-project'

    def test_fetch_github_metadata_repo_not_found(self):
        """Test handling of 404 response."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = True

            with patch('services.agents.project.tools.cache') as mock_cache:
                mock_cache.get.return_value = None

                with patch('services.agents.project.tools.requests.get') as mock_get:
                    mock_response = Mock()
                    mock_response.status_code = 404
                    mock_get.return_value = mock_response

                    result = fetch_github_metadata.invoke({'url': 'https://github.com/user/nonexistent'})

                    assert result['success'] is False
                    assert 'not found' in result['error'].lower()

    def test_fetch_github_metadata_api_error(self):
        """Test handling of API errors."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = True

            with patch('services.agents.project.tools.cache') as mock_cache:
                mock_cache.get.return_value = None

                with patch('services.agents.project.tools.requests.get') as mock_get:
                    mock_response = Mock()
                    mock_response.status_code = 500
                    mock_get.return_value = mock_response

                    result = fetch_github_metadata.invoke({'url': 'https://github.com/user/repo'})

                    assert result['success'] is False
                    assert 'error' in result['error'].lower()

    def test_fetch_github_metadata_network_error(self):
        """Test handling of network errors."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = True

            with patch('services.agents.project.tools.cache') as mock_cache:
                mock_cache.get.return_value = None

                with patch('services.agents.project.tools.requests.get') as mock_get:
                    mock_get.side_effect = requests.RequestException('Network error')

                    result = fetch_github_metadata.invoke({'url': 'https://github.com/user/repo'})

                    assert result['success'] is False
                    assert 'failed' in result['error'].lower()


class TestExtractURLInfoTool:
    """Tests for extract_url_info tool."""

    def test_extract_url_info_github(self):
        """Test URL extraction with GitHub link."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.extract_urls_from_text.return_value = ['https://github.com/user/repo']
            mock_service.infer_project_type_from_url.return_value = 'github_repo'
            mock_service.is_github_url.return_value = True

            result = extract_url_info.invoke({'text': 'Check out my project: https://github.com/user/repo'})

            assert result['success'] is True
            assert result['has_urls'] is True
            assert len(result['urls']) == 1
            assert result['first_url'] == 'https://github.com/user/repo'
            assert result['is_github'] is True
            assert result['inferred_type'] == 'github_repo'

    def test_extract_url_info_no_urls(self):
        """Test URL extraction with no URLs."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.extract_urls_from_text.return_value = []

            result = extract_url_info.invoke({'text': 'No URLs here, just text'})

            assert result['success'] is True
            assert result['has_urls'] is False
            assert result['urls'] == []

    def test_extract_url_info_multiple_urls(self):
        """Test URL extraction with multiple URLs."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.extract_urls_from_text.return_value = [
                'https://github.com/user/repo',
                'https://example.com/docs',
            ]
            mock_service.infer_project_type_from_url.return_value = 'github_repo'
            mock_service.is_github_url.return_value = True

            result = extract_url_info.invoke(
                {'text': 'GitHub: https://github.com/user/repo Docs: https://example.com/docs'}
            )

            assert result['success'] is True
            assert result['has_urls'] is True
            assert len(result['urls']) == 2
            # Should analyze first URL
            assert result['first_url'] == 'https://github.com/user/repo'

    def test_extract_url_info_non_github(self):
        """Test URL extraction with non-GitHub link."""
        with patch('services.agents.project.tools.ProjectService') as mock_service:
            mock_service.extract_urls_from_text.return_value = ['https://behance.net/gallery/123']
            mock_service.infer_project_type_from_url.return_value = 'image_collection'
            mock_service.is_github_url.return_value = False

            result = extract_url_info.invoke({'text': 'My art: https://behance.net/gallery/123'})

            assert result['success'] is True
            assert result['has_urls'] is True
            assert result['is_github'] is False
            assert result['inferred_type'] == 'image_collection'
