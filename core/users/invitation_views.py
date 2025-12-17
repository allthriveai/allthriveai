"""Views for invitation request endpoints."""

import logging

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError
from django.template.loader import render_to_string
from django.utils import timezone
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.users.invitation_models import InvitationRequest

logger = logging.getLogger(__name__)

# reCAPTCHA verification settings
RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
RECAPTCHA_SCORE_THRESHOLD = 0.5  # Minimum score to consider human (0.0 - 1.0)

# Admin emails disabled - manage requests via admin panel instead


def get_client_ip(request):
    """Extract client IP from request headers."""
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def mask_email(email: str) -> str:
    """Mask email for logging."""
    if not email or '@' not in email:
        return '[invalid-email]'
    parts = email.split('@')
    username = parts[0]
    masked = username[:2] + '***' if len(username) > 2 else '***'
    return f'{masked}@{parts[1]}'


def verify_recaptcha(token: str, remote_ip: str | None = None) -> tuple[bool, str]:
    """Verify a reCAPTCHA v3 token with Google's API.

    Args:
        token: The reCAPTCHA token from the frontend
        remote_ip: Optional client IP for additional verification

    Returns:
        Tuple of (success: bool, error_message: str)
    """
    # Skip reCAPTCHA in DEBUG mode (local development)
    # Rate limiting still provides basic protection
    if settings.DEBUG:
        logger.debug('reCAPTCHA skipped in DEBUG mode')
        return True, ''

    secret_key = getattr(settings, 'RECAPTCHA_SECRET_KEY', '')

    # If no secret key configured, skip verification (development mode)
    if not secret_key:
        logger.warning('reCAPTCHA secret key not configured, skipping verification')
        return True, ''

    if not token:
        # In development or when frontend doesn't have site key, allow empty tokens
        # The endpoint has rate limiting which provides basic protection
        logger.warning('reCAPTCHA token is empty - frontend may not have site key configured')
        return True, ''

    try:
        payload = {
            'secret': secret_key,
            'response': token,
        }
        if remote_ip:
            payload['remoteip'] = remote_ip

        response = requests.post(RECAPTCHA_VERIFY_URL, data=payload, timeout=10)
        result = response.json()

        if not result.get('success'):
            error_codes = result.get('error-codes', [])
            logger.warning(f'reCAPTCHA verification failed: {error_codes}')
            return False, 'reCAPTCHA verification failed'

        score = result.get('score', 0)
        action = result.get('action', '')

        # Verify the action matches what we expect
        # Note: In some cases (misconfigured keys, development), action may be empty
        # We log a warning but allow if score is acceptable
        if action and action != 'invitation_request':
            logger.warning(f'reCAPTCHA action mismatch: expected invitation_request, got {action}')
            return False, 'reCAPTCHA verification failed'
        elif not action:
            logger.warning('reCAPTCHA action is empty - site key may be misconfigured')

        # Check if score meets threshold
        if score < RECAPTCHA_SCORE_THRESHOLD:
            logger.warning(f'reCAPTCHA score too low: {score} < {RECAPTCHA_SCORE_THRESHOLD}')
            return False, 'Bot detection triggered. Please try again.'

        logger.info(f'reCAPTCHA verified successfully: score={score}, action={action}')
        return True, ''

    except requests.RequestException as e:
        logger.error(f'reCAPTCHA verification request failed: {e}')
        # Allow request to proceed if reCAPTCHA service is unavailable
        return True, ''
    except (ValueError, KeyError) as e:
        logger.error(f'reCAPTCHA response parsing failed: {e}')
        return True, ''


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='5/h', method='POST', block=True)
def request_invitation(request):
    """Submit a request to join AllThrive AI.

    POST body (JSON):
        email: User's email address (required)
        name: User's name (required)
        reason: Why they want to join (optional)
        excited_features: List of feature keys user is excited about (optional)
        desired_integrations: List of integration keys for portfolio import (optional)
        desired_integrations_other: Other integration text (optional)

    Returns:
        201: Request created successfully
        400: Validation error
        409: Email already submitted
        429: Rate limited
    """
    data = request.data
    email = data.get('email', '').strip().lower()
    name = data.get('name', '').strip()
    reason = data.get('reason', '').strip()
    recaptcha_token = data.get('recaptcha_token', '')

    # Feature interest survey fields
    excited_features = data.get('excited_features', [])
    desired_integrations = data.get('desired_integrations', [])
    desired_integrations_other = data.get('desired_integrations_other', '').strip()

    # Verify reCAPTCHA token
    client_ip = get_client_ip(request)
    is_valid, error_message = verify_recaptcha(recaptcha_token, client_ip)
    if not is_valid:
        return Response(
            {'error': error_message or 'reCAPTCHA verification failed'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate required fields
    if not email:
        return Response(
            {'error': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not name:
        return Response(
            {'error': 'Name is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Basic email validation
    if '@' not in email or '.' not in email.split('@')[-1]:
        return Response(
            {'error': 'Please enter a valid email address'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Limit name and reason length
    name = name[:100]
    reason = reason[:1000] if reason else ''

    # Validate and sanitize feature interest fields
    valid_feature_keys = {key for key, _ in InvitationRequest.FEATURE_CHOICES}
    valid_integration_keys = {key for key, _ in InvitationRequest.INTEGRATION_CHOICES}

    # Ensure excited_features is a list and filter to valid keys
    if not isinstance(excited_features, list):
        excited_features = []
    excited_features = [f for f in excited_features if f in valid_feature_keys]

    # Ensure desired_integrations is a list and filter to valid keys
    if not isinstance(desired_integrations, list):
        desired_integrations = []
    desired_integrations = [i for i in desired_integrations if i in valid_integration_keys]

    # Limit other integration text length
    desired_integrations_other = desired_integrations_other[:200] if desired_integrations_other else ''

    try:
        invitation = InvitationRequest.objects.create(
            email=email,
            name=name,
            reason=reason,
            excited_features=excited_features,
            desired_integrations=desired_integrations,
            desired_integrations_other=desired_integrations_other,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get('user-agent', '')[:500],
        )
    except IntegrityError:
        # Email already exists
        logger.info(f'Duplicate invitation request: {mask_email(email)}')
        return Response(
            {'error': 'This email has already submitted a request'},
            status=status.HTTP_409_CONFLICT,
        )

    logger.info(f'New invitation request: id={invitation.id}, email={mask_email(email)}')

    # Send emails asynchronously
    _send_invitation_emails(invitation)

    return Response(
        {
            'success': True,
            'message': "Thanks! We've received your request and will be in touch soon.",
        },
        status=status.HTTP_201_CREATED,
    )


def _send_invitation_emails(invitation: InvitationRequest):
    """Send confirmation email to the requester.

    Note: Admin notifications are disabled. Manage requests via admin panel:
    https://allthrive.ai/admin/users/invitationrequest/
    """
    frontend_url = settings.FRONTEND_URL

    # Send user confirmation
    try:
        user_context = {
            'requester_name': invitation.name,
            'requester_email': invitation.email,
            'reason': invitation.reason,
            'excited_features': invitation.get_excited_features_display(),
            'desired_integrations': invitation.get_desired_integrations_display(),
            'submitted_at': invitation.created_at.strftime('%B %d, %Y at %I:%M %p UTC'),
            'frontend_url': frontend_url,
            'current_year': timezone.now().year,
            'settings_url': f'{frontend_url}/settings/notifications',
            'unsubscribe_url': f'{frontend_url}/unsubscribe',
        }

        html_content = render_to_string('emails/invitations/request_user.html', user_context)
        text_content = render_to_string('emails/invitations/request_user.txt', user_context)

        email = EmailMultiAlternatives(
            subject='We received your request to join AllThrive AI',
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[invitation.email],
        )
        email.attach_alternative(html_content, 'text/html')
        email.send(fail_silently=False)

        logger.info(f'User confirmation sent for invitation id={invitation.id}')

    except Exception as e:
        logger.error(f'Failed to send user confirmation for invitation id={invitation.id}: {e}')


def send_approval_email(invitation: InvitationRequest):
    """Send approval email to user when their request is approved.

    Called from admin action or model method.
    """
    frontend_url = settings.FRONTEND_URL

    context = {
        'requester_name': invitation.name,
        'requester_email': invitation.email,
        'signup_url': f'{frontend_url}/auth?beta=THRIVE&email={invitation.email}',
        'frontend_url': frontend_url,
        'current_year': timezone.now().year,
        'settings_url': f'{frontend_url}/settings/notifications',
        'unsubscribe_url': f'{frontend_url}/unsubscribe',
    }

    try:
        html_content = render_to_string('emails/invitations/approved.html', context)
        text_content = render_to_string('emails/invitations/approved.txt', context)

        # Use support@ for welcome emails (more personal than noreply@)
        from_email = 'AllThrive AI <support@allthrive.ai>'

        email = EmailMultiAlternatives(
            subject="You're invited to join AllThrive AI!",
            body=text_content,
            from_email=from_email,
            to=[invitation.email],
        )
        email.attach_alternative(html_content, 'text/html')
        email.send(fail_silently=False)

        # Record that the email was sent
        invitation.approval_email_sent_at = timezone.now()
        invitation.save(update_fields=['approval_email_sent_at', 'updated_at'])

        logger.info(f'Approval email sent for invitation id={invitation.id} to {invitation.email}')

    except Exception as e:
        logger.error(f'Failed to send approval email for invitation id={invitation.id}: {e}', exc_info=True)
        raise
