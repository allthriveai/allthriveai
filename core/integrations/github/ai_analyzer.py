"""AI-powered GitHub repository analyzer for smart project metadata."""

import json
import logging
import time

from anthropic import AnthropicError
from openai import OpenAIError

from core.ai_usage.tracker import AIUsageTracker
from core.integrations.base.parser import BaseParser
from core.integrations.github.constants import (
    MAX_CATEGORIES_PER_PROJECT,
    MAX_CATEGORY_ID,
    MAX_DESCRIPTION_LENGTH,
    MAX_TOOLS_PER_PROJECT,
    MAX_TOPIC_LENGTH,
    MAX_TOPICS_PER_PROJECT,
    MIN_CATEGORY_ID,
)
from services.ai import AIProvider

logger = logging.getLogger(__name__)


# ============================================================================
# SECTION-BASED TEMPLATE GENERATION
# ============================================================================

SECTION_TEMPLATE_PROMPT = (
    """Analyze this GitHub repository and generate structured content """
    """for a portfolio project page.

Repository: {name}
Description: {description}
Language: {language}
Topics: {topics}
Stars: {stars}
Tech Stack: {tech_stack}

Directory Structure:
{directory_structure}

README content (first 2000 chars):
{readme_excerpt}

Generate structured sections for a visually appealing project portfolio. Return valid JSON with these sections:

{{
  "overview": {{
    "headline": "One compelling sentence hook (max 100 chars)",
    "description": "2-3 sentence explanation of what this does and why it matters"
  }},
  "features": [
    {{"icon": "FaRocket", "title": "Feature Name", "description": "1-2 sentence description"}},
    ... (3-6 features based on README/repo)
  ],
  "tech_stack": {{
    "categories": [
      {{"name": "Backend", "technologies": ["Python", "FastAPI"]}},
      {{"name": "Frontend", "technologies": ["React", "TypeScript"]}},
      {{"name": "Infrastructure", "technologies": ["Docker", "Redis"]}}
    ]
  }},
  "architecture": {{
    "diagram": "graph TD\\n    A[Component] --> B[Component]",
    "description": "Brief explanation of how the system works"
  }},
  "challenges": [
    {{
      "challenge": "The problem faced",
      "solution": "How it was solved",
      "outcome": "The result (optional)"
    }}
  ],
  "gallery": {{
    "images": [],
    "layout": "grid"
  }},
  "demo": {{
    "ctas": [
      {{"label": "View on GitHub", "url": "{github_url}", "style": "primary"}}
    ]
  }},
  "links": [
    {{"label": "Documentation", "url": "...", "icon": "book"}},
    {{"label": "Live Demo", "url": "...", "icon": "external"}}
  ],
  "category_ids": [9],
  "topics": ["python", "api", "redis"],
  "tool_names": ["ChatGPT", "GitHub Copilot"]
}}

IMPORTANT:
- For features: Use FontAwesome icon names (react-icons/fa format). Choose from:
  FaRocket (speed/launch), FaShieldAlt (security), FaBolt (performance/fast),
  FaCode (development), FaDatabase (data/storage), FaCog (settings/config),
  FaChartLine (analytics/growth), FaUsers (collaboration), FaLock (privacy),
  FaMobile (mobile/responsive), FaCloud (cloud), FaPlug (integrations/api),
  FaBrain (AI/ML), FaSearch (search), FaSync (sync/realtime), FaGlobe (global),
  FaClock (time/scheduling), FaFileAlt (documents), FaCheck (validation),
  FaLayerGroup (modular), FaTools (utilities), FaPalette (customization)
- For architecture: CRITICAL - Base the Mermaid diagram on the ACTUAL directory structure above!
  * Identify real components from folder names (api/, models/, services/, handlers/, etc.)
  * Show how these actual components connect
  * Use graph TD format with 4-8 nodes
  * Label nodes based on actual folder/file names
  * DO NOT use generic "Input -> Processing -> Output" patterns
- For tech_stack: Group by Frontend, Backend, Database, Infrastructure, AI/ML as appropriate
- For challenges: Only include if README mentions specific problems solved
- For links: Extract any documentation/demo URLs from README
- Category IDs: 1-15 (9=Developer & Coding is common for code projects)
- Topics: lowercase, specific, 3-8 keywords

Return ONLY valid JSON, no markdown code blocks."""
)


