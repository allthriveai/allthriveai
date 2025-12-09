"""Views for serving crawler-optimized pages."""

import logging
import os
from datetime import datetime

import bleach
import markdown
from django.conf import settings
from django.core.cache import cache
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.cache import cache_control
from django.views.decorators.vary import vary_on_headers
from django_ratelimit.decorators import ratelimit

from core.projects.models import Project
from core.tools.models import Tool
from core.users.models import User
from core.utils.crawler_detection import is_crawler, is_llm_crawler

logger = logging.getLogger(__name__)


def serve_react_or_crawler(request, template_name, context=None):
    """
    Helper function to serve either React app or crawler template.

    Args:
        request: Django request object
        template_name: Name of the crawler template (without crawler/ prefix)
        context: Context dictionary for the template

    Returns:
        Rendered response (either React or crawler template)
    """
    if context is None:
        context = {}

    # Add current year for footer
    context['current_year'] = datetime.now().year

    if is_crawler(request):
        # Log crawler traffic
        user_agent = request.headers.get('user-agent', '')[:200]
        logger.info(f'Crawler detected: {user_agent} - serving {template_name}')

        # Serve crawler-optimized template
        return render(request, f'crawler/{template_name}', context)
    else:
        # Serve React app for regular users
        # In development, the React dev server handles routing
        # In production, serve the built index.html from frontend/dist or staticfiles
        react_index_path = os.path.join(settings.BASE_DIR, 'frontend', 'index.html')

        try:
            with open(react_index_path) as f:
                html_content = f.read()
            return HttpResponse(html_content, content_type='text/html')
        except FileNotFoundError:
            # Fallback for production where index.html might be in staticfiles
            logger.warning(f'React index.html not found at {react_index_path}')
            # Try to import from templates if configured
            try:
                return render(request, 'index.html')
            except Exception as e:
                logger.error(f'Failed to serve React app: {e}')
                return HttpResponse('AllThrive AI is loading. Please visit the site directly.', status=503)


def _get_cached_response(cache_key, generator_func, ttl=900):
    """
    Helper to get cached response or generate new one.

    Args:
        cache_key: Unique cache key
        generator_func: Function to call if cache miss
        ttl: Time to live in seconds (default 15 minutes)

    Returns:
        Cached or generated response
    """
    cached = cache.get(cache_key)
    if cached:
        return cached

    response = generator_func()
    cache.set(cache_key, response, ttl)
    return response


@vary_on_headers('User-Agent')
@cache_control(public=True, max_age=900)  # 15 minutes
@ratelimit(key='header:user-agent', rate='100/h', method=['GET'])
def homepage_view(request):
    """Homepage - either React app or crawler template."""
    # Create cache key that includes crawler status
    is_bot = is_crawler(request)
    cache_key = f'homepage:{"crawler" if is_bot else "user"}:v1'

    def generate_response():
        return serve_react_or_crawler(request, 'home.html')

    return _get_cached_response(cache_key, generate_response)


@vary_on_headers('User-Agent')
@cache_control(public=True, max_age=900)
@ratelimit(key='header:user-agent', rate='100/h', method=['GET'])
def about_view(request):
    """About page - either React app or crawler template."""
    is_bot = is_crawler(request)
    cache_key = f'about:{"crawler" if is_bot else "user"}:v1'

    def generate_response():
        return serve_react_or_crawler(request, 'about.html')

    return _get_cached_response(cache_key, generate_response)


