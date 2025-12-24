"""
LangChain tools for project creation agent.

Note: Tools that need user context (create_project, import_github_project) receive
a `state` dict injected by the custom tool_node in agent.py. This works around
LangGraph's InjectedState issues with Pydantic args_schema.
"""

import logging
from urllib.parse import urlparse

import requests
from django.core.cache import cache
from langchain.tools import tool
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from core.projects.topic_utils import set_project_topics
from services.projects import ProjectService

logger = logging.getLogger(__name__)


# =============================================================================
# Domain Detection Helper
# =============================================================================
def _detect_url_domain_type(url: str) -> str:
    """
    Detect the domain type of a URL for smart routing.

    Returns: 'github', 'gitlab', 'youtube', 'figma', or 'generic'
    """
    try:
        parsed = urlparse(url.lower())
        domain = parsed.netloc.replace('www.', '')

        if domain in ('github.com',):
            return 'github'
        elif domain in ('gitlab.com',):
            return 'gitlab'
        elif domain in ('youtube.com', 'youtu.be'):
            return 'youtube'
        elif domain in ('figma.com',) or domain.endswith('.figma.site'):
            return 'figma'
        else:
            return 'generic'
    except Exception:
        return 'generic'


# Tool Input Schemas (state is injected by custom tool_node, not by LLM)
class CreateProjectInput(BaseModel):
    """Input for create_project tool."""

    model_config = {'extra': 'allow'}

    title: str = Field(description='The title/name of the project')
    project_type: str = Field(description='Type of project: github_repo, image_collection, prompt, or other')
    description: str = Field(default='', description='Description of the project (optional)')
    is_showcase: bool = Field(default=True, description='Whether to add to showcase (default: True)')
    external_url: str = Field(default='', description='External URL for the project (e.g., GitHub repo URL)')
    featured_image_url: str = Field(default='', description='URL of the hero/featured image or video for the project')
    language: str = Field(default='', description='Primary programming language (for GitHub repos)')
    topics: list[str] = Field(default_factory=list, description='Topics/tags for the project')
    stars: int = Field(default=0, description='GitHub star count (for display)')
    forks: int = Field(default=0, description='GitHub fork count (for display)')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class FetchGitHubMetadataInput(BaseModel):
    """Input for fetch_github_metadata tool."""

    url: str = Field(description='GitHub repository URL (e.g., https://github.com/user/repo)')


class ExtractURLInfoInput(BaseModel):
    """Input for extract_url_info tool."""

    text: str = Field(description='Text that may contain URLs')


class ImportGitHubProjectInput(BaseModel):
    """Input for import_github_project tool."""

    model_config = {'extra': 'allow'}

    url: str = Field(description='GitHub repository URL (e.g., https://github.com/user/repo)')
    is_showcase: bool = Field(default=True, description='Whether to add the project to the showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark the project as private (hidden from public)')
    is_owned: bool = Field(
        default=True,
        description='Whether the user owns/created this project (True) or is clipping external content (False)',
    )
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class CreateProductInput(BaseModel):
    """Input for create_product tool."""

    model_config = {'extra': 'allow'}

    title: str = Field(description='The title/name of the product')
    product_type: str = Field(description='Type of product: course, prompt_pack, template, or ebook')
    description: str = Field(default='', description='Description of the product (optional)')
    price: float = Field(default=0.0, description='Price in USD (0 for free)')
    source_url: str = Field(default='', description='Source URL if imported from YouTube/external')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class CreatePromptInput(BaseModel):
    """Input for create_prompt tool - saves a prompt to user's prompt library."""

    model_config = {'extra': 'allow'}

    title: str = Field(description='A short, descriptive title for the prompt (e.g., "Blog Post Outline Generator")')
    prompt_text: str = Field(
        description=(
            'The full prompt text that the user wants to save. ' 'This is the actual prompt they use with AI tools.'
        )
    )
    description: str = Field(
        default='',
        description='Optional description explaining what the prompt does or when to use it',
    )
    tool_names: list[str] = Field(
        default_factory=list,
        description='AI tools this prompt works well with (e.g., ["ChatGPT", "Claude", "Midjourney"])',
    )
    topics: list[str] = Field(
        default_factory=list,
        description='Topics/tags for categorizing the prompt (e.g., ["writing", "marketing", "productivity"])',
    )
    is_private: bool = Field(
        default=False,
        description='Whether the prompt should be private (only visible to the user) or public (shared with community)',
    )
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class ScrapeWebpageInput(BaseModel):
    """Input for scrape_webpage_for_project tool."""

    model_config = {'extra': 'allow'}

    url: str = Field(description='The URL of the webpage to scrape (e.g., https://example.com/project)')
    is_showcase: bool = Field(default=True, description='Whether to add the project to the showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark the project as private')
    is_owned: bool = Field(
        default=True,
        description='Whether the user owns/created this project (True) or is clipping external content (False)',
    )
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class ImportVideoProjectInput(BaseModel):
    """Input for import_video_project tool."""

    model_config = {'extra': 'allow'}

    video_url: str = Field(description='The S3/MinIO URL of the uploaded video file')
    filename: str = Field(description='Original filename of the video (e.g., "my-tutorial.mp4")')
    title: str = Field(default='', description='Optional title for the project (auto-generated if not provided)')
    is_owned: bool = Field(default=True, description='True if user created the video, False if clipping')
    tool_hint: str = Field(default='', description='Tool mentioned by user (e.g., "Runway", "Midjourney", "Pika")')
    is_showcase: bool = Field(default=True, description='Whether to add the project to the showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark the project as private')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class CreateMediaProjectInput(BaseModel):
    """
    Unified input for create_media_project tool.

    Handles THREE scenarios:
    1. GENERATION: User wants to create an image with Gemini (generate_prompt provided)
    2. FILE IMPORT: User uploaded a file (file_url provided) - images, videos, gifs
    3. VIDEO URL IMPORT: User pasted a video URL (video_url provided) - YouTube, Vimeo, Loom

    CRITICAL: If file_url is present, it's ALWAYS an import, NEVER generation.
    """

    model_config = {'extra': 'allow'}

    # For GENERATION (Gemini) - user wants to create new content
    generate_prompt: str | None = Field(
        default=None,
        description=(
            'Prompt to generate an image with Gemini. '
            'Use ONLY when user explicitly asks to create/generate an image. '
            'Examples: "Make an infographic about AI", "Generate an image of a sunset"'
        ),
    )

    # For FILE IMPORT (AI Gateway) - user uploaded their own file
    file_url: str | None = Field(
        default=None,
        description=(
            'S3/MinIO URL of uploaded file. '
            'CRITICAL: If this is present, it is an IMPORT, never generation. '
            'Detected by: [image: filename](url) or [video: filename](url) in message'
        ),
    )
    filename: str | None = Field(
        default=None,
        description='Original filename (e.g., "my-art.png", "demo.mp4")',
    )

    # For VIDEO URL IMPORT (AI Gateway) - user pasted a video URL
    video_url: str | None = Field(
        default=None,
        description='Video URL from YouTube, Vimeo, or Loom to import as a project',
    )

    # Common fields
    title: str | None = Field(
        default=None,
        description=(
            'Title for the project. OPTIONAL for images/gifs - AI will auto-generate a creative title from the image. '
            'Required for videos. If user explicitly provides a title, use it.'
        ),
    )
    tool_hint: str | None = Field(
        default=None,
        description=(
            'Tool used to create this content (e.g., "Midjourney", "Runway", "Photoshop"). '
            'For generation, auto-set to "Gemini". '
            'For imports, ask user if not provided.'
        ),
    )

    is_owned: bool = Field(
        default=True,
        description=(
            'Whether the user created/owns this content (True) or is clipping something cool they found (False). '
            'IMPORTANT: Ask the user before assuming ownership! '
            'True = "my project", False = "something cool I found"'
        ),
    )
    is_showcase: bool = Field(default=True, description='Whether to add to showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark as private')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class ImportFromURLInput(BaseModel):
    """Input for import_from_url unified tool."""

    # Allow extra fields for runtime state injection
    model_config = {'extra': 'allow'}

    url: str = Field(description='Any URL to import (GitHub, YouTube, Figma, or any webpage)')
    is_owned: bool | None = Field(
        default=None,
        description=(
            'Whether the user owns this content. '
            'For GitHub/YouTube URLs, leave as None - ownership is auto-detected. '
            'For other URLs, set True if user owns it, False if clipping.'
        ),
    )
    is_showcase: bool = Field(default=True, description='Whether to add the project to the showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark the project as private')
    force_clip: bool = Field(
        default=False,
        description=(
            'For GitHub URLs only: Set to True to clip the repo without GitHub connection. '
            'Use when user explicitly chooses to clip instead of connecting GitHub.'
        ),
    )
    # State is injected at runtime by the agent, not provided by the LLM
    # Note: This field is required for runtime injection to work with tool.invoke()
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class RegenerateArchitectureDiagramInput(BaseModel):
    """Input for regenerate_architecture_diagram tool."""

    model_config = {'extra': 'allow'}

    project_id: int = Field(description='The ID of the project to update')
    architecture_description: str = Field(
        description=(
            "User's plain English description of the system architecture. "
            'Should describe the main components and how they connect to each other.'
        )
    )
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class CreateProjectFromScreenshotInput(BaseModel):
    """Input for create_project_from_screenshot tool - fallback when URL scraping fails."""

    model_config = {'extra': 'allow'}

    screenshot_url: str = Field(description='The S3/MinIO URL of the uploaded screenshot image')
    screenshot_filename: str = Field(description='Original filename of the screenshot (e.g., "screenshot.png")')
    original_url: str = Field(default='', description='The original URL that failed to scrape (stored as external_url)')
    title: str = Field(
        default='', description='Optional title for the project (extracted from screenshot if not provided)'
    )
    is_showcase: bool = Field(default=True, description='Whether to add the project to the showcase tab')
    is_private: bool = Field(default=False, description='Whether to mark the project as private')
    is_owned: bool = Field(
        default=True,
        description='Whether the user owns/created this project (True) or is clipping external content (False)',
    )
    state: dict | None = Field(default=None, description='Internal - injected by agent')


