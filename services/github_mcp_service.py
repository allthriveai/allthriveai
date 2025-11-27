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

    def __init__(self, user_token: str):
        """
        Initialize GitHub MCP Service.

        Args:
            user_token: User's GitHub OAuth token for authenticated API access

        Raises:
            ValueError: If user_token is None or empty
        """
        if not user_token:
            raise ValueError('GitHub token is required for MCP service')

        self.token = user_token
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
            logger.debug(f'Fetching README for {owner}/{repo} via MCP')
            async with self.client:
                result = await self.client.call_tool(
                    'github',  # ✅ Server name is required!
                    'get_file_contents',
                    arguments={'owner': owner, 'repo': repo, 'path': 'README.md'},
                )

                if result.get('isError'):
                    logger.debug(f'README not found for {owner}/{repo}: {result.get("error", "unknown error")}')
                    return None

                content = result.get('content', [{}])[0].get('text', '')
                logger.debug(f'README fetched for {owner}/{repo}, length: {len(content)} chars')
                return content
        except Exception as e:
            logger.warning(f'Failed to fetch README for {owner}/{repo}: {e}', exc_info=True)
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
            logger.debug(f'Fetching tree for {owner}/{repo} via MCP')
            async with self.client:
                result = await self.client.call_tool(
                    'github',  # ✅ Server name is required!
                    'get_tree',
                    arguments={'owner': owner, 'repo': repo, 'tree_sha': 'HEAD', 'recursive': True},
                )

                if result.get('isError'):
                    logger.debug(f'Tree not found for {owner}/{repo}: {result.get("error", "unknown error")}')
                    return []

                import json

                content = result.get('content', [{}])[0].get('text', '[]')
                data = json.loads(content) if isinstance(content, str) else content
                tree = data.get('tree', [])
                logger.debug(f'Tree fetched for {owner}/{repo}, {len(tree)} files')
                return tree
        except Exception as e:
            logger.warning(f'Failed to fetch tree for {owner}/{repo}: {e}', exc_info=True)
            return []

    async def get_dependency_files(self, owner: str, repo: str) -> dict[str, str | None]:
        """
        Best-effort fetch of key dependency files via GitHub MCP Server.

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
                        'github',  # ✅ Server name is required!
                        'get_file_contents',
                        arguments={'owner': owner, 'repo': repo, 'path': path},
                    )

                    if not result.get('isError'):
                        files[path] = result.get('content', [{}])[0].get('text')
                        logger.debug(f'Successfully fetched {path} for {owner}/{repo}')
                    else:
                        logger.debug(f'{path} not found for {owner}/{repo}')
                        files[path] = None
                except Exception as e:
                    logger.debug(f'Failed to fetch {path} for {owner}/{repo}: {e}')
                    files[path] = None

        # Log summary of what was found
        found_files = [path for path, content in files.items() if content is not None]
        if found_files:
            logger.debug(f'Found {len(found_files)} dependency files for {owner}/{repo}: {", ".join(found_files)}')
        else:
            logger.debug(f'No dependency files found for {owner}/{repo}')

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
