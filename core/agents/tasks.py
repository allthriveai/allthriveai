"""
Celery tasks for async LangGraph chat processing

Handles:
- Async message processing with LangGraph agents
- Streaming responses via Redis Pub/Sub to WebSockets
- Conversation state persistence with two-tier caching
- Image generation with Gemini 2.0 Flash
"""

import logging
import time
import uuid

import requests
from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model

from core.ai_usage.tracker import AIUsageTracker
from core.billing.utils import (
    TRANSIENT_ERRORS,
    check_and_reserve_ai_request,
    deduct_tokens,
    get_subscription_status,
)
from services.agents.auth.checkpointer import cache_checkpoint
from services.ai import AIProvider
from services.integrations.storage import StorageService

from .metrics import MetricsCollector, llm_response_time, timed_metric
from .security import PromptInjectionFilter

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_chat_message_task(self, conversation_id: str, message: str, user_id: int, channel_name: str):
    """
    Process chat message asynchronously using LangGraph agent.

    Streams results to WebSocket via Redis Pub/Sub.

    Args:
        conversation_id: Unique conversation identifier
        message: User message text
        user_id: User ID for permissions and attribution
        channel_name: Redis channel name for WebSocket broadcast

    Returns:
        Dict with processing results
    """
    channel_layer = get_channel_layer()

    try:
        # Validate user exists and get user object
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.error(f'User not found: user_id={user_id}')
            return {'status': 'error', 'reason': 'user_not_found'}

        # Atomically check AND reserve an AI request slot
        # This prevents TOCTOU race conditions where concurrent requests could exceed quota
        can_request, quota_reason = check_and_reserve_ai_request(user)
        if not can_request:
            logger.warning(f'User {user_id} quota exceeded: {quota_reason}')
            # Get subscription status for frontend to show upgrade options
            subscription_status = get_subscription_status(user)
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'quota_exceeded',
                    'error': "You've reached your AI usage limit for this period.",
                    'reason': quota_reason,
                    'subscription': {
                        'tier': subscription_status.get('tier', {}).get('name', 'Free'),
                        'ai_requests': subscription_status.get('ai_requests', {}),
                        'tokens': subscription_status.get('tokens', {}),
                    },
                    'can_purchase_tokens': True,
                    'upgrade_url': '/settings/billing',
                },
            )
            return {'status': 'quota_exceeded', 'reason': quota_reason}

        # Sanitize input
        prompt_filter = PromptInjectionFilter()
        is_safe, reason = prompt_filter.check_input(message)
        if not is_safe:
            logger.warning(f'Prompt injection detected: user_id={user_id}, reason={reason}')
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'error',
                    'error': 'Potentially harmful content detected. Please rephrase your message.',
                },
            )
            return {'status': 'blocked', 'reason': 'prompt_injection'}

        sanitized_message = prompt_filter.sanitize_input(message)

        # Send processing started event
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'processing_started',
                'conversation_id': conversation_id,
            },
        )

        # Determine routing based on conversation context and message content
        # Both project and product creation conversations use the LangGraph agent with tools
        is_project_conversation = conversation_id.startswith('project-')
        is_product_conversation = conversation_id.startswith('product-')

        # Fetch recent conversation history for context-aware intent detection
        conversation_history = _get_conversation_history(conversation_id, limit=5)

        # Use the orchestrator for intelligent multi-agent routing
        # The orchestrator's supervisor analyzes the request and creates a plan
        result = _process_with_orchestrator(
            conversation_id=conversation_id,
            message=sanitized_message,
            user=user,
            channel_name=channel_name,
            channel_layer=channel_layer,
            conversation_history=conversation_history,
            is_project_conversation=is_project_conversation,
            is_product_conversation=is_product_conversation,
        )

        # Send completion event
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
                'project_created': result.get('project_created', False),
            },
        )

        # Cache updated conversation state
        cache_checkpoint(conversation_id, {'last_message': sanitized_message}, ttl=900)

        # Update conversation history cache for future intent detection
        _update_conversation_history_cache(conversation_id, sanitized_message, 'user')

        # Record metrics with detected intent
        MetricsCollector.record_message(result.get('intent', 'orchestrated'), user_id)

        # If we reserved using token balance, now deduct the actual tokens
        # (subscription quota was already incremented atomically in check_and_reserve_ai_request)
        tokens_used = result.get('tokens_used', 0)
        # Default to the configured provider if the result did not specify one.
        provider_used = result.get(
            'provider',
            getattr(settings, 'DEFAULT_AI_PROVIDER', settings.FALLBACK_AI_PROVIDER),
        )
        model_used = result.get('model', 'gpt-4')

        if 'token balance' in quota_reason.lower():
            # User's subscription quota was exhausted, deduct from tokens
            token_amount = tokens_used if tokens_used > 0 else 500  # Default estimate
            deduct_success = deduct_tokens(
                user=user,
                amount=token_amount,
                description=f'AI request via {provider_used} {model_used}',
                ai_provider=provider_used,
                ai_model=model_used,
            )
            if deduct_success:
                logger.info(f'Deducted {token_amount} tokens for user {user_id}')
            else:
                # Log but don't fail - the request already succeeded
                logger.warning(f'Failed to deduct tokens for user {user_id}')

        # Track detailed AI usage for analytics
        if tokens_used > 0:
            detected_intent = result.get('intent', 'orchestrated')
            AIUsageTracker.track_usage(
                user=user,
                feature=f'chat_{detected_intent}',
                provider=provider_used,
                model=model_used,
                input_tokens=result.get('input_tokens', tokens_used // 2),
                output_tokens=result.get('output_tokens', tokens_used // 2),
                request_type='chat',
                session_id=conversation_id,
            )

        logger.info(f'Message processed successfully: conversation={conversation_id}, user={user_id}')

        return {'status': 'success', 'conversation_id': conversation_id}

    except TRANSIENT_ERRORS as e:
        # Transient errors (connection, timeout) - retry with exponential backoff
        logger.warning(f'Transient error processing message, will retry: {e}')
        MetricsCollector.record_circuit_breaker_failure('langgraph_agent')

        try:
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'error',
                    'error': 'Connection issue. Retrying...',
                },
            )
        except Exception as notify_error:
            logger.error(f'Failed to send error notification: {notify_error}')

        raise self.retry(exc=e) from e

    except Exception as e:
        # Non-recoverable errors - don't retry, notify user
        logger.error(f'Failed to process message (non-recoverable): {e}', exc_info=True)
        MetricsCollector.record_circuit_breaker_failure('langgraph_agent')

        try:
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'error',
                    'error': 'Failed to process message. Please try again.',
                },
            )
        except Exception as notify_error:
            logger.error(f'Failed to send error notification: {notify_error}')

        # Don't retry non-recoverable errors (bad input, auth issues, etc.)
        return {'status': 'error', 'reason': str(e)}


