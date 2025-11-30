"""
LLM-powered project creation agent using LangGraph.

Uses the centralized AIProvider for LLM access, ensuring consistent
configuration across Azure OpenAI, OpenAI, and Anthropic.
"""

import asyncio
import json
import logging
from collections.abc import Sequence
from functools import partial
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from services.ai_provider import AIProvider

from .prompts import SYSTEM_PROMPT
from .tools import PROJECT_TOOLS

logger = logging.getLogger(__name__)

# Build a lookup for tools that need state injection
TOOLS_NEEDING_STATE = {'create_project', 'import_github_project'}
TOOLS_BY_NAME = {tool.name: tool for tool in PROJECT_TOOLS}


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
class ProjectAgentState(TypedDict):
    """State for the project creation agent."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    # Use reducers to preserve user context across checkpointed state
    user_id: Annotated[int | None, keep_latest_or_existing]
    username: Annotated[str | None, keep_latest_str_or_existing]


# Initialize LLM via centralized AI Gateway
def get_llm():
    """Get configured LLM instance from AIProvider."""
    ai_provider = AIProvider()
    return ai_provider.get_langchain_llm(
        temperature=0.7,
        timeout=30,
        max_retries=2,
    )


# Bind tools to LLM
llm = get_llm()
llm_with_tools = llm.bind_tools(PROJECT_TOOLS)


# Agent node
async def agent_node(state: ProjectAgentState) -> ProjectAgentState:
    """
    Main agent node that processes user input and decides on actions.
    Uses async for non-blocking LLM calls.
    """
    messages = state['messages']

    # Add system prompt if not already present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)

    # Invoke LLM with tools (async)
    response = await llm_with_tools.ainvoke(messages)

    return {'messages': [response]}


# Custom tool node that injects state into tools that need it
async def tool_node(state: ProjectAgentState) -> ProjectAgentState:
    """
    Execute tool calls from the last AI message.

    Manually injects state into tools that need user context,
    since InjectedState has issues with Pydantic args_schema.
    """
    logger.info('=== CUSTOM TOOL_NODE CALLED ===')
    logger.info(f'State keys: {state.keys()}')
    logger.info(f'user_id in state: {state.get("user_id")}')
    logger.info(f'username in state: {state.get("username")}')

    messages = state['messages']
    last_message = messages[-1]

    if not hasattr(last_message, 'tool_calls') or not last_message.tool_calls:
        return {'messages': []}

    tool_messages = []

    for tool_call in last_message.tool_calls:
        tool_name = tool_call['name']
        tool_args = tool_call['args'].copy()
        tool_call_id = tool_call['id']

        logger.info(f'Executing tool: {tool_name} with args: {tool_args}')

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
                    logger.info(f'Injecting state with user_id={state["user_id"]} into {tool_name}')
                    # Call underlying function in a thread to avoid Django's
                    # SynchronousOnlyOperation error when running in async context
                    func_with_args = partial(tool.func, **tool_args, state=injected_state)
                    result = await asyncio.to_thread(func_with_args)
                else:
                    # Execute the tool normally for tools that don't need state
                    # These may also do sync IO, so run in thread
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
def should_continue(state: ProjectAgentState) -> str:
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


# Build graph workflow (without checkpointer - added at runtime)
def _build_workflow():
    """Build the project agent workflow graph."""
    workflow = StateGraph(ProjectAgentState)

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
    from services.auth_agent.checkpointer import get_async_checkpointer

    checkpointer = await get_async_checkpointer()
    agent = _workflow.compile(checkpointer=checkpointer)
    return agent


# Sync agent for non-async contexts (no checkpointer - stateless)
def create_project_agent():
    """Create stateless project agent for sync contexts."""
    return _workflow.compile()


project_agent = create_project_agent()


# Helper function for streaming
async def stream_agent_response(user_message: str, user_id: int, username: str, session_id: str):
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

    # Track if project was created during streaming
    project_created = False
    project_data = None

    try:
        # Stream agent execution
        async for event in agent.astream_events(input_state, config, version='v1'):
            kind = event['event']

            # Stream LLM tokens
            if kind == 'on_chat_model_stream':
                content = event['data']['chunk'].content
                if content:
                    yield {'type': 'token', 'content': content}

            # Tool execution started (standard tools)
            elif kind == 'on_tool_start':
                tool_name = event['name']
                yield {'type': 'tool_start', 'tool': tool_name}

            # Tool execution ended (standard tools)
            elif kind == 'on_tool_end':
                tool_name = event['name']
                raw_output = event['data'].get('output')
                # Convert output to serializable format
                if hasattr(raw_output, 'dict'):
                    output = raw_output.dict()
                elif isinstance(raw_output, dict):
                    output = raw_output
                else:
                    output = str(raw_output) if raw_output else None

                # Check if create_project tool succeeded
                if tool_name == 'create_project' and isinstance(output, dict) and output.get('success'):
                    project_created = True
                    project_data = output

                yield {'type': 'tool_end', 'tool': tool_name, 'output': output}

            # Detect tool results from our custom tool_node via ToolMessage
            elif kind == 'on_chain_end':
                output = event.get('data', {}).get('output')
                # output can be dict, list, string, or None - only process if dict with messages
                if isinstance(output, dict):
                    messages = output.get('messages', [])
                    for msg in messages:
                        # Check if msg is a ToolMessage-like object with name and content
                        if hasattr(msg, 'name') and hasattr(msg, 'content') and msg.name:
                            tool_name = msg.name
                            try:
                                tool_output = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                            except (json.JSONDecodeError, TypeError):
                                tool_output = {'raw': str(msg.content)}

                            # Emit tool_start and tool_end for custom tool_node results
                            yield {'type': 'tool_start', 'tool': tool_name}
                            yield {'type': 'tool_end', 'tool': tool_name, 'output': tool_output}

                            # Check if create_project succeeded
                            if (
                                tool_name == 'create_project'
                                and isinstance(tool_output, dict)
                                and tool_output.get('success')
                            ):
                                project_created = True
                                project_data = tool_output
                                logger.info(f'Project created detected: {project_data}')

        yield {
            'type': 'complete',
            'session_id': session_id,
            'project_created': project_created,
            'project_data': project_data,
        }

    except Exception as e:
        logger.error(f'Error in agent stream: {e}', exc_info=True)
        yield {'type': 'error', 'message': str(e)}
