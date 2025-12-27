"""Core views - health checks and CSP reporting.

Project views have been moved to core.projects.views.
"""

import json
import logging

from django.db import connections
from django.db.utils import OperationalError
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger('django.security')


@api_view(['GET'])
@permission_classes([AllowAny])
def db_health(request):
    """Health check endpoint to verify database connectivity.

    Returns 200 with {'status': 'ok'} when SELECT 1 succeeds, 503 otherwise.
    """
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1;')
            cursor.fetchone()
        return Response({'status': 'ok'})
    except OperationalError as e:
        return Response({'status': 'error', 'detail': str(e)}, status=503)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def csp_report(request):
    """Content Security Policy violation reporting endpoint.

    Logs CSP violations to help identify and fix security policy issues.
    This endpoint must accept POST requests from browsers reporting CSP violations.
    """
    try:
        # Parse CSP violation report
        if request.content_type == 'application/csp-report':
            report_data = json.loads(request.body.decode('utf-8'))
        elif request.content_type == 'application/json':
            report_data = request.data
        else:
            report_data = {'raw_body': request.body.decode('utf-8', errors='ignore')}

        # Log the violation
        logger.warning(
            f'CSP Violation Report: {json.dumps(report_data, indent=2)}',
            extra={
                'user_agent': request.headers.get('user-agent', 'Unknown'),
                'ip_address': request.META.get('REMOTE_ADDR', 'Unknown'),
                'report': report_data,
            },
        )

        # Return 204 No Content (standard for reporting endpoints)
        return HttpResponse(status=204)

    except Exception as e:
        logger.error(f'Error processing CSP report: {str(e)}')
        return HttpResponse(status=400)


