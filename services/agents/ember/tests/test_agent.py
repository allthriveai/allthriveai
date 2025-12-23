"""
Tests for Ember Agent functionality.

Tests cover:
- User-friendly error message conversion
- Tool output serialization
- Thread locking with LRU eviction
- Distributed locking with Redis
- Message truncation for context limits
- Token estimation
"""

import asyncio

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from services.agents.ember.agent import (
    _estimate_tokens,
    _get_thread_lock,
    _get_user_friendly_error,
    _serialize_tool_output,
    _truncate_messages,
)


class TestGetUserFriendlyError:
    """Tests for _get_user_friendly_error function."""

    def test_rate_limit_error(self):
        """Rate limit errors return friendly message."""
        error = Exception('Rate limit exceeded for this API key')
        result = _get_user_friendly_error(error)
        assert 'catch my breath' in result or 'try again' in result.lower()

    def test_quota_error(self):
        """Quota errors return friendly message."""
        error = Exception('insufficient_quota: You have exceeded your usage quota')
        result = _get_user_friendly_error(error)
        assert 'break' in result.lower() or 'try again' in result.lower()

    def test_context_length_error(self):
        """Context length errors suggest shorter message."""
        error = Exception('context_length_exceeded: Maximum token limit reached')
        result = _get_user_friendly_error(error)
        assert 'long' in result.lower() or 'shorter' in result.lower()

    def test_content_filter_error(self):
        """Content filter errors suggest different request."""
        error = Exception('ResponsibleAIPolicyViolation: Content was blocked')
        result = _get_user_friendly_error(error)
        assert "can't help" in result.lower() or 'something else' in result.lower()

    def test_timeout_error(self):
        """Timeout errors suggest retry."""
        error = Exception('Request timed out after 30 seconds')
        result = _get_user_friendly_error(error)
        assert 'taking longer' in result.lower() or 'try again' in result.lower()

    def test_connection_error(self):
        """Connection errors suggest retry."""
        error = Exception('Connection refused to API endpoint')
        result = _get_user_friendly_error(error)
        assert 'trouble connecting' in result.lower() or 'try again' in result.lower()

    def test_database_error(self):
        """Database connection errors suggest retry."""
        error = Exception('PostgreSQL connection error: too many connections')
        result = _get_user_friendly_error(error)
        # Connection errors (including database) return a "try again" message
        assert 'trouble connecting' in result.lower() or 'try again' in result.lower()

    def test_redis_error(self):
        """Redis errors suggest retry."""
        error = Exception('Redis connection refused')
        result = _get_user_friendly_error(error)
        assert 'temporary' in result.lower() or 'try again' in result.lower()

    def test_lock_error(self):
        """Lock errors suggest waiting."""
        error = RuntimeError('Could not acquire lock for conversation test-123')
        result = _get_user_friendly_error(error)
        assert 'busy' in result.lower() or 'wait' in result.lower()

    def test_generic_error_hides_details(self):
        """Generic errors don't expose technical details."""
        error = Exception('Internal server error: NullPointerException at line 42')
        result = _get_user_friendly_error(error)
        assert 'NullPointer' not in result
        assert 'line 42' not in result
        assert 'try again' in result.lower()

    def test_authentication_error(self):
        """Authentication errors notify team."""
        error = Exception('invalid_api_key: The API key provided is invalid')
        result = _get_user_friendly_error(error)
        assert 'technical issue' in result.lower() or 'notified' in result.lower()


class TestSerializeToolOutput:
    """Tests for _serialize_tool_output function."""

    def test_serialize_tool_message(self, sample_tool_message):
        """ToolMessage objects are properly serialized."""
        result = _serialize_tool_output(sample_tool_message)

        assert isinstance(result, dict)
        assert result['content'] == 'Found 5 projects matching your query.'
        assert result['tool_call_id'] == 'call_123'
        assert result['name'] == 'search_projects'

    def test_serialize_dict(self):
        """Dict outputs are serialized correctly."""
        output = {
            'projects': [
                {'name': 'Project 1', 'id': 1},
                {'name': 'Project 2', 'id': 2},
            ],
            'count': 2,
        }
        result = _serialize_tool_output(output)

        assert isinstance(result, dict)
        assert 'projects' in result
        assert result['count'] == 2

    def test_serialize_string(self):
        """String outputs are wrapped in dict."""
        output = 'Simple string output'
        result = _serialize_tool_output(output)

        assert isinstance(result, dict)
        assert result['content'] == 'Simple string output'

    def test_serialize_list(self):
        """List outputs are serialized as list of dicts."""
        output = ['item1', 'item2', 'item3']
        result = _serialize_tool_output(output)

        # List inputs now return a list of serialized items
        assert isinstance(result, list)
        assert len(result) == 3
        assert all(isinstance(item, dict) for item in result)

    def test_serialize_nested_tool_message(self, sample_tool_message):
        """Nested ToolMessage in dict is serialized."""
        output = {
            'result': sample_tool_message,
            'status': 'success',
        }
        result = _serialize_tool_output(output)

        assert isinstance(result, dict)
        assert 'result' in result
        assert isinstance(result['result'], dict)
        assert result['result']['content'] == 'Found 5 projects matching your query.'

    def test_serialize_object_with_dict(self):
        """Objects with __dict__ are converted."""

        class CustomObject:
            def __init__(self):
                self.name = 'test'
                self.value = 42

        output = {'obj': CustomObject()}
        result = _serialize_tool_output(output)

        assert isinstance(result, dict)
        # Object should be converted to string or dict representation
        assert 'obj' in result

    def test_serialize_handles_exceptions(self):
        """Serialization handles unserializable objects gracefully."""

        class UnserializableObject:
            def __str__(self):
                raise ValueError('Cannot convert to string')

        output = UnserializableObject()
        result = _serialize_tool_output(output)

        # Should return fallback message instead of raising
        assert isinstance(result, dict)
        assert 'content' in result


