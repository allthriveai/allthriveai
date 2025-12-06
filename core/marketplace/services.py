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
from decimal import Decimal
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
                'subtitle': f'By {video_info["channel_name"]}',
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


# =============================================================================
# Stripe Connect & Marketplace Checkout Services
# =============================================================================


class StripeConnectError(Exception):
    """Raised when Stripe Connect operations fail."""

    pass


class MarketplaceCheckoutError(Exception):
    """Raised when marketplace checkout operations fail."""

    pass


class StripeConnectService:
    """
    Service for Stripe Connect operations.

    Handles creator onboarding, account management, and payouts.
    Uses Stripe Express accounts for simplified onboarding.
    """

    PLATFORM_FEE_RATE = Decimal('0.08')  # 8% platform fee

    @staticmethod
    def create_connect_account(user) -> dict:
        """
        Create a Stripe Express Connect account for a creator.

        Args:
            user: Django User instance

        Returns:
            Dict with account_id and onboarding_url

        Raises:
            StripeConnectError: If account creation fails
        """
        import stripe
        from django.conf import settings

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            # Get or create CreatorAccount
            creator_account, _ = CreatorAccount.objects.get_or_create(user=user)

            # If already has a Connect account, return existing
            if creator_account.stripe_connect_account_id:
                logger.info(f'Creator {user.id} already has Connect account')
                return {
                    'account_id': creator_account.stripe_connect_account_id,
                    'is_onboarded': creator_account.is_onboarded,
                }

            # Create Express Connect account
            account = stripe.Account.create(
                type='express',
                country='US',  # Default to US, can be expanded later
                email=user.email,
                capabilities={
                    'card_payments': {'requested': True},
                    'transfers': {'requested': True},
                },
                business_type='individual',
                metadata={
                    'user_id': str(user.id),
                    'username': user.username,
                    'platform': 'allthrive',
                },
            )

            # Save account ID
            creator_account.stripe_connect_account_id = account.id
            creator_account.onboarding_status = CreatorAccount.OnboardingStatus.PENDING
            creator_account.save()

            logger.info(f'Created Stripe Connect account {account.id} for user {user.id}')

            return {
                'account_id': account.id,
                'is_onboarded': False,
            }

        except stripe.error.StripeError as e:
            logger.error(f'Failed to create Connect account for user {user.id}: {e}')
            raise StripeConnectError(f'Failed to create creator account: {str(e)}') from e

    @staticmethod
    def create_onboarding_link(user, return_url: str, refresh_url: str) -> str:
        """
        Create a Stripe Connect onboarding link.

        Args:
            user: Django User instance
            return_url: URL to redirect after onboarding completion
            refresh_url: URL to redirect if link expires

        Returns:
            Onboarding URL

        Raises:
            StripeConnectError: If link creation fails
        """
        import stripe
        from django.conf import settings

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            creator_account = CreatorAccount.objects.get(user=user)

            if not creator_account.stripe_connect_account_id:
                # Create account first
                result = StripeConnectService.create_connect_account(user)
                account_id = result['account_id']
            else:
                account_id = creator_account.stripe_connect_account_id

            # Create account link for onboarding
            account_link = stripe.AccountLink.create(
                account=account_id,
                refresh_url=refresh_url,
                return_url=return_url,
                type='account_onboarding',
            )

            logger.info(f'Created onboarding link for user {user.id}')
            return account_link.url

        except CreatorAccount.DoesNotExist:
            # Create account first
            StripeConnectService.create_connect_account(user)
            return StripeConnectService.create_onboarding_link(user, return_url, refresh_url)
        except stripe.error.StripeError as e:
            logger.error(f'Failed to create onboarding link for user {user.id}: {e}')
            raise StripeConnectError(f'Failed to create onboarding link: {str(e)}') from e

    @staticmethod
    def check_account_status(user) -> dict:
        """
        Check Stripe Connect account status and update local record.

        Args:
            user: Django User instance

        Returns:
            Dict with account status details

        Raises:
            StripeConnectError: If status check fails
        """
        import stripe
        from django.conf import settings

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            creator_account = CreatorAccount.objects.get(user=user)

            if not creator_account.stripe_connect_account_id:
                return {
                    'exists': False,
                    'is_onboarded': False,
                    'charges_enabled': False,
                    'payouts_enabled': False,
                }

            # Retrieve account from Stripe
            account = stripe.Account.retrieve(creator_account.stripe_connect_account_id)

            # Update local record
            creator_account.charges_enabled = account.charges_enabled
            creator_account.payouts_enabled = account.payouts_enabled

            if account.charges_enabled and account.payouts_enabled:
                creator_account.onboarding_status = CreatorAccount.OnboardingStatus.COMPLETE
            elif account.details_submitted:
                creator_account.onboarding_status = CreatorAccount.OnboardingStatus.PENDING

            creator_account.save()

            return {
                'exists': True,
                'account_id': account.id,
                'is_onboarded': creator_account.is_onboarded,
                'charges_enabled': account.charges_enabled,
                'payouts_enabled': account.payouts_enabled,
                'details_submitted': account.details_submitted,
                'requirements': account.requirements if hasattr(account, 'requirements') else None,
            }

        except CreatorAccount.DoesNotExist:
            return {
                'exists': False,
                'is_onboarded': False,
                'charges_enabled': False,
                'payouts_enabled': False,
            }
        except stripe.error.StripeError as e:
            logger.error(f'Failed to check account status for user {user.id}: {e}')
            raise StripeConnectError(f'Failed to check account status: {str(e)}') from e

    @staticmethod
    def create_dashboard_link(user) -> str:
        """
        Create a link to the Stripe Express dashboard.

        Args:
            user: Django User instance

        Returns:
            Dashboard URL

        Raises:
            StripeConnectError: If link creation fails
        """
        import stripe
        from django.conf import settings

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            creator_account = CreatorAccount.objects.get(user=user)

            if not creator_account.stripe_connect_account_id:
                raise StripeConnectError('No Connect account found')

            login_link = stripe.Account.create_login_link(creator_account.stripe_connect_account_id)

            return login_link.url

        except CreatorAccount.DoesNotExist as e:
            raise StripeConnectError('No creator account found') from e
        except stripe.error.StripeError as e:
            logger.error(f'Failed to create dashboard link for user {user.id}: {e}')
            raise StripeConnectError(f'Failed to create dashboard link: {str(e)}') from e


