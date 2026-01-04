"""Views for email and SMS notification endpoints."""

import json
import logging
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django_ratelimit.decorators import ratelimit
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.notifications.models import EmailPreferences, SMSPreferences
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
    """Get or update authenticated user's notification preferences.

    GET: Returns current email and SMS preferences
    PATCH: Updates email and SMS preferences

    PATCH body (JSON):
        email_battles: bool (optional)
        email_achievements: bool (optional)
        email_social: bool (optional)
        email_quests: bool (optional)
        email_marketing: bool (optional)
        allow_sms_invitations: bool (optional)
        phone_number: str (optional) - Phone number in E.164 format

    Returns:
        JSON response with preferences
    """
    from core.sms.utils import ValidationError as PhoneValidationError
    from core.sms.utils import normalize_phone_number

    # Get or create preferences for the user
    prefs, created = EmailPreferences.objects.get_or_create(user=request.user)
    user = request.user

    if request.method == 'GET':
        # Get SMS preferences for response
        sms_prefs = getattr(user, 'sms_preferences', None)

        return Response(
            {
                # Email preferences
                'emailBilling': prefs.email_billing,
                'emailWelcome': prefs.email_welcome,
                'emailBattles': prefs.email_battles,
                'emailAchievements': prefs.email_achievements,
                'emailSocial': prefs.email_social,
                'emailQuests': prefs.email_quests,
                'emailMarketing': prefs.email_marketing,
                # SMS preferences (master switch)
                'phoneNumber': user.phone_number or '',
                'phoneVerified': user.phone_verified,
                'allowSmsInvitations': user.allow_sms_invitations,
                # SMS category preferences
                'smsBattleInvitations': sms_prefs.sms_battle_invitations if sms_prefs else True,
                'smsBattleResults': sms_prefs.sms_battle_results if sms_prefs else True,
                'smsBattleReminders': sms_prefs.sms_battle_reminders if sms_prefs else True,
                'smsStreakAlerts': sms_prefs.sms_streak_alerts if sms_prefs else True,
                # Battle availability
                'isAvailableForBattles': user.is_available_for_battles,
            }
        )

    # PATCH: Update preferences
    # Email preference fields
    email_fields = [
        'email_battles',
        'email_achievements',
        'email_social',
        'email_quests',
        'email_marketing',
    ]

    updated = []
    for field in email_fields:
        if field in request.data:
            setattr(prefs, field, bool(request.data[field]))
            updated.append(field)

    if updated:
        prefs.save(update_fields=updated + ['updated_at'])
        logger.info(f'User {user.id} ({mask_email(user.email)}) updated email preferences: {updated}')

    # SMS preference fields (on User model)
    user_updated = []

    # Handle SMS opt-in toggle
    if 'allow_sms_invitations' in request.data:
        user.allow_sms_invitations = bool(request.data['allow_sms_invitations'])
        user_updated.append('allow_sms_invitations')

    # Handle battle availability toggle
    if 'is_available_for_battles' in request.data:
        user.is_available_for_battles = bool(request.data['is_available_for_battles'])
        user_updated.append('is_available_for_battles')

    # Handle phone number update
    if 'phone_number' in request.data:
        phone_input = request.data['phone_number']
        if phone_input:
            try:
                normalized_phone = normalize_phone_number(phone_input)
                # Only update if phone changed
                if normalized_phone != user.phone_number:
                    user.phone_number = normalized_phone
                    user.phone_verified = False  # Reset verification when phone changes
                    user.phone_verified_at = None
                    user_updated.extend(['phone_number', 'phone_verified', 'phone_verified_at'])
            except PhoneValidationError as e:
                return Response({'error': str(e)}, status=400)
        else:
            # Clear phone number
            if user.phone_number:
                user.phone_number = ''
                user.phone_verified = False
                user.phone_verified_at = None
                user_updated.extend(['phone_number', 'phone_verified', 'phone_verified_at'])

    if user_updated:
        user.save(update_fields=user_updated)
        logger.info(f'User {user.id} ({mask_email(user.email)}) updated SMS preferences: {user_updated}')

    # Get SMS preferences for response
    sms_prefs = getattr(user, 'sms_preferences', None)

    return Response(
        {
            'success': True,
            'updated': updated + user_updated,
            # Email preferences
            'emailBilling': prefs.email_billing,
            'emailWelcome': prefs.email_welcome,
            'emailBattles': prefs.email_battles,
            'emailAchievements': prefs.email_achievements,
            'emailSocial': prefs.email_social,
            'emailQuests': prefs.email_quests,
            'emailMarketing': prefs.email_marketing,
            # SMS preferences (master switch)
            'phoneNumber': user.phone_number or '',
            'phoneVerified': user.phone_verified,
            'allowSmsInvitations': user.allow_sms_invitations,
            # SMS category preferences
            'smsBattleInvitations': sms_prefs.sms_battle_invitations if sms_prefs else True,
            'smsBattleResults': sms_prefs.sms_battle_results if sms_prefs else True,
            'smsBattleReminders': sms_prefs.sms_battle_reminders if sms_prefs else True,
            'smsStreakAlerts': sms_prefs.sms_streak_alerts if sms_prefs else True,
            # Battle availability
            'isAvailableForBattles': user.is_available_for_battles,
        }
    )


