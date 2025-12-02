"""
Real integration tests for project agent streaming.

These tests exercise the ACTUAL streaming pipeline with minimal mocking:
- Real LangGraph agent execution
- Real event streaming via astream_events
- Real tool execution
- Only mock: external APIs (LLM, GitHub API)

This catches bugs like:
- TypeError when parsing event outputs of different types
- Missing event handling for edge cases
- State management issues across streaming

Run with: uv run pytest services/project_agent/tests/test_streaming_integration.py -v -s
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from langchain_core.messages import AIMessage, ToolMessage

User = get_user_model()


@pytest.fixture
def test_user(db):
    """Create a real test user in the database."""
    user, _ = User.objects.get_or_create(
        username='streaming_test_user',
        defaults={'email': 'streaming@test.com'},
    )
    return user


@pytest.fixture
def mock_github_api_response():
    """Mock response from GitHub API."""
    return {
        'name': 'test-repo',
        'description': 'A test repository',
        'language': 'Python',
        'stargazers_count': 42,
        'forks_count': 7,
        'topics': ['testing', 'python'],
        'homepage': '',
    }


class TestStreamingIntegration:
    """
    Integration tests that exercise the real streaming pipeline.

    These tests verify that stream_agent_response correctly handles
    all types of events from astream_events, including edge cases
    that caused the "'str' object has no attribute 'get'" error.
    """

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_stream_handles_various_output_types(self, test_user):
        """
        Test that streaming handles various event output types without crashing.

        This is the critical test that would have caught the 'str' object bug.
        LangGraph's astream_events can emit events with output that is:
        - dict with messages
        - dict without messages
        - string
        - list
        - None
        """
        from services.project_agent.agent import stream_agent_response

        # Create a mock agent that emits various event types
        async def mock_astream_events(input_state, config, version):
            # Event with string output (this caused the bug!)
            yield {
                'event': 'on_chain_end',
                'data': {'output': 'some string output'},
            }
            # Event with None output
            yield {
                'event': 'on_chain_end',
                'data': {'output': None},
            }
            # Event with list output
            yield {
                'event': 'on_chain_end',
                'data': {'output': ['item1', 'item2']},
            }
            # Event with empty dict
            yield {
                'event': 'on_chain_end',
                'data': {'output': {}},
            }
            # Event with dict but no messages key
            yield {
                'event': 'on_chain_end',
                'data': {'output': {'some_key': 'some_value'}},
            }
            # Event with dict and messages but messages is a string
            yield {
                'event': 'on_chain_end',
                'data': {'output': {'messages': 'not a list'}},
            }
            # Valid token event
            yield {
                'event': 'on_chat_model_stream',
                'data': {'chunk': MagicMock(content='Hello')},
            }

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            # This should NOT raise "'str' object has no attribute 'get'"
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test-session',
            ):
                events.append(event)

            # Should complete without error
            assert any(e['type'] == 'complete' for e in events)
            # Should have yielded the token
            token_events = [e for e in events if e['type'] == 'token']
            assert len(token_events) == 1
            assert token_events[0]['content'] == 'Hello'

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_stream_extracts_tool_results_from_chain_end(self, test_user):
        """
        Test that tool results from custom tool_node are correctly extracted
        from on_chain_end events via ToolMessage parsing.
        """
        from services.project_agent.agent import stream_agent_response

        # Create a ToolMessage like what our custom tool_node produces
        tool_message = ToolMessage(
            content=json.dumps(
                {
                    'success': True,
                    'project_id': 123,
                    'slug': 'test-project',
                    'title': 'Test Project',
                    'url': '/testuser/test-project',
                }
            ),
            tool_call_id='call_123',
            name='create_project',
        )

        async def mock_astream_events(input_state, config, version):
            # Emit chain_end with ToolMessage in output
            yield {
                'event': 'on_chain_end',
                'data': {
                    'output': {
                        'messages': [tool_message],
                    }
                },
            }

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='create my project',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test-session',
            ):
                events.append(event)

            # Should have extracted tool_start and tool_end events
            tool_start = [e for e in events if e['type'] == 'tool_start']
            tool_end = [e for e in events if e['type'] == 'tool_end']

            assert len(tool_start) == 1
            assert tool_start[0]['tool'] == 'create_project'

            assert len(tool_end) == 1
            assert tool_end[0]['tool'] == 'create_project'
            assert tool_end[0]['output']['success'] is True
            assert tool_end[0]['output']['project_id'] == 123

            # Complete event should indicate project was created
            complete = [e for e in events if e['type'] == 'complete'][0]
            assert complete['project_created'] is True

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_stream_handles_malformed_tool_message_content(self, test_user):
        """
        Test that streaming handles ToolMessages with non-JSON content gracefully.
        """
        from services.project_agent.agent import stream_agent_response

        # ToolMessage with non-JSON content
        tool_message = ToolMessage(
            content='This is not JSON',
            tool_call_id='call_123',
            name='some_tool',
        )

        async def mock_astream_events(input_state, config, version):
            yield {
                'event': 'on_chain_end',
                'data': {
                    'output': {
                        'messages': [tool_message],
                    }
                },
            }

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            # Should not crash on non-JSON content
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test-session',
            ):
                events.append(event)

            # Should have handled it gracefully with raw content
            tool_end = [e for e in events if e['type'] == 'tool_end']
            assert len(tool_end) == 1
            assert 'raw' in tool_end[0]['output']

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_stream_handles_standard_tool_events(self, test_user):
        """
        Test that standard on_tool_start and on_tool_end events are handled.
        """
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {
                'event': 'on_tool_start',
                'name': 'fetch_github_metadata',
                'data': {},
            }
            yield {
                'event': 'on_tool_end',
                'name': 'fetch_github_metadata',
                'data': {
                    'output': {
                        'success': True,
                        'title': 'My Repo',
                        'language': 'Python',
                    }
                },
            }

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='https://github.com/user/repo',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test-session',
            ):
                events.append(event)

            tool_start = [e for e in events if e['type'] == 'tool_start']
            tool_end = [e for e in events if e['type'] == 'tool_end']

            assert len(tool_start) == 1
            assert tool_start[0]['tool'] == 'fetch_github_metadata'

            assert len(tool_end) == 1
            assert tool_end[0]['output']['success'] is True

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_stream_handles_exception_gracefully(self, test_user):
        """
        Test that exceptions during streaming are caught and yield error event.
        """
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {
                'event': 'on_chat_model_stream',
                'data': {'chunk': MagicMock(content='Starting...')},
            }
            raise RuntimeError('Simulated LLM failure')

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test-session',
            ):
                events.append(event)

            # Should have an error event
            error_events = [e for e in events if e['type'] == 'error']
            assert len(error_events) == 1
            assert 'Simulated LLM failure' in error_events[0]['message']


class TestRealAgentExecution:
    """
    Tests that execute the real LangGraph agent with mocked LLM.

    These tests exercise the full agent graph execution, not just
    the streaming wrapper, to ensure the entire pipeline works.
    """

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_real_agent_with_mocked_llm(self, test_user, mock_github_api_response):
        """
        Test the real agent execution with a mocked LLM.

        This exercises:
        - Real LangGraph StateGraph execution
        - Real tool_node state injection
        - Real message handling
        - Only LLM calls are mocked
        """

        from services.project_agent.agent import stream_agent_response

        # Mock the LLM to return a tool call for fetch_github_metadata
        # Use proper AIMessage with tool_calls
        mock_ai_response = AIMessage(
            content='',
            tool_calls=[
                {
                    'id': 'call_github',
                    'name': 'fetch_github_metadata',
                    'args': {'url': 'https://github.com/test/repo'},
                }
            ],
        )

        # Second response after tool execution
        mock_ai_response_2 = AIMessage(
            content='I found your repository! Would you like to add it?',
            tool_calls=[],
        )

        with patch('services.project_agent.agent.llm_with_tools') as mock_llm:
            mock_llm.ainvoke = AsyncMock(side_effect=[mock_ai_response, mock_ai_response_2])

            with patch('services.project_agent.tools.requests.get') as mock_requests:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_github_api_response
                mock_requests.return_value = mock_response

                with patch('services.project_agent.tools.cache') as mock_cache:
                    mock_cache.get.return_value = None

                    events = []
                    async for event in stream_agent_response(
                        user_message='https://github.com/test/repo',
                        user_id=test_user.id,
                        username=test_user.username,
                        session_id='test-real-agent',
                    ):
                        events.append(event)
                        print(
                            f'Event: {event["type"]}',
                            event.get('tool', ''),
                            event.get('content', '')[:50] if event.get('content') else '',
                        )

            # Verify we got tool events
            tool_events = [e for e in events if e['type'] in ('tool_start', 'tool_end')]
            assert len(tool_events) >= 2, f'Expected tool events, got: {[e["type"] for e in events]}'

            # Verify complete event
            complete = [e for e in events if e['type'] == 'complete']
            assert len(complete) == 1

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_full_project_creation_flow(self, mock_github_api_response):
        """
        Test the complete flow: GitHub URL -> metadata fetch -> project creation.

        This is the most important test - it verifies the entire pipeline
        works end-to-end with real agent execution.
        """
        from asgiref.sync import sync_to_async
        from django.contrib.auth import get_user_model

        from core.projects.models import Project
        from services.project_agent.agent import stream_agent_response

        User = get_user_model()

        # Create a fresh user for this test to avoid ID mismatch issues
        # The tool_node runs in a thread with its own DB connection
        # Use sync_to_async to create user from async context
        @sync_to_async
        def create_test_user():
            return User.objects.create_user(
                username='fullflow_test_user',
                email='fullflow@test.com',
                password='testpass123',
            )

        @sync_to_async
        def get_project(user, title):
            return Project.objects.filter(user=user, title=title).first()

        @sync_to_async
        def delete_project(project):
            if project:
                project.delete()

        @sync_to_async
        def delete_user(user):
            user.delete()

        test_user = await create_test_user()

        try:
            # First LLM call: decide to fetch GitHub metadata
            first_response = AIMessage(
                content='',
                tool_calls=[
                    {
                        'id': 'call_1',
                        'name': 'fetch_github_metadata',
                        'args': {'url': 'https://github.com/test/repo'},
                    }
                ],
            )

            # Second LLM call: after getting metadata, ask about showcase
            second_response = AIMessage(
                content="I found 'test-repo'! Add to Showcase?",
                tool_calls=[],
            )

            with patch('services.project_agent.agent.llm_with_tools') as mock_llm:
                mock_llm.ainvoke = AsyncMock(side_effect=[first_response, second_response])

                with patch('services.project_agent.tools.requests.get') as mock_requests:
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_response.json.return_value = mock_github_api_response
                    mock_requests.return_value = mock_response

                    with patch('services.project_agent.tools.cache') as mock_cache:
                        mock_cache.get.return_value = None

                        events = []
                        async for event in stream_agent_response(
                            user_message='https://github.com/test/repo',
                            user_id=test_user.id,
                            username=test_user.username,
                            session_id='test-full-flow-1',
                        ):
                            events.append(event)

            # Verify the flow completed
            assert any(e['type'] == 'complete' for e in events)

            # Now simulate the second turn where user says "showcase"
            # and agent creates the project
            third_response = AIMessage(
                content='',
                tool_calls=[
                    {
                        'id': 'call_2',
                        'name': 'create_project',
                        'args': {
                            'title': 'test-repo',
                            'project_type': 'github_repo',
                            'description': 'A test repository',
                            'is_showcase': True,
                            'external_url': 'https://github.com/test/repo',
                            'language': 'Python',
                            'topics': ['testing', 'python'],
                            'stars': 42,
                            'forks': 7,
                        },
                    }
                ],
            )

            fourth_response = AIMessage(
                content="Created 'test-repo' in your Showcase!",
                tool_calls=[],
            )

            with patch('services.project_agent.agent.llm_with_tools') as mock_llm:
                mock_llm.ainvoke = AsyncMock(side_effect=[third_response, fourth_response])

                events = []
                async for event in stream_agent_response(
                    user_message='showcase',
                    user_id=test_user.id,
                    username=test_user.username,
                    session_id='test-full-flow-2',
                ):
                    events.append(event)

            # Verify project was created
            complete_event = [e for e in events if e['type'] == 'complete'][0]
            assert complete_event['project_created'] is True, f'Project not created. Events: {events}'

            # Verify project exists in database with correct fields
            project = await get_project(test_user, 'test-repo')
            assert project is not None, 'Project was not created in database'
            assert project.type == 'github_repo'
            assert project.is_showcase is True
            assert project.external_url == 'https://github.com/test/repo'
            assert 'testing' in project.topics
            assert project.content.get('github', {}).get('language') == 'Python'
            assert project.content.get('github', {}).get('stars') == 42

            # Cleanup
            await delete_project(project)

        finally:
            # Always cleanup the test user
            await delete_user(test_user)


class TestEventOutputTypes:
    """
    Specific tests for different output types that can appear in events.

    This class systematically tests each type that caused or could cause issues.
    """

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_output_is_string(self, test_user):
        """Test handling when output is a plain string."""
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': 'just a string'}}

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test',
            ):
                events.append(event)

            assert any(e['type'] == 'complete' for e in events)

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_output_is_none(self, test_user):
        """Test handling when output is None."""
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': None}}

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test',
            ):
                events.append(event)

            assert any(e['type'] == 'complete' for e in events)

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_output_is_list(self, test_user):
        """Test handling when output is a list."""
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': ['a', 'b', 'c']}}

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test',
            ):
                events.append(event)

            assert any(e['type'] == 'complete' for e in events)

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_output_is_integer(self, test_user):
        """Test handling when output is an integer."""
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': 42}}

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test',
            ):
                events.append(event)

            assert any(e['type'] == 'complete' for e in events)

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_messages_is_not_list(self, test_user):
        """Test handling when messages exists but is not a list."""
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {
                'event': 'on_chain_end',
                'data': {'output': {'messages': 'not a list'}},
            }

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test',
            ):
                events.append(event)

            assert any(e['type'] == 'complete' for e in events)

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_data_key_missing(self, test_user):
        """Test handling when data key is missing from event."""
        from services.project_agent.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end'}  # No 'data' key

        with patch('services.project_agent.agent._get_async_agent') as mock_get_agent:
            mock_agent = MagicMock()
            mock_agent.astream_events = mock_astream_events
            mock_get_agent.return_value = mock_agent

            events = []
            async for event in stream_agent_response(
                user_message='test',
                user_id=test_user.id,
                username=test_user.username,
                session_id='test',
            ):
                events.append(event)

            assert any(e['type'] == 'complete' for e in events)


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
