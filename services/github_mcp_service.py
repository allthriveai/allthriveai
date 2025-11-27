"""
GitHub MCP Service - wraps FastMCP client for GitHub tools.

This service is repo-centric (takes owner/repo/token) and is designed for
importing GitHub repositories through the Create Project Agent.

This is the primary service for all GitHub MCP operations in the application.
"""

import logging

from django.conf import settings

from services.github_helpers import detect_tech_stack_from_files
from services.mcp.client_factory import MCPClientFactory

logger = logging.getLogger(__name__)


class GitHubMCPService:
    """Service for interacting with GitHub's official MCP server via FastMCP."""

    def __init__(self, user_token: str | None):
        """
        Initialize GitHub MCP Service.

        Args:
            user_token: User's GitHub OAuth token for authenticated API access
        """
        factory = MCPClientFactory(settings.MCP_SERVERS)
        # This injects the per-user token into the Authorization header config
        self.client = factory.create_github_client(user_token=user_token)

    async def get_readme(self, owner: str, repo: str) -> str | None:
        """
        Fetch README.md contents via the GitHub MCP Server.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            README content as string or None if not found
        """
        try:
            async with self.client:
                result = await self.client.call_tool(
                    'github',
                    'get_file_contents',
                    arguments={'owner': owner, 'repo': repo, 'path': 'README.md'},
                )

                if result.get('isError'):
                    return None

                content = result.get('content', [{}])[0].get('text', '')
                return content
        except Exception as e:
            logger.warning(f'Failed to fetch README for {owner}/{repo}: {e}')
            return None

    async def get_repository_tree(self, owner: str, repo: str) -> list[dict]:
        """
        Fetch the git tree for HEAD via the GitHub MCP Server.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            List of file/directory objects in the repository tree
        """
        try:
            async with self.client:
                result = await self.client.call_tool(
                    'github',
                    'get_tree',
                    arguments={'owner': owner, 'repo': repo, 'tree_sha': 'HEAD', 'recursive': True},
                )

                if result.get('isError'):
                    return []

                import json

                content = result.get('content', [{}])[0].get('text', '[]')
                data = json.loads(content) if isinstance(content, str) else content
                return data.get('tree', [])
        except Exception as e:
            logger.warning(f'Failed to fetch tree for {owner}/{repo}: {e}')
            return []

    async def get_dependency_files(self, owner: str, repo: str) -> dict[str, str | None]:
        """
        Best-effort fetch of key dependency files.

        Fetches: package.json, requirements.txt, Pipfile, go.mod, Cargo.toml

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Dictionary mapping filename to content (or None if not found)
        """
        files: dict[str, str | None] = {}
        dependency_file_paths = [
            'package.json',
            'requirements.txt',
            'Pipfile',
            'go.mod',
            'Cargo.toml',
            'pom.xml',
            'Gemfile',
        ]

        async with self.client:
            for path in dependency_file_paths:
                try:
                    result = await self.client.call_tool(
                        'github',
                        'get_file_contents',
                        arguments={'owner': owner, 'repo': repo, 'path': path},
                    )

                    if not result.get('isError'):
                        files[path] = result.get('content', [{}])[0].get('text')
                    else:
                        files[path] = None
                except Exception:
                    files[path] = None

        return files

    async def get_repository_info(self, owner: str, repo: str) -> dict:
        """
        High-level helper: fetch README, tree, dependency files, and tech stack.

        This is the main method used by the import flow to gather all necessary
        repository information in one call.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Dictionary with readme, tree, dependencies, and tech_stack
        """
        logger.info(f'Fetching repository info for {owner}/{repo} via MCP')

        readme = await self.get_readme(owner, repo)
        tree = await self.get_repository_tree(owner, repo)
        deps = await self.get_dependency_files(owner, repo)
        tech_stack = detect_tech_stack_from_files(tree, deps)

        logger.info(f'Completed MCP fetch for {owner}/{repo}')

        return {
            'readme': readme or '',
            'tree': tree,
            'dependencies': deps,
            'tech_stack': tech_stack,
        }

    # Synchronous facade for use in sync contexts (like LangChain tools)
    def get_repository_info_sync(self, owner: str, repo: str) -> dict:
        """
        Synchronous wrapper for get_repository_info.

        Use this in synchronous contexts like LangChain tools.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Dictionary with readme, tree, dependencies, and tech_stack
        """
        import asyncio

        return asyncio.run(self.get_repository_info(owner, repo))
