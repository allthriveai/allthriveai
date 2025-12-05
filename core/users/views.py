from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.tools.models import Tool

from .models import User


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
