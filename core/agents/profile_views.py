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
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.agents.security import validate_chat_input
from core.billing.permissions import CanMakeAIRequest  # Used by other endpoints
from core.social.models import SocialConnection, SocialProvider

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_generate_sources(request):
    """
    Get available sources for profile generation.

    Returns list of sources (linkedin, manual) with availability status.
    LinkedIn is available only if user has connected their LinkedIn account.

    Returns:
        {
            "sources": [
                {
                    "key": "linkedin",
                    "label": "Generate from LinkedIn",
                    "description": "Import your professional profile from LinkedIn",
                    "icon": "linkedin",
                    "available": true,
                    "connectedAs": "John Doe"  // only if connected
                },
                {
                    "key": "manual",
                    "label": "Tell me about yourself",
                    "description": "Answer a few questions to build your profile",
                    "icon": "chat",
                    "available": true
                }
            ]
        }
    """
    user = request.user

    # Check LinkedIn connection
    linkedin_connected = False
    linkedin_username = None

    try:
        connection = SocialConnection.objects.get(
            user=user,
            provider=SocialProvider.LINKEDIN,
            is_active=True,
        )
        linkedin_connected = True
        linkedin_username = connection.provider_username
    except SocialConnection.DoesNotExist:
        pass

    sources = [
        {
            'key': 'linkedin',
            'label': 'Generate from LinkedIn',
            'description': 'Import your professional profile from LinkedIn',
            'icon': 'linkedin',
            'available': linkedin_connected,
            'connectedAs': linkedin_username if linkedin_connected else None,
        },
        {
            'key': 'manual',
            'label': 'Tell me about yourself',
            'description': 'Answer a few questions to build your profile',
            'icon': 'chat',
            'available': True,
        },
    ]

    return Response({'sources': sources})


