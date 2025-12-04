"""AI-powered analyzer for YouTube videos to extract tools, categories, and topics."""

import json
import logging
import time
from typing import Any

from core.ai_usage.tracker import AIUsageTracker
from core.taxonomy.models import Taxonomy
from core.tools.models import Tool
from services.ai.provider import AIProvider

logger = logging.getLogger(__name__)


def analyze_youtube_video(video_data: dict[str, Any], user) -> dict[str, Any]:
    """
    Analyze YouTube video metadata using AI to extract tools, categories, and topics.

    Args:
        video_data: Video metadata from YouTube API (title, description, tags, etc.)
        user: User object (for context/preferences)

    Returns:
        Dict with:
        {
            'tools': [Tool objects],
            'categories': [Taxonomy objects],
            'topics': [topic strings]
        }
    """
    logger.info(f'Analyzing video: {video_data["title"]}')

    # Prepare context for AI analysis
    context = _prepare_analysis_context(video_data)

    # Use AI to extract metadata
    try:
        ai_result = _call_ai_analyzer(context, user=user)

        # Match tools from database
        tools = _match_tools(ai_result.get('tools', []))

        # Match categories from taxonomy
        categories = _match_categories(ai_result.get('categories', []))

        # Extract topics (cleaned and validated)
        topics = _clean_topics(ai_result.get('topics', []))

        logger.info(f'Analysis complete: {len(tools)} tools, {len(categories)} categories, {len(topics)} topics')

        return {'tools': tools, 'categories': categories, 'topics': topics}

    except Exception as e:
        logger.error(f'AI analysis failed: {e}', exc_info=True)
        # Fallback to basic extraction from YouTube tags
        return _fallback_analysis(video_data)


def _prepare_analysis_context(video_data: dict[str, Any]) -> str:
    """Prepare text context for AI analysis."""
    context_parts = [
        f'Title: {video_data["title"]}',
        f'Description: {video_data["description"][:500]}',  # First 500 chars
    ]

    if video_data.get('tags'):
        context_parts.append(f'Tags: {", ".join(video_data["tags"][:10])}')

    return '\n'.join(context_parts)


