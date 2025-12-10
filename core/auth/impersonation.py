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

from core.users.models import ImpersonationLog, User, UserRole

from .serializers import UserSerializer

logger = logging.getLogger(__name__)

# Cookie name for storing the original admin user ID during impersonation
IMPERSONATION_COOKIE = 'impersonating_from'


def get_client_ip(request):
    """Extract client IP from request."""
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def can_impersonate(admin_user, target_user):
    """Check if admin_user can impersonate target_user."""
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

    # Get target user
    user_id = request.data.get('user_id')
    username = request.data.get('username')
    reason = request.data.get('reason', '')

    if not user_id and not username:
        return Response(
            {'error': 'Either user_id or username is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        if user_id:
            target_user = User.objects.get(id=user_id)
        else:
            target_user = User.objects.get(username__iexact=username)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Check permissions
    can_do, error_msg = can_impersonate(admin_user, target_user)
    if not can_do:
        logger.warning(
            f'Impersonation denied: {admin_user.username} tried to impersonate {target_user.username}: {error_msg}'
        )
        return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)

    # Create audit log
    log = ImpersonationLog.objects.create(
        admin_user=admin_user,
        target_user=target_user,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get('user-agent', '')[:500],
        reason=reason,
    )

    logger.info(f'Impersonation started: {admin_user.username} -> {target_user.username} (log_id={log.id})')

    # Create response with target user's auth cookies
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

    # Set impersonation tracking cookie (stores original admin user ID and session ID)
    cookie_domain = settings.COOKIE_DOMAIN
    cookie_samesite = settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax')
    secure_flag = settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', True)

    # Store admin_id:session_id in the cookie
    impersonation_value = f'{admin_user.id}:{log.id}'
    response.set_cookie(
        key=IMPERSONATION_COOKIE,
        value=impersonation_value,
        domain=cookie_domain,
        httponly=True,
        secure=secure_flag,
        samesite=cookie_samesite,
        max_age=timedelta(hours=8).total_seconds(),  # 8 hour max session
        path='/',
    )

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

    # Get impersonation cookie
    impersonation_value = request.COOKIES.get(IMPERSONATION_COOKIE)

    if not impersonation_value:
        return Response(
            {'error': 'Not currently impersonating anyone'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        admin_id, session_id = impersonation_value.split(':')
        admin_id = int(admin_id)
        session_id = int(session_id)
    except (ValueError, AttributeError):
        return Response(
            {'error': 'Invalid impersonation session'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get original admin user
    try:
        admin_user = User.objects.get(id=admin_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'Original admin user not found'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify admin is still an admin (security check)
    if not (admin_user.is_superuser or admin_user.role == UserRole.ADMIN):
        logger.warning(f'Admin {admin_id} no longer has admin privileges, clearing impersonation')
        # Still clear the cookie but don't switch to their account
        response = Response(
            {'error': 'Original user no longer has admin privileges. Please log in again.'},
            status=status.HTTP_403_FORBIDDEN,
        )
        cookie_domain = settings.COOKIE_DOMAIN
        cookie_samesite = settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax')
        response.delete_cookie(
            key=IMPERSONATION_COOKIE,
            domain=cookie_domain,
            path='/',
            samesite=cookie_samesite,
        )
        return response

    # End the impersonation log session
    try:
        log = ImpersonationLog.objects.get(id=session_id, admin_user=admin_user)
        log.end_session()
        logger.info(f'Impersonation ended: {admin_user.username} stopped impersonating (log_id={log.id})')
    except ImpersonationLog.DoesNotExist:
        logger.warning(f'Impersonation log not found for session {session_id}')

    # Create response with admin user's auth cookies
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
    cookie_domain = settings.COOKIE_DOMAIN
    cookie_samesite = settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax')
    response.delete_cookie(
        key=IMPERSONATION_COOKIE,
        domain=cookie_domain,
        path='/',
        samesite=cookie_samesite,
    )

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

    if not impersonation_value:
        return Response(
            {
                'is_impersonating': False,
            }
        )

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
    except (ValueError, User.DoesNotExist, ImpersonationLog.DoesNotExist):
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
    - limit: Number of results (default 50)
    """
    user = request.user

    if not (user.is_superuser or user.role == UserRole.ADMIN):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    logs = ImpersonationLog.objects.select_related('admin_user', 'target_user')

    # Filters
    admin_id = request.query_params.get('admin_id')
    target_id = request.query_params.get('target_id')

    if admin_id:
        logs = logs.filter(admin_user_id=admin_id)
    if target_id:
        logs = logs.filter(target_user_id=target_id)

    try:
        limit = min(int(request.query_params.get('limit', 50)), 100)
    except (ValueError, TypeError):
        limit = 50
    logs = logs[:limit]

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
    - search: Search by username or email
    - limit: Number of results (default 20)
    """
    user = request.user

    if not (user.is_superuser or user.role == UserRole.ADMIN):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    # Get non-admin users
    users = (
        User.objects.exclude(role=UserRole.ADMIN).exclude(is_superuser=True).exclude(id=user.id).filter(is_active=True)
    )

    # Search filter
    search = request.query_params.get('search', '').strip()
    if search:
        users = users.filter(
            Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
        )

    try:
        limit = min(int(request.query_params.get('limit', 50)), 100)
    except (ValueError, TypeError):
        limit = 50
    users = users.order_by('-date_joined')[:limit]

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
