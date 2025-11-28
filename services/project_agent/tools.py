"""
LangChain tools for project creation agent.
"""

import logging

import requests
from django.core.cache import cache
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from services.project_service import ProjectService

logger = logging.getLogger(__name__)


# Tool Input Schemas
class CreateProjectInput(BaseModel):
    """Input for create_project tool."""

    title: str = Field(description='The title/name of the project')
    project_type: str = Field(description='Type of project: github_repo, image_collection, prompt, or other')
    description: str = Field(default='', description='Description of the project (optional)')
    is_showcase: bool = Field(default=False, description='Whether to add to showcase (optional)')


class FetchGitHubMetadataInput(BaseModel):
    """Input for fetch_github_metadata tool."""

    url: str = Field(description='GitHub repository URL (e.g., https://github.com/user/repo)')


class ExtractURLInfoInput(BaseModel):
    """Input for extract_url_info tool."""

    text: str = Field(description='Text that may contain URLs')


class ImportGitHubProjectInput(BaseModel):
    """Input for import_github_project tool."""

    url: str = Field(description='GitHub repository URL (e.g., https://github.com/user/repo)')
    is_showcase: bool = Field(default=True, description='Whether to add the project to the showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark the project as private (hidden from public)')


# Tools
@tool(args_schema=CreateProjectInput)
def create_project(
    title: str,
    project_type: str,
    description: str = '',
    is_showcase: bool = False,
    config: RunnableConfig | None = None,
) -> dict:
    """
    Create a new project for the user.

    Use this tool when the user has provided all necessary information
    and confirmed they want to create the project.

    Returns:
        Dictionary with project details or error message
    """
    # Get user_id from config context
    if not config or 'user_id' not in config.get('configurable', {}):
        return {'success': False, 'error': 'User not authenticated'}

    user_id = config['configurable']['user_id']

    # Create project via service
    project, error = ProjectService.create_project(
        user_id=user_id, title=title, project_type=project_type, description=description, is_showcase=is_showcase
    )

    if error:
        return {'success': False, 'error': error}

    return {
        'success': True,
        'project_id': project.id,
        'slug': project.slug,
        'title': project.title,
        'url': f'/{project.user.username}/{project.slug}',
        'message': f"Project '{project.title}' created successfully!",
    }


@tool(args_schema=FetchGitHubMetadataInput)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def fetch_github_metadata(url: str) -> dict:
    """
    Fetch metadata from a GitHub repository URL.

    Use this tool when the user provides a GitHub repository link
    and you want to auto-generate project information.

    Returns:
        Dictionary with repository metadata or error message
    """
    # Validate GitHub URL
    if not ProjectService.is_github_url(url):
        return {'success': False, 'error': 'Invalid GitHub URL'}

    # Cache key for this repo
    cache_key = f'project_agent:github:{url}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        # Extract owner and repo from URL
        # Example: https://github.com/owner/repo
        parts = url.rstrip('/').split('/')
        if len(parts) < 5:
            return {'success': False, 'error': 'Invalid GitHub URL format'}

        owner = parts[-2]
        repo = parts[-1]

        # Fetch from GitHub API with authentication if available
        from django.conf import settings

        api_url = f'https://api.github.com/repos/{owner}/{repo}'
        headers = {}

        github_token = getattr(settings, 'GITHUB_API_TOKEN', None)
        if github_token:
            headers['Authorization'] = f'token {github_token}'

        response = requests.get(api_url, headers=headers, timeout=10)

        if response.status_code == 404:
            return {'success': False, 'error': 'Repository not found'}

        if response.status_code != 200:
            return {'success': False, 'error': f'GitHub API error: {response.status_code}'}

        data = response.json()

        result = {
            'success': True,
            'title': data.get('name', ''),
            'description': data.get('description', ''),
            'language': data.get('language', ''),
            'stars': data.get('stargazers_count', 0),
            'forks': data.get('forks_count', 0),
            'topics': data.get('topics', []),
            'homepage': data.get('homepage', ''),
            'project_type': 'github_repo',
        }

        # Cache successful result for 1 hour
        cache.set(cache_key, result, 3600)
        return result

    except requests.RequestException as e:
        logger.error(f'Error fetching GitHub metadata: {e}')
        return {'success': False, 'error': f'Failed to fetch repository data: {str(e)}'}
    except Exception as e:
        logger.error(f'Unexpected error in fetch_github_metadata: {e}', exc_info=True)
        return {'success': False, 'error': 'An unexpected error occurred'}