def _process_with_orchestrator(
    conversation_id: str,
    message: str,
    user,
    channel_name: str,
    channel_layer,
    conversation_history: list[dict] | None = None,
    is_project_conversation: bool = False,
    is_product_conversation: bool = False,
) -> dict:
    """
    Process message using the multi-agent orchestrator.

    The orchestrator:
    1. Analyzes the request via a supervisor agent
    2. Creates an execution plan (single or multi-agent)
    3. Executes agents with handoffs between them
    4. Synthesizes results for multi-agent workflows

    Args:
        conversation_id: Unique conversation identifier
        message: Sanitized user message
        user: User object
        channel_name: Redis channel for WebSocket
        channel_layer: Django Channels layer
        conversation_history: Recent conversation context
        is_project_conversation: Whether this is a project creation flow
        is_product_conversation: Whether this is a product creation flow

    Returns:
        Dict with processing results
    """
    import asyncio

    from services.agents.orchestrator import orchestrate_request
    from services.agents.orchestrator.handoff import AgentType
    from services.agents.orchestrator.supervisor import get_supervisor

    logger.info(f'Processing with orchestrator: conversation={conversation_id}')

    result = {'project_created': False, 'intent': 'orchestrated'}

    # Get orchestration plan first to determine routing
    supervisor = get_supervisor(user_id=user.id)
    plan = supervisor.create_plan(message, conversation_history)

    # Log the plan
    logger.info(f'Orchestration plan: type={plan.plan_type}, agents={[a.get("agent") for a in plan.agents]}')

    # For project/product conversations, override to project-creation if plan suggests support
    if (is_project_conversation or is_product_conversation) and plan.primary_agent == AgentType.SUPPORT:
        # Use the existing project agent directly
        logger.info('Project conversation - using project agent directly')
        result['intent'] = 'project-creation'
        return _process_with_langgraph_agent(
            conversation_id=conversation_id,
            message=message,
            user=user,
            channel_name=channel_name,
            channel_layer=channel_layer,
        )

    # For single-agent plans, use optimized direct routing
    if plan.is_single_agent and plan.primary_agent:
        agent = plan.primary_agent
        result['intent'] = agent.value

        if agent == AgentType.PROJECT:
            return _process_with_langgraph_agent(
                conversation_id=conversation_id,
                message=message,
                user=user,
                channel_name=channel_name,
                channel_layer=channel_layer,
            )
        elif agent == AgentType.IMAGE_GENERATION:
            return _process_image_generation(
                conversation_id=conversation_id,
                message=message,
                user=user,
                channel_name=channel_name,
                channel_layer=channel_layer,
            )
        elif agent == AgentType.DISCOVERY:
            return _process_with_discovery_agent(
                conversation_id=conversation_id,
                message=message,
                user=user,
                channel_name=channel_name,
                channel_layer=channel_layer,
            )
        elif agent == AgentType.LEARNING:
            return _process_with_learning_agent(
                conversation_id=conversation_id,
                message=message,
                user=user,
                channel_name=channel_name,
                channel_layer=channel_layer,
            )
        else:
            # Support fallback
            return _process_with_ai_provider(
                conversation_id=conversation_id,
                message=message,
                user_id=user.id,
                intent='support',
                channel_name=channel_name,
                channel_layer=channel_layer,
            )

    # Multi-agent workflow - use the full orchestrator
    logger.info(f'Executing multi-agent workflow: {len(plan.agents)} agents')

    async def run_orchestrator():
        """Async function to run the orchestrator and stream to WebSocket."""
        from channels.layers import get_channel_layer as get_async_channel_layer

        async_channel_layer = get_async_channel_layer()

        try:
            async for event in orchestrate_request(
                user_message=message,
                user_id=user.id,
                username=user.username,
                session_id=conversation_id,
                conversation_history=conversation_history,
            ):
                event_type = event.get('type')

                if event_type == 'orchestration_start':
                    # Notify frontend that orchestration is analyzing the request
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'orchestration_start',
                            'message': event.get('message', 'Analyzing your request...'),
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info('Orchestration started')

                elif event_type == 'token':
                    chunk_content = event.get('content', '')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': chunk_content,
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'agent_error':
                    # An agent failed but workflow is continuing
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'agent_error',
                            'agent': event.get('agent', ''),
                            'error': event.get('error', 'Agent encountered an issue'),
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.warning(f'Agent error (continuing): {event.get("agent")} - {event.get("error")}')

                elif event_type == 'agent_step':
                    # Notify frontend about agent transitions
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'agent_step',
                            'step': event.get('step'),
                            'total': event.get('total'),
                            'agent': event.get('agent'),
                            'task': event.get('task'),
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Agent step {event.get("step")}/{event.get("total")}: {event.get("agent")}')

                elif event_type == 'tool_start':
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_start',
                            'tool': event.get('tool', ''),
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'tool_end':
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_end',
                            'tool': event.get('tool', ''),
                            'output': event.get('output', {}),
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'synthesis_start':
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'synthesis_start',
                            'message': event.get('message', 'Combining results...'),
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'route_to_image_generation':
                    # Special case: orchestrator wants to invoke image generation
                    # This is handled outside the async context
                    nonlocal result
                    result['route_to_image'] = True
                    result['image_message'] = event.get('message', message)

                elif event_type == 'complete':
                    logger.info('Orchestrator completed')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'error':
                    error_msg = event.get('message', 'Unknown error')
                    logger.error(f'Orchestrator error: {error_msg}')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': 'I encountered an issue processing your request. Please try again.',
                            'conversation_id': conversation_id,
                        },
                    )
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                        },
                    )

        except Exception as e:
            logger.error(f'Orchestrator streaming error: {e}', exc_info=True)
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': 'I encountered an issue. Please try again.',
                    'conversation_id': conversation_id,
                },
            )
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'completed',
                    'conversation_id': conversation_id,
                },
            )

    # Run the async orchestrator
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_orchestrator())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f'Orchestrator error: {e}', exc_info=True)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': 'I encountered an issue. Please try again.',
                'conversation_id': conversation_id,
            },
        )
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
            },
        )

    # Handle image generation routing if flagged
    if result.get('route_to_image'):
        image_result = _process_image_generation(
            conversation_id=conversation_id,
            message=result.get('image_message', message),
            user=user,
            channel_name=channel_name,
            channel_layer=channel_layer,
        )
        result.update(image_result)

    return result


