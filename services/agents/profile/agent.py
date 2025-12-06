"""
LLM-powered profile generation agent using LangGraph.

This agent analyzes user data (projects, achievements, interests) and
generates personalized profile sections. Can be used during onboarding
or when users want to refresh their profile.
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

from .prompts import SYSTEM_PROMPT
from .tools import PROFILE_TOOLS

logger = logging.getLogger(__name__)

# Build tool lookups
TOOLS_NEEDING_STATE = {'gather_user_data', 'generate_profile_sections', 'save_profile_sections'}
TOOLS_BY_NAME = {tool.name: tool for tool in PROFILE_TOOLS}


# Custom reducers to preserve user context across checkpoints
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


def keep_latest_dict_or_existing(existing: dict | None, new: dict | None) -> dict | None:
    """Reducer for dict values."""
    if new is not None:
        return new
    return existing


# Agent State
class ProfileAgentState(TypedDict):
    """State for the profile generation agent."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_id: Annotated[int | None, keep_latest_or_existing]
    username: Annotated[str | None, keep_latest_str_or_existing]
    # Profile-specific state
    user_data: Annotated[dict | None, keep_latest_dict_or_existing]
    generated_sections: Annotated[dict | None, keep_latest_dict_or_existing]


# LLM initialization (lazy for CI compatibility)
_llm_instance = None
_llm_with_tools_instance = None


def get_llm():
    """Get configured LLM instance from AIProvider."""
    global _llm_instance
    if _llm_instance is None:
        ai_provider = AIProvider()
        _llm_instance = ai_provider.get_langchain_llm(
            temperature=0.7,
            timeout=60,  # Longer timeout for profile generation
            max_retries=2,
        )
    return _llm_instance


def get_llm_with_tools():
    """Get LLM instance with profile tools bound."""
    global _llm_with_tools_instance
    if _llm_with_tools_instance is None:
        _llm_with_tools_instance = get_llm().bind_tools(PROFILE_TOOLS)
    return _llm_with_tools_instance


# Agent node
async def agent_node(state: ProfileAgentState) -> ProfileAgentState:
    """
    Main agent node that processes user input and decides on actions.
    """
    messages = state['messages']

    # Add system prompt if not already present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)

    # Invoke LLM with tools
    response = await get_llm_with_tools().ainvoke(messages)

    return {'messages': [response]}


# Custom tool node with state injection
async def tool_node(state: ProfileAgentState) -> ProfileAgentState:
    """
    Execute tool calls from the last AI message.
    Injects state into tools that need user context.
    """
    logger.info('=== PROFILE AGENT TOOL_NODE CALLED ===')
    logger.info(f'user_id in state: {state.get("user_id")}')

    messages = state['messages']
    last_message = messages[-1]

    if not hasattr(last_message, 'tool_calls') or not last_message.tool_calls:
        return {'messages': []}

    tool_messages = []
    updated_state = {}

    for tool_call in last_message.tool_calls:
        tool_name = tool_call['name']
        tool_args = tool_call['args'].copy()
        tool_call_id = tool_call['id']

        logger.info(f'Executing tool: {tool_name}')

        tool = TOOLS_BY_NAME.get(tool_name)
        if not tool:
            result = {'error': f'Unknown tool: {tool_name}'}
        else:
            try:
                # Inject state for tools that need it
                if tool_name in TOOLS_NEEDING_STATE:
                    injected_state = {
                        'user_id': state['user_id'],
                        'username': state['username'],
                    }
                    func_with_args = partial(tool.func, **tool_args, state=injected_state)
                    result = await asyncio.to_thread(func_with_args)
                else:
                    result = await asyncio.to_thread(tool.invoke, tool_args)

                # Capture results for state updates
                if tool_name == 'gather_user_data' and isinstance(result, dict) and result.get('success'):
                    updated_state['user_data'] = result

                if tool_name == 'generate_profile_sections' and isinstance(result, dict) and result.get('success'):
                    updated_state['generated_sections'] = result

                logger.info(f'Tool {tool_name} completed successfully')

            except Exception as e:
                logger.error(f'Tool {tool_name} error: {e}', exc_info=True)
                result = {'error': str(e)}

        # Convert result to string for ToolMessage
        if isinstance(result, dict):
            content = json.dumps(result)
        else:
            content = str(result)

        tool_messages.append(ToolMessage(content=content, tool_call_id=tool_call_id, name=tool_name))

    # Return tool messages and any state updates
    return_state = {'messages': tool_messages}
    return_state.update(updated_state)
    return return_state


# Routing function
def should_continue(state: ProfileAgentState) -> str:
    """Determine if we should continue to tools or end."""
    messages = state['messages']
    last_message = messages[-1]

    if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        return 'tools'

    return END


