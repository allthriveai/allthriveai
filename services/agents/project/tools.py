"""
LangChain tools for project creation agent.

Note: Tools that need user context (create_project, import_github_project) receive
a `state` dict injected by the custom tool_node in agent.py. This works around
LangGraph's InjectedState issues with Pydantic args_schema.
"""

import logging

import requests
from django.core.cache import cache
from langchain.tools import tool
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from services.projects import ProjectService

logger = logging.getLogger(__name__)


# Tool Input Schemas (state is injected by custom tool_node, not by LLM)
class CreateProjectInput(BaseModel):
    """Input for create_project tool."""

    title: str = Field(description='The title/name of the project')
    project_type: str = Field(description='Type of project: github_repo, image_collection, prompt, or other')
    description: str = Field(default='', description='Description of the project (optional)')
    is_showcase: bool = Field(default=True, description='Whether to add to showcase (default: True)')
    external_url: str = Field(default='', description='External URL for the project (e.g., GitHub repo URL)')
    language: str = Field(default='', description='Primary programming language (for GitHub repos)')
    topics: list[str] = Field(default_factory=list, description='Topics/tags for the project')
    stars: int = Field(default=0, description='GitHub star count (for display)')
    forks: int = Field(default=0, description='GitHub fork count (for display)')


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


class CreateProductInput(BaseModel):
    """Input for create_product tool."""

    title: str = Field(description='The title/name of the product')
    product_type: str = Field(description='Type of product: course, prompt_pack, template, or ebook')
    description: str = Field(default='', description='Description of the product (optional)')
    price: float = Field(default=0.0, description='Price in USD (0 for free)')
    source_url: str = Field(default='', description='Source URL if imported from YouTube/external')


class ScrapeWebpageInput(BaseModel):
    """Input for scrape_webpage_for_project tool."""

    url: str = Field(description='The URL of the webpage to scrape (e.g., https://example.com/project)')
    is_showcase: bool = Field(default=True, description='Whether to add the project to the showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark the project as private')


