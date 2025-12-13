"""Shared helpers for GitHub integration.

Used by GitHubMCPService, import_github_project tool, and other GitHub services.
"""

import json
import logging
import re

import httpx

from core.integrations.github.constants import GITHUB_API_TIMEOUT
from core.social.models import SocialConnection, SocialProvider
from core.tools.models import Tool

logger = logging.getLogger(__name__)


def get_import_lock_key(user_id: int) -> str:
    """
    Get the cache key for a user's import lock.

    Args:
        user_id: ID of the user

    Returns:
        Cache key string for the import lock
    """
    return f'github_import_lock:{user_id}'


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
    # Import here to avoid circular import during Django app loading
    from allauth.socialaccount.models import SocialAccount, SocialToken

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

    # File extension to language mapping
    extension_to_language = {
        '.py': 'Python',
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.jsx': 'JavaScript',
        '.go': 'Go',
        '.rs': 'Rust',
        '.java': 'Java',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.scala': 'Scala',
        '.cs': 'C#',
        '.cpp': 'C++',
        '.c': 'C',
        '.sh': 'Shell',
        '.sql': 'SQL',
        '.md': 'Markdown',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.yaml': 'YAML',
        '.yml': 'YAML',
    }

    # Count file extensions to detect languages
    extension_counts = {}
    file_paths = [f.get('path', '') for f in tree]

    for path in file_paths:
        # Skip hidden files and common non-source files
        if path.startswith('.') or '/.' in path:
            continue

        for ext, lang in extension_to_language.items():
            if path.endswith(ext):
                extension_counts[lang] = extension_counts.get(lang, 0) + 1
                break

    # Add languages detected from file extensions (with at least 2 files)
    for lang, count in sorted(extension_counts.items(), key=lambda x: -x[1]):
        if count >= 2 and lang not in ['Markdown', 'YAML', 'HTML', 'CSS']:  # Skip documentation-only languages
            if lang not in tech_stack['languages']:
                tech_stack['languages'][lang] = 'detected'

    # Detect from dependency files (higher priority than file extensions)
    if deps.get('package.json'):
        tech_stack['languages']['JavaScript'] = 'primary'
        try:
            pkg_data = json.loads(deps['package.json'])
            # Extract framework names from dependencies
            dependencies = {**pkg_data.get('dependencies', {}), **pkg_data.get('devDependencies', {})}

            # Detect TypeScript
            if 'typescript' in dependencies:
                tech_stack['languages']['TypeScript'] = 'primary'

            # Detect frameworks
            framework_mapping = {
                'react': 'React',
                'vue': 'Vue.js',
                'angular': 'Angular',
                'svelte': 'Svelte',
                'next': 'Next.js',
                'express': 'Express.js',
                'fastify': 'Fastify',
                'nestjs': 'NestJS',
                '@nestjs/core': 'NestJS',
                'nuxt': 'Nuxt.js',
                'gatsby': 'Gatsby',
                'remix': 'Remix',
                'tailwindcss': 'Tailwind CSS',
            }
            for dep, framework in framework_mapping.items():
                if dep in dependencies and framework not in tech_stack['frameworks']:
                    tech_stack['frameworks'].append(framework)
        except Exception as e:
            logger.warning(f'Failed to parse package.json dependencies: {e}')

    if deps.get('requirements.txt') or deps.get('Pipfile') or deps.get('pyproject.toml'):
        tech_stack['languages']['Python'] = 'primary'

        # Parse requirements.txt for frameworks
        content = deps.get('requirements.txt', '') or deps.get('Pipfile', '') or ''
        framework_mapping = {
            'django': 'Django',
            'flask': 'Flask',
            'fastapi': 'FastAPI',
            'tornado': 'Tornado',
            'celery': 'Celery',
            'sqlalchemy': 'SQLAlchemy',
            'pandas': 'Pandas',
            'numpy': 'NumPy',
            'pytest': 'Pytest',
        }
        for framework_key, framework_name in framework_mapping.items():
            if framework_key.lower() in content.lower() and framework_name not in tech_stack['frameworks']:
                tech_stack['frameworks'].append(framework_name)

    if deps.get('go.mod'):
        tech_stack['languages']['Go'] = 'primary'

    if deps.get('Cargo.toml'):
        tech_stack['languages']['Rust'] = 'primary'

    if deps.get('Gemfile'):
        tech_stack['languages']['Ruby'] = 'primary'
        content = deps.get('Gemfile', '')
        if 'rails' in content.lower():
            tech_stack['frameworks'].append('Ruby on Rails')

    if deps.get('composer.json'):
        tech_stack['languages']['PHP'] = 'primary'
        try:
            composer_data = json.loads(deps['composer.json'])
            require = {**composer_data.get('require', {}), **composer_data.get('require-dev', {})}
            if any('laravel' in key for key in require.keys()):
                tech_stack['frameworks'].append('Laravel')
            if any('symfony' in key for key in require.keys()):
                tech_stack['frameworks'].append('Symfony')
        except Exception as e:
            logger.warning(f'Failed to parse composer.json: {e}')

    # Detect tools from tree
    if any('dockerfile' in p.lower() for p in file_paths):
        tech_stack['tools'].append('Docker')
    if any('docker-compose' in p.lower() for p in file_paths):
        tech_stack['tools'].append('Docker Compose')
    if any('.github/workflows' in p for p in file_paths):
        tech_stack['tools'].append('GitHub Actions')
    if any('.gitlab-ci' in p.lower() for p in file_paths):
        tech_stack['tools'].append('GitLab CI')
    if any('jenkinsfile' in p.lower() for p in file_paths):
        tech_stack['tools'].append('Jenkins')
    if any('terraform' in p.lower() or p.endswith('.tf') for p in file_paths):
        tech_stack['tools'].append('Terraform')
    if any('kubernetes' in p.lower() or 'k8s' in p.lower() for p in file_paths):
        tech_stack['tools'].append('Kubernetes')
    if any('makefile' in p.lower() for p in file_paths):
        tech_stack['tools'].append('Make')

    return tech_stack


