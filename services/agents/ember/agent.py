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
from copy import deepcopy
from typing import Annotated, TypedDict

from django.conf import settings
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from core.ai_usage.tracker import AIUsageTracker

from .prompts import EMBER_FULL_ONBOARDING_PROMPT, EMBER_SYSTEM_PROMPT
from .tools import EMBER_TOOLS, EMBER_TOOLS_BY_NAME, TOOLS_NEEDING_STATE

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

# Default model (can be overridden per-request)
DEFAULT_MODEL = getattr(settings, 'EMBER_DEFAULT_MODEL', 'gpt-4o-mini')


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


def create_tool_node_with_state_injection(state: EmberState) -> ToolNode:
    """
    Create a ToolNode that injects state into tools that need it.

    Tools listed in TOOLS_NEEDING_STATE receive a `state` dict with:
    - user_id: The authenticated user's ID
    - username: The user's username
    - session_id: The WebSocket session ID
    """

    def inject_state(tool_call: dict) -> dict:
        """Inject state into tool arguments if the tool needs it."""
        tool_name = tool_call.get('name', '')

        if tool_name in TOOLS_NEEDING_STATE:
            # Get or create args dict
            args = tool_call.get('args', {})
            if not isinstance(args, dict):
                args = {}

            # Inject state
            args['state'] = {
                'user_id': state.get('user_id'),
                'username': state.get('username', ''),
                'session_id': state.get('session_id', ''),
            }
            tool_call['args'] = args

        return tool_call

    # Create standard tool node with our tools
    tool_node = ToolNode(EMBER_TOOLS)

    # Wrap the invoke method to inject state
    original_invoke = tool_node.invoke

    def invoke_with_state_injection(state_input: dict) -> dict:
        """Invoke tool node with state injection."""
        messages = state_input.get('messages', [])

        # Find the last AI message with tool calls
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.tool_calls:
                # Inject state into each tool call
                for tool_call in msg.tool_calls:
                    inject_state(tool_call)
                break

        return original_invoke(state_input)

    tool_node.invoke = invoke_with_state_injection
    return tool_node


# =============================================================================
# Agent Node
# =============================================================================


def create_agent_node(model_name: str = 'gpt-4o-mini'):
    """Create the agent node that calls the LLM with tools bound."""

    llm = ChatOpenAI(model=model_name, temperature=0.7)
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


def create_ember_agent(model_name: str = 'gpt-4o-mini') -> StateGraph:
    """
    Create the unified Ember agent graph.

    Args:
        model_name: OpenAI model to use (default: gpt-4o-mini)

    Returns:
        Compiled LangGraph StateGraph ready for invocation
    """
    # Create the graph
    graph = StateGraph(EmberState)

    # Add nodes
    graph.add_node('agent', create_agent_node(model_name))
    graph.add_node('tools', ToolNode(EMBER_TOOLS))

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

    # Compile and return
    return graph.compile()


