"""
API endpoints for profile generation agent.

Provides both streaming (for interactive chat) and non-streaming
(for automatic generation during onboarding) endpoints.
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

from core.agents.security import validate_chat_input
from core.billing.permissions import CanMakeAIRequest  # Used by other endpoints

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(['POST'])
def profile_generate_stream(request):
    """
    Streaming endpoint for interactive profile generation.
    Uses Server-Sent Events (SSE) to stream AI responses.

    Note: This is a plain Django view (not DRF @api_view) to properly support
    SSE streaming without CSRF enforcement issues.

    Request body:
        {
            "session_id": "uuid" (optional),
            "message": "user message or instruction"
        }
    """
    logger.info('[PROFILE_AGENT] Streaming request received')

    # Manual authentication check (since we're not using DRF's @api_view)
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    logger.info(f'[PROFILE_AGENT] User: {request.user.username} (id={request.user.id})')

    try:
        body = json.loads(request.body)
        session_id = body.get('session_id') or str(uuid.uuid4())
        user_message = body.get('message', '').strip()

        # Validate input
        is_valid, error_msg, sanitized_message = validate_chat_input(user_message, request.user.id)
        if not is_valid:
            logger.warning(f'[PROFILE_AGENT] Invalid input: {error_msg}')
            return JsonResponse({'error': error_msg}, status=400)

        user_message = sanitized_message

        logger.info(f'[PROFILE_AGENT] Session: {session_id}')

        async def event_stream():
            """Generator for SSE events."""
            from services.agents.profile import stream_profile_generation

            try:
                async for chunk in stream_profile_generation(
                    user_message=user_message,
                    user_id=request.user.id,
                    username=request.user.username,
                    session_id=session_id,
                ):
                    yield f'data: {json.dumps(chunk)}\n\n'

            except Exception as e:
                logger.error(f'[PROFILE_AGENT] Stream error: {e}', exc_info=True)
                yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'

        # Return SSE response
        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f'[PROFILE_AGENT] Error: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
@api_view(['POST'])
@permission_classes([IsAuthenticated, CanMakeAIRequest])
@ratelimit(key='user', rate='5/m', method='POST')  # Limit auto-generation
def profile_generate_auto(request):
    """
    Non-streaming endpoint for automatic profile generation.
    Best for onboarding or one-click profile refresh.

    Request body:
        {
            "focus_areas": ["optional", "list", "of", "areas"] (optional),
            "save_immediately": true/false (default: false)
        }

    Returns:
        {
            "success": true,
            "sections": [...generated sections...],
            "message": "Generated X sections"
        }
    """
    logger.info('[PROFILE_AGENT] Auto-generate request received')

    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    user = request.user
    logger.info(f'[PROFILE_AGENT] Auto-generate for: {user.username}')

    try:
        body = json.loads(request.body) if request.body else {}
        focus_areas = body.get('focus_areas', [])
        save_immediately = body.get('save_immediately', False)

        # Run the async generation in a sync context
        from services.agents.profile import generate_profile

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                generate_profile(
                    user_id=user.id,
                    username=user.username,
                    focus_areas=focus_areas,
                )
            )
        finally:
            loop.close()

        if not result.get('success'):
            return JsonResponse(
                {
                    'success': False,
                    'error': result.get('error', 'Generation failed'),
                },
                status=500,
            )

        sections = result.get('sections', [])

        # Optionally save immediately
        if save_immediately and sections:
            user.profile_sections = sections
            user.save(update_fields=['profile_sections'])
            logger.info(f'[PROFILE_AGENT] Saved {len(sections)} sections for {user.username}')

        return JsonResponse(
            {
                'success': True,
                'sections': sections,
                'saved': save_immediately,
                'message': f'Generated {len(sections)} profile sections',
            }
        )

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f'[PROFILE_AGENT] Auto-generate error: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def profile_preview_sections(request):
    """
    Preview generated sections without saving.
    Uses simpler rule-based generation (no LLM) for instant preview.

    Request body: (empty or optional focus_areas)

    Returns generated sections based on user data.
    """
    logger.info('[PROFILE_AGENT] Preview request received')

    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    user = request.user

    try:
        # Import the tool function directly for rule-based generation
        from services.agents.profile.tools import gather_user_data, generate_profile_sections

        # Gather data (sync call)
        state = {'user_id': user.id, 'username': user.username}
        user_data = gather_user_data.func(
            include_projects=True,
            include_achievements=True,
            include_interests=True,
            state=state,
        )

        if not user_data.get('success'):
            return JsonResponse(
                {
                    'success': False,
                    'error': 'Failed to gather user data',
                },
                status=500,
            )

        # Generate sections (sync call)
        # Only generate showcase-relevant sections (sidebar already shows user info)
        result = generate_profile_sections.func(
            user_data=user_data,
            sections_to_generate=['featured_projects', 'skills'],
            focus_areas=[],
            state=state,
        )

        return JsonResponse(
            {
                'success': True,
                'sections': result.get('sections', []),
                'user_data_summary': {
                    'project_count': user_data.get('project_count', 0),
                    'achievement_count': len(user_data.get('achievements', [])),
                    'interest_count': len(user_data.get('interests', [])),
                },
            }
        )

    except Exception as e:
        logger.error(f'[PROFILE_AGENT] Preview error: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)
