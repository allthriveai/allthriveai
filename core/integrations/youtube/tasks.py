"""Celery tasks for YouTube integration."""

import logging
import random
from datetime import datetime, timedelta
from typing import Any

from celery import shared_task
from django.db import IntegrityError
from django.utils import timezone

from core.integrations.base.exceptions import IntegrationAuthError, IntegrationError, IntegrationNotFoundError
from core.integrations.models import ContentSource
from core.integrations.youtube.helpers import (
    _check_user_quota,
    _increment_quota,
    generate_video_slug,
    get_user_youtube_token,
    parse_duration,
)
from core.integrations.youtube.service import QuotaExceededError, YouTubeService
from core.projects.models import Project

logger = logging.getLogger(__name__)

# Configuration constants
AI_ANALYSIS_BULK_THRESHOLD = 10  # Skip AI analysis for bulk imports > this many videos (cost optimization)
MAX_TAGS_PER_VIDEO = 10  # Limit tags extracted from YouTube to prevent spam


@shared_task(
    bind=True,
    max_retries=3,
    autoretry_for=(QuotaExceededError, IntegrationError),
    retry_backoff=True,
    retry_backoff_max=600,  # Max 10 minutes
    queue='youtube_import',
)
def import_youtube_video_task(
    self,
    user_id: int,
    video_id: str,
    is_showcase: bool = True,
    is_private: bool = False,
    content_source_id: int = None,
    skip_ai_analysis: bool = False,
) -> dict[str, Any]:
    """
    Import a single YouTube video as a project.

    Args:
        user_id: User ID
        video_id: YouTube video ID
        is_showcase: Display in showcase (default: True)
        is_private: Make project private (default: False)
        content_source_id: ContentSource ID if auto-synced
        skip_ai_analysis: Skip expensive AI analysis (default: False for auto-sync)

    Returns:
        Dict with success status and project info
    """
    from core.users.models import User

    logger.info(f'Importing YouTube video {video_id} for user {user_id}')

    try:
        user = User.objects.get(id=user_id)

        # Check user quota
        if not _check_user_quota(user_id):
            logger.warning(f'User {user_id} quota exceeded, skipping video import')
            return {'success': False, 'error': 'quota_exceeded'}

        # Get OAuth token and create service
        token = get_user_youtube_token(user)
        service = YouTubeService(oauth_token=token)

        # Fetch video metadata
        video_data = service.get_video_info(video_id)
        logger.info(f'Fetched video: {video_data["title"]}')

        # Increment quota
        _increment_quota(user_id, units=3)

        # Check for duplicates (by external_url)
        external_url = f'https://youtube.com/watch?v={video_id}'

        # Use get_or_create to prevent race conditions
        project, created = Project.objects.get_or_create(
            user=user,
            external_url=external_url,
            defaults={
                'title': video_data['title'],
                'description': video_data['description'][:500],  # Truncate to 500 chars
                'type': Project.ProjectType.VIDEO,
                'slug': generate_video_slug(video_data['title'], video_id),
                'featured_image_url': video_data['thumbnail_url'],
                'is_showcase': is_showcase,
                'is_private': is_private,
                'is_published': not is_private,
                'published_at': timezone.now() if not is_private else None,
                'content_source_id': content_source_id,
                'content': {
                    'video': {
                        'platform': 'youtube',
                        'videoId': video_id,
                        'channelId': video_data['channel_id'],
                        'channelName': video_data['channel_name'],
                        'duration': parse_duration(video_data['duration']),
                        'durationISO': video_data['duration'],
                        'publishedAt': video_data['published_at'],
                        'viewCount': video_data['view_count'],
                        'likeCount': video_data['like_count'],
                        'tags': video_data['tags'][:10],  # Limit to 10 tags
                    },
                    'heroDisplayMode': 'video',
                    'heroVideoUrl': external_url,
                    'blocks': [
                        {
                            'type': 'text',
                            'style': 'body',
                            'content': video_data['description'][:1000],  # First 1000 chars
                        }
                    ],
                },
            },
        )

        if not created:
            logger.info(f'Video {video_id} already exists as project {project.id}, skipping')
            return {
                'success': True,
                'created': False,
                'project_id': project.id,
                'project_url': f'/{user.username}/{project.slug}',
            }

        logger.info(f'Created project {project.id} for video {video_id}')

        # AI analysis to auto-tag with tools, categories, and topics
        if not skip_ai_analysis:
            try:
                from core.integrations.youtube.ai_analyzer import analyze_youtube_video

                logger.info(f'Running AI analysis for video {video_id}')

                ai_metadata = analyze_youtube_video(video_data, user)

                # Apply tools
                if ai_metadata.get('tools'):
                    project.tools.set(ai_metadata['tools'])
                    logger.info(f'Added {len(ai_metadata["tools"])} tools to project')

                # Apply categories
                if ai_metadata.get('categories'):
                    project.categories.set(ai_metadata['categories'])
                    logger.info(f'Added {len(ai_metadata["categories"])} categories to project')

                # Apply topics
                if ai_metadata.get('topics'):
                    project.topics = ai_metadata['topics']
                    project.save()
                    logger.info(f'Added {len(ai_metadata["topics"])} topics to project')

            except Exception as e:
                logger.error(f'AI analysis failed for video {video_id}: {e}', exc_info=True)
                # Continue without AI tags - project is still created

        return {
            'success': True,
            'created': True,
            'project_id': project.id,
            'project_url': f'/{user.username}/{project.slug}',
        }

    except IntegrationAuthError as e:
        logger.error(f'Auth error importing video {video_id}: {e}')
        return {'success': False, 'error': 'auth_error', 'message': str(e)}

    except IntegrationNotFoundError as e:
        logger.error(f'Video {video_id} not found: {e}')
        return {'success': False, 'error': 'not_found', 'message': str(e)}

    except QuotaExceededError as e:
        logger.error(f'YouTube quota exceeded: {e}')
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=2**self.request.retries * 60) from e

    except IntegrityError as e:
        logger.error(f'Database integrity error: {e}')
        return {'success': False, 'error': 'duplicate'}

    except Exception:
        logger.exception(f'Unexpected error importing {video_id}')
        raise


