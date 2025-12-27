"""
Celery tasks for async LangGraph chat processing

Handles:
- Async message processing with LangGraph agents
- Streaming responses via Redis Pub/Sub to WebSockets
- Conversation state persistence with two-tier caching
- Image generation with Gemini 2.0 Flash
"""

import logging
import re
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
    get_subscription_status,
    reconcile_token_reservation,
)
from core.logging_utils import StructuredLogger
from services.agents.auth.checkpointer import cache_checkpoint
from services.ai import AIProvider
from services.integrations.storage import StorageService

from .metrics import MetricsCollector, llm_response_time, timed_metric
from .security import PromptInjectionFilter

logger = logging.getLogger(__name__)


def _sanitize_urls(text: str) -> str:
    """
    Sanitize URLs in AI responses to use relative paths.

    AI agents sometimes output absolute URLs with various domain variations.
    We convert these to relative URLs so they work in all environments
    (localhost, staging, production).

    Args:
        text: The text content to sanitize

    Returns:
        Text with relative URLs (no domain prefix)
    """
    if not text:
        return text
    # Convert all AllThrive domain URLs to relative paths
    # Matches: https://allthriveai.com/, https://allthrive.ai/, http://www.allthrive.ai/, etc.
    return re.sub(r'https?://(?:www\.)?(?:allthriveai\.com|allthrive\.ai)/?', '/', text)


User = get_user_model()


# =============================================================================
# Async Utilities for Celery Tasks
# =============================================================================


def _run_async(coro):
    """
    Run an async coroutine from sync Celery task context.

    This is the single place where we create event loops for async agent execution.
    Using a dedicated function ensures consistent handling and makes it easier
    to swap out implementations (e.g., for better Celery integration).

    Note: asyncio.run() would be ideal but can conflict with channels_redis
    which expects to manage its own event loop. We create a new loop to isolate
    our async code from any existing loop state.

    Args:
        coro: Async coroutine to execute

    Returns:
        Result from the coroutine
    """
    import asyncio

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_user_friendly_error(exception: Exception) -> str:
    """
    Convert technical exceptions into user-friendly error messages.

    Args:
        exception: The exception that occurred

    Returns:
        A user-friendly error message string
    """
    error_str = str(exception).lower()
    exception_type = type(exception).__name__

    # OpenAI / AI provider errors
    if 'rate limit' in error_str or 'ratelimit' in error_str:
        return 'Our AI service is experiencing high demand. Please wait a moment and try again.'

    if 'quota' in error_str or 'insufficient_quota' in error_str:
        return 'AI service quota exceeded. Please try again later or contact support.'

    if 'invalid_api_key' in error_str or 'authentication' in error_str:
        return 'AI service configuration issue. Our team has been notified.'

    if 'context_length_exceeded' in error_str or 'token' in error_str and 'limit' in error_str:
        return 'Your message is too long. Please try a shorter message.'

    if 'content_filter' in error_str or 'responsibleaipolicyviolation' in error_str:
        return "Your request couldn't be processed due to content policy. Please rephrase your message."

    if 'timeout' in error_str or 'timed out' in error_str:
        return 'The request took too long. Please try again with a simpler request.'

    if 'connection' in error_str and ('refused' in error_str or 'error' in error_str):
        return 'Unable to connect to AI service. Please try again in a moment.'

    # URL/Web scraping errors - rate limiting
    if 'rate limit exceeded' in error_str and ('try again' in error_str or 'please' in error_str):
        # This is our scraper's rate limit - extract domain if present
        if 'for ' in error_str:
            # Extract domain name from "Rate limit exceeded for reddit.com"
            return "You've hit a rate limit for this website. Please wait a minute and try again."
        return 'Rate limit reached. Please wait a moment and try again.'

    if 'rate limited' in error_str or 'too many requests' in error_str or '429' in error_str:
        return 'Too many requests to this website. Please wait a minute and try again.'

    # URL/Web scraping errors - access issues
    if 'access denied' in error_str or 'blocking automated' in error_str:
        return 'This website is blocking automated access. Try a different URL or import manually.'

    if 'url' in error_str and ('invalid' in error_str or 'fetch' in error_str):
        return "Unable to access the provided URL. Please check that it's correct and publicly accessible."

    if 'scrape' in error_str or 'webpage' in error_str:
        return 'Unable to import content from this webpage. The site may be blocking automated access.'

    # GitHub errors
    if 'github' in error_str:
        if 'not found' in error_str or '404' in error_str:
            return 'GitHub repository not found. Please check the URL and ensure the repo is public or you have access.'
        if 'rate limit' in error_str:
            return 'GitHub API rate limit reached. Please try again in a few minutes.'
        if 'authentication' in error_str or 'token' in error_str:
            return 'GitHub authentication required. Please connect your GitHub account in settings.'

    # Permission/auth errors
    if 'permission' in error_str or 'forbidden' in error_str or '403' in error_str:
        return "You don't have permission to perform this action."

    if 'not found' in error_str or '404' in error_str:
        return 'The requested resource was not found.'

    # Database/server errors
    if 'database' in error_str or 'db' in error_str:
        return 'A database error occurred. Please try again.'

    if exception_type in ('ConnectionError', 'ConnectionRefusedError'):
        return 'Service temporarily unavailable. Please try again.'

    if exception_type == 'ValidationError':
        return f'Invalid input: {str(exception)[:100]}'

    # Default: log the full error for debugging but show a generic message
    logger.debug(f'Unhandled error type for user message: {exception_type}: {error_str[:200]}')
    return 'Something went wrong processing your request. Please try again or rephrase your message.'