def create_ember_agent_with_state_injection(
    model_name: str = 'gpt-4o-mini',
    user_id: int | None = None,
    username: str = '',
    session_id: str = '',
) -> StateGraph:
    """
    Create the Ember agent with pre-configured state injection.

    This variant creates a custom tool node that automatically injects
    user state into tools that need it.

    Args:
        model_name: OpenAI model to use
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
    conversation_history: list[BaseMessage] | None = None,
    is_onboarding: bool = False,
    model_name: str | None = None,
):
    """
    Stream Ember agent response with tool execution events.

    Yields events:
    - {'type': 'token', 'content': '...'} - Text tokens from LLM
    - {'type': 'tool_start', 'tool': '...'} - Tool execution started
    - {'type': 'tool_end', 'tool': '...', 'output': {...}} - Tool completed
    - {'type': 'complete'} - Agent finished
    - {'type': 'error', 'message': '...'} - Error occurred

    Scalability features:
    - Message history truncation (MAX_CONTEXT_MESSAGES)
    - Tool execution timeouts (TOOL_EXECUTION_TIMEOUT)
    - Iteration limits (MAX_TOOL_ITERATIONS)

    Args:
        user_message: User's input message
        user_id: Authenticated user ID
        username: User's username
        session_id: WebSocket session ID
        conversation_history: Optional previous messages
        is_onboarding: Whether this is an onboarding conversation
        model_name: OpenAI model to use (defaults to EMBER_DEFAULT_MODEL)

    Yields:
        Event dicts with type and content
    """
    from langchain_openai import ChatOpenAI

    # Use configured default if not specified
    model_name = model_name or DEFAULT_MODEL

    # Track timing and usage for analytics/billing
    start_time = time.time()
    total_output_content = ''
    total_tool_calls = 0
    status = 'success'
    error_msg = ''

    try:
        # Build messages with history limiting
        messages = list(conversation_history or [])
        messages.append(HumanMessage(content=user_message))

        # Truncate to prevent unbounded memory growth
        messages = _truncate_messages(messages, MAX_CONTEXT_MESSAGES)

        # Select system prompt
        system_prompt = EMBER_FULL_ONBOARDING_PROMPT if is_onboarding else EMBER_SYSTEM_PROMPT

        # Create LLM with streaming and tools
        llm = ChatOpenAI(model=model_name, temperature=0.7, streaming=True)
        llm_with_tools = llm.bind_tools(EMBER_TOOLS)

        # State for injection (immutable - will be copied for each tool)
        state = {
            'user_id': user_id,
            'username': username,
            'session_id': session_id,
        }

        # Build full message list (system prompt + truncated history)
        full_messages = [SystemMessage(content=system_prompt)] + messages

        # Estimate input tokens (system prompt + conversation history + user message)
        input_tokens = _estimate_tokens(system_prompt) + _estimate_messages_tokens(messages)

        iteration = 0

        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1

            # Stream LLM response
            collected_content = ''
            tool_calls = []

            async for chunk in llm_with_tools.astream(full_messages):
                # Handle content chunks
                if chunk.content:
                    collected_content += chunk.content
                    total_output_content += chunk.content
                    yield {'type': 'token', 'content': chunk.content}

                # Collect tool calls
                if hasattr(chunk, 'tool_calls') and chunk.tool_calls:
                    tool_calls.extend(chunk.tool_calls)
                elif hasattr(chunk, 'additional_kwargs'):
                    tc = chunk.additional_kwargs.get('tool_calls', [])
                    if tc:
                        tool_calls.extend(tc)

            # Track tool calls for usage
            total_tool_calls += len(tool_calls)

            # If no tool calls, we're done
            if not tool_calls:
                # Track usage before completing
                latency_ms = int((time.time() - start_time) * 1000)
                output_tokens = _estimate_tokens(total_output_content)
                await _track_ember_usage(
                    user_id=user_id,
                    session_id=session_id,
                    model_name=model_name,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    latency_ms=latency_ms,
                    status=status,
                    is_onboarding=is_onboarding,
                    tool_calls_count=total_tool_calls,
                )
                yield {'type': 'complete'}
                return

            # Execute tool calls
            ai_message = AIMessage(content=collected_content, tool_calls=tool_calls)
            full_messages.append(ai_message)

            # Truncate again after adding messages (tool loops can grow fast)
            full_messages = [full_messages[0]] + _truncate_messages(full_messages[1:], MAX_CONTEXT_MESSAGES)

            for tool_call in tool_calls:
                tool_name = tool_call.get('name', '') if isinstance(tool_call, dict) else tool_call.name
                tool_args = tool_call.get('args', {}) if isinstance(tool_call, dict) else tool_call.args
                tool_id = tool_call.get('id', '') if isinstance(tool_call, dict) else tool_call.id

                yield {'type': 'tool_start', 'tool': tool_name}

                # Get the tool
                tool = EMBER_TOOLS_BY_NAME.get(tool_name)
                if not tool:
                    logger.warning(f'Unknown tool: {tool_name}')
                    yield {
                        'type': 'tool_end',
                        'tool': tool_name,
                        'output': {'error': f'Unknown tool: {tool_name}'},
                    }
                    continue

                # Deep copy args to prevent mutation issues
                # (important when same tool_args dict might be reused)
                tool_args_copy = deepcopy(tool_args) if tool_args else {}

                # Inject state if needed
                if tool_name in TOOLS_NEEDING_STATE:
                    tool_args_copy['state'] = state

                # Execute tool with timeout protection
                exec_result = await _execute_tool_with_timeout(tool, tool_args_copy, TOOL_EXECUTION_TIMEOUT)

                if exec_result['success']:
                    result = exec_result['result']
                    yield {'type': 'tool_end', 'tool': tool_name, 'output': result}

                    # Add tool result to messages
                    from langchain_core.messages import ToolMessage

                    full_messages.append(ToolMessage(content=str(result), tool_call_id=tool_id, name=tool_name))
                else:
                    error_msg = exec_result['error']
                    logger.error(f'Tool {tool_name} failed: {error_msg}')
                    yield {
                        'type': 'tool_end',
                        'tool': tool_name,
                        'output': {'error': error_msg},
                    }

                    # Add error as tool message so LLM knows it failed
                    from langchain_core.messages import ToolMessage

                    full_messages.append(
                        ToolMessage(
                            content=f'Error: {error_msg}',
                            tool_call_id=tool_id,
                            name=tool_name,
                        )
                    )

        # Max iterations reached - warn about potential infinite loop
        logger.warning(
            f'Ember agent reached max iterations ({MAX_TOOL_ITERATIONS}) '
            f'for session {session_id}. Possible infinite tool loop.'
        )

        # Track usage even when max iterations reached
        latency_ms = int((time.time() - start_time) * 1000)
        output_tokens = _estimate_tokens(total_output_content)
        await _track_ember_usage(
            user_id=user_id,
            session_id=session_id,
            model_name=model_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            status='max_iterations',
            is_onboarding=is_onboarding,
            tool_calls_count=total_tool_calls,
        )
        yield {'type': 'complete'}

    except Exception as e:
        logger.error(f'Ember streaming error: {e}', exc_info=True)

        # Track usage on error
        latency_ms = int((time.time() - start_time) * 1000)
        output_tokens = _estimate_tokens(total_output_content)
        await _track_ember_usage(
            user_id=user_id,
            session_id=session_id,
            model_name=model_name,
            input_tokens=input_tokens if 'input_tokens' in dir() else 0,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            status='error',
            error_message=str(e),
            is_onboarding=is_onboarding,
            tool_calls_count=total_tool_calls,
        )
        yield {'type': 'error', 'message': str(e)}


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

    Note: For production use, prefer stream_ember_response() for better UX
    and memory efficiency with streaming.

    Args:
        message: User's message
        user_id: Authenticated user ID
        username: User's username
        session_id: WebSocket session ID
        conversation_history: Optional previous messages
        is_onboarding: Whether this is an onboarding conversation
        model_name: OpenAI model to use (defaults to EMBER_DEFAULT_MODEL)

    Returns:
        Final state dict with messages
    """
    # Use configured default if not specified
    model_name = model_name or DEFAULT_MODEL

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

    # Create and invoke agent
    agent = create_ember_agent(model_name)
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
                model=model_name,
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
