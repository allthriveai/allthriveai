"""
Unified Ember LangGraph agent.

Single agent with access to all tools, eliminating the need for
supervisor routing between specialized agents.

Scalability considerations:
- Message history is limited to prevent unbounded memory growth
- Tool execution has timeouts to prevent hanging requests
- Settings are configurable via Django settings
- No module-level logging to reduce log spam at scale
- Token usage is tracked for analytics and billing via AIUsageTracker
"""

import asyncio
import logging
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Annotated, TypedDict

from django.conf import settings
from django.core.cache import cache
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from core.ai_usage.tracker import AIUsageTracker
from services.ai.callbacks import TokenTrackingCallback

from .prompts import (
    EMBER_FULL_ONBOARDING_PROMPT,
    EMBER_SYSTEM_PROMPT,
    format_learning_intelligence,
    format_member_context,
)
from .tools import EMBER_TOOLS, TOOLS_NEEDING_STATE

# Lua script for atomic lock release (compare-and-delete)
# This prevents race conditions where another worker could acquire the lock
# between checking the value and deleting it
REDIS_LOCK_RELEASE_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""

logger = logging.getLogger(__name__)

# =============================================================================
# Configuration (with sensible defaults, overridable via Django settings)
# =============================================================================

# Maximum tool call iterations per request (prevents infinite loops)
MAX_TOOL_ITERATIONS = getattr(settings, 'EMBER_MAX_TOOL_ITERATIONS', 10)

# Maximum messages to keep in context (prevents unbounded memory growth)
# Keep last N messages to stay within context window and memory limits
MAX_CONTEXT_MESSAGES = getattr(settings, 'EMBER_MAX_CONTEXT_MESSAGES', 50)

# Tool execution timeout in seconds (prevents hanging on slow tools)
TOOL_EXECUTION_TIMEOUT = getattr(settings, 'EMBER_TOOL_EXECUTION_TIMEOUT', 30)

# Maximum in-memory locks to keep (LRU eviction for memory safety at scale)
# At 100k users, we limit to 10k locks (~1MB memory) and use Redis for distributed locking
MAX_THREAD_LOCKS = getattr(settings, 'EMBER_MAX_THREAD_LOCKS', 10000)

# Redis lock timeout for distributed locking (seconds)
REDIS_LOCK_TIMEOUT = getattr(settings, 'EMBER_REDIS_LOCK_TIMEOUT', 120)

# Concurrency locks for thread_id to prevent race conditions
# Uses OrderedDict for LRU eviction to prevent unbounded memory growth
_thread_locks: OrderedDict[str, asyncio.Lock] = OrderedDict()
_thread_locks_mutex = asyncio.Lock()


async def _get_thread_lock(thread_id: str) -> asyncio.Lock:
    """
    Get or create an async lock for a specific thread_id with LRU eviction.

    This prevents concurrent requests to the same conversation from
    causing race conditions or corrupted state in the checkpointer.

    Memory safety: Uses LRU eviction to cap memory at MAX_THREAD_LOCKS.
    At 100k users, this prevents unbounded memory growth.

    Note: For true distributed locking across multiple workers,
    use _acquire_distributed_lock() instead.
    """
    async with _thread_locks_mutex:
        if thread_id in _thread_locks:
            # Move to end (most recently used)
            _thread_locks.move_to_end(thread_id)
            return _thread_locks[thread_id]

        # Create new lock
        lock = asyncio.Lock()
        _thread_locks[thread_id] = lock

        # LRU eviction: remove oldest entries if over limit
        while len(_thread_locks) > MAX_THREAD_LOCKS:
            oldest_key = next(iter(_thread_locks))
            del _thread_locks[oldest_key]
            logger.debug(f'Evicted thread lock for memory: {oldest_key}')

        return lock


@asynccontextmanager
async def _acquire_distributed_lock(thread_id: str, timeout: int = REDIS_LOCK_TIMEOUT):
    """
    Acquire a distributed lock via Redis for cross-worker safety.

    This ensures only one worker processes a given thread_id at a time,
    even across multiple Celery workers or Gunicorn processes.

    Args:
        thread_id: The conversation thread ID to lock
        timeout: Lock timeout in seconds (auto-releases if holder crashes)

    Yields:
        True if lock acquired, raises exception if not

    Raises:
        RuntimeError: If lock cannot be acquired within timeout
    """
    lock_key = f'ember:lock:{thread_id}'
    lock_value = f'{time.time()}:{id(asyncio.current_task())}'

    # Try to acquire lock with Redis SETNX
    acquired = False
    start_time = time.time()

    try:
        # Use Redis SET NX EX for atomic lock acquisition
        acquired = cache.add(lock_key, lock_value, timeout=timeout)

        if not acquired:
            # Lock held by another worker, wait with exponential backoff
            wait_time = 0.1
            while time.time() - start_time < timeout:
                await asyncio.sleep(wait_time)
                acquired = cache.add(lock_key, lock_value, timeout=timeout)
                if acquired:
                    break
                wait_time = min(wait_time * 2, 2.0)  # Max 2 second wait

        if not acquired:
            logger.warning(f'Failed to acquire distributed lock for {thread_id} after {timeout}s')
            raise RuntimeError(f'Could not acquire lock for conversation {thread_id}')

        logger.debug(f'Acquired distributed lock for {thread_id}')
        yield True

    finally:
        if acquired:
            # Atomically release lock only if we still hold it (using Lua script)
            # This prevents race conditions in check-then-delete operations
            try:
                redis_client = cache._cache.get_client()
                # Execute Lua script atomically: only delete if value matches
                result = redis_client.eval(
                    REDIS_LOCK_RELEASE_SCRIPT,
                    1,  # number of keys
                    lock_key,  # KEYS[1]
                    lock_value,  # ARGV[1]
                )
                if result:
                    logger.debug(f'Released distributed lock for {thread_id}')
                else:
                    logger.warning(f'Lock for {thread_id} was already released or stolen')
            except AttributeError:
                # Fallback for non-Redis cache backends (local dev)
                try:
                    current_value = cache.get(lock_key)
                    if current_value == lock_value:
                        cache.delete(lock_key)
                        logger.debug(f'Released distributed lock for {thread_id} (fallback)')
                except Exception as e:
                    logger.warning(f'Error releasing lock (fallback) for {thread_id}: {e}')
            except Exception as e:
                logger.warning(f'Error releasing distributed lock for {thread_id}: {e}')


