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


def _fetch_image_as_base64(image_url: str) -> str | None:
    """
    Fetch an image from URL and convert to base64 data URI.

    This is needed because AI models can't access localhost/internal URLs.
    We fetch the image ourselves and embed it as base64.

    Handles:
    - Local MinIO URLs (localhost:9000)
    - Production S3 URLs (s3.amazonaws.com)
    - CloudFront URLs
    - Presigned URLs
    """
    import base64
    import os

    import httpx

    try:
        fetch_url = image_url
        image_data = None
        content_type = 'image/png'

        # Convert localhost to Docker internal hostname if running in Docker
        if os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER'):
            if 'localhost:9000' in fetch_url:
                fetch_url = fetch_url.replace('localhost:9000', 'minio:9000')
            if '127.0.0.1:9000' in fetch_url:
                fetch_url = fetch_url.replace('127.0.0.1:9000', 'minio:9000')

        # Check if this is an S3 URL that might need IAM auth (private bucket)
        # Note: Public S3 URLs and presigned URLs work with regular HTTP
        is_s3_private = (
            's3.amazonaws.com' in image_url
            and '?' not in image_url  # Presigned URLs have query params
            and '/public/' not in image_url  # Our public folder
        )

        if is_s3_private:
            # Use storage service with IAM credentials
            try:
                import re

                from services.integrations.storage.storage_service import get_storage_service

                # Parse S3 URL: https://bucket.s3.region.amazonaws.com/key
                # or https://s3.region.amazonaws.com/bucket/key
                match = re.match(r'https?://(?:([^.]+)\.)?s3[.\w-]*\.amazonaws\.com/(.+)', image_url)
                if match:
                    _bucket_or_key = match.group(1) or match.group(2).split('/')[0]
                    object_key = match.group(2) if match.group(1) else '/'.join(match.group(2).split('/')[1:])

                    storage = get_storage_service()
                    response = storage.client.get_object(storage.bucket_name, object_key)
                    image_data = response.read()
                    content_type = response.headers.get('Content-Type', 'image/png')
                    response.close()
                    response.release_conn()
            except Exception as e:
                logger.warning(f'Failed to fetch S3 image with IAM, trying public: {e}')
                is_s3_private = False

        if image_data is None:
            # Fetch via HTTP (works for public URLs, presigned URLs, local URLs)
            response = httpx.get(fetch_url, timeout=30, follow_redirects=True)
            response.raise_for_status()
            image_data = response.content
            content_type = response.headers.get('content-type', 'image/png')

        # Clean content type
        if ';' in content_type:
            content_type = content_type.split(';')[0].strip()

        # Convert to base64 data URI
        base64_image = base64.b64encode(image_data).decode('utf-8')
        logger.info(f'Fetched image ({len(image_data)} bytes) and converted to base64')
        return f'data:{content_type};base64,{base64_image}'

    except Exception as e:
        logger.error(f'Failed to fetch image from {image_url}: {e}')
        return None


def _create_human_message(user_message: str, image_url: str | None = None) -> HumanMessage:
    """
    Create a HumanMessage, optionally with image content for vision.

    For multimodal messages, LangChain expects content to be a list of
    content blocks (text and image_url types).
    """
    if not image_url:
        return HumanMessage(content=user_message)

    # Fetch image and convert to base64 (AI models can't access localhost URLs)
    base64_data_uri = _fetch_image_as_base64(image_url)

    if not base64_data_uri:
        # If image fetch failed, just send text with a note
        logger.warning('Could not fetch image, sending text only')
        return HumanMessage(content=f'{user_message}\n\n[Note: An image was uploaded but could not be processed]')

    # Create multimodal message with text and base64 image
    content = [
        {'type': 'text', 'text': user_message},
        {'type': 'image_url', 'image_url': {'url': base64_data_uri}},
    ]
    return HumanMessage(content=content)


async def stream_profile_generation(
    user_message: str,
    user_id: int,
    username: str,
    session_id: str,
    image_url: str | None = None,
):
    """
    Stream profile generation responses for interactive use.

    Args:
        user_message: The user's text message
        user_id: User ID
        username: Username
        session_id: Session ID for checkpointing
        image_url: Optional URL of an uploaded image (e.g., LinkedIn screenshot)

    Yields:
        Dictionary with response chunks and metadata
    """
    agent = await _get_async_agent()

    config = {'configurable': {'thread_id': session_id, 'user_id': user_id}}

    # Create message (multimodal if image provided)
    human_message = _create_human_message(user_message, image_url)

    input_state = {
        'messages': [human_message],
        'user_id': user_id,
        'username': username,
        'user_data': None,
        'generated_sections': None,
    }

    if image_url:
        logger.info(f'Profile generation with image: {image_url[:50]}...')

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
