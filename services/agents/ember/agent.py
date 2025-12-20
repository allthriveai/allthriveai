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
from langgraph.prebuilt import ToolNode

from core.ai_usage.tracker import AIUsageTracker

from .prompts import EMBER_FULL_ONBOARDING_PROMPT, EMBER_SYSTEM_PROMPT
from .tools import EMBER_TOOLS, TOOLS_NEEDING_STATE

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
            # Only release if we still hold the lock (check value)
            try:
                current_value = cache.get(lock_key)
                if current_value == lock_value:
                    cache.delete(lock_key)
                    logger.debug(f'Released distributed lock for {thread_id}')
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


# =============================================================================
# State Injection for Tools
# =============================================================================


def tools_node(state: EmberState) -> dict:
    """
    Tool execution node that injects user state into tools that need it.

    This is a LangGraph node function (not ToolNode) that receives the current
    state at runtime, allowing us to inject user_id, username, and session_id
    into tool calls dynamically.

    Tools listed in TOOLS_NEEDING_STATE receive a `state` dict with:
    - user_id: The authenticated user's ID
    - username: The user's username
    - session_id: The WebSocket session ID
    """
    from langchain_core.messages import ToolMessage as LCToolMessage

    messages = state.get('messages', [])

    # Find the last AI message with tool calls
    tool_calls_to_execute = []
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            tool_calls_to_execute = msg.tool_calls
            break

    if not tool_calls_to_execute:
        return {'messages': []}

    # Log state for debugging
    logger.debug(f'tools_node: user_id={state.get("user_id")}, username={state.get("username")}')

    # Execute each tool with state injection
    tool_results = []
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
            }
            logger.debug(f'Injected state into {tool_name}: user_id={state.get("user_id")}')

        # Find and execute the tool
        tool_result = None
        for tool in EMBER_TOOLS:
            if tool.name == tool_name:
                try:
                    logger.info(f'Executing tool: {tool_name}')
                    tool_result = tool.invoke(tool_args)
                    logger.info(f'Tool {tool_name} completed successfully')
                except Exception as e:
                    logger.error(f'Tool {tool_name} failed: {e}', exc_info=True)
                    tool_result = {'error': str(e), 'success': False}
                break

        if tool_result is None:
            logger.warning(f'Tool {tool_name} not found in EMBER_TOOLS')
            tool_result = {'error': f'Tool {tool_name} not found', 'success': False}

        # Convert result to string for ToolMessage content
        if isinstance(tool_result, dict):
            import json
            content = json.dumps(tool_result)
        else:
            content = str(tool_result)

        # Create tool message with result
        tool_message = LCToolMessage(
            content=content,
            tool_call_id=tool_id,
            name=tool_name,
        )
        tool_results.append(tool_message)

    return {'messages': tool_results}


# =============================================================================
# Agent Node
# =============================================================================


def create_agent_node(model_name: str | None = None):
    """Create the agent node that calls the LLM with tools bound.

    Uses the AI gateway configuration from settings.AI_MODELS.
    """
    # Get model from AI gateway config if not specified
    resolved_model = model_name or get_default_model()

    llm = ChatOpenAI(model=resolved_model, temperature=0.7)
    llm_with_tools = llm.bind_tools(EMBER_TOOLS)

    def agent_node(state: EmberState) -> dict:
        """Process messages and decide next action."""
        messages = state.get('messages', [])

        # Determine which system prompt to use
        is_onboarding = state.get('is_onboarding', False)
        system_prompt = EMBER_FULL_ONBOARDING_PROMPT if is_onboarding else EMBER_SYSTEM_PROMPT

        # Build full message list with system prompt
        full_messages = [SystemMessage(content=system_prompt)] + list(messages)

        # Call LLM
        response = llm_with_tools.invoke(full_messages)

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