@vary_on_headers('User-Agent')
@cache_control(public=True, max_age=900)
@ratelimit(key='header:user-agent', rate='100/h', method=['GET'])
def explore_view(request):
    """Explore projects page - either React app or crawler template."""
    is_bot = is_crawler(request)

    # Differentiate cache by crawler type (LLM vs search engine)
    # to prevent cache collision where LLM crawlers get search engine results
    if is_bot:
        crawler_type = 'llm' if is_llm_crawler(request) else 'search'
        cache_key = f'explore:{crawler_type}:v1'
    else:
        cache_key = 'explore:user:v1'

    def generate_response():
        context = {}

        if is_bot:
            # Get featured/recent public projects for crawlers
            # Filter by owner's privacy settings
            try:
                projects_query = (
                    Project.objects.public_showcase().select_related('user').prefetch_related('tools', 'categories')
                )

                # For LLM crawlers, only show projects from users who allow LLM training
                if is_llm_crawler(request):
                    projects_query = projects_query.filter(user__allow_llm_training=True, user__is_profile_public=True)
                else:
                    # For traditional search engines, only check is_profile_public
                    projects_query = projects_query.filter(user__is_profile_public=True)

                projects = projects_query.order_by('-published_date')[:20]
                context['projects'] = list(projects)
            except Exception as e:
                logger.error(f'Failed to fetch projects for crawler: {e}')
                context['projects'] = []

        return serve_react_or_crawler(request, 'explore.html', context)

    return _get_cached_response(cache_key, generate_response)


@vary_on_headers('User-Agent')
@cache_control(public=True, max_age=900)
@ratelimit(key='header:user-agent', rate='100/h', method=['GET'])
def tools_directory_view(request):
    """Tools directory page - either React app or crawler template."""
    is_bot = is_crawler(request)
    cache_key = f'tools:{"crawler" if is_bot else "user"}:v1'

    def generate_response():
        context = {}

        if is_bot:
            # Get all active tools for crawlers
            try:
                tools = Tool.objects.filter(is_active=True).order_by('category', 'name')[:100]

                context['tools'] = list(tools)
            except Exception as e:
                logger.error(f'Failed to fetch tools for crawler: {e}')
                context['tools'] = []

        return serve_react_or_crawler(request, 'tools.html', context)

    return _get_cached_response(cache_key, generate_response)


def _sanitize_markdown_html(markdown_text):
    """
    Convert markdown to HTML and sanitize to prevent XSS.

    Args:
        markdown_text: Raw markdown content

    Returns:
        Sanitized HTML string
    """
    try:
        # Render markdown to HTML
        md = markdown.Markdown(
            extensions=[
                'fenced_code',
                'tables',
                'toc',
                'nl2br',
                'codehilite',
            ]
        )
        html = md.convert(markdown_text)

        # Sanitize HTML to prevent XSS
        allowed_tags = [
            'p',
            'br',
            'strong',
            'em',
            'u',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'blockquote',
            'code',
            'pre',
            'hr',
            'div',
            'span',
            'ul',
            'ol',
            'li',
            'a',
            'img',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'sup',
            'sub',
            'del',
            'ins',
        ]

        allowed_attrs = {
            'a': ['href', 'title', 'rel'],
            'img': ['src', 'alt', 'title', 'width', 'height'],
            'code': ['class'],  # For syntax highlighting
            'pre': ['class'],
            'div': ['class'],
            'span': ['class'],
            'td': ['colspan', 'rowspan'],
            'th': ['colspan', 'rowspan'],
        }

        # Use bleach to sanitize
        sanitized = bleach.clean(html, tags=allowed_tags, attributes=allowed_attrs, strip=True)

        # Also linkify URLs for safety
        sanitized = bleach.linkify(sanitized)

        return sanitized

    except Exception as e:
        logger.error(f'Failed to render markdown: {e}')
        return '<p>Content unavailable</p>'