def _format_tree_for_prompt(tree: list) -> str:
    """Format the GitHub API tree into a readable directory structure.

    Args:
        tree: List of tree items from GitHub API

    Returns:
        Formatted string showing directory structure
    """
    if not tree:
        return 'Not available'

    # Filter to only show directories and important files at root/first level
    lines = []
    dirs = set()
    important_files = []

    for item in tree:
        path = item.get('path', '')
        item_type = item.get('type', '')

        # Skip hidden files/dirs and common noise
        if path.startswith('.') or path.startswith('__'):
            continue

        parts = path.split('/')

        # Track top-level directories
        if item_type == 'tree' and len(parts) == 1:
            dirs.add(path)
        elif item_type == 'blob' and len(parts) == 1:
            # Keep important root files
            important_extensions = ('.py', '.js', '.ts', '.go', '.rs', '.java', '.yml', '.yaml', '.json', '.toml')
            if path.endswith(important_extensions) or path in ('Dockerfile', 'Makefile', 'README.md'):
                important_files.append(path)

        # Track second-level directories
        if len(parts) == 2 and item_type == 'tree':
            parent = parts[0]
            child = parts[1]
            if parent in dirs:
                dirs.add(f'{parent}/{child}')

    # Build output
    for d in sorted(dirs):
        if '/' in d:
            lines.append(f'  {d}/')
        else:
            lines.append(f'{d}/')

    # Add important root files
    for f in sorted(important_files)[:10]:  # Limit files
        lines.append(f)

    return '\n'.join(lines[:30]) if lines else 'Not available'  # Limit total lines


