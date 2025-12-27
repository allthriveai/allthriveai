"""
Celery tasks for avatar generation.

Handles:
- Avatar image generation with OpenAI gpt-image-1
- Streaming progress via Redis Pub/Sub to WebSockets
- Session and iteration tracking
"""

import logging
import time
import uuid

import requests
from asgiref.sync import async_to_sync
from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider
from services.integrations.storage import StorageService

from .models import AvatarGenerationIteration, AvatarGenerationSession

# Exceptions that should trigger a retry (transient errors)
TRANSIENT_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
    ConnectionError,
    TimeoutError,
)

logger = logging.getLogger(__name__)
User = get_user_model()

# Avatar template prompts for "Create a Character" mode
AVATAR_TEMPLATES = {
    'wizard': 'a wise wizard with a mystical staff, wearing flowing robes with glowing runes',
    'robot': 'a friendly futuristic robot with glowing blue eyes and sleek metallic design',
    'creature': 'a cute magical creature with big expressive eyes, soft fur, and tiny wings',
    'astronaut': 'an astronaut in a colorful spacesuit with a reflective visor, floating among stars',
    'superhero': 'a confident superhero in a dynamic pose with a flowing cape',
    'pirate': 'a swashbuckling pirate with a tricorn hat, eye patch, and friendly smile',
    'ninja': 'a mysterious ninja with a cool mask and stealthy pose',
    'explorer': 'an adventurous explorer with a safari hat and binoculars',
}

# Base avatar prompt for consistent style
AVATAR_BASE_PROMPT = """Create a stylized avatar portrait in a modern, professional illustration style.
The avatar should be:
- Centered in frame, head and shoulders only
- Clean, vibrant colors on a simple gradient background
- Friendly and approachable expression
- Suitable for a profile picture
- High quality, detailed illustration

Style: Modern digital illustration, semi-realistic, clean lines, soft shading"""


