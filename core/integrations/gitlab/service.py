"""
GitLab REST API Service
Direct integration with GitLab API for project data fetching.
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

from core.integrations.gitlab.constants import (
    GITLAB_API_TIMEOUT,
    GITLAB_RETRY_ATTEMPTS,
    GITLAB_RETRY_MAX_WAIT,
    GITLAB_RETRY_MIN_WAIT,
)
from core.integrations.gitlab.helpers import detect_tech_stack_from_files, get_project_api_path

logger = logging.getLogger(__name__)


class GitLabAPIError(Exception):
    """Raised when GitLab API returns an error."""

    pass


class GitLabService:
    """Service for interacting with GitLab REST API."""

    @classmethod
    def for_user(cls, user) -> 'GitLabService | None':
        """
        Create a GitLabService for a specific user using their OAuth token.

        Args:
            user: Django User instance

        Returns:
            GitLabService instance or None if user doesn't have GitLab connected
        """
        from core.integrations.gitlab.helpers import get_user_gitlab_token

        logger.info(f'[GitLab] Creating service for user {user.id} ({user.username})')

        token = get_user_gitlab_token(user)
        if not token:
            logger.warning(f'[GitLab] No token found for user {user.id} ({user.username})')
            return None

        logger.info(f'[GitLab] Token found for user {user.id}, token length: {len(token)}')

        try:
            service = cls(user_token=token)
            logger.info(f'[GitLab] Service created successfully for user {user.id}')
            return service
        except ValueError as e:
            logger.error(f'[GitLab] Failed to create service for user {user.id}: {e}')
            return None

    def __init__(self, user_token: str, base_url: str = 'https://gitlab.com'):
        """
        Initialize GitLab Service.

        Args:
            user_token: User's GitLab OAuth token
            base_url: GitLab instance base URL (default: gitlab.com)

        Raises:
            ValueError: If user_token is None or empty
        """
        if not user_token:
            raise ValueError('GitLab token is required')

        self.token = user_token
        self.base_url = base_url.rstrip('/')
        self.api_url = f'{self.base_url}/api/v4'
        self.headers = {
            'Authorization': f'Bearer {user_token}',
            'Accept': 'application/json',
            'User-Agent': 'AllThrive-Portfolio',
        }

    @retry(
        stop=stop_after_attempt(GITLAB_RETRY_ATTEMPTS),
        wait=wait_exponential(min=GITLAB_RETRY_MIN_WAIT, max=GITLAB_RETRY_MAX_WAIT),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    async def _make_request(self, url: str, params: dict | None = None) -> dict | list | None:
        """
        Make authenticated request to GitLab API with retry logic.

        Args:
            url: GitLab API endpoint URL
            params: Optional query parameters

        Returns:
            JSON response as dict/list or None if 404
        """
        logger.info(f'[GitLab API] GET {url} params={params}')

        async with httpx.AsyncClient(timeout=GITLAB_API_TIMEOUT) as client:
            response = await client.get(url, headers=self.headers, params=params or {})

            # Log response status
            logger.info(f'[GitLab API] Response: {response.status_code} for {url}')

            # Check rate limit
            remaining = response.headers.get('RateLimit-Remaining')
            if remaining:
                logger.debug(f'[GitLab API] Rate limit remaining: {remaining}')
                if int(remaining) < 100:
                    logger.warning(f'[GitLab API] Rate limit low: {remaining} requests remaining')

            if response.status_code == 404:
                logger.info(f'[GitLab API] 404 Not Found: {url}')
                return None  # File/resource not found

            if response.status_code == 401:
                logger.error('[GitLab API] 401 Unauthorized - token may be invalid or expired')
                response.raise_for_status()

            if response.status_code == 403:
                logger.error('[GitLab API] 403 Forbidden - insufficient permissions or scopes')
                response.raise_for_status()

            response.raise_for_status()
            return response.json()

    async def get_project_info(self, namespace: str, project: str) -> dict | None:
        """
        Fetch project metadata via GitLab REST API.

        Args:
            namespace: Project namespace (e.g., "group/subgroup")
            project: Project name

        Returns:
            Project metadata dict or None if not found
        """
        try:
            project_path = get_project_api_path(namespace, project)
            url = f'{self.api_url}/projects/{project_path}'
            logger.debug(f'Fetching GitLab project info for {namespace}/{project}')

            data = await self._make_request(url)
            if data:
                logger.debug(f'Project info fetched for {namespace}/{project}')
            return data

        except Exception as e:
            logger.warning(f'Failed to fetch project info for {namespace}/{project}: {e}')
            return None

    async def get_readme(self, namespace: str, project: str, default_branch: str = 'main') -> str | None:
        """
        Fetch README.md contents via GitLab REST API.

        Args:
            namespace: Project namespace
            project: Project name
            default_branch: Default branch name

        Returns:
            README content as string or None if not found
        """
        try:
            project_path = get_project_api_path(namespace, project)
            logger.debug(f'Fetching README for {namespace}/{project}')

            # GitLab uses URL-encoded file path
            url = f'{self.api_url}/projects/{project_path}/repository/files/README.md'
            params = {'ref': default_branch}
            data = await self._make_request(url, params)

            if not data:
                # Try lowercase readme.md
                url = f'{self.api_url}/projects/{project_path}/repository/files/readme.md'
                data = await self._make_request(url, params)

            if not data:
                logger.debug(f'README not found for {namespace}/{project}')
                return None

            # GitLab returns base64-encoded content
            content = data.get('content', '')
            if data.get('encoding') == 'base64':
                try:
                    content = base64.b64decode(content).decode('utf-8')
                except Exception as e:
                    logger.warning(f'Failed to decode README content: {e}')
                    return ''

            logger.debug(f'README fetched for {namespace}/{project}, length: {len(content)} chars')
            return content

        except Exception as e:
            logger.warning(f'Failed to fetch README for {namespace}/{project}: {e}')
            return None

    async def get_repository_tree(self, namespace: str, project: str, default_branch: str = 'main') -> list[dict]:
        """
        Fetch repository file tree via GitLab REST API with retry logic.

        Args:
            namespace: Project namespace
            project: Project name
            default_branch: Default branch name

        Returns:
            List of file/directory objects in the repository tree
        """
        try:
            project_path = get_project_api_path(namespace, project)
            logger.debug(f'Fetching tree for {namespace}/{project}')

            url = f'{self.api_url}/projects/{project_path}/repository/tree'
            params = {'ref': default_branch, 'recursive': 'true', 'per_page': 100}

            data = await self._make_request(url, params)

            if not data:
                logger.debug(f'Tree not found for {namespace}/{project}')
                return []

            # Normalize to GitHub-like format
            tree = []
            for item in data:
                tree.append(
                    {
                        'path': item.get('path', ''),
                        'type': 'blob' if item.get('type') == 'blob' else 'tree',
                        'mode': item.get('mode', ''),
                    }
                )

            logger.debug(f'Tree fetched for {namespace}/{project}, {len(tree)} files')
            return tree

        except Exception as e:
            logger.warning(f'Failed to fetch tree for {namespace}/{project}: {e}')
            return []

    async def get_file_contents(
        self, namespace: str, project: str, path: str, default_branch: str = 'main'
    ) -> str | None:
        """
        Fetch file contents via GitLab REST API.

        Args:
            namespace: Project namespace
            project: Project name
            path: File path in repository
            default_branch: Default branch name

        Returns:
            File content as string or None if not found
        """
        try:
            project_path = get_project_api_path(namespace, project)
            # URL-encode the file path
            from urllib.parse import quote

            encoded_path = quote(path, safe='')
            url = f'{self.api_url}/projects/{project_path}/repository/files/{encoded_path}'
            params = {'ref': default_branch}

            data = await self._make_request(url, params)

            if not data:
                return None

            content = data.get('content', '')
            if data.get('encoding') == 'base64':
                try:
                    content = base64.b64decode(content).decode('utf-8')
                except Exception:
                    return None

            return content

        except Exception as e:
            logger.debug(f'Failed to fetch {path} for {namespace}/{project}: {e}')
            return None

    async def get_dependency_files(
        self, namespace: str, project: str, default_branch: str = 'main'
    ) -> dict[str, str | None]:
        """
        Fetch common dependency files via GitLab REST API in parallel.

        Args:
            namespace: Project namespace
            project: Project name
            default_branch: Default branch name

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
        logger.debug(f'Fetching {len(dependency_file_paths)} dependency files in parallel for {namespace}/{project}')
        tasks = [self.get_file_contents(namespace, project, path, default_branch) for path in dependency_file_paths]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Build result dictionary
        files = {}
        for path, result in zip(dependency_file_paths, results, strict=False):
            if isinstance(result, Exception):
                logger.debug(f'Failed to fetch {path} for {namespace}/{project}: {result}')
                files[path] = None
            else:
                files[path] = result
                if result:
                    logger.debug(f'Successfully fetched {path} for {namespace}/{project}')

        # Log summary
        found_files = [path for path, content in files.items() if content]
        if found_files:
            logger.debug(
                f'Found {len(found_files)} dependency files for {namespace}/{project}: {", ".join(found_files)}'
            )
        else:
            logger.debug(f'No dependency files found for {namespace}/{project}')

        return files

    async def get_languages(self, namespace: str, project: str) -> dict[str, float]:
        """
        Fetch language breakdown via GitLab REST API.

        Args:
            namespace: Project namespace
            project: Project name

        Returns:
            Dictionary mapping language name to percentage
        """
        try:
            project_path = get_project_api_path(namespace, project)
            url = f'{self.api_url}/projects/{project_path}/languages'

            data = await self._make_request(url)
            return data if data else {}

        except Exception as e:
            logger.warning(f'Failed to fetch languages for {namespace}/{project}: {e}')
            return {}

    async def get_repository_info(self, namespace: str, project: str) -> dict:
        """
        Fetch complete repository information in parallel.

        This is the main method used by the import flow. Fetches project info,
        README, tree, and dependency files concurrently for maximum performance.

        Args:
            namespace: Project namespace
            project: Project name

        Returns:
            Dictionary with project_data, readme, tree, dependencies, tech_stack, and languages
        """
        logger.info(f'Fetching repository info for {namespace}/{project}')

        # First fetch project info to get default branch
        project_data = await self.get_project_info(namespace, project)
        if not project_data:
            raise GitLabAPIError(f'Project not found: {namespace}/{project}')

        default_branch = project_data.get('default_branch', 'main')

        # Fetch README, tree, dependencies, and languages in parallel
        readme_task = self.get_readme(namespace, project, default_branch)
        tree_task = self.get_repository_tree(namespace, project, default_branch)
        deps_task = self.get_dependency_files(namespace, project, default_branch)
        languages_task = self.get_languages(namespace, project)

        readme, tree, deps, languages = await asyncio.gather(readme_task, tree_task, deps_task, languages_task)

        # Tech stack detection depends on tree and deps, so run after gather
        tech_stack = detect_tech_stack_from_files(tree, deps)

        # Add detected languages to tech_stack
        if languages:
            for lang, percentage in languages.items():
                if percentage > 5:  # Only include languages with >5% usage
                    tech_stack['languages'][lang] = 'primary' if percentage > 30 else 'secondary'

        logger.info(f'Completed fetch for {namespace}/{project}')

        return {
            'project_data': project_data,
            'readme': readme or '',
            'tree': tree,
            'dependencies': deps,
            'tech_stack': tech_stack,
            'languages': languages,
        }

    def get_repository_info_sync(self, namespace: str, project: str) -> dict:
        """
        Synchronous wrapper for get_repository_info.

        Use this in synchronous contexts like LangChain tools.

        Args:
            namespace: Project namespace
            project: Project name

        Returns:
            Dictionary with project_data, readme, tree, dependencies, tech_stack, and languages
        """
        import asyncio

        return asyncio.run(self.get_repository_info(namespace, project))

    async def verify_project_access(self, namespace: str, project: str) -> bool:
        """
        Verify the authenticated user owns or has access to a project.

        Args:
            namespace: Project namespace
            project: Project name

        Returns:
            True if user has access to the project, False otherwise
        """
        try:
            # Get authenticated user's info
            url = f'{self.api_url}/user'
            user_data = await self._make_request(url)
            if not user_data:
                logger.warning('Failed to get authenticated user info')
                return False

            username = user_data.get('username', '').lower()

            # Check if user is the project owner (namespace matches username)
            if namespace.lower() == username:
                logger.info(f'User {username} is owner of {namespace}/{project}')
                return True

            # Get project info to check membership
            project_data = await self.get_project_info(namespace, project)
            if project_data:
                # Check if it's a public project or user has access
                visibility = project_data.get('visibility', 'private')
                if visibility in ['public', 'internal']:
                    logger.info(f'Project {namespace}/{project} is {visibility}, access granted')
                    return True

                # For private projects, check if we can access it
                # (if we got project_data, we have access)
                logger.info(f'User {username} has access to private project {namespace}/{project}')
                return True

            logger.info(f'User {username} does not have access to {namespace}/{project}')
            return False

        except Exception as e:
            logger.error(f'Error verifying project access for {namespace}/{project}: {e}')
            raise

    def verify_project_access_sync(self, namespace: str, project: str) -> bool:
        """
        Synchronous wrapper for verify_project_access.

        Args:
            namespace: Project namespace
            project: Project name

        Returns:
            True if user has access to the project, False otherwise
        """
        import asyncio

        return asyncio.run(self.verify_project_access(namespace, project))
