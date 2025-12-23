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
# Style: Neon glass aesthetic with AllThrive brand colors (emerald/cyan/yellow)
COVER_IMAGE_PROMPT = """Create a clear, recognizable illustration that visually represents "{title}".

CRITICAL: The image must clearly depict {concept_visualization}.
Make it obvious what the topic is - avoid being too abstract.

Style requirements:
- Dark slate background (#0F172A to #020617 gradient)
- Primary emerald/green neon accents (#10B981 emerald, #22C55E green, #4ADE80 light green)
- Secondary cyan/teal highlights (#22D3EE cyan, #14B8A6 teal)
- Tertiary yellow/amber accents for energy (#EAB308 yellow, #FBBF24 amber)
- Clean geometric shapes with soft glow effects
- No text, words, or letters in the image
- Concrete, recognizable imagery over abstract shapes
- Glass-like transparency effects with cool undertones
- Professional and modern feel with an inviting, educational atmosphere

The illustration must visually communicate {theme_hint} in an immediately recognizable way.
Viewers should understand the topic at a glance.
"""


def get_theme_hint(title: str) -> tuple[str, str]:
    """
    Generate theme hint and concept visualization based on the learning path title.

    Args:
        title: Learning path title

    Returns:
        Tuple of (theme_hint, concept_visualization) for the image prompt
    """
    title_lower = title.lower()

    # Version control / Git themes
    if any(kw in title_lower for kw in ['git', 'version control', 'github', 'gitlab']):
        return (
            'version control and collaborative development',
            'branching tree structure with merge points, showing code branches '
            'diverging and converging like a subway map or river delta',
        )

    # AI/ML themes
    if any(kw in title_lower for kw in ['ai', 'machine learning', 'neural', 'deep learning']):
        return (
            'artificial intelligence and neural networks',
            'interconnected neural network nodes with glowing synaptic connections forming a brain-like structure',
        )

    # RAG / Vector themes
    if any(kw in title_lower for kw in ['rag', 'retrieval', 'vector', 'embedding']):
        return (
            'retrieval augmented generation and semantic search',
            'documents being transformed into vector points in 3D space, '
            'with search rays connecting queries to relevant clusters',
        )

    # LLM/NLP themes
    if any(kw in title_lower for kw in ['llm', 'gpt', 'prompt', 'language model', 'nlp', 'chatbot']):
        return (
            'language models and natural language processing',
            'flowing text streams being transformed through layers of processing, '
            'with attention beams highlighting connections between words',
        )

    # Agent themes
    if any(kw in title_lower for kw in ['agent', 'autonomous', 'agentic']):
        return (
            'AI agents and autonomous systems',
            'interconnected agent nodes with tool connections radiating outward, showing planning and execution loops',
        )

    # Programming themes
    if any(kw in title_lower for kw in ['python', 'javascript', 'coding', 'programming', 'typescript']):
        return (
            'code and software development',
            'abstract code blocks and function calls flowing through a pipeline, with brackets and syntax structures',
        )

    # Data themes
    if any(kw in title_lower for kw in ['data', 'analytics', 'database', 'sql', 'pandas']):
        return (
            'data analysis and insights',
            'data tables transforming into charts and visualizations, '
            'with data points flowing through transformation pipelines',
        )

    # Web themes
    if any(kw in title_lower for kw in ['web', 'frontend', 'backend', 'api', 'react', 'next']):
        return (
            'web technology and connectivity',
            'interconnected web of API endpoints and components, '
            'with request/response flows between client and server nodes',
        )

    # Cloud themes
    if any(kw in title_lower for kw in ['cloud', 'aws', 'azure', 'kubernetes', 'docker']):
        return (
            'cloud infrastructure and scalability',
            'layered cloud infrastructure with containers and services '
            'connected by network paths, showing scaling and deployment',
        )

    # Security themes
    if any(kw in title_lower for kw in ['security', 'cyber', 'encryption', 'auth']):
        return (
            'cybersecurity and protection',
            'shield-like structures with encryption key patterns and secure lock mechanisms protecting data flows',
        )

    # API / Pricing / Cost themes (check before tokenization since "token pricing" should match here)
    if any(kw in title_lower for kw in ['pricing', 'cost', 'billing', 'budget', 'usage', 'api key']):
        return (
            'API pricing and cost management',
            'layered pricing tiers with tokens flowing through meters and gauges, '
            'showing usage dashboards with charts, coin/credit symbols, and API request counters',
        )

    # Context window / Tokenization
    if any(kw in title_lower for kw in ['context window', 'token', 'attention']):
        return (
            'context windows and attention mechanisms',
            'sliding window moving across a sequence of tokens, '
            'with attention weights visualized as connection strengths',
        )

    # Default - try to extract the main concept
    main_concept = title.replace('Learning Path', '').replace('learning path', '').strip()
    return (
        f'the concept of {main_concept}',
        f'abstract geometric representation of {main_concept} concepts '
        'with interconnected elements showing relationships and flow',
    )


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

        # Build prompt with theme hint and concept visualization
        theme_hint, concept_visualization = get_theme_hint(saved_path.title)
        prompt = COVER_IMAGE_PROMPT.format(
            title=saved_path.title,
            theme_hint=theme_hint,
            concept_visualization=concept_visualization,
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