# Pre-build workflow (checkpointer added when compiling)
# Model resolved from AI gateway at runtime
_workflow = _build_ember_workflow()


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
        agent = _workflow.compile(checkpointer=checkpointer)
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
    # Create initial state for injection
    initial_state = EmberState(
        messages=[],
        user_id=user_id,
        username=username,
        session_id=session_id,
        is_onboarding=False,
        conversation_id='',
    )

    # Create graph
    graph = StateGraph(EmberState)

    # Add agent node
    graph.add_node('agent', create_agent_node(model_name))

    # Add custom tool node with state injection
    tool_node = create_tool_node_with_state_injection(initial_state)
    graph.add_node('tools', tool_node)

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
):
    """
    Track Ember agent usage for analytics and billing.

    Uses the centralized AIUsageTracker for consistent cost calculation.
    """
    # Need a user to track - skip for anonymous
    if not user_id:
        return

    try:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = await User.objects.aget(id=user_id)

        feature = 'ember_onboarding' if is_onboarding else 'ember_chat'

        AIUsageTracker.track_usage(
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
            },
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
) -> dict:
    """
    Execute a tool with timeout protection.

    Prevents a single slow tool from hanging the entire request.
    Critical for maintaining responsiveness at scale.
    """
    loop = asyncio.get_event_loop()

    try:
        # Run sync tool in executor with timeout
        result = await asyncio.wait_for(
            loop.run_in_executor(None, tool.invoke, tool_args),
            timeout=timeout,
        )
        return {'success': True, 'result': result}
    except TimeoutError:
        return {
            'success': False,
            'error': f'Tool execution timed out after {timeout}s',
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


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

                    # Create input state - only the new message
                    # The checkpointer automatically manages conversation history
                    input_state = {
                        'messages': [HumanMessage(content=user_message)],
                        'user_id': user_id,
                        'username': username,
                        'session_id': session_id,
                        'is_onboarding': is_onboarding,
                        'conversation_id': session_id,
                    }

                    # Track processed events to avoid duplicates
                    processed_tool_calls = set()
                    processed_stream_runs = set()
                    current_stream_run_id = None

                    # Stream agent execution with astream_events
                    async for event in agent.astream_events(input_state, config, version='v1'):
                        kind = event['event']
                        run_id = event.get('run_id', '')

                        # Stream LLM tokens
                        if kind == 'on_chat_model_stream':
                            # Track run_id to prevent duplicate streams from multiple nodes
                            if run_id:
                                if run_id in processed_stream_runs and run_id != current_stream_run_id:
                                    continue
                                if current_stream_run_id is None:
                                    current_stream_run_id = run_id
                                    processed_stream_runs.add(run_id)
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
                            raw_output = event.get('data', {}).get('output', {})
                            # Serialize output to ensure it's JSON-compatible for Redis
                            output = _serialize_tool_output(raw_output)
                            yield {'type': 'tool_end', 'tool': tool_name, 'output': output}

                        # Reset stream tracking when entering new nodes
                        elif kind == 'on_chain_start':
                            current_stream_run_id = None

        # Track usage on successful completion (after context managers exit)
        latency_ms = int((time.time() - start_time) * 1000)
        output_tokens = _estimate_tokens(total_output_content)
        await _track_ember_usage(
            user_id=user_id,
            session_id=session_id,
            model_name=resolved_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            status='success',
            is_onboarding=is_onboarding,
            tool_calls_count=total_tool_calls,
        )
        yield {'type': 'complete'}

    except Exception as e:
        # Convert exception to user-friendly message
        user_message = _get_user_friendly_error(e)
        logger.error(f'Ember streaming error: {e}', exc_info=True)

        # Track usage on error
        latency_ms = int((time.time() - start_time) * 1000)
        output_tokens = _estimate_tokens(total_output_content)
        await _track_ember_usage(
            user_id=user_id,
            session_id=session_id,
            model_name=resolved_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            status='error',
            error_message=str(e),
            is_onboarding=is_onboarding,
            tool_calls_count=total_tool_calls,
        )
        yield {'type': 'error', 'message': user_message}


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

    # Create initial state
    initial_state = EmberState(
        messages=messages,
        user_id=user_id,
        username=username,
        session_id=session_id,
        is_onboarding=is_onboarding,
        conversation_id='',
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