def analyze_github_repo_for_template(repo_data: dict, readme_content: str = '', user=None) -> dict:
    """Generate section-based template content for a GitHub repo.

    This is the new template-based analyzer that generates structured sections
    instead of free-form blocks.

    Args:
        repo_data: Repository data from GitHub API
        readme_content: README content (optional)
        user: Django User instance (optional, for AI usage tracking)

    Returns:
        dict with sections array and metadata for template v2 format
    """
    name = repo_data.get('name', '')
    description = repo_data.get('description', '')
    language = repo_data.get('language', '')
    github_topics = repo_data.get('topics', [])
    stars = repo_data.get('stargazers_count', 0)
    owner = repo_data.get('owner', '')
    github_url = repo_data.get('html_url', f'https://github.com/{owner}/{name}')
    tech_stack = repo_data.get('tech_stack', {})
    tree = repo_data.get('tree', [])

    # Get hero image
    hero_image = repo_data.get('open_graph_image_url')
    if not hero_image and owner and name:
        hero_image = f'https://opengraph.githubassets.com/1/{owner}/{name}'

    # Scan for visual assets
    visual_assets = BaseParser.scan_repository_for_images(tree=tree, owner=owner, repo=name)

    # Parse README to extract images
    readme_hero_image = None
    if readme_content:
        readme_parsed = BaseParser.parse(readme_content, repo_data)
        readme_hero_image = readme_parsed.get('hero_image')
        if readme_hero_image:
            logger.info(f'📷 Found README hero image: {readme_hero_image}')

    if not repo_data.get('open_graph_image_url'):
        if visual_assets.get('logo'):
            hero_image = visual_assets['logo']
        elif visual_assets.get('banner'):
            hero_image = visual_assets['banner']

    # Format tech stack for prompt
    tech_stack_str = json.dumps(tech_stack) if tech_stack else 'Not detected'

    # Format directory structure for prompt
    directory_structure = _format_tree_for_prompt(tree)
    logger.info(f'📁 Directory structure for {name}:\n{directory_structure}')

    # Build prompt
    prompt = SECTION_TEMPLATE_PROMPT.format(
        name=name,
        description=description or 'No description provided',
        language=language or 'Unknown',
        topics=', '.join(github_topics) if github_topics else 'None',
        stars=stars,
        tech_stack=tech_stack_str,
        directory_structure=directory_structure,
        readme_excerpt=readme_content[:2000] if readme_content else 'No README available',
        github_url=github_url,
    )

    logger.info(f'🔍 Starting template analysis for {name}')

    try:
        ai = AIProvider()
        start_time = time.time()
        response = ai.complete(
            prompt=prompt,
            model=None,
            temperature=0.7,
            max_tokens=2000,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Track AI usage for cost reporting
        if user and ai.last_usage:
            usage = ai.last_usage
            AIUsageTracker.track_usage(
                user=user,
                feature='github_template_analysis',
                provider=ai.current_provider,
                model=ai.current_model,
                input_tokens=usage.get('prompt_tokens', 0),
                output_tokens=usage.get('completion_tokens', 0),
                latency_ms=latency_ms,
                status='success',
            )

        logger.info(f'✅ Template AI response received for {name}')

        # Clean response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith('```'):
            clean_response = clean_response.split('\n', 1)[1]
        if clean_response.endswith('```'):
            clean_response = clean_response.rsplit('```', 1)[0]
        clean_response = clean_response.strip()

        result = json.loads(clean_response)

        # Build sections array from AI response
        sections = []
        section_order = 0

        # Overview section
        if result.get('overview'):
            overview = result['overview']
            # Get preview image: prefer first screenshot, then README hero image
            preview_image = None
            if visual_assets.get('screenshots'):
                preview_image = visual_assets['screenshots'][0]
            elif readme_hero_image:
                preview_image = readme_hero_image

            overview_content = {
                'headline': overview.get('headline', ''),
                'description': overview.get('description', description or ''),
                'metrics': overview.get('metrics', []),
            }
            if preview_image:
                overview_content['previewImage'] = preview_image
                logger.info(f'📷 Added preview image to overview: {preview_image}')

            sections.append(
                {
                    'id': f'section-overview-{name[:8]}',
                    'type': 'overview',
                    'enabled': True,
                    'order': section_order,
                    'content': overview_content,
                }
            )
            section_order += 1

        # Features section
        if result.get('features') and len(result['features']) > 0:
            sections.append(
                {
                    'id': f'section-features-{name[:8]}',
                    'type': 'features',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'features': result['features'][:6],  # Limit to 6
                    },
                }
            )
            section_order += 1

        # Demo section (if CTAs provided)
        if result.get('demo') and result['demo'].get('ctas'):
            sections.append(
                {
                    'id': f'section-demo-{name[:8]}',
                    'type': 'demo',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'ctas': result['demo']['ctas'],
                        'liveUrl': result['demo'].get('liveUrl'),
                        'video': result['demo'].get('video'),
                    },
                }
            )
            section_order += 1

        # Gallery section (add screenshots if found)
        gallery_images = []
        if visual_assets.get('screenshots'):
            gallery_images = [{'url': url} for url in visual_assets['screenshots'][:6]]
        if result.get('gallery', {}).get('images'):
            gallery_images.extend(result['gallery']['images'])

        if gallery_images:
            sections.append(
                {
                    'id': f'section-gallery-{name[:8]}',
                    'type': 'gallery',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'images': gallery_images,
                        'layout': result.get('gallery', {}).get('layout', 'grid'),
                    },
                }
            )
            section_order += 1

        # Tech stack section
        if result.get('tech_stack', {}).get('categories'):
            sections.append(
                {
                    'id': f'section-tech-{name[:8]}',
                    'type': 'tech_stack',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'categories': result['tech_stack']['categories'],
                    },
                }
            )
            section_order += 1

        # Architecture section
        if result.get('architecture', {}).get('diagram'):
            sections.append(
                {
                    'id': f'section-arch-{name[:8]}',
                    'type': 'architecture',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'diagram': result['architecture']['diagram'],
                        'description': result['architecture'].get('description', ''),
                        'title': 'System Architecture',
                    },
                }
            )
            section_order += 1

        # Challenges section
        if result.get('challenges') and len(result['challenges']) > 0:
            sections.append(
                {
                    'id': f'section-challenges-{name[:8]}',
                    'type': 'challenges',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'title': 'Challenges & Solutions',
                        'items': result['challenges'][:4],  # Limit to 4
                    },
                }
            )
            section_order += 1

        # Links section
        if result.get('links') and len(result['links']) > 0:
            sections.append(
                {
                    'id': f'section-links-{name[:8]}',
                    'type': 'links',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'links': result['links'],
                    },
                }
            )
            section_order += 1

        # Validate metadata
        validated = {
            'templateVersion': 2,
            'sections': sections,
            'description': result.get('overview', {}).get('description', description or ''),
            'category_ids': [],
            'topics': [],
            'tool_names': [],
            'hero_image': hero_image,
        }

        # Validate category_ids
        if 'category_ids' in result and isinstance(result['category_ids'], list):
            validated['category_ids'] = [
                int(c)
                for c in result['category_ids']
                if isinstance(c, int | str) and MIN_CATEGORY_ID <= int(c) <= MAX_CATEGORY_ID
            ][:MAX_CATEGORIES_PER_PROJECT]

        # Validate topics
        if 'topics' in result and isinstance(result['topics'], list):
            validated['topics'] = [
                str(t).lower()[:MAX_TOPIC_LENGTH] for t in result['topics'] if t and isinstance(t, str)
            ][:MAX_TOPICS_PER_PROJECT]

        # Validate tool_names
        if 'tool_names' in result and isinstance(result['tool_names'], list):
            validated['tool_names'] = [str(t) for t in result['tool_names'] if t and isinstance(t, str)][
                :MAX_TOOLS_PER_PROJECT
            ]

        logger.info(f'✅ Template analysis complete for {name}: {len(sections)} sections generated')
        return validated

    except json.JSONDecodeError as e:
        logger.warning(f'AI returned invalid JSON for template {name}: {e}')
    except Exception as e:
        logger.error(f'Template analysis error for {name}: {e}', exc_info=True)

    # Fallback: Generate basic sections from repo data
    logger.info(f'📦 Using fallback template generation for {name}')
    return _generate_fallback_template(repo_data, readme_content, hero_image, visual_assets)