def _call_ai_analyzer(context: str, user=None) -> dict[str, list[str]]:
    """
    Call AI service to analyze video content.

    Uses the AI gateway (AIProvider) to extract tools, categories, and topics.
    The gateway automatically selects the configured provider (Azure, OpenAI, Anthropic, Gemini).

    Args:
        context: Text context for AI analysis
        user: Django User instance (optional, for AI usage tracking)
    """
    # System prompt for structured extraction
    system_prompt = """You are an expert at analyzing technical content and extracting metadata.

From the video information provided, extract:
1. **Tools/Technologies**: Specific tools, frameworks, libraries, or technologies mentioned or demonstrated
   - Examples: React, Python, Figma, Blender, VS Code, Docker, AWS
   - Be specific (e.g., "React" not just "JavaScript framework")

2. **Categories**: High-level categories that best describe the content
   - Choose from: Web Development, Mobile Development, Data Science, AI/ML, Design, DevOps,
     Cloud Computing, Game Development, Content Creation, Tutorial, Project Showcase, Other
   - Select 1-3 most relevant categories

3. **Topics**: Specific topics or themes covered
   - Examples: authentication, responsive design, data visualization, animation, deployment
   - Keep topics specific and actionable
   - Limit to 5-8 most relevant topics

Respond in this exact JSON format:
{
  "tools": ["tool1", "tool2", ...],
  "categories": ["category1", "category2"],
  "topics": ["topic1", "topic2", ...]
}"""

    try:
        # Initialize AI provider (uses DEFAULT_AI_PROVIDER from settings)
        user_id = user.id if user else None
        ai = AIProvider(user_id=user_id)

        start_time = time.time()
        response = ai.complete(
            prompt=f'Analyze this video:\n\n{context}',
            system_message=system_prompt,
            temperature=0.3,  # Lower temperature for more consistent extraction
            max_tokens=1024,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Track AI usage for cost reporting
        if user and ai.last_usage:
            AIUsageTracker.track_usage(
                user=user,
                feature='youtube_analysis',
                provider=ai.current_provider,
                model=ai.current_model,
                input_tokens=ai.last_usage.get('prompt_tokens', 0),
                output_tokens=ai.last_usage.get('completion_tokens', 0),
                latency_ms=latency_ms,
                status='success',
            )

        # Parse JSON response
        result = json.loads(response)

        return {
            'tools': result.get('tools', []),
            'categories': result.get('categories', []),
            'topics': result.get('topics', []),
        }

    except Exception as e:
        logger.error(f'AI analysis failed: {e}')
        raise


def _match_tools(tool_names: list[str]) -> list[Tool]:
    """Match extracted tool names against database tools.

    Optimized to prevent N+1 queries by loading all active tools once.
    """
    if not tool_names:
        return []

    # Load all active tools once to prevent N+1 queries
    all_active_tools = Tool.objects.filter(is_active=True).values_list('name', 'slug', 'id')

    # Create lookup dicts (case-insensitive for name, case-sensitive for slug)
    tools_by_name = {name.lower(): tool_id for name, slug, tool_id in all_active_tools}
    tools_by_slug = {slug: tool_id for name, slug, tool_id in all_active_tools}

    # Fetch tool objects by ID
    tool_ids = set()

    for tool_name in tool_names:
        tool_name_lower = tool_name.strip().lower()

        # Try exact match by name first
        if tool_name_lower in tools_by_name:
            tool_ids.add(tools_by_name[tool_name_lower])
        else:
            # Try fuzzy match by slug
            slug = tool_name_lower.replace(' ', '-').replace('.', '-')
            if slug in tools_by_slug:
                tool_ids.add(tools_by_slug[slug])

    # Fetch all matched tools in one query
    if tool_ids:
        return list(Tool.objects.filter(id__in=tool_ids, is_active=True))

    return []


def _match_categories(category_names: list[str]) -> list[Taxonomy]:
    """Match extracted categories against taxonomy.

    Optimized to prevent N+1 queries by loading active categories once.
    """
    if not category_names:
        return []

    # Mapping of common variations to canonical names
    category_mapping = {
        'web development': 'Web Development',
        'web dev': 'Web Development',
        'mobile development': 'Mobile Development',
        'mobile dev': 'Mobile Development',
        'data science': 'Data Science',
        'ai/ml': 'AI & Machine Learning',
        'artificial intelligence': 'AI & Machine Learning',
        'machine learning': 'AI & Machine Learning',
        'design': 'Design',
        'devops': 'DevOps',
        'cloud computing': 'Cloud',
        'cloud': 'Cloud',
        'game development': 'Game Development',
        'gamedev': 'Game Development',
        'content creation': 'Content Creation',
        'tutorial': 'Tutorial',
        'project showcase': 'Project Showcase',
    }

    # Compute canonical names to match
    canonical_names = {category_mapping.get(name.lower(), name).lower() for name in category_names}

    # Load all active categories once and build lookup by lower(name)
    categories_by_name = {}
    for category in Taxonomy.objects.filter(taxonomy_type='category', is_active=True).only('id', 'name'):
        categories_by_name[category.name.lower()] = category

    # Map inputs to taxonomy objects
    matched_categories = []
    for name in canonical_names:
        category = categories_by_name.get(name)
        if category:
            matched_categories.append(category)

    return matched_categories


def _clean_topics(topics: list[str]) -> list[str]:
    """Clean and validate topic strings."""
    cleaned = []

    for topic in topics:
        # Clean up topic
        topic = topic.strip().lower()

        # Validate length
        if 3 <= len(topic) <= 50:
            # Remove special characters except hyphens
            topic = ''.join(c for c in topic if c.isalnum() or c in ' -')
            topic = ' '.join(topic.split())  # Normalize whitespace

            if topic and topic not in cleaned:
                cleaned.append(topic)

    return cleaned[:8]  # Limit to 8 topics


def _fallback_analysis(video_data: dict[str, Any]) -> dict[str, Any]:
    """
    Fallback analysis using YouTube tags when AI fails.
    Simple keyword matching without AI, optimized to prevent N+1 queries.
    """
    logger.info('Using fallback analysis (YouTube tags only)')

    youtube_tags = video_data.get('tags', [])

    # Use optimized tool matching (prevents N+1)
    tools = _match_tools(youtube_tags[:10])

    # Extract topics from YouTube tags
    topics = _clean_topics(youtube_tags[:8])

    return {
        'tools': tools,
        'categories': [],  # No categories in fallback
        'topics': topics,
    }
