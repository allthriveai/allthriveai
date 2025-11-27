"""
Analyzer Factory
Routes project analysis to the appropriate MCP analyzer based on project type

Note: GitHub projects are imported via the Create Project Agent using import_github_project tool.
Background analysis is only available for Figma projects.
"""

import logging

from core.projects.models import Project
from services.analyzers.base import MCPAnalyzer

logger = logging.getLogger(__name__)


class AnalyzerFactory:
    """Factory for creating appropriate analyzer based on project type."""

    @staticmethod
    def create_analyzer(project: Project) -> MCPAnalyzer:
        """
        Create appropriate analyzer for the given project.

        Args:
            project: Project instance to analyze

        Returns:
            MCPAnalyzer instance for the project type

        Raises:
            ValueError: If project type is not supported or analyzer not implemented
        """
        project_type = project.type

        if project_type == Project.ProjectType.FIGMA_DESIGN:
            # Import here to avoid circular dependency
            from services.analyzers.figma import FigmaAnalyzer

            return FigmaAnalyzer(project.id)
        else:
            raise ValueError(
                f'No background analyzer available for project type: {project_type}. '
                f'GitHub projects are imported via the Create Project Agent. '
                f'Supported background analysis types: FIGMA_DESIGN'
            )

    @staticmethod
    def get_supported_types() -> list[str]:
        """
        Get list of project types that have background analyzers available.

        Note: GitHub projects are imported with full analysis via import_github_project tool.

        Returns:
            List of ProjectType values that can be analyzed in background
        """
        return [
            Project.ProjectType.FIGMA_DESIGN,
        ]

    @staticmethod
    def is_analyzable(project: Project) -> bool:
        """
        Check if a project type can be analyzed in background.

        Args:
            project: Project instance to check

        Returns:
            True if project type has a background analyzer available
        """
        return project.type in AnalyzerFactory.get_supported_types()