def _process_with_langgraph_agent(
    conversation_id: str,
    message: str,
    user,
    channel_name: str,
    channel_layer,
) -> dict:
    """
    Process message using the LangGraph project agent with tools.

    This enables tool calling for project creation (GitHub import, etc.)

    Args:
        conversation_id: Unique conversation identifier
        message: Sanitized user message
        user: User object
        channel_name: Redis channel for WebSocket
        channel_layer: Django Channels layer

    Returns:
        Dict with processing results including project_created flag
    """
    import asyncio

    from services.agents.project.agent import stream_agent_response

    logger.info(f'Processing with LangGraph agent: conversation={conversation_id}')

    project_created = False

    async def run_agent():
        """Async function to stream agent response and send to WebSocket."""
        nonlocal project_created

        # Get a fresh channel layer inside the async context to avoid event loop issues
        # channels_redis creates connections tied to the current event loop
        from channels.layers import get_channel_layer as get_async_channel_layer

        async_channel_layer = get_async_channel_layer()

        try:
            async for event in stream_agent_response(
                user_message=message,
                user_id=user.id,
                username=user.username,
                session_id=conversation_id,
            ):
                event_type = event.get('type')

                if event_type == 'token':
                    # Stream text chunk to WebSocket
                    chunk_content = event.get('content', '')
                    logger.info(
                        f'[CHANNEL_SEND] Sending chunk to {channel_name}: {chunk_content[:50]}...'
                        if len(str(chunk_content)) > 50
                        else f'[CHANNEL_SEND] Sending chunk to {channel_name}: {chunk_content}'
                    )
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': chunk_content,
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'tool_start':
                    # Notify frontend that a tool is being called
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_start',
                            'tool': event.get('tool', ''),
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Tool started: {event.get("tool")}')

                elif event_type == 'tool_end':
                    # Notify frontend that tool completed
                    tool_output = event.get('output', {})
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_end',
                            'tool': event.get('tool', ''),
                            'output': tool_output,
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Tool ended: {event.get("tool")} - output: {tool_output}')

                elif event_type == 'complete':
                    project_created = event.get('project_created', False)
                    logger.info(f'Agent completed: project_created={project_created}')
                    # Send completed event so frontend knows streaming is done
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                            'project_created': project_created,
                        },
                    )

                elif event_type == 'error':
                    error_msg = event.get('message', 'Unknown error')
                    logger.error(f'Agent error: {error_msg}')
                    # Check for content filter errors from Azure OpenAI
                    if 'content_filter' in error_msg or 'ResponsibleAIPolicyViolation' in error_msg:
                        user_message = (
                            "I couldn't process that request due to content policy restrictions. "
                            'Please try rephrasing your message or using a different image.'
                        )
                    else:
                        user_message = 'I encountered an issue processing your request. Please try again.'
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': user_message,
                            'conversation_id': conversation_id,
                        },
                    )
                    # Send completed event so frontend stops loading
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                        },
                    )

        except Exception as e:
            logger.error(f'Agent streaming error: {e}', exc_info=True)
            # Check for content filter errors from Azure OpenAI
            error_str = str(e)
            if 'content_filter' in error_str or 'ResponsibleAIPolicyViolation' in error_str:
                error_message = (
                    "I couldn't process that request due to content policy restrictions. "
                    'Please try rephrasing your message or using a different image.'
                )
            else:
                error_message = (
                    "I'm here to help! However, I encountered an issue processing your request. Please try again."
                )
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': error_message,
                    'conversation_id': conversation_id,
                },
            )
            # Send completed event so frontend stops loading
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'completed',
                    'conversation_id': conversation_id,
                },
            )

    # Run the async function - create new event loop since we're in sync context
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_agent())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f'LangGraph agent error: {e}', exc_info=True)
        # Check for content filter errors from Azure OpenAI
        error_str = str(e)
        if 'content_filter' in error_str or 'ResponsibleAIPolicyViolation' in error_str:
            error_message = (
                "I couldn't process that request due to content policy restrictions. "
                'Please try rephrasing your message or using a different image.'
            )
        else:
            error_message = (
                "I'm here to help! However, I encountered an issue processing your request. Please try again."
            )
        # Send error message to user (sync context, use async_to_sync)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': error_message,
                'conversation_id': conversation_id,
            },
        )
        # Send completed event so frontend stops loading
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
            },
        )

    return {'project_created': project_created}


