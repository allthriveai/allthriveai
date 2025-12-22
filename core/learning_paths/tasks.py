"""
Celery tasks for learning paths.

Handles:
- Cover image generation with Gemini for SavedLearningPath
"""

import logging
import time
import uuid

from celery import shared_task
from django.contrib.auth import get_user_model

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider
from services.integrations.storage import StorageService

logger = logging.getLogger(__name__)
User = get_user_model()

# Learning path cover image prompt template
# Style: Neon glass aesthetic with minimalist academic/research feel
COVER_IMAGE_PROMPT = """Create a minimalist, academic-style illustration for a learning path about "{title}".

Style requirements:
- Dark navy background (#020617)
- Subtle cyan/teal neon accents (#22D3EE, #0EA5E9)
- Clean geometric shapes with soft glow effects
- Abstract, conceptual visualization
- High-level research/academic aesthetic
- No text or words in the image
- Simple, elegant composition
- Glass-like transparency effects
- Subtle depth and layering
- Professional and modern feel

The illustration should evoke learning, knowledge, and {theme_hint}.
"""


def get_theme_hint(title: str) -> str:
    """
    Generate a theme hint based on the learning path title.

    Args:
        title: Learning path title

    Returns:
        Theme hint for the image prompt
    """
    title_lower = title.lower()

    # AI/ML themes
    if any(kw in title_lower for kw in ['ai', 'machine learning', 'neural', 'deep learning']):
        return 'artificial intelligence and neural networks'

    # Programming themes
    if any(kw in title_lower for kw in ['python', 'javascript', 'coding', 'programming']):
        return 'code and software development'

    # Data themes
    if any(kw in title_lower for kw in ['data', 'analytics', 'database', 'sql']):
        return 'data analysis and insights'

    # Web themes
    if any(kw in title_lower for kw in ['web', 'frontend', 'backend', 'api']):
        return 'web technology and connectivity'

    # Cloud themes
    if any(kw in title_lower for kw in ['cloud', 'aws', 'azure', 'kubernetes']):
        return 'cloud infrastructure and scalability'

    # Security themes
    if any(kw in title_lower for kw in ['security', 'cyber', 'encryption']):
        return 'cybersecurity and protection'

    # LLM/NLP themes
    if any(kw in title_lower for kw in ['llm', 'gpt', 'prompt', 'language model', 'nlp']):
        return 'language models and natural language processing'

    # Default
    return 'intellectual growth and discovery'


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def generate_learning_path_cover(self, saved_path_id: int, user_id: int):
    """
    Generate a cover image for a SavedLearningPath using Gemini.

    Args:
        saved_path_id: SavedLearningPath ID
        user_id: User ID for attribution

    Returns:
        Dict with generation results
    """
    from .models import SavedLearningPath

    logger.info(f'Starting cover image generation for path {saved_path_id}')

    try:
        # Validate user and path exist
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.error(f'User not found: user_id={user_id}')
            return {'status': 'error', 'reason': 'user_not_found'}

        try:
            saved_path = SavedLearningPath.objects.get(id=saved_path_id, user=user)
        except SavedLearningPath.DoesNotExist:
            logger.error(f'SavedLearningPath not found: id={saved_path_id}')
            return {'status': 'error', 'reason': 'path_not_found'}

        # Build prompt with theme hint
        theme_hint = get_theme_hint(saved_path.title)
        prompt = COVER_IMAGE_PROMPT.format(
            title=saved_path.title,
            theme_hint=theme_hint,
        )

        # Generate image using Gemini
        start_time = time.time()
        ai = AIProvider(provider='gemini', user_id=user_id)
        image_bytes, mime_type, text_response = ai.generate_image(prompt=prompt)
        latency_ms = int((time.time() - start_time) * 1000)

        if not image_bytes:
            error_message = text_response or 'Failed to generate cover image'
            logger.error(f'Cover image generation failed: {error_message}')
            return {'status': 'error', 'reason': 'generation_failed', 'message': error_message}

        # Upload to S3/MinIO
        filename = f'learning-path-{saved_path_id}-{uuid.uuid4()}.png'
        storage = StorageService()
        image_url, upload_error = storage.upload_file(
            file_data=image_bytes,
            filename=filename,
            folder='learning-path-covers',
            content_type=mime_type or 'image/png',
            is_public=True,
        )

        if upload_error or not image_url:
            logger.error(f'Failed to upload cover image: {upload_error}')
            return {'status': 'error', 'reason': 'upload_failed', 'message': str(upload_error)}

        logger.info(f'Cover image generated and uploaded: {image_url}')

        # Update the SavedLearningPath with the cover image URL
        saved_path.cover_image = image_url
        saved_path.save(update_fields=['cover_image', 'updated_at'])

        # Track AI usage
        try:
            AIUsageTracker.track_usage(
                user=user,
                feature='learning_path_cover',
                provider='gemini',
                model='gemini-2.0-flash',
                input_tokens=len(prompt) // 4,  # Estimate
                output_tokens=len(text_response) // 4 if text_response else 0,
                latency_ms=latency_ms,
                status='success',
                request_metadata={
                    'saved_path_id': saved_path_id,
                    'title': saved_path.title,
                    'image_size_bytes': len(image_bytes),
                },
            )
        except Exception as tracking_error:
            logger.warning(f'Failed to track cover image generation usage: {tracking_error}', exc_info=True)

        return {
            'status': 'success',
            'saved_path_id': saved_path_id,
            'cover_image_url': image_url,
            'latency_ms': latency_ms,
        }

    except Exception as exc:
        logger.error(f'Cover image generation failed: {exc}', exc_info=True)

        # Retry for transient errors
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(f'Cover image generation failed after max retries: {exc}')
            return {'status': 'error', 'reason': 'max_retries_exceeded'}
