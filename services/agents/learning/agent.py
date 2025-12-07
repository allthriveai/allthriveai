"""
LLM-powered learning tutor agent using LangGraph.

Enables AI-powered learning assistance with tools for:
- Checking learning progress
- Providing quiz hints
- Explaining concepts
- Suggesting next activities
"""

import asyncio
import json
import logging
import time
from collections.abc import Sequence
from functools import partial
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider

from .prompts import LEARNING_SYSTEM_PROMPT
from .tools import LEARNING_TOOLS, TOOLS_BY_NAME, TOOLS_NEEDING_STATE

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
class LearningAgentState(TypedDict):
    """State for the learning tutor agent."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_id: Annotated[int | None, keep_latest_or_existing]
    username: Annotated[str | None, keep_latest_str_or_existing]


# Initialize LLM via centralized AI Gateway (lazy initialization)
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
    """Get LLM instance with learning tools bound (lazy initialization)."""
    global _llm_with_tools_instance
    if _llm_with_tools_instance is None:
        _llm_with_tools_instance = get_llm().bind_tools(LEARNING_TOOLS)
    return _llm_with_tools_instance


# Agent node
async def agent_node(state: LearningAgentState) -> LearningAgentState:
    """Main agent node that processes user input and decides on actions."""
    messages = state['messages']

    # Add system prompt if not already present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=LEARNING_SYSTEM_PROMPT)] + list(messages)

    response = await get_llm_with_tools().ainvoke(messages)
    return {'messages': [response]}


# Custom tool node that injects state into tools that need it
async def tool_node(state: LearningAgentState) -> LearningAgentState:
    """Execute tool calls from the last AI message."""
    logger.info('=== LEARNING TOOL_NODE CALLED ===')

    messages = state['messages']
    last_message = messages[-1]

    if not hasattr(last_message, 'tool_calls') or not last_message.tool_calls:
        return {'messages': []}

    tool_messages = []

    for tool_call in last_message.tool_calls:
        tool_name = tool_call['name']
        tool_args = tool_call['args'].copy()
        tool_call_id = tool_call['id']

        logger.info(f'Executing learning tool: {tool_name} with args: {tool_args}')

        tool = TOOLS_BY_NAME.get(tool_name)
        if not tool:
            result = {'error': f'Unknown tool: {tool_name}'}
        else:
            try:
                # Inject state for tools that need it
                if tool_name in TOOLS_NEEDING_STATE:
                    injected_state = {
                        'user_id': state.get('user_id'),
                        'username': state.get('username'),
                    }
                    func_with_args = partial(tool.func, **tool_args, state=injected_state)
                    result = await asyncio.to_thread(func_with_args)
                else:
                    result = await asyncio.to_thread(tool.invoke, tool_args)
                logger.info(f'Tool {tool_name} result: {result}')
            except Exception as e:
                logger.error(f'Tool {tool_name} error: {e}', exc_info=True)
                result = {'error': str(e)}

        if isinstance(result, dict):
            content = json.dumps(result)
        else:
            content = str(result)

        tool_messages.append(ToolMessage(content=content, tool_call_id=tool_call_id, name=tool_name))

    return {'messages': tool_messages}


# Routing function
def should_continue(state: LearningAgentState) -> str:
    """Determine if we should continue to tools or end."""
    messages = state['messages']
    last_message = messages[-1]

    if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        return 'tools'
    return END


# Build graph workflow
def _build_workflow():
    """Build the learning tutor agent workflow graph."""
    workflow = StateGraph(LearningAgentState)

    workflow.add_node('agent', agent_node)
    workflow.add_node('tools', tool_node)

    workflow.set_entry_point('agent')
    workflow.add_conditional_edges('agent', should_continue, {'tools': 'tools', END: END})
    workflow.add_edge('tools', 'agent')

    return workflow


_workflow = _build_workflow()


async def _get_async_agent():
    """Get async agent with async checkpointer."""
    from services.agents.auth.checkpointer import get_async_checkpointer

    checkpointer = await get_async_checkpointer()
    agent = _workflow.compile(checkpointer=checkpointer)
    return agent


def create_learning_agent():
    """Create stateless learning agent for sync contexts."""
    return _workflow.compile()


learning_agent = create_learning_agent()


async def stream_learning_response(user_message: str, user_id: int, username: str, session_id: str):
    """Stream agent responses for a user message."""
    agent = await _get_async_agent()

    config = {'configurable': {'thread_id': session_id, 'user_id': user_id}}
    input_state = {'messages': [HumanMessage(content=user_message)], 'user_id': user_id, 'username': username}

    processed_tool_calls = set()
    processed_stream_runs = set()
    current_stream_run_id = None

    start_time = time.time()
    total_output_chars = 0

    try:
        async for event in agent.astream_events(input_state, config, version='v1'):
            kind = event['event']
            run_id = event.get('run_id', '')

            if kind == 'on_chat_model_stream':
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
                        yield {'type': 'token', 'content': token_content}

            elif kind == 'on_tool_start':
                tool_name = event.get('name', '')
                run_id = event.get('run_id', '')
                if run_id and run_id not in processed_tool_calls:
                    yield {'type': 'tool_start', 'tool': tool_name}

            elif kind == 'on_tool_end':
                tool_name = event.get('name', '')
                run_id = event.get('run_id', '')

                if run_id in processed_tool_calls:
                    continue
                processed_tool_calls.add(run_id)

                raw_output = event.get('data', {}).get('output')
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

        # Track AI usage
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            user = User.objects.get(id=user_id)

            estimated_input_tokens = len(user_message) // 4 + len(LEARNING_SYSTEM_PROMPT) // 4
            estimated_output_tokens = total_output_chars // 4
            latency_ms = int((time.time() - start_time) * 1000)

            ai_provider = AIProvider()
            AIUsageTracker.track_usage(
                user=user,
                feature='langgraph_learning_agent',
                provider=ai_provider.current_provider,
                model=ai_provider.current_model,
                input_tokens=estimated_input_tokens,
                output_tokens=estimated_output_tokens,
                latency_ms=latency_ms,
                status='success',
                request_metadata={'session_id': session_id, 'estimated': True},
            )
        except Exception as tracking_error:
            logger.warning(f'Failed to track LangGraph learning usage: {tracking_error}')

        yield {'type': 'complete', 'session_id': session_id}

    except Exception as e:
        logger.error(f'Error in learning agent stream: {e}', exc_info=True)
        yield {'type': 'error', 'message': str(e)}