def get_default_model() -> str:
    """Get the default model from AI gateway configuration."""
    from services.ai.provider import get_model_for_purpose

    # Use the default OpenAI model from settings.AI_MODELS
    return get_model_for_purpose('openai', 'default')


def _get_user_friendly_error(exception: Exception) -> str:
    """
    Convert technical exceptions into user-friendly error messages.

    This is critical for production at scale - users should never see
    raw stack traces or technical error messages.

    Args:
        exception: The exception that occurred

    Returns:
        A user-friendly error message string
    """
    from services.agents.auth.checkpointer import CheckpointerError

    error_str = str(exception).lower()
    exception_type = type(exception).__name__

    # Database/Checkpointer errors - critical for conversation memory
    if isinstance(exception, CheckpointerError):
        logger.critical(f'CheckpointerError: Conversation memory unavailable: {exception}')
        return "I'm having trouble remembering our conversation. Please refresh the page and try again."

    # Distributed lock timeout
    if isinstance(exception, RuntimeError) and 'lock' in error_str:
        return "I'm a bit busy right now. Please wait a moment and try again."

    # OpenAI / AI provider errors
    if 'rate limit' in error_str or 'ratelimit' in error_str:
        return 'I need a moment to catch my breath. Please try again in a few seconds.'

    if 'quota' in error_str or 'insufficient_quota' in error_str:
        return "I'm taking a short break. Please try again in a few minutes."

    if 'invalid_api_key' in error_str or 'authentication' in error_str:
        logger.critical(f'AI API authentication error: {exception}')
        return "I'm having a technical issue. Our team has been notified."

    if 'context_length_exceeded' in error_str or ('token' in error_str and 'limit' in error_str):
        return 'Your message is quite long. Could you try a shorter version?'

    if 'content_filter' in error_str or 'responsibleaipolicyviolation' in error_str:
        return "I can't help with that particular request. Is there something else I can assist with?"

    # Network errors
    if 'timeout' in error_str or 'timed out' in error_str:
        return "I'm taking longer than expected. Please try again."

    if 'connection' in error_str and ('refused' in error_str or 'error' in error_str):
        logger.critical(f'Connection error: {exception}')
        return "I'm having trouble connecting. Please try again in a moment."

    # Database errors
    if 'database' in error_str or 'postgresql' in error_str or 'psycopg' in error_str:
        logger.critical(f'Database error in chat agent: {exception}')
        return "I'm having trouble with my memory. Please refresh and try again."

    # Redis errors
    if 'redis' in error_str or 'cache' in error_str:
        logger.warning(f'Redis/cache error in chat agent: {exception}')
        return "I'm experiencing a temporary issue. Please try again."

    # Generic fallback - don't expose technical details
    logger.error(f'Unhandled chat error type ({exception_type}): {exception}')
    return 'I ran into an unexpected issue. Please try again, and let us know if it continues.'


def _serialize_tool_output(output) -> dict:
    """
    Serialize tool output to ensure it's JSON-compatible for Redis channels.

    LangGraph tool events can return various types including ToolMessage objects
    which cannot be serialized by Redis. This function converts any output to
    a plain dict that can be safely serialized.

    Args:
        output: Raw tool output (could be dict, ToolMessage, string, etc.)

    Returns:
        JSON-serializable dict
    """
    from langchain_core.messages import ToolMessage

    # Handle ToolMessage objects
    if isinstance(output, ToolMessage):
        return {
            'content': output.content if isinstance(output.content, str | dict | list) else str(output.content),
            'tool_call_id': getattr(output, 'tool_call_id', None),
            'name': getattr(output, 'name', None),
        }

    # Handle dict with nested non-serializable objects
    if isinstance(output, dict):
        serialized = {}
        for key, value in output.items():
            if isinstance(value, ToolMessage):
                serialized[key] = _serialize_tool_output(value)
            elif hasattr(value, '__dict__'):
                # Convert objects with __dict__ to their dict representation
                try:
                    serialized[key] = dict(value.__dict__)
                except Exception:
                    serialized[key] = str(value)
            else:
                serialized[key] = value
        return serialized

    # Handle string output
    if isinstance(output, str):
        return {'content': output}

    # Handle list output
    if isinstance(output, list):
        return {'items': [_serialize_tool_output(item) for item in output]}

    # Fallback: convert to string
    try:
        return {'content': str(output)}
    except Exception:
        return {'content': 'Tool output could not be serialized'}


