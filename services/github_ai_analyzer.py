"""AI-powered GitHub repository analyzer for smart project metadata."""

import logging

from services.ai_provider import AIProvider

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

    try:
        # Use default AI provider (Azure gateway) from settings
        ai = AIProvider()  # Uses DEFAULT_AI_PROVIDER from settings
        response = ai.complete(
            prompt=prompt,
            model=None,  # Use default model/deployment from settings
            temperature=0.7,
            max_tokens=500,
        )

        # Parse JSON response
        import json

        result = json.loads(response)

        # Validate and sanitize the response
        validated = {
            'description': str(result.get('description', ''))[:500] if result.get('description') else '',
            'category_ids': [],
            'topics': [],
            'tool_names': [],
        }

        # Validate category_ids (must be 1-15)
        if 'category_ids' in result and isinstance(result['category_ids'], list):
            validated['category_ids'] = [
                int(c) for c in result['category_ids'] if isinstance(c, int | str) and 1 <= int(c) <= 15
            ][:2]

        # Validate topics (strings, max 20, max 50 chars each)
        if 'topics' in result and isinstance(result['topics'], list):
            validated['topics'] = [str(t).lower()[:50] for t in result['topics'] if t and isinstance(t, str)][:20]

        # Validate tool_names (strings)
        if 'tool_names' in result and isinstance(result['tool_names'], list):
            validated['tool_names'] = [str(t) for t in result['tool_names'] if t and isinstance(t, str)][:5]

        topics_count = len(validated['topics'])
        categories_count = len(validated['category_ids'])
        logger.info(f'AI analysis for {name}: {topics_count} topics, ' f'{categories_count} categories')
        return validated

    except Exception as e:
        logger.warning(f'AI analysis failed for {name}: {e}, using fallback metadata')
        # Fallback to basic metadata
        return {
            'description': description or f'A {language} project' if language else 'A software project',
            'category_ids': [9] if language else [],  # Default to Developer & Coding
            'topics': [t.lower() for t in github_topics[:8]] if github_topics else [],
            'tool_names': [],
        }
