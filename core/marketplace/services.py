"""
Marketplace Services - YouTube Import and Course Generation

This module handles importing content from YouTube and generating structured
course content using AI. The import flow:

1. Extract video ID from URL
2. Fetch video metadata from YouTube API
3. Get transcript using youtube_transcript_api
4. Use AI to generate course structure (modules, lessons, quizzes)
5. Create Product and Project with the structured content

SECURITY NOTES:
- All external content (video titles, descriptions, transcripts) must be sanitized
  before being inserted into AI prompts to prevent prompt injection attacks
- YouTube URLs are validated against strict patterns
- User data is isolated by creator/user ID
"""

import json
import logging
import re
import time
from typing import Any

from django.db import transaction
from django.utils.html import escape
from django.utils.text import slugify

from core.ai_usage.tracker import AIUsageTracker
from core.integrations.youtube.helpers import extract_video_id_from_url, parse_duration
from core.integrations.youtube.service import YouTubeService
from core.projects.models import Project
from services.ai.provider import AIProvider

from .models import CreatorAccount, Product

logger = logging.getLogger(__name__)


class YouTubeTranscriptError(Exception):
    """Raised when transcript cannot be fetched."""

    pass


class CourseGenerationError(Exception):
    """Raised when AI course generation fails."""

    pass


def sanitize_for_prompt(text: str, max_length: int = 500) -> str:
    """
    Sanitize user-provided content before inserting into AI prompts.

    SECURITY: Prevents prompt injection by:
    1. Removing special markdown/prompt delimiters
    2. Escaping HTML entities
    3. Removing control characters
    4. Truncating to max length

    Args:
        text: Raw text from external source
        max_length: Maximum allowed length

    Returns:
        Sanitized text safe for prompt insertion
    """
    if not text:
        return ''

    # Remove potential prompt injection patterns
    # These could trick the AI into ignoring instructions
    injection_patterns = [
        r'```',  # Code blocks that could contain instructions
        r'\*\*\*',  # Bold/emphasis that could hide instructions
        r'---',  # Horizontal rules
        r'###',  # Headers
        r'\[INST\]',  # Common instruction markers
        r'\[/INST\]',
        r'<<SYS>>',
        r'<</SYS>>',
        r'<\|',  # Token markers
        r'\|>',
        r'Human:',  # Role markers
        r'Assistant:',
        r'System:',
        r'User:',
    ]

    sanitized = text
    for pattern in injection_patterns:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)

    # Remove control characters (except newlines and tabs)
    sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', sanitized)

    # Escape HTML entities
    sanitized = escape(sanitized)

    # Normalize whitespace
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()

    # Truncate to max length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length] + '...'

    return sanitized