# =============================================================================
# Conversation Persistence
# =============================================================================


def _should_persist_conversation(conversation_id: str) -> bool:
    """Determine if this conversation should be persisted.

    Only sidebar chats are persisted. Project-specific chats are skipped.

    Persisted patterns:
    - ava-chat-{userId}: Main sidebar chat
    - ava-learn-{userId}: Learn page chat
    - ava-explore-{userId}: Explore page chat
    - learn-{slug}-{userId}: Learning path detail chat
    - avatar-{timestamp}: Avatar generation
    - {timestamp}: Image generation

    Skipped:
    - project-{projectId}: Project-specific chats
    """
    if conversation_id.startswith('project-'):
        return False
    return True


def _generate_conversation_title(conversation_id: str) -> str:
    """Generate human-readable title from conversation_id."""
    if conversation_id.startswith('ava-chat'):
        return 'Ava Chat'
    elif conversation_id.startswith('ava-learn'):
        return 'Ava Learn Chat'
    elif conversation_id.startswith('ava-explore'):
        return 'Ava Explore Chat'
    elif conversation_id.startswith('learn-'):
        return 'Learning Path Chat'
    elif conversation_id.startswith('avatar-'):
        return 'Avatar Generation'
    return 'Image Generation'


def _get_conversation_type(conversation_id: str) -> str:
    """Determine conversation type from ID pattern."""
    if conversation_id.startswith('ava-chat'):
        return 'ava_chat'
    elif conversation_id.startswith('ava-learn'):
        return 'ava_learn'
    elif conversation_id.startswith('ava-explore'):
        return 'ava_explore'
    elif conversation_id.startswith('learn-'):
        return 'learning_path'
    elif conversation_id.startswith('avatar-'):
        return 'avatar'
    return 'image'


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def persist_conversation_message(
    self,
    user_id: int,
    conversation_id: str,
    user_message: str,
    assistant_message: str,
):
    """Async task to persist chat messages to database.

    Runs after streaming completes - no impact on chat latency.
    Only persists sidebar chats (Ava, Sage, avatar, image gen).
    Skips project-specific conversations.
    """
    from .models import Conversation, Message

    # Skip project conversations - only persist sidebar chats
    if not _should_persist_conversation(conversation_id):
        logger.debug(f'Skipping persistence for project conversation: {conversation_id}')
        return

    conversation_type = _get_conversation_type(conversation_id)

    try:
        # SECURITY: User-scoped lookup - conversations are unique per user
        conversation, created = Conversation.objects.get_or_create(
            user_id=user_id,
            conversation_id=conversation_id,
            defaults={
                'conversation_type': conversation_type,
                'title': _generate_conversation_title(conversation_id),
            },
        )

        if created:
            logger.info(f'Created new conversation record: user={user_id}, conversation_id={conversation_id}')

        # Create user message
        Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_message,
        )

        # Create assistant message
        Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=assistant_message,
        )

        # Touch conversation to update timestamp
        conversation.save(update_fields=['updated_at'])

        logger.debug(f'Persisted messages for conversation: {conversation_id}')

    except Exception as e:
        logger.error(f'Failed to persist conversation message: {e}', exc_info=True)
        raise self.retry(exc=e) from e