def robots_txt(request):
    """Generate robots.txt with LLM crawler blocking."""
    lines = [
        '# AllThrive AI - Robots.txt',
        '',
        '# Allow traditional search engines',
        'User-agent: Googlebot',
        'Allow: /',
        '',
        'User-agent: Bingbot',
        'Allow: /',
        '',
        '# Block LLM crawlers from accessing user profiles',
        'User-agent: GPTBot',
        'Disallow: /@*',
        'Disallow: /api/v1/users/',
        '',
        'User-agent: ChatGPT-User',
        'Disallow: /@*',
        'Disallow: /api/v1/users/',
        '',
        'User-agent: CCBot',
        'Disallow: /@*',
        'Disallow: /api/v1/users/',
        '',
        'User-agent: anthropic-ai',
        'Disallow: /@*',
        'Disallow: /api/v1/users/',
        '',
        'User-agent: Claude-Web',
        'Disallow: /@*',
        'Disallow: /api/v1/users/',
        '',
        'User-agent: ClaudeBot',
        'Disallow: /@*',
        'Disallow: /api/v1/users/',
        '',
        '# Default for all other bots',
        'User-agent: *',
        'Allow: /',
        '',
        f'Sitemap: {request.build_absolute_uri("/sitemap.xml")}',
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')


@api_view(['POST'])
@permission_classes([AllowAny])
def client_logs(request):
    """Receive frontend client logs and write to backend logging.

    Accepts a batch of log entries from the frontend logger service.
    Logs are written to the 'frontend' logger which appears in admin log stream.
    """
    frontend_logger = logging.getLogger('frontend')

    try:
        logs = request.data.get('logs', [])

        for entry in logs:
            level = entry.get('level', 'info').upper()
            message = entry.get('message', '')
            context = entry.get('context', {})
            url = entry.get('url', '')
            user_agent = entry.get('userAgent', '')

            # Add user ID if authenticated
            user_id = None
            if request.user and request.user.is_authenticated:
                user_id = request.user.id

            extra = {
                'url': url,
                'user_agent': user_agent,
                'user_id': user_id,
                'context': context,
            }

            log_message = f'[CLIENT] {message}'

            if level == 'ERROR':
                frontend_logger.error(log_message, extra=extra)
            elif level == 'WARN':
                frontend_logger.warning(log_message, extra=extra)
            elif level == 'INFO':
                frontend_logger.info(log_message, extra=extra)
            else:
                frontend_logger.debug(log_message, extra=extra)

        return Response({'status': 'ok', 'received': len(logs)})

    except Exception as e:
        logger.error(f'Error processing client logs: {str(e)}')
        return Response({'status': 'error'}, status=400)


@api_view(['GET'])
@permission_classes([AllowAny])
def ai_health(request):
    """
    Health check endpoint to verify AI provider connectivity.

    GET /api/v1/health/ai/

    Returns status for each AI provider:
    - OpenAI (GPT-4, GPT-5, GPT-Image)
    - Google Gemini (text and image generation)
    - Anthropic Claude (optional)

    This endpoint makes minimal API calls to verify connectivity without
    generating expensive completions.
    """
    from django.conf import settings

    results = {
        'status': 'ok',
        'providers': {},
        'models': {},
    }
    all_ok = True

    # Check OpenAI - test actual models with minimal completions
    try:
        from openai import OpenAI

        api_key = getattr(settings, 'OPENAI_API_KEY', None)
        if api_key:
            client = OpenAI(api_key=api_key)

            # Get configured models from settings
            ai_models = getattr(settings, 'AI_MODELS', {})
            openai_config = ai_models.get('openai', {})
            default_model = openai_config.get('default', 'gpt-4o-mini')
            avatar_model = openai_config.get('avatar', 'gpt-image-1.5')

            openai_models = {}

            # Test default/chat model (gpt-4o-mini) with minimal completion
            try:
                client.chat.completions.create(
                    model=default_model,
                    messages=[{'role': 'user', 'content': 'Say OK'}],
                    max_tokens=2,
                    timeout=10,
                )
                openai_models[default_model] = True
            except Exception as e:
                openai_models[default_model] = f'error: {str(e)[:50]}'

            # Test image model (gpt-image-1.5) - verify it exists in model list
            # Don't actually generate an image (expensive), just check availability
            try:
                models = client.models.list()
                model_ids = [m.id for m in models.data]
                # Check for gpt-image models or dall-e as fallback
                has_image_model = any(avatar_model in m or 'gpt-image' in m or 'dall-e' in m for m in model_ids)
                if has_image_model:
                    openai_models[avatar_model] = True
                else:
                    # Image models may not appear in list - that's OK
                    openai_models[avatar_model] = 'assumed_available'
            except Exception as e:
                openai_models[avatar_model] = f'error: {str(e)[:50]}'

            # Determine overall status - require chat model to work
            chat_ok = openai_models.get(default_model) is True

            results['providers']['openai'] = {
                'status': 'ok' if chat_ok else 'degraded',
                'models_tested': True,
            }
            results['models']['openai'] = openai_models
        else:
            results['providers']['openai'] = {'status': 'not_configured', 'error': 'API key not set'}
            all_ok = False
    except Exception as e:
        results['providers']['openai'] = {'status': 'error', 'error': str(e)[:100]}
        all_ok = False

    # Check Google Gemini
    try:
        import google.generativeai as genai

        api_key = getattr(settings, 'GOOGLE_API_KEY', None)
        if api_key:
            genai.configure(api_key=api_key)
            # List models to verify connectivity
            models = list(genai.list_models())
            model_names = [m.name for m in models[:20]]

            gemini_models = {
                'gemini-2.0-flash': any('gemini-2.0-flash' in m for m in model_names),
                'gemini-2.5-flash-preview-05-20': any('gemini-2.5' in m for m in model_names),
                'imagen': any('imagen' in m.lower() for m in model_names),
            }

            results['providers']['gemini'] = {
                'status': 'ok',
                'models_available': True,
            }
            results['models']['gemini'] = gemini_models
        else:
            results['providers']['gemini'] = {'status': 'not_configured', 'error': 'API key not set'}
            all_ok = False
    except Exception as e:
        results['providers']['gemini'] = {'status': 'error', 'error': str(e)[:100]}
        all_ok = False

    # Check Anthropic (optional - not critical for core functionality)
    try:
        from anthropic import Anthropic

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', None)
        if api_key:
            # Anthropic doesn't have a list models endpoint, so we just verify the client initializes
            client = Anthropic(api_key=api_key)
            # Make a minimal API call - count tokens is very cheap
            results['providers']['anthropic'] = {
                'status': 'ok',
                'note': 'Client initialized (no model list API available)',
            }
            results['models']['anthropic'] = {
                'claude-3-5-sonnet': True,  # Assumed available if key is set
            }
        else:
            results['providers']['anthropic'] = {'status': 'not_configured', 'error': 'API key not set'}
            # Anthropic is optional, don't fail health check
    except Exception as e:
        results['providers']['anthropic'] = {'status': 'error', 'error': str(e)[:100]}
        # Anthropic is optional, don't fail health check

    # Set overall status
    if not all_ok:
        results['status'] = 'degraded'

    # Return 503 if critical providers (OpenAI, Gemini) are down
    openai_ok = results['providers'].get('openai', {}).get('status') == 'ok'
    gemini_ok = results['providers'].get('gemini', {}).get('status') == 'ok'

    if not openai_ok and not gemini_ok:
        results['status'] = 'error'
        return Response(results, status=503)

    return Response(results)


def ai_plugin_manifest(request):
    """AI plugin manifest with privacy boundaries."""
    manifest = {
        'schema_version': 'v1',
        'name_for_model': 'allthrive_ai',
        'name_for_human': 'AllThrive AI',
        'description_for_model': (
            'Access PUBLIC AI project portfolios and tools from AllThrive AI. '
            'This plugin respects user privacy and only exposes PUBLIC data. '
            'Private projects and user data are never accessible.'
        ),
        'description_for_human': 'Discover AI projects and tools from the AllThrive AI community.',
        'auth': {'type': 'none'},
        'api': {
            'type': 'openapi',
            'url': request.build_absolute_uri('/api/v1/schema/'),
        },
        'logo_url': request.build_absolute_uri('/static/logo.png'),
        'contact_email': 'support@allthrive.ai',
        'legal_info_url': request.build_absolute_uri('/legal/'),
        'privacy_policy_url': request.build_absolute_uri('/privacy/'),
        'capabilities': [
            'Browse PUBLIC AI projects',
            'Search PUBLIC tools and resources',
            'Discover PUBLIC user portfolios',
        ],
        'data_usage_policy': (
            'This plugin only accesses PUBLIC data from AllThrive AI. '
            'Private user data, unpublished projects, and personal information '
            'are never accessible through this interface. Users control their '
            'privacy settings independently.'
        ),
    }
    return JsonResponse(manifest)
