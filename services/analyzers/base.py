"""
Base MCP Analyzer
Abstract base class for all MCP-based project analyzers
"""

from abc import ABC, abstractmethod
from typing import Any


class MCPAnalyzer(ABC):
    """
    Base class for all MCP-based analyzers.

    Each analyzer connects to a specific MCP server (GitHub, Figma, etc.)
    and extracts project information for display.
    """

    def __init__(self, project_id: int):
        """
        Initialize analyzer with project ID.

        Args:
            project_id: ID of the project being analyzed
        """
        self.project_id = project_id

    @abstractmethod
    async def analyze(self) -> dict[str, Any]:
        """
        Run analysis using MCP server.

        Returns:
            Dictionary with analysis results:
            {
                'status': 'success' | 'error',
                'data': {...},  # Analysis results specific to source
                'error': str,   # Error message if status='error'
                'analyzed_at': str  # ISO timestamp
            }
        """
        pass

    @abstractmethod
    async def validate_source(self) -> tuple[bool, str | None]:
        """
        Validate that the source (repo, file, etc.) is accessible.

        This should be a quick check before running full analysis.

        Returns:
            Tuple of (is_valid, error_message)
            - is_valid: True if source is accessible
            - error_message: Error description if not valid, None otherwise
        """
        pass

    @abstractmethod
    def get_content_key(self) -> str:
        """
        Return the key for storing analysis in project.content.

        Returns:
            String key like 'github', 'figma', etc.

        Example:
            Results will be stored in project.content[key]['analysis']
        """
        pass

    @abstractmethod
    def get_source_identifier(self) -> str:
        """
        Return human-readable identifier for the source.

        Returns:
            String identifying the source (e.g., 'owner/repo', 'file-key')
        """
        pass
