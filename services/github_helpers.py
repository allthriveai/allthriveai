"""Shared helpers for GitHub integration.

Used by GitHubMCPService, import_github_project tool, and other GitHub services.
"""

import json
import logging
import re

import httpx
from allauth.socialaccount.models import SocialAccount, SocialToken

from core.social.models import SocialConnection, SocialProvider
from services.github_constants import GITHUB_API_TIMEOUT

logger = logging.getLogger(__name__)


def parse_github_url(url: str) -> tuple[str, str]:
    """
    Parse GitHub URL and return (owner, repo).

    Args:
        url: GitHub repository URL (https://github.com/owner/repo or git@github.com:owner/repo.git)

    Returns:
        Tuple of (owner, repo)

    Raises:
        ValueError: If URL is not a valid GitHub URL
    """
    # Match github.com/owner/repo or github.com/owner/repo.git
    pattern = r'github\.com[:/]([^/]+)/([^/\.]+?)(?:\.git)?/?$'
    match = re.search(pattern, url)

    if not match:
        raise ValueError(f'Invalid GitHub URL: {url}')

    return match.group(1), match.group(2)


def get_user_github_token(user) -> str | None:
    """
    Get user's GitHub OAuth token from encrypted storage.

    Tries django-allauth first (for users who signed up with GitHub),
    then falls back to SocialConnection (for users who connected GitHub separately).

    Args:
        user: Django User instance

    Returns:
        User's GitHub access token or None if not connected
    """
    # First try django-allauth (for users who signed up with GitHub)
    try:
        social_account = SocialAccount.objects.get(user=user, provider='github')
        social_token = SocialToken.objects.get(account=social_account)
        logger.debug(f'Using GitHub OAuth token for user {user.id} from django-allauth')
        return social_token.token
    except (SocialAccount.DoesNotExist, SocialToken.DoesNotExist):
        pass

    # Fall back to SocialConnection (for users who connected GitHub separately)
    try:
        connection = SocialConnection.objects.get(user=user, provider=SocialProvider.GITHUB, is_active=True)
        logger.debug(f'Using GitHub OAuth token for user {user.id} from SocialConnection')
        return connection.access_token  # This uses the property that decrypts the token
    except SocialConnection.DoesNotExist:
        logger.warning(f'No GitHub connection found for user {user.id}')
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
    if any('.github/workflows' in p for p in file_paths):
        tech_stack['tools'].append('GitHub Actions')

    return tech_stack


async def normalize_mcp_repo_data(owner: str, repo: str, url: str, repo_files: dict) -> dict:
    """
    Normalize MCP response into the shape expected by analyze_github_repo.

    If MCP doesn't provide repo metadata (stars, description, etc.), this function
    makes a single async REST call to https://api.github.com/repos/{owner}/{repo}.

    Args:
        owner: Repository owner
        repo: Repository name
        url: Full GitHub URL
        repo_files: Dictionary with readme, tree, dependencies, tech_stack

    Returns:
        Dictionary with normalized repository metadata
    """
    # Fetch top-level repo metadata via REST (acceptable fallback per plan)
    logger.debug(f'Normalizing MCP data for {owner}/{repo}')
    logger.debug(f'Input repo_files keys: {list(repo_files.keys())}')
    logger.debug(
        f'README length: {len(repo_files.get("readme", ""))}, '
        f'tree items: {len(repo_files.get("tree", []))}, '
        f'deps: {list(repo_files.get("dependencies", {}).keys())}'
    )

    try:
        async with httpx.AsyncClient(timeout=GITHUB_API_TIMEOUT) as client:
            resp = await client.get(f'https://api.github.com/repos/{owner}/{repo}')
            if resp.status_code == 200:
                data = resp.json()
                result = {
                    'name': data.get('name', repo),
                    'description': data.get('description', ''),
                    'language': data.get('language', ''),
                    'topics': data.get('topics', []),
                    'stargazers_count': data.get('stargazers_count', 0),
                    'forks_count': data.get('forks_count', 0),
                    'html_url': url,
                }
                logger.debug(
                    f'Fetched GitHub API metadata: name={result["name"]}, '
                    f'description={result["description"][:50] if result["description"] else "None"}..., '
                    f'language={result["language"]}, stars={result["stargazers_count"]}'
                )
                return result
    except Exception as e:
        logger.warning(f'Failed to fetch repo metadata for {owner}/{repo}: {e}')

    # Fallback with minimal data
    languages = list(repo_files.get('tech_stack', {}).get('languages', {}).keys())
    return {
        'name': repo,
        'description': '',
        'language': languages[0] if languages else '',
        'topics': [],
        'stargazers_count': 0,
        'forks_count': 0,
        'html_url': url,
    }


def apply_ai_metadata(project, analysis: dict) -> None:
    """
    Apply AI-suggested categories, topics, and tools to a project.

    Extracted from GitHubSyncService._create_project_from_repo.

    Args:
        project: Project instance to update
        analysis: Dictionary with category_ids, topics, tool_names from AI analysis
    """
    from core.taxonomy.models import Taxonomy
    from core.tools.models import Tool

    # Apply categories
    for cat_id in analysis.get('category_ids', []):
        try:
            category = Taxonomy.objects.get(id=cat_id, taxonomy_type='category', is_active=True)
            project.categories.add(category)
        except Taxonomy.DoesNotExist:
            logger.warning(f'Category {cat_id} not found')

    # Apply topics
    topics = analysis.get('topics', [])
    if topics:
        project.topics = topics[:20]  # Limit to 20
        project.save(update_fields=['topics'])

    # Apply tools
    for tool_name in analysis.get('tool_names', []):
        tool = Tool.objects.filter(name__iexact=tool_name).first()
        if tool:
            project.tools.add(tool)