def normalize_github_repo_data(owner: str, repo: str, url: str, repo_files: dict) -> dict:
    """
    Normalize GitHub repository data into the shape expected by analyze_github_repo.

    If repo_files doesn't provide repo metadata (stars, description, etc.), this function
    makes a single REST call to https://api.github.com/repos/{owner}/{repo}.

    Args:
        owner: Repository owner
        repo: Repository name
        url: Full GitHub URL
        repo_files: Dictionary with readme, tree, dependencies, tech_stack

    Returns:
        Dictionary with normalized repository metadata
    """
    # Fetch top-level repo metadata via REST if needed
    logger.debug(f'Normalizing GitHub data for {owner}/{repo}')
    logger.debug(f'Input repo_files keys: {list(repo_files.keys())}')
    logger.debug(
        f'README length: {len(repo_files.get("readme", ""))}, '
        f'tree items: {len(repo_files.get("tree", []))}, '
        f'deps: {list(repo_files.get("dependencies", {}).keys())}'
    )

    try:
        with httpx.Client(timeout=GITHUB_API_TIMEOUT) as client:
            resp = client.get(f'https://api.github.com/repos/{owner}/{repo}')
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
                    'owner': owner,
                    'repo': repo,
                    'default_branch': data.get('default_branch', 'main'),
                    # Include full project context for AI analysis
                    'tree': repo_files.get('tree', []),
                    'dependencies': repo_files.get('dependencies', {}),
                    'tech_stack': repo_files.get('tech_stack', {}),
                }
                logger.debug(
                    f'Fetched GitHub API metadata: name={result["name"]}, '
                    f'description={result["description"][:50] if result["description"] else "None"}..., '
                    f'language={result["language"]}, stars={result["stargazers_count"]}, '
                    f'files={len(result["tree"])}, tech_stack={len(result["tech_stack"])}'
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
        'owner': owner,
        'repo': repo,
        'default_branch': 'main',
        # Include full project context even in fallback
        'tree': repo_files.get('tree', []),
        'dependencies': repo_files.get('dependencies', {}),
        'tech_stack': repo_files.get('tech_stack', {}),
    }