# Tools
@tool(args_schema=CreateProjectInput)
def create_project(
    title: str,
    project_type: str,
    description: str = '',
    is_showcase: bool = True,  # Default to showcased
    external_url: str = '',
    language: str = '',
    topics: list[str] | None = None,
    stars: int = 0,
    forks: int = 0,
    state: dict | None = None,
) -> dict:
    """
    Create a new project for the user.

    Use this tool when the user has provided all necessary information
    and confirmed they want to create the project.

    IMPORTANT: When creating from GitHub metadata, pass ALL the fields:
    - external_url: The GitHub repository URL
    - language: Primary programming language
    - topics: Repository topics/tags
    - stars: Star count
    - forks: Fork count

    Returns:
        Dictionary with project details or error message
    """
    # Debug logging
    logger.info(f'create_project called with state: {state}')

    # Get user_id from injected graph state
    if not state or 'user_id' not in state:
        logger.error(f'User not authenticated - state: {state}')
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']

    # Build content dict with GitHub metadata
    content = {}
    if external_url or language or stars or forks:
        content['github'] = {
            'url': external_url,
            'language': language,
            'stars': stars,
            'forks': forks,
        }

    # Create project via service
    logger.info(
        f'Calling ProjectService.create_project: user_id={user_id}, title={title}, '
        f'project_type={project_type}, is_showcase={is_showcase}, external_url={external_url}'
    )
    project, error = ProjectService.create_project(
        user_id=user_id,
        title=title,
        project_type=project_type,
        description=description,
        is_showcase=is_showcase,
        external_url=external_url,
        content=content,
    )

    if error:
        logger.error(f'ProjectService.create_project failed: {error}')
        return {'success': False, 'error': error}

    # Update project with topics if provided
    if topics and project:
        try:
            project.topics = topics[:10]  # Limit to 10 topics
            project.save(update_fields=['topics'])
            logger.info(f'Added topics to project: {topics[:10]}')
        except Exception as e:
            logger.warning(f'Failed to add topics: {e}')

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
    logger.info(f'fetch_github_metadata called with url: {url}')

    # Validate GitHub URL
    if not ProjectService.is_github_url(url):
        logger.warning(f'Invalid GitHub URL: {url}')
        return {'success': False, 'error': 'Invalid GitHub URL'}

    # Cache key for this repo
    cache_key = f'project_agent:github:{url}'
    try:
        cached = cache.get(cache_key)
        if cached:
            return cached
    except Exception as cache_error:
        logger.warning(f'Cache lookup failed (will proceed without cache): {cache_error}')

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
            'description': data.get('description', '') or '',
            'language': data.get('language', '') or '',
            'stars': data.get('stargazers_count', 0),
            'forks': data.get('forks_count', 0),
            'topics': data.get('topics', []),
            'homepage': data.get('homepage', ''),
            'project_type': 'github_repo',
            'external_url': url,  # Include original URL for create_project
        }

        # Cache successful result for 1 hour (graceful - don't fail if cache is down)
        try:
            cache.set(cache_key, result, 3600)
        except Exception as cache_error:
            logger.warning(f'Cache set failed (continuing anyway): {cache_error}')
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
    state: dict | None = None,
) -> dict:
    """
    Import a GitHub repository as a portfolio project with full AI analysis.

    This tool:
    1. Uses GitHub REST API to fetch README, file tree, and dependency files
    2. Normalizes that data into the repo_data shape used by the AI analyzer
    3. Calls analyze_github_repo_for_template to generate structured sections
    4. Creates a project with section-based content for consistent, beautiful display

    Returns:
        Dictionary with success status, project_id, slug, and URL
    """
    from django.contrib.auth import get_user_model

    from core.integrations.github.ai_analyzer import analyze_github_repo_for_template
    from core.integrations.github.helpers import (
        apply_ai_metadata,
        get_user_github_token,
        normalize_github_repo_data,
        parse_github_url,
    )
    from core.integrations.github.service import GitHubService
    from core.projects.models import Project

    User = get_user_model()

    # Validate state / user context
    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']

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

    # Verify user owns or contributed to the repository
    try:
        is_authorized = github_service.verify_repo_access_sync(owner, repo)
        if not is_authorized:
            return {
                'success': False,
                'error': (
                    f'You can only import repositories you own or have contributed to. '
                    f'The repository {owner}/{repo} does not appear to be associated '
                    f'with your GitHub account.'
                ),
            }
    except Exception as e:
        logger.warning(f'Failed to verify repo access for {owner}/{repo}: {e}')
        # If verification fails, allow import but log warning
        # This prevents blocking legitimate imports due to API issues

    repo_files = github_service.get_repository_info_sync(owner, repo)

    # Normalize GitHub output into the schema the AI analyzer expects
    repo_summary = normalize_github_repo_data(owner, repo, url, repo_files)

    # Run AI analysis using the new template-based analyzer
    logger.info(f'Running template-based AI analysis for {owner}/{repo}')
    analysis = analyze_github_repo_for_template(
        repo_data=repo_summary,
        readme_content=repo_files.get('readme', ''),
    )

    # Get hero image from analysis
    hero_image = analysis.get('hero_image', '')
    if not hero_image:
        hero_image = f'https://opengraph.githubassets.com/1/{owner}/{repo}'

    # Build content with template v2 sections
    content = {
        # Template version for frontend to detect new format
        'templateVersion': analysis.get('templateVersion', 2),
        # Structured sections for beautiful, consistent display
        'sections': analysis.get('sections', []),
        # Raw GitHub data for reference/regeneration
        'github': repo_summary,
        # Tech stack for quick reference
        'tech_stack': repo_files.get('tech_stack', {}),
    }

    # Create project with full metadata
    # NOTE: banner_url is left empty (defaults to gradient on frontend)
    #       featured_image_url gets the hero image for cards/sharing
    project = Project.objects.create(
        user=user,
        title=repo_summary.get('name', repo),
        description=analysis.get('description') or repo_summary.get('description', ''),
        type=Project.ProjectType.GITHUB_REPO,
        external_url=url,
        # Set featured image for cards/sharing - banner stays empty (gradient)
        featured_image_url=hero_image,
        # banner_url intentionally left empty - frontend renders gradient
        content=content,
        is_showcased=is_showcase,  # Field is is_showcased, param is is_showcase
        is_private=is_private,
    )

    # Apply AI-suggested categories, topics, tools, and technologies from sections
    apply_ai_metadata(project, analysis, content=content)

    logger.info(
        f'Successfully imported {owner}/{repo} as project {project.id} with {len(content.get("sections", []))} sections'
    )

    return {
        'success': True,
        'project_id': project.id,
        'slug': project.slug,
        'url': f'/{user.username}/{project.slug}',
    }