# =============================================================================
# State Definition
# =============================================================================


class EmberState(TypedDict):
    """State for the Ember agent graph."""

    messages: Annotated[list[BaseMessage], add_messages]
    # User context for state injection
    user_id: int | None
    username: str
    session_id: str
    # Optional context flags
    is_onboarding: bool
    conversation_id: str
    # Member context (injected at conversation start)
    # Contains learning preferences, tool preferences, interests, etc.
    member_context: dict | None
    # Tool execution results with frontend content (for manual event emission)
    # This is needed because LangGraph doesn't emit on_tool_start/on_tool_end
    # events for custom async tool nodes - we emit them manually
    _pending_tool_events: list[dict] | None


# =============================================================================
# Tool Execution with Timeout
# =============================================================================


# =============================================================================
# State Injection for Tools
# =============================================================================


async def tools_node(state: EmberState) -> dict:
    """
    Async tool execution node that injects user state into tools that need it.

    This is a LangGraph node function (not ToolNode) that receives the current
    state at runtime, allowing us to inject user_id, username, and session_id
    into tool calls dynamically.

    Tools listed in TOOLS_NEEDING_STATE receive a `state` dict with:
    - user_id: The authenticated user's ID
    - username: The user's username
    - session_id: The WebSocket session ID
    """
    from langchain_core.messages import ToolMessage as LCToolMessage

    logger.info('[TOOLS_NODE] ========== ENTERING tools_node ==========')
    messages = state.get('messages', [])
    logger.info(f'[TOOLS_NODE] Message count: {len(messages)}')

    # Find the last AI message with tool calls
    tool_calls_to_execute = []
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            tool_calls_to_execute = msg.tool_calls
            logger.info(f'[TOOLS_NODE] Found {len(tool_calls_to_execute)} tool calls to execute')
            for tc in tool_calls_to_execute:
                logger.info(f'[TOOLS_NODE] Tool call: {tc.get("name")} (id={tc.get("id")})')
            break

    if not tool_calls_to_execute:
        logger.info('[TOOLS_NODE] No tool calls found, returning empty')
        return {'messages': []}

    # Log state for debugging
    logger.info(f'[TOOLS_NODE] user_id={state.get("user_id")}, username={state.get("username")}')

    # Execute each tool with state injection
    tool_results = []
    pending_tool_events = []  # Store full results for frontend event emission

    for tool_call in tool_calls_to_execute:
        tool_name = tool_call.get('name', '')
        tool_args = dict(tool_call.get('args', {}))  # Copy to avoid mutation
        tool_id = tool_call.get('id', '')

        # Inject state for tools that need it
        if tool_name in TOOLS_NEEDING_STATE:
            tool_args['state'] = {
                'user_id': state.get('user_id'),
                'username': state.get('username', ''),
                'session_id': state.get('session_id', ''),
                'member_context': state.get('member_context'),
            }
            logger.debug(f'Injected state into {tool_name}: user_id={state.get("user_id")}')

        # Find and execute the tool with timeout
        tool_result = None
        for tool in EMBER_TOOLS:
            if tool.name == tool_name:
                try:
                    logger.info(f'Executing tool: {tool_name}')
                    # Execute with timeout (async, non-blocking)
                    tool_result = await _execute_tool_with_timeout(tool, tool_args, timeout=TOOL_EXECUTION_TIMEOUT)
                    logger.info(f'Tool {tool_name} completed successfully')
                except TimeoutError:
                    logger.error(f'Tool {tool_name} timed out after {TOOL_EXECUTION_TIMEOUT}s')
                    tool_result = {
                        'error': 'Taking a bit longer than usual—give me another moment!',
                        'success': False,
                        'timeout': True,
                    }
                except Exception as e:
                    logger.error(f'Tool {tool_name} failed: {e}', exc_info=True)
                    tool_result = {'error': str(e), 'success': False}
                break

        if tool_result is None:
            logger.warning(f'Tool {tool_name} not found in EMBER_TOOLS')
            tool_result = {'error': f'Tool {tool_name} not found', 'success': False}

        # Store full tool result for frontend event emission
        # This includes _frontend_content which is needed for card rendering
        pending_tool_events.append(
            {
                'tool_name': tool_name,
                'tool_id': tool_id,
                'output': tool_result,  # Full result including _frontend_content
            }
        )

        # Convert result to string for ToolMessage content
        # IMPORTANT: Strip _frontend_content from what the AI sees
        # _frontend_content contains detailed project info for frontend rendering
        # but we don't want the AI to describe projects inline - it should just
        # mention that content cards are displayed
        if isinstance(tool_result, dict):
            import json

            # Create a copy without _frontend_content for the AI
            ai_result = {k: v for k, v in tool_result.items() if not k.startswith('_')}
            content = json.dumps(ai_result)
        else:
            content = str(tool_result)

        # Create tool message with result
        tool_message = LCToolMessage(
            content=content,
            tool_call_id=tool_id,
            name=tool_name,
        )
        tool_results.append(tool_message)
        logger.info(f'[TOOLS_NODE] Created ToolMessage for {tool_name} (id={tool_id})')

    logger.info(f'[TOOLS_NODE] ========== EXITING tools_node with {len(tool_results)} results ==========')
    logger.info(f'[TOOLS_NODE] Storing {len(pending_tool_events)} pending tool events for frontend')

    return {
        'messages': tool_results,
        '_pending_tool_events': pending_tool_events,
    }