def _generate_fallback_template(
    repo_data: dict,
    readme_content: str,
    hero_image: str,
    visual_assets: dict,
) -> dict:
    """Generate fallback template sections when AI fails."""
    name = repo_data.get('name', '')
    description = repo_data.get('description', '')
    language = repo_data.get('language', '')
    github_topics = repo_data.get('topics', [])
    owner = repo_data.get('owner', '')
    github_url = repo_data.get('html_url', f'https://github.com/{owner}/{name}')
    tech_stack = repo_data.get('tech_stack', {})

    sections = []
    section_order = 0

    # Overview section
    sections.append(
        {
            'id': f'section-overview-{name[:8]}',
            'type': 'overview',
            'enabled': True,
            'order': section_order,
            'content': {
                'headline': name.replace('-', ' ').replace('_', ' ').title(),
                'description': description or f'A {language} project' if language else 'A software project',
            },
        }
    )
    section_order += 1

    # Tech stack section from detected technologies
    if tech_stack:
        categories = []
        if tech_stack.get('languages'):
            categories.append(
                {
                    'name': 'Languages',
                    'technologies': [{'name': lang} for lang in tech_stack['languages'].keys()],
                }
            )
        if tech_stack.get('frameworks'):
            categories.append(
                {
                    'name': 'Frameworks',
                    'technologies': [{'name': fw} for fw in tech_stack['frameworks']],
                }
            )
        if tech_stack.get('tools'):
            categories.append(
                {
                    'name': 'Tools',
                    'technologies': [{'name': tool} for tool in tech_stack['tools']],
                }
            )

        if categories:
            sections.append(
                {
                    'id': f'section-tech-{name[:8]}',
                    'type': 'tech_stack',
                    'enabled': True,
                    'order': section_order,
                    'content': {'categories': categories},
                }
            )
            section_order += 1

    # Gallery section with screenshots
    if visual_assets.get('screenshots'):
        sections.append(
            {
                'id': f'section-gallery-{name[:8]}',
                'type': 'gallery',
                'enabled': True,
                'order': section_order,
                'content': {
                    'images': [{'url': url} for url in visual_assets['screenshots'][:6]],
                    'layout': 'grid',
                },
            }
        )
        section_order += 1

    # Demo section with GitHub link
    sections.append(
        {
            'id': f'section-demo-{name[:8]}',
            'type': 'demo',
            'enabled': True,
            'order': section_order,
            'content': {
                'ctas': [
                    {'label': 'View on GitHub', 'url': github_url, 'style': 'primary'},
                ],
            },
        }
    )
    section_order += 1

    return {
        'templateVersion': 2,
        'sections': sections,
        'description': description or f'A {language} project' if language else 'A software project',
        'category_ids': [9] if language else [],  # Default to Developer & Coding
        'topics': [t.lower() for t in github_topics[:8]] if github_topics else [],
        'tool_names': [],
        'hero_image': hero_image,
    }


