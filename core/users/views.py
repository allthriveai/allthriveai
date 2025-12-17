import logging
import uuid
from collections import Counter

from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.logging_utils import StructuredLogger
from core.projects.models import Project

from .models import PersonalizationSettings, User, UserFollow
from .serializers import (
    FollowerSerializer,
    PersonalizationSettingsSerializer,
    ProfileSectionsSerializer,
    UserFollowSerializer,
    UserProfileWithSectionsSerializer,
)

logger = logging.getLogger(__name__)


class UserPagination(PageNumberPagination):
    """Pagination for user lists."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET'])
@permission_classes([AllowAny])
def explore_users(request):
    """Explore user profiles with pagination.

    Query parameters:
    - page: page number (default: 1)
    - page_size: results per page (default: 20, max: 100)
    - include_all: if 'true', include users without projects (default: false)

    Returns paginated list of users sorted by:
    1. Number of projects (descending)
    2. Join date (most recent first)
    """
    from core.users.models import UserRole

    include_all = request.GET.get('include_all', 'false').lower() == 'true'

    # Prefetch projects with their tools to avoid N+1 queries
    projects_prefetch = Prefetch(
        'projects',
        queryset=Project.objects.filter(
            is_archived=False,
        ).prefetch_related('tools'),
        to_attr='projects_list',
    )

    # Base queryset - active users, exclude system accounts
    # Also exclude Reddit agents that have no synced posts yet
    queryset = (
        User.objects.filter(
            is_active=True,
            is_profile_public=True,
        )
        .exclude(
            username__in=[
                'system',
                'pip',
                # Reddit agents hidden until sync is working
                'claudeai-reddit-agent',
                'midjourney-reddit-agent',
                'claude-code-reddit-agent',
                'nano-banana-reddit-agent',
            ]
        )
        .exclude(
            role=UserRole.ADMIN  # Don't show admins in explore
        )
        .exclude(
            is_guest=True  # Don't show guest users in explore
        )
    )

    # Annotate with project count
    queryset = queryset.annotate(
        project_count=Count('projects', filter=Q(projects__is_archived=False), distinct=True),
    )

    # Filter to only users with projects unless include_all is set
    if not include_all:
        queryset = queryset.filter(project_count__gt=0)

    queryset = queryset.prefetch_related(projects_prefetch).order_by('-project_count', '-date_joined').distinct()

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

        # Get top 3 tools from prefetched projects (no extra queries)
        tool_counter = Counter()
        for project in getattr(user, 'projects_list', []):
            for tool in project.tools.all():
                tool_counter[tool] += 1

        top_tools = tool_counter.most_common(3)
        user_data['top_tools'] = [
            {
                'id': tool.id,
                'name': tool.name,
                'slug': tool.slug,
                'logo_url': tool.logo_url or '',
            }
            for tool, _ in top_tools
        ]

        users_data.append(user_data)

    return paginator.get_paginated_response(users_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onboarding_progress(request):
    """Get user's quest progress for Ember's Quest Board.

    Returns a list of quest items with their completion status,
    based on actual user activity in the system. These are grouped
    into categories for the quest board UI.
    """
    user = request.user

    # Import models for checking completion
    from allauth.socialaccount.models import SocialAccount

    from core.projects.models import Project, ProjectComment, ProjectLike
    from core.quizzes.models import QuizAttempt
    from core.referrals.models import Referral
    from core.thrive_circle.models import UserSideQuest

    # Check each item's completion status
    checklist = []

    # ===== GETTING STARTED QUESTS =====

    # 1. Complete your profile (has bio, tagline, or avatar)
    profile_complete = bool(user.bio) or bool(user.tagline) or bool(user.avatar_url)
    checklist.append(
        {
            'id': 'complete_profile',
            'title': 'Complete your profile',
            'description': 'Add a bio, tagline, or profile photo.',
            'completed': profile_complete,
            'link': f'/{user.username}?tab=showcase',
            'points': 25,
            'category': 'getting_started',
            'icon': 'user',
        }
    )

    # 2. Set up personalization
    # Check if user has customized any personalization settings (not just defaults)
    has_personalization = PersonalizationSettings.objects.filter(user=user).exists()
    personalization_complete = has_personalization
    checklist.append(
        {
            'id': 'setup_personalization',
            'title': 'Set up personalization',
            'description': 'Tell us your interests for a tailored experience.',
            'completed': personalization_complete,
            'link': '/account/settings/personalization',
            'points': 25,
            'category': 'getting_started',
            'icon': 'sparkles',
        }
    )

    # 3. Take a quiz
    has_taken_quiz = QuizAttempt.objects.filter(user=user).exists()
    checklist.append(
        {
            'id': 'take_quiz',
            'title': 'Take a quiz',
            'description': 'Discover your AI style with a quick quiz.',
            'completed': has_taken_quiz,
            'link': '/quizzes',
            'points': 50,
            'category': 'getting_started',
            'icon': 'academic-cap',
        }
    )

    # ===== CREATE & SHARE QUESTS =====

    # 4. Add your first project
    has_project = Project.objects.filter(user=user, is_archived=False).exists()
    checklist.append(
        {
            'id': 'add_project',
            'title': 'Add your first project',
            'description': 'Share something you created with AI.',
            'completed': has_project,
            'link': f'/{user.username}',
            'points': 50,
            'category': 'create',
            'icon': 'folder-plus',
        }
    )

    # 5. Like a project
    has_liked = ProjectLike.objects.filter(user=user).exists()
    checklist.append(
        {
            'id': 'like_project',
            'title': 'Like a project',
            'description': 'Show some love to a project you enjoy.',
            'completed': has_liked,
            'link': '/explore',
            'points': 10,
            'category': 'engage',
            'icon': 'heart',
        }
    )

    # 6. Comment on a project
    has_commented = ProjectComment.objects.filter(user=user).exists()
    checklist.append(
        {
            'id': 'comment_project',
            'title': 'Comment on a project',
            'description': "Share your thoughts on someone's work.",
            'completed': has_commented,
            'link': '/explore',
            'points': 15,
            'category': 'engage',
            'icon': 'chat-bubble',
        }
    )

    # 7. Follow a creator
    has_followed = UserFollow.objects.filter(follower=user).exists()
    checklist.append(
        {
            'id': 'follow_creator',
            'title': 'Follow a creator',
            'description': 'Stay updated on your favorite creators.',
            'completed': has_followed,
            'link': '/explore',
            'points': 10,
            'category': 'engage',
            'icon': 'user-plus',
        }
    )

    # ===== PLAY & COMPETE QUESTS =====

    # 8. Join a prompt battle
    has_battle = user.battle_types_tried > 0
    checklist.append(
        {
            'id': 'join_battle',
            'title': 'Battle Pip',
            'description': 'Challenge our AI bot in a prompt battle.',
            'completed': has_battle,
            'link': '/battles',
            'points': 50,
            'category': 'play',
            'icon': 'bolt',
        }
    )

    # 9. Complete a side quest
    has_side_quest = UserSideQuest.objects.filter(user=user, is_completed=True).exists()
    checklist.append(
        {
            'id': 'complete_side_quest',
            'title': 'Complete a side quest',
            'description': 'Try a fun creative challenge.',
            'completed': has_side_quest,
            'link': '/play/side-quests',
            'points': 50,
            'category': 'play',
            'icon': 'puzzle-piece',
        }
    )

    # ===== CONNECT & GROW QUESTS =====

    # 10. Connect an integration
    has_integration = SocialAccount.objects.filter(user=user).exists()
    checklist.append(
        {
            'id': 'connect_integration',
            'title': 'Connect an integration',
            'description': 'Link GitHub, Google, or other accounts.',
            'completed': has_integration,
            'link': '/account/settings/integrations',
            'points': 25,
            'category': 'connect',
            'icon': 'link',
        }
    )

    # 11. Refer a friend
    has_referral = Referral.objects.filter(referrer=user).exists()
    checklist.append(
        {
            'id': 'refer_friend',
            'title': 'Refer a friend',
            'description': 'Invite someone to join AllThrive.',
            'completed': has_referral,
            'link': '/account/settings/referrals',
            'points': 100,
            'category': 'connect',
            'icon': 'gift',
        }
    )

    # 12. Explore the tool directory (tracked client-side)
    checklist.append(
        {
            'id': 'explore_tools',
            'title': 'Explore tools',
            'description': 'Discover AI tools for your projects.',
            'completed': False,  # Will be tracked client-side via localStorage
            'link': '/tools',
            'points': 25,
            'category': 'explore',
            'icon': 'wrench',
        }
    )

    # 13. Install Chrome extension (tracked client-side)
    checklist.append(
        {
            'id': 'install_extension',
            'title': 'Get the Chrome extension',
            'description': 'Save AI content from anywhere on the web.',
            'completed': False,  # Will be tracked client-side via localStorage
            'link': '/extension',
            'points': 50,
            'category': 'connect',
            'icon': 'puzzle-piece',
        }
    )

    # Calculate overall progress
    completed_count = sum(1 for item in checklist if item['completed'])
    total_count = len(checklist)
    total_points = sum(item['points'] for item in checklist)
    earned_points = sum(item['points'] for item in checklist if item['completed'])

    # Group by category for the UI
    categories = {
        'getting_started': {'title': 'Getting Started', 'icon': 'rocket', 'items': []},
        'create': {'title': 'Create & Share', 'icon': 'sparkles', 'items': []},
        'engage': {'title': 'Engage', 'icon': 'heart', 'items': []},
        'play': {'title': 'Play & Compete', 'icon': 'bolt', 'items': []},
        'connect': {'title': 'Connect & Grow', 'icon': 'users', 'items': []},
        'explore': {'title': 'Explore', 'icon': 'compass', 'items': []},
    }

    for item in checklist:
        cat = item.get('category', 'getting_started')
        if cat in categories:
            categories[cat]['items'].append(item)

    return Response(
        {
            'checklist': checklist,
            'categories': categories,
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
    from django.db.models import Exists, OuterRef

    target_user = get_object_or_404(User, username=username.lower())

    queryset = UserFollow.objects.filter(following=target_user).select_related('follower').order_by('-created_at')

    # Annotate with is_following to avoid N+1 in serializer
    if request.user.is_authenticated:
        queryset = queryset.annotate(
            _is_following_back=Exists(UserFollow.objects.filter(follower=request.user, following=OuterRef('follower')))
        )

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


# ============================================================================
# PROFILE SECTIONS API
# ============================================================================


@api_view(['GET'])
@permission_classes([AllowAny])
def get_profile_sections(request, username):
    """Get profile sections for a user's showcase.

    Returns the profile sections configuration for display.
    If no sections exist, returns default sections.

    Public endpoint - anyone can view a user's profile sections.
    """
    user = get_object_or_404(User, username=username.lower())

    # Initialize sections with defaults if empty
    if not user.profile_sections:
        user.profile_sections = User.get_default_profile_sections()
        user.save(update_fields=['profile_sections'])

    serializer = UserProfileWithSectionsSerializer(user, context={'request': request})
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile_sections(request, username):
    """Update profile sections for the authenticated user.

    Only the profile owner can update their sections.

    Accepts partial updates - you can update individual sections
    or the entire sections array.
    """
    user = get_object_or_404(User, username=username.lower())

    # Only allow the owner to update their profile sections
    if request.user.id != user.id:
        return Response(
            {'error': 'You can only update your own profile sections'},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = ProfileSectionsSerializer(user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        StructuredLogger.log_service_operation(
            service_name='ProfileSections',
            operation='update',
            success=True,
            metadata={
                'user_id': user.id,
                'sections_count': len(user.profile_sections),
            },
            logger_instance=logger,
        )
        return Response(serializer.data)

    StructuredLogger.log_service_operation(
        service_name='ProfileSections',
        operation='update',
        success=False,
        metadata={'user_id': user.id, 'errors': serializer.errors},
        logger_instance=logger,
    )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_profile_sections(request, username):
    """Reset profile sections to defaults.

    Only the profile owner can reset their sections.
    """
    user = get_object_or_404(User, username=username.lower())

    # Only allow the owner to reset their profile sections
    if request.user.id != user.id:
        return Response(
            {'error': 'You can only reset your own profile sections'},
            status=status.HTTP_403_FORBIDDEN,
        )

    user.profile_sections = User.get_default_profile_sections()
    user.save(update_fields=['profile_sections'])

    StructuredLogger.log_service_operation(
        service_name='ProfileSections',
        operation='reset',
        success=True,
        metadata={'user_id': user.id},
        logger_instance=logger,
    )

    serializer = ProfileSectionsSerializer(user)
    return Response(
        {
            'message': 'Profile sections reset to defaults',
            'profile_sections': serializer.data['profile_sections'],
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_project_in_showcase(request):
    """Toggle a project in the user's featured_projects section.

    Adds or removes a project from the user's profile showcase.
    If no featured_projects section exists, one will be created.

    Request body:
        project_id: int - The ID of the project to toggle

    Returns:
        added: bool - Whether the project was added (True) or removed (False)
        project_ids: list - Updated list of project IDs in the section
    """
    project_id = request.data.get('project_id')
    if not project_id:
        return Response(
            {'error': 'project_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify the project exists and belongs to the user
    try:
        Project.objects.get(id=project_id, user=request.user)
    except Project.DoesNotExist:
        return Response(
            {'error': 'Project not found or you do not own this project'},
            status=status.HTTP_404_NOT_FOUND,
        )

    user = request.user

    # Initialize sections if empty
    if not user.profile_sections:
        user.profile_sections = User.get_default_profile_sections()

    # Find the featured_projects section
    featured_section = None
    featured_section_index = None
    for i, section in enumerate(user.profile_sections):
        if section.get('type') == 'featured_projects':
            featured_section = section
            featured_section_index = i
            break

    # If no featured_projects section exists, create one
    if featured_section is None:
        featured_section = {
            'id': str(uuid.uuid4()),
            'type': 'featured_projects',
            'visible': True,
            'order': len(user.profile_sections),
            'content': {'projectIds': [], 'maxProjects': 6},
        }
        user.profile_sections.append(featured_section)
        featured_section_index = len(user.profile_sections) - 1

    # Get current project IDs
    content = featured_section.get('content', {})
    project_ids = content.get('projectIds', [])
    max_projects = content.get('maxProjects', 6)

    # Toggle the project
    if project_id in project_ids:
        # Remove the project
        project_ids.remove(project_id)
        added = False
    else:
        # Check if we've reached the maximum
        if len(project_ids) >= max_projects:
            return Response(
                {'error': f'Maximum of {max_projects} projects allowed in showcase'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Add the project
        project_ids.append(project_id)
        added = True

    # Update the section
    user.profile_sections[featured_section_index]['content']['projectIds'] = project_ids
    user.save(update_fields=['profile_sections'])

    StructuredLogger.log_service_operation(
        service_name='ProfileSections',
        operation='toggle_project',
        success=True,
        metadata={
            'user_id': user.id,
            'project_id': project_id,
            'added': added,
            'project_count': len(project_ids),
        },
        logger_instance=logger,
    )

    return Response(
        {
            'added': added,
            'projectIds': project_ids,
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_onboarding_path(request):
    """Track which onboarding path the user selected.

    POST body:
    {
        "path_id": "battle_pip" | "add_project" | "explore"
    }

    Only records the first selection (won't overwrite existing).
    """
    from django.utils import timezone

    path_id = request.data.get('path_id')
    valid_paths = ['battle_pip', 'add_project', 'explore']

    if not path_id:
        return Response(
            {'error': 'path_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if path_id not in valid_paths:
        return Response(
            {'error': f'Invalid path_id. Must be one of: {", ".join(valid_paths)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user

    # Only record if not already set (first selection only)
    if not user.onboarding_path:
        user.onboarding_path = path_id
        user.onboarding_completed_at = timezone.now()
        user.save(update_fields=['onboarding_path', 'onboarding_completed_at'])

        StructuredLogger.log_service_operation(
            service_name='Onboarding',
            operation='path_selected',
            success=True,
            metadata={
                'user_id': user.id,
                'path_id': path_id,
            },
            logger_instance=logger,
        )

        return Response(
            {
                'success': True,
                'path_id': path_id,
                'message': 'Onboarding path recorded',
            }
        )

    # Already recorded - return success but indicate it was already set
    return Response(
        {
            'success': True,
            'path_id': user.onboarding_path,
            'message': 'Onboarding path was already recorded',
            'already_set': True,
        }
    )
