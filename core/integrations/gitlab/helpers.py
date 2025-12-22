"""Shared helpers for GitLab integration.

Used by GitLabService, import_gitlab_project tool, and other GitLab services.
"""

import json
import logging
import re
from urllib.parse import quote_plus

from core.social.models import SocialConnection, SocialProvider
from core.tools.models import Tool

logger = logging.getLogger(__name__)


def get_import_lock_key(user_id: int) -> str:
    """
    Get the cache key for a user's GitLab import lock.

    Args:
        user_id: ID of the user

    Returns:
        Cache key string for the import lock
    """
    return f'gitlab_import_lock:{user_id}'


def parse_gitlab_url(url: str) -> tuple[str, str, str]:
    """
    Parse GitLab URL and return (base_url, namespace, project_path).

    Supports:
    - gitlab.com URLs
    - Self-hosted GitLab instances
    - Nested groups (e.g., group/subgroup/project)

    Args:
        url: GitLab project URL (https://gitlab.com/owner/repo or custom domain)

    Returns:
        Tuple of (base_url, namespace, project_path)
        - base_url: The GitLab instance URL (e.g., "https://gitlab.com")
        - namespace: The full namespace path (e.g., "group/subgroup")
        - project_path: The project name

    Raises:
        ValueError: If URL is not a valid GitLab URL
    """
    # Remove trailing slashes and .git suffix
    url = url.rstrip('/').removesuffix('.git')

    # Pattern for gitlab.com and self-hosted GitLab
    # Matches: https://gitlab.com/group/project or https://gitlab.example.com/group/subgroup/project
    pattern = r'^(https?://[^/]+)/(.+)/([^/]+)$'
    match = re.match(pattern, url)

    if not match:
        raise ValueError(f'Invalid GitLab URL: {url}')

    base_url = match.group(1)
    path_parts = match.group(2).split('/')
    namespace = '/'.join(path_parts)
    project_path = match.group(3)

    # Validate it looks like a GitLab URL
    if 'gitlab' not in base_url.lower() and not _is_known_gitlab_instance(base_url):
        # Could be a self-hosted instance - allow it but log
        logger.debug(f'Non-standard GitLab URL detected: {base_url}')

    return base_url, namespace, project_path


def _is_known_gitlab_instance(base_url: str) -> bool:
    """Check if URL is a known GitLab instance."""
    known_instances = [
        'gitlab.com',
        'gitlab.io',
    ]
    return any(instance in base_url.lower() for instance in known_instances)


def get_project_api_path(namespace: str, project: str) -> str:
    """
    Get the URL-encoded project path for GitLab API.

    GitLab API requires the full path to be URL-encoded.

    Args:
        namespace: Project namespace (e.g., "group/subgroup")
        project: Project name

    Returns:
        URL-encoded project path for API calls
    """
    full_path = f'{namespace}/{project}'
    return quote_plus(full_path)


def get_user_gitlab_token(user) -> str | None:
    """
    Get user's GitLab OAuth token from encrypted storage.

    Tries django-allauth first (for users who signed up with GitLab),
    then falls back to SocialConnection (for users who connected GitLab separately).

    Args:
        user: Django User instance

    Returns:
        User's GitLab access token or None if not connected
    """
    # Import here to avoid circular import during Django app loading
    from allauth.socialaccount.models import SocialAccount, SocialToken

    logger.info(f'[GitLab] Looking for token for user {user.id} ({user.username})')

    # First try django-allauth (for users who signed up with GitLab)
    try:
        social_account = SocialAccount.objects.get(user=user, provider='gitlab')
        logger.info(f'[GitLab] Found allauth SocialAccount for user {user.id}')
        social_token = SocialToken.objects.get(account=social_account)
        logger.info(f'[GitLab] Found allauth SocialToken for user {user.id}, token length: {len(social_token.token)}')
        return social_token.token
    except SocialAccount.DoesNotExist:
        logger.info(f'[GitLab] No allauth SocialAccount for user {user.id}')
    except SocialToken.DoesNotExist:
        logger.warning(f'[GitLab] SocialAccount exists but no SocialToken for user {user.id}')

    # Fall back to SocialConnection (for users who connected GitLab separately)
    try:
        connection = SocialConnection.objects.get(user=user, provider=SocialProvider.GITLAB, is_active=True)
        logger.info(
            f'[GitLab] Found SocialConnection for user {user.id}: '
            f'provider_user={connection.provider_username}, scopes={connection.scopes}'
        )
        token = connection.access_token  # This uses the property that decrypts the token
        if token:
            logger.info(f'[GitLab] Decrypted token from SocialConnection, length: {len(token)}')
        else:
            logger.error(f'[GitLab] SocialConnection exists but token decryption failed for user {user.id}')
        return token
    except SocialConnection.DoesNotExist:
        logger.warning(f'[GitLab] No SocialConnection found for user {user.id}')
        return None


