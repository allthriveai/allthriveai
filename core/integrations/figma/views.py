"""Figma integration views - simple read-only endpoints.

These views handle listing Figma files for the user.
"""

import logging

import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.integrations.figma.helpers import get_user_figma_token
from core.integrations.figma.service import FigmaService

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_user_files(request):
    """
    Fetch user's Figma files.

    This is a simple read-only endpoint that fetches the user's files
    for display in the UI. The actual import happens via the agent's
    import tool.

    Returns:
        List of files with basic metadata
    """
    try:
        # Get user's Figma token
        user_token = get_user_figma_token(request.user)

        if not user_token:
            return Response(
                {
                    'success': False,
                    'error': 'Figma not connected. Please connect your Figma account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Initialize Figma service
        figma_service = FigmaService(user_token)

        # Get user info first to verify connection
        try:
            user_info = figma_service.get_current_user()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                return Response(
                    {
                        'success': False,
                        'error': 'Figma token is invalid or expired. Please reconnect your Figma account.',
                        'connected': False,
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            raise

        # Get user's files
        # Note: Figma API requires team/project context to list files
        # For now, we'll return user info and let the chat guide them
        # to paste specific file URLs

        return Response(
            {
                'success': True,
                'data': {
                    'user': {
                        'id': user_info.get('id', ''),
                        'email': user_info.get('email', ''),
                        'handle': user_info.get('handle', ''),
                        'img_url': user_info.get('img_url', ''),
                    },
                    'files': [],  # Figma API requires team context for file listing
                    'message': 'Connected! Paste a Figma file URL to import your design.',
                },
            }
        )

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            return Response(
                {
                    'success': False,
                    'error': 'Figma API rate limit exceeded. Please try again later.',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        logger.error(f'Failed to fetch Figma user info: {e}')
        return Response(
            {
                'success': False,
                'error': 'Failed to connect to Figma. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except requests.RequestException as e:
        logger.error(f'Failed to fetch Figma files: {e}')
        return Response(
            {
                'success': False,
                'error': 'Failed to fetch files from Figma. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        logger.error(f'Unexpected error fetching Figma files: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_file_preview(request, file_key: str):
    """
    Get preview information for a specific Figma file.

    Args:
        file_key: The Figma file key from the URL

    Returns:
        File metadata including name, thumbnail, and page count
    """
    try:
        # Get user's Figma token
        user_token = get_user_figma_token(request.user)

        if not user_token:
            return Response(
                {
                    'success': False,
                    'error': 'Figma not connected. Please connect your Figma account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Initialize Figma service
        figma_service = FigmaService(user_token)

        # Get file metadata (minimal depth to reduce response size)
        file_data = figma_service.get_file(file_key, depth=1)

        # Count pages
        document = file_data.get('document', {})
        pages = [c for c in document.get('children', []) if c.get('type') == 'CANVAS']

        return Response(
            {
                'success': True,
                'data': {
                    'name': file_data.get('name', 'Untitled'),
                    'thumbnailUrl': file_data.get('thumbnailUrl', ''),
                    'lastModified': file_data.get('lastModified', ''),
                    'version': file_data.get('version', ''),
                    'editorType': file_data.get('editorType', 'figma'),
                    'pageCount': len(pages),
                    'pages': [{'id': p['id'], 'name': p['name']} for p in pages[:10]],
                },
            }
        )

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return Response(
                {
                    'success': False,
                    'error': 'File not found. Make sure you have access to this file.',
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        elif e.response.status_code == 401:
            return Response(
                {
                    'success': False,
                    'error': 'Figma token is invalid or expired. Please reconnect.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        elif e.response.status_code == 403:
            return Response(
                {
                    'success': False,
                    'error': 'You do not have access to this file.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        elif e.response.status_code == 429:
            return Response(
                {
                    'success': False,
                    'error': 'Figma API rate limit exceeded. Please try again later.',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        logger.error(f'Failed to fetch Figma file: {e}')
        return Response(
            {
                'success': False,
                'error': 'Failed to fetch file from Figma.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        logger.error(f'Unexpected error fetching Figma file: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
