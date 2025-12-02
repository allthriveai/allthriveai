"""
Celery tasks for async LangGraph chat processing

Handles:
- Async message processing with LangGraph agents
- Streaming responses via Redis Pub/Sub to WebSockets
- Conversation state persistence with two-tier caching
- Image generation with Gemini 2.0 Flash
"""

import logging
import uuid

import requests
from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model

from services.agents.auth.checkpointer import cache_checkpoint
from services.ai import AIProvider
from services.integrations.storage import StorageService

from .intent_detection import get_intent_service
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
        is_project_conversation = conversation_id.startswith('project-')

        # Always run intent detection to catch image generation requests
        intent_service = get_intent_service()
        intent = intent_service.detect_intent(
            user_message=sanitized_message,
            conversation_history=None,  # TODO: wire up actual history
            integration_type=None,  # TODO: extract from conversation context
        )
        logger.info(f'Detected intent: {intent} for conversation {conversation_id}')

        # For project conversations, default to project-creation unless
        # we detect a specific intent like image-generation
        if is_project_conversation and intent not in ('image-generation',):
            intent = 'project-creation'
            logger.info('Project conversation - overriding to project-creation')

        # Route to appropriate processor based on intent
        if intent == 'project-creation':
            # Use LangGraph agent with tools for project creation
            result = _process_with_langgraph_agent(
                conversation_id=conversation_id,
                message=sanitized_message,
                user=user,
                channel_name=channel_name,
                channel_layer=channel_layer,
            )
        elif intent == 'image-generation':
            # Use Gemini 2.0 Flash for image generation
            result = _process_image_generation(
                conversation_id=conversation_id,
                message=sanitized_message,
                user=user,
                channel_name=channel_name,
                channel_layer=channel_layer,
            )
        else:
            # Use simple AIProvider streaming (fallback)
            result = _process_with_ai_provider(
                conversation_id=conversation_id,
                message=sanitized_message,
                user_id=user_id,
                intent=intent,
                channel_name=channel_name,
                channel_layer=channel_layer,
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

        # Record metrics with detected intent
        MetricsCollector.record_message(intent, user_id)

        logger.info(f'Message processed successfully: conversation={conversation_id}, user={user_id}')

        return {'status': 'success', 'conversation_id': conversation_id}

    except Exception as e:
        logger.error(f'Failed to process message: {e}', exc_info=True)

        # Record circuit breaker failure
        MetricsCollector.record_circuit_breaker_failure('langgraph_agent')

        # Notify client of failure
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

        # Retry the task
        raise self.retry(exc=e) from e


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
                    await channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': event.get('content', ''),
                            'conversation_id': conversation_id,
                        },
                    )

                elif event_type == 'tool_start':
                    # Notify frontend that a tool is being called
                    await channel_layer.group_send(
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
                    await channel_layer.group_send(
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

                elif event_type == 'error':
                    error_msg = event.get('message', 'Unknown error')
                    logger.error(f'Agent error: {error_msg}')
                    await channel_layer.group_send(
                        channel_name,
                        {
                            'type': 'chat.message',
                            'event': 'chunk',
                            'chunk': f'I encountered an issue: {error_msg}. Please try again.',
                            'conversation_id': conversation_id,
                        },
                    )

        except Exception as e:
            logger.error(f'Agent streaming error: {e}', exc_info=True)
            await channel_layer.group_send(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'chunk',
                    'chunk': "I'm here to help! However, I encountered an issue processing your request. "
                    'Please try again.',
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
        # Send error message to user (sync context, use async_to_sync)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': "I'm here to help! However, I encountered an issue processing your request. Please try again.",
                'conversation_id': conversation_id,
            },
        )

    return {'project_created': project_created}


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
    from django.conf import settings

    provider_name = getattr(settings, 'DEFAULT_AI_PROVIDER', 'azure')
    if provider_name == 'azure':
        model = getattr(settings, 'AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4')
    elif provider_name == 'openai':
        model = 'gpt-4'
    else:
        model = None  # Let AIProvider pick a sensible default

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

        # Generate image using Gemini
        ai = AIProvider(provider='gemini', user_id=user.id)
        image_bytes, mime_type, text_response = ai.generate_image(
            prompt=message,
            conversation_history=conversation_history,
            reference_images=reference_bytes if reference_bytes else None,
        )

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
            return {'image_generated': False, 'session_id': session.id}

        logger.info(f'Image generated and uploaded: {image_url}')

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

        # Send error message
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'chunk',
                'chunk': 'I encountered an issue generating your image. Please try again with a different description!',
                'conversation_id': conversation_id,
            },
        )

        return {'image_generated': False}