def generate_blocks_from_repo_structure(repo_data: dict) -> list:
    """Generate content blocks from repository structure when no README exists.

    Args:
        repo_data: Repository data including tree, dependencies, tech_stack

    Returns:
        List of content blocks describing the project structure
    """
    blocks = []
    language = repo_data.get('language', '')
    tree = repo_data.get('tree', [])
    dependencies = repo_data.get('dependencies', {})
    tech_stack = repo_data.get('tech_stack', {})

    # Add overview section
    blocks.append({'type': 'text', 'style': 'heading', 'content': 'Project Overview'})

    # Tech stack section
    if language or tech_stack.get('languages'):
        languages_text = f'**Primary Language:** {language}\n\n'
        if tech_stack.get('frameworks'):
            languages_text += f'**Frameworks:** {", ".join(tech_stack["frameworks"])}\n\n'
        if tech_stack.get('tools'):
            languages_text += f'**Tools:** {", ".join(tech_stack["tools"])}\n\n'

        blocks.append({'type': 'text', 'style': 'body', 'content': languages_text.strip()})

    # Project structure
    if tree:
        # Get key directories and files
        dirs = set()
        key_files = []
        for item in tree:
            path = item.get('path', '')
            if '/' in path:
                dirs.add(path.split('/')[0])
            elif path in ['package.json', 'requirements.txt', 'Dockerfile', '.github', 'docker-compose.yml']:
                key_files.append(path)

        if dirs or key_files:
            blocks.append({'type': 'text', 'style': 'heading', 'content': 'Project Structure'})

            structure_text = ''
            if dirs:
                structure_text += f'**Key Directories:** {", ".join(sorted(dirs)[:10])}\n\n'
            if key_files:
                structure_text += f'**Configuration:** {", ".join(key_files)}\n\n'

            blocks.append({'type': 'text', 'style': 'body', 'content': structure_text.strip()})

    # Dependencies section
    if dependencies:
        blocks.append({'type': 'text', 'style': 'heading', 'content': 'Dependencies'})

        for dep_file, content in dependencies.items():
            if content and dep_file == 'package.json':
                try:
                    pkg = json.loads(content)
                    deps = pkg.get('dependencies', {})
                    if deps:
                        deps_list = ', '.join(list(deps.keys())[:10])
                        blocks.append({'type': 'text', 'style': 'body', 'content': f'**npm packages:** {deps_list}'})
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f'Error parsing package.json dependency: {e}')

    return blocks


