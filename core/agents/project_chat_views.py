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
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from core.agents.circuit_breaker import CircuitBreakerOpenError, get_cached_faq_response
from core.agents.security import output_validator, validate_chat_input
from core.billing.permissions import CanMakeAIRequest
from services.agents.ember import stream_ember_response
from services.agents.hallucination_tracker import tracker

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(['POST'])
@api_view(['POST'])
@permission_classes([IsAuthenticated, CanMakeAIRequest])
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

        # Security: Validate and sanitize input
        is_valid, error_msg, sanitized_message = validate_chat_input(user_message, request.user.id)
        if not is_valid:
            logger.warning(f'[PROJECT_CHAT_V2] Invalid input from user {request.user.id}: {error_msg}')
            return JsonResponse({'error': error_msg}, status=400)

        # Use sanitized message for processing
        user_message = sanitized_message

        logger.info(f'[PROJECT_CHAT_V2] Session: {session_id}, Message: {user_message[:100]}')

        async def event_stream():
            """Generator for SSE events using unified Ember agent."""
            try:
                logger.info('[PROJECT_CHAT_V2] Invoking Ember agent')

                # Stream agent execution
                full_response = ''
                project_id = None
                project_slug = None
                tool_outputs = []  # Collect tool outputs for hallucination tracking

                try:
                    # Use unified Ember agent for project chat
                    async for event in stream_ember_response(
                        user_message=user_message,
                        user_id=request.user.id,
                        username=request.user.username,
                        session_id=session_id,
                        is_onboarding=False,
                    ):
                        event_type = event.get('type')

                        if event_type == 'token':
                            content = event.get('content', '')
                            if content:
                                # Security: Validate output before streaming
                                is_safe, violations = output_validator.validate_output(content)
                                if not is_safe:
                                    logger.error(f'[SECURITY] Output validation failed: {violations}')
                                    content = output_validator.sanitize_output(content)

                                yield f'data: {json.dumps({"type": "token", "content": content})}\n\n'
                                full_response += content

                        elif event_type == 'tool_start':
                            tool_name = event.get('tool', '')
                            yield f'data: {json.dumps({"type": "tool_start", "tool": tool_name})}\n\n'

                        elif event_type == 'tool_end':
                            tool_name = event.get('tool', '')
                            output = event.get('output', {})
                            tool_outputs.append(output)

                            # Check for project creation success
                            if isinstance(output, dict) and output.get('success'):
                                project_id = output.get('project_id')
                                project_slug = output.get('slug')

                            yield f'data: {json.dumps({"type": "tool_end", "tool": tool_name, "output": output})}\n\n'

                        elif event_type == 'complete':
                            pass  # Handled after the loop

                        elif event_type == 'error':
                            error_msg = event.get('message', 'Unknown error')
                            yield f'data: {json.dumps({"type": "error", "message": error_msg})}\n\n'

                except CircuitBreakerOpenError:
                    # Circuit breaker is open - use fallback
                    logger.warning('[PROJECT_CHAT_V2] Circuit breaker open, using fallback')
                    fallback_response = get_cached_faq_response()
                    yield f'data: {json.dumps({"type": "token", "content": fallback_response})}\n\n'
                    msg = json.dumps({'type': 'fallback', 'message': 'Using cached response due to high load'})
                    yield f'data: {msg}\n\n'
                    return

                logger.info('[PROJECT_CHAT_V2] Agent completed')

                # Fire-and-forget hallucination tracking (async background)
                if full_response:
                    try:
                        tracker.track_response_async(
                            response=full_response,
                            tool_outputs=tool_outputs,
                            session_id=session_id,
                            user_id=request.user.id,
                            feature='project_agent',
                            metadata={'project_id': project_id, 'project_slug': project_slug},
                        )
                    except Exception as track_error:
                        # Non-critical - just log and continue
                        logger.warning(f'[PROJECT_CHAT_V2] Tracking failed: {track_error}')

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
