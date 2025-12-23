"""Helper functions for Figma integration."""

import logging
import re

from core.social.models import SocialConnection, SocialProvider

logger = logging.getLogger(__name__)


def parse_figma_url(url: str) -> dict | None:
    """
    Parse a Figma URL to extract file key or project ID.

    Supports formats:
    - https://www.figma.com/file/FILEKEY/filename
    - https://www.figma.com/design/FILEKEY/filename
    - https://www.figma.com/files/project/PROJECTID/projectname

    Returns dict with:
    - type: 'file' or 'project'
    - key: file key or project ID
    - name: optional name from URL
    """
    if not url:
        return None

    # File URL patterns
    file_patterns = [
        r'figma\.com/(?:file|design)/([a-zA-Z0-9]+)(?:/([^/?]+))?',
    ]

    for pattern in file_patterns:
        match = re.search(pattern, url)
        if match:
            return {
                'type': 'file',
                'key': match.group(1),
                'name': match.group(2) if match.lastindex >= 2 else None,
            }

    # Project URL pattern
    project_pattern = r'figma\.com/files/project/(\d+)(?:/([^/?]+))?'
    match = re.search(project_pattern, url)
    if match:
        return {
            'type': 'project',
            'key': match.group(1),
            'name': match.group(2) if match.lastindex >= 2 else None,
        }

    return None


def get_user_figma_token(user) -> str | None:
    """
    Get Figma access token for a user.

    Checks SocialConnection model first, then falls back to django-allauth's SocialToken.
    """
    try:
        # First, try our custom SocialConnection model
        connection = SocialConnection.objects.filter(
            user=user,
            provider=SocialProvider.FIGMA,
            is_active=True,
        ).first()

        if connection:
            # Check if token is expired
            if connection.is_token_expired():
                logger.warning(f'Figma token expired for user {user.id}')
                # TODO: Implement token refresh if Figma supports it
            else:
                logger.info(f'Found Figma token in SocialConnection for user {user.id}')
                return connection.access_token

        # Fallback: Check django-allauth's SocialToken model
        try:
            from allauth.socialaccount.models import SocialAccount, SocialToken

            social_account = SocialAccount.objects.filter(
                user=user,
                provider='figma',
            ).first()

            if social_account:
                token = SocialToken.objects.filter(account=social_account).first()
                if token and token.token:
                    logger.info(f'Found Figma token in allauth SocialToken for user {user.id}')
                    return token.token

        except Exception as e:
            logger.warning(f'Error checking allauth SocialToken: {e}')

        logger.warning(f'No Figma token found for user {user.id}')
        return None
    except Exception as e:
        logger.error(f'Error getting Figma token for user {user.id}: {e}')
        return None


def format_figma_file_for_frontend(file_data: dict, teams_data: dict = None) -> dict:
    """
    Format Figma file data for frontend display.

    Matches the format used by GitHub/GitLab for consistency.
    """
    return {
        'name': file_data.get('name', 'Untitled'),
        'key': file_data.get('key', ''),
        'thumbnailUrl': file_data.get('thumbnail_url', ''),
        'lastModified': file_data.get('last_modified', ''),
        'version': file_data.get('version', ''),
        # Additional Figma-specific fields
        'editorType': file_data.get('editor_type', 'figma'),  # 'figma', 'figjam', 'slides'
        'role': file_data.get('role', ''),  # 'owner', 'editor', 'viewer'
    }


def format_figma_project_for_frontend(project_data: dict) -> dict:
    """
    Format Figma project data for frontend display.
    """
    return {
        'id': project_data.get('id', ''),
        'name': project_data.get('name', 'Untitled Project'),
        'fileCount': len(project_data.get('files', [])),
    }


def extract_design_info(file_data: dict) -> dict:
    """
    Extract key design information from Figma file data.

    This includes:
    - Canvas/page names
    - Component count
    - Style information
    """
    document = file_data.get('document', {})
    components = file_data.get('components', {})
    styles = file_data.get('styles', {})

    # Get page names from document children
    pages = []
    for child in document.get('children', []):
        if child.get('type') == 'CANVAS':
            pages.append(
                {
                    'id': child.get('id'),
                    'name': child.get('name'),
                }
            )

    return {
        'pages': pages,
        'pageCount': len(pages),
        'componentCount': len(components),
        'styleCount': len(styles),
        'components': list(components.keys())[:10],  # First 10 component IDs
        'documentName': document.get('name', ''),
    }


def detect_design_type(file_data: dict) -> str:
    """
    Detect the type of Figma design based on content.

    Returns: 'ui_design', 'illustration', 'wireframe', 'prototype', 'design_system', etc.
    """
    editor_type = file_data.get('editor_type', 'figma')

    if editor_type == 'figjam':
        return 'whiteboard'
    elif editor_type == 'slides':
        return 'presentation'

    # Analyze components and structure
    components = file_data.get('components', {})
    component_count = len(components)

    if component_count > 50:
        return 'design_system'
    elif component_count > 10:
        return 'ui_design'
    else:
        return 'design'