def get_client_ip(request) -> str | None:
    """Get client IP address from request."""
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='30/m', method=['GET', 'POST'], block=True)
def sms_opt_in(request):
    """Handle SMS opt-in flow.

    GET: Check if user should see SMS opt-in prompt
        Returns:
            - showPrompt: bool - Whether to show the opt-in modal
            - alreadyOptedIn: bool - User has already opted in
            - phoneNumber: str - User's phone number (if any)
            - phoneVerified: bool - Whether phone is verified

    POST: Record SMS opt-in or dismiss
        Body:
            - action: 'opt_in' | 'dismiss' | 'remind_later'
            - phoneNumber: str (optional, for opt_in)

        Returns:
            - success: bool
            - allowSmsInvitations: bool
    """
    user = request.user

    if request.method == 'GET':
        # Check if user already opted in (has phone + verified + master switch on)
        already_opted_in = user.phone_number and user.phone_verified and user.allow_sms_invitations

        # Don't show prompt if:
        # 1. User already opted in
        # 2. User dismissed the prompt
        # 3. User is too new (less than 3 minutes on platform)
        # 4. Prompt was shown recently (within 24 hours)
        should_show = True

        if already_opted_in:
            should_show = False
        elif user.sms_prompt_dismissed_at:
            should_show = False
        elif user.date_joined > timezone.now() - timedelta(minutes=3):
            should_show = False
        elif user.sms_prompt_shown_at and user.sms_prompt_shown_at > timezone.now() - timedelta(hours=24):
            should_show = False

        # Track that we showed the prompt (so we don't spam if user closes browser)
        if should_show and not user.sms_prompt_shown_at:
            user.sms_prompt_shown_at = timezone.now()
            user.save(update_fields=['sms_prompt_shown_at'])

        return Response(
            {
                'showPrompt': should_show,
                'alreadyOptedIn': already_opted_in,
                'phoneNumber': user.phone_number or '',
                'phoneVerified': user.phone_verified,
            }
        )

    # POST: Handle opt-in action
    action = request.data.get('action')

    if action == 'opt_in':
        # Enable SMS notifications
        user.allow_sms_invitations = True
        user.save(update_fields=['allow_sms_invitations'])

        # Create or update SMS preferences with consent tracking
        sms_prefs, created = SMSPreferences.objects.get_or_create(user=user)
        sms_prefs.record_consent(
            method=SMSPreferences.ConsentMethod.OPT_IN_MODAL,
            ip_address=get_client_ip(request),
        )

        logger.info(f'User {user.id} ({mask_email(user.email)}) opted in to SMS notifications')

        return Response(
            {
                'success': True,
                'allowSmsInvitations': True,
            }
        )

    elif action == 'dismiss':
        # Record dismissal
        user.sms_prompt_dismissed_at = timezone.now()
        user.save(update_fields=['sms_prompt_dismissed_at'])

        logger.info(f'User {user.id} ({mask_email(user.email)}) dismissed SMS opt-in prompt')

        return Response(
            {
                'success': True,
                'allowSmsInvitations': user.allow_sms_invitations,
            }
        )

    elif action == 'remind_later':
        # Just record that we showed the prompt (will show again after 24 hours)
        user.sms_prompt_shown_at = timezone.now()
        user.save(update_fields=['sms_prompt_shown_at'])

        return Response(
            {
                'success': True,
                'allowSmsInvitations': user.allow_sms_invitations,
            }
        )

    return Response({'error': 'Invalid action'}, status=400)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='30/m', method=['GET', 'PATCH'], block=True)
