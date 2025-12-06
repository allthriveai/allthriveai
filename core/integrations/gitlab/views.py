"""GitLab integration views - simple read-only endpoints.

These views handle listing GitLab projects for the user.
"""

import logging

import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.integrations.gitlab.helpers import get_user_gitlab_token

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_user_projects(request):
    """
    Fetch user's GitLab projects.

    This is a simple read-only endpoint that fetches the user's projects
    for display in the UI. The actual import happens via the agent's
    import tool.

    Returns:
        List of projects with basic metadata
    """
    try:
        # Get user's GitLab token
        user_token = get_user_gitlab_token(request.user)

        if not user_token:
            return Response(
                {
                    'success': False,
                    'error': 'GitLab not connected. Please connect your GitLab account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Fetch projects using GitLab REST API
        headers = {
            'Authorization': f'Bearer {user_token}',
            'Accept': 'application/json',
        }

        # Fetch user's projects (sorted by updated, limited to 100)
        response = requests.get(
            'https://gitlab.com/api/v4/projects',
            headers=headers,
            params={
                'membership': 'true',  # Only projects user is a member of
                'order_by': 'last_activity_at',
                'sort': 'desc',
                'per_page': 100,
                'simple': 'true',  # Return only basic fields
            },
            timeout=10,
        )

        if response.status_code == 401:
            return Response(
                {
                    'success': False,
                    'error': 'GitLab token is invalid or expired. Please reconnect your GitLab account.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if response.status_code == 403:
            # Check for rate limiting
            if 'RateLimit-Remaining' in response.headers and response.headers['RateLimit-Remaining'] == '0':
                reset_time = response.headers.get('RateLimit-Reset', 'unknown')
                return Response(
                    {
                        'success': False,
                        'error': f'GitLab API rate limit exceeded. Resets at {reset_time}.',
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        response.raise_for_status()
        projects_data = response.json()

        # Transform to simpler format for frontend (matching GitHub format)
        projects = []
        for project in projects_data:
            # Get primary language from languages if available
            language = ''

            projects.append(
                {
                    'name': project['name'],
                    'fullName': project['path_with_namespace'],
                    'description': project.get('description') or '',
                    'htmlUrl': project['web_url'],
                    'language': language,
                    'stars': project.get('star_count', 0),
                    'forks': project.get('forks_count', 0),
                    'isPrivate': project.get('visibility', 'public') == 'private',
                    'updatedAt': project.get('last_activity_at', ''),
                    # GitLab-specific fields
                    'namespace': project.get('namespace', {}).get('full_path', ''),
                    'avatarUrl': project.get('avatar_url', ''),
                }
            )

        return Response(
            {
                'success': True,
                'data': {
                    'repositories': projects,  # Use 'repositories' to match GitHub frontend
                    'count': len(projects),
                },
            }
        )

    except requests.RequestException as e:
        logger.error(f'Failed to fetch GitLab projects: {e}')
        return Response(
            {
                'success': False,
                'error': 'Failed to fetch projects from GitLab. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        logger.error(f'Unexpected error fetching GitLab projects: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
