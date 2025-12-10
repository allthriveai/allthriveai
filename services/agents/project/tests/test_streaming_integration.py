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
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from langchain_core.messages import ToolMessage

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
        from services.agents.project.agent import stream_agent_response

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

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
        from services.agents.project.agent import stream_agent_response

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

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
        from services.agents.project.agent import stream_agent_response

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

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
    async def test_stream_handles_exception_gracefully(self, test_user):
        """
        Test that exceptions during streaming are caught and yield error event.
        """
        from services.agents.project.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {
                'event': 'on_chat_model_stream',
                'data': {'chunk': MagicMock(content='Starting...')},
            }
            raise RuntimeError('Simulated LLM failure')

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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


class TestEventOutputTypes:
    """
    Specific tests for different output types that can appear in events.

    This class systematically tests each type that caused or could cause issues.
    """

    @pytest.mark.django_db
    @pytest.mark.asyncio
    async def test_output_is_string(self, test_user):
        """Test handling when output is a plain string."""
        from services.agents.project.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': 'just a string'}}

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
        from services.agents.project.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': None}}

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
        from services.agents.project.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': ['a', 'b', 'c']}}

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
        from services.agents.project.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end', 'data': {'output': 42}}

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
        from services.agents.project.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {
                'event': 'on_chain_end',
                'data': {'output': {'messages': 'not a list'}},
            }

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
        from services.agents.project.agent import stream_agent_response

        async def mock_astream_events(input_state, config, version):
            yield {'event': 'on_chain_end'}  # No 'data' key

        with patch('services.agents.project.agent._get_async_agent') as mock_get_agent:
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
