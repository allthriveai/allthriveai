"""LinkedIn integration views - API endpoints for LinkedIn data import."""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.integrations.linkedin.helpers import get_user_linkedin_token
from core.integrations.linkedin.service import LinkedInAPIError, LinkedInService

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_linkedin_profile(request):
    """
    Fetch the authenticated user's LinkedIn profile.

    Returns:
        {
            "success": true,
            "data": {
                "profile": {
                    "id": "abc123",
                    "first_name": "John",
                    "last_name": "Doe",
                    "full_name": "John Doe",
                    "email": "john@example.com",
                    "avatar_url": "https://...",
                    "profile_url": "https://linkedin.com/in/johndoe"
                }
            }
        }
    """
    try:
        # Get user's LinkedIn token
        token = get_user_linkedin_token(request.user)

        if not token:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn not connected. Please connect your LinkedIn account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Fetch profile using LinkedIn service
        service = LinkedInService(token)
        profile_data = service.fetch_profile_with_email()

        return Response(
            {
                'success': True,
                'data': {
                    'profile': profile_data,
                },
            }
        )

    except LinkedInAPIError as e:
        logger.error(f'LinkedIn API error fetching profile: {e}')

        if e.status_code == 401:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn token is invalid or expired. Please reconnect your LinkedIn account.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        elif e.status_code == 429:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn API rate limit exceeded. Please try again later.',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        else:
            return Response(
                {
                    'success': False,
                    'error': f'Failed to fetch LinkedIn profile: {e.message}',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    except Exception as e:
        logger.error(f'Unexpected error fetching LinkedIn profile: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_linkedin_posts(request):
    """
    Fetch the authenticated user's LinkedIn posts.

    Note: This requires LinkedIn Marketing Developer Platform access.
    Without it, this endpoint may return an empty list.

    Query parameters:
        count: Maximum number of posts to fetch (default: 50)

    Returns:
        {
            "success": true,
            "data": {
                "posts": [
                    {
                        "id": "post-123",
                        "text": "Post content...",
                        "created_time": 1702684800000,
                        "is_public": true
                    }
                ],
                "count": 10,
                "note": "..."  # If limited access
            }
        }
    """
    try:
        # Get user's LinkedIn token
        token = get_user_linkedin_token(request.user)

        if not token:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn not connected. Please connect your LinkedIn account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Get count parameter
        count = request.query_params.get('count', 50)
        try:
            count = min(int(count), 100)  # Cap at 100
        except (ValueError, TypeError):
            count = 50

        # Fetch posts using LinkedIn service
        service = LinkedInService(token)
        posts = service.fetch_posts(count=count)

        response_data = {
            'success': True,
            'data': {
                'posts': posts,
                'count': len(posts),
            },
        }

        # Add note if no posts returned (likely due to API limitations)
        if not posts:
            response_data['data']['note'] = (
                'No posts returned. This may be because reading posts requires '
                'LinkedIn Marketing Developer Platform access, which has additional requirements. '
                'See: https://docs.microsoft.com/en-us/linkedin/marketing/'
            )

        return Response(response_data)

    except LinkedInAPIError as e:
        logger.error(f'LinkedIn API error fetching posts: {e}')

        if e.status_code == 401:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn token is invalid or expired. Please reconnect your LinkedIn account.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        elif e.status_code == 403:
            # Access denied - likely missing Marketing Developer Platform access
            return Response(
                {
                    'success': True,
                    'data': {
                        'posts': [],
                        'count': 0,
                        'note': (
                            'Access to posts requires LinkedIn Marketing Developer Platform access. '
                            'Profile data is still available.'
                        ),
                    },
                }
            )
        elif e.status_code == 429:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn API rate limit exceeded. Please try again later.',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        else:
            return Response(
                {
                    'success': False,
                    'error': f'Failed to fetch LinkedIn posts: {e.message}',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    except Exception as e:
        logger.error(f'Unexpected error fetching LinkedIn posts: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_linkedin_content(request):
    """
    Import LinkedIn profile and posts as a portfolio project.

    Request body:
        {
            "is_showcase": true (optional, default: true),
            "is_private": false (optional, default: false)
        }

    Returns:
        {
            "success": true,
            "project": {
                "id": 123,
                "title": "LinkedIn: John Doe",
                "slug": "linkedin-john-doe",
                "url": "/johndoe/linkedin-john-doe"
            }
        }
    """
    try:
        from core.integrations.linkedin.integration import LinkedInIntegration

        is_showcase = request.data.get('is_showcase', True)
        is_private = request.data.get('is_private', False)

        # Use the integration class to import
        integration = LinkedInIntegration()

        # Construct profile URL for the user
        # We'll use their connected LinkedIn vanity name if available
        token = get_user_linkedin_token(request.user)
        if not token:
            return Response(
                {
                    'success': False,
                    'error': 'LinkedIn not connected. Please connect your LinkedIn account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Get profile to construct URL
        service = LinkedInService(token)
        profile = service.fetch_profile_with_email()
        vanity_name = profile.get('vanity_name', '')

        if vanity_name:
            url = f'https://www.linkedin.com/in/{vanity_name}'
        else:
            url = f'https://www.linkedin.com/in/{profile.get("id", "profile")}'

        # Import the content
        result = integration.import_project(
            user_id=request.user.id,
            url=url,
            is_showcase=is_showcase,
            is_private=is_private,
        )

        if result.get('success'):
            return Response(result)
        else:
            return Response(
                result,
                status=status.HTTP_400_BAD_REQUEST
                if result.get('error_code')
                else status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    except LinkedInAPIError as e:
        logger.error(f'LinkedIn API error during import: {e}')
        return Response(
            {
                'success': False,
                'error': f'LinkedIn API error: {e.message}',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    except Exception as e:
        logger.error(f'Unexpected error importing LinkedIn content: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