class MarketplaceCheckoutService:
    """
    Service for marketplace product checkout.

    Handles payment processing with Stripe Connect,
    including platform fee collection and creator payouts.
    """

    PLATFORM_FEE_RATE = Decimal('0.08')  # 8% platform fee

    @staticmethod
    @transaction.atomic
    def create_checkout(user, product: Product) -> dict:
        """
        Create a checkout session for purchasing a product.

        Uses Stripe PaymentIntent with transfer_data for automatic
        platform fee collection and creator payout.

        Args:
            user: Django User (buyer)
            product: Product instance to purchase

        Returns:
            Dict with client_secret for Stripe Elements

        Raises:
            MarketplaceCheckoutError: If checkout creation fails
        """
        import stripe
        from django.conf import settings

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            # Validate product is purchasable
            if product.status != Product.Status.PUBLISHED:
                raise MarketplaceCheckoutError('Product is not available for purchase')

            if product.price <= 0:
                raise MarketplaceCheckoutError('Product is free - no checkout required')

            # Can't buy your own product
            if product.creator == user:
                raise MarketplaceCheckoutError('You cannot purchase your own product')

            # Check if user already has access
            from .models import ProductAccess

            if ProductAccess.objects.filter(user=user, product=product, is_active=True).exists():
                raise MarketplaceCheckoutError('You already have access to this product')

            # Get creator's Connect account
            try:
                creator_account = CreatorAccount.objects.get(user=product.creator)
                if not creator_account.is_onboarded:
                    raise MarketplaceCheckoutError('Creator has not completed payment setup')
                connect_account_id = creator_account.stripe_connect_account_id
            except CreatorAccount.DoesNotExist as e:
                raise MarketplaceCheckoutError('Creator has not set up payment account') from e

            # Calculate fees
            amount_cents = int(product.price * 100)
            platform_fee_cents = int(amount_cents * MarketplaceCheckoutService.PLATFORM_FEE_RATE)

            # Create PaymentIntent with automatic transfer to creator
            # Platform keeps the application_fee_amount
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=product.currency,
                automatic_payment_methods={'enabled': True},
                application_fee_amount=platform_fee_cents,
                transfer_data={
                    'destination': connect_account_id,
                },
                metadata={
                    'product_id': str(product.id),
                    'buyer_id': str(user.id),
                    'creator_id': str(product.creator.id),
                    'platform': 'allthrive_marketplace',
                },
                description=f'Purchase: {product.project.title}',
            )

            # Create pending Order record
            from .models import Order

            order = Order.objects.create(
                buyer=user,
                product=product,
                creator=product.creator,
                amount_paid=product.price,
                platform_fee=product.price * MarketplaceCheckoutService.PLATFORM_FEE_RATE,
                stripe_fee=Decimal('0.00'),  # Will be updated by webhook
                creator_payout=product.price * (1 - MarketplaceCheckoutService.PLATFORM_FEE_RATE),
                currency=product.currency,
                stripe_payment_intent_id=payment_intent.id,
                status=Order.OrderStatus.PENDING,
            )

            logger.info(
                f'Created checkout for product {product.id}, buyer {user.id}, '
                f'amount ${product.price}, order {order.id}'
            )

            return {
                'client_secret': payment_intent.client_secret,
                'order_id': order.id,
                'amount': float(product.price),
                'currency': product.currency,
                'platform_fee': float(product.price * MarketplaceCheckoutService.PLATFORM_FEE_RATE),
                'product': {
                    'id': product.id,
                    'title': product.project.title,
                    'creator': product.creator.username,
                },
            }

        except stripe.error.StripeError as e:
            logger.error(f'Failed to create checkout for product {product.id}: {e}')
            raise MarketplaceCheckoutError(f'Payment initialization failed: {str(e)}') from e

    @staticmethod
    @transaction.atomic
    def handle_payment_success(payment_intent_id: str) -> dict:
        """
        Handle successful payment - grant access and update records.

        Called by webhook when payment_intent.succeeded event received.

        Args:
            payment_intent_id: Stripe PaymentIntent ID

        Returns:
            Dict with order details

        Raises:
            MarketplaceCheckoutError: If processing fails
        """
        import stripe
        from django.conf import settings

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            from .models import Order, ProductAccess

            # Get order
            try:
                order = Order.objects.select_for_update().get(stripe_payment_intent_id=payment_intent_id)
            except Order.DoesNotExist:
                logger.warning(f'No order found for payment intent {payment_intent_id}')
                return {'status': 'not_found'}

            # Already processed
            if order.status == Order.OrderStatus.PAID:
                return {'status': 'already_processed', 'order_id': order.id}

            # Retrieve PaymentIntent for actual charge details
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

            # Get the charge to find actual Stripe fee
            if payment_intent.latest_charge:
                charge = stripe.Charge.retrieve(payment_intent.latest_charge)
                # Get balance transaction for fee breakdown
                if charge.balance_transaction:
                    balance_txn = stripe.BalanceTransaction.retrieve(charge.balance_transaction)
                    # Stripe fee is in cents
                    stripe_fee = Decimal(str(balance_txn.fee / 100))
                    order.stripe_fee = stripe_fee

            # Get transfer ID if available
            if payment_intent.transfer_data:
                transfers = stripe.Transfer.list(
                    transfer_group=payment_intent.transfer_group,
                    limit=1,
                )
                if transfers.data:
                    order.stripe_transfer_id = transfers.data[0].id

            # Mark order as paid
            order.status = Order.OrderStatus.PAID
            order.save()

            # Grant product access
            ProductAccess.objects.get_or_create(
                user=order.buyer,
                product=order.product,
                defaults={
                    'order': order,
                    'is_active': True,
                },
            )

            # Update product sales metrics
            product = order.product
            product.total_sales += 1
            product.total_revenue += order.amount_paid
            product.save(update_fields=['total_sales', 'total_revenue'])

            # Update creator earnings
            try:
                creator_account = CreatorAccount.objects.get(user=order.creator)
                creator_account.total_earnings += order.creator_payout
                creator_account.save(update_fields=['total_earnings'])
            except CreatorAccount.DoesNotExist:
                pass

            logger.info(
                f'Payment succeeded for order {order.id}, '
                f'buyer {order.buyer.id} now has access to product {order.product.id}'
            )

            return {
                'status': 'success',
                'order_id': order.id,
                'product_id': order.product.id,
                'buyer_id': order.buyer.id,
            }

        except stripe.error.StripeError as e:
            logger.error(f'Error processing payment success for {payment_intent_id}: {e}')
            raise MarketplaceCheckoutError(f'Payment processing failed: {str(e)}') from e

    @staticmethod
    @transaction.atomic
    def handle_payment_failure(payment_intent_id: str) -> dict:
        """
        Handle failed payment - update order status.

        Args:
            payment_intent_id: Stripe PaymentIntent ID

        Returns:
            Dict with order status
        """
        from .models import Order

        try:
            order = Order.objects.get(stripe_payment_intent_id=payment_intent_id)
            order.status = Order.OrderStatus.FAILED
            order.save(update_fields=['status', 'updated_at'])

            logger.info(f'Payment failed for order {order.id}')
            return {'status': 'failed', 'order_id': order.id}

        except Order.DoesNotExist:
            return {'status': 'not_found'}

    @staticmethod
    def get_order_status(order_id: int, user) -> dict:
        """
        Get order status for a user.

        Args:
            order_id: Order ID
            user: Django User (must be buyer or creator)

        Returns:
            Dict with order details
        """
        from .models import Order

        try:
            order = Order.objects.select_related('product', 'product__project', 'buyer', 'creator').get(id=order_id)

            # Security: only buyer or creator can view order
            if order.buyer != user and order.creator != user:
                raise MarketplaceCheckoutError('Access denied')

            return {
                'id': order.id,
                'status': order.status,
                'amount_paid': float(order.amount_paid),
                'platform_fee': float(order.platform_fee),
                'creator_payout': float(order.creator_payout),
                'currency': order.currency,
                'created_at': order.created_at.isoformat(),
                'product': {
                    'id': order.product.id,
                    'title': order.product.project.title,
                },
                'buyer': order.buyer.username if order.creator == user else None,
                'has_access': order.status == Order.OrderStatus.PAID,
            }

        except Order.DoesNotExist as e:
            raise MarketplaceCheckoutError('Order not found') from e
