"""AI-powered image analyzer for generating project metadata from uploaded images."""

import json
import logging
import re
import time

from django.conf import settings

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider

logger = logging.getLogger(__name__)

# Default provider for image analysis - can be overridden via IMAGE_ANALYSIS_PROVIDER env var
DEFAULT_IMAGE_ANALYSIS_PROVIDER = getattr(settings, 'IMAGE_ANALYSIS_PROVIDER', 'gemini')
# Fallback provider if primary fails - can be overridden via IMAGE_ANALYSIS_FALLBACK_PROVIDER env var
FALLBACK_IMAGE_ANALYSIS_PROVIDER = getattr(settings, 'IMAGE_ANALYSIS_FALLBACK_PROVIDER', 'openai')


# Prompt template for image analysis using vision
IMAGE_TEMPLATE_PROMPT = """Analyze this uploaded image and generate structured content for a portfolio project page.

Image Information:
- Filename: {filename}
- Title provided by user: {title}

{user_context}

Based on the image content and context provided, generate a compelling project page. Return valid JSON:

{{
  "title": "Creative, catchy title for this artwork (2-6 words, inspired by the image content)",
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
- tool_names: AI tools likely used (Midjourney, DALL-E, Stable Diffusion, Leonardo.ai,
  Adobe Firefly, Photoshop, Illustrator, etc.)

Return ONLY valid JSON, no markdown code blocks."""