@shared_task(bind=True, max_retries=3, autoretry_for=(QuotaExceededError,), retry_backoff=True, queue='youtube_import')
def import_youtube_channel_task(self, user_id: int, channel_id: str, max_videos: int = 50, **kwargs) -> dict[str, Any]:
    """
    Import all videos from a YouTube channel.
    Creates ContentSource for auto-sync.

    Args:
        user_id: User ID
        channel_id: YouTube channel ID
        max_videos: Max videos to import (default: 50)

    Returns:
        Dict with success status and import stats
    """
    from core.users.models import User

    logger.info(f'Importing channel {channel_id} for user {user_id}')

    try:
        user = User.objects.get(id=user_id)
        token = get_user_youtube_token(user)
        service = YouTubeService(oauth_token=token)

        # Get channel info
        channel_info = service.get_channel_info(channel_id)
        logger.info(f'Channel: {channel_info["title"]} ({channel_info["video_count"]} videos)')
        # Track quota for channel info fetch (approx 1 unit)
        _increment_quota(user_id, units=1)

        # Create ContentSource for auto-sync
        content_source, created = ContentSource.objects.get_or_create(
            user=user,
            platform='youtube',
            source_identifier=channel_id,
            defaults={
                'source_url': f'https://youtube.com/channel/{channel_id}',
                'display_name': channel_info['title'],
                'sync_enabled': True,
                'sync_frequency': 'every_2_hours',
                'metadata': {
                    **channel_info,
                    'subscriber_count': channel_info['subscriber_count'],
                    'video_count': channel_info['video_count'],
                },
            },
        )

        # Get all videos
        result = service.get_channel_videos(channel_id, max_results=max_videos)
        # Track quota for channel listing (approx 1 unit)
        _increment_quota(user_id, units=1)
        video_ids = result['videos']
        logger.info(f'Found {len(video_ids)} videos to import')

        # Import each video (skip AI for bulk imports to save costs)
        imported_count = 0
        failed_count = 0

        for video_id in video_ids:
            try:
                import_youtube_video_task.apply_async(
                    args=[user_id, video_id],
                    kwargs={
                        'content_source_id': content_source.id,
                        'skip_ai_analysis': len(video_ids) > AI_ANALYSIS_BULK_THRESHOLD,
                        **kwargs,
                    },
                )
                # Note: Not waiting for result to speed up bulk import
                imported_count += 1
            except Exception as e:
                logger.error(f'Failed to queue import for {video_id}: {e}')
                failed_count += 1

        # Update sync status
        content_source.last_synced_at = timezone.now()
        content_source.last_sync_status = 'success'
        content_source.metadata['total_videos_imported'] = (
            content_source.metadata.get('total_videos_imported', 0) + imported_count
        )
        content_source.save()

        logger.info(f'Channel import queued: {imported_count} videos, {failed_count} failed')

        return {
            'success': True,
            'content_source_id': content_source.id,
            'videos_queued': imported_count,
            'videos_failed': failed_count,
        }

    except Exception:
        logger.exception(f'Failed importing channel {channel_id}')
        raise