def get_youtube_transcript(video_id: str) -> str:
    """
    Fetch transcript for a YouTube video.

    Uses youtube_transcript_api to get auto-generated or manual captions.

    Args:
        video_id: YouTube video ID

    Returns:
        Full transcript text

    Raises:
        YouTubeTranscriptError: If transcript unavailable
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import (
            NoTranscriptFound,
            TranscriptsDisabled,
            VideoUnavailable,
        )
    except ImportError as e:
        raise ImportError(
            'youtube_transcript_api not installed. Install with: pip install youtube-transcript-api'
        ) from e

    try:
        # Try to get English transcript first, fall back to auto-generated
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        transcript = None
        # Priority: manual English > auto-generated English > any manual > any auto
        try:
            transcript = transcript_list.find_manually_created_transcript(['en', 'en-US', 'en-GB'])
        except NoTranscriptFound:
            try:
                transcript = transcript_list.find_generated_transcript(['en', 'en-US', 'en-GB'])
            except NoTranscriptFound:
                # Try any available transcript
                for t in transcript_list:
                    transcript = t
                    break

        if not transcript:
            raise YouTubeTranscriptError(f'No transcript available for video {video_id}')

        # Get transcript data and concatenate text
        transcript_data = transcript.fetch()
        full_text = ' '.join(item['text'] for item in transcript_data)

        logger.info(f'Fetched transcript for {video_id}: {len(full_text)} chars')
        return full_text

    except VideoUnavailable as e:
        raise YouTubeTranscriptError(f'Video {video_id} is unavailable') from e
    except TranscriptsDisabled as e:
        raise YouTubeTranscriptError(f'Transcripts are disabled for video {video_id}') from e
    except NoTranscriptFound as e:
        raise YouTubeTranscriptError(f'No transcript found for video {video_id}') from e
    except Exception as e:
        logger.error(f'Error fetching transcript for {video_id}: {e}')
        raise YouTubeTranscriptError(f'Failed to fetch transcript: {e}') from e


def generate_course_structure(
    video_info: dict[str, Any],
    transcript: str,
    user,
    product_type: str = 'course',
) -> dict[str, Any]:
    """
    Use AI to generate structured course content from video transcript.

    Args:
        video_info: YouTube video metadata
        transcript: Full transcript text
        user: User object for AI tracking
        product_type: Type of product (course, prompt_pack, template, ebook)

    Returns:
        Structured course content compatible with Project.content JSONField:
        {
            'modules': [
                {
                    'id': 'module_1',
                    'title': 'Introduction',
                    'lessons': [
                        {
                            'id': 'lesson_1_1',
                            'title': 'Getting Started',
                            'content': '...',
                            'key_takeaways': ['...'],
                            'timestamps': {'start': '0:00', 'end': '5:30'},
                        }
                    ]
                }
            ],
            'quiz': {
                'questions': [
                    {
                        'id': 'q1',
                        'question': '...',
                        'options': ['A', 'B', 'C', 'D'],
                        'correct_answer': 0,
                        'explanation': '...'
                    }
                ]
            },
            'summary': '...',
            'learning_objectives': ['...'],
            'prerequisites': ['...'],
            'estimated_duration': '30 mins'
        }

    Raises:
        CourseGenerationError: If AI fails to generate structure
    """
    logger.info(f'Generating course structure for: {video_info["title"]}')

    # Truncate transcript if too long (keep first 15k chars for context window)
    max_transcript_length = 15000
    truncated_transcript = transcript[:max_transcript_length]
    if len(transcript) > max_transcript_length:
        truncated_transcript += '\n\n[Transcript truncated for processing...]'

    system_prompt = """You are an expert course designer. Your task is to transform video content
into a structured, engaging learning experience.

Create a course structure that:
1. Breaks content into logical modules and lessons
2. Identifies key learning objectives
3. Highlights important takeaways for each section
4. Creates a quiz to reinforce learning
5. Provides a comprehensive summary

Be specific and extract actual content from the transcript - don't use generic placeholders.

Respond in this exact JSON format:
{
    "modules": [
        {
            "id": "module_1",
            "title": "Module Title",
            "description": "Brief module description",
            "lessons": [
                {
                    "id": "lesson_1_1",
                    "title": "Lesson Title",
                    "content": "Detailed lesson content extracted and enhanced from transcript...",
                    "key_takeaways": ["Takeaway 1", "Takeaway 2"],
                    "timestamps": {"start": "0:00", "end": "5:30"}
                }
            ]
        }
    ],
    "quiz": {
        "title": "Knowledge Check",
        "questions": [
            {
                "id": "q1",
                "question": "Question text?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": 0,
                "explanation": "Why this answer is correct..."
            }
        ]
    },
    "summary": "Comprehensive summary of the entire course content...",
    "learning_objectives": ["Objective 1", "Objective 2", "Objective 3"],
    "prerequisites": ["Prerequisite 1 (or empty array if none)"],
    "estimated_duration": "X mins",
    "difficulty_level": "beginner|intermediate|advanced"
}"""

    # SECURITY: Sanitize all external content before inserting into prompt
    safe_title = sanitize_for_prompt(video_info.get('title', ''), max_length=200)
    safe_channel = sanitize_for_prompt(video_info.get('channel_name', ''), max_length=100)
    safe_description = sanitize_for_prompt(video_info.get('description', ''), max_length=500)
    # Transcript is larger but still needs sanitization
    safe_transcript = sanitize_for_prompt(truncated_transcript, max_length=15000)

    prompt = f"""Transform this video into a structured course:

**Video Title:** {safe_title}
**Channel:** {safe_channel}
**Duration:** {parse_duration(video_info.get('duration', 'PT0S'))}
**Description:** {safe_description}

**Transcript:**
{safe_transcript}

