"""AI-powered GitHub repository analyzer for smart project metadata."""

import json
import logging

from anthropic import AnthropicError
from openai import OpenAIError

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
from services.ai_provider import AIProvider

logger = logging.getLogger(__name__)


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


def analyze_github_repo(repo_data: dict, readme_content: str = '') -> dict:
    """Use AI to analyze a GitHub repo and generate smart metadata.

    Args:
        repo_data: Repository data from GitHub API
        readme_content: README content (optional)

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
        response = ai.complete(
            prompt=prompt,
            model=None,  # Use default model/deployment from settings
            temperature=0.7,
            max_tokens=500,
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