@vary_on_headers('User-Agent')
@cache_control(public=True, max_age=900)
@ratelimit(key='header:user-agent', rate='200/h', method=['GET'])
def project_detail_view(request, username, slug):
    """
    Project detail page - either React app or crawler template.

    For crawlers, renders the project README as sanitized HTML.
    Respects project owner's privacy settings.
    """
    try:
        project = get_object_or_404(
            Project.objects.select_related('user').prefetch_related('tools', 'categories'),
            user__username=username,
            slug=slug,
        )
    except Http404:
        raise
    except Exception as e:
        logger.error(f'Error fetching project {username}/{slug}: {e}')
        raise Http404('Project not found') from e

    # Check if user has access
    if project.is_private:
        if not request.user.is_authenticated or request.user != project.user:
            raise Http404('Project not found')

    # Privacy checks for crawlers - respect project owner's settings
    if is_crawler(request):
        # Check if owner's profile is public (applies to ALL crawlers)
        if not project.user.is_profile_public:
            logger.info(f'Project owner {username} profile is private - blocking crawler')
            raise Http404('Project not available')

        # Check owner's LLM training opt-out (applies only to LLM crawlers)
        if is_llm_crawler(request) and not project.user.allow_llm_training:
            logger.info(f'Project owner {username} opted out of LLM training - blocking LLM crawler')
            raise Http404('Project not available for LLM indexing')

    is_bot = is_crawler(request)
    cache_key = f'project:{username}:{slug}:{"crawler" if is_bot else "user"}:v1'

    def generate_response():
        context = {
            'project': project,
        }

        if is_bot:
            # Render README markdown to sanitized HTML for crawlers
            readme_content = None

            try:
                # Extract README from content blocks
                if project.content and isinstance(project.content, dict):
                    blocks = project.content.get('blocks', [])
                    for block in blocks:
                        if block.get('type') == 'readme' and block.get('content'):
                            readme_md = block['content']
                            # Render and sanitize markdown
                            readme_content = _sanitize_markdown_html(readme_md)
                            break
            except Exception as e:
                logger.error(f'Failed to render README for {username}/{slug}: {e}')
                readme_content = '<p>README unavailable</p>'

            context['readme_content'] = readme_content

        return serve_react_or_crawler(request, 'project_detail.html', context)

    return _get_cached_response(cache_key, generate_response)


@vary_on_headers('User-Agent')
@cache_control(public=True, max_age=900)
@ratelimit(key='header:user-agent', rate='200/h', method=['GET'])
def profile_view(request, username):
    """
    User profile page - either React app or crawler template.

    For crawlers, shows user info and their public projects.
    Respects user privacy settings:
    - is_profile_public: Controls visibility to ALL crawlers
    - allow_llm_training: Controls visibility to LLM crawlers specifically
    """
    try:
        user = get_object_or_404(User, username=username)
    except Http404:
        raise
    except Exception as e:
        logger.error(f'Error fetching user profile {username}: {e}')
        raise Http404('User not found') from e

    # Privacy checks for crawlers
    if is_crawler(request):
        # Check if profile is public (applies to ALL crawlers)
        if not user.is_profile_public:
            logger.info(f'Profile {username} is private - blocking crawler')
            raise Http404('Profile is private')

        # Check LLM training opt-out (applies only to LLM crawlers)
        if is_llm_crawler(request) and not user.allow_llm_training:
            logger.info(f'Profile {username} opted out of LLM training - blocking LLM crawler')
            raise Http404('Profile not available for LLM indexing')

    is_bot = is_crawler(request)
    cache_key = f'profile:{username}:{"crawler" if is_bot else "user"}:v1'

    def generate_response():
        context = {
            'user': user,
        }

        if is_bot:
            try:
                # Get user's public projects for crawlers
                projects = (
                    Project.objects.filter(user=user, is_showcased=True, is_private=False, is_archived=False)
                    .select_related('user')
                    .prefetch_related('tools', 'categories')
                    .order_by('-published_date')
                )

                # Convert to list to avoid N+1 on .count()
                projects_list = list(projects)

                context['projects'] = projects_list
                context['projects_count'] = len(projects_list)  # Use len(), not .count()
            except Exception as e:
                logger.error(f'Failed to fetch projects for profile {username}: {e}')
                context['projects'] = []
                context['projects_count'] = 0

        return serve_react_or_crawler(request, 'profile.html', context)

    return _get_cached_response(cache_key, generate_response)