def analyze_image_for_template(
    image_url: str,
    filename: str,
    title: str = '',
    tool_hint: str = '',
    user=None,
    max_retries: int = 2,
    provider: str | None = None,
) -> dict:
    """Generate section-based template content for an uploaded image using vision AI.

    Args:
        image_url: S3/MinIO URL of the uploaded image
        filename: Original filename of the image
        title: Title provided by user (if empty, AI generates one)
        tool_hint: Optional tool hint from user (e.g., "Midjourney")
        user: Django User instance (optional, for AI usage tracking)
        max_retries: Number of retry attempts on failure (default: 2)
        provider: AI provider to use ('gemini', 'openai'). If None, uses IMAGE_ANALYSIS_PROVIDER setting.

    Returns:
        dict with sections array and metadata for template v2 format
        Always includes a 'title' field - either AI-generated or fallback
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

    # Determine which providers to try
    primary_provider = provider or DEFAULT_IMAGE_ANALYSIS_PROVIDER
    fallback_provider = (
        FALLBACK_IMAGE_ANALYSIS_PROVIDER if FALLBACK_IMAGE_ANALYSIS_PROVIDER != primary_provider else None
    )
    providers_to_try = [primary_provider]
    if fallback_provider:
        providers_to_try.append(fallback_provider)

    logger.info(f'🎨 Starting image analysis for {filename} (providers: {providers_to_try})')

    last_error = None
    result = None

    for current_provider in providers_to_try:
        logger.info(f'Trying provider: {current_provider}')

        for attempt in range(max_retries + 1):
            try:
                ai = AIProvider(provider=current_provider, user_id=user.id if user else None)
                start_time = time.time()

                # Use vision API to analyze the actual image
                response = ai.complete_with_image(
                    prompt=prompt,
                    image_url=image_url,
                    temperature=0.7 if attempt == 0 else 0.5,  # Lower temp on retry for more consistent output
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

                logger.info(
                    f'✅ Image AI response received for {filename} (provider={current_provider}, attempt {attempt + 1})'
                )

                # Clean response - remove markdown code blocks if present
                clean_response = response.strip()
                if clean_response.startswith('```'):
                    # Handle ```json or just ```
                    first_newline = clean_response.find('\n')
                    if first_newline > 0:
                        clean_response = clean_response[first_newline + 1 :]
                if clean_response.endswith('```'):
                    clean_response = clean_response.rsplit('```', 1)[0]
                clean_response = clean_response.strip()

                result = json.loads(clean_response)

                # Validate we got a title - if not, use tool hint to generate one
                if not result.get('title') or result.get('title') == 'Untitled':
                    result['title'] = _generate_creative_title(tool_hint, filename)
                    logger.info(f'AI returned empty title, generated: {result["title"]}')

                # Success! Break out of both loops
                break

            except json.JSONDecodeError as e:
                last_error = e
                logger.warning(
                    f'Failed to parse image AI response (provider={current_provider}, attempt {attempt + 1}): {e}'
                )
                if attempt < max_retries:
                    logger.info('Retrying image analysis...')
                    time.sleep(0.5)  # Brief pause before retry
                    continue
                # All retries exhausted for this provider
                logger.warning(f'All {max_retries + 1} attempts failed for {current_provider}')
                break  # Try next provider

            except Exception as e:
                last_error = e
                logger.error(
                    f'Error analyzing image (provider={current_provider}, attempt {attempt + 1}): {e}', exc_info=True
                )
                if attempt < max_retries:
                    logger.info('Retrying image analysis...')
                    time.sleep(0.5)
                    continue
                # All retries exhausted for this provider
                logger.warning(f'All {max_retries + 1} attempts failed for {current_provider}')
                break  # Try next provider

        # If we got a result, break out of provider loop
        if result is not None:
            break

    # If we got here without a result, use fallback
    if result is None:
        logger.error(f'All providers failed for {filename}: {last_error}')
        return _fallback_analysis(title, filename, tool_hint)

    # Build sections array from AI response
    sections = []
    section_order = 0
    name_slug = _slugify(result.get('title') or title or filename)[:8]

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
        'title': result.get('title', ''),  # AI-generated title from image analysis
        'description': result.get('description', ''),
        'sections': sections,
        'category_ids': result.get('category_ids', [1]),  # Default to AI Art & Design
        'topics': result.get('topics', ['ai-art', 'digital-art']),
        'tool_names': tool_names,
    }


def _generate_creative_title(tool_hint: str, filename: str) -> str:
    """Generate a creative title when AI doesn't provide one.

    Creates unique titles by combining the tool with a random creative suffix,
    or falling back to a cleaned-up filename. This avoids slug collisions
    from generic titles like "Midjourney Creation".
    """
    import random

    # Creative suffixes to make titles more unique
    creative_suffixes = [
        'Artwork',
        'Creation',
        'Vision',
        'Dream',
        'Masterpiece',
        'Composition',
        'Design',
        'Piece',
        'Work',
        'Art',
        'Expression',
        'Study',
        'Exploration',
        'Project',
        'Render',
    ]

    # First, try to get a meaningful title from the filename
    filename_title = _generate_title_from_filename(filename)

    # If filename gives us something meaningful (not just "Untitled" or "Image")
    if filename_title and filename_title.lower() not in ('untitled project', 'untitled', 'image', 'img', 'photo'):
        # Use the filename as the base, optionally with tool prefix
        if tool_hint:
            return f'{filename_title}'  # Just use filename - it's more descriptive
        return filename_title

    # If we have a tool hint, create a unique combination
    if tool_hint:
        suffix = random.choice(creative_suffixes)  # noqa: S311 - not used for security
        # Clean up the tool name
        tool_name = tool_hint.strip().title()
        return f'{tool_name} {suffix}'

    # Last resort: generic but with random suffix for uniqueness
    suffix = random.choice(creative_suffixes)  # noqa: S311 - not used for security
    return f'Digital {suffix}'


def _fallback_analysis(title: str, filename: str, tool_hint: str = '') -> dict:
    """Generate fallback analysis when AI fails.

    Creates a minimal but usable project structure.
    """
    # Use provided title, or generate a creative one
    display_title = title or _generate_creative_title(tool_hint, filename)
    name_slug = _slugify(display_title or filename)[:8]

    tool_names = [tool_hint] if tool_hint else []

    logger.info(f'Using fallback analysis for {filename} with title: {display_title}')

    return {
        'templateVersion': 2,
        'title': display_title,
        'description': f'A creative work made with {tool_hint}.' if tool_hint else f'A creative work: {display_title}',
        'sections': [
            {
                'id': f'section-overview-{name_slug}',
                'type': 'overview',
                'enabled': True,
                'order': 0,
                'content': {
                    'headline': display_title,
                    'description': f'An image project created with {tool_hint}.'
                    if tool_hint
                    else f'An image project showcasing {display_title.lower()}.',
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
    return name.title() if name else 'Untitled Project'
