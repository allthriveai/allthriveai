"""
LLM-powered orchestration agent using LangGraph.

Enables site navigation and UI control with tools for:
- Navigating to pages
- Highlighting UI elements
- Opening trays/panels
- Showing toast notifications
- Triggering actions (with optional confirmation)
"""

import asyncio
import json
import logging
import time
from collections.abc import Sequence
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider

from .prompts import ORCHESTRATION_SYSTEM_PROMPT
from .tools import ORCHESTRATION_TOOLS, ORCHESTRATION_TOOLS_BY_NAME

logger = logging.getLogger(__name__)


# Custom reducers to ensure user context is preserved across checkpoints
def keep_latest_or_existing(existing: int | None, new: int | None) -> int | None:
    """Reducer that keeps new value if provided, otherwise keeps existing."""
    if new is not None:
        return new
    return existing


def keep_latest_str_or_existing(existing: str | None, new: str | None) -> str | None:
    """Reducer that keeps new value if provided, otherwise keeps existing."""
    if new is not None and new != '':
        return new
    return existing


# Agent State with reducers for user context
class OrchestrationAgentState(TypedDict):
    """State for the orchestration agent."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    # Use reducers to preserve user context across checkpointed state
    user_id: Annotated[int | None, keep_latest_or_existing]
    username: Annotated[str | None, keep_latest_str_or_existing]


# Initialize LLM via centralized AI Gateway (lazy initialization for CI compatibility)
_llm_instance = None
_llm_with_tools_instance = None


def get_llm():
    """Get configured LLM instance from AIProvider."""
    global _llm_instance
    if _llm_instance is None:
        ai_provider = AIProvider()
        _llm_instance = ai_provider.get_langchain_llm(
            temperature=0.7,
            timeout=30,
            max_retries=2,
        )
    return _llm_instance


def get_llm_with_tools():
    """Get LLM instance with orchestration tools bound (lazy initialization)."""
    global _llm_with_tools_instance
    if _llm_with_tools_instance is None:
        _llm_with_tools_instance = get_llm().bind_tools(ORCHESTRATION_TOOLS)
    return _llm_with_tools_instance


# Agent node
async def agent_node(state: OrchestrationAgentState) -> OrchestrationAgentState:
    """
    Main agent node that processes user input and decides on actions.
    Uses async for non-blocking LLM calls.
    """
    messages = state['messages']

    # Add system prompt if not already present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=ORCHESTRATION_SYSTEM_PROMPT)] + list(messages)

    # Invoke LLM with tools (async) - use lazy getter for CI compatibility
    response = await get_llm_with_tools().ainvoke(messages)

    return {'messages': [response]}


# Custom tool node - orchestration tools don't need state injection
async def tool_node(state: OrchestrationAgentState) -> OrchestrationAgentState:
    """
    Execute tool calls from the last AI message.

    Orchestration tools return action commands for the frontend to execute.
    """
    logger.info('=== ORCHESTRATION TOOL_NODE CALLED ===')

    messages = state['messages']
    last_message = messages[-1]

    if not hasattr(last_message, 'tool_calls') or not last_message.tool_calls:
        return {'messages': []}

    tool_messages = []

    for tool_call in last_message.tool_calls:
        tool_name = tool_call['name']
        tool_args = tool_call['args'].copy()
        tool_call_id = tool_call['id']

        logger.info(f'Executing orchestration tool: {tool_name} with args: {tool_args}')

        tool = ORCHESTRATION_TOOLS_BY_NAME.get(tool_name)
        if not tool:
            result = {'error': f'Unknown tool: {tool_name}'}
        else:
            try:
                # Orchestration tools don't need state injection - they just return action commands
                result = await asyncio.to_thread(tool.invoke, tool_args)
                logger.info(f'Tool {tool_name} result: {result}')
            except Exception as e:
                logger.error(f'Tool {tool_name} error: {e}', exc_info=True)
                result = {'error': str(e)}

        # Convert result to string for ToolMessage
        if isinstance(result, dict):
            content = json.dumps(result)
        else:
            content = str(result)

        tool_messages.append(ToolMessage(content=content, tool_call_id=tool_call_id, name=tool_name))

    return {'messages': tool_messages}


# Routing function
def should_continue(state: OrchestrationAgentState) -> str:
    """
    Determine if we should continue to tools or end.
    """
    messages = state['messages']
    last_message = messages[-1]

    # If LLM made tool calls, continue to tools
    if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        return 'tools'

    # Otherwise, end
    return END


# Build graph workflow
def _build_workflow():
    """Build the orchestration agent workflow graph."""
    workflow = StateGraph(OrchestrationAgentState)

    # Add nodes
    workflow.add_node('agent', agent_node)
    workflow.add_node('tools', tool_node)

    # Set entry point
    workflow.set_entry_point('agent')

    # Add conditional edges
    workflow.add_conditional_edges('agent', should_continue, {'tools': 'tools', END: END})

    # After tools, always go back to agent
    workflow.add_edge('tools', 'agent')

    return workflow


# Pre-build workflow (checkpointer added when compiling)
_workflow = _build_workflow()


async def _get_async_agent():
    """
    Get async agent with async checkpointer.

    Creates a fresh checkpointer for each call because Celery creates
    a new event loop per task, and the checkpointer's connection pool
    is bound to the event loop it was created in.
    """
    from services.agents.auth.checkpointer import get_async_checkpointer

    checkpointer = await get_async_checkpointer()
    agent = _workflow.compile(checkpointer=checkpointer)
    return agent


# Sync agent for non-async contexts (no checkpointer - stateless)
def create_orchestration_agent():
    """Create stateless orchestration agent for sync contexts."""
    return _workflow.compile()


orchestration_agent = create_orchestration_agent()


# Helper function for streaming
async def stream_orchestration_response(user_message: str, user_id: int, username: str, session_id: str):
    """
    Stream agent responses for a user message.

    Yields:
        Dictionary with response chunks and metadata
    """
    # Get async agent with checkpointer for conversation memory
    agent = await _get_async_agent()

    config = {'configurable': {'thread_id': session_id, 'user_id': user_id}}

    # Create input
    input_state = {'messages': [HumanMessage(content=user_message)], 'user_id': user_id, 'username': username}

    # Track processed events to avoid duplicates
    processed_tool_calls = set()
    processed_stream_runs = set()
    current_stream_run_id = None

    # Track tokens for usage reporting
    start_time = time.time()
    total_output_chars = 0

    try:
        # Stream agent execution
        async for event in agent.astream_events(input_state, config, version='v1'):
            kind = event['event']
            run_id = event.get('run_id', '')

            # Stream LLM tokens
            if kind == 'on_chat_model_stream':
                # Track run_id to prevent duplicate streams from multiple nodes
                if run_id:
                    if run_id in processed_stream_runs and run_id != current_stream_run_id:
                        continue
                    if run_id not in processed_stream_runs:
                        processed_stream_runs.add(run_id)
                        current_stream_run_id = run_id

                content = event.get('data', {}).get('chunk')
                if content:
                    token_content = getattr(content, 'content', content) if hasattr(content, 'content') else content
                    if token_content:
                        total_output_chars += len(str(token_content))
                        logger.debug(
                            f'Streaming token: {token_content[:50]}...'
                            if len(str(token_content)) > 50
                            else f'Streaming token: {token_content}'
                        )
                        yield {'type': 'token', 'content': token_content}

            # Tool execution started
            elif kind == 'on_tool_start':
                tool_name = event.get('name', '')
                run_id = event.get('run_id', '')
                if run_id and run_id not in processed_tool_calls:
                    yield {'type': 'tool_start', 'tool': tool_name}

            # Tool execution ended
            elif kind == 'on_tool_end':
                tool_name = event.get('name', '')
                run_id = event.get('run_id', '')

                if run_id in processed_tool_calls:
                    continue
                processed_tool_calls.add(run_id)

                raw_output = event.get('data', {}).get('output')
                # Convert output to serializable format
                if hasattr(raw_output, 'dict'):
                    output = raw_output.dict()
                elif isinstance(raw_output, dict):
                    output = raw_output
                elif isinstance(raw_output, str):
                    try:
                        output = json.loads(raw_output)
                    except (json.JSONDecodeError, TypeError):
                        output = {'raw': raw_output}
                else:
                    output = str(raw_output) if raw_output else None

                yield {'type': 'tool_end', 'tool': tool_name, 'output': output}

            # Custom tool_node results come through chain end as ToolMessages
            elif kind == 'on_chain_end':
                output = event.get('data', {}).get('output')
                if isinstance(output, dict):
                    messages = output.get('messages', [])
                    for msg in messages:
                        if hasattr(msg, 'name') and hasattr(msg, 'content') and msg.name:
                            tool_name = msg.name
                            try:
                                tool_output = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                            except (json.JSONDecodeError, TypeError):
                                tool_output = {'raw': str(msg.content)}

                            yield {'type': 'tool_start', 'tool': tool_name}
                            yield {'type': 'tool_end', 'tool': tool_name, 'output': tool_output}

        # Track AI usage after streaming completes
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            user = User.objects.get(id=user_id)

            # Estimate tokens: ~4 chars per token (rough average)
            estimated_input_tokens = len(user_message) // 4 + len(ORCHESTRATION_SYSTEM_PROMPT) // 4
            estimated_output_tokens = total_output_chars // 4

            latency_ms = int((time.time() - start_time) * 1000)

            # Get provider info from AIProvider
            ai_provider = AIProvider()
            AIUsageTracker.track_usage(
                user=user,
                feature='langgraph_orchestration_agent',
                provider=ai_provider.current_provider,
                model=ai_provider.current_model,
                input_tokens=estimated_input_tokens,
                output_tokens=estimated_output_tokens,
                latency_ms=latency_ms,
                status='success',
                request_metadata={'session_id': session_id, 'estimated': True},
            )
        except Exception as tracking_error:
            logger.warning(f'Failed to track LangGraph orchestration usage: {tracking_error}')

        yield {
            'type': 'complete',
            'session_id': session_id,
        }

    except Exception as e:
        logger.error(f'Error in orchestration agent stream: {e}', exc_info=True)
        yield {'type': 'error', 'message': str(e)}