@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def profile_generate_from_linkedin(request):
    """
    Generate profile sections from user's LinkedIn data.

    Requires the user to have an active LinkedIn connection.
    Fetches LinkedIn profile data and uses it to generate profile sections.

    Request body:
        {
            "save_immediately": true/false (default: false)
        }

    Returns:
        {
            "success": true,
            "sections": [...generated sections...],
            "linkedin_data": {...summary of linkedin data used...}
        }
    """
    user = request.user
    logger.info(f'[PROFILE_AGENT] LinkedIn profile generation for: {user.username}')

    try:
        # Check for LinkedIn connection
        try:
            connection = SocialConnection.objects.get(
                user=user,
                provider=SocialProvider.LINKEDIN,
                is_active=True,
            )
        except SocialConnection.DoesNotExist:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn account not connected. Please connect your LinkedIn account first.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Use request.data since DRF's @api_view already parsed the body
        save_immediately = request.data.get('save_immediately', False) if request.data else False
        # Fetch LinkedIn data
        from core.integrations.linkedin.helpers import get_user_linkedin_token
        from core.integrations.linkedin.service import LinkedInService

        linkedin_data = {
            'full_name': connection.provider_username,
            'email': connection.provider_email,
            'avatar_url': connection.avatar_url,
        }

        # Add stored extra data
        if connection.extra_data:
            linkedin_data.update(connection.extra_data)

        # Try to get fresh data from LinkedIn API using OpenID Connect userinfo endpoint
        # (The /v2/me endpoint requires deprecated r_liteprofile scope)
        token = get_user_linkedin_token(user)
        if token:
            try:
                service = LinkedInService(token)
                fresh_data = service.fetch_userinfo()
                if fresh_data:
                    linkedin_data.update(fresh_data)
                    logger.info(f'[PROFILE_AGENT] Got fresh LinkedIn data: {list(fresh_data.keys())}')
            except Exception as e:
                logger.warning(f'Could not fetch fresh LinkedIn data: {e}')

        # Generate profile sections using LinkedIn data
        from services.agents.profile.tools import generate_profile_sections

        state = {'user_id': user.id, 'username': user.username}

        # Create user data dict with LinkedIn info
        user_data = {
            'success': True,
            'basic_info': {
                'id': user.id,
                'username': user.username,
                'first_name': linkedin_data.get('given_name') or linkedin_data.get('first_name') or user.first_name,
                'last_name': linkedin_data.get('family_name') or linkedin_data.get('last_name') or user.last_name,
                'full_name': linkedin_data.get('full_name') or linkedin_data.get('name') or user.get_full_name(),
                'email': linkedin_data.get('email') or user.email,
                'avatar_url': linkedin_data.get('avatar_url') or linkedin_data.get('picture') or user.avatar_url or '',
                'bio': linkedin_data.get('summary') or linkedin_data.get('headline') or user.bio or '',
                'tagline': linkedin_data.get('headline') or user.tagline or '',
                'location': linkedin_data.get('location') or user.location or '',
                'pronouns': user.pronouns or '',
                'current_status': user.current_status or '',
                'role': getattr(user, 'role', '') or '',
            },
            'social_links': {
                'website_url': user.website_url or '',
                'linkedin_url': linkedin_data.get('profile_url') or user.linkedin_url or '',
                'twitter_url': user.twitter_url or '',
                'github_url': user.github_url or '',
                'youtube_url': user.youtube_url or '',
                'instagram_url': user.instagram_url or '',
                'calendar_url': getattr(user, 'calendar_url', '') or '',
            },
            'gamification': {
                'total_points': user.total_points or 0,
                'level': user.level or 1,
                'tier': user.tier or 'seedling',
            },
            'projects': [],
            'achievements': [],
            'interests': [],
            'linkedin_profile': linkedin_data,
        }

        # Generate sections optimized for LinkedIn data
        result = generate_profile_sections.func(
            user_data=user_data,
            template='builder',  # Use builder template for professional profiles
            sections_to_generate=['about', 'links', 'skills'],
            focus_areas=['professional', 'linkedin'],
            state=state,
        )

        sections = result.get('sections', [])

        # Optionally save immediately
        if save_immediately and sections:
            user.profile_sections = sections
            # Also update user fields from LinkedIn if not already set
            if not user.tagline and linkedin_data.get('headline'):
                user.tagline = linkedin_data['headline'][:150]
            if not user.bio and linkedin_data.get('summary'):
                user.bio = linkedin_data['summary']
            if not user.avatar_url and linkedin_data.get('avatar_url'):
                user.avatar_url = linkedin_data['avatar_url']
            if not user.linkedin_url and linkedin_data.get('profile_url'):
                user.linkedin_url = linkedin_data['profile_url']

            user.save()
            logger.info(f'[PROFILE_AGENT] Saved LinkedIn-generated profile for {user.username}')

        # Always update avatar from LinkedIn if available
        avatar_updated = False
        if linkedin_data.get('avatar_url') or linkedin_data.get('picture'):
            avatar_url = linkedin_data.get('avatar_url') or linkedin_data.get('picture')
            if avatar_url and (not user.avatar_url or user.avatar_url != avatar_url):
                user.avatar_url = avatar_url
                user.save(update_fields=['avatar_url'])
                avatar_updated = True
                logger.info(f'[PROFILE_AGENT] Updated avatar for {user.username} from LinkedIn')

        return Response(
            {
                'success': True,
                'sections': sections,
                'saved': save_immediately,
                'avatar_updated': avatar_updated,
                'linkedin_data': {
                    'name': linkedin_data.get('full_name') or linkedin_data.get('name'),
                    'first_name': linkedin_data.get('given_name') or linkedin_data.get('first_name'),
                    'last_name': linkedin_data.get('family_name') or linkedin_data.get('last_name'),
                    'avatar_url': linkedin_data.get('avatar_url') or linkedin_data.get('picture'),
                    'headline': linkedin_data.get('headline'),
                    'has_summary': bool(linkedin_data.get('summary')),
                },
                'message': f'Generated {len(sections)} profile sections from LinkedIn'
                + (' and updated avatar' if avatar_updated else ''),
            }
        )

    except Exception as e:
        logger.error(f'[PROFILE_AGENT] LinkedIn generation error: {e}', exc_info=True)
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