def detect_tech_stack_from_files(tree: list[dict], deps: dict[str, str | None]) -> dict:
    """
    Detect tech stack from file tree and dependency file contents.

    Args:
        tree: List of file objects from repository tree
        deps: Dictionary of dependency file contents (e.g., {"package.json": "{...}", ...})

    Returns:
        Dictionary with languages, frameworks, and tools detected
    """
    tech_stack = {
        'languages': {},
        'frameworks': [],
        'tools': [],
    }

    # Detect from dependency files
    if deps.get('package.json'):
        tech_stack['languages']['JavaScript'] = 'primary'
        try:
            pkg_data = json.loads(deps['package.json'])
            # Extract framework names from dependencies
            dependencies = {**pkg_data.get('dependencies', {}), **pkg_data.get('devDependencies', {})}
            for dep in ['react', 'vue', 'angular', 'svelte', 'next', 'express', 'fastify']:
                if dep in dependencies:
                    tech_stack['frameworks'].append(dep.title())
        except Exception as e:
            logger.warning(f'Failed to parse package.json dependencies: {e}')

    if deps.get('requirements.txt') or deps.get('Pipfile'):
        tech_stack['languages']['Python'] = 'primary'
        if deps.get('requirements.txt'):
            # Parse requirements.txt for frameworks
            content = deps['requirements.txt']
            for framework in ['django', 'flask', 'fastapi', 'tornado']:
                if framework.lower() in content.lower():
                    tech_stack['frameworks'].append(framework.title())

    if deps.get('go.mod'):
        tech_stack['languages']['Go'] = 'primary'

    if deps.get('Cargo.toml'):
        tech_stack['languages']['Rust'] = 'primary'

    # Detect tools from tree
    file_paths = [f.get('path', '') for f in tree]
    if any('docker' in p.lower() for p in file_paths):
        tech_stack['tools'].append('Docker')
    if any('docker-compose' in p.lower() for p in file_paths):
        tech_stack['tools'].append('Docker Compose')
    if any('.gitlab-ci' in p for p in file_paths):
        tech_stack['tools'].append('GitLab CI/CD')

    return tech_stack


def normalize_gitlab_project_data(
    base_url: str, namespace: str, project: str, url: str, project_data: dict, repo_files: dict
) -> dict:
    """
    Normalize GitLab project data into the shape expected by analyze_github_repo.

    Args:
        base_url: GitLab instance base URL
        namespace: Project namespace
        project: Project name
        url: Full GitLab URL
        project_data: Project metadata from GitLab API
        repo_files: Dictionary with readme, tree, dependencies, tech_stack

    Returns:
        Dictionary with normalized repository metadata
    """
    logger.debug(f'Normalizing GitLab data for {namespace}/{project}')

    # GitLab API returns data in a different format than GitHub
    return {
        'name': project_data.get('name', project),
        'description': project_data.get('description', ''),
        'language': '',  # GitLab doesn't have a primary language field
        'topics': project_data.get('topics', []) or project_data.get('tag_list', []),
        'stargazers_count': project_data.get('star_count', 0),
        'forks_count': project_data.get('forks_count', 0),
        'html_url': url,
        'owner': namespace,
        'repo': project,
        'default_branch': project_data.get('default_branch', 'main'),
        # Include full project context for AI analysis
        'tree': repo_files.get('tree', []),
        'dependencies': repo_files.get('dependencies', {}),
        'tech_stack': repo_files.get('tech_stack', {}),
        # GitLab-specific fields
        'gitlab_id': project_data.get('id'),
        'visibility': project_data.get('visibility', 'public'),
        'issues_count': project_data.get('open_issues_count', 0),
        'merge_requests_count': project_data.get('open_merge_requests_count', 0),
    }


def match_or_create_technology(name: str) -> 'Tool | None':
    """
    Match an existing technology or create a minimal one if not found.

    This allows tech stack items detected from GitLab repos to be linked to
    the Tool directory, enabling the same tray experience as AI tools.

    Args:
        name: Technology name (e.g., "React", "Python", "Docker")

    Returns:
        Tool instance or None if matching failed
    """
    from django.utils.text import slugify

    # Normalize name for matching
    normalized_name = name.strip()
    if not normalized_name:
        return None

    # Strategy 1: Exact case-insensitive match
    tool = Tool.objects.filter(name__iexact=normalized_name).first()
    if tool:
        return tool

    # Strategy 2: Slug match
    slug_guess = slugify(normalized_name)
    tool = Tool.objects.filter(slug__iexact=slug_guess).first()
    if tool:
        return tool

    # Strategy 3: Common aliases
    aliases = {
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'py': 'Python',
        'rb': 'Ruby',
        'go': 'Go',
        'rs': 'Rust',
        'node': 'Node.js',
        'nodejs': 'Node.js',
        'postgres': 'PostgreSQL',
        'mongo': 'MongoDB',
        'k8s': 'Kubernetes',
        'tailwind': 'Tailwind CSS',
        'nextjs': 'Next.js',
        'vuejs': 'Vue.js',
        'expressjs': 'Express.js',
        'gcp': 'Google Cloud',
    }
    if normalized_name.lower() in aliases:
        tool = Tool.objects.filter(name__iexact=aliases[normalized_name.lower()]).first()
        if tool:
            return tool

    # Strategy 4: Partial match (for things like "react" matching "React")
    tool = Tool.objects.filter(name__icontains=normalized_name, tool_type='technology').first()
    if tool:
        return tool

    # Don't auto-create technologies - only match seeded ones
    logger.debug(f'Technology "{normalized_name}" not found in database')
    return None