def analyze_github_repo(repo_data: dict, readme_content: str = '', user=None) -> dict:
    """Use AI to analyze a GitHub repo and generate smart metadata.

    Args:
        repo_data: Repository data from GitHub API
        readme_content: README content (optional)
        user: Django User instance (optional, for AI usage tracking)

    Returns:
        dict with:
            - description: Compelling project description
            - categories: List of category IDs to assign
            - topics: List of topic strings
            - tools: List of tool IDs to assign
            - readme_blocks: Structured blocks from README parsing
            - hero_image: Suggested hero image URL
            - hero_quote: Suggested hero quote
            - mermaid_diagrams: List of Mermaid diagrams found
            - demo_urls: List of demo/live site URLs
            - generated_diagram: Auto-generated architecture diagram
    """
    name = repo_data.get('name', '')
    description = repo_data.get('description', '')
    language = repo_data.get('language', '')
    github_topics = repo_data.get('topics', [])
    stars = repo_data.get('stargazers_count', 0)
    owner = repo_data.get('owner', '')

    # Get or generate hero image
    hero_image = repo_data.get('open_graph_image_url')
    if not hero_image and owner and name:
        # Use GitHub social image generator as fallback
        hero_image = f'https://opengraph.githubassets.com/1/{owner}/{name}'
        logger.info(f'No og:image found, using generated image: {hero_image}')

    # Scan repository for visual assets (screenshots, logos, banners)
    visual_assets = BaseParser.scan_repository_for_images(tree=repo_data.get('tree', []), owner=owner, repo=name)

    # Use logo or banner as hero image if no og:image
    if not repo_data.get('open_graph_image_url'):
        if visual_assets.get('logo'):
            hero_image = visual_assets['logo']
            logger.info(f'Using project logo as hero image: {hero_image}')
        elif visual_assets.get('banner'):
            hero_image = visual_assets['banner']
            logger.info(f'Using project banner as hero image: {hero_image}')

    # Build analysis prompt
    prompt = f"""Analyze this GitHub repository and provide metadata for a portfolio project.

Repository: {name}
Description: {description}
Language: {language}
Topics: {', '.join(github_topics)}
Stars: {stars}
{'README excerpt: ' + readme_content[:500] if readme_content else ''}

Generate:
1. A compelling 1-2 sentence description explaining why this project is cool/interesting
2. 1-2 category IDs from this list (return just the numbers):
   1-Chatbots & Conversation, 2-Websites & Apps, 3-Images/Design/Branding,
   4-Video & Multimodal, 5-Podcasts & Education, 6-Games & Interactive,
   7-Workflows & Automation, 8-Productivity, 9-Developer & Coding,
   10-Prompt Collections, 11-Thought Experiments, 12-Wellness & Growth,
   13-AI Agents & Multi-Tool, 14-AI Models & Research, 15-Data & Analytics
3. 3-8 relevant topic keywords (lowercase, specific tech/concepts)
4. 1-3 tool IDs from common AI/dev tools (if relevant, otherwise empty):
   ChatGPT, Claude, Midjourney, GitHub Copilot, etc. (just list tool names)

Format your response as JSON:
{{
  "description": "...",
  "category_ids": [9],
  "topics": ["python", "redis", "api"],
  "tool_names": ["ChatGPT", "GitHub Copilot"]
}}"""

    logger.info(f'🔍 Starting AI analysis for {name}')
    logger.info(f'📝 Input - description: {description[:100] if description else "None"}...')
    logger.info(f'🏷️  Input - language: {language}, stars: {stars}, topics: {github_topics}')
    logger.info(f'📄 Input - README length: {len(readme_content) if readme_content else 0} chars')
    logger.debug(f'📋 Full AI prompt:\n{prompt}')

    try:
        # Use default AI provider (Azure gateway) from settings
        ai = AIProvider()  # Uses DEFAULT_AI_PROVIDER from settings
        start_time = time.time()
        response = ai.complete(
            prompt=prompt,
            model=None,  # Use default model/deployment from settings
            temperature=0.7,
            max_tokens=500,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Track AI usage for cost reporting
        if user and ai.last_usage:
            usage = ai.last_usage
            AIUsageTracker.track_usage(
                user=user,
                feature='github_analysis',
                provider=ai.current_provider,
                model=ai.current_model,
                input_tokens=usage.get('prompt_tokens', 0),
                output_tokens=usage.get('completion_tokens', 0),
                latency_ms=latency_ms,
                status='success',
            )

        logger.info(f'✅ AI response received for {name}, length: {len(response)} chars')
        logger.info(f'📨 AI raw response: {response}')  # Full response, not truncated

        # Parse JSON response
        result = json.loads(response)
        logger.debug(f'AI parsed result keys: {list(result.keys())}')

        # Validate and sanitize the response
        description = result.get('description')
        validated = {
            'description': str(description)[:MAX_DESCRIPTION_LENGTH] if description else '',
            'category_ids': [],
            'topics': [],
            'tool_names': [],
        }

        # Validate category_ids
        if 'category_ids' in result and isinstance(result['category_ids'], list):
            validated['category_ids'] = [
                int(c)
                for c in result['category_ids']
                if isinstance(c, int | str) and MIN_CATEGORY_ID <= int(c) <= MAX_CATEGORY_ID
            ][:MAX_CATEGORIES_PER_PROJECT]

        # Validate topics
        if 'topics' in result and isinstance(result['topics'], list):
            validated['topics'] = [
                str(t).lower()[:MAX_TOPIC_LENGTH] for t in result['topics'] if t and isinstance(t, str)
            ][:MAX_TOPICS_PER_PROJECT]

        # Validate tool_names
        if 'tool_names' in result and isinstance(result['tool_names'], list):
            validated['tool_names'] = [str(t) for t in result['tool_names'] if t and isinstance(t, str)][
                :MAX_TOOLS_PER_PROJECT
            ]

        topics_count = len(validated['topics'])
        categories_count = len(validated['category_ids'])
        logger.info(f'AI analysis for {name}: {topics_count} topics, {categories_count} categories')
        logger.debug(
            f'Validated data: description_len={len(validated["description"])}, '
            f'topics={validated["topics"]}, tools={validated["tool_names"]}'
        )

        # Set hero image
        validated['hero_image'] = hero_image

        # Parse README if provided, otherwise generate blocks from repo structure
        if readme_content:
            logger.info(f'📖 Parsing README for {name}, length: {len(readme_content)} chars')
            readme_parsed = BaseParser.parse(readme_content, repo_data)
            logger.info(
                f'📊 README parsed for {name}:\n'
                f'   - Blocks: {len(readme_parsed.get("blocks", []))}\n'
                f'   - Hero image: {readme_parsed.get("hero_image")}\n'
                f'   - Hero quote: {readme_parsed.get("hero_quote")}\n'
                f'   - Mermaid diagrams found: {len(readme_parsed.get("mermaid_diagrams", []))}\n'
                f'   - Demo URLs: {len(readme_parsed.get("demo_urls", []))}'
            )

            # Log first few blocks for debugging
            blocks = readme_parsed.get('blocks', [])
            if blocks:
                logger.debug(f'First 3 blocks: {blocks[:3]}')

            # Transform README content into compelling portfolio copy
            logger.info(f'✨ Transforming README content for {name}...')
            transformed_blocks = BaseParser.transform_readme_content_with_ai(blocks, repo_data)

            # Optimize layout with AI for more dynamic columns
            optimized_blocks = BaseParser.optimize_layout_with_ai(transformed_blocks, repo_data)

            # Only update hero_image if README parsing found one
            readme_hero = readme_parsed.get('hero_image')
            if readme_hero:
                validated['hero_image'] = readme_hero
                logger.info(f'✨ Using hero image from README: {readme_hero}')
            else:
                logger.info(f'✨ README has no hero image, keeping generated image: {hero_image}')

            validated.update(
                {
                    'readme_blocks': optimized_blocks,
                    'hero_quote': readme_parsed.get('hero_quote'),
                    'mermaid_diagrams': readme_parsed.get('mermaid_diagrams', []),
                    'demo_urls': readme_parsed.get('demo_urls', []),
                    'demo_videos': readme_parsed.get('demo_videos', []),
                }
            )

            # Add screenshots as imageGrid block if available
            if visual_assets.get('screenshots'):
                screenshots = visual_assets['screenshots'][:6]  # Limit to 6
                validated['readme_blocks'].append(
                    {
                        'type': 'imageGrid',
                        'images': [{'url': url} for url in screenshots],
                        'caption': 'Project Screenshots',
                    }
                )
                logger.info(f'✅ Added {len(screenshots)} screenshots to blocks')

            # Generate architecture diagram if none found in README
            if not readme_parsed.get('mermaid_diagrams'):
                logger.info('🎨 No diagrams found in README, generating with AI...')
                generated_diagram = BaseParser.generate_architecture_diagram(repo_data)
                if generated_diagram:
                    validated['generated_diagram'] = generated_diagram
                    # Add heading before diagram
                    validated['readme_blocks'].append(
                        {'type': 'text', 'style': 'heading', 'content': 'System Architecture'}
                    )
                    # Add generated diagram as a mermaid block so frontend can display it
                    validated['readme_blocks'].append(
                        {
                            'type': 'mermaid',
                            'code': generated_diagram,
                            'caption': 'Project architecture and component relationships',
                        }
                    )
                    logger.info(f'✅ AI generated architecture diagram for {name} and added to blocks')
                    logger.debug(f'Generated diagram:\n{generated_diagram}')
                else:
                    logger.warning(f'❌ Failed to generate diagram for {name}')
            else:
                logger.info(f'✅ Using {len(readme_parsed.get("mermaid_diagrams", []))} diagram(s) from README')
        else:
            # No README - generate blocks from repo structure
            logger.info(f'📦 No README found for {name}, generating blocks from repo structure')
            generated_blocks = generate_blocks_from_repo_structure(repo_data)
            validated['readme_blocks'] = generated_blocks
            logger.info(f'✅ Generated {len(generated_blocks)} blocks from repo structure')

            # Add screenshots as imageGrid block if available
            if visual_assets.get('screenshots'):
                screenshots = visual_assets['screenshots'][:6]  # Limit to 6
                validated['readme_blocks'].append(
                    {
                        'type': 'imageGrid',
                        'images': [{'url': url} for url in screenshots],
                        'caption': 'Project Screenshots',
                    }
                )
                logger.info(f'✅ Added {len(screenshots)} screenshots to blocks')

            # Generate architecture diagram for repos without README
            logger.info('🎨 Generating architecture diagram with AI...')
            generated_diagram = BaseParser.generate_architecture_diagram(repo_data)
            if generated_diagram:
                validated['generated_diagram'] = generated_diagram
                # Add heading before diagram
                validated['readme_blocks'].append(
                    {'type': 'text', 'style': 'heading', 'content': 'System Architecture'}
                )
                validated['readme_blocks'].append(
                    {
                        'type': 'mermaid',
                        'code': generated_diagram,
                        'caption': 'Project architecture and component relationships',
                    }
                )
                logger.info('✅ AI generated architecture diagram and added to blocks')
            else:
                logger.warning(f'❌ Failed to generate diagram for {name}')

        return validated

    except (OpenAIError, AnthropicError) as e:
        # Expected AI provider errors - use fallback
        logger.warning(f'AI provider error for {name}: {e}, using fallback metadata')
    except json.JSONDecodeError as e:
        # AI returned invalid JSON - use fallback
        logger.warning(f'AI returned invalid JSON for {name}: {e}, using fallback metadata')
    except Exception as e:
        # Unexpected errors - log with full trace and use fallback
        logger.error(f'Unexpected error in AI analysis for {name}: {e}', exc_info=True)

    # Fallback metadata for all error cases
    fallback = {
        'description': description or f'A {language} project' if language else 'A software project',
        'category_ids': [9] if language else [],  # Default to Developer & Coding
        'topics': [t.lower() for t in github_topics[:8]] if github_topics else [],
        'tool_names': [],
        'readme_blocks': [],
        'hero_image': hero_image,  # Use generated GitHub image
        'hero_quote': None,
        'mermaid_diagrams': [],
        'demo_urls': [],
    }

    # Still try to parse README even if AI fails
    if readme_content:
        try:
            readme_parsed = BaseParser.parse(readme_content, repo_data)

            # Transform README content even in fallback
            blocks = readme_parsed.get('blocks', [])
            transformed_blocks = BaseParser.transform_readme_content_with_ai(blocks, repo_data)

            # Only update hero_image if README parsing found one
            readme_hero = readme_parsed.get('hero_image')
            if readme_hero:
                fallback['hero_image'] = readme_hero

            fallback.update(
                {
                    'readme_blocks': transformed_blocks,
                    'hero_quote': readme_parsed.get('hero_quote'),
                    'mermaid_diagrams': readme_parsed.get('mermaid_diagrams', []),
                    'demo_urls': readme_parsed.get('demo_urls', []),
                }
            )

            # Generate diagram if none found in README
            if not readme_parsed.get('mermaid_diagrams'):
                generated_diagram = BaseParser.generate_architecture_diagram(repo_data)
                if generated_diagram:
                    fallback['generated_diagram'] = generated_diagram
                    # Add heading before diagram
                    fallback['readme_blocks'].append(
                        {'type': 'text', 'style': 'heading', 'content': 'System Architecture'}
                    )
                    # Add generated diagram as a mermaid block so frontend can display it
                    fallback['readme_blocks'].append(
                        {
                            'type': 'mermaid',
                            'code': generated_diagram,
                            'caption': 'Project architecture and component relationships',
                        }
                    )
                    logger.info(f'✅ Generated diagram added to fallback blocks for {name}')
        except Exception as parse_error:
            logger.warning(f'README parsing also failed for {name}: {parse_error}')
    else:
        # No README in fallback - generate blocks from repo structure
        try:
            logger.info(f'📦 No README in fallback for {name}, generating blocks from repo structure')
            generated_blocks = generate_blocks_from_repo_structure(repo_data)
            fallback['readme_blocks'] = generated_blocks
            logger.info(f'✅ Generated {len(generated_blocks)} fallback blocks from repo structure')

            # Add screenshots as imageGrid block if available
            if visual_assets.get('screenshots'):
                screenshots = visual_assets['screenshots'][:6]  # Limit to 6
                fallback['readme_blocks'].append(
                    {
                        'type': 'imageGrid',
                        'images': [{'url': url} for url in screenshots],
                        'caption': 'Project Screenshots',
                    }
                )
                logger.info(f'✅ Added {len(screenshots)} screenshots to fallback blocks')

            # Generate architecture diagram
            generated_diagram = BaseParser.generate_architecture_diagram(repo_data)
            if generated_diagram:
                fallback['generated_diagram'] = generated_diagram
                # Add heading before diagram
                fallback['readme_blocks'].append({'type': 'text', 'style': 'heading', 'content': 'System Architecture'})
                fallback['readme_blocks'].append(
                    {
                        'type': 'mermaid',
                        'code': generated_diagram,
                        'caption': 'Project architecture and component relationships',
                    }
                )
                logger.info(f'✅ Generated diagram added to fallback blocks for {name}')
        except Exception as gen_error:
            logger.warning(f'Block generation also failed for {name}: {gen_error}')

    return fallback
