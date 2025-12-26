"""
Shared fixtures for Ava agent tests.

Run with: pytest services/agents/ava/tests/ -v
"""

from unittest.mock import AsyncMock, MagicMock, Mock

import pytest
from django.contrib.auth import get_user_model
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

User = get_user_model()


@pytest.fixture
def mock_user(db):
    """Create a test user."""
    user = User.objects.create_user(
        username='ava_test_user',
        email='ava_test@example.com',
        password='testpass123',
    )
    return user


@pytest.fixture
def mock_llm():
    """Create a mock LLM that returns predictable responses."""
    mock = AsyncMock()

    # Default response without tool calls
    response = Mock()
    response.content = 'Hello! How can I help you today?'
    response.tool_calls = []
    response.additional_kwargs = {}
    mock.ainvoke.return_value = response

    return mock


@pytest.fixture
def mock_llm_with_tool_call():
    """Create a mock LLM that returns a tool call."""
    mock = AsyncMock()

    response = Mock()
    response.content = ''
    response.tool_calls = [
        {
            'id': 'call_123',
            'name': 'search_projects',
            'args': {'query': 'AI projects'},
        }
    ]
    response.additional_kwargs = {}
    mock.ainvoke.return_value = response

    return mock


@pytest.fixture
def mock_redis_cache():
    """Create a mock Redis cache for distributed locking tests."""
    cache = MagicMock()
    cache.add.return_value = True  # Lock acquisition succeeds
    cache.get.return_value = None
    cache.delete.return_value = True
    return cache


@pytest.fixture
def sample_messages():
    """Sample conversation messages."""
    return [
        HumanMessage(content='What projects are available?'),
        AIMessage(content='Let me search for projects for you.'),
    ]


@pytest.fixture
def sample_tool_message():
    """Sample tool message for serialization tests."""
    return ToolMessage(
        content='Found 5 projects matching your query.',
        tool_call_id='call_123',
        name='search_projects',
    )


@pytest.fixture
def ava_state(sample_messages, mock_user):
    """Sample Ava agent state."""
    return {
        'messages': sample_messages,
        'user_id': mock_user.id,
        'username': mock_user.username,
        'member_context': None,
        'learning_context': None,
        'tool_calls_count': 0,
    }