def _process_with_discovery_agent(
    conversation_id: str,
    message: str,
    user,
    channel_name: str,
    channel_layer,
) -> dict:
    """
    Process message using the LangGraph discovery agent with tools.

    This enables conversational project discovery with search, recommendations,
    and exploration capabilities.

    Args:
        conversation_id: Unique conversation identifier
        message: Sanitized user message
        user: User object
        channel_name: Redis channel for WebSocket
        channel_layer: Django Channels layer

    Returns:
        Dict with processing results
    """
    import asyncio

    from services.agents.discovery.agent import stream_discovery_response

    logger.info(f'Processing with discovery agent: conversation={conversation_id}')

    async def run_agent():
        """Async function to stream agent response and send to WebSocket."""
        from channels.layers import get_channel_layer as get_async_channel_layer

        async_channel_layer = get_async_channel_layer()

        try:
            async for event in stream_discovery_response(
                user_message=message,
                user_id=user.id,
                username=user.username,
                session_id=conversation_id,
            ):
                event_type = event.get('type')

                if event_type == 'token':
                    # Stream text chunk to WebSocket
                    chunk_content = event.get('content', '')
                    logger.debug(
                        f'[DISCOVERY] Sending chunk to {channel_name}: {chunk_content[:50]}...'
                        if len(str(chunk_content)) > 50
                        else f'[DISCOVERY] Sending chunk: {chunk_content}'
                    )
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': chunk_content,
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'tool_start':
                    # Notify frontend that a tool is being called
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_start',
                            'tool': event.get('tool', ''),
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Discovery tool started: {event.get("tool")}')

                elif event_type == 'tool_end':
                    # Notify frontend that tool completed
                    tool_output = event.get('output', {})
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_end',
                            'tool': event.get('tool', ''),
                            'output': tool_output,
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Discovery tool ended: {event.get("tool")}')

                elif event_type == 'complete':
                    logger.info('Discovery agent completed')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'error':
                    error_msg = event.get('message', 'Unknown error')
                    logger.error(f'Discovery agent error: {error_msg}')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': 'I encountered an issue searching for projects. Please try again.',
                            'conversation_id': conversation_id,
                        },
                    )
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                        },
                    )

        except Exception as e:
            logger.error(f'Discovery agent streaming error: {e}', exc_info=True)
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': "I'm here to help! However, I encountered an issue. Please try again.",
                    'conversation_id': conversation_id,
                },
            )
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'completed',
                    'conversation_id': conversation_id,
                },
            )

    # Run the async function - create new event loop since we're in sync context
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_agent())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f'Discovery agent error: {e}', exc_info=True)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': "I'm here to help you discover projects! However, I encountered an issue. Please try again.",
                'conversation_id': conversation_id,
            },
        )
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
            },
        )

    return {}


