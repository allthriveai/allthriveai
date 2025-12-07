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

    limit: int = Field(default=5, description='Number of recommendations to return (1-10)')


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


def _format_project_for_agent(project) -> dict:
    """Format a project object for agent consumption."""
    return {
        'id': project.id,
        'title': project.title,
        'slug': project.slug,
        'description': project.description[:200] + '...' if len(project.description) > 200 else project.description,
        'type': project.type,
        'author': project.user.username,
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


# Tools that need state injection (for user context)
TOOLS_NEEDING_STATE = {'get_recommendations'}

# All discovery tools
DISCOVERY_TOOLS = [
    search_projects,
    get_recommendations,
    find_similar_projects,
    get_trending_projects,
    get_project_details,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in DISCOVERY_TOOLS}
