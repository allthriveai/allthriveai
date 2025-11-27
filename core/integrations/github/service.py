"""
GitHub REST API Service
Direct integration with GitHub API for repository data fetching.
"""

import asyncio
import base64
import logging

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from core.integrations.github.constants import (
    GITHUB_API_TIMEOUT,
    GITHUB_RETRY_ATTEMPTS,
    GITHUB_RETRY_MAX_WAIT,
    GITHUB_RETRY_MIN_WAIT,
)
from core.integrations.github.helpers import detect_tech_stack_from_files

logger = logging.getLogger(__name__)


class GitHubAPIError(Exception):
    """Raised when GitHub API returns an error."""

    pass


class GitHubService:
    """Service for interacting with GitHub REST API."""

    BASE_URL = 'https://api.github.com'

    def __init__(self, user_token: str):
        """
        Initialize GitHub Service.

        Args:
            user_token: User's GitHub OAuth token

        Raises:
            ValueError: If user_token is None or empty
        """
        if not user_token:
            raise ValueError('GitHub token is required')

        self.token = user_token
        self.headers = {
            'Authorization': f'token {user_token}',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AllThrive-Portfolio',
        }

    @retry(
        stop=stop_after_attempt(GITHUB_RETRY_ATTEMPTS),
        wait=wait_exponential(min=GITHUB_RETRY_MIN_WAIT, max=GITHUB_RETRY_MAX_WAIT),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def _make_request(self, url: str, params: dict | None = None) -> dict | None:
        """
        Make authenticated request to GitHub API with retry logic.

        Args:
            url: GitHub API endpoint URL
            params: Optional query parameters

        Returns:
            JSON response as dict or None if 404
        """
        async with httpx.AsyncClient(timeout=GITHUB_API_TIMEOUT) as client:
            response = await client.get(url, headers=self.headers, params=params or {})

            # Check rate limit
            remaining = response.headers.get('X-RateLimit-Remaining')
            if remaining and int(remaining) < 100:
                logger.warning(f'GitHub API rate limit low: {remaining} requests remaining')

            if response.status_code == 404:
                return None  # File/resource not found

            response.raise_for_status()
            return response.json()

    def _decode_content(self, content_data: dict) -> str:
        """Decode base64 content from GitHub API response."""
        if not content_data:
            return ''

        content = content_data.get('content', '')
        if content_data.get('encoding') == 'base64':
            try:
                return base64.b64decode(content).decode('utf-8')
            except Exception as e:
                logger.warning(f'Failed to decode base64 content: {e}')
                return ''

        return content

    async def get_readme(self, owner: str, repo: str) -> str | None:
        """
        Fetch README.md contents via GitHub REST API.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            README content as string or None if not found
        """
        try:
            logger.debug(f'Fetching README for {owner}/{repo}')
            url = f'{self.BASE_URL}/repos/{owner}/{repo}/contents/README.md'
            data = await self._make_request(url)

            if not data:
                logger.debug(f'README not found for {owner}/{repo}')
                return None

            content = self._decode_content(data)
            logger.debug(f'README fetched for {owner}/{repo}, length: {len(content)} chars')
            return content

        except Exception as e:
            logger.warning(f'Failed to fetch README for {owner}/{repo}: {e}')
            return None

    async def get_repository_tree(self, owner: str, repo: str) -> list[dict]:
        """
        Fetch repository file tree via GitHub REST API with retry logic.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            List of file/directory objects in the repository tree
        """
        try:
            logger.debug(f'Fetching tree for {owner}/{repo}')
            url = f'{self.BASE_URL}/repos/{owner}/{repo}/git/trees/HEAD'
            params = {'recursive': '1'}

            # Use _make_request to get automatic retry logic
            data = await self._make_request(url, params=params)

            if not data:
                logger.debug(f'Tree not found for {owner}/{repo}')
                return []

            tree = data.get('tree', [])
            logger.debug(f'Tree fetched for {owner}/{repo}, {len(tree)} files')
            return tree

        except Exception as e:
            logger.warning(f'Failed to fetch tree for {owner}/{repo}: {e}')
            return []

    async def get_file_contents(self, owner: str, repo: str, path: str) -> str | None:
        """
        Fetch file contents via GitHub REST API.

        Args:
            owner: Repository owner
            repo: Repository name
            path: File path in repository

        Returns:
            File content as string or None if not found
        """
        try:
            url = f'{self.BASE_URL}/repos/{owner}/{repo}/contents/{path}'
            data = await self._make_request(url)

            if not data:
                return None

            return self._decode_content(data)

        except Exception as e:
            logger.debug(f'Failed to fetch {path} for {owner}/{repo}: {e}')
            return None

    async def get_dependency_files(self, owner: str, repo: str) -> dict[str, str | None]:
        """
        Fetch common dependency files via GitHub REST API in parallel.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Dictionary mapping filename to content (or None if not found)
        """
        dependency_file_paths = [
            'package.json',
            'requirements.txt',
            'Pipfile',
            'go.mod',
            'Cargo.toml',
            'pom.xml',
            'Gemfile',
        ]

        # Fetch all files in parallel using asyncio.gather
        logger.debug(f'Fetching {len(dependency_file_paths)} dependency files in parallel for {owner}/{repo}')
        tasks = [self.get_file_contents(owner, repo, path) for path in dependency_file_paths]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Build result dictionary
        files = {}
        for path, result in zip(dependency_file_paths, results, strict=False):
            if isinstance(result, Exception):
                # Exception occurred - log and set to None
                logger.debug(f'Failed to fetch {path} for {owner}/{repo}: {result}')
                files[path] = None
            else:
                files[path] = result
                if result:
                    logger.debug(f'Successfully fetched {path} for {owner}/{repo}')

        # Log summary
        found_files = [path for path, content in files.items() if content]
        if found_files:
            logger.debug(f"Found {len(found_files)} dependency files for {owner}/{repo}: " f"{', '.join(found_files)}")
        else:
            logger.debug(f'No dependency files found for {owner}/{repo}')

        return files

    async def get_repository_info(self, owner: str, repo: str) -> dict:
        """
        Fetch complete repository information in parallel.

        This is the main method used by the import flow. Fetches README, tree,
        and dependency files concurrently for maximum performance.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Dictionary with readme, tree, dependencies, and tech_stack
        """
        logger.info(f'Fetching repository info for {owner}/{repo}')

        # Fetch README, tree, and dependencies in parallel (independent operations)
        readme_task = self.get_readme(owner, repo)
        tree_task = self.get_repository_tree(owner, repo)
        deps_task = self.get_dependency_files(owner, repo)

        readme, tree, deps = await asyncio.gather(readme_task, tree_task, deps_task)

        # Tech stack detection depends on tree and deps, so run after gather
        tech_stack = detect_tech_stack_from_files(tree, deps)

        logger.info(f'Completed fetch for {owner}/{repo}')

        return {
            'readme': readme or '',
            'tree': tree,
            'dependencies': deps,
            'tech_stack': tech_stack,
        }

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
