"""
Tests for project agent graph and streaming.

Run with: pytest services/project_agent/tests/test_agent.py -v

Note: Async tests require pytest-asyncio. If not installed:
    pip install pytest-asyncio
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from services.project_agent.agent import (
    ProjectAgentState,
    agent_node,
    create_project_agent,
    should_continue,
    stream_agent_response,
)


class TestProjectAgentState:
    """Tests for ProjectAgentState TypedDict."""

    def test_state_structure(self, mock_user):
        """Test that state has required fields."""
        state: ProjectAgentState = {
            'messages': [HumanMessage(content='Hello')],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

        assert 'messages' in state
        assert 'user_id' in state
        assert 'username' in state
        assert len(state['messages']) == 1


class TestShouldContinue:
    """Tests for should_continue routing function."""

    def test_should_continue_to_tools(self, mock_user):
        """Test routing to tools when LLM makes tool calls."""
        mock_response = Mock()
        mock_response.tool_calls = [{'id': 'call_123', 'name': 'fetch_github_metadata', 'args': {}}]

        state = {
            'messages': [
                HumanMessage(content='https://github.com/user/repo'),
                mock_response,
            ],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

        result = should_continue(state)
        assert result == 'tools'

    def test_should_continue_to_end(self, mock_user):
        """Test routing to END when no tool calls."""
        mock_response = Mock()
        mock_response.tool_calls = []

        state = {
            'messages': [
                HumanMessage(content='Hello'),
                mock_response,
            ],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

        result = should_continue(state)
        assert result == '__end__'  # langgraph.graph.END

    def test_should_continue_no_tool_calls_attr(self, mock_user):
        """Test routing to END when message has no tool_calls attribute."""
        mock_response = Mock(spec=[])  # No tool_calls attribute

        state = {
            'messages': [
                HumanMessage(content='Hello'),
                mock_response,
            ],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

        result = should_continue(state)
        assert result == '__end__'

    def test_should_continue_empty_tool_calls(self, mock_user):
        """Test routing to END when tool_calls is empty list."""
        mock_response = Mock()
        mock_response.tool_calls = []

        state = {
            'messages': [mock_response],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

        result = should_continue(state)
        assert result == '__end__'


class TestCreateProjectAgent:
    """Tests for create_project_agent factory function."""

    def test_create_agent_returns_compiled_graph(self):
        """Test that factory returns a compiled graph."""
        with patch('services.project_agent.agent.get_llm') as mock_get_llm:
            mock_llm = Mock()
            mock_llm.bind_tools.return_value = mock_llm
            mock_get_llm.return_value = mock_llm

            agent = create_project_agent()

            # Should be a compiled StateGraph
            assert agent is not None
            assert hasattr(agent, 'invoke')
            assert hasattr(agent, 'astream')
            assert hasattr(agent, 'astream_events')


# Async tests - require pytest-asyncio
@pytest.mark.django_db
class TestAgentNodeAsync:
    """Tests for agent_node function (async)."""

    @pytest.mark.asyncio
    async def test_agent_node_adds_system_prompt(self, agent_state):
        """Test that agent_node adds system prompt if missing."""
        with patch('services.project_agent.agent.llm_with_tools') as mock_llm:
            mock_response = Mock()
            mock_response.content = "I'll help you create a project!"
            mock_response.tool_calls = []
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)

            result = await agent_node(agent_state)

            # Verify system prompt was added to messages
            call_args = mock_llm.ainvoke.call_args
            messages = call_args[0][0]
            assert any(isinstance(m, SystemMessage) for m in messages)

    @pytest.mark.asyncio
    async def test_agent_node_preserves_existing_system_prompt(self, mock_user):
        """Test that existing system prompt is not duplicated."""
        state = {
            'messages': [
                SystemMessage(content='Custom system prompt'),
                HumanMessage(content='Hello'),
            ],
            'user_id': mock_user.id,
            'username': mock_user.username,
        }

        with patch('services.project_agent.agent.llm_with_tools') as mock_llm:
            mock_response = Mock()
            mock_response.content = 'Hello!'
            mock_response.tool_calls = []
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)

            await agent_node(state)

            # Verify only one system message
            call_args = mock_llm.ainvoke.call_args
            messages = call_args[0][0]
            system_messages = [m for m in messages if isinstance(m, SystemMessage)]
            assert len(system_messages) == 1
            assert system_messages[0].content == 'Custom system prompt'

    @pytest.mark.asyncio
    async def test_agent_node_returns_response(self, agent_state):
        """Test that agent_node returns LLM response in messages."""
        with patch('services.project_agent.agent.llm_with_tools') as mock_llm:
            mock_response = Mock()
            mock_response.content = 'I found your GitHub repo!'
            mock_response.tool_calls = []
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)

            result = await agent_node(agent_state)

            assert 'messages' in result
            assert len(result['messages']) == 1
            assert result['messages'][0] == mock_response


@pytest.mark.django_db
class TestStreamAgentResponseAsync:
    """Tests for stream_agent_response async generator."""

    @pytest.mark.asyncio
    async def test_stream_yields_tokens(self, mock_user):
        """Test that streaming yields token events."""
        with patch('services.project_agent.agent.project_agent') as mock_agent:
            # Mock astream_events to yield token events
            async def mock_stream(*args, **kwargs):
                yield {
                    'event': 'on_chat_model_stream',
                    'data': {'chunk': Mock(content='Hello')},
                }
                yield {
                    'event': 'on_chat_model_stream',
                    'data': {'chunk': Mock(content=' world')},
                }

            mock_agent.astream_events = mock_stream
            mock_agent.get_state.return_value = Mock(values={'messages': []})

            events = []
            async for event in stream_agent_response(
                user_message='Test',
                user_id=mock_user.id,
                username=mock_user.username,
                session_id='test-session',
            ):
                events.append(event)

            # Should have token events + complete event
            token_events = [e for e in events if e['type'] == 'token']
            assert len(token_events) == 2
            assert token_events[0]['content'] == 'Hello'
            assert token_events[1]['content'] == ' world'

    @pytest.mark.asyncio
    async def test_stream_yields_tool_events(self, mock_user):
        """Test that streaming yields tool start/end events."""
        with patch('services.project_agent.agent.project_agent') as mock_agent:

            async def mock_stream(*args, **kwargs):
                yield {
                    'event': 'on_tool_start',
                    'name': 'fetch_github_metadata',
                    'data': {},
                }
                yield {
                    'event': 'on_tool_end',
                    'name': 'fetch_github_metadata',
                    'data': {'output': {'success': True, 'title': 'My Repo'}},
                }

            mock_agent.astream_events = mock_stream
            mock_agent.get_state.return_value = Mock(values={'messages': []})

            events = []
            async for event in stream_agent_response(
                user_message='https://github.com/user/repo',
                user_id=mock_user.id,
                username=mock_user.username,
                session_id='test-session',
            ):
                events.append(event)

            tool_start_events = [e for e in events if e['type'] == 'tool_start']
            tool_end_events = [e for e in events if e['type'] == 'tool_end']

            assert len(tool_start_events) == 1
            assert tool_start_events[0]['tool'] == 'fetch_github_metadata'
            assert len(tool_end_events) == 1
            assert tool_end_events[0]['output']['success'] is True

    @pytest.mark.asyncio
    async def test_stream_yields_complete_event(self, mock_user):
        """Test that streaming yields complete event at end."""
        with patch('services.project_agent.agent.project_agent') as mock_agent:

            async def mock_stream(*args, **kwargs):
                yield {
                    'event': 'on_chat_model_stream',
                    'data': {'chunk': Mock(content='Done!')},
                }

            mock_agent.astream_events = mock_stream
            mock_agent.get_state.return_value = Mock(values={'messages': []})

            events = []
            async for event in stream_agent_response(
                user_message='Test',
                user_id=mock_user.id,
                username=mock_user.username,
                session_id='test-session',
            ):
                events.append(event)

            complete_events = [e for e in events if e['type'] == 'complete']
            assert len(complete_events) == 1
            assert complete_events[0]['session_id'] == 'test-session'

    @pytest.mark.asyncio
    async def test_stream_detects_project_created(self, mock_user):
        """Test that streaming detects when project was created."""
        with patch('services.project_agent.agent.project_agent') as mock_agent:

            async def mock_stream(*args, **kwargs):
                yield {
                    'event': 'on_chat_model_stream',
                    'data': {'chunk': Mock(content='Created!')},
                }

            mock_agent.astream_events = mock_stream

            # Mock final state with ToolMessage containing project_id
            tool_message = ToolMessage(
                content='{"success": true, "project_id": 123}',
                tool_call_id='call_123',
            )
            mock_agent.get_state.return_value = Mock(values={'messages': [tool_message]})

            events = []
            async for event in stream_agent_response(
                user_message='Create project',
                user_id=mock_user.id,
                username=mock_user.username,
                session_id='test-session',
            ):
                events.append(event)

            complete_event = [e for e in events if e['type'] == 'complete'][0]
            assert complete_event['project_created'] is True

    @pytest.mark.asyncio
    async def test_stream_handles_error(self, mock_user):
        """Test that streaming handles errors gracefully."""
        with patch('services.project_agent.agent.project_agent') as mock_agent:

            async def mock_stream(*args, **kwargs):
                raise Exception('LLM API error')
                yield  # Make it a generator

            mock_agent.astream_events = mock_stream

            events = []
            async for event in stream_agent_response(
                user_message='Test',
                user_id=mock_user.id,
                username=mock_user.username,
                session_id='test-session',
            ):
                events.append(event)

            error_events = [e for e in events if e['type'] == 'error']
            assert len(error_events) == 1
            assert 'LLM API error' in error_events[0]['message']

    @pytest.mark.asyncio
    async def test_stream_skips_empty_content(self, mock_user):
        """Test that streaming skips empty content chunks."""
        with patch('services.project_agent.agent.project_agent') as mock_agent:

            async def mock_stream(*args, **kwargs):
                yield {
                    'event': 'on_chat_model_stream',
                    'data': {'chunk': Mock(content='')},  # Empty
                }
                yield {
                    'event': 'on_chat_model_stream',
                    'data': {'chunk': Mock(content='Hello')},  # Not empty
                }
                yield {
                    'event': 'on_chat_model_stream',
                    'data': {'chunk': Mock(content=None)},  # None
                }

            mock_agent.astream_events = mock_stream
            mock_agent.get_state.return_value = Mock(values={'messages': []})

            events = []
            async for event in stream_agent_response(
                user_message='Test',
                user_id=mock_user.id,
                username=mock_user.username,
                session_id='test-session',
            ):
                events.append(event)

            token_events = [e for e in events if e['type'] == 'token']
            assert len(token_events) == 1
            assert token_events[0]['content'] == 'Hello'


@pytest.mark.django_db
class TestAgentIntegrationAsync:
    """Integration tests for the full agent flow (mocked LLM)."""

    @pytest.mark.asyncio
    async def test_full_conversation_flow(self, mock_user):
        """Test a complete conversation flow with mocked components."""
        with patch('services.project_agent.agent.llm_with_tools') as mock_llm:
            # First call: LLM asks for URL
            response1 = Mock()
            response1.content = "I'd be happy to help! Please share your GitHub URL."
            response1.tool_calls = []

            # Second call: LLM makes tool call
            response2 = Mock()
            response2.content = ''
            response2.tool_calls = [
                {
                    'id': 'call_123',
                    'name': 'fetch_github_metadata',
                    'args': {'url': 'https://github.com/user/repo'},
                }
            ]

            mock_llm.ainvoke = AsyncMock(side_effect=[response1, response2])

            # Test first turn
            state1 = {
                'messages': [HumanMessage(content='I want to add a project')],
                'user_id': mock_user.id,
                'username': mock_user.username,
            }

            result1 = await agent_node(state1)
            assert 'GitHub URL' in result1['messages'][0].content

            # Test that routing would go to END (no tool calls)
            state1['messages'].append(result1['messages'][0])
            assert should_continue(state1) == '__end__'

            # Test second turn with URL
            state2 = {
                'messages': [
                    HumanMessage(content='I want to add a project'),
                    response1,
                    HumanMessage(content='https://github.com/user/repo'),
                ],
                'user_id': mock_user.id,
                'username': mock_user.username,
            }

            result2 = await agent_node(state2)
            state2['messages'].append(result2['messages'][0])

            # Now routing should go to tools
            assert should_continue(state2) == 'tools'