def build_avatar_prompt(
    user_prompt: str,
    creation_mode: str,
    template_used: str = '',
) -> str:
    """
    Build the full prompt for avatar generation.

    Args:
        user_prompt: The user's custom description or refinement request
        creation_mode: 'scratch', 'template', 'make_me', or 'dicebear'
        template_used: Template name if using template mode

    Returns:
        Full prompt string for Gemini
    """
    if creation_mode == 'template' and template_used in AVATAR_TEMPLATES:
        template_desc = AVATAR_TEMPLATES[template_used]
        return f'{AVATAR_BASE_PROMPT}\n\nCharacter: {template_desc}\n\nCustomizations: {user_prompt}'

    if creation_mode == 'make_me':
        return (
            f'{AVATAR_BASE_PROMPT}\n\n'
            'Create an avatar based on the reference photo. '
            'Make it a stylized, artistic interpretation while maintaining recognizable features.\n\n'
            f'User request: {user_prompt}'
        )

    # Default: scratch mode
    return f'{AVATAR_BASE_PROMPT}\n\nCharacter description: {user_prompt}'


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def process_avatar_generation_task(
    self,
    session_id: int,
    prompt: str,
    user_id: int,
    channel_name: str,
    reference_image_url: str | None = None,
):
    """
    Process avatar generation asynchronously using OpenAI gpt-image-1.

    Streams results to WebSocket via Redis Pub/Sub.

    Args:
        session_id: AvatarGenerationSession ID
        prompt: User's avatar description/prompt
        user_id: User ID for permissions and attribution
        channel_name: Redis channel name for WebSocket broadcast
        reference_image_url: Optional URL of reference photo for "Make Me" mode

    Returns:
        Dict with processing results
    """
    channel_layer = get_channel_layer()

    # Debug logging for reference image
    logger.info(f'Avatar generation started: session_id={session_id}, reference_image_url={reference_image_url}')

    try:
        # Validate user exists
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.error(f'User not found: user_id={user_id}')
            return {'status': 'error', 'reason': 'user_not_found'}

        # Get session
        try:
            session = AvatarGenerationSession.objects.get(id=session_id, user=user)
        except AvatarGenerationSession.DoesNotExist:
            logger.error(f'Session not found: session_id={session_id}')
            return {'status': 'error', 'reason': 'session_not_found'}

        # Send "generating" status (camelCase keys for frontend compatibility)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'avatar_generating',
                'message': 'Creating your avatar...',
                'conversationId': session.conversation_id,
                'sessionId': session_id,
            },
        )

        # Build the full prompt
        full_prompt = build_avatar_prompt(
            user_prompt=prompt,
            creation_mode=session.creation_mode,
            template_used=session.template_used,
        )

        # Validate template if using template mode
        if session.creation_mode == 'template' and session.template_used not in AVATAR_TEMPLATES:
            error_message = f'Unknown template: {session.template_used}'
            logger.error(error_message)
            session.status = 'failed'
            session.error_message = error_message
            session.save(update_fields=['status', 'error_message', 'updated_at'])

            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'avatar_error',
                    'error': 'Invalid template selected. Please try a different one!',
                    'conversationId': session.conversation_id,
                    'sessionId': session_id,
                },
            )
            return {'status': 'error', 'reason': 'invalid_template'}

        # Download reference image if provided (for "Make Me" mode)
        reference_bytes = None
        if reference_image_url:
            try:
                # Convert localhost URLs to Docker internal network when running in container
                # localhost:9000 -> minio:9000 for MinIO access within Docker
                download_url = reference_image_url
                if 'localhost:9000' in download_url:
                    download_url = download_url.replace('localhost:9000', 'minio:9000')
                    logger.info(f'Converted reference URL for Docker: {download_url}')

                resp = requests.get(download_url, timeout=10)
                if resp.status_code == 200:
                    reference_bytes = resp.content
                    logger.info(f'Downloaded reference image: {len(reference_bytes)} bytes')
                else:
                    logger.warning(f'Failed to download reference image: HTTP {resp.status_code}')
            except Exception as e:
                logger.warning(f'Failed to download reference image: {e}', exc_info=True)

        # Generate image using OpenAI gpt-image-1.5
        # Model configured in settings.AI_MODELS['openai']['avatar']
        # Supports reference images via images.edit() API for "Make Me" mode
        start_time = time.time()
        ai = AIProvider(provider='openai', user_id=user_id)

        # Get model from settings (defaults to gpt-image-1.5)
        image_model = settings.AI_MODELS['openai'].get('avatar', 'gpt-image-1.5')

        # Pass reference image for "Make Me" mode
        image_bytes, mime_type = ai.generate_image_openai(
            prompt=full_prompt,
            model=image_model,
            size='1024x1024',
            quality='medium',  # gpt-image-1.5 uses 'low', 'medium', 'high'
            reference_image=reference_bytes,
        )
        latency_ms = int((time.time() - start_time) * 1000)
        text_response = None  # OpenAI doesn't return text with images

        if not image_bytes:
            # No image was generated
            error_message = text_response or "Sorry, I couldn't generate that avatar. Try a different description!"
            logger.error(f'Avatar generation failed: {error_message}')

            session.status = 'failed'
            session.error_message = error_message
            session.save(update_fields=['status', 'error_message', 'updated_at'])

            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'avatar_error',
                    'error': error_message,
                    'conversationId': session.conversation_id,
                    'sessionId': session_id,
                },
            )
            return {'status': 'error', 'reason': 'generation_failed'}

        # Upload to MinIO
        filename = f'avatar-{user_id}-{uuid.uuid4()}.png'
        storage = StorageService()
        image_url, upload_error = storage.upload_file(
            file_data=image_bytes,
            filename=filename,
            folder='avatars',
            content_type=mime_type or 'image/png',
            is_public=True,
        )

        if upload_error or not image_url:
            logger.error(f'Failed to upload avatar: {upload_error}')
            session.status = 'failed'
            session.error_message = f'Upload failed: {upload_error}'
            session.save(update_fields=['status', 'error_message', 'updated_at'])

            async_to_sync(channel_layer.group_send)(
                channel_name,
                {
                    'type': 'chat.message',
                    'event': 'avatar_error',
                    'error': "I generated the avatar but couldn't save it. Please try again!",
                    'conversationId': session.conversation_id,
                    'sessionId': session_id,
                },
            )
            return {'status': 'error', 'reason': 'upload_failed'}

        logger.info(f'Avatar generated and uploaded: {image_url}')

        # Track AI usage
        try:
            # Use the actual model that was used for generation
            openai_model = image_model
            estimated_input_tokens = len(full_prompt) // 4
            estimated_output_tokens = 0  # Image generation doesn't have output tokens

            AIUsageTracker.track_usage(
                user=user,
                feature='avatar_generation',
                provider='openai',
                model=openai_model,
                input_tokens=estimated_input_tokens,
                output_tokens=estimated_output_tokens,
                latency_ms=latency_ms,
                status='success',
                request_metadata={
                    'session_id': session_id,
                    'creation_mode': session.creation_mode,
                    'template_used': session.template_used,
                    'image_size_bytes': len(image_bytes),
                },
            )
        except Exception as tracking_error:
            logger.warning(f'Failed to track avatar generation usage: {tracking_error}', exc_info=True)

        # Create iteration record
        iteration_order = session.iterations.count()
        iteration = AvatarGenerationIteration.objects.create(
            session=session,
            prompt=prompt,
            image_url=image_url,
            order=iteration_order,
            generation_time_ms=latency_ms,
        )

        # Update session status to "ready"
        session.status = 'ready'
        session.save(update_fields=['status', 'updated_at'])

        logger.info(f'Created iteration {iteration_order} for session {session_id}')

        # Send success event (camelCase keys for frontend compatibility)
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'chat.message',
                'event': 'avatar_generated',
                'imageUrl': image_url,
                'conversationId': session.conversation_id,
                'sessionId': session_id,
                'iterationId': iteration.id,
                'iterationNumber': iteration_order + 1,
                'textResponse': text_response or '',
            },
        )

        return {
            'status': 'success',
            'session_id': session_id,
            'iteration_id': iteration.id,
            'image_url': image_url,
        }

    except TRANSIENT_EXCEPTIONS as exc:
        # Retry only for transient network/connection errors
        logger.warning(f'Avatar generation transient error, retrying: {exc}')
        error_message = str(exc)
        try:
            raise self.retry(exc=exc)
        except MaxRetriesExceededError:
            logger.error(f'Avatar generation failed after max retries: {exc}')
            # Fall through to error handling below

    except Exception as exc:
        logger.error(f'Avatar generation failed: {exc}', exc_info=True)
        error_message = str(exc)

    # Handle failure - update session and notify user
    try:
        session = AvatarGenerationSession.objects.get(id=session_id)
        session.status = 'failed'
        session.error_message = error_message if 'error_message' in locals() else 'Unknown error'
        session.save(update_fields=['status', 'error_message', 'updated_at'])
    except Exception as update_exc:
        logger.warning(f'Failed to update session {session_id} status: {update_exc}', exc_info=True)

    # Send error to user (camelCase keys for frontend compatibility)
    async_to_sync(channel_layer.group_send)(
        channel_name,
        {
            'type': 'chat.message',
            'event': 'avatar_error',
            'error': 'Something went wrong generating your avatar. Please try again!',
            'conversationId': f'avatar-{user_id}',
            'sessionId': session_id,
        },
    )

    return {'status': 'error', 'reason': 'generation_failed'}