@shared_task(queue='youtube_sync')
def sync_content_sources():
    """
    Periodic task (Celery Beat) to sync enabled content sources.
    Runs every 15 minutes, processes 1000 sources at a time.

    SCALABILITY: Only syncs active users to handle 100K+ user base.
    """
    now = timezone.now()
    cutoff = now - timedelta(hours=2)  # For EVERY_2_HOURS frequency

    # Get sources that need syncing (SCALABLE QUERY)
    # Increased from 1000 to 5000 to handle 50K+ users
    # With 15-min window: 5000 sources = ~50 min processing = 80% capacity
    sources_to_sync = (
        ContentSource.objects.filter(
            sync_enabled=True,
            platform='youtube',
            last_synced_at__lt=cutoff,  # Needs sync
            user__is_active=True,
            user__is_profile_public=True,  # Only sync public profiles
            user__last_login__gte=now - timedelta(days=30),  # Active in last 30 days
        )
        .select_related('user')
        .order_by('last_synced_at')[:5000]
    )  # LIMIT 5000

    logger.info(f'Syncing {len(sources_to_sync)} content sources')

    for source in sources_to_sync:
        # Stagger tasks with countdown (0-900 seconds = 15min window)
        countdown = random.randint(0, 900)  # noqa: S311 - Not cryptographic, just task staggering
        sync_single_content_source.apply_async(
            args=[source.id],
            countdown=countdown,  # Spread load across 15min
            queue='youtube_sync',
        )


@shared_task(
    bind=True,
    max_retries=3,
    autoretry_for=(QuotaExceededError, IntegrationError),
    retry_backoff=True,
    queue='youtube_sync',
)
def sync_single_content_source(self, source_id: int):
    """
    Sync a single content source (check for new videos).

    Uses ETags for conditional requests to save quota.
    Skips dormant channels (no uploads in 6 months).

    Args:
        source_id: ContentSource ID

    Returns:
        Dict with sync results
    """
    logger.info(f'Syncing content source {source_id}')

    try:
        source = ContentSource.objects.select_related('user').get(id=source_id)

        # Check user quota
        if not _check_user_quota(source.user_id):
            logger.warning(f'User {source.user_id} quota exceeded, skipping sync')
            source.last_sync_status = 'quota_exceeded'
            source.save()
            return {'success': False, 'error': 'quota_exceeded'}

        # Skip dormant channels (no uploads in 6 months)
        if source.metadata.get('last_upload_date'):
            try:
                last_upload = datetime.fromisoformat(source.metadata['last_upload_date'])
                if last_upload < timezone.now() - timedelta(days=180):
                    logger.info(f'Skipping dormant channel {source.source_identifier}')
                    source.last_synced_at = timezone.now()
                    source.save()
                    return {'success': True, 'skipped': 'dormant'}
            except (ValueError, TypeError):
                pass  # Invalid date format, continue with sync

        token = get_user_youtube_token(source.user)
        service = YouTubeService(oauth_token=token)

        # Get ETag from metadata for conditional request
        etag = source.metadata.get('etag')

        # Get videos published since last sync (with ETag)
        published_after = source.last_synced_at.isoformat() if source.last_synced_at else None

        result = service.get_channel_videos(source.source_identifier, published_after=published_after, etag=etag)
        # Track quota for channel listing (approx 1 unit)
        _increment_quota(source.user_id, units=1)

        video_ids = result.get('videos', [])
        new_etag = result.get('etag')

        logger.info(f'Found {len(video_ids)} new videos for channel {source.source_identifier}')

        # Import new videos (skip AI for auto-sync to save costs)
        imported_count = 0
        for video_id in video_ids:
            try:
                import_youtube_video_task.apply_async(
                    args=[source.user_id, video_id],
                    kwargs={
                        'content_source_id': source.id,
                        'skip_ai_analysis': True,  # Skip expensive AI on auto-sync to save costs
                    },
                    queue='youtube_import',
                )
                imported_count += 1
            except Exception as e:
                logger.error(f'Failed to queue import for {video_id}: {e}')

        # Update sync status and metadata
        source.last_synced_at = timezone.now()
        source.last_sync_status = 'success'
        source.metadata = {
            **source.metadata,
            'etag': new_etag,
            'last_sync_video_count': len(video_ids),
            'total_videos_imported': source.metadata.get('total_videos_imported', 0) + imported_count,
            'last_upload_date': timezone.now().isoformat() if video_ids else source.metadata.get('last_upload_date'),
        }
        source.save()

        logger.info(f'Sync complete for source {source_id}: {imported_count} videos queued')

        return {'success': True, 'videos_found': len(video_ids), 'videos_queued': imported_count}

    except QuotaExceededError as e:
        logger.error(f'Quota exceeded for source {source_id}: {e}')
        source.last_sync_status = 'quota_exceeded'
        source.last_sync_error = str(e)
        source.save()
        raise

    except Exception as e:
        logger.exception(f'Failed syncing source {source_id}')
        source.last_sync_status = 'error'
        source.last_sync_error = str(e)[:500]
        source.save()
        raise