@tool(args_schema=ExtractURLInfoInput)
def extract_url_info(text: str) -> dict:
    """
    Extract and analyze URLs from user input text.

    Use this tool when the user's message might contain links
    and you want to detect and categorize them.

    Returns:
        Dictionary with extracted URLs and inferred information
    """
    urls = ProjectService.extract_urls_from_text(text)

    if not urls:
        return {'success': True, 'has_urls': False, 'urls': [], 'message': 'No URLs found in text'}

    # Analyze first URL
    first_url = urls[0]
    inferred_type = ProjectService.infer_project_type_from_url(first_url)
    is_github = ProjectService.is_github_url(first_url)

    return {
        'success': True,
        'has_urls': True,
        'urls': urls,
        'first_url': first_url,
        'is_github': is_github,
        'inferred_type': inferred_type,
        'message': f'Found {len(urls)} URL(s)' + (', including a GitHub repository' if is_github else ''),
    }


@tool(args_schema=ImportGitHubProjectInput)
def import_github_project(
    url: str,
    is_showcase: bool = True,
    is_private: bool = False,
    config: RunnableConfig | None = None,
) -> dict:
    """
    Import a GitHub repository as a portfolio project with full AI analysis.

    This tool:
    1. Uses GitHub MCP to fetch README, file tree, and dependency files
    2. Normalizes that data into the repo_data shape used by analyze_github_repo
    3. Calls analyze_github_repo to get description, categories, topics, tools, and blocks
    4. Creates a structured project page and applies AI-suggested metadata

    Returns:
        Dictionary with success status, project_id, slug, and URL
    """
    from django.contrib.auth import get_user_model

    from core.integrations.github.ai_analyzer import analyze_github_repo
    from core.integrations.github.helpers import (
        apply_ai_metadata,
        get_user_github_token,
        normalize_github_repo_data,
        parse_github_url,
    )
    from core.integrations.github.service import GitHubService
    from core.projects.models import Project

    User = get_user_model()

    # Validate config / user context
    if not config or 'configurable' not in config or 'user_id' not in config['configurable']:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = config['configurable']['user_id']

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Parse and validate URL
    try:
        owner, repo = parse_github_url(url)
    except ValueError as e:
        return {'success': False, 'error': str(e)}

    # Get user's GitHub token
    token = get_user_github_token(user)
    if not token:
        return {
            'success': False,
            'error': 'GitHub account not connected. Please connect GitHub in settings.',
        }

    logger.info(f'Starting GitHub import for {owner}/{repo} by user {user.username}')

    # Fetch repository files/structure via GitHub REST API
    github_service = GitHubService(token)
    repo_files = github_service.get_repository_info_sync(owner, repo)

    # Normalize GitHub output into the schema analyze_github_repo expects
    repo_summary = normalize_github_repo_data(owner, repo, url, repo_files)

    # Run AI analysis
    logger.info(f'Running AI analysis for {owner}/{repo}')
    analysis = analyze_github_repo(
        repo_data=repo_summary,
        readme_content=repo_files.get('readme', ''),
    )

    # Create project with full metadata
    project = Project.objects.create(
        user=user,
        title=repo_summary.get('name', repo),
        description=analysis.get('description') or repo_summary.get('description', ''),
        type=Project.ProjectType.GITHUB_REPO,
        external_url=url,
        content={
            'github': repo_summary,
            'blocks': analysis.get('readme_blocks', []),  # Frontend expects 'blocks'
            'mermaid_diagrams': analysis.get('mermaid_diagrams', []),
            'demo_urls': analysis.get('demo_urls', []),
            'hero_quote': analysis.get('hero_quote', ''),
            'generated_diagram': analysis.get('generated_diagram', ''),
            'tech_stack': repo_files.get('tech_stack', {}),
        },
        is_showcase=is_showcase,
        is_published=not is_private,  # Published unless marked as private
    )

    # Apply AI-suggested categories, topics, tools
    apply_ai_metadata(project, analysis)

    logger.info(f'Successfully imported {owner}/{repo} as project {project.id}')

    return {
        'success': True,
        'project_id': project.id,
        'slug': project.slug,
        'url': f'/{user.username}/{project.slug}',
    }


# Tool list for agent
PROJECT_TOOLS = [create_project, fetch_github_metadata, extract_url_info, import_github_project]