def _process_with_learning_agent(
    conversation_id: str,
    message: str,
    user,
    channel_name: str,
    channel_layer,
) -> dict:
    """
    Process message using the LangGraph learning tutor agent.

    This enables AI-powered learning assistance with tools for:
    - Checking learning progress
    - Providing quiz hints
    - Explaining concepts
    - Suggesting next activities

    Args:
        conversation_id: Unique conversation identifier
        message: Sanitized user message
        user: User object
        channel_name: Redis channel for WebSocket
        channel_layer: Django Channels layer

    Returns:
        Dict with processing results
    """
    import asyncio

    from services.agents.learning.agent import stream_learning_response

    logger.info(f'Processing with learning agent: conversation={conversation_id}')

    async def run_agent():
        """Async function to stream agent response and send to WebSocket."""
        from channels.layers import get_channel_layer as get_async_channel_layer

        async_channel_layer = get_async_channel_layer()

        try:
            async for event in stream_learning_response(
                user_message=message,
                user_id=user.id,
                username=user.username,
                session_id=conversation_id,
            ):
                event_type = event.get('type')

                if event_type == 'token':
                    # Stream text chunk to WebSocket
                    chunk_content = event.get('content', '')
                    logger.debug(
                        f'[LEARNING] Sending chunk to {channel_name}: {chunk_content[:50]}...'
                        if len(str(chunk_content)) > 50
                        else f'[LEARNING] Sending chunk: {chunk_content}'
                    )
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': chunk_content,
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'tool_start':
                    # Notify frontend that a tool is being called
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_start',
                            'tool': event.get('tool', ''),
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Learning tool started: {event.get("tool")}')

                elif event_type == 'tool_end':
                    # Notify frontend that tool completed
                    tool_output = event.get('output', {})
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_end',
                            'tool': event.get('tool', ''),
                            'output': tool_output,
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Learning tool ended: {event.get("tool")}')

                elif event_type == 'complete':
                    logger.info('Learning agent completed')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'error':
                    error_msg = event.get('message', 'Unknown error')
                    logger.error(f'Learning agent error: {error_msg}')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': 'I encountered an issue helping with your learning. Please try again!',
                            'conversation_id': conversation_id,
                        },
                    )
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'completed',
                            'conversation_id': conversation_id,
                        },
                    )

        except Exception as e:
            logger.error(f'Learning agent streaming error: {e}', exc_info=True)
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': "I'm Scout, your learning guide! I encountered an issue. Please try again.",
                    'conversation_id': conversation_id,
                },
            )
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'completed',
                    'conversation_id': conversation_id,
                },
            )

    # Run the async function - create new event loop since we're in sync context
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_agent())
        finally:
            loop.close()
    except Exception as e:
        logger.error(f'Learning agent error: {e}', exc_info=True)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': "I'm Pip, your learning tutor! I encountered an issue. Please try again.",
                'conversation_id': conversation_id,
            },
        )
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
            },
        )

    return {}


