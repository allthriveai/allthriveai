"""GitHub integration views - simple read-only endpoints."""

import asyncio
import logging

from django.db import IntegrityError
from django.utils import timezone
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.projects.models import Project
from services.github_ai_analyzer import analyze_github_repo
from services.github_constants import IMPORT_RATE_LIMIT
from services.github_helpers import (
    apply_ai_metadata,
    get_user_github_token,
    normalize_github_repo_data,
    parse_github_url,
)
from services.github_service import GitHubService

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_user_repos(request):
    """
    Fetch user's GitHub repositories using the GitHub MCP Server.

    This is a simple read-only endpoint that fetches the user's repos
    for display in the UI. The actual import happens via the agent's
    import_github_project tool.

    Returns:
        List of repositories with basic metadata
    """
    try:
        # Get user's GitHub token
        user_token = get_user_github_token(request.user)

        if not user_token:
            return Response(
                {
                    'success': False,
                    'error': 'GitHub not connected. Please connect your GitHub account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Fetch repos using GitHub REST API (simple approach)
        # We use REST here instead of MCP because we just need a simple list
        import requests

        headers = {
            'Authorization': f'token {user_token}',
            'Accept': 'application/vnd.github.v3+json',
        }

        # Fetch user's repos (sorted by updated, limited to 100)
        response = requests.get(
            'https://api.github.com/user/repos',
            headers=headers,
            params={
                'sort': 'updated',
                'per_page': 100,
                'affiliation': 'owner,collaborator',
            },
            timeout=10,
        )

        if response.status_code == 401:
            return Response(
                {
                    'success': False,
                    'error': 'GitHub token is invalid or expired. Please reconnect your GitHub account.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if response.status_code == 403:
            # Check for rate limiting
            if 'X-RateLimit-Remaining' in response.headers and response.headers['X-RateLimit-Remaining'] == '0':
                reset_time = response.headers.get('X-RateLimit-Reset', 'unknown')
                return Response(
                    {
                        'success': False,
                        'error': f'GitHub API rate limit exceeded. Resets at {reset_time}.',
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        response.raise_for_status()
        repos_data = response.json()

        # Transform to simpler format for frontend
        repos = []
        for repo in repos_data:
            repos.append(
                {
                    'name': repo['name'],
                    'fullName': repo['full_name'],
                    'description': repo['description'] or '',
                    'htmlUrl': repo['html_url'],
                    'language': repo['language'] or '',
                    'stars': repo['stargazers_count'],
                    'forks': repo['forks_count'],
                    'isPrivate': repo['private'],
                    'updatedAt': repo['updated_at'],
                }
            )

        return Response(
            {
                'success': True,
                'data': {
                    'repositories': repos,
                    'count': len(repos),
                },
            }
        )

    except requests.RequestException as e:
        logger.error(f'Failed to fetch GitHub repos: {e}')
        return Response(
            {
                'success': False,
                'error': 'Failed to fetch repositories from GitHub. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        logger.error(f'Unexpected error fetching GitHub repos: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@ratelimit(key='user', rate=IMPORT_RATE_LIMIT, method='POST')
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_github_repo(request):
    """
    Import a GitHub repository as a portfolio project.

    This endpoint handles the full import flow:
    1. Parse GitHub URL
    2. Fetch repo data via MCP
    3. Run AI analysis
    4. Create project with metadata

    Request body:
        {
            "url": "https://github.com/owner/repo",
            "is_showcase": true (optional, default: false)
        }

    Returns:
        {
            "success": true,
            "data": {
                "project_id": 123,
                "slug": "repo-name",
                "url": "/username/repo-name"
            }
        }
    """
    try:
        # Check rate limit
        if getattr(request, 'limited', False):
            return Response(
                {
                    'success': False,
                    'error': f'Rate limit exceeded. You can import up to {IMPORT_RATE_LIMIT} repositories.',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Get URL from request
        url = request.data.get('url')
        is_showcase = request.data.get('is_showcase', False)

        if not url:
            return Response(
                {'success': False, 'error': 'Repository URL is required'}, status=status.HTTP_400_BAD_REQUEST
            )

        # Parse GitHub URL
        try:
            owner, repo = parse_github_url(url)
        except ValueError as e:
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Get user's GitHub token
        user_token = get_user_github_token(request.user)

        if not user_token:
            return Response(
                {
                    'success': False,
                    'error': 'GitHub not connected. Please connect your GitHub account first.',
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Fetch repository data via GitHub REST API
        import time

        start_time = time.time()
        logger.info(f'Importing GitHub repo {owner}/{repo} for user {request.user.id}')

        github_service = GitHubService(user_token)
        fetch_start = time.time()
        repo_files = github_service.get_repository_info_sync(owner, repo)
        fetch_duration = time.time() - fetch_start
        logger.info(f'GitHub data fetch completed in {fetch_duration:.2f}s for {owner}/{repo}')

        # Normalize GitHub data (run async function in sync context)
        logger.debug(f'Normalizing GitHub data for {owner}/{repo}')
        repo_summary = asyncio.run(normalize_github_repo_data(owner, repo, url, repo_files))
        logger.debug(f'Normalized repo_summary: {repo_summary}')

        # Run AI analysis
        # Run AI analysis
        ai_start = time.time()
        analysis = analyze_github_repo(repo_data=repo_summary, readme_content=repo_files.get('readme', ''))
        ai_duration = time.time() - ai_start
        logger.info(f'AI analysis completed in {ai_duration:.2f}s for {owner}/{repo}')

        logger.info(
            f'AI analysis results for {owner}/{repo}: '
            f'description_length={len(analysis.get("description", ""))}, '
            f'hero_image={analysis.get("hero_image")}, hero_quote={bool(analysis.get("hero_quote"))}, '
            f'categories={len(analysis.get("category_ids", []))}, topics={len(analysis.get("topics", []))}'
        )
        logger.debug(f'Full analysis keys: {list(analysis.keys())}')
        logger.debug(f'Analysis hero_image value: "{analysis.get("hero_image")}"')
        logger.debug(f'Analysis description: {analysis.get("description", "")[:200]}...')

        # Create project with race condition protection
        # Set hero image from analysis (used as both banner and featured image)
        hero_image = analysis.get('hero_image', '')
        logger.debug(f'Setting hero_image for project: "{hero_image}" (type: {type(hero_image)})')

        try:
            project = Project.objects.create(
                user=request.user,
                title=repo_summary.get('name', repo),
                description=analysis.get('description', repo_summary.get('description', '')),
                type=Project.ProjectType.GITHUB_REPO,
                external_url=url,
                is_showcase=is_showcase,
                is_published=is_showcase,  # Publish showcase items immediately, keep playground items as drafts
                banner_url=hero_image or '',
                featured_image_url=hero_image or '',
                content={
                    'github': {
                        'owner': owner,
                        'repo': repo,
                        'stars': repo_summary.get('stargazers_count', 0),
                        'forks': repo_summary.get('forks_count', 0),
                        'language': repo_summary.get('language', ''),
                        'readme': repo_files.get('readme', ''),
                        'tree': repo_files.get('tree', []),
                        'dependencies': repo_files.get('dependencies', {}),
                        'tech_stack': repo_files.get('tech_stack', {}),
                        'analyzed_at': timezone.now().isoformat(),
                    },
                    'readme_blocks': analysis.get('readme_blocks', []),
                    'mermaid_diagrams': analysis.get('mermaid_diagrams', []),
                    'demo_urls': analysis.get('demo_urls', []),
                    'hero_quote': analysis.get('hero_quote', ''),
                    'generated_diagram': analysis.get('generated_diagram', ''),
                },
            )
        except IntegrityError:
            # Concurrent request created the same project - handle gracefully
            existing_project = Project.objects.get(user=request.user, external_url=url)
            logger.info(f'Race condition detected: project {existing_project.id} already exists for {url}')
            return Response(
                {
                    'success': False,
                    'error': 'You have already imported this repository.',
                    'data': {
                        'project_id': existing_project.id,
                        'slug': existing_project.slug,
                        'url': f'/{request.user.username}/{existing_project.slug}',
                    },
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Apply AI metadata
        apply_ai_metadata(project, analysis)

        total_duration = time.time() - start_time
        logger.info(
            f'Successfully imported GitHub repo {owner}/{repo} as project {project.id} '
            f'(total: {total_duration:.2f}s, fetch: {fetch_duration:.2f}s, ai: {ai_duration:.2f}s)'
        )

        return Response(
            {
                'success': True,
                'data': {
                    'project_id': project.id,
                    'slug': project.slug,
                    'url': f'/{request.user.username}/{project.slug}',
                },
            }
        )

    except Exception as e:
        logger.error(f'Failed to import GitHub repo: {e}', exc_info=True)

        # Return more detailed error in development
        from django.conf import settings

        error_detail = str(e) if settings.DEBUG else 'Failed to import repository. Please try again.'

        return Response(
            {
                'success': False,
                'error': error_detail,
                'error_type': type(e).__name__,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
