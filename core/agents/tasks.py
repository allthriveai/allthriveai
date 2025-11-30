"""
Celery tasks for async LangGraph chat processing

Handles:
- Async message processing with LangGraph agents
- Streaming responses via Redis Pub/Sub to WebSockets
- Conversation state persistence with two-tier caching
"""

import logging

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model

from services.ai_provider import AIProvider
from services.auth_agent.checkpointer import cache_checkpoint

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
    # circuit_breaker = CircuitBreaker(name='langgraph_agent')

    try:
        # Validate user exists
        if not User.objects.filter(id=user_id).exists():
            raise User.DoesNotExist

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

        # Get conversation state (two-tier caching: Redis → PostgreSQL)
        # conversation_state = get_cached_checkpoint(conversation_id)

        # Get dynamic provider and model from settings
        from django.conf import settings

        provider_name = getattr(settings, 'DEFAULT_AI_PROVIDER', 'azure')
        if provider_name == 'azure':
            model = getattr(settings, 'AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4')
        elif provider_name == 'openai':
            model = 'gpt-4'
        else:
            model = None  # Let AIProvider pick a sensible default

        # Get user object for context (for future personalization/cost tracking)
        # user = User.objects.get(id=user_id)

        # Stream AI response using the centralized AIProvider (bypassing LangGraph
        # for now to avoid compatibility issues with the current OpenAI/Azure
        # client libraries).
        with timed_metric(llm_response_time, provider=provider_name, model=model or 'default'):
            ai = AIProvider(provider=provider_name, user_id=user_id)

            system_message = (
                'You are a helpful AI agent inside AllThrive AI. '
                'Assist the user with describing and refining their AI projects '
                'in clear, friendly language. Keep responses concise and '
                'practical, and avoid mentioning internal implementation details.'
            )

            try:
                for chunk in ai.stream_complete(
                    prompt=sanitized_message,
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

        # Send completion event
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'completed',
                'conversation_id': conversation_id,
            },
        )

        # Cache updated conversation state
        # TODO: Get actual state from LangGraph after integration
        cache_checkpoint(conversation_id, {'last_message': sanitized_message}, ttl=900)

        # Record metrics
        MetricsCollector.record_message('support', user_id)

        logger.info(f'Message processed successfully: conversation={conversation_id}, user={user_id}')

        return {'status': 'success', 'conversation_id': conversation_id}

    except User.DoesNotExist:
        logger.error(f'User not found: user_id={user_id}')
        return {'status': 'error', 'reason': 'user_not_found'}

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
