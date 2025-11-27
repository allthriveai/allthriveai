"""AI-powered GitHub repository analyzer for smart project metadata."""

import logging

from anthropic import AnthropicError
from openai import OpenAIError

from services.ai_provider import AIProvider
from services.github_constants import (
    MAX_CATEGORIES_PER_PROJECT,
    MAX_CATEGORY_ID,
    MAX_DESCRIPTION_LENGTH,
    MAX_TOOLS_PER_PROJECT,
    MAX_TOPIC_LENGTH,
    MAX_TOPICS_PER_PROJECT,
    MIN_CATEGORY_ID,
)
from services.readme_parser import ReadmeParser

logger = logging.getLogger(__name__)


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

    logger.debug(f'Starting AI analysis for {name}')
    logger.debug(f'Input - description: {description[:100] if description else "None"}...')
    logger.debug(f'Input - language: {language}, stars: {stars}, topics: {github_topics}')
    logger.debug(f'Input - README length: {len(readme_content) if readme_content else 0} chars')

    try:
        # Use default AI provider (Azure gateway) from settings
        ai = AIProvider()  # Uses DEFAULT_AI_PROVIDER from settings
        response = ai.complete(
            prompt=prompt,
            model=None,  # Use default model/deployment from settings
            temperature=0.7,
            max_tokens=500,
        )

        logger.debug(f'AI response received for {name}, length: {len(response)} chars')
        logger.debug(f'AI raw response: {response[:500]}...')

        # Parse JSON response
        import json

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

        # Parse README if provided
        if readme_content:
            logger.debug(f'Parsing README for {name}, length: {len(readme_content)} chars')
            readme_parsed = ReadmeParser.parse(readme_content, repo_data)
            logger.debug(
                f'README parsed for {name}: blocks={len(readme_parsed.get("blocks", []))}, '
                f'hero_image={readme_parsed.get("hero_image")}, '
                f'mermaid_diagrams={len(readme_parsed.get("mermaid_diagrams", []))}'
            )
            validated.update(
                {
                    'readme_blocks': readme_parsed.get('blocks', []),
                    'hero_image': readme_parsed.get('hero_image'),
                    'hero_quote': readme_parsed.get('hero_quote'),
                    'mermaid_diagrams': readme_parsed.get('mermaid_diagrams', []),
                    'demo_urls': readme_parsed.get('demo_urls', []),
                }
            )
            logger.debug(f'Updated validated with README data: hero_image={validated.get("hero_image")}')

            # Generate architecture diagram if none found in README
            if not readme_parsed.get('mermaid_diagrams'):
                generated_diagram = ReadmeParser.generate_architecture_diagram(repo_data)
                if generated_diagram:
                    validated['generated_diagram'] = generated_diagram
                    logger.info(f'Generated architecture diagram for {name}')

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
        'hero_image': None,
        'hero_quote': None,
        'mermaid_diagrams': [],
        'demo_urls': [],
    }

    # Still try to parse README even if AI fails
    if readme_content:
        try:
            readme_parsed = ReadmeParser.parse(readme_content, repo_data)
            fallback.update(
                {
                    'readme_blocks': readme_parsed.get('blocks', []),
                    'hero_image': readme_parsed.get('hero_image'),
                    'hero_quote': readme_parsed.get('hero_quote'),
                    'mermaid_diagrams': readme_parsed.get('mermaid_diagrams', []),
                    'demo_urls': readme_parsed.get('demo_urls', []),
                }
            )

            # Generate diagram
            if not readme_parsed.get('mermaid_diagrams'):
                generated_diagram = ReadmeParser.generate_architecture_diagram(repo_data)
                if generated_diagram:
                    fallback['generated_diagram'] = generated_diagram
        except Exception as parse_error:
            logger.warning(f'README parsing also failed for {name}: {parse_error}')

    return fallback
