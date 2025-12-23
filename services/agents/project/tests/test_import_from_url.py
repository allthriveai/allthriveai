"""
Tests for the unified import_from_url tool.

TDD Implementation - RED phase first.
Run with: pytest services/agents/project/tests/test_import_from_url.py -v
"""

from unittest.mock import Mock, patch

import pytest


class TestDetectURLDomainType:
    """TDD Phase 1: Domain detection tests.

    These tests should FAIL initially until _detect_url_domain_type is implemented.
    """

    def test_github_url_basic(self):
        """Test basic GitHub URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://github.com/user/repo') == 'github'

    def test_github_url_with_www(self):
        """Test GitHub URL with www prefix."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.github.com/user/repo') == 'github'

    def test_github_url_with_path(self):
        """Test GitHub URL with deep path."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('http://github.com/user/repo/tree/main') == 'github'

    def test_youtube_url_basic(self):
        """Test basic YouTube URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://youtube.com/watch?v=abc123') == 'youtube'

    def test_youtube_url_with_www(self):
        """Test YouTube URL with www prefix."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.youtube.com/watch?v=abc123') == 'youtube'

    def test_youtube_short_url(self):
        """Test YouTube short URL (youtu.be)."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://youtu.be/abc123') == 'youtube'

    def test_figma_url_basic(self):
        """Test basic Figma URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://figma.com/file/abc') == 'figma'

    def test_figma_url_with_www(self):
        """Test Figma URL with www prefix."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.figma.com/design/abc') == 'figma'

    def test_gitlab_url_basic(self):
        """Test basic GitLab URL detection."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://gitlab.com/user/project') == 'gitlab'

    def test_gitlab_url_with_www(self):
        """Test GitLab URL with www prefix."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://www.gitlab.com/user/project') == 'gitlab'

    def test_gitlab_url_with_subgroup(self):
        """Test GitLab URL with subgroups."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://gitlab.com/group/subgroup/project') == 'gitlab'

    def test_generic_url_example_com(self):
        """Test generic URL detection for example.com."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://example.com') == 'generic'

    def test_generic_url_medium(self):
        """Test generic URL detection for medium.com."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://medium.com/article') == 'generic'

    def test_generic_url_random_site(self):
        """Test generic URL detection for random sites."""
        from services.agents.project.tools import _detect_url_domain_type

        assert _detect_url_domain_type('https://myawesomeproject.io/demo') == 'generic'


@pytest.mark.django_db
class TestHandleGitHubImport:
    """TDD Phase 2: GitHub handler tests.

    These tests should FAIL initially until _handle_github_import is implemented.
    """

    def test_no_oauth_token_asks_to_connect(self, mock_user, agent_state):
        """User without GitHub OAuth should be prompted to connect or clip."""
        from services.agents.project.tools import _handle_github_import

        with patch('core.integrations.github.helpers.get_user_github_token', return_value=None):
            result = _handle_github_import(
                url='https://github.com/jlowin/fastmcp',
                user=mock_user,
                is_showcase=True,
                is_private=False,
                state=agent_state,
            )

            # Should return needs_github_connection flag instead of auto-clipping
            assert result['success'] is False
            assert result['needs_github_connection'] is True
            assert 'message' in result
            # Message should explain options: connect GitHub or clip
            assert 'github' in result['message'].lower()

    def test_user_does_not_own_repo_auto_clips(self, mock_user, agent_state):
        """User with OAuth but doesn't own repo should auto-clip."""
        from services.agents.project.tools import _handle_github_import

        with patch('core.integrations.github.helpers.get_user_github_token', return_value='token123'):
            with patch('core.integrations.github.service.GitHubService') as MockGitHubService:
                mock_service = Mock()
                mock_service.verify_repo_access_sync.return_value = False
                MockGitHubService.return_value = mock_service

                with patch('services.agents.project.tools._handle_generic_import') as mock_generic:
                    mock_generic.return_value = {
                        'success': True,
                        'url': f'/{mock_user.username}/fastmcp',
                        'project_type': 'clipped',
                    }

                    result = _handle_github_import(
                        url='https://github.com/jlowin/fastmcp',
                        user=mock_user,
                        is_showcase=True,
                        is_private=False,
                        state=agent_state,
                    )

                    assert result['success'] is True
                    assert result['auto_clipped'] is True
                    assert 'message' in result

    def test_user_owns_repo_full_import(self, mock_user, agent_state):
        """User who owns repo gets full GitHub import with AI analysis."""
        from services.agents.project.tools import _handle_github_import

        with patch('core.integrations.github.helpers.get_user_github_token', return_value='token123'):
            with patch('core.integrations.github.service.GitHubService') as MockGitHubService:
                mock_service = Mock()
                mock_service.verify_repo_access_sync.return_value = True
                MockGitHubService.return_value = mock_service

                with patch('services.agents.project.tools._full_github_import') as mock_full:
                    mock_full.return_value = {
                        'success': True,
                        'url': f'/{mock_user.username}/my-repo',
                        'project_type': 'github_repo',
                        'title': 'My Repo',
                    }

                    result = _handle_github_import(
                        url=f'https://github.com/{mock_user.username}/my-repo',
                        user=mock_user,
                        is_showcase=True,
                        is_private=False,
                        state=agent_state,
                    )

                    assert result['success'] is True
                    assert result.get('auto_clipped') is not True
                    assert result['project_type'] == 'github_repo'


