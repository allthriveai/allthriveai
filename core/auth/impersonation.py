"""
Admin User Impersonation (Masquerade) Feature

Allows admin users to log in as other users for support and testing purposes.
Tracks all impersonation sessions in an audit log for security.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.logging_utils import SecureLogger, StructuredLogger, get_client_ip
from core.users.models import ImpersonationLog, User, UserRole

from .serializers import UserSerializer

logger = logging.getLogger(__name__)

# Cookie name for storing the original admin user ID during impersonation
IMPERSONATION_COOKIE = 'impersonating_from'


def _get_cookie_settings():
    """Get cookie settings from Django config."""
    return {
        'domain': settings.COOKIE_DOMAIN,
        'samesite': settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        'secure': settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', True),
    }


def _is_localhost_domain(domain):
    """Check if domain is localhost (cookies work better without explicit domain)."""
    return domain in ('localhost', '127.0.0.1', '', None)


def _delete_impersonation_cookie(response):
    """Helper to delete the impersonation cookie with correct settings."""
    cookie_settings = _get_cookie_settings()

    # Build delete kwargs - omit domain for localhost
    delete_kwargs = {
        'key': IMPERSONATION_COOKIE,
        'path': '/',
        'samesite': cookie_settings['samesite'],
    }
    if not _is_localhost_domain(cookie_settings['domain']):
        delete_kwargs['domain'] = cookie_settings['domain']

    response.delete_cookie(**delete_kwargs)
    return response


def _set_impersonation_cookie(response, admin_id, session_id):
    """Set the impersonation tracking cookie."""
    cookie_settings = _get_cookie_settings()
    impersonation_value = f'{admin_id}:{session_id}'

    cookie_kwargs = {
        'key': IMPERSONATION_COOKIE,
        'value': impersonation_value,
        'httponly': True,
        'secure': cookie_settings['secure'],
        'samesite': cookie_settings['samesite'],
        'max_age': int(timedelta(hours=8).total_seconds()),
        'path': '/',
    }

    # Only set domain if it's not localhost
    if not _is_localhost_domain(cookie_settings['domain']):
        cookie_kwargs['domain'] = cookie_settings['domain']

    response.set_cookie(**cookie_kwargs)
    return response


def can_impersonate(admin_user, target_user):
    """
    Check if admin_user can impersonate target_user.

    Returns:
        tuple: (can_impersonate: bool, error_message: str | None)
    """
    # Must be admin or superuser
    if not (admin_user.is_superuser or admin_user.role == UserRole.ADMIN):
        return False, 'Only admins can impersonate users'

    # Cannot impersonate yourself
    if admin_user.id == target_user.id:
        return False, 'Cannot impersonate yourself'

    # Cannot impersonate other admins/superusers (security measure)
    if target_user.is_superuser or target_user.role == UserRole.ADMIN:
        return False, 'Cannot impersonate other admins'

    return True, None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_impersonation(request):
    """
    Start impersonating another user.

    POST /api/v1/admin/impersonate/start/

    Body:
    {
        "user_id": 123,  // or "username": "someuser"
        "reason": "Helping user set up profile"  // optional
    }

    Returns the target user's data and sets impersonation cookies.
    """
    from services.auth import set_auth_cookies

    admin_user = request.user
    client_ip = get_client_ip(request)

    # Get target user identifier
    user_id = request.data.get('user_id')
    username = request.data.get('username')
    reason = request.data.get('reason', '')

    SecureLogger.log_action(
        action='Impersonation attempt',
        user_id=admin_user.id,
        username=admin_user.username,
        details={
            'target_user_id': user_id,
            'target_username': username,
            'reason': reason[:100] if reason else None,
            'ip': client_ip,
        },
        level='info',
    )

    # Validate input
    if not user_id and not username:
        SecureLogger.log_action(
            action='Impersonation failed - missing identifier',
            user_id=admin_user.id,
            username=admin_user.username,
            level='warning',
        )
        return Response(
            {'error': 'Either user_id or username is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Find target user
    try:
        if user_id:
            target_user = User.objects.get(id=user_id)
        else:
            target_user = User.objects.get(username__iexact=username)
    except User.DoesNotExist:
        SecureLogger.log_action(
            action='Impersonation failed - user not found',
            user_id=admin_user.id,
            username=admin_user.username,
            details={'target_user_id': user_id, 'target_username': username},
            level='warning',
        )
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Check permissions
    can_do, error_msg = can_impersonate(admin_user, target_user)
    if not can_do:
        SecureLogger.log_action(
            action='Impersonation denied',
            user_id=admin_user.id,
            username=admin_user.username,
            details={
                'target_user_id': target_user.id,
                'target_username': target_user.username,
                'reason': error_msg,
            },
            level='warning',
        )
        return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)

    # Create audit log entry
    try:
        log = ImpersonationLog.objects.create(
            admin_user=admin_user,
            target_user=target_user,
            ip_address=client_ip,
            user_agent=request.headers.get('user-agent', '')[:500],
            reason=reason,
        )
    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to create impersonation log',
            error=e,
            user=admin_user,
            extra={'target_user_id': target_user.id},
        )
        return Response(
            {'error': 'Failed to start impersonation session'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    SecureLogger.log_action(
        action='Impersonation started',
        user_id=admin_user.id,
        username=admin_user.username,
        details={
            'target_user_id': target_user.id,
            'target_username': target_user.username,
            'session_id': log.id,
            'ip': client_ip,
        },
        level='info',
    )

    # Build response with target user's data
    serializer = UserSerializer(target_user, context={'request': request})
    response = Response(
        {
            'success': True,
            'message': f'Now impersonating {target_user.username}',
            'user': serializer.data,
            'impersonation': {
                'is_impersonating': True,
                'original_user': admin_user.username,
                'target_user': target_user.username,
                'session_id': log.id,
            },
        }
    )

    # Set auth cookies for target user
    response = set_auth_cookies(response, target_user)

    # Set impersonation tracking cookie
    response = _set_impersonation_cookie(response, admin_user.id, log.id)

    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_impersonation(request):
    """
    Stop impersonating and return to admin account.

    POST /api/v1/admin/impersonate/stop/

    Returns the original admin user's data and clears impersonation.
    """
    from services.auth import set_auth_cookies

    current_user = request.user
    impersonation_value = request.COOKIES.get(IMPERSONATION_COOKIE)

    SecureLogger.log_action(
        action='Stop impersonation attempt',
        user_id=current_user.id,
        username=current_user.username,
        details={'has_cookie': bool(impersonation_value)},
        level='info',
    )

    if not impersonation_value:
        SecureLogger.log_action(
            action='Stop impersonation failed - no active session',
            user_id=current_user.id,
            username=current_user.username,
            level='warning',
        )
        return Response(
            {'error': 'Not currently impersonating anyone'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Parse cookie value
    try:
        admin_id, session_id = impersonation_value.split(':')
        admin_id = int(admin_id)
        session_id = int(session_id)
    except (ValueError, AttributeError):
        SecureLogger.log_action(
            action='Stop impersonation failed - invalid cookie',
            user_id=current_user.id,
            username=current_user.username,
            details={'cookie_value': impersonation_value[:20] if impersonation_value else None},
            level='warning',
        )
        response = Response(
            {'error': 'Invalid impersonation session'},
            status=status.HTTP_400_BAD_REQUEST,
        )
        _delete_impersonation_cookie(response)
        return response

    # Find original admin user
    try:
        admin_user = User.objects.get(id=admin_id)
    except User.DoesNotExist:
        SecureLogger.log_action(
            action='Stop impersonation failed - admin not found',
            user_id=current_user.id,
            username=current_user.username,
            details={'admin_id': admin_id},
            level='error',
        )
        response = Response(
            {'error': 'Original admin user not found'},
            status=status.HTTP_400_BAD_REQUEST,
        )
        _delete_impersonation_cookie(response)
        return response

    # Verify admin still has privileges (security check)
    if not (admin_user.is_superuser or admin_user.role == UserRole.ADMIN):
        SecureLogger.log_action(
            action='Stop impersonation failed - admin privileges revoked',
            user_id=admin_user.id,
            username=admin_user.username,
            level='warning',
        )
        response = Response(
            {'error': 'Original user no longer has admin privileges. Please log in again.'},
            status=status.HTTP_403_FORBIDDEN,
        )
        _delete_impersonation_cookie(response)
        return response

    # End the impersonation log session
    try:
        log = ImpersonationLog.objects.get(id=session_id, admin_user=admin_user)
        log.end_session()
        SecureLogger.log_action(
            action='Impersonation ended',
            user_id=admin_user.id,
            username=admin_user.username,
            details={
                'session_id': session_id,
                'target_user_id': current_user.id,
                'target_username': current_user.username,
            },
            level='info',
        )
    except ImpersonationLog.DoesNotExist:
        SecureLogger.log_action(
            action='Impersonation log not found',
            user_id=admin_user.id,
            username=admin_user.username,
            details={'session_id': session_id},
            level='warning',
        )

    # Build response with admin user's data
    serializer = UserSerializer(admin_user, context={'request': request})
    response = Response(
        {
            'success': True,
            'message': f'Returned to {admin_user.username}',
            'user': serializer.data,
            'impersonation': {
                'is_impersonating': False,
            },
        }
    )

    # Set auth cookies back to admin user
    response = set_auth_cookies(response, admin_user)

    # Clear impersonation cookie
    _delete_impersonation_cookie(response)

    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def impersonation_status(request):
    """
    Check current impersonation status.

    GET /api/v1/admin/impersonate/status/

    Returns whether user is currently impersonating someone.
    """
    impersonation_value = request.COOKIES.get(IMPERSONATION_COOKIE)

    # Debug logging (can be removed in production)
    logger.debug(
        f'Impersonation status check: user={request.user.username}, '
        f'cookie={bool(impersonation_value)}, cookies={list(request.COOKIES.keys())}'
    )

    if not impersonation_value:
        return Response({'is_impersonating': False})

    try:
        admin_id, session_id = impersonation_value.split(':')
        admin_user = User.objects.get(id=int(admin_id))
        log = ImpersonationLog.objects.get(id=int(session_id))

        return Response(
            {
                'is_impersonating': True,
                'original_user': {
                    'id': admin_user.id,
                    'username': admin_user.username,
                },
                'target_user': {
                    'id': request.user.id,
                    'username': request.user.username,
                },
                'session_id': log.id,
                'started_at': log.started_at,
            }
        )
    except (ValueError, User.DoesNotExist, ImpersonationLog.DoesNotExist) as e:
        logger.debug(f'Invalid impersonation session: {type(e).__name__}')
        return Response(
            {
                'is_impersonating': False,
                'error': 'Invalid impersonation session',
            }
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_impersonation_logs(request):
    """
    List impersonation history (admin only).

    GET /api/v1/admin/impersonate/logs/

    Query params:
    - admin_id: Filter by admin user
    - target_id: Filter by target user
    - limit: Number of results (default 50, max 100)
    """
    user = request.user

    if not (user.is_superuser or user.role == UserRole.ADMIN):
        SecureLogger.log_action(
            action='Impersonation logs access denied',
            user_id=user.id,
            username=user.username,
            level='warning',
        )
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    logs = ImpersonationLog.objects.select_related('admin_user', 'target_user').order_by('-started_at')

    # Apply filters
    admin_id = request.query_params.get('admin_id')
    target_id = request.query_params.get('target_id')

    if admin_id:
        logs = logs.filter(admin_user_id=admin_id)
    if target_id:
        logs = logs.filter(target_user_id=target_id)

    # Apply limit
    try:
        limit = min(int(request.query_params.get('limit', 50)), 100)
    except (ValueError, TypeError):
        limit = 50

    logs = logs[:limit]

    SecureLogger.log_action(
        action='Impersonation logs viewed',
        user_id=user.id,
        username=user.username,
        details={'count': len(logs), 'filters': {'admin_id': admin_id, 'target_id': target_id}},
        level='info',
    )

    return Response(
        {
            'logs': [
                {
                    'id': log.id,
                    'admin_user': {
                        'id': log.admin_user.id,
                        'username': log.admin_user.username,
                    },
                    'target_user': {
                        'id': log.target_user.id,
                        'username': log.target_user.username,
                    },
                    'started_at': log.started_at,
                    'ended_at': log.ended_at,
                    'reason': log.reason,
                    'ip_address': log.ip_address,
                }
                for log in logs
            ],
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_impersonatable_users(request):
    """
    List users that can be impersonated (admin only).

    GET /api/v1/admin/impersonate/users/

    Query params:
    - search: Search by username, email, first name, or last name
    - limit: Number of results (default 50, max 100)
    """
    user = request.user

    if not (user.is_superuser or user.role == UserRole.ADMIN):
        SecureLogger.log_action(
            action='Impersonatable users access denied',
            user_id=user.id,
            username=user.username,
            level='warning',
        )
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    # Get non-admin, active users (excluding self)
    users = (
        User.objects.exclude(role=UserRole.ADMIN).exclude(is_superuser=True).exclude(id=user.id).filter(is_active=True)
    )

    # Apply search filter
    search = request.query_params.get('search', '').strip()
    if search:
        users = users.filter(
            Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
        )

    # Apply limit
    try:
        limit = min(int(request.query_params.get('limit', 50)), 100)
    except (ValueError, TypeError):
        limit = 50

    users = users.order_by('-date_joined')[:limit]

    logger.debug(f'Listing impersonatable users: count={len(users)}, search={search}')

    return Response(
        {
            'users': [
                {
                    'id': u.id,
                    'username': u.username,
                    'email': u.email,
                    'first_name': u.first_name,
                    'last_name': u.last_name,
                    'avatar_url': u.avatar_url,
                    'role': u.role,
                    'date_joined': u.date_joined,
                    'is_guest': u.is_guest,
                }
                for u in users
            ],
        }
    )