# Tools
@tool(args_schema=CreateProjectInput)
def create_project(
    title: str,
    project_type: str,
    description: str = '',
    is_showcase: bool = True,  # Default to showcased
    external_url: str = '',
    featured_image_url: str = '',
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

    For file uploads (images, videos), pass:
    - featured_image_url: The S3/MinIO URL of the uploaded file

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
        f'project_type={project_type}, is_showcase={is_showcase}, external_url={external_url}, '
        f'featured_image_url={featured_image_url}'
    )
    project, error = ProjectService.create_project(
        user_id=user_id,
        title=title,
        project_type=project_type,
        description=description,
        is_showcase=is_showcase,
        featured_image_url=featured_image_url,
        external_url=external_url,
        content=content,
    )

    if error:
        logger.error(f'ProjectService.create_project failed: {error}')
        return {'success': False, 'error': error}

    # Update project with topics if provided (using M2M helper)
    if topics and project:
        try:
            set_project_topics(project, topics[:10])  # Limit to 10 topics
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
    is_owned: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Import a GitHub repository as a portfolio project with full AI analysis.

    IMPORTANT: Only use this tool when user OWNS the repository (is_owned=True).
    For CLIPPING GitHub repos the user doesn't own, use scrape_webpage_for_project instead
    (it works with GitHub URLs and doesn't require OAuth).

    This tool requires GitHub OAuth and verifies the user owns/contributed to the repo.

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

    # If explicitly marked as clipping, delegate immediately
    if not is_owned:
        logger.info(f'Delegating GitHub clipping to scrape_webpage_for_project: {url}')
        return scrape_webpage_for_project.func(
            url=url,
            is_showcase=is_showcase,
            is_private=is_private,
            is_owned=False,
            state=state,
        )

    # Try to import as owned - check if user has GitHub connected
    token = get_user_github_token(user)
    if not token:
        # No GitHub connected - auto-fallback to clipping
        logger.info(f'No GitHub token, auto-clipping {owner}/{repo}')
        result = scrape_webpage_for_project.func(
            url=url,
            is_showcase=is_showcase,
            is_private=is_private,
            is_owned=False,
            state=state,
        )
        if result.get('success'):
            result['auto_clipped'] = True
            result['message'] = (
                "I noticed you don't have GitHub connected, so I've added this to your "
                'clippings as a saved project. You can find it in your Clipped tab!'
            )
        return result

    logger.info(f'Starting GitHub import for {owner}/{repo} by user {user.username}')

    # Fetch repository files/structure via GitHub REST API
    github_service = GitHubService(token)

    # Verify ownership - auto-fallback to clipping if not owned
    try:
        is_authorized = github_service.verify_repo_access_sync(owner, repo)
        if not is_authorized:
            # Auto-fallback to clipping instead of failing
            logger.info(f'User does not own {owner}/{repo}, auto-clipping instead')
            result = scrape_webpage_for_project.func(
                url=url,
                is_showcase=is_showcase,
                is_private=is_private,
                is_owned=False,
                state=state,
            )
            if result.get('success'):
                result['auto_clipped'] = True
                result['message'] = (
                    "Looks like you don't own this repository, so I've added it to your "
                    'clippings as a saved project instead. You can find it in your Clipped tab!'
                )
            return result
        logger.info(f'Verified ownership for {owner}/{repo}: is_owned=True')
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
    # Determine project type based on ownership
    project_type = Project.ProjectType.GITHUB_REPO if is_owned else Project.ProjectType.CLIPPED
    project = Project.objects.create(
        user=user,
        title=repo_summary.get('name', repo),
        description=analysis.get('description') or repo_summary.get('description', ''),
        type=project_type,
        external_url=url,
        # Set featured image for cards/sharing - banner stays empty (gradient)
        featured_image_url=hero_image,
        # banner_url intentionally left empty - frontend renders gradient
        content=content,
        is_showcased=is_showcase,  # Field is is_showcased, param is is_showcase
        is_private=is_private,
        tools_order=[],  # Initialize empty tools order (required field)
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
            tools_order=[],  # Initialize empty tools order (required field)
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
    is_owned: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Scrape any webpage and create a project with full AI analysis.

    Use this tool when:
    - User provides ANY non-GitHub URL
    - User wants to CLIP a GitHub URL (is_owned=False) - no OAuth needed!

    This tool uses AI to:
    - Extract title, description, and metadata
    - Generate structured sections (overview, features, tech stack, etc.)
    - Assign categories, topics, and tools
    - Create a beautiful portfolio page

    For GitHub URLs where user OWNS the repo (is_owned=True), use import_github_project
    for richer analysis with README parsing. But for CLIPPING GitHub repos, use THIS tool.

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

    # For GitHub URLs, only allow scraping when clipping (is_owned=False)
    # If user claims ownership, they should use import_github_project for richer analysis
    if 'github.com' in url.lower() and is_owned:
        return {
            'success': False,
            'error': (
                'For your own GitHub repositories, please use import_github_project '
                'for richer analysis with README parsing and tech stack detection.'
            ),
            'is_github': True,
        }

    # For GitHub clippings, log that we're using scraper (no OAuth needed)
    if 'github.com' in url.lower():
        logger.info(f'Scraping GitHub URL as clipping (no OAuth needed): {url}')

    logger.info(f'Scraping webpage for project: {url} (user: {user.username})')

    try:
        # Scrape the webpage using AI extraction (pass user_id for Figma screenshot S3 upload)
        extracted = scrape_url_for_project(url, user_id=user.id)

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
            'images': extracted.images or [],  # All images from page for gallery
            'videos': extracted.videos or [],  # Embedded videos (YouTube, Vimeo, etc.)
            'links': extracted.links or {},
            'published_date': extracted.published_date,
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
        # Determine project type based on ownership
        project_type = Project.ProjectType.OTHER if is_owned else Project.ProjectType.CLIPPED
        project = Project.objects.create(
            user=user,
            title=extracted.title or 'Imported Project',
            description=analysis.get('description') or extracted.description or '',
            type=project_type,
            external_url=url,
            featured_image_url=hero_image,
            content=content,
            is_showcased=is_showcase,
            is_private=is_private,
            tools_order=[],  # Initialize empty tools order (required field)
        )

        # Apply AI-suggested categories, topics, and tools
        apply_ai_metadata(project, analysis, content=content)

        logger.info(
            f'Successfully imported {url} as project {project.id} with {len(content.get("sections", []))} sections'
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
        return {
            'success': False,
            'error': f'Could not import from URL: {str(e)}',
            'suggest_screenshot': True,
            'failed_url': url,
            'message': (
                "I couldn't access that URL. The site may be blocking automated access. "
                'Would you like to upload a screenshot of the page instead? '
                'I can analyze it to create a project for you.'
            ),
        }
    except Exception as e:
        logger.exception(f'Unexpected error importing from URL {url}: {e}')
        return {'success': False, 'error': f'Failed to create project: {str(e)}'}


@tool(args_schema=ImportVideoProjectInput)
def import_video_project(
    video_url: str,
    filename: str,
    title: str = '',
    is_owned: bool = True,
    tool_hint: str = '',
    is_showcase: bool = True,
    is_private: bool = False,
    state: dict | None = None,
) -> dict:
    """
    Import an uploaded video file as a beautifully designed project with full AI analysis.

    This tool creates a video project with:
    1. AI-generated title, description, and metadata (from filename/context)
    2. Auto-detected categories, topics, and tools
    3. Structured content sections for beautiful display
    4. The video embedded as the hero element

    Use this tool when the user uploads a video file directly (S3/MinIO URL detected).
    DO NOT use for YouTube URLs - those should use scrape_webpage_for_project.

    Returns:
        Dictionary with success status, project_id, slug, URL, and generated metadata
    """
    from django.contrib.auth import get_user_model

    from core.integrations.github.helpers import apply_ai_metadata
    from core.integrations.video.ai_analyzer import analyze_video_for_template
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

    logger.info(f'Starting video import for {filename} by user {user.username}')

    # Determine file type from filename
    file_extension = filename.lower().split('.')[-1] if '.' in filename else 'mp4'
    file_type_map = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'webm': 'video/webm',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'm4v': 'video/x-m4v',
    }
    file_type = file_type_map.get(file_extension, 'video/mp4')

    # Build user context from title and tool hint
    context_parts = []
    if title:
        context_parts.append(f'Title: {title}')
    if tool_hint:
        context_parts.append(f'Tool used: {tool_hint}')
    user_context = '. '.join(context_parts)

    # Run AI analysis to generate metadata
    logger.info(f'Running AI analysis for video: {filename} (tool_hint={tool_hint})')
    analysis = analyze_video_for_template(
        video_url=video_url,
        filename=filename,
        file_type=file_type,
        user_context=user_context,
        user=user,
    )

    # If user specified a tool, ensure it's included in the tool_names
    if tool_hint:
        tool_names = analysis.get('tool_names', [])
        # Check if tool hint is already in the list (case-insensitive)
        if not any(tool_hint.lower() in t.lower() or t.lower() in tool_hint.lower() for t in tool_names):
            tool_names.insert(0, tool_hint)  # Add user's tool first
            analysis['tool_names'] = tool_names
            logger.info(f'Added user-specified tool "{tool_hint}" to project')

    # Use provided title or AI-generated title
    project_title = title if title else analysis.get('title', filename)

    # Build content with template v2 sections + video data
    content = {
        'templateVersion': 2,
        'sections': analysis.get('sections', []),
        'video': {
            'url': video_url,
            'filename': filename,
            'fileType': file_type,
        },
    }

    # Determine project type based on ownership
    project_type = Project.ProjectType.VIDEO if is_owned else Project.ProjectType.CLIPPED

    # Create project with full metadata
    project = Project.objects.create(
        user=user,
        title=project_title,
        description=analysis.get('description', ''),
        type=project_type,
        # Don't set featured_image_url for video uploads - the video player handles display
        # Setting video URL here causes HeroImage to render broken <img> tag with video src
        featured_image_url='',
        content=content,
        is_showcased=is_showcase,
        is_private=is_private,
        tools_order=[],  # Initialize empty tools order (required field)
    )

    # Apply AI-suggested categories, topics, and tools
    apply_ai_metadata(project, analysis, content=content)

    logger.info(f'Successfully created video project {project.id} with {len(content.get("sections", []))} sections')

    return {
        'success': True,
        'project_id': project.id,
        'slug': project.slug,
        'title': project.title,
        'url': f'/{user.username}/{project.slug}',
        'message': f"Video project '{project.title}' created successfully!",
        'metadata': {
            'description': analysis.get('description', '')[:200],
            'categories': analysis.get('category_ids', []),
            'topics': analysis.get('topics', []),
            'tools': analysis.get('tool_names', []),
            'sections_count': len(content.get('sections', [])),
        },
    }


# =============================================================================
# Unified Media Project Tool
# =============================================================================
def _detect_media_type(filename: str) -> str:
    """Detect media type from filename extension."""
    if not filename:
        return 'unknown'
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    if ext in ('mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'):
        return 'video'
    elif ext == 'gif':
        return 'gif'
    elif ext in ('jpg', 'jpeg', 'png', 'webp', 'svg', 'bmp'):
        return 'image'
    else:
        return 'unknown'


def _is_video_url(url: str) -> bool:
    """Check if URL is from a video hosting platform."""
    if not url:
        return False
    url_lower = url.lower()
    video_domains = ('youtube.com', 'youtu.be', 'vimeo.com', 'loom.com')
    return any(domain in url_lower for domain in video_domains)


@tool(args_schema=CreateMediaProjectInput)
def create_media_project(
    generate_prompt: str | None = None,
    file_url: str | None = None,
    filename: str | None = None,
    video_url: str | None = None,
    title: str | None = None,
    tool_hint: str | None = None,
    is_owned: bool = True,
    is_showcase: bool = True,
    is_private: bool = False,
    state: dict | None = None,
) -> dict:
    """
    Unified tool for creating media projects - handles generation AND import.

    ROUTING LOGIC:
    1. If file_url is present → IMPORT FLOW (NEVER generation)
       - User uploaded an image, video, or gif
       - Only tool_hint required - AI auto-generates title for ALL media types!
       - For images/gifs: AI vision analyzes and generates creative titles
       - For videos: AI generates titles from filename + user context
       - Create project with uploaded file

    2. If video_url is present → VIDEO URL IMPORT FLOW
       - User pasted a YouTube/Vimeo/Loom URL
       - Extract metadata and create project

    3. If generate_prompt is present (and NO file_url) → GENERATION FLOW
       - User wants to create an image with Gemini
       - Generate image, then create project

    CRITICAL: file_url takes priority - if present, it's ALWAYS an import.

    AI AUTO-GENERATION (for images/gifs):
    - Title: AI vision analyzes the image and creates a creative, catchy title
    - Description, topics, categories: All auto-generated from image content
    - User only needs to provide: ownership (is_owned) and tool used (tool_hint)

    Returns:
        - If missing required info: {success: False, needs_user_input: True, missing: [...]}
        - If successful: {success: True, project_id, slug, url, ...}
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()

    # Validate state / user context
    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    _ = state.get('username', '')  # Reserved for future use

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # ==========================================================================
    # FLOW 1: FILE IMPORT (image, video, gif uploaded by user)
    # ==========================================================================
    if file_url:
        # Validate URL format
        if not file_url.startswith(('http://', 'https://')):
            return {'success': False, 'error': f'Invalid file URL format: {file_url}'}

        logger.info(f'create_media_project: FILE IMPORT flow for {filename}')

        media_type = _detect_media_type(filename or '')

        # Check if we need user input
        # For ALL media types: only require tool_hint - AI will generate title automatically
        # Videos can also have AI-generated titles from filename + user context
        if not tool_hint:
            return {
                'success': False,
                'needs_user_input': True,
                'missing': ['tool_hint'],
                'media_type': media_type,
                'file_url': file_url,
                'filename': filename,
                'message': 'What tool did you use to create this? (e.g., Runway, Midjourney, DALL-E, Photoshop)',
            }

        # For videos, use the existing video import logic
        if media_type == 'video':
            # Reuse the import_video_project logic internally
            return _create_video_project_internal(
                video_url=file_url,
                filename=filename or 'video.mp4',
                title=title,
                tool_hint=tool_hint,
                is_owned=is_owned,
                is_showcase=is_showcase,
                is_private=is_private,
                user=user,
            )

        # For images/gifs, create an image project
        return _create_image_project_internal(
            image_url=file_url,
            filename=filename or 'image.png',
            title=title,
            tool_hint=tool_hint,
            is_owned=is_owned,
            is_showcase=is_showcase,
            is_private=is_private,
            user=user,
        )

    # ==========================================================================
    # FLOW 2: VIDEO URL IMPORT (YouTube, Vimeo, Loom)
    # ==========================================================================
    if video_url and _is_video_url(video_url):
        logger.info(f'create_media_project: VIDEO URL flow for {video_url}')

        # For video URLs, we can extract metadata automatically
        # Use the existing import_from_url logic for YouTube
        domain_type = _detect_url_domain_type(video_url)

        if domain_type == 'youtube':
            return _handle_youtube_import(
                url=video_url,
                user=user,
                is_showcase=is_showcase,
                is_private=is_private,
            )

        # For Vimeo/Loom, use generic scraper
        return _handle_generic_import(
            url=video_url,
            user=user,
            is_owned=is_owned,
            is_showcase=is_showcase,
            is_private=is_private,
        )

    # ==========================================================================
    # FLOW 3: GENERATION (create image with Gemini)
    # ==========================================================================
    if generate_prompt:
        logger.info(f'create_media_project: GENERATION flow for prompt: {generate_prompt[:50]}...')

        # For generation, we need a title
        if not title:
            return {
                'success': False,
                'needs_user_input': True,
                'missing': ['title'],
                'generate_prompt': generate_prompt,
                'message': 'What would you like to call this project once I generate it?',
            }

        # Generate image with Gemini
        # Note: This delegates to the existing image generation system
        # which handles the Gemini API call, upload to MinIO, etc.
        return _generate_and_create_project(
            prompt=generate_prompt,
            title=title,
            user=user,
            is_showcase=is_showcase,
            is_private=is_private,
        )

    # No valid input provided
    return {
        'success': False,
        'error': (
            'No media source provided. Either upload a file (file_url), '
            'paste a video URL (video_url), or describe an image to generate (generate_prompt).'
        ),
    }


def _create_video_project_internal(
    video_url: str,
    filename: str,
    title: str,
    tool_hint: str | None,
    is_owned: bool,
    is_showcase: bool,
    is_private: bool,
    user,
) -> dict:
    """Internal helper to create a video project (reuses import_video_project logic)."""
    from core.integrations.github.helpers import apply_ai_metadata
    from core.integrations.video.ai_analyzer import analyze_video_for_template
    from core.projects.models import Project

    logger.info(f'Creating video project: {title} from {filename} (is_owned={is_owned})')

    # Determine file type
    file_extension = filename.lower().split('.')[-1] if '.' in filename else 'mp4'
    file_type_map = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'webm': 'video/webm',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'm4v': 'video/x-m4v',
    }
    file_type = file_type_map.get(file_extension, 'video/mp4')

    # Build context
    context_parts = []
    if title:
        context_parts.append(f'Title: {title}')
    if tool_hint:
        context_parts.append(f'Tool used: {tool_hint}')
    user_context = '. '.join(context_parts)

    # AI analysis with error handling
    try:
        analysis = analyze_video_for_template(
            video_url=video_url,
            filename=filename,
            file_type=file_type,
            user_context=user_context,
            user=user,
        )
        if not analysis:
            analysis = {}
    except Exception as e:
        logger.warning(f'Video analysis failed for {filename}: {e}')
        analysis = {}

    # Ensure required fields have defaults
    analysis.setdefault('sections', [])
    analysis.setdefault('title', title or filename)
    analysis.setdefault('description', '')
    analysis.setdefault('tool_names', [])

    # Add user's tool hint
    if tool_hint:
        tool_names = analysis.get('tool_names', [])
        if not any(tool_hint.lower() in t.lower() for t in tool_names):
            tool_names.insert(0, tool_hint)
            analysis['tool_names'] = tool_names

    # Build content
    content = {
        'templateVersion': 2,
        'sections': analysis.get('sections', []),
        'video': {
            'url': video_url,
            'filename': filename,
            'fileType': file_type,
        },
    }

    # Use CLIPPED type if user didn't create this (clipping external content)
    project_type = Project.ProjectType.VIDEO if is_owned else Project.ProjectType.CLIPPED

    # Create project
    project = Project.objects.create(
        user=user,
        title=title or analysis.get('title', filename),
        description=analysis.get('description', ''),
        type=project_type,
        featured_image_url='',
        content=content,
        is_showcased=is_showcase,
        is_private=is_private,
        tools_order=[],
    )

    apply_ai_metadata(project, analysis, content=content)

    action_word = 'created' if is_owned else 'clipped'
    return {
        'success': True,
        'project_id': project.id,
        'slug': project.slug,
        'title': project.title,
        'url': f'/{user.username}/{project.slug}',
        'message': f"Video project '{project.title}' {action_word} successfully!",
    }


def _create_image_project_internal(
    image_url: str,
    filename: str,
    title: str | None,
    tool_hint: str | None,
    is_owned: bool,
    is_showcase: bool,
    is_private: bool,
    user,
) -> dict:
    """Internal helper to create an image project with AI-generated content.

    Note: title is optional - if not provided, AI will generate one from the image.
    """
    from core.integrations.github.helpers import apply_ai_metadata
    from core.integrations.image.ai_analyzer import analyze_image_for_template
    from core.projects.models import Project

    logger.info(f'Creating image project from {filename} (title={title}, is_owned={is_owned})')

    # Run AI analysis on the image to generate rich content (including title)
    try:
        logger.info(f'Running AI analysis for image: {filename}')
        analysis = analyze_image_for_template(
            image_url=image_url,
            filename=filename,
            title=title or '',  # Pass empty string if no title - AI will generate one
            tool_hint=tool_hint or '',
            user=user,
        )
    except Exception as e:
        logger.warning(f'Image analysis failed for {filename}: {e}')
        analysis = {
            'templateVersion': 2,
            'title': '',
            'description': '',
            'sections': [],
            'category_ids': [1],
            'topics': ['ai-art'],
            'tool_names': [tool_hint] if tool_hint else [],
        }

    # Use provided title, or AI-generated title, or fallback to filename
    final_title = title or analysis.get('title') or _generate_title_from_filename(filename)
    logger.info(
        f'Using title: {final_title} (user provided: {bool(title)}, AI generated: {bool(analysis.get("title"))})'
    )

    # Build content with image and AI-generated sections
    content = {
        'templateVersion': 2,
        'sections': analysis.get('sections', []),
        'heroDisplayMode': 'image',
    }

    # Use CLIPPED type if user didn't create this (clipping external content)
    # IMAGE_COLLECTION is used for image-based projects
    project_type = Project.ProjectType.IMAGE_COLLECTION if is_owned else Project.ProjectType.CLIPPED

    # Create project with the uploaded image as featured image
    project = Project.objects.create(
        user=user,
        title=final_title,
        description=analysis.get('description', ''),
        type=project_type,
        featured_image_url=image_url,
        content=content,
        is_showcased=is_showcase,
        is_private=is_private,
        tools_order=[],
    )

    # Apply AI-suggested categories, topics, and tools
    apply_ai_metadata(project, analysis, content=content)

    action_word = 'created' if is_owned else 'clipped'
    return {
        'success': True,
        'project_id': project.id,
        'slug': project.slug,
        'title': project.title,
        'url': f'/{user.username}/{project.slug}',
        'message': f"Image project '{project.title}' {action_word} successfully!",
    }


def _generate_title_from_filename(filename: str) -> str:
    """Generate a human-readable title from a filename."""
    import re

    # Remove extension
    name = re.sub(r'\.[^.]+$', '', filename)
    # Replace underscores and hyphens with spaces
    name = re.sub(r'[-_]+', ' ', name)
    # Title case
    return name.title() if name else 'Untitled Project'


def _generate_and_create_project(
    prompt: str,
    title: str,
    user,
    is_showcase: bool,
    is_private: bool,
) -> dict:
    """
    Generate an image with Gemini and create a project from it.

    Note: For now, this returns a message asking to use the image generation flow.
    Full integration with the existing image generation system would require
    extracting that logic from the WebSocket/Celery flow.
    """

    # TODO: Integrate with existing Gemini image generation from tasks.py
    # For now, return instruction to use the chat's image generation flow
    return {
        'success': False,
        'needs_generation': True,
        'prompt': prompt,
        'title': title,
        'message': (
            f'I\'ll generate an image based on: "{prompt}"\n\n'
            'Please wait while I create your image with Nano Banana...'
        ),
    }


# =============================================================================
# Unified URL Import Handlers
# =============================================================================
def _handle_github_import(
    url: str,
    user,
    is_showcase: bool,
    is_private: bool,
    state: dict,
    force_clip: bool = False,
) -> dict:
    """
    Handle GitHub URL import with auto-ownership detection.

    - If user has no GitHub OAuth: ask them to connect or clip
    - If user doesn't own repo: auto-clip
    - If user owns repo: full GitHub import with AI analysis
    """
    from core.integrations.github.helpers import get_user_github_token, parse_github_url
    from core.integrations.github.service import GitHubService

    logger.info(f'[GitHub Import] Starting import for URL: {url}')
    logger.info(
        f'[GitHub Import] User: {user.id} ({user.username}), '
        f'showcase={is_showcase}, private={is_private}, force_clip={force_clip}'
    )

    # Parse the GitHub URL
    try:
        owner, repo = parse_github_url(url)
        logger.info(f'[GitHub Import] Parsed URL: owner={owner}, repo={repo}')
    except ValueError as e:
        logger.error(f'[GitHub Import] Failed to parse URL {url}: {e}')
        return {'success': False, 'error': str(e)}

    # Check if user has GitHub connected
    logger.info(f'[GitHub Import] Checking GitHub connection for user {user.id}')
    token = get_user_github_token(user)
    if not token:
        logger.warning(f'[GitHub Import] No GitHub token found for user {user.id}')
        # No GitHub connected - ask user what they want to do
        if force_clip:
            # User chose to clip without connecting GitHub
            logger.info(f'[GitHub Import] User chose to clip {owner}/{repo} without GitHub connection')
            result = _handle_generic_import(
                url=url,
                user=user,
                is_owned=False,
                is_showcase=is_showcase,
                is_private=is_private,
                state=state,
            )
            if result.get('success'):
                result['clipped'] = True
                result['message'] = (
                    "I've added this repository to your clippings! "
                    'You can connect GitHub anytime in Settings to import your own repos with full AI analysis.'
                )
            logger.info(f'[GitHub Import] Force clip result: {result}')
            return result

        # Return a prompt for the user to connect GitHub or clip
        logger.info(f'[GitHub Import] No token for {owner}/{repo}, asking user to connect or clip')
        return {
            'success': False,
            'needs_github_connection': True,
            'github_url': url,
            'repo_name': f'{owner}/{repo}',
            'message': (
                'I see this is a GitHub repo! Is this your own project, '
                'or something cool you found and want to clip to save?\n\n'
                "If it's yours, you can **connect GitHub** in Settings → Integrations "
                'to import it with full AI analysis.\n'
                'Or I can just **clip it** to save it to your collection!'
            ),
        }

    # Check if user owns the repo
    logger.info(f'[GitHub Import] Token found for user {user.id}, length: {len(token)}')
    logger.info(f'[GitHub Import] Verifying repo access for {owner}/{repo}')
    github_service = GitHubService(token)
    try:
        is_owner = github_service.verify_repo_access_sync(owner, repo)
        logger.info(f'[GitHub Import] Access verification result: is_owner={is_owner}')
    except Exception as e:
        logger.error(f'[GitHub Import] Failed to verify repo access for {owner}/{repo}: {e}', exc_info=True)
        is_owner = False

    if not is_owner:
        # User doesn't own this repo - auto-clip
        logger.info(f'[GitHub Import] User {user.id} does not own {owner}/{repo}, auto-clipping')
        result = _handle_generic_import(
            url=url,
            user=user,
            is_owned=False,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )
        if result.get('success'):
            result['auto_clipped'] = True
            result['message'] = (
                "Looks like you don't own this repository, so I've added it to your clippings! "
                'You can find it in your Clipped tab.'
            )
        logger.info(f'[GitHub Import] Auto-clip result: {result}')
        return result

    # User owns the repo - do full import
    logger.info(f'[GitHub Import] User {user.id} owns {owner}/{repo}, performing full GitHub import')
    return _full_github_import(
        url=url,
        owner=owner,
        repo=repo,
        user=user,
        token=token,
        is_showcase=is_showcase,
        is_private=is_private,
        state=state,
    )


def _full_github_import(
    url: str,
    owner: str,
    repo: str,
    user,
    token: str,
    is_showcase: bool,
    is_private: bool,
    state: dict,
) -> dict:
    """Perform full GitHub import with AI analysis for repos user owns."""
    from core.integrations.github.ai_analyzer import analyze_github_repo_for_template
    from core.integrations.github.helpers import apply_ai_metadata, normalize_github_repo_data
    from core.integrations.github.service import GitHubService
    from core.projects.models import Project

    logger.info(f'[GitHub Full Import] Starting full import for {owner}/{repo}')
    logger.info(f'[GitHub Full Import] User: {user.id} ({user.username})')

    try:
        logger.info(f'[GitHub Full Import] Fetching repository info for {owner}/{repo}')
        github_service = GitHubService(token)
        repo_files = github_service.get_repository_info_sync(owner, repo)
        logger.info(f'[GitHub Full Import] Successfully fetched repo info, keys: {list(repo_files.keys())}')
    except Exception as e:
        logger.error(f'[GitHub Full Import] Failed to fetch GitHub repo {owner}/{repo}: {e}', exc_info=True)
        # Fall back to generic import on GitHub API failure
        return _handle_generic_import(
            url=url,
            user=user,
            is_owned=True,  # User owns it, just API failed
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )

    # Normalize GitHub output into the schema the AI analyzer expects
    logger.info(f'[GitHub Full Import] Normalizing GitHub data for {owner}/{repo}')
    repo_summary = normalize_github_repo_data(owner, repo, url, repo_files)
    desc_len = len(repo_summary.get('description', ''))
    logger.info(f'[GitHub Full Import] Normalized: name={repo_summary.get("name")}, desc_len={desc_len}')

    # Run AI analysis with error handling
    try:
        logger.info(f'[GitHub Full Import] Running template-based AI analysis for {owner}/{repo}')
        analysis = analyze_github_repo_for_template(
            repo_data=repo_summary,
            readme_content=repo_files.get('readme', ''),
        )
        logger.info(f'[GitHub Full Import] AI analysis completed, sections count: {len(analysis.get("sections", []))}')
    except Exception as e:
        logger.warning(f'[GitHub Full Import] AI analysis failed for {owner}/{repo}, using basic metadata: {e}')
        # Use basic metadata without AI analysis
        analysis = {
            'templateVersion': 2,
            'sections': [],
            'description': repo_summary.get('description', ''),
        }

    # Get hero image
    hero_image = analysis.get('hero_image', '')
    if not hero_image:
        hero_image = f'https://opengraph.githubassets.com/1/{owner}/{repo}'

    # Build content
    content = {
        'templateVersion': analysis.get('templateVersion', 2),
        'sections': analysis.get('sections', []),
        'github': repo_summary,
        'tech_stack': repo_files.get('tech_stack', {}),
    }

    try:
        # Create project
        project = Project.objects.create(
            user=user,
            title=repo_summary.get('name', repo),
            description=analysis.get('description') or repo_summary.get('description', ''),
            type=Project.ProjectType.GITHUB_REPO,
            external_url=url,
            featured_image_url=hero_image,
            content=content,
            is_showcased=is_showcase,
            is_private=is_private,
            tools_order=[],
        )

        logger.info(f'[GitHub Full Import] Applying AI metadata to project {project.id}')
        apply_ai_metadata(project, analysis, content=content)

        logger.info(f'[GitHub Full Import] Successfully imported {owner}/{repo} as project {project.id}')

        return {
            'success': True,
            'project_id': project.id,
            'slug': project.slug,
            'title': project.title,
            'url': f'/{user.username}/{project.slug}',
            'project_type': 'github_repo',
        }
    except Exception as e:
        logger.exception(f'[GitHub Full Import] Failed to create project for {owner}/{repo}: {e}')
        return {'success': False, 'error': f'Failed to create project: {str(e)}'}


def _handle_youtube_import(
    url: str,
    user,
    is_showcase: bool,
    is_private: bool,
    state: dict,
) -> dict:
    """
    Handle YouTube URL import.

    For now, delegates to generic handler. Future: use YouTube Data API.
    """
    # TODO: Implement YouTube Data API integration
    # For now, use generic scraper which handles YouTube well
    logger.info(f'[YouTube Import] Starting import for URL: {url}')
    logger.info(f'[YouTube Import] User: {user.id} ({user.username}), showcase={is_showcase}, private={is_private}')

    result = _handle_generic_import(
        url=url,
        user=user,
        is_owned=False,  # YouTube videos are always clips unless user owns channel
        is_showcase=is_showcase,
        is_private=is_private,
        state=state,
    )
    if result.get('success'):
        logger.info(f'[YouTube Import] Successfully imported project {result.get("project_id")}')
    else:
        logger.warning(f'[YouTube Import] Failed to import: {result.get("error")}')
    return result


def _full_gitlab_import(
    url: str,
    namespace: str,
    project_name: str,
    user,
    gitlab_service,
    is_showcase: bool,
    is_private: bool,
    state: dict,
) -> dict:
    """
    Perform full GitLab import with AI analysis for projects user owns.

    This fetches the README, file tree, dependencies, and tech stack from the
    GitLab API and runs AI analysis to create a rich project page.
    """
    from core.integrations.github.ai_analyzer import analyze_github_repo_for_template
    from core.integrations.github.helpers import apply_ai_metadata
    from core.integrations.gitlab.helpers import match_or_create_technology, normalize_gitlab_project_data
    from core.projects.models import Project

    logger.info(f'[GitLab Full Import] Starting full import for {namespace}/{project_name}')
    logger.info(f'[GitLab Full Import] User: {user.id} ({user.username})')

    try:
        # Fetch repository info via GitLab API
        logger.info(f'[GitLab Full Import] Fetching repository info for {namespace}/{project_name}')
        repo_info = gitlab_service.get_repository_info_sync(namespace, project_name)
        logger.info(f'[GitLab Full Import] Successfully fetched repo info, keys: {list(repo_info.keys())}')
    except Exception as e:
        logger.error(f'[GitLab Full Import] Failed to fetch GitLab repo {namespace}/{project_name}: {e}', exc_info=True)
        # Fall back to generic import on GitLab API failure
        logger.info('[GitLab Full Import] Falling back to generic import')
        return _handle_generic_import(
            url=url,
            user=user,
            is_owned=True,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )

    # Extract components from repo_info
    project_data = repo_info.get('project_data', {})
    readme = repo_info.get('readme', '')
    tech_stack = repo_info.get('tech_stack', {})

    # Normalize GitLab output into the schema the AI analyzer expects
    logger.info(f'[GitLab Full Import] Normalizing GitLab data for {namespace}/{project_name}')
    base_url = 'https://gitlab.com'  # Default, could be extracted from URL for self-hosted
    repo_summary = normalize_gitlab_project_data(
        base_url=base_url,
        namespace=namespace,
        project=project_name,
        url=url,
        project_data=project_data,
        repo_files=repo_info,
    )
    logger.info(
        f'[GitLab Full Import] Normalized data: name={repo_summary.get("name")}, '
        f'description length={len(repo_summary.get("description", ""))}'
    )

    # Run AI analysis with error handling
    try:
        logger.info(f'[GitLab Full Import] Running template-based AI analysis for {namespace}/{project_name}')
        analysis = analyze_github_repo_for_template(
            repo_data=repo_summary,
            readme_content=readme,
        )
        logger.info(f'[GitLab Full Import] AI analysis completed, sections count: {len(analysis.get("sections", []))}')
    except Exception as e:
        logger.warning(
            f'[GitLab Full Import] AI analysis failed for {namespace}/{project_name}, using basic metadata: {e}'
        )
        # Use basic metadata without AI analysis
        analysis = {
            'templateVersion': 2,
            'sections': [],
            'description': repo_summary.get('description', ''),
        }

    # Get hero image - use GitLab's project avatar or generate one
    hero_image = analysis.get('hero_image', '')
    if not hero_image:
        # GitLab doesn't have opengraph images like GitHub, use project avatar if available
        avatar_url = project_data.get('avatar_url', '')
        if avatar_url:
            hero_image = avatar_url
        else:
            # Generate a placeholder or use a generic GitLab image
            hero_image = f'https://gitlab.com/uploads/-/system/project/avatar/{project_data.get("id", "")}/avatar.png'

    # Build content
    content = {
        'templateVersion': analysis.get('templateVersion', 2),
        'sections': analysis.get('sections', []),
        'gitlab': repo_summary,
        'tech_stack': tech_stack,
    }

    try:
        # Create project
        logger.info(f'[GitLab Full Import] Creating project for {namespace}/{project_name}')
        project = Project.objects.create(
            user=user,
            title=repo_summary.get('name', project_name),
            description=analysis.get('description') or repo_summary.get('description', ''),
            type=Project.ProjectType.GITLAB_PROJECT,
            external_url=url,
            featured_image_url=hero_image,
            content=content,
            is_showcased=is_showcase,
            is_private=is_private,
            tools_order=[],
        )

        # Apply AI metadata (tags, tools, etc.)
        logger.info(f'[GitLab Full Import] Applying AI metadata to project {project.id}')
        apply_ai_metadata(project, analysis, content=content)

        # Also tag technologies from tech_stack
        if tech_stack:
            logger.info('[GitLab Full Import] Tagging technologies from tech_stack')
            for lang_name in tech_stack.get('languages', {}).keys():
                tool = match_or_create_technology(lang_name)
                if tool and tool not in project.tools.all():
                    project.tools.add(tool)
            for framework in tech_stack.get('frameworks', []):
                tool = match_or_create_technology(framework)
                if tool and tool not in project.tools.all():
                    project.tools.add(tool)
            for tool_name in tech_stack.get('tools', []):
                tool = match_or_create_technology(tool_name)
                if tool and tool not in project.tools.all():
                    project.tools.add(tool)

        logger.info(f'[GitLab Full Import] Successfully imported {namespace}/{project_name} as project {project.id}')

        return {
            'success': True,
            'project_id': project.id,
            'slug': project.slug,
            'title': project.title,
            'url': f'/{user.username}/{project.slug}',
            'project_type': 'gitlab_repo',
        }
    except Exception as e:
        logger.exception(f'[GitLab Full Import] Failed to create project for {namespace}/{project_name}: {e}')
        return {'success': False, 'error': f'Failed to create project: {str(e)}'}


def _handle_gitlab_import(
    url: str,
    user,
    is_showcase: bool,
    is_private: bool,
    state: dict,
) -> dict:
    """
    Handle GitLab URL import with auto-ownership detection.

    - If GitLab service not available: auto-clip
    - If user has no GitLab OAuth: auto-clip
    - If user doesn't own project: auto-clip
    - If user owns project: imports as owned project
    """
    logger.info(f'[GitLab Import] Starting import for URL: {url}')
    logger.info(f'[GitLab Import] User: {user.id} ({user.username}), showcase={is_showcase}, private={is_private}')

    # Parse the GitLab URL to get namespace/project
    try:
        parsed = urlparse(url)
        path_parts = parsed.path.strip('/').split('/')
        if len(path_parts) < 2:
            logger.error(f'[GitLab Import] Invalid URL format - not enough path parts: {path_parts}')
            return {'success': False, 'error': 'Invalid GitLab URL format'}
        namespace = '/'.join(path_parts[:-1])
        project_name = path_parts[-1]
        logger.info(f'[GitLab Import] Parsed URL: namespace={namespace}, project={project_name}')
    except Exception as e:
        logger.error(f'[GitLab Import] Failed to parse URL {url}: {e}')
        return {'success': False, 'error': f'Invalid GitLab URL: {str(e)}'}

    # Try to import GitLab service - if not available, fall back to generic import
    try:
        from core.integrations.gitlab.service import GitLabService

        logger.info('[GitLab Import] GitLabService imported successfully')
    except ImportError as e:
        logger.warning(f'[GitLab Import] GitLabService not available: {e}')
        logger.info(f'[GitLab Import] Falling back to generic import for {namespace}/{project_name}')
        result = _handle_generic_import(
            url=url,
            user=user,
            is_owned=False,  # Default to clipping when service not available
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )
        if result.get('success'):
            result['message'] = 'Successfully imported this GitLab project!'
        logger.info(f'[GitLab Import] Generic import result: {result}')
        return result

    # Check if user has GitLab connected
    logger.info(f'[GitLab Import] Checking GitLab connection for user {user.id}')
    gitlab_service = GitLabService.for_user(user)
    if not gitlab_service:
        # No GitLab connected - auto-fallback to clipping
        logger.warning(
            f'[GitLab Import] No GitLab service for user {user.id}, auto-clipping {namespace}/{project_name}'
        )
        result = _handle_generic_import(
            url=url,
            user=user,
            is_owned=False,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )
        if result.get('success'):
            result['auto_clipped'] = True
            result['message'] = (
                "I noticed you don't have GitLab connected, so I've added this to your clippings! "
                'Connect GitLab to import your own projects with full analysis.'
            )
        logger.info(f'[GitLab Import] Auto-clip result: {result}')
        return result

    # Check if user owns the project
    logger.info(f'[GitLab Import] Verifying project access for {namespace}/{project_name}')
    try:
        is_owner = gitlab_service.verify_project_access_sync(namespace, project_name)
        logger.info(f'[GitLab Import] Access verification result: is_owner={is_owner}')
    except Exception as e:
        logger.error(
            f'[GitLab Import] Failed to verify project access for {namespace}/{project_name}: {e}', exc_info=True
        )
        is_owner = False

    if not is_owner:
        # User doesn't own this project - auto-clip
        logger.info(f'[GitLab Import] User {user.id} does not own {namespace}/{project_name}, auto-clipping')
        result = _handle_generic_import(
            url=url,
            user=user,
            is_owned=False,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )
        if result.get('success'):
            result['auto_clipped'] = True
            result['message'] = (
                "Looks like you don't own this GitLab project, so I've added it to your clippings! "
                'You can find it in your Clipped tab.'
            )
        logger.info(f'[GitLab Import] Non-owner import result: {result}')
        return result

    # User owns the project - do full import with GitLab API
    logger.info(f'[GitLab Import] User {user.id} owns {namespace}/{project_name}, performing full GitLab import')
    return _full_gitlab_import(
        url=url,
        namespace=namespace,
        project_name=project_name,
        user=user,
        gitlab_service=gitlab_service,
        is_showcase=is_showcase,
        is_private=is_private,
        state=state,
    )


def _handle_figma_import(
    url: str,
    user,
    is_showcase: bool,
    is_private: bool,
    state: dict,
) -> dict:
    """
    Handle Figma URL import.

    Figma links are always imported as owned designs since users only share
    their own Figma files. Uses generic scraper for metadata extraction.

    Default category is "Design" (ID 3) for all Figma imports.
    """
    from core.projects.models import Project
    from core.taxonomy.models import Taxonomy

    logger.info(f'[Figma Import] Starting import for URL: {url}')
    logger.info(f'[Figma Import] User: {user.id} ({user.username}), showcase={is_showcase}, private={is_private}')

    result = _handle_generic_import(
        url=url,
        user=user,
        is_owned=True,  # Figma links are typically user's own designs
        is_showcase=is_showcase,
        is_private=is_private,
        state=state,
    )
    if result.get('success'):
        result['message'] = 'Successfully imported your Figma design!'
        logger.info(f'[Figma Import] Successfully imported project {result.get("project_id")}')

        # Ensure Figma imports have ONLY "Design" category
        # Clear any AI-assigned categories and set Design as the sole category
        project_id = result.get('project_id')
        if project_id:
            try:
                project = Project.objects.get(id=project_id)
                try:
                    # Look up by name pattern rather than hardcoded ID
                    design_category = Taxonomy.objects.get(
                        name__icontains='Design',
                        taxonomy_type='category',
                        is_active=True,
                    )
                    # Clear all existing categories and set only Design
                    project.categories.clear()
                    project.categories.add(design_category)
                    logger.info(
                        f'[Figma Import] Set Design category (ID {design_category.id}) for project {project_id}'
                    )
                except Taxonomy.DoesNotExist:
                    logger.warning('[Figma Import] Design category not found')
                except Taxonomy.MultipleObjectsReturned:
                    # If multiple, get the most specific one
                    design_category = Taxonomy.objects.filter(
                        name__icontains='Design',
                        taxonomy_type='category',
                        is_active=True,
                    ).first()
                    if design_category:
                        project.categories.clear()
                        project.categories.add(design_category)
                        logger.info(
                            f'[Figma Import] Set Design category (ID {design_category.id}) for project {project_id}'
                        )

                # Also add Figma as a "Built With" tool
                try:
                    from core.projects.models import Tool

                    figma_tool = Tool.objects.get(name__iexact='Figma')
                    project.tools.add(figma_tool)
                    logger.info(f'[Figma Import] Added Figma tool for project {project_id}')
                except Tool.DoesNotExist:
                    logger.warning('[Figma Import] Figma tool not found')

            except Project.DoesNotExist:
                logger.warning(f'[Figma Import] Project {project_id} not found when setting category')
    else:
        logger.warning(f'[Figma Import] Failed to import: {result.get("error")}')
    return result


def _handle_generic_import(
    url: str,
    user,
    is_owned: bool | None,
    is_showcase: bool,
    is_private: bool,
    state: dict,
) -> dict:
    """
    Handle generic URL import with scraping.

    If is_owned is None, returns needs_ownership_confirmation=True
    to prompt the LLM to ask the user.
    """
    from dataclasses import asdict

    from core.integrations.github.helpers import apply_ai_metadata
    from core.projects.models import Project
    from services.url_import import (
        URLScraperError,
        analyze_webpage_for_template,
        scrape_url_for_project,
    )

    # If ownership not specified, ask user
    if is_owned is None:
        logger.info(f'[Generic Import] Ownership not specified for {url}, requesting confirmation')
        return {
            'success': False,
            'needs_ownership_confirmation': True,
            'message': 'Is this your own project, or are you clipping something you found?',
        }

    logger.info(f'[Generic Import] Starting import for URL: {url}')
    logger.info(f'[Generic Import] User: {user.id} ({user.username}), is_owned={is_owned}')

    try:
        # Scrape the webpage (already fetches HTML and extracts text internally)
        # Pass user_id for Figma screenshot S3 upload
        logger.info(f'[Generic Import] Scraping webpage: {url}')
        extracted = scrape_url_for_project(url, user_id=user.id)
        desc_len = len(extracted.description or '')
        logger.info(f'[Generic Import] Scraped: title="{extracted.title}", desc_len={desc_len}')

        # Build extracted data dict for template analysis
        # Note: scrape_url_for_project already does AI extraction, so we use its
        # description directly rather than re-fetching and re-analyzing
        extracted_dict = {
            'title': extracted.title,
            'description': extracted.description,
            'topics': extracted.topics or [],
            'features': extracted.features or [],
            'organization': extracted.organization,
            'source_url': url,
            'image_url': extracted.image_url,
            'images': extracted.images or [],
            'videos': extracted.videos or [],
            'links': extracted.links or {},
            'published_date': extracted.published_date,
        }

        # Run template analysis to generate sections
        # Pass empty text_content since scrape_url_for_project already extracted
        # the relevant info via AI - no need to double-fetch the URL
        logger.info(f'[Generic Import] Running template analysis for {url}')
        analysis = analyze_webpage_for_template(
            extracted_data=extracted_dict,
            text_content='',  # Skip double-fetch - extracted data is sufficient
            user=user,
        )
        logger.info(f'[Generic Import] Template analysis complete, sections count: {len(analysis.get("sections", []))}')

        hero_image = analysis.get('hero_image') or extracted.image_url or ''
        logger.info(f'[Generic Import] Hero image: {hero_image[:100] if hero_image else "None"}...')

        # Build content
        content = {
            'templateVersion': analysis.get('templateVersion', 2),
            'sections': analysis.get('sections', []),
            'scraped_data': asdict(extracted),
            'source_url': url,
        }

        if extracted.features:
            content['features'] = extracted.features
        if extracted.links:
            content['links'] = extracted.links

        # Determine project type
        project_type = Project.ProjectType.OTHER if is_owned else Project.ProjectType.CLIPPED
        logger.info(f'[Generic Import] Project type: {project_type}')

        # Check if a project with this URL already exists for this user
        existing_project = Project.objects.filter(user=user, external_url=url).first()
        if existing_project:
            logger.info(f'[Generic Import] Found existing project {existing_project.id} for URL {url}')
            return {
                'success': True,
                'project_id': existing_project.id,
                'slug': existing_project.slug,
                'title': existing_project.title,
                'url': f'/{user.username}/{existing_project.slug}',
                'project_type': 'existing',
                'already_imported': True,
                'message': (
                    f'This project was already imported! '
                    f'You can find it at /{user.username}/{existing_project.slug}'
                ),
            }

        # Create project
        logger.info(f'[Generic Import] Creating project for {url}')
        project = Project.objects.create(
            user=user,
            title=extracted.title or 'Imported Project',
            description=analysis.get('description') or extracted.description or '',
            type=project_type,
            external_url=url,
            featured_image_url=hero_image,
            content=content,
            is_showcased=is_showcase,
            is_private=is_private,
            tools_order=[],
        )

        logger.info(f'[Generic Import] Applying AI metadata to project {project.id}')
        apply_ai_metadata(project, analysis, content=content)

        logger.info(f'[Generic Import] Successfully imported {url} as project {project.id}')

        return {
            'success': True,
            'project_id': project.id,
            'slug': project.slug,
            'title': project.title,
            'url': f'/{user.username}/{project.slug}',
            'project_type': 'clipped' if not is_owned else 'other',
        }

    except URLScraperError as e:
        logger.error(f'[Generic Import] URL scraper error for {url}: {e}')
        return {
            'success': False,
            'error': f'Could not import from URL: {str(e)}',
            'suggest_screenshot': True,
            'failed_url': url,
            'message': (
                "I couldn't access that URL. The site may be blocking automated access. "
                'Would you like to upload a screenshot of the page instead? '
                'I can analyze it to create a project for you.'
            ),
        }
    except Exception as e:
        logger.exception(f'[Generic Import] Unexpected error importing from URL {url}: {e}')
        return {'success': False, 'error': f'Failed to create project: {str(e)}'}


# =============================================================================
# Unified Import Tool
# =============================================================================
@tool(args_schema=ImportFromURLInput)
def import_from_url(
    url: str,
    is_owned: bool | None = None,
    is_showcase: bool = True,
    is_private: bool = False,
    force_clip: bool = False,
    state: dict | None = None,
) -> dict:
    """
    Import any URL as a project with smart domain-specific handling.

    This unified tool automatically routes URLs to the appropriate handler:
    - **GitHub URLs**: Auto-detects ownership via OAuth. If no GitHub connected,
      returns needs_github_connection=True - ask user to connect or clip.
    - **GitLab URLs**: Auto-detects ownership via OAuth, no questions needed
    - **YouTube URLs**: Creates rich video projects
    - **Figma URLs**: Imports as owned design (assumes user shares their own designs)
    - **Other URLs**: May return needs_ownership_confirmation=True if is_owned not set

    When the tool returns 'needs_github_connection': True, ask the user:
    "Would you like to connect GitHub first, or just clip it?"
    If they want to clip, call again with force_clip=True.

    When the tool returns 'needs_ownership_confirmation': True, ask the user:
    "Is this your own project, or are you clipping something you found?"

    IMPORTANT: Always show the 'message' field from the response to the user!

    Returns:
        Dictionary with project details, or needs_github_connection/needs_ownership_confirmation flag
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()

    # Debug logging for import_from_url
    logger.info(f'import_from_url called with url={url}, state={state}')

    # Validate state / user context
    if not state or 'user_id' not in state:
        logger.warning(f'import_from_url: state validation failed - state={state}')
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    logger.info(f'import_from_url: Looking up user_id={user_id}')

    try:
        user = User.objects.get(id=user_id)
        logger.info(f'import_from_url: Found user {user.username}')
    except User.DoesNotExist:
        logger.warning(f'import_from_url: User {user_id} not found in database')
        return {'success': False, 'error': 'User not found'}

    # NOTE: We intentionally don't cache project creation results.
    # Caching would return stale project_ids without creating new projects,
    # confusing users who expect a new import each time.

    # Detect domain type and route to appropriate handler
    domain_type = _detect_url_domain_type(url)
    logger.info(f'Importing URL {url} (domain_type: {domain_type})')

    if domain_type == 'github':
        result = _handle_github_import(
            url=url,
            user=user,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
            force_clip=force_clip,
        )
    elif domain_type == 'gitlab':
        result = _handle_gitlab_import(
            url=url,
            user=user,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )
    elif domain_type == 'youtube':
        result = _handle_youtube_import(
            url=url,
            user=user,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )
    elif domain_type == 'figma':
        result = _handle_figma_import(
            url=url,
            user=user,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )
    else:
        # Generic handler - default to owned if not specified
        # (most users sharing URLs are sharing their own projects)
        logger.info(f'[Import Tool] Routing {url} to generic handler (domain_type={domain_type})')
        result = _handle_generic_import(
            url=url,
            user=user,
            is_owned=is_owned if is_owned is not None else True,
            is_showcase=is_showcase,
            is_private=is_private,
            state=state,
        )

    # Log final result
    if result.get('success'):
        logger.info(f'[Import Tool] Successfully imported {url} as project {result.get("project_id")}')
    elif result.get('needs_github_connection') or result.get('needs_ownership_confirmation'):
        logger.info(f'[Import Tool] Import pending user confirmation for {url}')
    else:
        logger.warning(f'[Import Tool] Failed to import {url}: {result.get("error")}')

    return result


# =============================================================================
# Architecture Diagram Regeneration Tool
# =============================================================================
@tool(args_schema=RegenerateArchitectureDiagramInput)
def regenerate_architecture_diagram(
    project_id: int,
    architecture_description: str,
    state: dict | None = None,
) -> dict:
    """
    Regenerate the architecture diagram for a project based on user's description.

    Use this tool when the user wants to fix or regenerate their project's architecture
    diagram. The user will describe their system architecture in plain English, and
    this tool will generate a new Mermaid diagram and update the project.

    IMPORTANT: Only the project owner can regenerate their diagram.

    Example user descriptions:
    - "Frontend connects to API, API connects to database and Redis cache"
    - "User uploads images to S3, Lambda processes them, results stored in DynamoDB"
    - "React frontend, Django backend with PostgreSQL and Celery workers"

    Returns:
        Dictionary with success status, the new diagram code, and project URL
    """
    import uuid

    from django.contrib.auth import get_user_model

    from core.projects.models import Project
    from services.ai.provider import AIProvider

    User = get_user_model()

    # Validate state / user context
    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Get the project
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return {'success': False, 'error': 'Project not found'}

    # Verify ownership
    if project.user_id != user_id:
        return {'success': False, 'error': 'You can only regenerate diagrams for your own projects'}

    logger.info(f'Regenerating architecture diagram for project {project_id} by user {user.username}')

    # Build prompt for AI to generate Mermaid diagram from description
    prompt = f"""Generate a Mermaid architecture diagram based on this description.

Project: {project.title}
User's Description: {architecture_description}

IMPORTANT SYNTAX RULES:
1. Start with EXACTLY "graph TB" (top-to-bottom)
2. Use simple node IDs (A, B, C, D) without special characters
3. Use square brackets for labels: A[Label Text]
4. NO line breaks inside labels
5. Use --> for arrows
6. Keep it simple: 3-8 nodes maximum
7. Group related components logically

CORRECT Example:
graph TB
    A[User Interface] --> B[API Gateway]
    B --> C[Application Server]
    C --> D[Database]
    C --> E[Cache]

INCORRECT (DO NOT DO THIS):
- graph TB A[Multi
  Line Label]  ❌ NO line breaks in labels
- graph TB node-1[Test] ❌ NO hyphens in node IDs
- A[Label] -> B[Label] ❌ Use --> not ->

Return ONLY the Mermaid code starting with "graph TB". No explanation."""

    try:
        ai = AIProvider()
        diagram_code = ai.complete(
            prompt=prompt,
            model=None,
            temperature=0.7,
            max_tokens=500,
        )

        # Clean up response (remove markdown fences if present)
        diagram_code = diagram_code.strip()
        if diagram_code.startswith('```mermaid'):
            diagram_code = diagram_code.replace('```mermaid', '').replace('```', '').strip()
        elif diagram_code.startswith('```'):
            diagram_code = diagram_code.replace('```', '').strip()

        # Sanitize and validate using BaseParser methods
        from core.integrations.base.parser import BaseParser

        diagram_code = BaseParser._sanitize_mermaid_diagram(diagram_code)
        is_valid, error_msg = BaseParser._validate_mermaid_syntax(diagram_code)

        if not is_valid:
            logger.warning(f'Generated invalid diagram: {error_msg}')
            # Try once more with higher temperature
            diagram_code = ai.complete(
                prompt=prompt + '\n\nPrevious attempt was invalid. Please try again with simpler syntax.',
                model=None,
                temperature=0.9,
                max_tokens=500,
            )
            diagram_code = diagram_code.strip()
            if diagram_code.startswith('```mermaid'):
                diagram_code = diagram_code.replace('```mermaid', '').replace('```', '').strip()
            elif diagram_code.startswith('```'):
                diagram_code = diagram_code.replace('```', '').strip()
            diagram_code = BaseParser._sanitize_mermaid_diagram(diagram_code)
            is_valid, error_msg = BaseParser._validate_mermaid_syntax(diagram_code)

            if not is_valid:
                return {
                    'success': False,
                    'error': 'Could not generate a valid diagram. Please try describing your architecture differently.',
                }

        # Update the project's architecture section
        content = project.content or {}
        sections = content.get('sections', [])

        # Find and update the architecture section, or create one if it doesn't exist
        architecture_section_found = False
        for section in sections:
            if section.get('type') == 'architecture':
                section['content'] = section.get('content', {})
                section['content']['diagram'] = diagram_code
                section['content']['description'] = architecture_description
                section['enabled'] = True
                architecture_section_found = True
                break

        if not architecture_section_found:
            # Create a new architecture section
            new_section = {
                'id': str(uuid.uuid4()),
                'type': 'architecture',
                'enabled': True,
                'order': len(sections),
                'content': {
                    'title': 'System Architecture',
                    'diagram': diagram_code,
                    'description': architecture_description,
                },
            }
            sections.append(new_section)

        content['sections'] = sections
        project.content = content
        project.save(update_fields=['content', 'updated_at'])

        logger.info(f'Successfully regenerated architecture diagram for project {project_id}')

        return {
            'success': True,
            'project_id': project.id,
            'slug': project.slug,
            'url': f'/{user.username}/{project.slug}',
            'diagram': diagram_code,
            'message': (
                f"I've updated your architecture diagram! Here's what I generated:\n\n"
                f'```mermaid\n{diagram_code}\n```\n\n'
                f'You can view it on your project page: [{project.title}](/{user.username}/{project.slug})'
            ),
        }

    except Exception as e:
        logger.exception(f'Error regenerating architecture diagram: {e}')
        return {'success': False, 'error': f'Failed to regenerate diagram: {str(e)}'}


@tool(args_schema=CreateProjectFromScreenshotInput)
def create_project_from_screenshot(
    screenshot_url: str,
    screenshot_filename: str,
    original_url: str = '',
    title: str = '',
    is_showcase: bool = True,
    is_private: bool = False,
    is_owned: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Create a project by analyzing a screenshot when URL scraping fails.

    This is a fallback tool for when import_from_url cannot scrape a webpage.
    The AI analyzes the screenshot to extract title and description,
    but the screenshot is NOT used as the hero/featured image.

    Returns:
        Dictionary with project details or error message
    """
    import json as json_module

    from django.contrib.auth import get_user_model

    from core.integrations.github.helpers import apply_ai_metadata
    from core.projects.models import Project
    from services.ai import AIProvider

    User = get_user_model()

    # Validate state / user context
    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    username = state.get('username', '')

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    logger.info(
        f'create_project_from_screenshot: Analyzing screenshot for user {username}',
        extra={
            'screenshot_url': screenshot_url,
            'original_url': original_url,
            'has_title': bool(title),
        },
    )

    try:
        # Use vision AI to analyze the screenshot
        ai = AIProvider(provider='gemini', user_id=user_id)

        analysis_prompt = """Analyze this screenshot of a webpage or project. Extract the following information:

1. title: The main title or name shown (be specific, use the actual text visible)
2. description: A brief 2-3 sentence description of what this page/project is about
3. topics: 3-5 relevant topic keywords as a list
4. project_type: One of: "tool", "article", "portfolio", "website", "app", "other"

Return ONLY valid JSON in this exact format, no other text:
{"title": "...", "description": "...", "topics": ["...", "..."], "project_type": "..."}"""

        analysis_text = ai.complete_with_image(
            prompt=analysis_prompt,
            image_url=screenshot_url,
            temperature=0.3,
        )

        # Parse the AI response
        extracted_data = {}
        try:
            # Try to extract JSON from the response
            # Sometimes AI wraps it in markdown code blocks
            json_text = analysis_text
            if '```json' in json_text:
                json_text = json_text.split('```json')[1].split('```')[0]
            elif '```' in json_text:
                json_text = json_text.split('```')[1].split('```')[0]

            extracted_data = json_module.loads(json_text.strip())
        except (json_module.JSONDecodeError, IndexError) as e:
            logger.warning(f'Failed to parse AI analysis as JSON: {e}')
            # Use defaults if parsing fails
            extracted_data = {
                'title': '',
                'description': analysis_text[:500] if analysis_text else '',
                'topics': [],
                'project_type': 'other',
            }

        # Use provided title or extracted title
        final_title = title or extracted_data.get('title') or 'Imported Project'
        final_description = extracted_data.get('description') or ''
        topics = extracted_data.get('topics') or []

        # Map to project type enum (owned = OTHER, not owned = CLIPPED)
        project_type = Project.ProjectType.OTHER if is_owned else Project.ProjectType.CLIPPED

        # Build content with source info
        content = {
            'templateVersion': 2,
            'sections': [],
            'source_url': original_url,
            'imported_via': 'screenshot_analysis',
        }

        # Create project WITHOUT featured image (screenshot is just for analysis)
        project = Project.objects.create(
            user=user,
            title=final_title,
            description=final_description,
            type=project_type,
            external_url=original_url,
            featured_image_url='',  # Explicitly empty - don't use screenshot as hero
            content=content,
            is_showcased=is_showcase,
            is_private=is_private,
            tools_order=[],
        )

        # Apply AI metadata for topics/categories
        if topics:
            apply_ai_metadata(
                project,
                {'topics': topics, 'description': final_description},
                content=content,
            )

        logger.info(
            f'Successfully created project from screenshot: {project.id}',
            extra={
                'project_id': project.id,
                'title': final_title,
                'original_url': original_url,
            },
        )

        return {
            'success': True,
            'project_id': project.id,
            'slug': project.slug,
            'title': project.title,
            'url': f'/{username}/{project.slug}',
            'message': (
                f"I created a project called '{project.title}' from your screenshot. "
                'You can add a hero image later in the project editor.'
            ),
        }

    except Exception as e:
        logger.exception(f'Error creating project from screenshot: {e}')
        return {'success': False, 'error': f'Failed to analyze screenshot: {str(e)}'}


@tool(args_schema=CreatePromptInput)
def create_prompt(
    title: str,
    prompt_text: str,
    description: str = '',
    tool_names: list[str] | None = None,
    topics: list[str] | None = None,
    is_private: bool = False,
    state: dict | None = None,
) -> dict:
    """
    Save a prompt to the user's personal AI prompt library.

    Use this tool when the user wants to save a prompt they use with ANY AI tool
    (ChatGPT, Claude, Midjourney, DALL-E, etc.) for later reference or to share
    with the community.

    Examples of when to use this tool:
    - "Save this prompt to my library"
    - "Add this to my prompts"
    - "I want to save this prompt for later"
    - "Save this as a prompt called 'Blog Generator'"

    Returns:
        Dictionary with prompt/project details or error message
    """
    from core.projects.models import Project
    from core.tools.models import Tool
    from core.users.models import User

    logger.info(f'create_prompt called with title: {title}')

    # Get user from injected state
    if not state or 'user_id' not in state:
        logger.error(f'User not authenticated - state: {state}')
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    username = state.get('username', '')

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Build content with prompt data
    content = {
        'templateVersion': 2,
        'sections': [],
        'prompt': {
            'text': prompt_text,
        },
    }

    # Create the prompt project
    project = Project.objects.create(
        user=user,
        title=title,
        description=description,
        type=Project.ProjectType.PROMPT,
        content=content,
        is_showcased=not is_private,  # If public, show in showcase/feed
        is_private=is_private,
        tools_order=[],
    )

    # Add AI tools if specified
    if tool_names:
        tool_names_lower = [name.lower() for name in tool_names]
        matching_tools = Tool.objects.filter(
            name__iregex=r'^(' + '|'.join(tool_names_lower) + r')$',
            is_active=True,
        )
        if matching_tools.exists():
            project.tools.set(matching_tools)
            project.tools_order = [t.id for t in matching_tools]
            project.save(update_fields=['tools_order'])

    # Add topics if specified
    if topics:
        try:
            set_project_topics(project, topics[:10])
            logger.info(f'Added topics to prompt: {topics[:10]}')
        except Exception as e:
            logger.warning(f'Failed to add topics: {e}')

    logger.info(
        f'Successfully created prompt: {project.id}',
        extra={
            'project_id': project.id,
            'title': title,
            'is_private': is_private,
        },
    )

    visibility_msg = (
        "It's set to private - only you can see it." if is_private else "It's public and can be discovered by others."
    )

    return {
        'success': True,
        'project_id': project.id,
        'slug': project.slug,
        'title': project.title,
        'url': f'/{username}/{project.slug}',
        'message': f"I saved your prompt '{project.title}' to your library! {visibility_msg}",
    }


# Tool list for agent
# Note: fetch_github_metadata is kept for potential future use but not exposed to agent
# GitHub imports require OAuth via import_github_project for ownership verification
PROJECT_TOOLS = [
    create_project,
    create_media_project,  # NEW: Unified media tool (images, videos, generation)
    create_project_from_screenshot,  # Fallback when URL scraping fails
    create_prompt,  # Save prompts to user's prompt library
    extract_url_info,
    import_from_url,  # Unified URL import tool
    import_github_project,  # Keep for backwards compatibility
    # import_video_project - DEPRECATED, use create_media_project instead
    scrape_webpage_for_project,  # Keep for backwards compatibility
    create_product,
    regenerate_architecture_diagram,  # Regenerate architecture diagrams from user descriptions
]