Create a comprehensive course structure with 2-5 modules, each containing 2-4 lessons.
Include a quiz with 5-10 questions based on the content.
Extract specific information from the transcript - avoid generic content."""

    try:
        user_id = user.id if user else None
        ai = AIProvider(user_id=user_id)

        start_time = time.time()
        response = ai.complete(
            prompt=prompt,
            system_message=system_prompt,
            temperature=0.4,  # Lower for more structured output
            max_tokens=4096,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Track AI usage
        if user and ai.last_usage:
            AIUsageTracker.track_usage(
                user=user,
                feature='marketplace_course_generation',
                provider=ai.current_provider,
                model=ai.current_model,
                input_tokens=ai.last_usage.get('prompt_tokens', 0),
                output_tokens=ai.last_usage.get('completion_tokens', 0),
                latency_ms=latency_ms,
                status='success',
            )

        # Parse JSON response
        # Handle potential markdown code blocks
        response_text = response.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]

        course_structure = json.loads(response_text.strip())

        logger.info(
            f'Generated course structure: {len(course_structure.get("modules", []))} modules, '
            f'{len(course_structure.get("quiz", {}).get("questions", []))} quiz questions'
        )

        return course_structure

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse AI response as JSON: {e}')
        raise CourseGenerationError(f'Invalid course structure generated: {e}') from e
    except Exception as e:
        logger.error(f'Course generation failed: {e}', exc_info=True)
        raise CourseGenerationError(f'Failed to generate course structure: {e}') from e


@transaction.atomic
def import_youtube_as_product(
    youtube_url: str,
    user,
    product_type: str = 'course',
    price: float = 0.00,
) -> tuple[Product, Project]:
    """
    Import a YouTube video and create a Product with AI-generated course content.

    This is the main entry point for the YouTube import feature.

    Args:
        youtube_url: YouTube video URL
        user: Django User instance (creator)
        product_type: Type of product (course, prompt_pack, template, ebook)
        price: Initial price (default free)

    Returns:
        Tuple of (Product, Project) created

    Raises:
        ValueError: If URL is invalid
        YouTubeTranscriptError: If transcript unavailable
        CourseGenerationError: If AI generation fails
    """
    logger.info(f'Starting YouTube import for user {user.id}: {youtube_url}')

    # Extract video ID
    video_id = extract_video_id_from_url(youtube_url)
    if not video_id:
        raise ValueError(f'Invalid YouTube URL: {youtube_url}')

    # Check if user already imported this video
    existing = Project.objects.filter(
        user=user,
        external_url__contains=video_id,
        is_product=True,
    ).first()
    if existing:
        raise ValueError(f'You have already imported this video as: {existing.title}')

    # Fetch video info
    youtube_service = YouTubeService(api_key=True)
    video_info = youtube_service.get_video_info(video_id)

    # Get transcript
    transcript = get_youtube_transcript(video_id)

    # Generate course structure with AI
    course_structure = generate_course_structure(
        video_info=video_info,
        transcript=transcript,
        user=user,
        product_type=product_type,
    )

    # Ensure creator account exists
    creator_account, _ = CreatorAccount.objects.get_or_create(user=user)

    # Create Project (stores the content)
    project = Project.objects.create(
        user=user,
        title=video_info['title'],
        description=course_structure.get('summary', video_info['description'][:500]),
        slug=slugify(video_info['title'])[:50] + '-' + video_id[:8],
        type=Project.ProjectType.PRODUCT,
        is_product=True,
        is_private=True,  # Start as draft (private)
        is_showcased=False,
        external_url=f'https://youtube.com/watch?v={video_id}',
        banner_url=video_info['thumbnail_url'],
        featured_image_url=video_info['thumbnail_url'],
        difficulty_level=course_structure.get('difficulty_level', 'intermediate'),
        content={
            'type': 'course',
            'source': {
                'type': 'youtube',
                'video_id': video_id,
                'channel_id': video_info['channel_id'],
                'channel_name': video_info['channel_name'],
                'duration': video_info['duration'],
                'published_at': video_info['published_at'],
            },
            'course': course_structure,
            'blocks': _convert_to_blocks(course_structure, video_info),
        },
    )

    # Create Product (stores commerce data)
    from decimal import Decimal

    product = Product.objects.create(
        project=project,
        creator=user,
        product_type=product_type,
        status=Product.Status.DRAFT,
        price=Decimal(str(price)),
        source_type='youtube',
        source_url=youtube_url,
        source_metadata={
            'video_id': video_id,
            'channel_id': video_info['channel_id'],
            'channel_name': video_info['channel_name'],
            'view_count': video_info['view_count'],
            'like_count': video_info['like_count'],
            'tags': video_info.get('tags', [])[:10],
            'imported_at': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        },
    )

    logger.info(
        f'Created product {product.id} from YouTube video {video_id}',
        extra={
            'product_id': product.id,
            'project_id': project.id,
            'user_id': user.id,
            'video_id': video_id,
        },
    )

    return product, project


def _convert_to_blocks(course_structure: dict, video_info: dict) -> list[dict]:
    """
    Convert course structure to AllThrive block format for drag-and-drop editing.

    Args:
        course_structure: Generated course structure
        video_info: YouTube video metadata

    Returns:
        List of content blocks compatible with Project.content['blocks']
    """
    blocks = []
    block_id = 1

    # Cover block with video thumbnail
    blocks.append(
        {
            'id': f'block_{block_id}',
            'type': 'cover',
            'data': {
                'title': video_info['title'],
                'subtitle': f"By {video_info['channel_name']}",
                'image_url': video_info['thumbnail_url'],
                'video_embed': f'https://www.youtube.com/embed/{video_info["video_id"]}',
            },
        }
    )
    block_id += 1

    # Learning objectives block
    objectives = course_structure.get('learning_objectives', [])
    if objectives:
        blocks.append(
            {
                'id': f'block_{block_id}',
                'type': 'checklist',
                'data': {
                    'title': 'What You Will Learn',
                    'items': objectives,
                    'style': 'objectives',
                },
            }
        )
        block_id += 1

    # Course summary block
    summary = course_structure.get('summary')
    if summary:
        blocks.append(
            {
                'id': f'block_{block_id}',
                'type': 'text',
                'data': {
                    'title': 'Course Overview',
                    'content': summary,
                },
            }
        )
        block_id += 1

    # Module blocks
    for module in course_structure.get('modules', []):
        # Module header
        blocks.append(
            {
                'id': f'block_{block_id}',
                'type': 'heading',
                'data': {
                    'text': module['title'],
                    'level': 2,
                },
            }
        )
        block_id += 1

        if module.get('description'):
            blocks.append(
                {
                    'id': f'block_{block_id}',
                    'type': 'text',
                    'data': {
                        'content': module['description'],
                    },
                }
            )
            block_id += 1

        # Lesson blocks
        for lesson in module.get('lessons', []):
            blocks.append(
                {
                    'id': f'block_{block_id}',
                    'type': 'lesson',
                    'data': {
                        'title': lesson['title'],
                        'content': lesson['content'],
                        'key_takeaways': lesson.get('key_takeaways', []),
                        'timestamps': lesson.get('timestamps'),
                    },
                }
            )
            block_id += 1

    # Quiz block
    quiz = course_structure.get('quiz', {})
    if quiz.get('questions'):
        blocks.append(
            {
                'id': f'block_{block_id}',
                'type': 'quiz',
                'data': {
                    'title': quiz.get('title', 'Knowledge Check'),
                    'questions': quiz['questions'],
                },
            }
        )
        block_id += 1

    return blocks


def get_creator_dashboard_stats(user) -> dict[str, Any]:
    """
    Get dashboard statistics for a creator.

    Args:
        user: Django User instance

    Returns:
        Dict with stats:
        {
            'total_products': int,
            'published_products': int,
            'total_sales': int,
            'total_revenue': Decimal,
            'pending_balance': Decimal,
            'is_onboarded': bool,
        }
    """
    from decimal import Decimal

    from django.db.models import Sum

    from .models import CreatorAccount, Product

    try:
        creator_account = CreatorAccount.objects.get(user=user)
        is_onboarded = creator_account.is_onboarded
        pending_balance = creator_account.pending_balance
        total_earnings = creator_account.total_earnings
    except CreatorAccount.DoesNotExist:
        is_onboarded = False
        pending_balance = Decimal('0.00')
        total_earnings = Decimal('0.00')

    products = Product.objects.filter(creator=user)
    total_products = products.count()
    published_products = products.filter(status=Product.Status.PUBLISHED).count()

    # Aggregate sales
    sales_data = products.aggregate(
        total_sales=Sum('total_sales'),
        total_revenue=Sum('total_revenue'),
    )

    return {
        'total_products': total_products,
        'published_products': published_products,
        'total_sales': sales_data['total_sales'] or 0,
        'total_revenue': sales_data['total_revenue'] or Decimal('0.00'),
        'total_earnings': total_earnings,
        'pending_balance': pending_balance,
        'is_onboarded': is_onboarded,
    }