def _process_with_ai_provider(
    conversation_id: str,
    message: str,
    user_id: int,
    intent: str,
    channel_name: str,
    channel_layer,
) -> dict:
    """
    Process message using simple AIProvider streaming (fallback).

    Used for support and discovery intents, or when LangGraph is disabled.

    Args:
        conversation_id: Unique conversation identifier
        message: Sanitized user message
        user_id: User ID
        intent: Detected intent
        channel_name: Redis channel for WebSocket
        channel_layer: Django Channels layer

    Returns:
        Dict with processing results
    """
    # Resolve provider name: prefer DEFAULT_AI_PROVIDER, then FALLBACK_AI_PROVIDER.
    provider_name = getattr(
        settings,
        'DEFAULT_AI_PROVIDER',
        settings.FALLBACK_AI_PROVIDER,
    )
    # Let AIProvider pick the appropriate model based on the provider
    model = None

    # Build system prompt based on detected intent
    system_message = _get_system_prompt_for_intent(intent)

    # Stream AI response
    with timed_metric(llm_response_time, provider=provider_name, model=model or 'default'):
        ai = AIProvider(provider=provider_name, user_id=user_id)

        try:
            for chunk in ai.stream_complete(
                prompt=message,
                model=model,
                temperature=0.7,
                max_tokens=None,
                system_message=system_message,
            ):
                async_to_sync(channel_layer.group_send)(
                    channel_name,
                    {
                        'type': 'chat.message',
                        'event': 'chunk',
                        'chunk': chunk,
                        'conversation_id': conversation_id,
                    },
                )

        except Exception as agent_error:
            logger.error(f'AI provider error: {agent_error}', exc_info=True)
            # Fall back to simple response on error
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': "I'm here to help! However, I encountered an issue processing your request. "
                    'Please try again.',
                    'conversation_id': conversation_id,
                },
            )

    return {'project_created': False}


def _get_conversation_history(conversation_id: str, limit: int = 5) -> list[dict]:
    """
    Fetch recent conversation history for context-aware intent detection.

    Uses the LangGraph checkpointer cache first, then falls back to database
    for conversations that persist messages.

    Args:
        conversation_id: The conversation identifier (e.g., 'project-123')
        limit: Maximum number of messages to retrieve

    Returns:
        List of message dicts with 'sender' and 'content' keys
    """
    from django.core.cache import cache

    # Try cache first (conversation state from LangGraph checkpointer)
    cache_key = f'conversation_history:{conversation_id}'
    cached_history = cache.get(cache_key)
    if cached_history:
        logger.debug(f'Cache hit for conversation history: {conversation_id}')
        return cached_history[-limit:] if len(cached_history) > limit else cached_history

    # For project conversations, try to get history from Message model
    # Note: conversation_id is like 'project-123', not a database ID
    # Messages are stored with the conversation foreign key
    try:
        from .models import Conversation, Message

        # Try to find a conversation with matching ID pattern
        # For now, we use the cache-based history from checkpointer
        # Future: Store WebSocket messages in Message model for persistence
        conversation = Conversation.objects.filter(title__icontains=conversation_id).first()

        if conversation:
            messages = Message.objects.filter(conversation=conversation).order_by('-created_at')[:limit]

            history = [
                {'sender': msg.role, 'content': msg.content[:500]}  # Truncate long messages
                for msg in reversed(messages)
            ]

            # Cache for 5 minutes
            cache.set(cache_key, history, timeout=300)
            return history

    except Exception as e:
        logger.debug(f'Could not fetch conversation history from DB: {e}')

    # Return empty history if nothing found
    return []