# =============================================================================
# Agent Node
# =============================================================================


def create_agent_node(model_name: str | None = None):
    """Create the async agent node that calls the LLM with tools bound.

    Uses the AI gateway configuration from settings.AI_MODELS.
    Returns an async function for non-blocking LLM calls.
    """
    # Get model from AI gateway config if not specified
    resolved_model = model_name or get_default_model()

    llm = ChatOpenAI(model=resolved_model, temperature=0.7)
    llm_with_tools = llm.bind_tools(EMBER_TOOLS)

    # Maximum messages to include in context (prevents slow processing)
    # 10 messages = ~5 exchanges, plenty for conversational context
    MAX_CONTEXT_MESSAGES = 10

    async def agent_node(state: EmberState) -> dict:
        """Process messages and decide next action (async)."""
        logger.info('[AGENT_NODE] ========== ENTERING agent_node ==========')
        all_messages = state.get('messages', [])
        logger.info(f'[AGENT_NODE] Total message count: {len(all_messages)}')

        # Trim to last N messages to prevent context bloat and slow processing
        # Keep last MAX_CONTEXT_MESSAGES messages for context
        if len(all_messages) > MAX_CONTEXT_MESSAGES:
            messages = all_messages[-MAX_CONTEXT_MESSAGES:]
            logger.info(f'[AGENT_NODE] Trimmed to last {MAX_CONTEXT_MESSAGES} messages')
        else:
            messages = all_messages

        # Log message types for debugging
        for i, msg in enumerate(messages[-5:]):  # Last 5 messages
            msg_type = type(msg).__name__
            has_tool_calls = hasattr(msg, 'tool_calls') and msg.tool_calls
            content_preview = str(msg.content)[:100] if hasattr(msg, 'content') else 'N/A'
            logger.info(
                f'[AGENT_NODE] Msg[-{len(messages)-i}]: {msg_type}, '
                f'tool_calls={has_tool_calls}, content={content_preview}...'
            )

        # Determine which system prompt to use
        is_onboarding = state.get('is_onboarding', False)
        base_prompt = EMBER_FULL_ONBOARDING_PROMPT if is_onboarding else EMBER_SYSTEM_PROMPT
        logger.info(f'[AGENT_NODE] is_onboarding={is_onboarding}')

        # Inject member context for personalization
        member_context = state.get('member_context')
        member_context_section = format_member_context(member_context)

        # Inject learning intelligence (detected gaps + proactive offers)
        learning_intelligence_section = format_learning_intelligence(member_context)

        system_prompt = base_prompt + member_context_section + learning_intelligence_section

        # Build full message list with system prompt
        full_messages = [SystemMessage(content=system_prompt)] + list(messages)
        logger.info(f'[AGENT_NODE] Calling LLM with {len(full_messages)} messages')

        # Call LLM (async - non-blocking)
        response = await llm_with_tools.ainvoke(full_messages)

        # Log response details
        has_tool_calls = hasattr(response, 'tool_calls') and response.tool_calls
        response_preview = str(response.content)[:200] if hasattr(response, 'content') else 'N/A'
        logger.info(f'[AGENT_NODE] LLM response: tool_calls={has_tool_calls}, content={response_preview}...')
        if has_tool_calls:
            for tc in response.tool_calls:
                logger.info(f'[AGENT_NODE] Tool call requested: {tc.get("name")} (id={tc.get("id")})')

        logger.info('[AGENT_NODE] ========== EXITING agent_node ==========')
        return {'messages': [response]}

    return agent_node


# =============================================================================
# Routing Logic
# =============================================================================


def should_continue(state: EmberState) -> str:
    """Determine whether to continue to tools or end."""
    messages = state.get('messages', [])

    if not messages:
        return END

    last_message = messages[-1]

    # If the last message has tool calls, continue to tools
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return 'tools'

    # Otherwise, end
    return END


# =============================================================================
# Graph Construction
# =============================================================================


def _build_ember_workflow(model_name: str | None = None) -> StateGraph:
    """
    Build the Ember agent workflow (without checkpointer).

    Uses the AI gateway configuration from settings.AI_MODELS.

    Args:
        model_name: Optional model override. If None, uses AI gateway default.

    Returns:
        StateGraph (not compiled) - compile with checkpointer at runtime
    """
    # Create the graph
    graph = StateGraph(EmberState)

    # Add nodes - model_name passed through, resolved in create_agent_node
    graph.add_node('agent', create_agent_node(model_name))
    # Use custom tools_node that injects state (user_id, username, session_id)
    # into tools at runtime. This is critical for tools to access user context.
    graph.add_node('tools', tools_node)

    # Set entry point
    graph.set_entry_point('agent')

    # Add conditional edges
    graph.add_conditional_edges(
        'agent',
        should_continue,
        {
            'tools': 'tools',
            END: END,
        },
    )

    # Tools always return to agent
    graph.add_edge('tools', 'agent')

    return graph


