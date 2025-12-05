"""Views for email notification endpoints."""

import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django_ratelimit.decorators import ratelimit
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.notifications.models import EmailPreferences
from core.notifications.utils import mask_email

logger = logging.getLogger(__name__)

# Allowed categories for unsubscribe (non-transactional)
ALLOWED_UNSUBSCRIBE_CATEGORIES = frozenset(
    [
        'battles',
        'achievements',
        'social',
        'quests',
        'marketing',
    ]
)


@csrf_exempt
@ratelimit(key='ip', rate='30/m', method=['GET', 'POST'], block=True)
@require_http_methods(['GET', 'POST'])
def unsubscribe(request):
    """Handle email unsubscribe requests.

    GET: Return current preferences (frontend renders UI)
    POST: Process one-click unsubscribe (RFC 8058)

    Query params:
        token: Secure unsubscribe token
        category: Optional - unsubscribe from specific category only

    Returns:
        JSON response with preferences or success status
    """
    token = request.GET.get('token') or request.POST.get('token')
    category = request.GET.get('category') or request.POST.get('category')

    if not token:
        return JsonResponse({'error': 'Missing token'}, status=400)

    try:
        prefs = EmailPreferences.objects.select_related('user').get(unsubscribe_token=token)
    except EmailPreferences.DoesNotExist:
        # Don't log token value to prevent enumeration via logs
        logger.warning('Invalid unsubscribe token attempted')
        return JsonResponse({'error': 'Invalid token'}, status=404)

    if request.method == 'POST':
        # One-click unsubscribe
        if category:
            # Validate category against whitelist (prevents arbitrary attribute access)
            if category not in ALLOWED_UNSUBSCRIBE_CATEGORIES:
                logger.warning(f'Invalid unsubscribe category attempted: {category!r} (user_id={prefs.user.id})')
                return JsonResponse({'error': 'Invalid category'}, status=400)

            # Unsubscribe from specific category
            field_name = f'email_{category}'
            setattr(prefs, field_name, False)
            prefs.save(update_fields=[field_name, 'updated_at'])
            logger.info(f'User {prefs.user.id} ({mask_email(prefs.user.email)}) unsubscribed from {category} emails')
        else:
            # Unsubscribe from all non-transactional emails
            prefs.email_battles = False
            prefs.email_achievements = False
            prefs.email_social = False
            prefs.email_quests = False
            prefs.email_marketing = False
            # Note: billing and welcome remain True (transactional)
            prefs.save(
                update_fields=[
                    'email_battles',
                    'email_achievements',
                    'email_social',
                    'email_quests',
                    'email_marketing',
                    'updated_at',
                ]
            )
            logger.info(
                f'User {prefs.user.id} ({mask_email(prefs.user.email)}) unsubscribed from all promotional emails'
            )

        return JsonResponse({'success': True})

    # GET: Return current preferences (frontend renders UI)
    return JsonResponse(
        {
            'email_billing': prefs.email_billing,
            'email_welcome': prefs.email_welcome,
            'email_battles': prefs.email_battles,
            'email_achievements': prefs.email_achievements,
            'email_social': prefs.email_social,
            'email_quests': prefs.email_quests,
            'email_marketing': prefs.email_marketing,
        }
    )


@csrf_exempt
@ratelimit(key='ip', rate='30/m', method='POST', block=True)
@require_http_methods(['POST'])
def update_preferences(request):
    """Update email preferences (requires token for unauthenticated access).

    POST body (JSON):
        token: Secure unsubscribe token
        email_battles: bool
        email_achievements: bool
        email_social: bool
        email_quests: bool
        email_marketing: bool

    Returns:
        JSON response with updated preferences
    """

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    token = data.get('token')
    if not token:
        return JsonResponse({'error': 'Missing token'}, status=400)

    try:
        prefs = EmailPreferences.objects.get(unsubscribe_token=token)
    except EmailPreferences.DoesNotExist:
        return JsonResponse({'error': 'Invalid token'}, status=404)

    # Update only allowed fields
    allowed_fields = [
        'email_battles',
        'email_achievements',
        'email_social',
        'email_quests',
        'email_marketing',
    ]

    updated = []
    for field in allowed_fields:
        if field in data:
            setattr(prefs, field, bool(data[field]))
            updated.append(field)

    if updated:
        prefs.save(update_fields=updated + ['updated_at'])
        logger.info(f'User {prefs.user.id} ({mask_email(prefs.user.email)}) updated email preferences: {updated}')

    return JsonResponse(
        {
            'success': True,
            'updated': updated,
            'email_billing': prefs.email_billing,
            'email_welcome': prefs.email_welcome,
            'email_battles': prefs.email_battles,
            'email_achievements': prefs.email_achievements,
            'email_social': prefs.email_social,
            'email_quests': prefs.email_quests,
            'email_marketing': prefs.email_marketing,
        }
    )


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def my_email_preferences(request):
    """Get or update authenticated user's email preferences.

    GET: Returns current email preferences
    PATCH: Updates email preferences

    PATCH body (JSON):
        email_battles: bool (optional)
        email_achievements: bool (optional)
        email_social: bool (optional)
        email_quests: bool (optional)
        email_marketing: bool (optional)

    Returns:
        JSON response with preferences
    """
    # Get or create preferences for the user
    prefs, created = EmailPreferences.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response(
            {
                'email_billing': prefs.email_billing,
                'email_welcome': prefs.email_welcome,
                'email_battles': prefs.email_battles,
                'email_achievements': prefs.email_achievements,
                'email_social': prefs.email_social,
                'email_quests': prefs.email_quests,
                'email_marketing': prefs.email_marketing,
            }
        )

    # PATCH: Update preferences
    allowed_fields = [
        'email_battles',
        'email_achievements',
        'email_social',
        'email_quests',
        'email_marketing',
    ]

    updated = []
    for field in allowed_fields:
        if field in request.data:
            setattr(prefs, field, bool(request.data[field]))
            updated.append(field)

    if updated:
        prefs.save(update_fields=updated + ['updated_at'])
        logger.info(f'User {request.user.id} ({mask_email(request.user.email)}) updated email preferences: {updated}')

    return Response(
        {
            'success': True,
            'updated': updated,
            'email_billing': prefs.email_billing,
            'email_welcome': prefs.email_welcome,
            'email_battles': prefs.email_battles,
            'email_achievements': prefs.email_achievements,
            'email_social': prefs.email_social,
            'email_quests': prefs.email_quests,
            'email_marketing': prefs.email_marketing,
        }
    )
