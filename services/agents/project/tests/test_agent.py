"""
Tests for project agent graph and streaming.

Run with: pytest services/project_agent/tests/test_agent.py -v

Note: Async tests require pytest-asyncio. If not installed:
    pip install pytest-asyncio
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from services.agents.project.agent import (
    ProjectAgentState,
    agent_node,
    create_project_agent,
    should_continue,
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
        with patch('services.agents.project.agent.get_llm') as mock_get_llm:
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
        mock_llm = Mock()
        mock_response = Mock()
        mock_response.content = "I'll help you create a project!"
        mock_response.tool_calls = []
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        with patch('services.agents.project.agent.get_llm_with_tools', return_value=mock_llm):
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

        mock_llm = Mock()
        mock_response = Mock()
        mock_response.content = 'Hello!'
        mock_response.tool_calls = []
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        with patch('services.agents.project.agent.get_llm_with_tools', return_value=mock_llm):
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
        mock_llm = Mock()
        mock_response = Mock()
        mock_response.content = 'I found your GitHub repo!'
        mock_response.tool_calls = []
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        with patch('services.agents.project.agent.get_llm_with_tools', return_value=mock_llm):
            result = await agent_node(agent_state)

            assert 'messages' in result
            assert len(result['messages']) == 1
            assert result['messages'][0] == mock_response


@pytest.mark.django_db
class TestAgentIntegrationAsync:
    """Integration tests for the full agent flow (mocked LLM)."""

    @pytest.mark.asyncio
    async def test_full_conversation_flow(self, mock_user):
        """Test a complete conversation flow with mocked components."""
        mock_llm = Mock()

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

        with patch('services.agents.project.agent.get_llm_with_tools', return_value=mock_llm):
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