def match_or_create_technology(name: str) -> 'Tool | None':
    """
    Match an existing technology or create a minimal one if not found.

    This allows tech stack items detected from GitHub repos to be linked to
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
    # This prevents garbage entries from AI hallucinations
    logger.debug(f'Technology "{normalized_name}" not found in database')
    return None


def apply_ai_metadata(project, analysis: dict, content: dict = None) -> None:
    """
    Apply AI-suggested categories, topics, and tools to a project.

    Extracted from GitHubSyncService._create_project_from_repo.

    IMPORTANT: This function GUARANTEES at least one category is assigned.
    For GitHub repos, defaults to category 9 (Developer & Coding) if AI fails.

    Args:
        project: Project instance to update
        analysis: Dictionary with category_ids, topics, tool_names from AI analysis
        content: Optional project content dict containing tech_stack sections
    """
    from core.taxonomy.models import Taxonomy
    from core.tools.models import Tool

    # Apply categories - MUST have at least one
    categories_added = 0
    for cat_id in analysis.get('category_ids', []):
        try:
            category = Taxonomy.objects.get(id=cat_id, taxonomy_type='category', is_active=True)
            project.categories.add(category)
            categories_added += 1
            logger.info(f'Added category {cat_id} ({category.name}) to project {project.id}')
        except Taxonomy.DoesNotExist:
            logger.warning(f'Category {cat_id} not found, skipping')

    # GUARANTEE at least one category - default to "Developer & Coding" (ID=9) for code projects
    if categories_added == 0:
        try:
            default_category = Taxonomy.objects.get(id=9, taxonomy_type='category', is_active=True)
            project.categories.add(default_category)
            logger.info(f'No AI categories valid, defaulting to "Developer & Coding" for project {project.id}')
        except Taxonomy.DoesNotExist:
            # Last resort: get any active category
            fallback = Taxonomy.objects.filter(taxonomy_type='category', is_active=True).first()
            if fallback:
                project.categories.add(fallback)
                logger.warning(f'Default category not found, using fallback "{fallback.name}" for project {project.id}')

    # Apply topics
    topics = analysis.get('topics', [])
    if topics:
        project.topics = topics[:20]  # Limit to 20
        project.save(update_fields=['topics'])
        logger.info(f'Applied {len(topics[:20])} topics to project {project.id}')

    # Apply AI tools (ChatGPT, Claude, etc.) - try multiple matching strategies
    tools_added = 0
    for tool_name in analysis.get('tool_names', []):
        # Strategy 1: Exact case-insensitive match
        tool = Tool.objects.filter(name__iexact=tool_name).first()

        # Strategy 2: Slug match (e.g., "GitHub Copilot" -> "github-copilot")
        if not tool:
            slug_guess = tool_name.lower().replace(' ', '-')
            tool = Tool.objects.filter(slug__iexact=slug_guess).first()

        # Strategy 3: Partial name match
        if not tool:
            tool = Tool.objects.filter(name__icontains=tool_name).first()

        if tool:
            project.tools.add(tool)
            tools_added += 1
            logger.info(f'Added tool "{tool.name}" to project {project.id}')
        else:
            logger.debug(f'Tool "{tool_name}" not found in database')

    # Apply technologies from tech_stack sections
    tech_added = 0
    if content:
        # Extract technologies from templateVersion 2 sections
        sections = content.get('sections', [])
        for section in sections:
            if section.get('type') == 'tech_stack':
                categories = section.get('content', {}).get('categories', [])
                for category in categories:
                    technologies = category.get('technologies', [])
                    for tech in technologies:
                        # Handle both string and dict formats
                        tech_name = tech.get('name') if isinstance(tech, dict) else tech
                        if tech_name:
                            tool = match_or_create_technology(tech_name)
                            if tool and tool not in project.tools.all():
                                project.tools.add(tool)
                                tech_added += 1
                                logger.info(f'Added technology "{tool.name}" to project {project.id}')

    logger.info(
        f'AI metadata applied: {categories_added} categories, {len(topics)} topics, '
        f'{tools_added} AI tools, {tech_added} technologies'
    )