@pytest.mark.django_db
class TestHandleGenericImport:
    """TDD Phase 3: Generic handler tests.

    These tests should FAIL initially until _handle_generic_import is implemented.
    """

    def test_no_ownership_returns_confirmation_needed(self, mock_user, agent_state):
        """When is_owned is None, should return needs_ownership_confirmation."""
        from services.agents.project.tools import _handle_generic_import

        result = _handle_generic_import(
            url='https://example.com/cool-project',
            user=mock_user,
            is_owned=None,
            is_showcase=True,
            is_private=False,
            state=agent_state,
        )

        assert result['success'] is False
        assert result['needs_ownership_confirmation'] is True
        assert 'message' in result

    def test_owned_true_creates_project(self, mock_user, agent_state):
        """When is_owned=True, should create project with is_owned=True."""
        from services.agents.project.tools import _handle_generic_import
        from services.url_import.scraper import ExtractedProjectData

        # Use the real dataclass
        mock_extracted = ExtractedProjectData(
            title='Cool Project',
            description='A cool project',
            image_url='https://example.com/image.jpg',
            topics=[],
            features=[],
            organization=None,
            images=[],
            videos=[],
            links={},
            published_date=None,
        )

        with patch('services.url_import.scrape_url_for_project', return_value=mock_extracted):
            with patch('services.url_import.scraper.fetch_webpage', return_value='<html></html>'):
                with patch('services.url_import.scraper.html_to_text', return_value=''):
                    with patch('services.url_import.analyze_webpage_for_template') as mock_analyze:
                        mock_analyze.return_value = {
                            'templateVersion': 2,
                            'sections': [],
                            'description': 'A cool project',
                        }

                        with patch('core.projects.models.Project.objects.create') as mock_create:
                            mock_project = Mock()
                            mock_project.id = 456
                            mock_project.slug = 'cool-project'
                            mock_project.title = 'Cool Project'
                            mock_project.user.username = mock_user.username
                            mock_create.return_value = mock_project

                            with patch('core.integrations.github.helpers.apply_ai_metadata'):
                                result = _handle_generic_import(
                                    url='https://example.com/cool-project',
                                    user=mock_user,
                                    is_owned=True,
                                    is_showcase=True,
                                    is_private=False,
                                    state=agent_state,
                                )

                                assert result['success'] is True
                                assert 'url' in result

    def test_owned_false_creates_clipping(self, mock_user, agent_state):
        """When is_owned=False, should create clipping with project_type='clipped'."""
        from services.agents.project.tools import _handle_generic_import
        from services.url_import.scraper import ExtractedProjectData

        mock_extracted = ExtractedProjectData(
            title='Interesting Article',
            description='Found this on the web',
            image_url='https://example.com/image.jpg',
            topics=[],
            features=[],
            organization=None,
            images=[],
            videos=[],
            links={},
            published_date=None,
        )

        with patch('services.url_import.scrape_url_for_project', return_value=mock_extracted):
            with patch('services.url_import.scraper.fetch_webpage', return_value='<html></html>'):
                with patch('services.url_import.scraper.html_to_text', return_value=''):
                    with patch('services.url_import.analyze_webpage_for_template') as mock_analyze:
                        mock_analyze.return_value = {
                            'templateVersion': 2,
                            'sections': [],
                            'description': 'Found this on the web',
                        }

                        with patch('core.projects.models.Project.objects.create') as mock_create:
                            mock_project = Mock()
                            mock_project.id = 789
                            mock_project.slug = 'interesting-article'
                            mock_project.title = 'Interesting Article'
                            mock_project.user.username = mock_user.username
                            mock_create.return_value = mock_project

                            with patch('core.integrations.github.helpers.apply_ai_metadata'):
                                result = _handle_generic_import(
                                    url='https://medium.com/interesting-article',
                                    user=mock_user,
                                    is_owned=False,
                                    is_showcase=True,
                                    is_private=False,
                                    state=agent_state,
                                )

                                assert result['success'] is True
                                assert result['project_type'] == 'clipped'