# Build workflow
def _build_workflow():
    """Build the profile agent workflow graph."""
    workflow = StateGraph(ProfileAgentState)

    workflow.add_node('agent', agent_node)
    workflow.add_node('tools', tool_node)

    workflow.set_entry_point('agent')

    workflow.add_conditional_edges('agent', should_continue, {'tools': 'tools', END: END})
    workflow.add_edge('tools', 'agent')

    return workflow


_workflow = _build_workflow()


async def _get_async_agent():
    """Get async agent with checkpointer for conversation memory."""
    from services.agents.auth.checkpointer import get_async_checkpointer

    checkpointer = await get_async_checkpointer()
    agent = _workflow.compile(checkpointer=checkpointer)
    return agent


def create_profile_agent():
    """Create stateless profile agent for sync contexts."""
    return _workflow.compile()


profile_agent = create_profile_agent()


# =============================================================================
# Public API Functions
# =============================================================================


async def generate_profile(user_id: int, username: str, focus_areas: list[str] | None = None) -> dict:
    """
    Generate profile sections for a user (non-streaming).

    This is the main entry point for automatic profile generation.
    Can be called during onboarding or profile refresh.

    Args:
        user_id: The user's ID
        username: The user's username
        focus_areas: Optional list of areas to highlight

    Returns:
        Dictionary with generated sections and any errors
    """
    from .prompts import USER_PROMPT_TEMPLATE

    agent = await _get_async_agent()

    # Build user message
    focus_str = ', '.join(focus_areas) if focus_areas else 'my overall expertise and achievements'

    # Get basic user info for prompt
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
        user_message = USER_PROMPT_TEMPLATE.format(
            focus_areas=focus_str,
            name=user.get_full_name() or username,
            tagline=user.tagline or '(none set)',
            bio=user.bio[:100] + '...' if user.bio and len(user.bio) > 100 else user.bio or '(none set)',
            project_count=getattr(user, 'lifetime_projects_created', 0) or 0,
            level=user.level or 1,
            tier=user.tier or 'seedling',
        )
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    config = {'configurable': {'thread_id': f'profile-gen-{user_id}'}}

    input_state = {
        'messages': [HumanMessage(content=user_message)],
        'user_id': user_id,
        'username': username,
        'user_data': None,
        'generated_sections': None,
    }

    try:
        # Run agent
        final_state = await agent.ainvoke(input_state, config)

        # Extract generated sections
        sections = final_state.get('generated_sections', {}).get('sections', [])

        return {
            'success': True,
            'sections': sections,
            'message': f'Generated {len(sections)} profile sections',
        }

    except Exception as e:
        logger.error(f'Profile generation failed: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


async def stream_profile_generation(
    user_message: str,
    user_id: int,
    username: str,
    session_id: str,
):
    """
    Stream profile generation responses for interactive use.

    Yields:
        Dictionary with response chunks and metadata
    """
    agent = await _get_async_agent()

    config = {'configurable': {'thread_id': session_id, 'user_id': user_id}}

    input_state = {
        'messages': [HumanMessage(content=user_message)],
        'user_id': user_id,
        'username': username,
        'user_data': None,
        'generated_sections': None,
    }

    # Track for deduplication
    processed_tool_calls = set()
    processed_stream_runs = set()
    current_stream_run_id = None

    # Track for usage
    start_time = time.time()
    total_output_chars = 0

    try:
        async for event in agent.astream_events(input_state, config, version='v1'):
            kind = event['event']
            run_id = event.get('run_id', '')

            # Stream LLM tokens
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

                # Emit sections generated event
                if tool_name == 'generate_profile_sections' and isinstance(output, dict) and output.get('success'):
                    yield {
                        'type': 'sections_generated',
                        'sections': output.get('sections', []),
                    }

            # Handle chain end for custom tool_node
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

                            if (
                                tool_name == 'generate_profile_sections'
                                and isinstance(tool_output, dict)
                                and tool_output.get('success')
                            ):
                                yield {
                                    'type': 'sections_generated',
                                    'sections': tool_output.get('sections', []),
                                }

        # Track usage
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            user = User.objects.get(id=user_id)

            estimated_input_tokens = len(user_message) // 4 + len(SYSTEM_PROMPT) // 4
            estimated_output_tokens = total_output_chars // 4

            latency_ms = int((time.time() - start_time) * 1000)

            ai_provider = AIProvider()
            AIUsageTracker.track_usage(
                user=user,
                feature='langgraph_profile_agent',
                provider=ai_provider.current_provider,
                model=ai_provider.current_model,
                input_tokens=estimated_input_tokens,
                output_tokens=estimated_output_tokens,
                latency_ms=latency_ms,
                status='success',
                request_metadata={'session_id': session_id, 'estimated': True},
            )
        except Exception as tracking_error:
            logger.warning(f'Failed to track profile agent usage: {tracking_error}')

        yield {
            'type': 'complete',
            'session_id': session_id,
        }

    except Exception as e:
        logger.error(f'Error in profile agent stream: {e}', exc_info=True)
        yield {'type': 'error', 'message': str(e)}
