"""
AllThrive Web Clipper Extension API

Provides endpoints for:
- Extension authentication via token
- Project creation from clipped content
- Token verification
"""

import logging
import secrets

from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.projects.models import Project
from core.taxonomy.models import Taxonomy
from core.users.models import User

logger = logging.getLogger(__name__)

# Extension token expiry (30 days)
EXTENSION_TOKEN_EXPIRY_DAYS = 30


@api_view(['GET'])
@permission_classes([AllowAny])
def extension_auth_page(request):
    """Auth page that user opens from extension to login.

    If user is already authenticated, generates a token and redirects to callback.
    Otherwise, redirects to login page with extension return URL.
    """
    if request.user.is_authenticated:
        # Generate extension token
        token = generate_extension_token_internal(request.user)

        # Build callback URL with token and user data
        user_data = {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'fullName': request.user.get_full_name(),
            'avatarUrl': request.user.avatar_url,
        }

        import json
        from urllib.parse import urlencode

        # URL-encode the user data to handle special characters
        params = urlencode({'token': token, 'user': json.dumps(user_data)})
        callback_url = f'/api/v1/extension/auth/callback/?{params}'
        return HttpResponseRedirect(callback_url)

    # Not authenticated - redirect to frontend login with return URL
    # The frontend runs on port 3000 in development
    from django.conf import settings

    frontend_url = settings.FRONTEND_URL
    backend_url = settings.BACKEND_URL
    login_url = f'{frontend_url}/login?next={backend_url}/api/v1/extension/auth/'
    return HttpResponseRedirect(login_url)


@api_view(['GET'])
@permission_classes([AllowAny])
def extension_auth_callback(request):
    """Callback page that the extension listens for.

    This page contains the token and user data in the URL.
    The extension's background script monitors for this URL.
    """
    # This is a simple page that the extension will detect
    # and extract the token from the URL parameters
    return Response(
        {
            'message': 'Authentication successful. You can close this tab.',
            'status': 'success',
        }
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_extension_token(request):
    """Verify an extension token is valid.

    Used by the extension to check if the stored token is still valid.
    """
    auth_header = request.headers.get('Authorization', '')

    if not auth_header.startswith('Bearer '):
        return Response({'valid': False, 'error': 'Invalid token format'}, status=401)

    token = auth_header.split(' ')[1]

    # Look up token in cache
    from django.core.cache import cache

    cache_key = f'extension_token:{token}'
    token_data = cache.get(cache_key)

    if not token_data:
        return Response({'valid': False, 'error': 'Token not found or expired'}, status=401)

    # Check expiry
    expiry = timezone.datetime.fromisoformat(token_data['expires_at'])
    if timezone.now() > expiry:
        cache.delete(cache_key)
        return Response({'valid': False, 'error': 'Token expired'}, status=401)

    # Get user
    try:
        user = User.objects.get(id=token_data['user_id'])
        return Response(
            {
                'valid': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'fullName': user.get_full_name(),
                    'avatarUrl': user.avatar_url,
                },
            }
        )
    except User.DoesNotExist:
        cache.delete(cache_key)
        return Response({'valid': False, 'error': 'User not found'}, status=401)


def get_user_from_extension_token(request) -> User | None:
    """Get user from extension token in Authorization header."""
    auth_header = request.headers.get('Authorization', '')

    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ')[1]

    from django.core.cache import cache

    cache_key = f'extension_token:{token}'
    token_data = cache.get(cache_key)

    if not token_data:
        return None

    # Check expiry
    expiry = timezone.datetime.fromisoformat(token_data['expires_at'])
    if timezone.now() > expiry:
        cache.delete(cache_key)
        return None

    try:
        return User.objects.get(id=token_data['user_id'])
    except User.DoesNotExist:
        return None


