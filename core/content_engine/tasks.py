"""Celery tasks for Content Engine."""

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def publish_post(scheduled_post_id: int):
    """Publish a scheduled post to the target platform."""
    from .models import ContentClip, ScheduledPost

    try:
        post = ScheduledPost.objects.get(id=scheduled_post_id)
    except ScheduledPost.DoesNotExist:
        logger.error(f'ScheduledPost {scheduled_post_id} not found')
        return {'error': 'Post not found'}

    if post.status not in [ScheduledPost.Status.SCHEDULED, ScheduledPost.Status.PUBLISHING]:
        logger.warning(f'Post {scheduled_post_id} is not in publishable status: {post.status}')
        return {'error': f'Post is not publishable (status: {post.status})'}

    post.status = ScheduledPost.Status.PUBLISHING
    post.save()

    try:
        if post.platform == ScheduledPost.Platform.LINKEDIN:
            result = _publish_to_linkedin(post)
        elif post.platform == ScheduledPost.Platform.YOUTUBE:
            result = _publish_to_youtube(post)
        elif post.platform == ScheduledPost.Platform.TWITTER:
            result = _publish_to_twitter(post)
        else:
            raise NotImplementedError(f'Platform {post.platform} not supported')

        # Update post with success
        post.status = ScheduledPost.Status.PUBLISHED
        post.published_at = timezone.now()
        post.platform_post_id = result.get('post_id', '')
        post.platform_url = result.get('url', '')
        post.save()

        # Update clip status
        post.clip.status = ContentClip.Status.PUBLISHED
        post.clip.save()

        logger.info(f'Successfully published post {scheduled_post_id} to {post.platform}')
        return {'success': True, 'url': post.platform_url}

    except Exception as e:
        logger.exception(f'Failed to publish post {scheduled_post_id}: {e}')
        post.status = ScheduledPost.Status.FAILED
        post.error_message = str(e)
        post.save()
        return {'error': str(e)}


def _publish_to_linkedin(post):
    """Publish to LinkedIn."""
    from core.integrations.linkedin.service import LinkedInService

    # Get user's LinkedIn connection
    linkedin_service = LinkedInService(post.user)

    # Check if clip has video content in scenes
    video_url = None
    if post.clip.scenes:
        # Look for video_url in scenes data
        for scene in post.clip.scenes:
            if isinstance(scene, dict) and scene.get('video_url'):
                video_url = scene.get('video_url')
                break

    if video_url:
        result = linkedin_service.publish_video_post(post.text_content, video_url)
    else:
        # Text post
        result = linkedin_service.publish_text_post(post.text_content)

    return result


def _publish_to_youtube(post):
    """Publish to YouTube."""
    # TODO: Implement YouTube publishing
    raise NotImplementedError('YouTube publishing not yet implemented')


def _publish_to_twitter(post):
    """Publish to Twitter/X."""
    # TODO: Implement Twitter publishing
    raise NotImplementedError('Twitter publishing not yet implemented')


@shared_task
def check_scheduled_posts():
    """Check for posts that need to be published. Run every minute via Celery Beat."""
    from .models import ScheduledPost

    now = timezone.now()
    due_posts = ScheduledPost.objects.filter(
        status=ScheduledPost.Status.SCHEDULED,
        scheduled_for__lte=now,
    )

    count = 0
    for post in due_posts:
        publish_post.delay(post.id)
        count += 1

    if count > 0:
        logger.info(f'Queued {count} posts for publishing')

    return {'queued': count}
