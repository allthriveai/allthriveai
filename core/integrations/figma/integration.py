"""Figma integration implementation."""

import logging
from typing import TYPE_CHECKING, Any

import requests

if TYPE_CHECKING:
    from core.users.models import User

from core.integrations.base.exceptions import (
    IntegrationAuthError,
    IntegrationError,
    IntegrationNetworkError,
    IntegrationNotFoundError,
    IntegrationRateLimitError,
    IntegrationValidationError,
)
from core.integrations.base.integration import BaseIntegration
from core.integrations.figma.helpers import (
    detect_design_type,
    extract_design_info,
    get_user_figma_token,
    parse_figma_url,
)
from core.integrations.figma.service import FigmaService

logger = logging.getLogger(__name__)


class FigmaIntegration(BaseIntegration):
    """Figma design integration.

    Provides Figma-specific implementation for fetching design data,
    parsing URLs, and extracting design metadata.
    """

    @property
    def name(self) -> str:
        """Return integration name."""
        return 'figma'

    @property
    def display_name(self) -> str:
        """Return human-readable integration name."""
        return 'Figma'

    async def fetch_project_data(self, url: str, user: 'User | None' = None) -> dict[str, Any]:
        """Fetch Figma design data.

        Args:
            url: Figma file URL
            user: Optional Django User instance for authentication

        Returns:
            dict containing:
                - name: Design name
                - description: Design description
                - thumbnail_url: Preview image URL
                - pages: List of page info
                - components: Component count and info
                - styles: Style count and info

        Raises:
            IntegrationValidationError: If URL is invalid
            IntegrationAuthError: If authentication is required but not provided
            IntegrationNotFoundError: If file is not found
            IntegrationRateLimitError: If API rate limit exceeded
            IntegrationNetworkError: If network/connection issues occur
            IntegrationError: If other errors occur
        """
        # Parse and validate URL
        parsed = parse_figma_url(url)
        if not parsed:
            raise IntegrationValidationError(
                f'Invalid Figma URL: {url}',
                integration_name=self.name,
            )

        file_key = parsed['key']

        # Get user's Figma token
        token = None
        if user:
            token = get_user_figma_token(user)

        if not token:
            raise IntegrationAuthError(
                'Figma authentication required. Please connect your Figma account.',
                integration_name=self.name,
            )

        # Fetch file data via FigmaService
        try:
            figma_service = FigmaService(token)
            file_data = figma_service.get_file(file_key, depth=1)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                raise IntegrationNotFoundError(
                    f'Figma file not found: {file_key}',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            elif e.response.status_code == 401:
                raise IntegrationAuthError(
                    'Figma authentication required or invalid',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            elif e.response.status_code == 403:
                raise IntegrationAuthError(
                    'Access forbidden - check file permissions',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            elif e.response.status_code == 429:
                raise IntegrationRateLimitError(
                    'Figma API rate limit exceeded',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            else:
                raise IntegrationError(
                    f'Figma API error: HTTP {e.response.status_code}',
                    integration_name=self.name,
                    original_error=e,
                ) from e
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            raise IntegrationNetworkError(
                'Failed to connect to Figma API',
                integration_name=self.name,
                original_error=e,
            ) from e
        except Exception as e:
            logger.error(f'Unexpected error fetching Figma data for {file_key}: {e}', exc_info=True)
            raise IntegrationError(
                f'Failed to fetch design data: {str(e)}',
                integration_name=self.name,
                original_error=e,
            ) from e

        # Extract and return normalized data
        try:
            design_info = extract_design_info(file_data)
            design_type = detect_design_type(file_data)

            return {
                'name': file_data.get('name', 'Untitled'),
                'description': '',  # Figma files don't have built-in descriptions
                'thumbnail_url': file_data.get('thumbnailUrl', ''),
                'last_modified': file_data.get('lastModified', ''),
                'version': file_data.get('version', ''),
                'editor_type': file_data.get('editorType', 'figma'),
                'design_type': design_type,
                'file_key': file_key,
                'url': url,
                **design_info,
            }
        except Exception as e:
            logger.error(f'Error processing Figma data for {file_key}: {e}', exc_info=True)
            raise IntegrationError(
                'Failed to process design data',
                integration_name=self.name,
                original_error=e,
            ) from e

    def normalize_project_url(self, url: str) -> str:
        """Normalize Figma URL to standard format.

        Args:
            url: Raw Figma URL input

        Returns:
            Normalized URL (https://www.figma.com/file/KEY/name)

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        parsed = parse_figma_url(url)
        if not parsed:
            raise IntegrationValidationError(
                f'Invalid Figma URL: {url}',
                integration_name=self.name,
            )

        file_key = parsed['key']
        name = parsed.get('name', 'design')
        return f'https://www.figma.com/file/{file_key}/{name}'

    def extract_project_identifier(self, url: str) -> dict[str, str]:
        """Extract file key from Figma URL.

        Args:
            url: Figma file URL

        Returns:
            dict with 'file_key' and 'type' keys

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        parsed = parse_figma_url(url)
        if not parsed:
            raise IntegrationValidationError(
                f'Invalid Figma URL: {url}',
                integration_name=self.name,
            )

        return {
            'file_key': parsed['key'],
            'type': parsed['type'],
            'name': parsed.get('name', ''),
        }

    def supports_url(self, url: str) -> bool:
        """Check if URL is a Figma file URL.

        Args:
            url: URL to check

        Returns:
            True if URL is a valid Figma file URL
        """
        return parse_figma_url(url) is not None

    def import_project(self, user_id: int, url: str, **kwargs) -> dict[str, Any]:
        """Import a Figma design as a portfolio project.

        This is the main entry point for the generic import task.

        Args:
            user_id: ID of the user importing the project
            url: Figma file URL
            **kwargs: Additional options (is_showcase, is_private)

        Returns:
            dict with import result
        """
        from django.contrib.auth import get_user_model

        from core.integrations.utils import (
            IntegrationErrorCode,
            check_duplicate_project,
        )
        from core.projects.models import Project

        User = get_user_model()

        is_showcased = kwargs.get('is_showcased', kwargs.get('is_showcase', True))
        is_private = kwargs.get('is_private', True)

        try:
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.error(f'User {user_id} not found for Figma import')
                return {
                    'success': False,
                    'error': 'User account not found',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                }

            # Parse Figma URL
            parsed = parse_figma_url(url)
            if not parsed:
                return {
                    'success': False,
                    'error': 'Invalid Figma URL',
                    'error_code': IntegrationErrorCode.INVALID_URL,
                    'suggestion': 'Make sure the URL follows this format: https://www.figma.com/file/KEY/name',
                }

            file_key = parsed['key']

            # Check for duplicate
            existing_project = check_duplicate_project(user, url)
            if existing_project:
                project_url = f'/{user.username}/{existing_project.slug}'
                return {
                    'success': False,
                    'error': f'This design is already in your portfolio as "{existing_project.title}"',
                    'error_code': IntegrationErrorCode.DUPLICATE_IMPORT,
                    'suggestion': 'View your existing project or delete it before re-importing.',
                    'project': {
                        'id': existing_project.id,
                        'title': existing_project.title,
                        'slug': existing_project.slug,
                        'url': project_url,
                    },
                }

            # Get Figma token
            user_token = get_user_figma_token(user)
            if not user_token:
                return {
                    'success': False,
                    'error': 'Figma account is not connected',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                    'suggestion': 'Please connect your Figma account in settings and try again.',
                }

            # Fetch file data
            try:
                figma_service = FigmaService(user_token)
                file_data = figma_service.get_file(file_key, depth=1)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 404:
                    return {
                        'success': False,
                        'error': f'Figma file not found: {file_key}',
                        'error_code': IntegrationErrorCode.NOT_FOUND,
                        'suggestion': 'Make sure the file exists and you have access to it.',
                    }
                elif e.response.status_code == 429:
                    return {
                        'success': False,
                        'error': 'Figma API rate limit exceeded',
                        'error_code': IntegrationErrorCode.RATE_LIMIT_EXCEEDED,
                        'suggestion': 'Please try again in a few minutes.',
                    }
                else:
                    logger.error(f'Figma API error: {e}')
                    raise
            except Exception as e:
                logger.error(f'Error fetching Figma data: {e}')
                raise

            # Extract design info
            design_info = extract_design_info(file_data)
            design_type = detect_design_type(file_data)
            file_name = file_data.get('name', 'Untitled Design')
            thumbnail_url = file_data.get('thumbnailUrl', '')

            # Export a high-quality image for featured image
            featured_image_url = thumbnail_url
            try:
                # Find the best node to export as featured image
                # Priority: First significant frame on first page > First page thumbnail
                document = file_data.get('document', {})
                first_page = None
                target_node_id = None

                for child in document.get('children', []):
                    if child.get('type') == 'CANVAS':
                        first_page = child
                        break

                if first_page:
                    # Look for frames/artboards within the page (these are the actual designs)
                    page_children = first_page.get('children', [])
                    best_frame = None

                    for frame in page_children:
                        frame_type = frame.get('type', '')
                        # Look for FRAME, COMPONENT, or COMPONENT_SET (actual design content)
                        if frame_type in ('FRAME', 'COMPONENT', 'COMPONENT_SET'):
                            # Prefer larger frames (likely main content, not small components)
                            abs_box = frame.get('absoluteBoundingBox', {})
                            width = abs_box.get('width', 0)
                            height = abs_box.get('height', 0)

                            # Skip very small frames (likely icons or small components)
                            if width >= 200 and height >= 200:
                                if best_frame is None:
                                    best_frame = frame
                                else:
                                    # Prefer the first large frame we find
                                    break

                    if best_frame:
                        target_node_id = best_frame.get('id')
                        logger.info(f'Using frame "{best_frame.get("name")}" for featured image')
                    else:
                        # Fall back to first page if no suitable frame found
                        target_node_id = first_page['id']
                        logger.info('Using first page for featured image (no suitable frame found)')

                if target_node_id:
                    # Export at higher scale (3x) for better quality
                    images_data = figma_service.get_file_images(
                        file_key,
                        node_ids=[target_node_id],
                        scale=3,  # Higher scale for better quality
                        format='png',
                    )
                    images = images_data.get('images', {})
                    if target_node_id in images:
                        featured_image_url = images[target_node_id]
                        logger.info('Exported featured image at 3x scale')
            except Exception as e:
                logger.warning(f'Failed to export featured image: {e}')

            # Create description from design info - include file name for context
            description_parts = []
            if design_info.get('pageCount'):
                description_parts.append(f'{design_info["pageCount"]} pages')
            if design_info.get('componentCount'):
                description_parts.append(f'{design_info["componentCount"]} components')
            if design_info.get('styleCount'):
                description_parts.append(f'{design_info["styleCount"]} styles')

            # Create a meaningful description that references the actual project
            design_type_display = design_type.replace('_', ' ')
            if description_parts:
                description = f'{file_name} - a {design_type_display} featuring ' + ', '.join(description_parts)
            else:
                description = f'{file_name} - a {design_type_display} created in Figma'

            # Create project with pending analysis status
            logger.info(f'Creating project for Figma file: {file_name}')
            new_project = Project.objects.create(
                user=user,
                title=file_name,
                description=description,
                type=Project.ProjectType.FIGMA_DESIGN,
                external_url=url,
                is_showcased=is_showcased,
                is_private=is_private,
                banner_url='',
                featured_image_url=featured_image_url,
                content={
                    'figma': {
                        'file_key': file_key,
                        'editor_type': file_data.get('editorType', 'figma'),
                        'design_type': design_type,
                        'pages': design_info.get('pages', []),
                        'page_count': design_info.get('pageCount', 0),
                        'component_count': design_info.get('componentCount', 0),
                        'style_count': design_info.get('styleCount', 0),
                        'version': file_data.get('version', ''),
                        'last_modified': file_data.get('lastModified', ''),
                        'analysis_status': 'pending',  # Mark for async analysis
                    },
                    'blocks': [
                        {
                            'type': 'hero_image',
                            'image_url': featured_image_url,
                        },
                        {
                            'type': 'overview',
                            'title': 'About this Design',
                            'content': description,
                        },
                    ],
                },
            )

            logger.info(f'Successfully imported Figma file {file_key} as project {new_project.id}')

            # Trigger async MCP analysis to populate rich project details
            try:
                from core.projects.tasks import analyze_project_with_mcp

                analyze_project_with_mcp.delay(new_project.id)
                logger.info(f'Triggered MCP analysis for project {new_project.id}')
            except Exception as e:
                logger.warning(f'Failed to trigger MCP analysis for project {new_project.id}: {e}')

            project_url = f'/{user.username}/{new_project.slug}'
            return {
                'success': True,
                'message': f'Successfully imported {file_name}!',
                'project': {
                    'id': new_project.id,
                    'title': new_project.title,
                    'slug': new_project.slug,
                    'url': project_url,
                },
            }

        except Exception as e:
            logger.error(f'Failed to import Figma file: {e}', exc_info=True)
            raise  # Re-raise for Celery retry

    def get_oauth_url(self) -> str:
        """Get OAuth connection URL for Figma.

        Returns:
            str: OAuth URL via social connect endpoint
        """
        return '/api/social/connect/figma/'
