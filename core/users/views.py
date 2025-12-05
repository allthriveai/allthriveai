import logging

from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.logging_utils import StructuredLogger
from core.tools.models import Tool

from .models import PersonalizationSettings, User, UserFollow
from .serializers import FollowerSerializer, PersonalizationSettingsSerializer, UserFollowSerializer

logger = logging.getLogger(__name__)


class UserPagination(PageNumberPagination):
    """Pagination for user lists."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET'])
@permission_classes([AllowAny])
def explore_users(request):
    """Explore top user profiles with pagination.

    Query parameters:
    - page: page number (default: 1)
    - page_size: results per page (default: 20, max: 100)

    Returns paginated list of users sorted by:
    1. Number of showcase projects (descending)
    2. Join date (most recent first)

    Only returns users with at least one showcase project.
    """
    # Get users with showcase projects, annotate with counts
    queryset = (
        User.objects.filter(
            is_active=True,
            projects__is_showcased=True,
            projects__is_archived=False,
        )
        .annotate(
            project_count=Count('projects', distinct=True),
            showcase_count=Count(
                'projects',
                distinct=True,
            ),
        )
        .filter(showcase_count__gt=0)  # Only users with showcase projects
        .order_by('-showcase_count', '-date_joined')
        .distinct()
    )

    # Apply pagination
    paginator = UserPagination()
    paginator.page_size = min(int(request.GET.get('page_size', 20)), 100)
    page = paginator.paginate_queryset(queryset, request)

    # Serialize users
    users_data = []
    for user in page:
        user_data = {
            'id': user.id,
            'username': user.username,
            'full_name': user.get_full_name() or user.username,
            'avatar_url': user.avatar_url,
            'bio': user.bio or '',
            'tagline': user.tagline or '',
            'project_count': user.project_count,
        }

        # Privacy: Only include gamification data if user allows it
        if getattr(user, 'gamification_is_public', True):
            user_data.update(
                {
                    'total_points': user.total_points,
                    'level': user.level,
                    'tier': user.tier,
                    'tier_display': user.get_tier_display(),
                }
            )

        # Get top 3 tools used across user's showcase projects
        top_tools = (
            Tool.objects.filter(
                projects__user=user,
                projects__is_showcased=True,
                projects__is_archived=False,
            )
            .annotate(usage_count=Count('projects'))
            .order_by('-usage_count')[:3]
        )
        user_data['top_tools'] = [
            {
                'id': tool.id,
                'name': tool.name,
                'slug': tool.slug,
                'logo_url': tool.logo_url or '',
            }
            for tool in top_tools
        ]

        users_data.append(user_data)

    return paginator.get_paginated_response(users_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onboarding_progress(request):
    """Get user's onboarding checklist progress.

    Returns a list of checklist items with their completion status,
    based on actual user activity in the system.
    """
    user = request.user

    # Import models for checking completion
    from allauth.socialaccount.models import SocialAccount

    from core.projects.models import Project
    from core.quizzes.models import QuizAttempt
    from core.thrive_circle.models import UserSideQuest

    # Check each item's completion status
    checklist = []

    # 1. Complete your profile (has bio, tagline, or avatar)
    profile_complete = bool(user.bio) or bool(user.tagline) or bool(user.avatar_url)
    checklist.append(
        {
            'id': 'complete_profile',
            'title': 'Complete your profile',
            'description': 'Add a bio, tagline, or profile photo to help others get to know you.',
            'completed': profile_complete,
            'link': f'/{user.username}?tab=showcase',
            'points': 25,
        }
    )

    # 2. Take personalization quiz
    has_taken_quiz = QuizAttempt.objects.filter(user=user).exists()
    checklist.append(
        {
            'id': 'take_quiz',
            'title': 'Take a personalization quiz',
            'description': 'Help us personalize your experience by taking a quick quiz.',
            'completed': has_taken_quiz,
            'link': '/quizzes',
            'points': 50,
        }
    )

    # 3. Add your first project
    has_project = Project.objects.filter(user=user, is_archived=False).exists()
    checklist.append(
        {
            'id': 'add_project',
            'title': 'Add your first project',
            'description': "Share something you've created with AI - it can be anything!",
            'completed': has_project,
            'link': '/projects/new',
            'points': 50,
        }
    )

    # 4. Connect an integration
    has_integration = SocialAccount.objects.filter(user=user).exists()
    checklist.append(
        {
            'id': 'connect_integration',
            'title': 'Connect an integration',
            'description': 'Link your GitHub, Google, or other accounts for a seamless experience.',
            'completed': has_integration,
            'link': '/account/settings/integrations',
            'points': 25,
        }
    )

    # 5. Complete a side quest
    has_side_quest = UserSideQuest.objects.filter(user=user, is_completed=True).exists()
    checklist.append(
        {
            'id': 'complete_side_quest',
            'title': 'Complete a side quest',
            'description': 'Try a fun creative challenge and earn points.',
            'completed': has_side_quest,
            'link': '/play/side-quests',
            'points': 50,
        }
    )

    # 6. Join a prompt battle
    has_battle = user.battle_types_tried > 0
    checklist.append(
        {
            'id': 'join_battle',
            'title': 'Join a prompt battle',
            'description': 'Challenge your creativity in a head-to-head prompt competition.',
            'completed': has_battle,
            'link': '/battles',
            'points': 50,
        }
    )

    # 7. Explore the tool directory
    # We'll track this via a flag - for now, consider it done if they've viewed tools
    # This is a simple "discovery" action - could track via page views in future
    checklist.append(
        {
            'id': 'explore_tools',
            'title': 'Explore the tool directory',
            'description': 'Discover AI tools to supercharge your creative projects.',
            'completed': False,  # Will be tracked client-side via localStorage
            'link': '/tools',
            'points': 25,
        }
    )

    # Calculate overall progress
    completed_count = sum(1 for item in checklist if item['completed'])
    total_count = len(checklist)
    total_points = sum(item['points'] for item in checklist)
    earned_points = sum(item['points'] for item in checklist if item['completed'])

    return Response(
        {
            'checklist': checklist,
            'completed_count': completed_count,
            'total_count': total_count,
            'progress_percentage': round((completed_count / total_count) * 100) if total_count > 0 else 0,
            'earned_points': earned_points,
            'total_points': total_points,
        }
    )


class FollowPagination(PageNumberPagination):
    """Pagination for follower/following lists."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def toggle_follow(request, username):
    """Follow or unfollow a user.

    POST: Follow the user
    DELETE: Unfollow the user
    """
    target_user = get_object_or_404(User, username=username.lower())

    # Can't follow yourself
    if target_user.id == request.user.id:
        return Response({'error': 'You cannot follow yourself'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        # Follow the user
        follow, created = UserFollow.objects.get_or_create(follower=request.user, following=target_user)

        if not created:
            return Response({'message': 'Already following this user'}, status=status.HTTP_200_OK)

        # Update counts
        User.objects.filter(pk=target_user.pk).update(followers_count=target_user.followers_count + 1)
        User.objects.filter(pk=request.user.pk).update(following_count=request.user.following_count + 1)

        return Response(
            {
                'message': 'Successfully followed user',
                'is_following': True,
                'followers_count': target_user.followers_count + 1,
            },
            status=status.HTTP_201_CREATED,
        )

    else:  # DELETE
        # Unfollow the user
        deleted_count, _ = UserFollow.objects.filter(follower=request.user, following=target_user).delete()

        if deleted_count == 0:
            return Response({'message': 'You were not following this user'}, status=status.HTTP_200_OK)

        # Update counts
        User.objects.filter(pk=target_user.pk).update(followers_count=max(0, target_user.followers_count - 1))
        User.objects.filter(pk=request.user.pk).update(following_count=max(0, request.user.following_count - 1))

        return Response(
            {
                'message': 'Successfully unfollowed user',
                'is_following': False,
                'followers_count': max(0, target_user.followers_count - 1),
            },
            status=status.HTTP_200_OK,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def list_followers(request, username):
    """Get list of users who follow the specified user."""
    target_user = get_object_or_404(User, username=username.lower())

    queryset = UserFollow.objects.filter(following=target_user).select_related('follower').order_by('-created_at')

    paginator = FollowPagination()
    page = paginator.paginate_queryset(queryset, request)

    serializer = FollowerSerializer(page, many=True, context={'request': request})

    return paginator.get_paginated_response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_following(request, username):
    """Get list of users the specified user is following."""
    target_user = get_object_or_404(User, username=username.lower())

    queryset = UserFollow.objects.filter(follower=target_user).select_related('following').order_by('-created_at')

    paginator = FollowPagination()
    page = paginator.paginate_queryset(queryset, request)

    serializer = UserFollowSerializer(page, many=True, context={'request': request})

    return paginator.get_paginated_response(serializer.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def personalization_settings(request):
    """Get or update user's personalization settings.

    GET: Returns current personalization settings (creates defaults if none exist)
    PATCH: Updates personalization settings (partial update)

    These settings control:
    - Which signals influence recommendations (topics, views, likes, etc.)
    - Discovery vs familiar content balance
    - Privacy/tracking preferences
    """
    # Get or create settings for the user
    settings, created = PersonalizationSettings.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        StructuredLogger.log_service_operation(
            service_name='PersonalizationSettings',
            operation='get',
            success=True,
            metadata={'user_id': request.user.id, 'settings_created': created},
            logger_instance=logger,
        )
        serializer = PersonalizationSettingsSerializer(settings)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        serializer = PersonalizationSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            StructuredLogger.log_service_operation(
                service_name='PersonalizationSettings',
                operation='update',
                success=True,
                metadata={
                    'user_id': request.user.id,
                    'updated_fields': list(request.data.keys()),
                },
                logger_instance=logger,
            )
            return Response(serializer.data)
        StructuredLogger.log_service_operation(
            service_name='PersonalizationSettings',
            operation='update',
            success=False,
            metadata={'user_id': request.user.id, 'errors': serializer.errors},
            logger_instance=logger,
        )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_personalization_settings(request):
    """Reset personalization settings to defaults.

    This resets all recommendation signal controls and privacy settings
    to their default values.
    """
    settings, created = PersonalizationSettings.objects.get_or_create(user=request.user)
    settings.reset_to_defaults()

    StructuredLogger.log_service_operation(
        service_name='PersonalizationSettings',
        operation='reset',
        success=True,
        metadata={'user_id': request.user.id},
        logger_instance=logger,
    )

    serializer = PersonalizationSettingsSerializer(settings)
    return Response({'message': 'Personalization settings reset to defaults', 'settings': serializer.data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_personalization_data(request):
    """Export all personalization data for the user.

    Returns a JSON object containing:
    - Settings (recommendation controls, privacy preferences)
    - Manual tags (user-selected topics/interests)
    - Auto-generated tags (system-detected preferences)
    - Interaction history summary

    This supports GDPR data portability requirements.
    """
    from django.utils import timezone

    from core.taxonomy.models import UserInteraction, UserTag

    user = request.user

    # Get personalization settings
    try:
        settings = PersonalizationSettings.objects.get(user=user)
        settings_data = PersonalizationSettingsSerializer(settings).data
    except PersonalizationSettings.DoesNotExist:
        settings_data = None

    # Get manual tags
    manual_tags = UserTag.objects.filter(user=user, source='manual').select_related('taxonomy')
    manual_tags_data = [
        {
            'id': tag.id,
            'name': tag.name,
            'taxonomy': {
                'id': tag.taxonomy.id,
                'name': tag.taxonomy.name,
                'category': tag.taxonomy.taxonomy_type,
            }
            if tag.taxonomy
            else None,
            'created_at': tag.created_at.isoformat(),
        }
        for tag in manual_tags
    ]

    # Get auto-generated tags
    auto_tags = UserTag.objects.filter(user=user, source='auto_generated').select_related('taxonomy')
    auto_tags_data = [
        {
            'id': tag.id,
            'name': tag.name,
            'confidence_score': tag.confidence_score,
            'interaction_count': tag.interaction_count,
            'taxonomy': {
                'id': tag.taxonomy.id,
                'name': tag.taxonomy.name,
                'category': tag.taxonomy.taxonomy_type,
            }
            if tag.taxonomy
            else None,
            'created_at': tag.created_at.isoformat(),
            'updated_at': tag.updated_at.isoformat(),
        }
        for tag in auto_tags
    ]

    # Get interaction summary (last 90 days)
    ninety_days_ago = timezone.now() - timezone.timedelta(days=90)
    interactions = (
        UserInteraction.objects.filter(user=user, created_at__gte=ninety_days_ago)
        .values('interaction_type')
        .annotate(count=Count('id'))
    )
    interactions_data = {item['interaction_type']: item['count'] for item in interactions}

    StructuredLogger.log_service_operation(
        service_name='PersonalizationData',
        operation='export',
        success=True,
        metadata={
            'user_id': user.id,
            'manual_tags_count': len(manual_tags_data),
            'auto_tags_count': len(auto_tags_data),
            'has_settings': settings_data is not None,
        },
        logger_instance=logger,
    )

    return Response(
        {
            'exported_at': timezone.now().isoformat(),
            'user': {
                'id': user.id,
                'username': user.username,
            },
            'personalization_settings': settings_data,
            'manual_tags': manual_tags_data,
            'auto_generated_tags': auto_tags_data,
            'interaction_summary_last_90_days': interactions_data,
        }
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_personalization_data(request):
    """Delete all personalization data for the user.

    This removes:
    - All user tags (manual and auto-generated)
    - All interaction history
    - Personalization settings (will be recreated with defaults on next access)

    This supports GDPR right to erasure.
    """
    from core.taxonomy.models import UserInteraction, UserTag

    user = request.user

    # Delete all user tags
    tags_deleted, _ = UserTag.objects.filter(user=user).delete()

    # Delete all interactions
    interactions_deleted, _ = UserInteraction.objects.filter(user=user).delete()

    # Delete personalization settings
    settings_deleted, _ = PersonalizationSettings.objects.filter(user=user).delete()

    StructuredLogger.log_service_operation(
        service_name='PersonalizationData',
        operation='delete',
        success=True,
        metadata={
            'user_id': user.id,
            'tags_deleted': tags_deleted,
            'interactions_deleted': interactions_deleted,
            'settings_deleted': 1 if settings_deleted else 0,
        },
        logger_instance=logger,
    )

    return Response(
        {
            'message': 'All personalization data has been deleted',
            'deleted': {
                'tags': tags_deleted,
                'interactions': interactions_deleted,
                'settings': 1 if settings_deleted else 0,
            },
        }
    )
