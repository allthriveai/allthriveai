"""AI-powered video analyzer for generating project metadata from uploaded videos."""

import json
import logging
import re
import time

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider

logger = logging.getLogger(__name__)


# Prompt template for video analysis
VIDEO_TEMPLATE_PROMPT = """Analyze this uploaded video and generate structured content for a portfolio project page.

Video Information:
- Filename: {filename}
- File type: {file_type}
- Video URL: {video_url}

{user_context}

Based on the filename and any context provided, generate a compelling project page. Return valid JSON:

{{
  "title": "A descriptive, engaging title for this video project (based on filename or context)",
  "description": "2-3 sentence description explaining what this video shows and why it's interesting",
  "overview": {{
    "headline": "One compelling sentence hook about the video (max 100 chars)",
    "description": "2-3 sentence explanation of what viewers will see"
  }},
  "features": [
    {{"icon": "FaVideo", "title": "Feature 1", "description": "What's showcased in the video"}},
    {{"icon": "FaLightbulb", "title": "Feature 2", "description": "Key technique or tool shown"}},
    {{"icon": "FaStar", "title": "Feature 3", "description": "What makes this interesting"}}
  ],
  "tech_stack": {{
    "categories": [
      {{"name": "Tools Used", "technologies": ["Tool1", "Tool2"]}},
      {{"name": "Techniques", "technologies": ["Technique1"]}}
    ]
  }},
  "category_ids": [1],
  "topics": ["video", "tutorial"],
  "tool_names": ["ChatGPT"]
}}

IMPORTANT GUIDELINES:
- Infer content from the filename (e.g., "midjourney-tutorial.mp4" → AI art tutorial)
- For features: Use FontAwesome icons (react-icons/fa format):
  FaVideo (video), FaPlay (demo), FaLightbulb (ideas), FaStar (highlight),
  FaRocket (launch), FaPalette (design), FaCode (development), FaBrain (AI/ML),
  FaMagic (creative), FaEye (visual), FaMicrophone (audio), FaMusic (music)
- Category IDs:
  1=AI Art & Design, 2=AI Music & Audio, 3=Video & Animation, 4=AI Writing,
  5=Productivity & Automation, 6=Business & Marketing, 7=Education & Learning,
  8=Research & Science, 9=Developer & Coding, 10=Data & Analytics,
  11=Community Projects, 12=News & Updates, 13=Tutorials & Guides, 14=Reviews & Comparisons, 15=Other
- Topics: lowercase, specific tags (3-8 keywords)
- tool_names: AI tools that might be shown (ChatGPT, Midjourney, Claude, Stable Diffusion, RunwayML, etc.)

Return ONLY valid JSON, no markdown code blocks."""


def analyze_video_for_template(
    video_url: str,
    filename: str,
    file_type: str = 'video/mp4',
    user_context: str = '',
    user=None,
) -> dict:
    """Generate section-based template content for an uploaded video.

    Args:
        video_url: S3/MinIO URL of the uploaded video
        filename: Original filename of the video
        file_type: MIME type of the video
        user_context: Optional context from user about the video
        user: Django User instance (optional, for AI usage tracking)

    Returns:
        dict with sections array and metadata for template v2 format
    """
    # Build context string
    context_str = f'User description: {user_context}' if user_context else 'No additional context provided.'

    # Build prompt
    prompt = VIDEO_TEMPLATE_PROMPT.format(
        filename=filename,
        file_type=file_type,
        video_url=video_url,
        user_context=context_str,
    )

    logger.info(f'🎬 Starting video analysis for {filename}')

    try:
        ai = AIProvider()
        start_time = time.time()
        response = ai.complete(
            prompt=prompt,
            model=None,
            temperature=0.7,
            max_tokens=1500,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Track AI usage for cost reporting
        if user and ai.last_usage:
            usage = ai.last_usage
            AIUsageTracker.track_usage(
                user=user,
                feature='video_template_analysis',
                provider=ai.current_provider,
                model=ai.current_model,
                input_tokens=usage.get('prompt_tokens', 0),
                output_tokens=usage.get('completion_tokens', 0),
                latency_ms=latency_ms,
                status='success',
            )

        logger.info(f'✅ Video AI response received for {filename}')

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
        name_slug = _slugify(filename)[:8]

        # Video section - the video itself (using 'direct' platform for uploaded videos)
        sections.append(
            {
                'id': f'section-video-{name_slug}',
                'type': 'video',
                'enabled': True,
                'order': section_order,
                'content': {
                    'url': video_url,
                    'platform': 'direct',
                    'video_id': '',
                    'title': '',
                    'filename': filename,
                    'fileType': file_type,
                },
            }
        )
        section_order += 1

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

        # Return structured analysis
        return {
            'templateVersion': 2,
            'title': result.get('title', _generate_title_from_filename(filename)),
            'description': result.get('description', ''),
            'sections': sections,
            'category_ids': result.get('category_ids', [3]),  # Default to Video & Animation
            'topics': result.get('topics', ['video']),
            'tool_names': result.get('tool_names', []),
            'hero_image': '',  # Videos use thumbnail from video player
        }

    except json.JSONDecodeError as e:
        logger.warning(f'Failed to parse video AI response: {e}')
        return _fallback_analysis(video_url, filename, file_type)
    except Exception as e:
        logger.error(f'Error analyzing video: {e}', exc_info=True)
        return _fallback_analysis(video_url, filename, file_type)


def _fallback_analysis(video_url: str, filename: str, file_type: str) -> dict:
    """Generate fallback analysis when AI fails."""
    name_slug = _slugify(filename)[:8]
    title = _generate_title_from_filename(filename)

    return {
        'templateVersion': 2,
        'title': title,
        'description': f'A video project: {filename}',
        'sections': [
            {
                'id': f'section-video-{name_slug}',
                'type': 'video',
                'enabled': True,
                'order': 0,
                'content': {
                    'url': video_url,
                    'platform': 'direct',
                    'video_id': '',
                    'title': '',
                    'filename': filename,
                    'fileType': file_type,
                },
            },
            {
                'id': f'section-overview-{name_slug}',
                'type': 'overview',
                'enabled': True,
                'order': 1,
                'content': {
                    'headline': title,
                    'description': f'A video project showcasing {title.lower()}.',
                },
            },
        ],
        'category_ids': [3],  # Video & Animation
        'topics': ['video'],
        'tool_names': [],
        'hero_image': '',
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