@tool(args_schema=CreateProductInput)
def create_product(
    title: str,
    product_type: str,
    description: str = '',
    price: float = 0.0,
    source_url: str = '',
    state: dict | None = None,
) -> dict:
    """
    Create a new marketplace product for the user to sell.

    Use this tool when the user wants to create a digital product such as:
    - Courses: Educational content, tutorials, how-to guides
    - Prompt Packs: Curated AI prompts for specific tasks
    - Templates: Reusable frameworks, designs, or tools
    - E-books: Digital books, guides, checklists

    IMPORTANT: Product types must be one of: course, prompt_pack, template, ebook

    Returns:
        Dictionary with product details or error message
    """
    from decimal import Decimal

    from django.contrib.auth import get_user_model

    from core.marketplace.models import CreatorAccount, Product
    from core.projects.models import Project

    User = get_user_model()

    logger.info(f'create_product called with state: {state}')

    # Get user_id from injected graph state
    if not state or 'user_id' not in state:
        logger.error(f'User not authenticated - state: {state}')
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Validate and normalize product type
    product_type_map = {
        'course': Product.ProductType.COURSE,
        'prompt_pack': Product.ProductType.PROMPT_PACK,
        'prompt': Product.ProductType.PROMPT_PACK,  # alias
        'prompts': Product.ProductType.PROMPT_PACK,  # alias
        'template': Product.ProductType.TEMPLATE,
        'ebook': Product.ProductType.EBOOK,
        'e-book': Product.ProductType.EBOOK,  # alias
        'book': Product.ProductType.EBOOK,  # alias
    }

    normalized_type = product_type.lower().replace(' ', '_').replace('-', '_')
    if normalized_type not in product_type_map:
        return {
            'success': False,
            'error': f'Invalid product type "{product_type}". Must be one of: course, prompt_pack, template, ebook',
        }

    django_product_type = product_type_map[normalized_type]

    # Determine source type from URL if provided
    source_type = ''
    if source_url:
        if 'youtube.com' in source_url or 'youtu.be' in source_url:
            source_type = 'youtube'
        elif 'github.com' in source_url:
            source_type = 'github'
        else:
            source_type = 'external'

    logger.info(f'Creating product: user_id={user_id}, title={title}, type={django_product_type}, price={price}')

    try:
        # Create the underlying project for content storage
        project = Project.objects.create(
            user=user,
            title=title,
            description=description,
            type=Project.ProjectType.PRODUCT,
            is_product=True,
            is_private=True,  # Start as draft (private)
            external_url=source_url if source_url else '',
            content={},
        )

        # Ensure creator account exists
        CreatorAccount.objects.get_or_create(user=user)

        # Create the product
        product = Product.objects.create(
            project=project,
            creator=user,
            product_type=django_product_type,
            price=Decimal(str(price)),
            status=Product.Status.DRAFT,
            source_type=source_type,
            source_url=source_url if source_url else '',
        )

        logger.info(f'Product created successfully: id={product.id}, project_id={project.id}')

        # Build human-readable product type for message
        type_display = {
            'course': 'Course',
            'prompt_pack': 'Prompt Pack',
            'template': 'Template',
            'ebook': 'E-Book',
        }

        return {
            'success': True,
            'product_id': product.id,
            'project_id': project.id,
            'slug': project.slug,
            'title': project.title,
            'product_type': django_product_type,
            'price': float(price),
            'url': f'/creator/{project.slug}',
            'message': f"{type_display.get(django_product_type, 'Product')} '{project.title}' created as a draft! "
            f'You can now edit it and add content before publishing.',
        }

    except Exception as e:
        logger.exception(f'Error creating product: {e}')
        return {'success': False, 'error': f'Failed to create product: {str(e)}'}