@api_view(['POST'])
@permission_classes([AllowAny])
def create_clipped_project(request):
    """Create a project from clipped content.

    Expected payload:
    {
        "title": "Project title",
        "description": "Optional description",
        "content": "Markdown content",
        "sourceUrl": "https://...",
        "projectType": "ai_conversation",
        "images": ["url1", "url2"],
        "tags": ["tag1", "tag2"],
        "visibility": "public"
    }
    """
    # Get user from extension token
    user = get_user_from_extension_token(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=401)

    # Validate required fields
    title = request.data.get('title', '').strip()
    if not title:
        return Response({'error': 'Title is required'}, status=400)

    content = request.data.get('content', '').strip()
    if not content:
        return Response({'error': 'Content is required'}, status=400)

    source_url = request.data.get('sourceUrl', '')
    description = request.data.get('description', '')
    images = request.data.get('images', [])
    tags = request.data.get('tags', [])
    category_slugs = request.data.get('categories', [])
    visibility = request.data.get('visibility', 'public')

    try:
        # Create the project
        project = Project.objects.create(
            user=user,
            title=title[:200],  # Limit title length
            description=description[:500] if description else '',
            content=content,
            type=Project.ProjectType.PROMPT,  # Default to Prompt for clipped content
            external_url=source_url[:500] if source_url else '',
            is_private=visibility == 'private',
            is_showcased=True,  # Auto-showcase clipped projects
            topics=tags[:15] if tags else [],  # Limit to 15 tags
        )

        # Handle categories
        if category_slugs:
            categories = Taxonomy.objects.filter(
                slug__in=category_slugs,
                taxonomy_type='category',
                is_active=True,
            )
            project.categories.set(categories)

        # Handle images - store first image as featured
        if images and len(images) > 0:
            project.featured_image_url = images[0]
            project.save()

        # Log successful clip
        logger.info(f'Extension clip: User {user.username} clipped from {source_url}')

        return Response(
            {
                'success': True,
                'project': {
                    'id': project.id,
                    'slug': project.slug,
                    'url': f'/{user.username}/{project.slug}',
                    'title': project.title,
                },
            },
            status=201,
        )

    except Exception as e:
        logger.error(f'Extension clip error: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'Failed to create project. Please try again.',
            },
            status=500,
        )


@api_view(['POST'])
def generate_extension_token(request):
    """Generate an extension token for the authenticated user.

    This endpoint is called by the frontend ExtensionAuthPage when the user
    is already authenticated. It returns a token that the extension stores.
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=401)

    token = generate_extension_token_internal(request.user)
    return Response({'token': token})


def generate_extension_token_internal(user: User) -> str:
    """Generate a secure token for the browser extension.

    Stores the token in the user's profile for verification.
    """
    token = secrets.token_urlsafe(32)

    # Store token with expiry in cache
    expiry = timezone.now() + timezone.timedelta(days=EXTENSION_TOKEN_EXPIRY_DAYS)

    from django.core.cache import cache

    cache_key = f'extension_token:{token}'
    cache.set(
        cache_key,
        {
            'user_id': user.id,
            'created_at': timezone.now().isoformat(),
            'expires_at': expiry.isoformat(),
        },
        timeout=EXTENSION_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    )

    return token


@api_view(['GET'])
@permission_classes([AllowAny])
def extension_user_info(request):
    """Get current user info for extension.

    Uses extension token authentication.
    """
    user = get_user_from_extension_token(request)
    if not user:
        return Response({'error': 'Not authenticated'}, status=401)

    return Response(
        {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'fullName': user.get_full_name(),
            'avatarUrl': user.avatar_url,
        }
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def extension_categories(request):
    """Get available categories for the extension dropdown.

    Returns all active categories that can be assigned to projects.
    """
    categories = Taxonomy.objects.filter(
        taxonomy_type='category',
        is_active=True,
    ).order_by('name')

    return Response(
        [
            {
                'slug': cat.slug,
                'name': cat.name,
            }
            for cat in categories
        ]
    )