# Lazy workflow initialization to avoid import-time API key requirements
# Model resolved from AI gateway at runtime
_workflow = None


def _get_workflow():
    """Get the workflow, building it lazily on first use."""
    global _workflow
    if _workflow is None:
        _workflow = _build_ember_workflow()
    return _workflow


@asynccontextmanager
async def _get_async_agent():
    """
    Get async agent with async checkpointer for conversation memory.

    This is a context manager that ensures proper cleanup of the connection pool.

    Creates a fresh checkpointer for each call because Celery creates
    a new event loop per task, and the checkpointer's connection pool
    is tied to the event loop that created it.

    Usage:
        async with _get_async_agent() as agent:
            async for event in agent.astream_events(...):
                ...
        # Pool automatically closed after context exits
    """
    from services.agents.auth.checkpointer import get_async_checkpointer

    async with get_async_checkpointer() as checkpointer:
        agent = _get_workflow().compile(checkpointer=checkpointer)
        yield agent


def create_ember_agent(model_name: str = 'gpt-4o-mini') -> StateGraph:
    """
    Create the unified Ember agent graph (stateless, no checkpointer).

    For stateful conversations with memory, use _get_async_agent() instead.

    Args:
        model_name: OpenAI model to use (default: gpt-4o-mini)

    Returns:
        Compiled LangGraph StateGraph ready for invocation
    """
    graph = _build_ember_workflow(model_name)
    return graph.compile()


def create_ember_agent_with_state_injection(
    model_name: str | None = None,
    user_id: int | None = None,
    username: str = '',
    session_id: str = '',
) -> StateGraph:
    """
    Create the Ember agent with pre-configured state injection.

    This variant creates a custom tool node that automatically injects
    user state into tools that need it.

    Uses the AI gateway configuration from settings.AI_MODELS.

    Args:
        model_name: Optional model override. If None, uses AI gateway default.
        user_id: User ID for state injection
        username: Username for state injection
        session_id: Session ID for state injection

    Returns:
        Compiled LangGraph StateGraph with state injection
    """
    # Create graph
    graph = StateGraph(EmberState)

    # Add agent node
    graph.add_node('agent', create_agent_node(model_name))

    # Add custom tool node with state injection
    graph.add_node('tools', tools_node)

    # Set entry point
    graph.set_entry_point('agent')

    # Add conditional edges
    graph.add_conditional_edges(
        'agent',
        should_continue,
        {
            'tools': 'tools',
            END: END,
        },
    )

    # Tools return to agent
    graph.add_edge('tools', 'agent')

    return graph.compile()


# =============================================================================
# Token Estimation & Usage Tracking
# =============================================================================


