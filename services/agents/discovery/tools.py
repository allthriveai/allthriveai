"""
LangChain tools for discovery agent.

Provides search, recommendation, and exploration capabilities.
"""

import logging
from typing import Literal

from django.db.models import Count, Q
from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# Tool Input Schemas
class SearchProjectsInput(BaseModel):
    """Input for search_projects tool."""

    query: str = Field(description='Search query - keywords, topic, or description')
    category: str = Field(default='', description='Optional category filter (e.g., "AI Agents", "Developer & Coding")')
    limit: int = Field(default=5, description='Maximum number of results (1-10)')


class GetRecommendationsInput(BaseModel):
    """Input for get_recommendations tool."""

    model_config = {'extra': 'allow'}

    limit: int = Field(default=5, description='Number of recommendations to return (1-10)')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class FindSimilarInput(BaseModel):
    """Input for find_similar_projects tool."""

    project_id: int = Field(description='ID of the project to find similar ones to')
    limit: int = Field(default=5, description='Number of similar projects to return (1-5)')


class GetTrendingInput(BaseModel):
    """Input for get_trending_projects tool."""

    limit: int = Field(default=5, description='Number of trending projects to return (1-10)')
    time_window: Literal['day', 'week', 'month'] = Field(
        default='week', description='Time window for trending calculation'
    )


class GetProjectDetailsInput(BaseModel):
    """Input for get_project_details tool."""

    project_id: int = Field(default=0, description='Project ID (use if known)')
    project_slug: str = Field(default='', description='Project slug (use if ID not known)')
    project_title: str = Field(default='', description='Project title to search for (use if ID/slug not known)')


class UnifiedSearchInput(BaseModel):
    """Input for unified_search tool."""

    query: str = Field(description='Search query - what the user is looking for')
    content_types: list[str] | None = Field(
        default=None,
        description='Content types to search: "project", "quiz", "tool", "micro_lesson". Leave empty to auto-detect.',
    )
    difficulty: str | None = Field(
        default=None,
        description='Filter by difficulty: "beginner", "intermediate", "advanced"',
    )
    limit: int = Field(default=10, description='Maximum number of results (1-20)')


class GetRelatedContentInput(BaseModel):
    """Input for get_related_content tool."""

    content_type: str = Field(description='Type of content: "project", "quiz", "tool", "micro_lesson"')
    content_id: int | str = Field(description='ID of the content to find related items for')
    limit: int = Field(default=5, description='Number of related items to return (1-10)')


def _format_project_for_agent(project) -> dict:
    """Format a project object for agent consumption."""
    return {
        'id': project.id,
        'title': project.title,
        'slug': project.slug,
        'description': project.description[:200] + '...' if len(project.description) > 200 else project.description,
        'type': project.type,
        'author': project.user.username,
        'author_avatar_url': project.user.avatar_url or '',
        'thumbnail': project.featured_image_url or '',
        'featured_image_url': project.featured_image_url or '',
        'likes': project.likes.count() if hasattr(project, 'likes') else 0,
        'categories': [cat.name for cat in project.categories.all()[:3]],
        'tools': [tool.name for tool in project.tools.all()[:5]],
        'url': f'/{project.user.username}/{project.slug}',
    }