# =============================================================================
# Chat Message Processing
# =============================================================================


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_chat_message_task(
    self,
    conversation_id: str,
    message: str,
    user_id: int,
    channel_name: str,
    lesson_context: dict | None = None,
    image_url: str | None = None,
):
    """
    Process chat message asynchronously using LangGraph agent.

    Streams results to WebSocket via Redis Pub/Sub.

    Args:
        conversation_id: Unique conversation identifier
        message: User message text
        user_id: User ID for permissions and attribution
        channel_name: Redis channel name for WebSocket broadcast
        lesson_context: Optional lesson context for learning path chat mode
            Contains: lesson_title, path_title, explanation, key_concepts, practice_prompt
        image_url: Optional URL to an image for multimodal messages (e.g., LinkedIn screenshot)

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
            StructuredLogger.log_service_operation(
                service_name='AgentChat',
                operation='quota_exceeded',
                success=False,
                metadata={
                    'user_id': user_id,
                    'conversation_id': conversation_id,
                    'quota_reason': quota_reason,
                },
                logger_instance=logger,
            )
            # Get subscription status for frontend to show upgrade options
            subscription_status = get_subscription_status(user)

            # Extract ai_requests data and convert date to string for serialization
            ai_requests = subscription_status.get('ai_requests', {})
            if 'reset_date' in ai_requests and ai_requests['reset_date']:
                ai_requests = {**ai_requests, 'reset_date': str(ai_requests['reset_date'])}

            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'quota_exceeded',
                    'error': "You've reached your AI usage limit for this period.",
                    'reason': quota_reason,
                    'subscription': {
                        'tier': subscription_status.get('tier', {}).get('name', 'Free'),
                        'ai_requests': ai_requests,
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
            StructuredLogger.log_service_operation(
                service_name='AgentChat',
                operation='prompt_injection_blocked',
                success=False,
                metadata={
                    'user_id': user_id,
                    'conversation_id': conversation_id,
                    'block_reason': reason,
                },
                logger_instance=logger,
            )
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
        # Check if this is an architecture regeneration conversation (e.g., project-123-architecture)
        is_architecture_conversation = '-architecture' in conversation_id

        # Fetch recent conversation history for context-aware intent detection
        conversation_history = _get_conversation_history(conversation_id, limit=5)

        # IMPORTANT: Close DB connection before long AI call
        # This prevents connection pool exhaustion when AI calls take 30-120 seconds
        # Django will automatically get a new connection when needed after the AI call
        from django.db import connection as db_connection

        db_connection.close()
        logger.debug(f'Released DB connection before AI call for {conversation_id}')

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
            is_architecture_conversation=is_architecture_conversation,
            lesson_context=lesson_context,
            image_url=image_url,
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
            # User's subscription quota was exhausted, tokens were reserved upfront
            # Now reconcile the reservation with actual usage
            actual_tokens = tokens_used if tokens_used > 0 else 500  # Default estimate

            # Extract reserved amount from quota_reason (e.g., "Reserved 500 from token balance")
            # Default to 500 if we can't parse it
            import re

            reserved_match = re.search(r'Reserved (\d+)', quota_reason)
            reserved_amount = int(reserved_match.group(1)) if reserved_match else 500

            reconcile_success = reconcile_token_reservation(
                user=user,
                reserved_amount=reserved_amount,
                actual_amount=actual_tokens,
                description=f'AI request via {provider_used} {model_used}',
                ai_provider=provider_used,
                ai_model=model_used,
            )
            if reconcile_success:
                logger.info(
                    f'Reconciled token usage for user {user_id}: ' f'reserved={reserved_amount}, actual={actual_tokens}'
                )
            else:
                # Log but don't fail - the request already succeeded
                logger.warning(f'Failed to reconcile token reservation for user {user_id}')

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
        StructuredLogger.log_service_operation(
            service_name='AgentChat',
            operation='transient_error',
            success=False,
            metadata={
                'user_id': user_id,
                'conversation_id': conversation_id,
                'error_type': type(e).__name__,
                'retry_attempt': self.request.retries,
            },
            logger_instance=logger,
        )
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
        StructuredLogger.log_critical_failure(
            alert_type='llm_failure',
            message='Non-recoverable LLM processing failure',
            error=e,
            user=user if 'user' in dir() else None,
            metadata={
                'user_id': user_id,
                'conversation_id': conversation_id,
                'error_type': type(e).__name__,
            },
            logger_instance=logger,
        )
        MetricsCollector.record_circuit_breaker_failure('langgraph_agent')

        # Get user-friendly error message
        user_error = _get_user_friendly_error(e)

        try:
            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'error',
                    'error': user_error,
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
    is_architecture_conversation: bool = False,
    lesson_context: dict | None = None,
    image_url: str | None = None,
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
        is_architecture_conversation: Whether this is an architecture diagram regeneration flow
        lesson_context: Optional lesson context for learning path chat mode
            Contains: lesson_title, path_title, explanation, key_concepts, practice_prompt
        image_url: Optional URL to an image for multimodal messages

    Returns:
        Dict with processing results
    """
    logger.info(f'Processing with orchestrator: conversation={conversation_id}')

    result = {'project_created': False, 'intent': 'orchestrated'}

    # ==========================================================================
    # UNIFIED AVA AGENT ROUTING
    # ==========================================================================
    # All requests now go to the unified Ava agent which has all 27 tools.
    # Only exception: Image generation uses Gemini (different provider).
    # ==========================================================================

    message_lower = message.lower()

    # Check for uploaded media files FIRST - these should NOT trigger image generation
    # Uploaded files appear as markdown links like [image: filename.png](http://localhost:9000/...)
    uploaded_media_pattern = r'\[(image|video):\s*[^\]]+\]\(https?://[^)]+\)'
    has_uploaded_media = bool(re.search(uploaded_media_pattern, message, re.IGNORECASE))

    # Image generation keywords - routes to Gemini 2.0 Flash (different provider)
    # ONLY if no uploaded media is present
    image_keywords = [
        'create an image',
        'create an infographic',
        'make an image',
        'make an infographic',
        'generate an image',
        'generate an infographic',
        'help me create an infographic',
        'create a visual',
        'make a visual',
        'create image',
        'create infographic',
    ]
    if not has_uploaded_media and any(keyword in message_lower for keyword in image_keywords):
        logger.info('Routing to image generation (Gemini 2.0 Flash)')
        result['intent'] = 'image_generation'
        return _process_image_generation(
            conversation_id=conversation_id,
            message=message,
            user=user,
            channel_name=channel_name,
            channel_layer=channel_layer,
        )

    # Everything else → Unified Ava agent (has all 27 tools)
    # - Discovery tools (search, recommend, trending, similar, details)
    # - Learning tools (progress, hints, explain, suggest, quiz)
    # - Project tools (create, import, media, scrape, architecture)
    # - Orchestration tools (navigate, highlight, toast, tray, trigger)
    # - Profile tools (gather, generate, save)
    is_ava_conversation = conversation_id.startswith('ava-')
    logger.info(f'Routing to unified Ava agent (is_ava_conversation={is_ava_conversation})')
    result['intent'] = 'ava-unified'
    return _process_with_ava(
        conversation_id=conversation_id,
        message=message,
        user=user,
        channel_name=channel_name,
        channel_layer=channel_layer,
        is_onboarding=is_ava_conversation,  # Only AvaHomePage conversations are onboarding
        conversation_history=conversation_history,  # Pass conversation history for context
        lesson_context=lesson_context,  # Pass lesson context for learning path chat
        image_url=image_url,  # Pass image URL for multimodal messages
    )


