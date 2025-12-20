"""AI-powered image analyzer for generating project metadata from uploaded images."""

import json
import logging
import re
import time

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider

logger = logging.getLogger(__name__)


# Prompt template for image analysis using vision
IMAGE_TEMPLATE_PROMPT = """Analyze this uploaded image and generate structured content for a portfolio project page.

Image Information:
- Filename: {filename}
- Title provided by user: {title}

{user_context}

Based on the image content and context provided, generate a compelling project page. Return valid JSON:

{{
  "description": "2-3 sentence description explaining what this image shows and the creative process or technique",
  "overview": {{
    "headline": "One compelling sentence hook about this creative work (max 100 chars)",
    "description": "2-3 sentence explanation of the creative vision, technique, or story behind the image"
  }},
  "features": [
    {{"icon": "FaPalette", "title": "Feature 1", "description": "Key visual element or technique used"}},
    {{"icon": "FaMagic", "title": "Feature 2", "description": "Creative approach or style"}},
    {{"icon": "FaStar", "title": "Feature 3", "description": "What makes this unique or interesting"}}
  ],
  "tech_stack": {{
    "categories": [
      {{"name": "Tools Used", "technologies": ["Tool1", "Tool2"]}},
      {{"name": "Techniques", "technologies": ["Technique1"]}}
    ]
  }},
  "category_ids": [1],
  "topics": ["ai-art", "digital-art"],
  "tool_names": ["Midjourney"]
}}

IMPORTANT GUIDELINES:
- Analyze the actual image content to describe what's shown
- For features: Use FontAwesome icons (react-icons/fa format):
  FaPalette (design/art), FaMagic (creative/AI), FaBrain (AI/ML), FaImage (photography),
  FaPaintBrush (illustration), FaCamera (photo), FaStar (highlight), FaLightbulb (concept),
  FaEye (visual style), FaRocket (innovative), FaHeart (emotion), FaGem (quality)
- Category IDs:
  1=AI Art & Design, 2=AI Music & Audio, 3=Video & Animation, 4=AI Writing,
  5=Productivity & Automation, 6=Business & Marketing, 7=Education & Learning,
  8=Research & Science, 9=Developer & Coding, 10=Data & Analytics,
  11=Community Projects, 12=News & Updates, 13=Tutorials & Guides, 14=Reviews & Comparisons, 15=Other
- Topics: lowercase, specific tags (3-8 keywords) describing the image style/subject
- tool_names: AI tools likely used (Midjourney, DALL-E, Stable Diffusion, Leonardo.ai, Adobe Firefly, Photoshop, Illustrator, etc.)

Return ONLY valid JSON, no markdown code blocks."""


def analyze_image_for_template(
    image_url: str,
    filename: str,
    title: str = '',
    tool_hint: str = '',
    user=None,
) -> dict:
    """Generate section-based template content for an uploaded image using vision AI.

    Args:
        image_url: S3/MinIO URL of the uploaded image
        filename: Original filename of the image
        title: Title provided by user
        tool_hint: Optional tool hint from user (e.g., "Midjourney")
        user: Django User instance (optional, for AI usage tracking)

    Returns:
        dict with sections array and metadata for template v2 format
    """
    # Build context string
    context_parts = []
    if tool_hint:
        context_parts.append(f'Tool used: {tool_hint}')
    context_str = f'User context: {", ".join(context_parts)}' if context_parts else 'No additional context provided.'

    # Build prompt
    prompt = IMAGE_TEMPLATE_PROMPT.format(
        filename=filename,
        title=title or 'Untitled',
        user_context=context_str,
    )

    logger.info(f'🎨 Starting image analysis for {filename}')

    try:
        # Use Gemini for vision analysis
        ai = AIProvider(provider='gemini', user_id=user.id if user else None)
        start_time = time.time()

        # Use vision API to analyze the actual image
        response = ai.complete_with_image(
            prompt=prompt,
            image_url=image_url,
            temperature=0.7,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Track AI usage for cost reporting
        if user and ai.last_usage:
            usage = ai.last_usage
            AIUsageTracker.track_usage(
                user=user,
                feature='image_template_analysis',
                provider=ai.current_provider,
                model=ai.current_model,
                input_tokens=usage.get('prompt_tokens', 0),
                output_tokens=usage.get('completion_tokens', 0),
                latency_ms=latency_ms,
                status='success',
            )

        logger.info(f'✅ Image AI response received for {filename}')

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
        name_slug = _slugify(title or filename)[:8]

        # Overview section
        if result.get('overview'):
            overview = result['overview']
            sections.append(
                {
                    'id': f'section-overview-{name_slug}',
                    'type': 'overview',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'headline': overview.get('headline', ''),
                        'description': overview.get('description', result.get('description', '')),
                    },
                }
            )
            section_order += 1

        # Features section
        if result.get('features') and len(result['features']) > 0:
            sections.append(
                {
                    'id': f'section-features-{name_slug}',
                    'type': 'features',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'features': result['features'][:6],
                    },
                }
            )
            section_order += 1

        # Tech stack section (tools/techniques used)
        if result.get('tech_stack') and result['tech_stack'].get('categories'):
            sections.append(
                {
                    'id': f'section-tech-{name_slug}',
                    'type': 'tech_stack',
                    'enabled': True,
                    'order': section_order,
                    'content': result['tech_stack'],
                }
            )
            section_order += 1

        # Add tool hint to tool_names if provided
        tool_names = result.get('tool_names', [])
        if tool_hint and tool_hint not in tool_names:
            tool_names.insert(0, tool_hint)

        # Return structured analysis
        return {
            'templateVersion': 2,
            'description': result.get('description', ''),
            'sections': sections,
            'category_ids': result.get('category_ids', [1]),  # Default to AI Art & Design
            'topics': result.get('topics', ['ai-art', 'digital-art']),
            'tool_names': tool_names,
        }

    except json.JSONDecodeError as e:
        logger.warning(f'Failed to parse image AI response: {e}')
        return _fallback_analysis(title, filename, tool_hint)
    except Exception as e:
        logger.error(f'Error analyzing image: {e}', exc_info=True)
        return _fallback_analysis(title, filename, tool_hint)


def _fallback_analysis(title: str, filename: str, tool_hint: str = '') -> dict:
    """Generate fallback analysis when AI fails."""
    name_slug = _slugify(title or filename)[:8]
    display_title = title or _generate_title_from_filename(filename)

    tool_names = [tool_hint] if tool_hint else []

    return {
        'templateVersion': 2,
        'description': f'A creative work: {display_title}',
        'sections': [
            {
                'id': f'section-overview-{name_slug}',
                'type': 'overview',
                'enabled': True,
                'order': 0,
                'content': {
                    'headline': display_title,
                    'description': f'An image project showcasing {display_title.lower()}.',
                },
            },
        ],
        'category_ids': [1],  # AI Art & Design
        'topics': ['ai-art', 'digital-art', 'creative'],
        'tool_names': tool_names,
    }


def _slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    # Remove file extension
    text = re.sub(r'\.[^.]+$', '', text)
    # Convert to lowercase and replace non-alphanumeric with hyphens
    text = re.sub(r'[^a-zA-Z0-9]+', '-', text.lower())
    # Remove leading/trailing hyphens
    return text.strip('-')


def _generate_title_from_filename(filename: str) -> str:
    """Generate a human-readable title from a filename."""
    # Remove extension
    name = re.sub(r'\.[^.]+$', '', filename)
    # Replace underscores and hyphens with spaces
    name = re.sub(r'[-_]+', ' ', name)
    # Title case
    return name.title()
