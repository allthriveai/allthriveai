"""
Streaming chat endpoint for LLM-powered project creation agent.
"""

import asyncio
import json
import logging
import uuid

from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django_ratelimit.decorators import ratelimit
from langchain_core.messages import HumanMessage
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from services.project_agent.agent import project_agent

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(['POST'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='20/m', method='POST')  # 20 requests per minute per user
def project_chat_stream_v2(request):
    """
    Streaming endpoint for LLM-powered project creation chat.
    Uses Server-Sent Events (SSE) to stream AI responses.
    Requires authentication.

    Request body:
        {
            "session_id": "uuid" (optional),
            "message": "user message"
        }
    """
    logger.info('[PROJECT_CHAT_V2] Request received')

    # Check authentication
    if not request.user.is_authenticated:
        logger.warning('[PROJECT_CHAT_V2] User not authenticated')
        return JsonResponse({'error': 'Authentication required'}, status=401)

    logger.info(f'[PROJECT_CHAT_V2] User: {request.user.username} (id={request.user.id})')

    try:
        body = json.loads(request.body)
        session_id = body.get('session_id') or str(uuid.uuid4())
        user_message = body.get('message', '').strip()

        if not user_message:
            return JsonResponse({'error': 'Message is required'}, status=400)

        logger.info(f'[PROJECT_CHAT_V2] Session: {session_id}, Message: {user_message[:100]}')

        # Configure for streaming with user context
        config = {
            'configurable': {'thread_id': session_id, 'user_id': request.user.id, 'username': request.user.username}
        }

        async def event_stream():
            """Generator for SSE events."""
            try:
                # Create input state
                input_state = {
                    'messages': [HumanMessage(content=user_message)],
                    'user_id': request.user.id,
                    'username': request.user.username,
                }

                logger.info('[PROJECT_CHAT_V2] Invoking agent')

                # Stream agent execution
                full_response = ''
                project_id = None
                project_slug = None

                async for chunk in project_agent.astream(input_state, config):
                    # Extract messages from chunk
                    if 'agent' in chunk:
                        agent_messages = chunk['agent'].get('messages', [])
                        for msg in agent_messages:
                            if hasattr(msg, 'content') and msg.content:
                                # Stream content token by token
                                words = msg.content.split()
                                for word in words:
                                    yield f'data: {json.dumps({"type": "token", "content": word + " "})}\n\n'
                                full_response += msg.content

                    # Check for tool results
                    if 'tools' in chunk:
                        tool_messages = chunk['tools'].get('messages', [])
                        for msg in tool_messages:
                            if hasattr(msg, 'content'):
                                try:
                                    # Try to parse tool result
                                    result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                                    if isinstance(result, dict) and result.get('success'):
                                        project_id = result.get('project_id')
                                        project_slug = result.get('slug')
                                except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                                    # Ignore parsing errors
                                    pass

                logger.info('[PROJECT_CHAT_V2] Agent completed')

                # Send completion event
                completion_data = {
                    'type': 'complete',
                    'session_id': session_id,
                    'project_id': project_id,
                    'project_slug': project_slug,
                }
                yield f'data: {json.dumps(completion_data)}\n\n'

            except Exception as e:
                logger.error(f'[PROJECT_CHAT_V2] Error in agent stream: {e}', exc_info=True)
                yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'

        # Wrap async generator for sync Django view
        def sync_event_stream():
            """Synchronous wrapper for async event stream."""
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                async_gen = event_stream()
                while True:
                    try:
                        chunk = loop.run_until_complete(async_gen.__anext__())
                        yield chunk
                    except StopAsyncIteration:
                        break
            finally:
                loop.close()

        response = StreamingHttpResponse(sync_event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f'[PROJECT_CHAT_V2] Unexpected error: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)