def _update_conversation_history_cache(conversation_id: str, content: str, sender: str) -> None:
    """
    Update the conversation history cache with a new message.

    Args:
        conversation_id: The conversation identifier
        content: Message content (truncated to 500 chars)
        sender: 'user' or 'assistant'
    """
    from django.core.cache import cache

    cache_key = f'conversation_history:{conversation_id}'
    history = cache.get(cache_key) or []

    # Append new message
    history.append(
        {
            'sender': sender,
            'content': content[:500],  # Truncate to prevent cache bloat
        }
    )

    # Keep only last 10 messages
    if len(history) > 10:
        history = history[-10:]

    # Cache for 15 minutes (conversation session duration)
    cache.set(cache_key, history, timeout=900)


def _get_system_prompt_for_intent(intent: str) -> str:
    """
    Get appropriate system prompt based on detected intent.

    Args:
        intent: Detected intent (support, project-creation, discovery)

    Returns:
        System prompt string
    """
    if intent == 'project-creation':
        return (
            'You are an AI project creation assistant in AllThrive AI. '
            'Help users describe, structure, and create AI/ML projects. '
            'Ask clarifying questions about project goals, tech stack, data sources, '
            'and key features. Guide them through providing GitHub repos, YouTube videos, '
            'or detailed descriptions. Be encouraging and provide concrete suggestions '
            'for project structure and next steps.'
        )

    if intent == 'discovery':
        return (
            'You are an AI discovery assistant in AllThrive AI. '
            'Help users explore, find, and discover interesting AI/ML projects. '
            'Suggest relevant topics, explain emerging trends, recommend projects '
            'based on their interests, and help them understand different AI domains. '
            "Be enthusiastic about showcasing the community's work and making connections "
            'between similar projects.'
        )

    # Default: support
    return (
        'You are a helpful support assistant for AllThrive AI, a platform for '
        'managing and showcasing AI/ML projects. Help users understand features, '
        'troubleshoot issues, learn how to use the platform, and answer questions '
        'about functionality. Be patient, clear, and provide step-by-step guidance. '
        'Keep responses concise and practical.'
    )