def _estimate_tokens(text: str) -> int:
    """
    Estimate token count from text.

    Uses the common approximation of ~4 characters per token for English.
    For production billing, consider using tiktoken for exact counts.
    """
    if not text:
        return 0
    return max(1, len(text) // 4)


def _estimate_messages_tokens(messages: list[BaseMessage]) -> int:
    """Estimate total tokens in a message list."""
    total = 0
    for msg in messages:
        if hasattr(msg, 'content') and msg.content:
            total += _estimate_tokens(str(msg.content))
        # Tool calls add overhead
        if hasattr(msg, 'tool_calls') and msg.tool_calls:
            total += len(msg.tool_calls) * 50  # Rough estimate per tool call
    return total


async def _track_ember_usage(
    user_id: int | None,
    session_id: str,
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    status: str = 'success',
    error_message: str = '',
    is_onboarding: bool = False,
    tool_calls_count: int = 0,
    is_estimated: bool = True,
    llm_calls: int = 0,
    gateway_metadata: dict | None = None,
):
    """
    Track Ember agent usage for analytics and billing.

    Uses the centralized AIUsageTracker for consistent cost calculation.
    """
    # Need a user to track - skip for anonymous
    if not user_id:
        return

    try:
        from asgiref.sync import sync_to_async
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = await User.objects.aget(id=user_id)

        feature = 'ember_onboarding' if is_onboarding else 'ember_chat'

        # Wrap sync Django ORM call for async context
        await sync_to_async(AIUsageTracker.track_usage)(
            user=user,
            feature=feature,
            provider='openai',
            model=model_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            request_type='chat',
            latency_ms=latency_ms,
            status=status,
            error_message=error_message,
            session_id=session_id,
            request_metadata={
                'agent': 'ember',
                'tool_calls': tool_calls_count,
                'estimated': is_estimated,
                'llm_calls': llm_calls,
            },
            gateway_metadata=gateway_metadata,
        )
    except Exception as e:
        # Don't fail the request if tracking fails
        logger.error(f'Failed to track Ember usage: {e}')


# =============================================================================
# Convenience Functions
# =============================================================================


def _truncate_messages(messages: list[BaseMessage], max_messages: int) -> list[BaseMessage]:
    """
    Truncate message history to prevent unbounded memory growth.

    Keeps the most recent messages while preserving conversation coherence.
    At 100k users with concurrent requests, unbounded message lists cause OOM.
    """
    if len(messages) <= max_messages:
        return messages

    # Keep the most recent messages
    # This ensures we have recent context while staying within limits
    return messages[-max_messages:]


async def _execute_tool_with_timeout(
    tool,
    tool_args: dict,
    timeout: float = TOOL_EXECUTION_TIMEOUT,
):
    """
    Execute a tool with timeout protection.

    Runs the sync tool.invoke() in an executor to avoid blocking the event loop,
    with a timeout to prevent hung requests.

    Args:
        tool: The LangChain tool to execute
        tool_args: Arguments to pass to the tool
        timeout: Maximum execution time in seconds

    Returns:
        Raw tool result (dict, string, or other)

    Raises:
        TimeoutError: If tool doesn't complete within timeout
        Exception: Re-raises any exception from the tool
    """
    loop = asyncio.get_event_loop()

    try:
        # Run sync tool in executor with timeout
        return await asyncio.wait_for(
            loop.run_in_executor(None, tool.invoke, tool_args),
            timeout=timeout,
        )
    except TimeoutError:
        raise TimeoutError(f'Tool execution timed out after {timeout}s') from None
    # Let other exceptions propagate naturally


async def stream_ember_response(
    user_message: str,
    user_id: int | None = None,
    username: str = '',
    session_id: str = '',
    is_onboarding: bool = False,
    model_name: str | None = None,
):
    """
    Stream Ember agent response with tool execution events.

    Uses LangGraph with PostgreSQL checkpointing for conversation memory.
    The session_id is used as the thread_id for persistent state.
    Connection pools are properly cleaned up via context managers.

    Yields events:
    - {'type': 'token', 'content': '...'} - Text tokens from LLM
    - {'type': 'tool_start', 'tool': '...'} - Tool execution started
    - {'type': 'tool_end', 'tool': '...', 'output': {...}} - Tool completed
    - {'type': 'complete'} - Agent finished
    - {'type': 'error', 'message': '...'} - Error occurred

    Args:
        user_message: User's input message
        user_id: Authenticated user ID
        username: User's username
        session_id: WebSocket session ID (used as thread_id for checkpointing)
        is_onboarding: Whether this is an onboarding conversation
        model_name: Optional model override (uses AI gateway default if None)

    Yields:
        Event dicts with type and content
    """
    # Get model from AI gateway config if not specified
    resolved_model = model_name or get_default_model()

    # Track timing and usage for analytics/billing
    start_time = time.time()
    total_output_content = ''
    total_tool_calls = 0
    input_tokens = 0

    # Create token tracking callback for accurate usage (outside context managers so it's accessible for tracking)
    token_callback = TokenTrackingCallback()

    try:
        # Acquire distributed lock to prevent concurrent requests across workers
        # This is critical at scale (100k users) to prevent checkpoint corruption
        async with _acquire_distributed_lock(session_id):
            # Also acquire local lock for same-worker safety
            thread_lock = await _get_thread_lock(session_id)
            async with thread_lock:
                # Get async agent with checkpointer for conversation memory
                # Context manager ensures connection pool is cleaned up
                async with _get_async_agent() as agent:
                    # Use session_id as thread_id for persistent conversation state
                    config = {
                        'configurable': {
                            'thread_id': session_id,
                            'user_id': user_id,
                        }
                    }

                    # Load member context for personalization
                    from services.agents.context import MemberContextService

                    member_context = await MemberContextService.get_context_async(user_id)

                    # Detect struggle in current message and set proactive offer
                    if user_id and member_context:
                        try:
                            from services.agents.proactive import (
                                get_intervention_service,
                                get_struggle_detector,
                            )

                            struggle_detector = get_struggle_detector()
                            intervention_service = get_intervention_service()

                            # Get recent messages from checkpointer for context
                            # For now, just analyze the current message
                            messages_for_analysis = [{'role': 'user', 'content': user_message}]

                            struggle_data = await struggle_detector.detect_current_struggle_async(
                                user_id=user_id,
                                messages=messages_for_analysis,
                                member_context=member_context,
                            )

                            if struggle_data:
                                proactive_offer = await intervention_service.should_intervene_async(
                                    user_id=user_id,
                                    struggle_data=struggle_data,
                                    member_context=member_context,
                                )

                                if proactive_offer:
                                    member_context['current_struggle'] = struggle_data
                                    member_context['proactive_offer'] = proactive_offer
                                    logger.info(
                                        f'Proactive intervention triggered for user {user_id}: '
                                        f'{proactive_offer.get("intervention_type")}'
                                    )

                        except Exception as e:
                            logger.warning(f'Error detecting struggle: {e}')
                            # Don't fail the request if struggle detection fails

                    # Create input state - only the new message
                    # The checkpointer automatically manages conversation history
                    input_state = {
                        'messages': [HumanMessage(content=user_message)],
                        'user_id': user_id,
                        'username': username,
                        'session_id': session_id,
                        'is_onboarding': is_onboarding,
                        'conversation_id': session_id,
                        'member_context': member_context,
                    }

                    # Track processed events to avoid duplicates
                    processed_tool_calls = set()
                    processed_stream_runs = set()
                    current_stream_run_id = None

                    # Add callback to config for LLM calls
                    config_with_callbacks = {
                        **config,
                        'callbacks': [token_callback],
                    }

                    # Stream agent execution with astream_events
                    logger.info('[STREAM] ========== Starting astream_events ==========')
                    event_count = 0
                    async for event in agent.astream_events(input_state, config_with_callbacks, version='v1'):
                        kind = event['event']
                        run_id = event.get('run_id', '')
                        event_count += 1

                        # Log all event types for debugging
                        if kind not in ('on_chat_model_stream',):  # Skip noisy token events
                            event_name = event.get('name', '')
                            run_id_short = run_id[:8] if run_id else 'none'
                            logger.info(
                                f'[STREAM] Event #{event_count}: {kind} ' f'name={event_name} (run_id={run_id_short})'
                            )

                        # Stream LLM tokens
                        if kind == 'on_chat_model_stream':
                            # Track run_id to prevent duplicate streams from multiple nodes
                            if run_id:
                                # Only skip if we have an ACTIVE stream and this is a different one
                                # that was already processed (prevents skipping after on_chain_start reset)
                                if (
                                    current_stream_run_id is not None
                                    and run_id != current_stream_run_id
                                    and run_id in processed_stream_runs
                                ):
                                    continue
                                if current_stream_run_id is None or run_id == current_stream_run_id:
                                    if run_id not in processed_stream_runs:
                                        processed_stream_runs.add(run_id)
                                    current_stream_run_id = run_id
                                elif run_id != current_stream_run_id:
                                    continue

                            chunk = event.get('data', {}).get('chunk')
                            if chunk and hasattr(chunk, 'content') and chunk.content:
                                content = chunk.content
                                if isinstance(content, str):
                                    total_output_content += content
                                    yield {'type': 'token', 'content': content}

                        # Tool execution started
                        elif kind == 'on_tool_start':
                            tool_name = event.get('name', '')
                            run_id = event.get('run_id', '')

                            # Skip if already processed
                            if run_id in processed_tool_calls:
                                continue
                            processed_tool_calls.add(run_id)

                            total_tool_calls += 1
                            yield {'type': 'tool_start', 'tool': tool_name}

                        # Tool execution completed
                        elif kind == 'on_tool_end':
                            tool_name = event.get('name', '')
                            run_id = event.get('run_id', '')

                            # Skip if already processed (use _end suffix to avoid collision with start)
                            end_key = f'{run_id}_end'
                            if end_key in processed_tool_calls:
                                logger.info(f'[TRACE] Skipping duplicate tool_end: {tool_name} (run_id={run_id})')
                                continue
                            processed_tool_calls.add(end_key)

                            raw_output = event.get('data', {}).get('output', {})
                            # Serialize output to ensure it's JSON-compatible for Redis
                            output = _serialize_tool_output(raw_output)

                            # TRACE logging for debugging duplicate content
                            logger.info(f'[TRACE] tool_end yielding: {tool_name} (run_id={run_id})')
                            if isinstance(output, dict):
                                # Log _frontend_content (what frontend will render as cards)
                                frontend_content = output.get('_frontend_content', [])
                                if frontend_content:
                                    logger.info(f'[TRACE] tool_end _frontend_content count: {len(frontend_content)}')
                                    for item in frontend_content:
                                        item_type = item.get('type', 'unknown')
                                        item_title = item.get('title', item.get('name', 'no-title'))
                                        logger.info(f'[TRACE] _frontend_content item: {item_type} - {item_title}')
                                # Log content (minimal info AI sees)
                                content_items = output.get('content', [])
                                if content_items:
                                    logger.info(f'[TRACE] tool_end content (AI sees) count: {len(content_items)}')
                                    for item in content_items:
                                        logger.info(f'[TRACE] AI content item: {item}')

                            yield {'type': 'tool_end', 'tool': tool_name, 'output': output}

                        # Reset stream tracking when entering new nodes
                        elif kind == 'on_chain_start':
                            chain_name = event.get('name', 'unknown')
                            logger.info(f'[STREAM] on_chain_start: {chain_name} - resetting current_stream_run_id')
                            current_stream_run_id = None

                        # Emit manual tool events when tools chain ends
                        # LangGraph doesn't emit on_tool_start/on_tool_end for custom async nodes
                        elif kind == 'on_chain_end':
                            chain_name = event.get('name', 'unknown')
                            if chain_name == 'tools':
                                # Get the output from the tools node
                                chain_output = event.get('data', {}).get('output', {})
                                pending_events = chain_output.get('_pending_tool_events', [])

                                logger.info(
                                    f'[STREAM] tools chain ended, emitting {len(pending_events)} manual tool events'
                                )

                                for tool_event in pending_events:
                                    tool_name = tool_event.get('tool_name', '')
                                    tool_output = tool_event.get('output', {})

                                    # Serialize output for Redis/WebSocket
                                    serialized_output = _serialize_tool_output(tool_output)

                                    # Emit tool_start and tool_end for each tool
                                    total_tool_calls += 1
                                    yield {'type': 'tool_start', 'tool': tool_name}

                                    # Log frontend content
                                    if isinstance(serialized_output, dict):
                                        frontend_content = serialized_output.get('_frontend_content', [])
                                        if frontend_content:
                                            logger.info(
                                                f'[STREAM] Manual tool_end: {tool_name} with '
                                                f'{len(frontend_content)} frontend items'
                                            )

                                    yield {'type': 'tool_end', 'tool': tool_name, 'output': serialized_output}

                    logger.info(f'[STREAM] ========== Finished astream_events ({event_count} total events) ==========')

        # Track usage on successful completion (after context managers exit)
        latency_ms = int((time.time() - start_time) * 1000)

        # Use actual tokens from callback if available, otherwise estimate
        if token_callback.has_token_data:
            actual_input_tokens = token_callback.total_input_tokens
            actual_output_tokens = token_callback.total_output_tokens
            is_estimated = False
        else:
            actual_input_tokens = input_tokens or _estimate_tokens(user_message)
            actual_output_tokens = _estimate_tokens(total_output_content)
            is_estimated = True

        await _track_ember_usage(
            user_id=user_id,
            session_id=session_id,
            model_name=resolved_model,
            input_tokens=actual_input_tokens,
            output_tokens=actual_output_tokens,
            latency_ms=latency_ms,
            status='success',
            is_onboarding=is_onboarding,
            tool_calls_count=total_tool_calls,
            is_estimated=is_estimated,
            llm_calls=token_callback.llm_calls,
            gateway_metadata=token_callback.gateway_metadata,
        )
        yield {'type': 'complete'}

    except Exception as e:
        # Convert exception to user-friendly message
        error_user_message = _get_user_friendly_error(e)
        logger.error(f'Ember streaming error: {e}', exc_info=True)

        # Track usage on error - use callback data if available
        latency_ms = int((time.time() - start_time) * 1000)
        if token_callback.has_token_data:
            actual_input_tokens = token_callback.total_input_tokens
            actual_output_tokens = token_callback.total_output_tokens
            is_estimated = False
        else:
            actual_input_tokens = input_tokens or _estimate_tokens(user_message)
            actual_output_tokens = _estimate_tokens(total_output_content)
            is_estimated = True

        await _track_ember_usage(
            user_id=user_id,
            session_id=session_id,
            model_name=resolved_model,
            input_tokens=actual_input_tokens,
            output_tokens=actual_output_tokens,
            latency_ms=latency_ms,
            status='error',
            error_message=str(e),
            is_onboarding=is_onboarding,
            tool_calls_count=total_tool_calls,
            is_estimated=is_estimated,
            llm_calls=token_callback.llm_calls,
            gateway_metadata=token_callback.gateway_metadata,
        )
        yield {'type': 'error', 'message': error_user_message}


def invoke_ember(
    message: str,
    user_id: int | None = None,
    username: str = '',
    session_id: str = '',
    conversation_history: list[BaseMessage] | None = None,
    is_onboarding: bool = False,
    model_name: str | None = None,
) -> dict:
    """
    Convenience function to invoke Ember with a single message (non-streaming).

    DEPRECATED: This function does NOT use LangGraph checkpointing for conversation
    memory. Each call is stateless and requires passing conversation_history manually.

    For production use with persistent conversation memory, use stream_ember_response()
    which uses PostgreSQL checkpointing via the session_id as thread_id.

    Args:
        message: User's message
        user_id: Authenticated user ID
        username: User's username
        session_id: WebSocket session ID (not used for checkpointing in this function)
        conversation_history: Previous messages (required for context - not persisted)
        is_onboarding: Whether this is an onboarding conversation
        model_name: Optional model override (uses AI gateway default if None)

    Returns:
        Final state dict with messages
    """
    import warnings

    warnings.warn(
        'invoke_ember() does not use LangGraph checkpointing. '
        'Use stream_ember_response() for persistent conversation memory.',
        DeprecationWarning,
        stacklevel=2,
    )
    # Get model from AI gateway config if not specified
    resolved_model = model_name or get_default_model()

    # Track timing
    start_time = time.time()

    # Build messages with history limiting
    messages = list(conversation_history or [])
    messages.append(HumanMessage(content=message))
    messages = _truncate_messages(messages, MAX_CONTEXT_MESSAGES)

    # Estimate input tokens
    input_tokens = _estimate_messages_tokens(messages)

    # Load member context for personalization (sync)
    from services.agents.context import MemberContextService

    member_context = MemberContextService.get_context(user_id)

    # Create initial state
    initial_state = EmberState(
        messages=messages,
        user_id=user_id,
        username=username,
        session_id=session_id,
        is_onboarding=is_onboarding,
        conversation_id='',
        member_context=member_context,
    )

    # Create and invoke agent (uses AI gateway model)
    agent = create_ember_agent(resolved_model)
    result = agent.invoke(initial_state)

    # Track usage (sync version for non-streaming)
    if user_id:
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            user = User.objects.get(id=user_id)

            # Estimate output tokens from result messages
            result_messages = result.get('messages', [])
            output_content = ''.join(
                str(msg.content) for msg in result_messages if hasattr(msg, 'content') and msg.content
            )
            output_tokens = _estimate_tokens(output_content)

            # Count tool calls
            tool_calls_count = sum(
                len(msg.tool_calls) for msg in result_messages if hasattr(msg, 'tool_calls') and msg.tool_calls
            )

            latency_ms = int((time.time() - start_time) * 1000)
            feature = 'ember_onboarding' if is_onboarding else 'ember_chat'

            AIUsageTracker.track_usage(
                user=user,
                feature=feature,
                provider='openai',
                model=resolved_model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                request_type='chat',
                latency_ms=latency_ms,
                status='success',
                session_id=session_id,
                request_metadata={
                    'agent': 'ember',
                    'tool_calls': tool_calls_count,
                },
            )
        except Exception as e:
            logger.error(f'Failed to track Ember usage: {e}')

    return result
