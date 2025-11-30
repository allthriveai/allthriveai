"""
End-to-end test for project creation via chat.

This test simulates the complete flow:
1. User sends GitHub URL
2. Agent fetches metadata
3. User confirms creation
4. Project is created in database

Run with: pytest services/project_agent/tests/test_e2e_project_creation.py -v -s
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def test_user(db):
    """Create a test user."""
    user, _ = User.objects.get_or_create(
        username='e2e_test_user',
        defaults={
            'email': 'e2e@test.com',
        },
    )
    if not user.has_usable_password():
        user.set_password('testpass123')
        user.save()
    return user


@pytest.fixture
def github_metadata():
    """Mock GitHub API response."""
    return {
        'success': True,
        'title': 'weave-cli',
        'description': 'A CLI for vector databases',
        'language': 'Go',
        'stars': 12,
        'forks': 1,
        'topics': ['cli', 'vector-database'],
        'homepage': '',
        'project_type': 'github_repo',
    }


@pytest.fixture
def mock_llm_responses():
    """Mock LLM responses for the conversation flow."""
    # First response: LLM sees URL, calls fetch_github_metadata
    first_response = MagicMock()
    first_response.content = ''
    first_response.tool_calls = [
        {
            'id': 'call_1',
            'name': 'fetch_github_metadata',
            'args': {'url': 'https://github.com/maximilien/weave-cli'},
        }
    ]

    # Second response: LLM received metadata, asks user about showcase
    second_response = MagicMock()
    second_response.content = "I found your repo 'weave-cli'! Would you like to add it to Showcase or Playground?"
    second_response.tool_calls = []

    # Third response: User said "showcase", LLM calls create_project
    third_response = MagicMock()
    third_response.content = ''
    third_response.tool_calls = [
        {
            'id': 'call_2',
            'name': 'create_project',
            'args': {
                'title': 'weave-cli',
                'project_type': 'github_repo',
                'description': 'A CLI for vector databases',
                'is_showcase': True,
            },
        }
    ]

    # Fourth response: LLM confirms project creation
    fourth_response = MagicMock()
    fourth_response.content = "I've added 'weave-cli' to your Showcase!"
    fourth_response.tool_calls = []

    return [first_response, second_response, third_response, fourth_response]


class TestProjectCreationE2E:
    """End-to-end tests for project creation flow."""

    @pytest.mark.django_db
    def test_complete_project_creation_flow(self, test_user, github_metadata, mock_llm_responses):
        """
        Test the complete flow from GitHub URL to project creation.

        This test verifies:
        1. fetch_github_metadata tool is called with correct URL
        2. create_project tool is called with correct args
        3. Project is actually created in database
        4. Project has correct attributes
        """
        from core.projects.models import Project
        from services.project_agent.tools import create_project, fetch_github_metadata

        # Step 1: Test fetch_github_metadata directly
        with patch('services.project_agent.tools.requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'name': 'weave-cli',
                'description': 'A CLI for vector databases',
                'language': 'Go',
                'stargazers_count': 12,
                'forks_count': 1,
                'topics': ['cli', 'vector-database'],
                'homepage': '',
            }
            mock_get.return_value = mock_response

            with patch('services.project_agent.tools.cache') as mock_cache:
                mock_cache.get.return_value = None  # No cached result

                result = fetch_github_metadata.invoke({'url': 'https://github.com/maximilien/weave-cli'})

                assert result['success'] is True
                assert result['title'] == 'weave-cli'
                assert result['project_type'] == 'github_repo'
                print(f'✓ fetch_github_metadata returned: {result}')

        # Step 2: Test create_project directly with state injection
        state = {
            'user_id': test_user.id,
            'username': test_user.username,
        }

        result = create_project.func(
            title='weave-cli',
            project_type='github_repo',
            description='A CLI for vector databases',
            is_showcase=True,
            state=state,
        )

        assert result['success'] is True, f"create_project failed: {result.get('error')}"
        assert 'project_id' in result
        print(f'✓ create_project returned: {result}')

        # Step 3: Verify project in database
        project = Project.objects.get(id=result['project_id'])
        assert project.title == 'weave-cli'
        assert project.type == 'github_repo'
        assert project.description == 'A CLI for vector databases'
        assert project.is_showcase is True
        assert project.user == test_user
        print(f'✓ Project created in DB: {project.id} - {project.title}')

        # Cleanup
        project.delete()
        print('✓ Project cleaned up')

    @pytest.mark.django_db
    def test_tool_node_state_injection(self, test_user):
        """Test that tool_node correctly injects state into tools."""
        import asyncio

        from services.project_agent.agent import tool_node

        # Create a mock AI message with tool call
        ai_message = MagicMock()
        ai_message.tool_calls = [
            {
                'id': 'test_call',
                'name': 'create_project',
                'args': {
                    'title': 'Test Project',
                    'project_type': 'other',
                    'description': 'Test description',
                    'is_showcase': False,
                },
            }
        ]

        state = {
            'messages': [ai_message],
            'user_id': test_user.id,
            'username': test_user.username,
        }

        # Run the async tool_node
        async def run_tool_node():
            return await tool_node(state)

        result = asyncio.run(run_tool_node())

        assert 'messages' in result
        assert len(result['messages']) == 1

        tool_message = result['messages'][0]
        content = json.loads(tool_message.content)

        assert content['success'] is True, f"Tool failed: {content.get('error')}"
        print('✓ tool_node correctly injected state and created project')

        # Cleanup
        from core.projects.models import Project

        Project.objects.filter(id=content['project_id']).delete()

    @pytest.mark.django_db
    def test_state_reducers_preserve_user_id(self, test_user):
        """Test that state reducers correctly preserve user_id across turns."""
        from services.project_agent.agent import keep_latest_or_existing, keep_latest_str_or_existing

        # Test keep_latest_or_existing
        assert keep_latest_or_existing(None, 123) == 123  # New value wins
        assert keep_latest_or_existing(123, None) == 123  # Existing preserved
        assert keep_latest_or_existing(123, 456) == 456  # New value wins
        assert keep_latest_or_existing(None, None) is None  # Both None

        # Test keep_latest_str_or_existing
        assert keep_latest_str_or_existing(None, 'new') == 'new'
        assert keep_latest_str_or_existing('old', None) == 'old'
        assert keep_latest_str_or_existing('old', '') == 'old'  # Empty string preserves existing
        assert keep_latest_str_or_existing('old', 'new') == 'new'

        print('✓ State reducers work correctly')

    @pytest.mark.django_db
    def test_project_service_creates_project(self, test_user):
        """Test ProjectService.create_project directly."""
        from services.project_service import ProjectService

        project, error = ProjectService.create_project(
            user_id=test_user.id,
            title='Direct Service Test',
            project_type='github_repo',
            description='Created via ProjectService',
            is_showcase=True,
        )

        assert error is None, f'ProjectService error: {error}'
        assert project is not None
        assert project.title == 'Direct Service Test'
        assert project.type == 'github_repo'
        assert project.is_showcase is True

        print(f'✓ ProjectService created project: {project.id}')

        # Cleanup
        project.delete()

    @pytest.mark.django_db
    def test_project_service_validates_type(self, test_user):
        """Test that ProjectService validates project type."""
        from services.project_service import ProjectService

        project, error = ProjectService.create_project(
            user_id=test_user.id,
            title='Invalid Type Test',
            project_type='invalid_type',  # Not in VALID_TYPES
            description='Should fail',
        )

        assert project is None
        assert error is not None
        assert 'Invalid project type' in error
        print(f'✓ ProjectService correctly rejected invalid type: {error}')

    @pytest.mark.django_db
    def test_create_project_without_state_fails(self):
        """Test that create_project fails without state."""
        from services.project_agent.tools import create_project

        result = create_project.func(
            title='No State Test',
            project_type='other',
            state=None,
        )

        assert result['success'] is False
        assert 'not authenticated' in result['error'].lower()
        print('✓ create_project correctly rejects missing state')

    @pytest.mark.django_db
    def test_create_project_without_user_id_fails(self):
        """Test that create_project fails without user_id in state."""
        from services.project_agent.tools import create_project

        result = create_project.func(
            title='No User ID Test',
            project_type='other',
            state={'username': 'test'},  # Missing user_id
        )

        assert result['success'] is False
        assert 'not authenticated' in result['error'].lower()
        print('✓ create_project correctly rejects state without user_id')


class TestGitHubMetadataFetching:
    """Tests for GitHub metadata fetching."""

    def test_fetch_github_metadata_success(self):
        """Test successful GitHub metadata fetch."""
        from services.project_agent.tools import fetch_github_metadata

        with patch('services.project_agent.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = True

            with patch('services.project_agent.tools.cache') as mock_cache:
                mock_cache.get.return_value = None

                with patch('services.project_agent.tools.requests.get') as mock_get:
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_response.json.return_value = {
                        'name': 'test-repo',
                        'description': 'Test description',
                        'language': 'Python',
                        'stargazers_count': 100,
                        'forks_count': 10,
                        'topics': ['test'],
                        'homepage': '',
                    }
                    mock_get.return_value = mock_response

                    result = fetch_github_metadata.invoke({'url': 'https://github.com/user/test-repo'})

                    assert result['success'] is True
                    assert result['title'] == 'test-repo'
                    print(f"✓ fetch_github_metadata works: {result['title']}")

    def test_fetch_github_metadata_invalid_url(self):
        """Test that invalid URLs are rejected."""
        from services.project_agent.tools import fetch_github_metadata

        with patch('services.project_agent.tools.ProjectService') as mock_service:
            mock_service.is_github_url.return_value = False

            result = fetch_github_metadata.invoke({'url': 'https://not-github.com/repo'})

            assert result['success'] is False
            assert 'invalid' in result['error'].lower()
            print('✓ fetch_github_metadata rejects invalid URLs')


class TestIntegration:
    """Integration tests that verify components work together."""

    @pytest.mark.django_db
    def test_full_conversation_simulation(self, test_user, github_metadata):
        """
        Simulate a full conversation without the LLM.

        This tests the flow:
        1. User message with GitHub URL
        2. Tool execution: fetch_github_metadata
        3. User confirmation: "showcase"
        4. Tool execution: create_project
        """
        from core.projects.models import Project
        from services.project_agent.tools import create_project, fetch_github_metadata

        # Simulate the conversation flow
        conversation = []

        # Turn 1: User sends GitHub URL
        user_msg_1 = 'https://github.com/maximilien/weave-cli'
        conversation.append(('user', user_msg_1))
        print('\n--- Turn 1: User sends URL ---')
        print(f'User: {user_msg_1}')

        # Agent would detect URL and call fetch_github_metadata
        with patch('services.project_agent.tools.requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'name': 'weave-cli',
                'description': 'A CLI for vector databases',
                'language': 'Go',
                'stargazers_count': 12,
                'forks_count': 1,
                'topics': ['cli'],
                'homepage': '',
            }
            mock_get.return_value = mock_response

            with patch('services.project_agent.tools.cache') as mock_cache:
                mock_cache.get.return_value = None

                metadata = fetch_github_metadata.invoke({'url': user_msg_1})

        assert metadata['success'] is True
        conversation.append(('tool', f'fetch_github_metadata: {metadata}'))
        print(f"Tool: fetch_github_metadata -> {metadata['title']}")

        # Agent response asking about showcase
        agent_response_1 = f"Found '{metadata['title']}'! Showcase or Playground?"
        conversation.append(('agent', agent_response_1))
        print(f'Agent: {agent_response_1}')

        # Turn 2: User says "showcase"
        user_msg_2 = 'showcase'
        conversation.append(('user', user_msg_2))
        print('\n--- Turn 2: User confirms showcase ---')
        print(f'User: {user_msg_2}')

        # Agent calls create_project
        state = {'user_id': test_user.id, 'username': test_user.username}
        result = create_project.func(
            title=metadata['title'],
            project_type=metadata['project_type'],
            description=metadata['description'],
            is_showcase=True,
            state=state,
        )

        assert result['success'] is True, f"create_project failed: {result.get('error')}"
        conversation.append(('tool', f'create_project: {result}'))
        print(f"Tool: create_project -> project_id={result['project_id']}")

        # Agent confirms
        agent_response_2 = f"Created '{metadata['title']}' in your Showcase!"
        conversation.append(('agent', agent_response_2))
        print(f'Agent: {agent_response_2}')

        # Verify project exists
        project = Project.objects.get(id=result['project_id'])
        assert project.title == 'weave-cli'
        assert project.is_showcase is True
        print('\n✓ Full conversation simulation successful!')
        print(f'✓ Project created: {project.id} - {project.title}')

        # Cleanup
        project.delete()
        print('✓ Cleanup complete')


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
