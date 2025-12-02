import logging
import time
from urllib.parse import urlencode

from allauth.socialaccount.models import SocialApp
from csp.decorators import csp_exempt
from django.conf import settings
from django.core.cache import cache
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from django_ratelimit.decorators import ratelimit
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.audits.models import UserAuditLog
from core.thrive_circle.signals import track_profile_viewed, track_user_login
from core.throttles import AuthenticatedProfileThrottle, PublicProfileThrottle
from core.users.models import User

from .serializers import UserSerializer, UserUpdateSerializer

logger = logging.getLogger(__name__)

# OAuth login is now handled by django-allauth with custom adapter
# See: core/auth/adapter.py and core/auth/oauth_middleware.py
# The JWT tokens are set automatically via the OAuthJWTMiddleware


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Get current authenticated user info."""
    serializer = UserSerializer(request.user, context={'request': request})
    return Response({'success': True, 'data': serializer.data})


@ratelimit(key='ip', rate='10/m', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Login user with email/password.

    Rate limits:
    - 10 attempts per minute per IP address

    Security:
    - Consistent response time to prevent user enumeration
    - Rate limiting to prevent brute-force attacks
    """
    from django.contrib.auth import login
    from django.db.models import Q

    from services.auth import set_auth_cookies

    start_time = time.time()

    email = request.data.get('email')  # Can be email or username
    password = request.data.get('password')

    if not email or not password:
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)
        return Response({'error': 'Email/username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Try to find user by email or username
    try:
        user = User.objects.get(Q(email__iexact=email) | Q(username__iexact=email))
    except User.DoesNotExist:
        # Ensure minimum response time to prevent timing attacks
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)
        return Response({'error': 'Invalid email/username or password'}, status=status.HTTP_401_UNAUTHORIZED)

    # Check password
    if not user.check_password(password):
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)

        # Log failed login attempt
        UserAuditLog.log_action(
            user=user,
            action=UserAuditLog.Action.FAILED_LOGIN,
            request=request,
            details={'reason': 'invalid_password', 'email': email},
            success=False,
        )

        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

    # Check if user is active
    if not user.is_active:
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)
        return Response({'error': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)

    # Log the user in
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')

    # Log successful login
    UserAuditLog.log_action(
        user=user,
        action=UserAuditLog.Action.LOGIN,
        request=request,
        details={'email': email, 'method': 'email_password'},
        success=True,
    )

    # Track login for quest progress and auto-start daily quests
    track_user_login(user)

    # Ensure minimum response time
    elapsed = time.time() - start_time
    if elapsed < 0.1:
        time.sleep(0.1 - elapsed)

    serializer = UserSerializer(user, context={'request': request})
    response = Response(
        {
            'success': True,
            'message': 'Login successful',
            'data': serializer.data,
        },
        status=status.HTTP_200_OK,
    )

    # Set authentication cookies
    return set_auth_cookies(response, user)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow anyone to logout
@csrf_exempt
def logout_view(request):
    """Logout user and clear cookies."""
    from services.auth import clear_auth_cookies

    response = Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    return clear_auth_cookies(response)


@ratelimit(key='ip', rate='5/h', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    """Register a new user with rate limiting and timing attack protection.

    Rate limits:
    - 5 attempts per hour per IP address

    Security:
    - Consistent response time to prevent user enumeration
    - Rate limiting to prevent automated account creation
    """
    from django.core.cache import cache

    from .serializers import UserCreateSerializer

    start_time = time.time()

    # Check additional rate limit for signup attempts
    ip_address = request.META.get('REMOTE_ADDR')
    cache_key = f'signup_attempts:{ip_address}'
    attempts = cache.get(cache_key, 0)

    if attempts >= 5:
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)
        return Response(
            {'error': 'Too many signup attempts. Please try again later.'}, status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    serializer = UserCreateSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        # Clear signup attempts on success
        cache.delete(cache_key)

        # Ensure minimum response time
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)

        return Response(
            {
                'message': 'User created successfully. Please check your email to verify your account.',
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )

    # Increment failed attempts
    cache.set(cache_key, attempts + 1, 3600)  # 1 hour expiry

    # Ensure minimum response time to prevent timing attacks
    elapsed = time.time() - start_time
    if elapsed < 0.1:
        time.sleep(0.1 - elapsed)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_urls(request):
    """Return OAuth provider URLs for frontend."""
    from django.conf import settings

    # Use SITE_URL from settings instead of request.build_absolute_uri
    # to ensure correct external URL (not Docker internal hostname)
    base_url = getattr(settings, 'SITE_URL', request.build_absolute_uri('/')[:-1])

    return Response(
        {
            'google': f'{base_url}/api/v1/social/connect/google/',
            'github': f'{base_url}/api/v1/social/connect/github/',
        }
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def csrf_token(request):
    """Return CSRF token for the frontend."""
    from django.middleware.csrf import get_token

    token = get_token(request)
    return Response({'csrfToken': token})


class UserProfileView(generics.RetrieveUpdateAPIView):
    """View for retrieving and updating user profile."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def username_profile_view(request, username):
    """View user profile by username.

    Security: Uses consistent response time to prevent user enumeration.
    Rate limited to prevent brute-force username discovery.
    """
    # Check throttle manually based on authentication status
    throttle_class = AuthenticatedProfileThrottle if request.user.is_authenticated else PublicProfileThrottle
    throttle = throttle_class()
    if not throttle.allow_request(request, None):
        from rest_framework.exceptions import Throttled

        raise Throttled(wait=throttle.wait())

    start_time = time.time()

    # Check cache first
    cache_key = f'profile:{username.lower()}'
    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data['response'], status=cached_data['status'])

    try:
        user = User.objects.get(username=username.lower())
        serializer = UserSerializer(user, context={'request': request})
        response_data = {'success': True, 'data': serializer.data}
        status_code = 200

        # Track profile view for quest progress (only for authenticated users viewing others)
        if request.user.is_authenticated and request.user != user:
            track_profile_viewed(request.user, user)

        # Cache successful responses
        cache.set(
            cache_key, {'response': response_data, 'status': status_code}, settings.CACHE_TTL.get('PUBLIC_PROFILE', 300)
        )
    except User.DoesNotExist:
        # Return 404 but maintain consistent response time to prevent timing attacks
        response_data = {'success': False, 'error': 'User not found', 'data': None}
        status_code = 404
        # Don't cache 404s to avoid poisoning cache with enumeration attempts

    # Ensure minimum response time to prevent timing attacks
    elapsed = time.time() - start_time
    if elapsed < 0.05:  # 50ms minimum
        time.sleep(0.05 - elapsed)

    return Response(response_data, status=status_code)


@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_redirect(request):
    """
    Direct redirect to Google OAuth without intermediate page.
    """
    provider = request.GET.get('provider', 'google')

    if provider == 'google':
        # Get the social app credentials
        try:
            social_app = SocialApp.objects.get(provider='google')
            client_id = social_app.client_id
        except SocialApp.DoesNotExist:
            client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']

        # Build Google OAuth URL
        redirect_uri = f'{settings.BACKEND_URL}/accounts/google/login/callback/'
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'access_type': 'online',
        }

        google_auth_url = f'https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}'
        return redirect(google_auth_url)

    # Fallback to allauth for other providers
    return redirect(f'/accounts/{provider}/login/?process=login')


@api_view(['GET'])
@permission_classes([AllowAny])
@csp_exempt()
def oauth_callback(request):
    """
    Handle OAuth callback and close popup after setting authentication cookies.
    This is called after successful OAuth authentication.
    """
    from services.auth import set_auth_cookies

    if request.user.is_authenticated:
        # Track login for quest progress and auto-start daily quests
        track_user_login(request.user)

        # Redirect to user profile with cookies set
        username = request.user.username
        redirect_url = f'{settings.FRONTEND_URL}/{username}'
        response = redirect(redirect_url)

        # Set JWT tokens using centralized service
        return set_auth_cookies(response, request.user)
    else:
        # OAuth failed, redirect to login with error
        return redirect(f'{settings.FRONTEND_URL}/login?error=oauth_failed')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_activity_insights(request):
    """Get comprehensive activity insights for the current user.

    Returns:
        - tool_engagement: Top tools used in projects
        - topic_interests: Topics most engaged with
        - activity_trends: Daily activity for last 30 days
        - points_by_category: Points breakdown by activity type
        - insights: Personalized insights cards
        - stats_summary: Overview statistics
    """
    try:
        from services.activity_insights_service import ActivityInsightsService

        service = ActivityInsightsService(request.user)
        insights = service.get_full_insights()

        return Response(
            {
                'success': True,
                'data': insights,
            }
        )
    except Exception as e:
        logger.exception(f'Error in user_activity_insights: {e}')
        return Response(
            {
                'success': False,
                'error': str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_activity(request):
    """Get current user's recent activity and statistics."""
    user = request.user

    # Get recent audit logs (last 20 activities)
    recent_activities = UserAuditLog.objects.filter(user=user).order_by('-timestamp')[:20]

    # Format activity data
    activities = [
        {
            'id': log.id,
            'action': log.get_action_display(),
            'actionType': log.action,
            'timestamp': log.timestamp.isoformat(),
            'ipAddress': log.ip_address,
            'success': log.success,
            'details': log.details,
        }
        for log in recent_activities
    ]

    # Get login statistics
    login_count = UserAuditLog.objects.filter(
        user=user, action__in=[UserAuditLog.Action.LOGIN, UserAuditLog.Action.OAUTH_LOGIN]
    ).count()

    last_login_log = (
        UserAuditLog.objects.filter(
            user=user, action__in=[UserAuditLog.Action.LOGIN, UserAuditLog.Action.OAUTH_LOGIN], success=True
        )
        .order_by('-timestamp')
        .first()
    )

    # Get quiz scores (last 10 completed attempts)
    from core.quizzes.models import QuizAttempt

    quiz_attempts = (
        QuizAttempt.objects.filter(user=user, completed_at__isnull=False)
        .select_related('quiz')
        .order_by('-completed_at')[:10]
    )

    quiz_scores = [
        {
            'id': str(attempt.id),
            'quizTitle': attempt.quiz.title,
            'quizSlug': attempt.quiz.slug,
            'score': attempt.score,
            'totalQuestions': attempt.total_questions,
            'percentageScore': attempt.percentage_score,
            'completedAt': attempt.completed_at.isoformat() if attempt.completed_at else None,
            'topic': attempt.quiz.topic,
            'difficulty': attempt.quiz.difficulty,
        }
        for attempt in quiz_attempts
    ]

    # Get points history (last 20 point activities)
    from core.thrive_circle.models import PointActivity, UserSideQuest

    points_activities = PointActivity.objects.filter(user=user).order_by('-created_at')[:20]

    points_feed = [
        {
            'id': str(activity.id),
            'activityType': activity.activity_type,
            'activityDisplay': activity.get_activity_type_display(),
            'pointsAwarded': activity.amount,
            'description': activity.description,
            'metadata': {},  # PointActivity doesn't have metadata field
            'createdAt': activity.created_at.isoformat(),
        }
        for activity in points_activities
    ]

    # Get recent quest completions with full quest details
    completed_quests = (
        UserSideQuest.objects.filter(user=user, status='completed')
        .select_related('side_quest')
        .order_by('-completed_at')[:10]
    )

    quest_completions = [
        {
            'id': str(quest.id),
            'questId': str(quest.side_quest.id),
            'questTitle': quest.side_quest.title,
            'questDescription': quest.side_quest.description,
            'categorySlug': quest.side_quest.category.slug if quest.side_quest.category else None,
            'categoryName': quest.side_quest.category.name if quest.side_quest.category else None,
            'pointsAwarded': quest.points_awarded,
            'completedAt': quest.completed_at.isoformat() if quest.completed_at else None,
            'isGuided': quest.side_quest.is_guided,
        }
        for quest in completed_quests
    ]

    return Response(
        {
            'success': True,
            'data': {
                'activities': activities,
                'statistics': {
                    'totalLogins': login_count,
                    'lastLogin': user.last_login.isoformat() if user.last_login else None,
                    'lastLoginDetails': {
                        'timestamp': last_login_log.timestamp.isoformat() if last_login_log else None,
                        'ipAddress': last_login_log.ip_address if last_login_log else None,
                    }
                    if last_login_log
                    else None,
                    'accountCreated': user.date_joined.isoformat(),
                    'quizScores': quiz_scores,
                    'projectCount': user.projects.count(),
                    'totalPoints': user.total_points,
                    'level': user.level,
                    'currentStreak': user.current_streak_days,
                    'lifetimeQuestsCompleted': user.lifetime_side_quests_completed,
                },
                'pointsFeed': points_feed,
                'questCompletions': quest_completions,
            },
        }
    )
