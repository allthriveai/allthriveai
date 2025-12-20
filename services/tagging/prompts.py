"""
AI prompts for taxonomy extraction.

These prompts are designed to extract structured taxonomy tags from content.
The output format is JSON for reliable parsing.
"""

from typing import Any

# System prompt for taxonomy extraction
TAXONOMY_EXTRACTION_SYSTEM = """You are an expert content classifier for an AI learning platform.
Your job is to analyze content and extract relevant taxonomy tags.

You must respond with valid JSON only. No explanation, no markdown, just the JSON object.

Available taxonomy types and their valid values:
{taxonomy_context}

Rules:
1. Only use values from the provided taxonomy lists
2. Return slugs, not display names
3. Be conservative - only tag what's clearly evident in the content
4. For confidence, use: 0.9+ for explicit mentions, 0.7-0.9 for strong inference, 0.5-0.7 for weak inference
5. Omit fields if confidence would be below 0.5"""

# User prompt template for content analysis
CONTENT_ANALYSIS_PROMPT = """Analyze this content and extract taxonomy tags.

Title: {title}
Description: {description}
Content Preview: {content_preview}
Additional Context: {additional_context}

Return a JSON object with this structure:
{{
    "content_type": {{"value": "slug", "confidence": 0.0-1.0}},
    "time_investment": {{"value": "slug", "confidence": 0.0-1.0}},
    "difficulty": {{"value": "slug", "confidence": 0.0-1.0}},
    "pricing": {{"value": "slug", "confidence": 0.0-1.0}},
    "topics": [{{"value": "slug", "confidence": 0.0-1.0}}],
    "tools": [{{"value": "slug", "confidence": 0.0-1.0}}],
    "categories": [{{"value": "slug", "confidence": 0.0-1.0}}]
}}

Only include fields where you have reasonable confidence. Omit uncertain fields."""


def build_taxonomy_context(taxonomies_by_type: dict[str, list[dict]]) -> str:
    """
    Build taxonomy context string for the system prompt.

    Args:
        taxonomies_by_type: Dict mapping taxonomy_type to list of {slug, name} dicts

    Returns:
        Formatted string describing available taxonomies
    """
    lines = []
    for tax_type, items in taxonomies_by_type.items():
        if items:
            values = ', '.join(f'"{item["slug"]}"' for item in items[:20])  # Limit to 20 per type
            if len(items) > 20:
                values += f' (and {len(items) - 20} more)'
            lines.append(f'- {tax_type}: [{values}]')

    return '\n'.join(lines)


def build_content_preview(content: Any, max_length: int = 2000) -> str:
    """
    Build a content preview string for the AI prompt.

    Args:
        content: A content model instance (Project, Quiz, Tool, MicroLesson)
        max_length: Maximum length of the preview

    Returns:
        Truncated content preview
    """
    parts = []

    # Extract text based on content type
    if hasattr(content, 'content') and content.content:
        # Project content (JSON blocks)
        if isinstance(content.content, list):
            for block in content.content[:5]:  # First 5 blocks
                if isinstance(block, dict):
                    if block.get('type') == 'text':
                        parts.append(block.get('content', '')[:500])
                    elif block.get('type') == 'code':
                        parts.append(f"[Code: {block.get('language', 'unknown')}]")
        elif isinstance(content.content, str):
            parts.append(content.content[:1000])

    if hasattr(content, 'overview') and content.overview:
        parts.append(content.overview[:500])

    if hasattr(content, 'content_template') and content.content_template:
        parts.append(content.content_template[:500])

    if hasattr(content, 'questions'):
        # Quiz questions - only fetch the question text field
        questions = content.questions.only('question')[:3]
        for q in questions:
            if q.question:
                parts.append(f'Q: {q.question[:200]}')

    preview = ' '.join(parts)
    if len(preview) > max_length:
        preview = preview[:max_length] + '...'

    return preview


def build_additional_context(content: Any) -> str:
    """
    Build additional context from content metadata.

    Args:
        content: A content model instance

    Returns:
        Additional context string
    """
    context_parts = []

    # Tools used
    if hasattr(content, 'tools'):
        tool_names = list(content.tools.values_list('name', flat=True)[:10])
        if tool_names:
            context_parts.append(f"Tools: {', '.join(tool_names)}")

    # Categories
    if hasattr(content, 'categories'):
        cat_names = list(content.categories.values_list('name', flat=True)[:10])
        if cat_names:
            context_parts.append(f"Categories: {', '.join(cat_names)}")

    # Topics (from topics_taxonomy M2M)
    if hasattr(content, 'topics_taxonomy'):
        topic_names = list(content.topics_taxonomy.values_list('name', flat=True)[:10])
        if topic_names:
            context_parts.append(f"Topics: {', '.join(topic_names)}")

    # Existing difficulty (for validation)
    if hasattr(content, 'difficulty') and content.difficulty:
        context_parts.append(f'Stated difficulty: {content.difficulty}')

    # Duration hints
    if hasattr(content, 'estimated_time') and content.estimated_time:
        context_parts.append(f'Estimated time: {content.estimated_time} minutes')

    if hasattr(content, 'question_count'):
        context_parts.append(f'Question count: {content.question_count}')

    return '. '.join(context_parts)