def my_sms_preferences(request):
    """Get or update authenticated user's SMS notification preferences.

    GET: Returns current SMS preferences
    PATCH: Updates SMS preferences

    PATCH body (JSON):
        allowSmsInvitations: bool (optional) - Master switch
        smsBattleInvitations: bool (optional)
        smsBattleResults: bool (optional)
        smsBattleReminders: bool (optional)
        smsStreakAlerts: bool (optional)

    Returns:
        JSON response with SMS preferences
    """
    user = request.user

    # Get or create SMS preferences
    sms_prefs, created = SMSPreferences.objects.get_or_create(user=user)

    if request.method == 'GET':
        return Response(
            {
                # Master switch (on User model)
                'allowSmsInvitations': user.allow_sms_invitations,
                'phoneNumber': user.phone_number or '',
                'phoneVerified': user.phone_verified,
                # Category preferences
                'smsBattleInvitations': sms_prefs.sms_battle_invitations,
                'smsBattleResults': sms_prefs.sms_battle_results,
                'smsBattleReminders': sms_prefs.sms_battle_reminders,
                'smsStreakAlerts': sms_prefs.sms_streak_alerts,
                # Consent info
                'hasConsent': sms_prefs.has_valid_consent,
                'consentGivenAt': sms_prefs.consent_given_at.isoformat() if sms_prefs.consent_given_at else None,
            }
        )

    # PATCH: Update preferences
    user_updated = []
    sms_updated = []

    # Handle master switch
    if 'allowSmsInvitations' in request.data:
        new_value = bool(request.data['allowSmsInvitations'])

        # If turning on, record consent
        if new_value and not user.allow_sms_invitations:
            sms_prefs.record_consent(
                method=SMSPreferences.ConsentMethod.SETTINGS_PAGE,
                ip_address=get_client_ip(request),
            )

        # If turning off, revoke consent
        if not new_value and user.allow_sms_invitations:
            sms_prefs.revoke_consent()

        user.allow_sms_invitations = new_value
        user_updated.append('allow_sms_invitations')

    # Handle category preferences
    category_fields = [
        ('smsBattleInvitations', 'sms_battle_invitations'),
        ('smsBattleResults', 'sms_battle_results'),
        ('smsBattleReminders', 'sms_battle_reminders'),
        ('smsStreakAlerts', 'sms_streak_alerts'),
    ]

    for camel_field, snake_field in category_fields:
        if camel_field in request.data:
            setattr(sms_prefs, snake_field, bool(request.data[camel_field]))
            sms_updated.append(snake_field)

    if user_updated:
        user.save(update_fields=user_updated)

    if sms_updated:
        sms_prefs.save(update_fields=sms_updated + ['updated_at'])

    if user_updated or sms_updated:
        logger.info(
            f'User {user.id} ({mask_email(user.email)}) updated SMS preferences: '
            f'user={user_updated}, sms={sms_updated}'
        )

    return Response(
        {
            'success': True,
            'updated': user_updated + sms_updated,
            # Master switch
            'allowSmsInvitations': user.allow_sms_invitations,
            'phoneNumber': user.phone_number or '',
            'phoneVerified': user.phone_verified,
            # Category preferences
            'smsBattleInvitations': sms_prefs.sms_battle_invitations,
            'smsBattleResults': sms_prefs.sms_battle_results,
            'smsBattleReminders': sms_prefs.sms_battle_reminders,
            'smsStreakAlerts': sms_prefs.sms_streak_alerts,
            # Consent info
            'hasConsent': sms_prefs.has_valid_consent,
        }
    )