def _process_image_generation(
    conversation_id: str,
    message: str,
    user,
    channel_name: str,
    channel_layer,
    reference_image_urls: list[str] | None = None,
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Process image generation request using Gemini 2.0 Flash.

    Generates images based on user prompts and streams progress via WebSocket.
    Tracks iterations in ImageGenerationSession for project creation.

    Args:
        conversation_id: Unique conversation identifier
        message: User's image generation prompt
        user: User object
        channel_name: Redis channel for WebSocket
        channel_layer: Django Channels layer
        reference_image_urls: Optional URLs of reference images
        conversation_history: Previous turns for multi-turn refinement

    Returns:
        Dict with processing results including image_generated flag and session_id
    """
    from .models import ImageGenerationIteration, ImageGenerationSession

    logger.info(f'Processing image generation: conversation={conversation_id}')

    # Check if the message is too vague/generic and needs more details
    vague_prompts = [
        'create an image or infographic for me',
        'create an image for me',
        'create an infographic for me',
        'make an image',
        'make an infographic',
        'generate an image',
        'generate an infographic',
        'i want an image',
        'i want an infographic',
        'create a visual',
        'make a visual',
    ]
    normalized_message = message.lower().strip()
    is_vague_request = any(
        normalized_message == vague or normalized_message.startswith(vague) for vague in vague_prompts
    )

    if is_vague_request:
        # Send a prompt asking for more details with explicit format choice
        response_text = (
            "I'd love to help! What topic would you like me to visualize?\n\n"
            "Just describe what you want, and let me know if you'd prefer:\n"
            '• An **infographic** (great for step-by-step guides, comparisons, or data)\n'
            '• A **photo/image** (great for scenes, objects, or artistic visuals)\n\n'
            'For example: "Create an infographic about making pour-over coffee" or '
            '"Generate an image of a cozy coffee shop"'
        )
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': response_text,
                'conversation_id': conversation_id,
            },
        )
        # Send completed event to finalize the message
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
                'mode': 'image-generation',
            },
        )
        return {
            'success': True,
            'response': 'Asked for more details',
            'image_generated': False,
            'awaiting_description': True,
        }

    # Get or create session for tracking iterations
    session, created = ImageGenerationSession.objects.get_or_create(
        conversation_id=conversation_id,
        user=user,
        defaults={'final_image_url': ''},
    )
    if created:
        logger.info(f'Created new image generation session: {session.id}')

    # Send "generating" status with session_id
    async_to_sync(channel_layer.group_send)(
        channel_name,
        {
            'type': 'chat.message',
            'event': 'image_generating',
            'message': 'Creating your image with Nano Banana...',
            'conversation_id': conversation_id,
            'session_id': session.id,
        },
    )

    try:
        # Download reference images if provided
        reference_bytes = []
        for url in reference_image_urls or []:
            try:
                resp = requests.get(url, timeout=10)
                if resp.status_code == 200:
                    reference_bytes.append(resp.content)
            except Exception as e:
                logger.warning(f'Failed to download reference image {url}: {e}')

        # Generate image using Gemini (with timing for usage tracking)
        from django.conf import settings

        start_time = time.time()
        ai = AIProvider(provider='gemini', user_id=user.id)
        image_bytes, mime_type, text_response = ai.generate_image(
            prompt=message,
            conversation_history=conversation_history,
            reference_images=reference_bytes if reference_bytes else None,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        if not image_bytes:
            # No image was generated - send error
            error_message = text_response or "Sorry, I couldn't generate that image. Try a different description!"
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': error_message,
                    'conversation_id': conversation_id,
                },
            )
            # Send completed event so frontend stops loading
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'completed',
                    'conversation_id': conversation_id,
                },
            )
            return {'image_generated': False, 'session_id': session.id}

        # Upload to MinIO
        filename = f'nano-banana-{uuid.uuid4()}.png'
        storage = StorageService()
        image_url, upload_error = storage.upload_file(
            file_data=image_bytes,
            filename=filename,
            folder='generated-images',
            content_type=mime_type or 'image/png',
            is_public=True,
        )

        if upload_error or not image_url:
            logger.error(f'Failed to upload image: {upload_error}')
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': "I generated the image but couldn't save it. Please try again!",
                    'conversation_id': conversation_id,
                },
            )
            # Send completed event so frontend stops loading
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'completed',
                    'conversation_id': conversation_id,
                },
            )
            return {'image_generated': False, 'session_id': session.id}

        logger.info(f'Image generated and uploaded: {image_url}')

        # Track AI usage for image generation
        try:
            gemini_model = getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-3-pro-image-preview')
            # Estimate tokens: prompt chars / 4 (rough approximation)
            estimated_input_tokens = len(message) // 4
            estimated_output_tokens = len(text_response) // 4 if text_response else 0

            AIUsageTracker.track_usage(
                user=user,
                feature='image_generation',
                provider='google',
                model=gemini_model,
                input_tokens=estimated_input_tokens,
                output_tokens=estimated_output_tokens,
                latency_ms=latency_ms,
                status='success',
                request_metadata={
                    'session_id': session.id,
                    'image_size_bytes': len(image_bytes),
                    'estimated': True,
                },
            )
        except Exception as tracking_error:
            logger.warning(f'Failed to track image generation usage: {tracking_error}')

        # Track this iteration in the session
        iteration_order = session.iterations.count()
        ImageGenerationIteration.objects.create(
            session=session,
            prompt=message,
            image_url=image_url,
            gemini_response_text=text_response or '',
            order=iteration_order,
        )

        # Update session's final image URL
        session.final_image_url = image_url
        session.save(update_fields=['final_image_url', 'updated_at'])

        logger.info(f'Saved iteration {iteration_order} for session {session.id}')

        # Send text response first if available
        if text_response:
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': text_response,
                    'conversation_id': conversation_id,
                },
            )

        # Send success with image URL and session info
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'image_generated',
                'image_url': image_url,
                'filename': filename,
                'conversation_id': conversation_id,
                'session_id': session.id,
                'iteration_number': iteration_order + 1,
            },
        )

        return {'image_generated': True, 'image_url': image_url, 'session_id': session.id}

    except Exception as e:
        logger.error(f'Image generation failed: {e}', exc_info=True)

        # Check for content filter errors from Azure OpenAI
        error_str = str(e)
        if 'content_filter' in error_str or 'ResponsibleAIPolicyViolation' in error_str:
            error_message = (
                "I couldn't process that request due to content policy restrictions. "
                'Please try rephrasing your message or using a different image.'
            )
        else:
            error_message = (
                'I encountered an issue generating your image. Please try again with a different description!'
            )

        # Send error message
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': error_message,
                'conversation_id': conversation_id,
            },
        )
        # Send completed event so frontend stops loading
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
            },
        )

        return {'image_generated': False}
