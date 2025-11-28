"""Base AI analyzer for project analysis.

This is SHARED across all integrations - AI analysis is platform-agnostic.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class BaseAIAnalyzer:
    """Base class for AI-powered project analysis.

    Provides common AI analysis functionality that works for any platform.
    """

    def __init__(self, ai_service: Any):
        """Initialize with AI service.

        Args:
            ai_service: AI provider service for generating content
        """
        self.ai_service = ai_service

    async def analyze_project(self, project_data: dict[str, Any]) -> dict[str, Any]:
        """Analyze project and generate enriched data.

        This is the main entry point for AI analysis.

        Args:
            project_data: Project data with:
                - name: Project name
                - description: Project description
                - readme_blocks: Parsed README blocks
                - metadata: Platform-specific metadata

        Returns:
            dict with enriched data:
                - generated_diagram: Mermaid diagram code
                - suggested_topics: List of topic suggestions
                - suggested_categories: List of category suggestions
        """
        result = {
            'generated_diagram': None,
            'suggested_topics': [],
            'suggested_categories': [],
        }

        # Generate architecture diagram if helpful
        if self._should_generate_diagram(project_data):
            try:
                diagram = await self.generate_diagram(project_data)
                result['generated_diagram'] = diagram
            except Exception as e:
                logger.error(f'Failed to generate diagram: {e}')

        # Generate topic suggestions
        try:
            topics = await self.suggest_topics(project_data)
            result['suggested_topics'] = topics
        except Exception as e:
            logger.error(f'Failed to suggest topics: {e}')

        # Generate category suggestions
        try:
            categories = await self.suggest_categories(project_data)
            result['suggested_categories'] = categories
        except Exception as e:
            logger.error(f'Failed to suggest categories: {e}')

        return result

    def _should_generate_diagram(self, project_data: dict[str, Any]) -> bool:
        """Determine if project would benefit from an architecture diagram.

        Args:
            project_data: Project data

        Returns:
            bool: True if diagram should be generated
        """
        # Check if README already has diagrams
        blocks = project_data.get('readme_blocks', [])
        has_diagram = any(block.get('type') == 'mermaid' for block in blocks)

        if has_diagram:
            logger.info('Project already has diagram(s), skipping AI generation')
            return False

        # Check if project is complex enough to benefit from diagram
        description = project_data.get('description', '')
        readme_length = sum(len(block.get('content', '')) for block in blocks if block.get('type') == 'text')

        is_complex = len(description) > 100 or readme_length > 500

        return is_complex

    async def generate_diagram(self, project_data: dict[str, Any]) -> str | None:
        """Generate Mermaid architecture diagram.

        Args:
            project_data: Project data

        Returns:
            str: Mermaid diagram code or None if generation failed
        """
        # This will be implemented with AI service call
        # For now, return None (to be implemented)
        return None

    async def suggest_topics(self, project_data: dict[str, Any]) -> list[str]:
        """Suggest relevant topics/tags for project.

        Args:
            project_data: Project data

        Returns:
            list of topic strings
        """
        # To be implemented with AI service
        return []

    async def suggest_categories(self, project_data: dict[str, Any]) -> list[str]:
        """Suggest relevant categories for project.

        Args:
            project_data: Project data

        Returns:
            list of category strings
        """
        # To be implemented with AI service
        return []
