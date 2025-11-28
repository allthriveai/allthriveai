"""
Figma MCP Analyzer
Analyzes Figma designs using the Figma MCP Server via FastMCP
"""

import logging
import re
from datetime import datetime
from typing import Any

from django.conf import settings

from core.projects.models import Project
from core.social.models import SocialConnection, SocialProvider
from services.analyzers.base import MCPAnalyzer
from services.mcp.client_factory import MCPClientFactory

logger = logging.getLogger(__name__)


class FigmaAnalyzer(MCPAnalyzer):
    """Analyzes Figma designs using Figma MCP Server via FastMCP."""

    def __init__(self, project_id: int):
        """
        Initialize Figma analyzer.

        Args:
            project_id: ID of the project to analyze
        """
        super().__init__(project_id)
        self.project = Project.objects.get(id=project_id)
        self.user = self.project.user
        self.user_token = self._get_user_figma_token()
        self.file_key = None
        self._parse_figma_url()

    def _get_user_figma_token(self) -> str | None:
        """
        Get user's Figma OAuth token.

        Retrieves the user's personal access token from SocialConnection.

        Returns:
            User's Figma access token or None if not connected
        """
        try:
            connection = SocialConnection.objects.get(user=self.user, provider=SocialProvider.FIGMA, is_active=True)
            logger.info(f'Using Figma OAuth token for user {self.user.id}')
            return connection.access_token  # This uses the property that decrypts the token
        except SocialConnection.DoesNotExist:
            logger.warning(f'No Figma connection found for user {self.user.id}')
            return None

    def _parse_figma_url(self):
        """Parse Figma URL from project.external_url to extract file key."""
        if not self.project.external_url:
            raise ValueError('Project has no external_url set')

        # Match figma.com/file/{file_key} or figma.com/design/{file_key}
        pattern = r'figma\.com/(file|design)/([A-Za-z0-9]+)'
        match = re.search(pattern, self.project.external_url)

        if not match:
            raise ValueError(f'Invalid Figma URL: {self.project.external_url}')

        self.file_key = match.group(2)
        logger.info(f'Parsed Figma URL: file_key={self.file_key}')

    async def validate_source(self) -> tuple[bool, str | None]:
        """
        Validate that the Figma file is accessible.

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if user has Figma connected
        if not self.user_token:
            return False, 'Figma account not connected. Please connect your Figma account in settings.'

        try:
            factory = MCPClientFactory(settings.MCP_SERVERS)
            client = factory.create_figma_client(user_token=self.user_token)

            async with client:
                # Try to get file metadata
                result = await client.call_tool('figma', 'figma_get_file', arguments={'file_key': self.file_key})

                if result.get('isError'):
                    error_msg = result.get('content', [{}])[0].get('text', 'Unknown error')
                    return False, f'Figma file not accessible: {error_msg}'

                return True, None

        except Exception as e:
            logger.error(f'Failed to validate Figma file {self.file_key}: {e}')
            return False, str(e)

    async def analyze(self) -> dict[str, Any]:
        """
        Run comprehensive Figma design analysis using MCP.

        Returns:
            Dictionary with analysis results
        """
        # Check if user has Figma connected
        if not self.user_token:
            return {
                'status': 'error',
                'error': 'Figma account not connected. Please connect your Figma account in settings.',
                'analyzed_at': datetime.utcnow().isoformat(),
            }

        try:
            factory = MCPClientFactory(settings.MCP_SERVERS)
            client = factory.create_figma_client(user_token=self.user_token)

            async with client:
                # Get file metadata
                file_info = await self._get_file_info(client)

                # Extract design system information
                design_system = self._analyze_design_system(file_info)

                # Get component information
                components = await self._get_components(client, file_info)

                # Get page structure
                pages = self._extract_pages(file_info)

                # Build structured analysis result
                analysis = {
                    'status': 'success',
                    'data': {
                        'file': {
                            'name': file_info.get('name', 'Untitled'),
                            'key': self.file_key,
                            'last_modified': file_info.get('lastModified'),
                            'thumbnail_url': file_info.get('thumbnailUrl'),
                        },
                        'design_system': design_system,
                        'components': components,
                        'pages': pages,
                        'stats': {
                            'page_count': len(pages),
                            'component_count': len(components),
                        },
                    },
                    'analyzed_at': datetime.utcnow().isoformat(),
                }

                logger.info(f'Successfully analyzed Figma file {self.file_key}')
                return analysis

        except Exception as e:
            logger.error(f'Failed to analyze Figma file {self.file_key}: {e}', exc_info=True)
            return {'status': 'error', 'error': str(e), 'analyzed_at': datetime.utcnow().isoformat()}

    async def _get_file_info(self, client) -> dict:
        """Get Figma file metadata and structure."""
        result = await client.call_tool('figma', 'figma_get_file', arguments={'file_key': self.file_key})

        if result.get('isError'):
            raise Exception(result.get('content', [{}])[0].get('text', 'Failed to get file info'))

        # Extract file data from MCP response
        content = result.get('content', [{}])[0].get('text', '{}')
        import json

        return json.loads(content) if isinstance(content, str) else content

    async def _get_components(self, client, file_info: dict) -> list[dict]:
        """Extract component information from file."""
        try:
            # Try to get components using Figma MCP Server
            result = await client.call_tool('figma', 'figma_get_components', arguments={'file_key': self.file_key})

            if not result.get('isError'):
                import json

                content = result.get('content', [{}])[0].get('text', '[]')
                components = json.loads(content) if isinstance(content, str) else content
                return components if isinstance(components, list) else []

        except Exception as e:
            logger.warning(f'Failed to get components via MCP: {e}')

        # Fallback: Extract components from file_info structure
        components = []
        document = file_info.get('document', {})
        self._extract_components_recursive(document, components)
        return components

    def _extract_components_recursive(self, node: dict, components: list):
        """Recursively extract components from Figma node tree."""
        if node.get('type') == 'COMPONENT':
            components.append(
                {
                    'id': node.get('id'),
                    'name': node.get('name'),
                    'type': 'COMPONENT',
                }
            )

        # Process children
        for child in node.get('children', []):
            self._extract_components_recursive(child, components)

    def _extract_pages(self, file_info: dict) -> list[dict]:
        """Extract page structure from file info."""
        pages = []
        document = file_info.get('document', {})

        for child in document.get('children', []):
            if child.get('type') == 'CANVAS':
                pages.append(
                    {
                        'id': child.get('id'),
                        'name': child.get('name'),
                        'type': 'CANVAS',
                        'children_count': len(child.get('children', [])),
                    }
                )

        return pages

    def _analyze_design_system(self, file_info: dict) -> dict:
        """Analyze design system elements (colors, typography, etc.)."""
        design_system = {
            'colors': [],
            'text_styles': [],
            'effects': [],
        }

        # Extract styles from file
        styles = file_info.get('styles', {})

        # Process color styles
        for style_id, style in styles.items():
            style_type = style.get('styleType')
            if style_type == 'FILL':
                design_system['colors'].append(
                    {
                        'id': style_id,
                        'name': style.get('name'),
                        'description': style.get('description', ''),
                    }
                )
            elif style_type == 'TEXT':
                design_system['text_styles'].append(
                    {
                        'id': style_id,
                        'name': style.get('name'),
                        'description': style.get('description', ''),
                    }
                )
            elif style_type == 'EFFECT':
                design_system['effects'].append(
                    {
                        'id': style_id,
                        'name': style.get('name'),
                        'description': style.get('description', ''),
                    }
                )

        return design_system

    def get_content_key(self) -> str:
        """Return the key for storing analysis in project.content."""
        return 'figma'

    def get_source_identifier(self) -> str:
        """Return human-readable identifier for the source."""
        return f'figma:{self.file_key}'