@pytest.mark.asyncio
class TestGetThreadLock:
    """Tests for _get_thread_lock function."""

    async def test_get_lock_creates_new(self):
        """New thread_id creates a new lock."""
        lock = await _get_thread_lock('test-thread-new-1')
        assert isinstance(lock, asyncio.Lock)

    async def test_get_lock_returns_same(self):
        """Same thread_id returns same lock."""
        lock1 = await _get_thread_lock('test-thread-same-1')
        lock2 = await _get_thread_lock('test-thread-same-1')
        assert lock1 is lock2

    async def test_lock_is_async_lock(self):
        """Returned lock is an asyncio.Lock."""
        lock = await _get_thread_lock('test-thread-async-1')
        assert isinstance(lock, asyncio.Lock)

    async def test_lock_can_be_acquired(self):
        """Lock can be acquired and released."""
        lock = await _get_thread_lock('test-thread-acquire-1')

        async with lock:
            # Lock is held
            assert lock.locked()

        # Lock is released
        assert not lock.locked()


class TestDistributedLock:
    """Tests for distributed locking."""

    @pytest.mark.asyncio
    async def test_acquire_lock_success(self):
        """Lock acquisition succeeds and returns True."""
        from services.agents.ember.agent import _acquire_distributed_lock

        async with _acquire_distributed_lock('test-thread-dist-1') as acquired:
            # Lock should be successfully acquired
            assert acquired is True

    @pytest.mark.asyncio
    async def test_acquire_lock_releases_on_exit(self):
        """Lock is released when context exits."""
        from services.agents.ember.agent import _acquire_distributed_lock

        # First acquisition should work
        async with _acquire_distributed_lock('test-thread-release-1') as acquired:
            assert acquired is True

        # After exiting the context, we should be able to acquire again
        async with _acquire_distributed_lock('test-thread-release-1') as acquired_again:
            assert acquired_again is True

    @pytest.mark.asyncio
    async def test_acquire_lock_timeout(self):
        """Lock acquisition works with timeout parameter."""
        from services.agents.ember.agent import _acquire_distributed_lock

        # Test that lock with timeout works (doesn't timeout when not contended)
        async with _acquire_distributed_lock('test-thread-timeout-1', timeout=5) as acquired:
            assert acquired is True


class TestMessageTruncation:
    """Tests for message history truncation."""

    def test_truncate_keeps_recent_messages_only(self):
        """Truncation keeps only the most recent messages."""
        from langchain_core.messages import SystemMessage

        messages = [
            SystemMessage(content='You are Ember, an AI assistant.'),
            HumanMessage(content='Message 1'),
            AIMessage(content='Response 1'),
            HumanMessage(content='Message 2'),
            AIMessage(content='Response 2'),
            HumanMessage(content='Message 3'),
            AIMessage(content='Response 3'),
        ]

        result = _truncate_messages(messages, max_messages=4)

        # Should have exactly max_messages
        assert len(result) == 4
        # Should be the last 4 messages (most recent): Message 2, Response 2, Message 3, Response 3
        assert result[0].content == 'Message 2'
        assert result[-1].content == 'Response 3'

    def test_truncate_keeps_recent_messages(self):
        """Most recent messages are kept when truncating."""
        messages = [
            HumanMessage(content='Old message'),
            AIMessage(content='Old response'),
            HumanMessage(content='Recent message'),
            AIMessage(content='Recent response'),
        ]

        result = _truncate_messages(messages, max_messages=2)

        # Recent messages should be kept
        assert any('Recent' in str(m.content) for m in result)


class TestTokenEstimation:
    """Tests for token estimation utility."""

    def test_estimate_tokens_empty(self):
        """Empty content estimates to 0 tokens."""
        result = _estimate_tokens('')
        assert result == 0

    def test_estimate_tokens_short_text(self):
        """Short text estimates correctly."""
        result = _estimate_tokens('Hello world')
        assert result > 0
        assert result < 10  # Very short text

    def test_estimate_tokens_long_text(self):
        """Long text estimates proportionally."""
        short_result = _estimate_tokens('Hello')
        long_result = _estimate_tokens('Hello ' * 100)

        assert long_result > short_result