@tool(args_schema=SearchProjectsInput)
def search_projects(
    query: str,
    category: str = '',
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Search for projects by keywords, category, or tags.

    Use this when the user wants to find projects about a specific topic,
    technology, or category.

    Examples:
    - "Find projects about LangGraph" -> query="LangGraph"
    - "Show me AI agent projects" -> query="AI agent"
    - "Projects in the Developer category" -> category="Developer & Coding"

    Returns a list of matching projects with their details.
    """
    from core.projects.models import Project

    logger.info(f'search_projects called: query={query}, category={category}, limit={limit}')

    # Clamp limit
    limit = max(1, min(10, limit))

    try:
        # Build base query
        queryset = (
            Project.objects.filter(
                is_private=False,
                is_showcased=True,
            )
            .select_related('user')
            .prefetch_related('categories', 'tools', 'likes')
        )

        # Apply search filter
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(tools__name__icontains=query)
                | Q(categories__name__icontains=query)
                | Q(topics__icontains=query)
            ).distinct()

        # Apply category filter
        if category:
            queryset = queryset.filter(categories__name__icontains=category).distinct()

        # Order by engagement
        queryset = queryset.annotate(like_count=Count('likes')).order_by('-like_count', '-created_at')

        # Get results
        projects = list(queryset[:limit])

        if not projects:
            return {
                'success': True,
                'count': 0,
                'projects': [],
                'message': f'No projects found matching "{query}"' + (f' in category "{category}"' if category else ''),
            }

        return {
            'success': True,
            'count': len(projects),
            'projects': [_format_project_for_agent(p) for p in projects],
            'message': f'Found {len(projects)} project(s) matching your search',
        }

    except Exception as e:
        logger.error(f'search_projects error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetRecommendationsInput)
def get_recommendations(
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Get personalized project recommendations for the user.

    Use this when the user asks for suggestions or wants to discover
    new projects based on their interests.

    Examples:
    - "What should I check out?"
    - "Recommend some projects for me"
    - "What's good based on my interests?"

    Returns personalized recommendations with explanations.
    """
    from core.projects.models import Project
    from services.personalization import PersonalizationEngine

    logger.info(f'get_recommendations called: limit={limit}, state={state}')

    # Clamp limit
    limit = max(1, min(10, limit))

    # Get user_id from state
    user_id = state.get('user_id') if state else None

    try:
        if user_id:
            # Use personalization engine for logged-in users
            from django.contrib.auth import get_user_model

            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
                engine = PersonalizationEngine()
                result = engine.get_for_you_feed(user=user, page=1, page_size=limit)

                projects = result.get('projects', [])
                if projects:
                    return {
                        'success': True,
                        'count': len(projects),
                        'personalized': True,
                        'projects': [_format_project_for_agent(p) for p in projects],
                        'message': f'Here are {len(projects)} personalized recommendations based on your interests',
                    }
            except User.DoesNotExist:
                pass

        # Fallback: return popular projects
        projects = list(
            Project.objects.filter(is_private=False, is_showcased=True)
            .select_related('user')
            .prefetch_related('categories', 'tools', 'likes')
            .annotate(like_count=Count('likes'))
            .order_by('-like_count', '-created_at')[:limit]
        )

        return {
            'success': True,
            'count': len(projects),
            'personalized': False,
            'projects': [_format_project_for_agent(p) for p in projects],
            'message': f'Here are {len(projects)} popular projects you might enjoy',
        }

    except Exception as e:
        logger.error(f'get_recommendations error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=FindSimilarInput)
def find_similar_projects(
    project_id: int,
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Find projects similar to a given project.

    Use this when the user likes a project and wants to find more like it.

    Examples:
    - "Show me more projects like this one"
    - "Find similar projects to project 123"
    - After showing a project: "More like this?"

    Returns projects with similar categories, tools, or content.
    """
    from core.projects.models import Project

    logger.info(f'find_similar_projects called: project_id={project_id}, limit={limit}')

    # Clamp limit
    limit = max(1, min(5, limit))

    try:
        # Get the source project
        try:
            source = Project.objects.prefetch_related('categories', 'tools').get(id=project_id)
        except Project.DoesNotExist:
            return {'success': False, 'error': f'Project {project_id} not found'}

        # Get categories and tools for similarity matching
        category_ids = list(source.categories.values_list('id', flat=True))
        tool_ids = list(source.tools.values_list('id', flat=True))

        # Find projects with overlapping categories or tools
        queryset = (
            Project.objects.filter(is_private=False, is_showcased=True)
            .exclude(id=project_id)
            .select_related('user')
            .prefetch_related('categories', 'tools', 'likes')
        )

        if category_ids or tool_ids:
            queryset = queryset.filter(Q(categories__id__in=category_ids) | Q(tools__id__in=tool_ids)).distinct()

        # Score by overlap and engagement
        queryset = queryset.annotate(like_count=Count('likes')).order_by('-like_count', '-created_at')

        projects = list(queryset[:limit])

        if not projects:
            return {
                'success': True,
                'count': 0,
                'source_project': source.title,
                'projects': [],
                'message': f'No similar projects found to "{source.title}"',
            }

        return {
            'success': True,
            'count': len(projects),
            'source_project': source.title,
            'projects': [_format_project_for_agent(p) for p in projects],
            'message': f'Found {len(projects)} project(s) similar to "{source.title}"',
        }

    except Exception as e:
        logger.error(f'find_similar_projects error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetTrendingInput)
def get_trending_projects(
    limit: int = 5,
    time_window: str = 'week',
    state: dict | None = None,
) -> dict:
    """
    Get trending projects based on recent engagement.

    Use this when the user asks about popular, hot, or trending projects.

    Examples:
    - "What's trending?"
    - "Show me popular projects"
    - "What's hot this week?"

    Returns projects with high recent engagement velocity.
    """
    from services.personalization import TrendingEngine

    logger.info(f'get_trending_projects called: limit={limit}, time_window={time_window}')

    # Clamp limit
    limit = max(1, min(10, limit))

    # Map time window to hours
    window_hours = {'day': 24, 'week': 168, 'month': 720}.get(time_window, 168)

    try:
        engine = TrendingEngine()
        result = engine.get_trending_feed(page=1, page_size=limit, time_window_hours=window_hours)

        projects = result.get('projects', [])

        if not projects:
            return {
                'success': True,
                'count': 0,
                'time_window': time_window,
                'projects': [],
                'message': f'No trending projects found for the past {time_window}',
            }

        return {
            'success': True,
            'count': len(projects),
            'time_window': time_window,
            'projects': [_format_project_for_agent(p) for p in projects],
            'message': f'Here are {len(projects)} trending project(s) from the past {time_window}',
        }

    except Exception as e:
        logger.error(f'get_trending_projects error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetProjectDetailsInput)
def get_project_details(
    project_id: int = 0,
    project_slug: str = '',
    project_title: str = '',
    state: dict | None = None,
) -> dict:
    """
    Get detailed information about a specific project.

    Use this when the user wants to learn more about a particular project.

    Examples:
    - "Tell me more about project 123"
    - "What is the claude-code project about?"
    - "Details on that first project"

    Returns comprehensive project information.
    """
    from core.projects.models import Project

    logger.info(f'get_project_details called: id={project_id}, slug={project_slug}, title={project_title}')

    try:
        project = None

        # Try to find by ID first
        if project_id:
            try:
                project = (
                    Project.objects.select_related('user')
                    .prefetch_related('categories', 'tools', 'likes')
                    .get(id=project_id)
                )
            except Project.DoesNotExist:
                pass

        # Try by slug
        if not project and project_slug:
            try:
                project = (
                    Project.objects.select_related('user')
                    .prefetch_related('categories', 'tools', 'likes')
                    .get(slug=project_slug, is_private=False)
                )
            except Project.DoesNotExist:
                pass

        # Try by title search
        if not project and project_title:
            project = (
                Project.objects.filter(title__icontains=project_title, is_private=False)
                .select_related('user')
                .prefetch_related('categories', 'tools', 'likes')
                .first()
            )

        if not project:
            return {
                'success': False,
                'error': 'Project not found. Try searching with different criteria.',
            }

        # Build detailed response
        content = project.content or {}

        return {
            'success': True,
            'project': {
                'id': project.id,
                'title': project.title,
                'slug': project.slug,
                'description': project.description,
                'type': project.type,
                'author': {
                    'username': project.user.username,
                    'name': project.user.get_full_name() or project.user.username,
                },
                'likes': project.likes.count(),
                'categories': [cat.name for cat in project.categories.all()],
                'tools': [tool.name for tool in project.tools.all()],
                'external_url': project.external_url or '',
                'created_at': project.created_at.isoformat(),
                'url': f'/{project.user.username}/{project.slug}',
                # Include GitHub info if available
                'github': content.get('github', {}),
            },
            'message': f'Here are the details for "{project.title}"',
        }

    except Exception as e:
        logger.error(f'get_project_details error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=UnifiedSearchInput)
def unified_search(
    query: str,
    content_types: list[str] | None = None,
    difficulty: str | None = None,
    limit: int = 10,
    state: dict | None = None,
) -> dict:
    """
    Search across all content types: projects, quizzes, tools, and lessons.

    Use this when the user wants to find content without specifying a type,
    or when searching across multiple types. This is the primary search tool
    for discovery.

    Examples:
    - "Find content about RAG" -> searches all types
    - "Beginner content about agents" -> difficulty="beginner"
    - "Quiz about LangGraph" -> content_types=["quiz"]
    - "Tools for image generation" -> content_types=["tool"]
    - "Learn about vector databases" -> auto-detects intent (lessons, projects)

    Returns ranked results from all matching content types.
    """
    from services.search import UnifiedSearchService

    logger.info(f'unified_search called: query={query}, types={content_types}, difficulty={difficulty}, limit={limit}')

    # Clamp limit
    limit = max(1, min(20, limit))

    # Get user_id from state for personalization
    user_id = state.get('user_id') if state else None

    try:
        service = UnifiedSearchService()
        response = service.search_sync(
            query=query,
            user_id=user_id,
            content_types=content_types,
            difficulty=difficulty,
            limit=limit,
        )

        if not response.results:
            return {
                'success': True,
                'count': 0,
                'results': [],
                'searched_types': response.searched_types,
                'detected_intent': response.detected_intent,
                'message': f'No content found matching "{query}"',
            }

        # Format results for agent
        formatted_results = []
        for result in response.results:
            formatted_results.append(
                {
                    'type': result.content_type,
                    'id': result.content_id,
                    'title': result.title,
                    'score': round(result.score, 3),
                    **result.metadata,
                }
            )

        return {
            'success': True,
            'count': response.total_count,
            'results': formatted_results,
            'searched_types': response.searched_types,
            'detected_intent': response.detected_intent,
            'search_time_ms': response.search_time_ms,
            'message': f'Found {response.total_count} result(s) across {", ".join(response.searched_types)}',
        }

    except Exception as e:
        logger.error(f'unified_search error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetRelatedContentInput)
def get_related_content(
    content_type: str,
    content_id: int | str,
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Get content related to a specific item via knowledge graph.

    Use this after the user engages with content to suggest "what's next"
    or to show similar content across all types.

    Examples:
    - After showing a project: "What else should I check out?"
    - "Show me more like this quiz"
    - "Related content to project 123"

    Returns similar content based on vector similarity.
    """
    import asyncio

    from services.search import UnifiedSearchService

    logger.info(f'get_related_content called: type={content_type}, id={content_id}, limit={limit}')

    # Validate content type
    valid_types = ['project', 'quiz', 'tool', 'micro_lesson']
    if content_type not in valid_types:
        return {
            'success': False,
            'error': f'Invalid content_type. Must be one of: {", ".join(valid_types)}',
        }

    # Clamp limit
    limit = max(1, min(10, limit))

    try:
        service = UnifiedSearchService()

        # Run async method synchronously with proper event loop handling
        try:
            loop = asyncio.get_running_loop()
            # Already in async context - use run_coroutine_threadsafe
            future = asyncio.run_coroutine_threadsafe(
                service.get_related_content(
                    content_type=content_type,
                    content_id=content_id,
                    limit=limit,
                ),
                loop,
            )
            results = future.result(timeout=30)
        except RuntimeError:
            # No running event loop - create a new one
            loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(loop)
                results = loop.run_until_complete(
                    service.get_related_content(
                        content_type=content_type,
                        content_id=content_id,
                        limit=limit,
                    )
                )
            finally:
                loop.close()
                asyncio.set_event_loop(None)

        if not results:
            return {
                'success': True,
                'count': 0,
                'source_type': content_type,
                'source_id': content_id,
                'results': [],
                'message': f'No related content found for {content_type} {content_id}',
            }

        # Format results for agent
        formatted_results = []
        for result in results:
            formatted_results.append(
                {
                    'type': result.content_type,
                    'id': result.content_id,
                    'title': result.title,
                    'similarity_score': round(result.score, 3),
                }
            )

        return {
            'success': True,
            'count': len(results),
            'source_type': content_type,
            'source_id': content_id,
            'results': formatted_results,
            'message': f'Found {len(results)} related item(s) to {content_type} {content_id}',
        }

    except Exception as e:
        logger.error(f'get_related_content error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


# ============================================================================
# Challenge & Connect Tools (for Feelings Not Features)
# ============================================================================


class GetCurrentChallengeInput(BaseModel):
    """Input for get_current_challenge tool."""

    model_config = {'extra': 'allow'}
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class FindPeopleToConnectInput(BaseModel):
    """Input for find_people_to_connect tool."""

    model_config = {'extra': 'allow'}
    limit: int = Field(default=5, description='Number of suggestions to return (1-10)')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


@tool(args_schema=GetCurrentChallengeInput)
def get_current_challenge(
    state: dict | None = None,
) -> dict:
    """
    Get the current weekly challenge to display inline in chat.

    Use this when the user asks about challenges or wants to participate.

    Examples:
    - "Show me this week's challenge"
    - "What challenges are active?"
    - "I want to join a challenge"

    Returns challenge details with user's participation status.
    """
    import time

    from django.core.cache import cache
    from django.db import models

    from core.challenges.models import WeeklyChallenge
    from core.logging_utils import StructuredLogger

    start = time.perf_counter()
    user_id = state.get('user_id') if state else None

    try:
        # Check cache first (2 min TTL for challenge data)
        cache_key = 'challenge:current'
        cached = cache.get(cache_key)

        if cached is not None:
            # Add user-specific status if user is logged in
            result = dict(cached)
            if user_id:
                result = _add_user_challenge_status(result, user_id)

            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.info(f'get_current_challenge: cache_hit=True, duration={elapsed_ms:.2f}ms')
            return result

        # Fetch from DB with optimized query
        challenge = (
            WeeklyChallenge.objects.filter(status__in=['active', 'voting', 'upcoming'])
            .select_related('theme')
            .prefetch_related('suggested_tools')
            .order_by(
                models.Case(
                    models.When(status='active', then=0),
                    models.When(status='voting', then=1),
                    models.When(status='upcoming', then=2),
                )
            )
            .first()
        )

        if not challenge:
            return {
                'has_challenge': False,
                'message': 'No active challenges right now. Check back soon!',
                'cta': {
                    'url': '/challenges',
                    'label': 'View Past Challenges',
                },
            }

        result = _serialize_challenge(challenge)
        cache.set(cache_key, result, 120)  # 2 min TTL

        # Add user-specific status if logged in
        if user_id:
            result = _add_user_challenge_status(result, user_id)

        elapsed_ms = (time.perf_counter() - start) * 1000
        StructuredLogger.log_service_operation(
            service_name='ChallengeTools',
            operation='get_current_challenge',
            success=True,
            duration_ms=elapsed_ms,
            metadata={'challenge_id': str(challenge.id), 'status': challenge.status},
            logger_instance=logger,
        )

        return result

    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to get current challenge',
            error=e,
            extra={'user_id': user_id},
            level='error',
            logger_instance=logger,
        )
        return {
            'has_challenge': False,
            'error': True,
            'message': 'Unable to load challenge data. Please try again.',
        }


def _serialize_challenge(challenge) -> dict:
    """Serialize challenge for tool response."""
    from django.utils import timezone

    # Calculate time remaining
    time_remaining = ''
    if challenge.submission_deadline:
        delta = challenge.submission_deadline - timezone.now()
        if delta.total_seconds() > 0:
            days = delta.days
            hours = delta.seconds // 3600
            if days > 0:
                time_remaining = f'{days} day{"s" if days != 1 else ""}, {hours} hour{"s" if hours != 1 else ""}'
            else:
                time_remaining = f'{hours} hour{"s" if hours != 1 else ""}'
        else:
            time_remaining = 'Ended'

    return {
        'has_challenge': True,
        'challenge': {
            'id': str(challenge.id),
            'title': challenge.title,
            'slug': challenge.slug,
            'description': challenge.description[:300] if challenge.description else '',
            'prompt': challenge.prompt[:200] if challenge.prompt else '',
            'status': challenge.status,
            'hero_image_url': challenge.hero_image_url or '',
            'theme_color': challenge.theme.color if challenge.theme else 'purple',
            'submission_deadline': challenge.submission_deadline.isoformat() if challenge.submission_deadline else None,
            'time_remaining': time_remaining,
            'participant_count': challenge.participant_count,
            'submission_count': challenge.submission_count,
            'points_config': {
                'submit': 50,
                'early_bird': 25,
                'vote_cast': 5,
            },
            'suggested_tools': [{'name': tool.name, 'slug': tool.slug} for tool in challenge.suggested_tools.all()[:5]],
        },
        'cta': {
            'url': f'/challenge/{challenge.slug}',
            'label': (
                'Join Challenge'
                if challenge.status == 'active'
                else 'Vote Now'
                if challenge.status == 'voting'
                else 'Learn More'
            ),
        },
    }


def _add_user_challenge_status(result: dict, user_id: int) -> dict:
    """Add user-specific status to challenge response."""
    from core.challenges.models import ChallengeSubmission

    if not result.get('has_challenge') or not result.get('challenge'):
        return result

    challenge_id = result['challenge']['id']

    try:
        submissions = ChallengeSubmission.objects.filter(
            challenge_id=challenge_id,
            user_id=user_id,
        )
        submission_count = submissions.count()

        result['user_status'] = {
            'has_submitted': submission_count > 0,
            'submission_count': submission_count,
            'can_submit_more': submission_count < 3,  # Assuming max 3 submissions
        }

        # Update CTA based on user status
        if submission_count > 0:
            if result['challenge']['status'] == 'voting':
                result['cta']['label'] = 'Vote Now'
            else:
                result['cta']['label'] = 'View My Submission'

    except Exception as e:
        logger.warning(f'Failed to get user challenge status: {e}')
        result['user_status'] = None

    return result


@tool(args_schema=FindPeopleToConnectInput)
def find_people_to_connect(
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Find people to follow based on shared interests, roles, and goals.

    Use this when the user wants to discover new people or expand their network.

    Examples:
    - "Help me connect with others"
    - "Find people to follow"
    - "Who should I connect with?"
    - "Suggest people with similar interests"

    Returns suggested creators with match reasons.
    """
    import time

    from core.logging_utils import StructuredLogger
    from core.users.services.recommendations import UserRecommendationService

    start = time.perf_counter()

    # Get user from state
    user_id = state.get('user_id') if state else None

    if not user_id:
        return {
            'has_suggestions': False,
            'suggestions': [],
            'message': 'Sign in to get personalized recommendations!',
            'cta': {
                'url': '/login',
                'label': 'Sign In',
            },
        }

    # Validate limit parameter
    limit = max(1, min(limit, 10))

    try:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.get(id=user_id)

        service = UserRecommendationService()
        result = service.get_connection_suggestions(user, limit=limit)

        elapsed_ms = (time.perf_counter() - start) * 1000
        StructuredLogger.log_service_operation(
            service_name='ConnectTools',
            operation='find_people_to_connect',
            user=user,
            success=True,
            duration_ms=elapsed_ms,
            metadata={
                'suggestions_count': len(result.get('suggestions', [])),
                'limit': limit,
            },
            logger_instance=logger,
        )

        return result

    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to find people to connect',
            error=e,
            extra={'user_id': user_id, 'limit': limit},
            level='error',
            logger_instance=logger,
        )
        return {
            'has_suggestions': False,
            'suggestions': [],
            'error': True,
            'message': 'Unable to find suggestions right now. Please try again.',
        }


# Tools that need state injection (for user context)
TOOLS_NEEDING_STATE = {
    'get_recommendations',
    'unified_search',
    'get_related_content',
    'get_current_challenge',
    'find_people_to_connect',
}

# All discovery tools
DISCOVERY_TOOLS = [
    search_projects,
    get_recommendations,
    find_similar_projects,
    get_trending_projects,
    get_project_details,
    unified_search,
    get_related_content,
    get_current_challenge,
    find_people_to_connect,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in DISCOVERY_TOOLS}