@tool(args_schema=ScrapeWebpageInput)
def scrape_webpage_for_project(
    url: str,
    is_showcase: bool = True,
    is_private: bool = False,
    state: dict | None = None,
) -> dict:
    """
    Scrape any webpage and create a project with full AI analysis.

    Use this tool when the user provides a NON-GITHUB URL and wants to
    import it as a project. This uses AI to:
    - Extract title, description, and metadata
    - Generate structured sections (overview, features, tech stack, etc.)
    - Assign categories, topics, and tools
    - Create a beautiful portfolio page like GitHub imports

    For GitHub URLs, use import_github_project instead.

    Returns:
        Dictionary with success status, project details, or error message
    """
    from dataclasses import asdict

    from django.contrib.auth import get_user_model

    from core.integrations.github.helpers import apply_ai_metadata
    from core.projects.models import Project
    from services.url_import import (
        URLScraperError,
        analyze_webpage_for_template,
        scrape_url_for_project,
    )
    from services.url_import.scraper import fetch_webpage, html_to_text

    User = get_user_model()

    # Validate state / user context
    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Check if this is a GitHub URL - should use import_github_project instead
    if 'github.com' in url.lower():
        return {
            'success': False,
            'error': 'This is a GitHub URL. Please use import_github_project instead for richer analysis.',
            'is_github': True,
        }

    logger.info(f'Scraping webpage for project: {url} (user: {user.username})')

    try:
        # Scrape the webpage using AI extraction
        extracted = scrape_url_for_project(url)

        # Get raw text content for deeper analysis
        try:
            html_content = fetch_webpage(url)
            text_content = html_to_text(html_content)
        except Exception as e:
            logger.warning(f'Failed to get text content for template analysis: {e}')
            text_content = ''

        # Build extracted data dict for template analysis
        extracted_dict = {
            'title': extracted.title,
            'description': extracted.description,
            'topics': extracted.topics or [],
            'features': extracted.features or [],
            'organization': extracted.organization,
            'source_url': url,
            'image_url': extracted.image_url,
            'links': extracted.links or {},
        }

        # Run template analysis for structured sections
        logger.info(f'Running template analysis for {url}')
        analysis = analyze_webpage_for_template(
            extracted_data=extracted_dict,
            text_content=text_content,
            user=user,
        )

        # Get hero image from analysis
        hero_image = analysis.get('hero_image') or extracted.image_url or ''

        # Build content with template v2 sections
        content = {
            # Template version for frontend to detect new format
            'templateVersion': analysis.get('templateVersion', 2),
            # Structured sections for beautiful, consistent display
            'sections': analysis.get('sections', []),
            # Raw scraped data for reference
            'scraped_data': asdict(extracted),
            # Source URL
            'source_url': url,
        }

        # Add features if extracted
        if extracted.features:
            content['features'] = extracted.features

        # Add links if extracted
        if extracted.links:
            content['links'] = extracted.links

        # Create the project with full metadata
        project = Project.objects.create(
            user=user,
            title=extracted.title or 'Imported Project',
            description=analysis.get('description') or extracted.description or '',
            type=Project.ProjectType.OTHER,
            external_url=url,
            featured_image_url=hero_image,
            content=content,
            is_showcased=is_showcase,
            is_private=is_private,
        )

        # Apply AI-suggested categories, topics, and tools
        apply_ai_metadata(project, analysis, content=content)

        logger.info(
            f'Successfully imported {url} as project {project.id} ' f'with {len(content.get("sections", []))} sections'
        )

        return {
            'success': True,
            'project_id': project.id,
            'slug': project.slug,
            'title': project.title,
            'url': f'/{user.username}/{project.slug}',
            'message': f"Project '{project.title}' imported successfully from {url}!",
            'extracted': {
                'title': extracted.title,
                'description': extracted.description[:200] if extracted.description else None,
                'image_url': hero_image,
                'topics': analysis.get('topics', extracted.topics),
                'sections_count': len(content.get('sections', [])),
            },
        }

    except URLScraperError as e:
        logger.error(f'Failed to scrape URL {url}: {e}')
        return {'success': False, 'error': f'Could not import from URL: {str(e)}'}
    except Exception as e:
        logger.exception(f'Unexpected error importing from URL {url}: {e}')
        return {'success': False, 'error': f'Failed to create project: {str(e)}'}


# Tool list for agent
# Note: fetch_github_metadata is kept for potential future use but not exposed to agent
# GitHub imports require OAuth via import_github_project for ownership verification
PROJECT_TOOLS = [create_project, extract_url_info, import_github_project, scrape_webpage_for_project, create_product]