def _process_with_ava(
    conversation_id: str,
    message: str,
    user,
    channel_name: str,
    channel_layer,
    is_onboarding: bool = False,
    conversation_history: list[dict] | None = None,
    lesson_context: dict | None = None,
    image_url: str | None = None,
) -> dict:
    """
    Process message using the unified Ava agent with all tools.

    This agent has access to ALL tools:
    - Discovery (5 tools) - search, recommend, trending, similar, details
    - Learning (5 tools) - progress, hints, explain, suggest, quiz details
    - Project (10+ tools) - create, import, media, scrape, architecture
    - Orchestration (5 tools) - navigate, highlight, toast, tray, trigger
    - Profile (3 tools) - gather, generate, save

    Args:
        conversation_id: Unique conversation identifier
        message: Sanitized user message
        user: User object
        channel_name: Redis channel for WebSocket
        channel_layer: Django Channels layer
        is_onboarding: Whether this is an onboarding conversation
        conversation_history: Recent conversation context for stateful processing
        lesson_context: Optional lesson context for learning path chat mode
            Contains: lesson_title, path_title, explanation, key_concepts, practice_prompt
        image_url: Optional URL to an image for multimodal messages

    Returns:
        Dict with processing results
    """
    from services.agents.ava import stream_ava_response

    logger.info(f'Processing with unified Ava agent: conversation={conversation_id}, onboarding={is_onboarding}')
    # Note: Ava agent uses LangGraph checkpointing for conversation memory.
    # The conversation_id is used as thread_id for persistent state.

    async def run_agent():
        """Async function to stream agent response and send to WebSocket."""
        from channels.layers import get_channel_layer as get_async_channel_layer

        async_channel_layer = get_async_channel_layer()
        full_response = []  # Accumulate chunks for persistence

        try:
            async for event in stream_ava_response(
                user_message=message,
                user_id=user.id,
                username=user.username,
                session_id=conversation_id,  # Used as thread_id for checkpointer
                is_onboarding=is_onboarding,
                lesson_context=lesson_context,
                image_url=image_url,
            ):
                event_type = event.get('type')

                if event_type == 'token':
                    # Stream text chunk to WebSocket
                    chunk_content = event.get('content', '')
                    # Sanitize URLs to use correct domain
                    chunk_content = _sanitize_urls(chunk_content)
                    full_response.append(chunk_content)  # Accumulate for persistence
                    logger.debug(
                        f'[AVA] Sending chunk to {channel_name}: {chunk_content[:50]}...'
                        if len(str(chunk_content)) > 50
                        else f'[AVA] Sending chunk: {chunk_content}'
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
                    logger.info(f'Ava tool started: {event.get("tool")}')

                elif event_type == 'tool_end':
                    # Notify frontend that tool completed
                    tool_output = event.get('output', {})
                    tool_name = event.get('tool', '')

                    # DEBUG: Log what we're sending to frontend
                    if tool_name == 'find_content':
                        content = tool_output.get('content', []) if isinstance(tool_output, dict) else []
                        projects = tool_output.get('projects', []) if isinstance(tool_output, dict) else []
                        content_list = list(content) if isinstance(content, list | tuple) else [content]
                        projects_list = list(projects) if isinstance(projects, list | tuple) else [projects]
                        logger.info(
                            f'[DEBUG tool_end] Sending to frontend: tool={tool_name}, '
                            f'content_count={len(content_list)}, projects_count={len(projects_list)}'
                        )
                        if content_list:
                            logger.info(f'[DEBUG tool_end] content[0] type: {type(content_list[0]).__name__}')

                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'tool_end',
                            'tool': tool_name,
                            'output': tool_output,
                            'conversation_id': conversation_id,
                        },
                    )
                    logger.info(f'Ava tool ended: {tool_name}')

                elif event_type == 'complete':
                    # Persist conversation to database (async via Celery)
                    accumulated_text = ''.join(full_response)
                    if accumulated_text.strip():
                        persist_conversation_message.delay(
                            user_id=user.id,
                            conversation_id=conversation_id,
                            user_message=message,
                            assistant_message=accumulated_text,
                        )
                    logger.info('Ava agent stream completed')

                elif event_type == 'error':
                    error_msg = event.get('message', 'Unknown error')
                    logger.error(f'Ava agent error: {error_msg}')
                    await async_channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'error',  # Use 'error' event so frontend triggers error handlers
                            'error': 'Oops! Let me try that again.',
                            'conversation_id': conversation_id,
                        },
                    )
                    # Don't send 'completed' here - let the task function send it
                    # This prevents duplicate completed events

        except Exception as e:
            logger.error(f'Ava agent streaming error: {e}', exc_info=True)
            await async_channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'error',  # Use 'error' event so frontend triggers error handlers
                    'error': 'Something went sideways—mind trying that again?',
                    'conversation_id': conversation_id,
                },
            )
            # Don't send 'completed' here - the task function will send it
            # This prevents duplicate completed events

    # Run the async function using centralized async runner
    try:
        _run_async(run_agent())
    except Exception as e:
        # This catches errors from the async runner itself (rare)
        logger.error(f'Ava agent error: {e}', exc_info=True)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'error',  # Use 'error' event so frontend triggers error handlers
                'error': 'Something went sideways—mind trying that again?',
                'conversation_id': conversation_id,
            },
        )
        # Don't send 'completed' here - the task function will send it

    # Note: Conversation history is handled by PostgreSQL checkpointer,
    # so no Redis caching needed for Ava responses.

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
                    'chunk': "Hmm, that didn't work. Want to try again?",
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
        'i want to create an infographic',
        'i want to create an image',
        'i want to make an infographic',
        'i want to make an image',
        'create a visual',
        'make a visual',
        # "Help me" variations
        'help me create an infographic',
        'help me create an image',
        'help me make an infographic',
        'help me make an image',
        'help me generate an infographic',
        'help me generate an image',
        "i'm interested in creating an infographic",
        "i'd like to create an infographic",
        "i'd like to make an infographic",
    ]
    normalized_message = message.lower().strip()
    # Also check if message contains vague phrases (not just startswith)
    is_vague_request = any(
        normalized_message == vague or normalized_message.startswith(vague) or vague in normalized_message
        for vague in vague_prompts
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

        # Structured logging for image generation success
        StructuredLogger.log_service_operation(
            service_name='ImageGeneration',
            operation='generate_success',
            success=True,
            metadata={
                'user_id': user.id,
                'conversation_id': conversation_id,
                'session_id': session.id,
                'image_size_bytes': len(image_bytes),
                'latency_ms': latency_ms,
            },
            logger_instance=logger,
        )

        # Track AI usage for image generation
        try:
            gemini_model = getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-3-pro-image-preview')
            # Estimate tokens: prompt chars / 4 (rough approximation)
            estimated_input_tokens = len(message) // 4
            estimated_output_tokens = len(text_response) // 4 if text_response else 0

            AIUsageTracker.track_usage(
                user=user,
                feature='image_generation',
                provider='gemini',
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

        # Persist the image generation interaction (async via Celery)
        assistant_response = text_response or f'Generated image: {image_url}'
        persist_conversation_message.delay(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message=message,
            assistant_message=assistant_response,
        )

        return {'image_generated': True, 'image_url': image_url, 'session_id': session.id}

    except Exception as e:
        # Structured logging for image generation failure
        StructuredLogger.log_critical_failure(
            alert_type='llm_failure',
            message='Image generation failed',
            error=e,
            user=user,
            metadata={
                'conversation_id': conversation_id,
                'session_id': session.id if 'session' in dir() else None,
            },
            logger_instance=logger,
        )

        # Check for content filter errors from Azure OpenAI
        error_str = str(e)
        if 'content_filter' in error_str or 'ResponsibleAIPolicyViolation' in error_str:
            error_message = (
                "I couldn't process that request due to content policy restrictions. "
                'Please try rephrasing your message or using a different image.'
            )
        else:
            error_message = "Couldn't generate that image—try a different description?"

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
