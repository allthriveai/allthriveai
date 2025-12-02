"""
Shared fixtures for project agent tests.

Run with: pytest services/project_agent/tests/ -v

Note: Async tests require pytest-asyncio:
    uv add pytest-asyncio
"""

from unittest.mock import AsyncMock, Mock

import pytest
from django.contrib.auth import get_user_model
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

User = get_user_model()


@pytest.fixture
def mock_user(db):
    """Create a test user."""
    user = User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
    )
    return user


@pytest.fixture
def mock_project(mock_user):
    """Create a mock project object."""
    project = Mock()
    project.id = 123
    project.slug = 'test-project'
    project.title = 'Test Project'
    project.user = mock_user
    project.user.username = mock_user.username
    return project


@pytest.fixture
def mock_llm():
    """Create a mock LLM that returns predictable responses."""
    mock = AsyncMock()

    # Default response without tool calls
    response = Mock()
    response.content = "I'll help you create a project!"
    response.tool_calls = []
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
            'name': 'fetch_github_metadata',
            'args': {'url': 'https://github.com/user/repo'},
        }
    ]
    mock.ainvoke.return_value = response

    return mock


@pytest.fixture
def github_api_response():
    """Sample GitHub API response."""
    return {
        'name': 'awesome-project',
        'description': 'An awesome AI project',
        'language': 'Python',
        'stargazers_count': 150,
        'forks_count': 25,
        'topics': ['ai', 'machine-learning', 'python'],
        'homepage': 'https://awesome-project.io',
    }


@pytest.fixture
def runnable_config(mock_user):
    """Create a RunnableConfig with user context for tool invocation."""
    return RunnableConfig(
        configurable={
            'user_id': mock_user.id,
            'thread_id': 'test-session-123',
        }
    )


@pytest.fixture
def sample_messages():
    """Sample conversation messages."""
    return [
        HumanMessage(content='I want to add my GitHub project'),
        AIMessage(content='Sure! Please share the GitHub URL.'),
        HumanMessage(content='https://github.com/user/awesome-project'),
    ]


@pytest.fixture
def agent_state(sample_messages, mock_user):
    """Sample agent state."""
    return {
        'messages': sample_messages,
        'user_id': mock_user.id,
        'username': mock_user.username,
    }
