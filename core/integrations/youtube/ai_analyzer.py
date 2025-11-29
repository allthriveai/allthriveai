"""AI-powered analyzer for YouTube videos to extract tools, categories, and topics."""

import logging
from typing import Any

from django.conf import settings

from core.taxonomy.models import Taxonomy
from core.tools.models import Tool

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
        ai_result = _call_ai_analyzer(context)

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


def _call_ai_analyzer(context: str) -> dict[str, list[str]]:
    """
    Call AI service to analyze video content.

    Uses Azure OpenAI or OpenAI to extract tools, categories, and topics.
    """
    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_openai import AzureChatOpenAI

        # Initialize LLM
        llm = AzureChatOpenAI(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            deployment_name=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            temperature=0.3,  # Lower temperature for more consistent extraction
        )

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

        messages = [SystemMessage(content=system_prompt), HumanMessage(content=f'Analyze this video:\n\n{context}')]

        response = llm.invoke(messages)

        # Parse JSON response
        import json

        result = json.loads(response.content)

        return {
            'tools': result.get('tools', []),
            'categories': result.get('categories', []),
            'topics': result.get('topics', []),
        }

    except Exception as e:
        logger.error(f'AI analysis failed: {e}')
        raise


def _match_tools(tool_names: list[str]) -> list[Tool]:
    """Match extracted tool names against database tools."""
    matched_tools = []

    for tool_name in tool_names:
        # Case-insensitive match
        tool = Tool.objects.filter(name__iexact=tool_name.strip(), is_active=True).first()

        if tool:
            matched_tools.append(tool)
        else:
            # Try fuzzy match by slug
            slug = tool_name.lower().replace(' ', '-').replace('.', '-')
            tool = Tool.objects.filter(slug__icontains=slug, is_active=True).first()

            if tool:
                matched_tools.append(tool)

    return matched_tools


def _match_categories(category_names: list[str]) -> list[Taxonomy]:
    """Match extracted categories against taxonomy."""
    matched_categories = []

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

    for category_name in category_names:
        # Normalize to canonical name
        canonical_name = category_mapping.get(category_name.lower(), category_name)

        # Look up in taxonomy
        category = Taxonomy.objects.filter(
            name__iexact=canonical_name, taxonomy_type='category', is_active=True
        ).first()

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
    Simple keyword matching without AI.
    """
    logger.info('Using fallback analysis (YouTube tags only)')

    youtube_tags = video_data.get('tags', [])

    # Try to match tools from YouTube tags
    tools = []
    for tag in youtube_tags[:10]:
        tool = Tool.objects.filter(name__iexact=tag.strip(), is_active=True).first()
        if tool:
            tools.append(tool)

    # Extract topics from YouTube tags
    topics = _clean_topics(youtube_tags[:8])

    return {
        'tools': tools,
        'categories': [],  # No categories in fallback
        'topics': topics,
    }