# NOTE: Caching was removed from import_from_url because it caused issues:
# - Returning cached results meant returning stale project_ids without creating new projects
# - Users expected a new import each time, not a cached reference to an old project


@pytest.mark.django_db
class TestImportFromURLTool:
    """TDD Phase 5: Full import_from_url tool integration tests."""

    def test_import_github_url_routes_to_github_handler(self, mock_user, agent_state):
        """GitHub URLs should route to _handle_github_import."""
        from services.agents.project.tools import import_from_url

        with patch('services.agents.project.tools._handle_github_import') as mock_handler:
            mock_handler.return_value = {
                'success': True,
                'url': f'/{mock_user.username}/fastmcp',
            }

            import_from_url.func(
                url='https://github.com/jlowin/fastmcp',
                state=agent_state,
            )

            mock_handler.assert_called_once()

    def test_import_youtube_url_routes_to_youtube_handler(self, mock_user, agent_state):
        """YouTube URLs should route to _handle_youtube_import."""
        from services.agents.project.tools import import_from_url

        with patch('services.agents.project.tools._handle_youtube_import') as mock_handler:
            mock_handler.return_value = {
                'success': True,
                'url': f'/{mock_user.username}/cool-video',
            }

            import_from_url.func(
                url='https://youtube.com/watch?v=abc123',
                state=agent_state,
            )

            mock_handler.assert_called_once()

    def test_import_generic_url_routes_to_generic_handler(self, mock_user, agent_state):
        """Generic URLs should route to _handle_generic_import."""
        from services.agents.project.tools import import_from_url

        with patch('services.agents.project.tools._handle_generic_import') as mock_handler:
            mock_handler.return_value = {
                'success': False,
                'needs_ownership_confirmation': True,
                'message': 'Is this your project?',
            }

            import_from_url.func(
                url='https://example.com/cool-project',
                state=agent_state,
            )

            mock_handler.assert_called_once()

    def test_import_from_url_no_state_fails(self):
        """Import without state should fail gracefully."""
        from services.agents.project.tools import import_from_url

        result = import_from_url.func(
            url='https://github.com/jlowin/fastmcp',
            state=None,
        )

        assert result['success'] is False
        assert 'not authenticated' in result['error'].lower()