@shared_task
def cleanup_old_reference_images():
    """
    Periodic task to clean up reference images older than 24 hours.

    Reference images uploaded for "Make Me" mode are only needed during
    the generation session. This task removes them to save storage space.
    """
    from datetime import timedelta

    from django.utils import timezone

    cutoff = timezone.now() - timedelta(hours=24)

    # Find sessions with reference images older than 24 hours
    old_sessions = AvatarGenerationSession.objects.filter(
        reference_image_url__isnull=False,
        created_at__lt=cutoff,
    ).exclude(reference_image_url='')

    storage = StorageService()
    cleaned_count = 0

    for session in old_sessions:
        try:
            # Extract filename from URL and delete from storage
            # URL format: https://storage.example.com/bucket/folder/filename.jpg
            url = session.reference_image_url
            if url:
                # Parse the filename from the URL
                filename = url.split('/')[-1]
                folder = 'reference-images'

                # Delete from storage (best effort)
                storage.delete_file(filename, folder)

                # Clear the URL from the session
                session.reference_image_url = ''
                session.save(update_fields=['reference_image_url', 'updated_at'])
                cleaned_count += 1

        except Exception as e:
            logger.warning(f'Failed to cleanup reference image for session {session.id}: {e}', exc_info=True)

    logger.info(f'Cleaned up {cleaned_count} old reference images')
    return {'cleaned': cleaned_count}
