"""Service for syncing YouTube channel feeds and creating video projects."""

import logging
import re
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from core.integrations.youtube.ai_analyzer import analyze_youtube_video
from core.integrations.youtube.helpers import generate_video_slug
from core.integrations.youtube.service import YouTubeService
from core.integrations.youtube_feed_models import YouTubeFeedAgent, YouTubeFeedVideo
from core.projects.models import Project

logger = logging.getLogger(__name__)


def parse_iso_duration_to_seconds(duration_iso: str) -> int:
    """
    Parse ISO 8601 duration to seconds.

    Args:
        duration_iso: ISO 8601 duration (e.g., "PT15M33S", "PT1H2M10S")

    Returns:
        Duration in seconds
    """
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_iso)
    if not match:
        return 0

    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)

    return hours * 3600 + minutes * 60 + seconds


class YouTubeFeedSyncService:
    """Service for syncing YouTube feed agents."""

    @classmethod
    def sync_agent(cls, agent: YouTubeFeedAgent) -> dict:
        """Sync a single YouTube feed agent.

        Uses incremental sync to only fetch new videos:
        1. Uses published_after based on most recent video we have (not last sync time)
        2. Uses ETag for conditional requests (304 Not Modified = no changes)
        3. Only fetches video details for videos we don't already have

        Args:
            agent: YouTubeFeedAgent instance to sync

        Returns:
            Dictionary with sync results: created, updated, skipped, error_messages
        """
        results = {
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0,
            'error_messages': [],
        }

        try:
            # Initialize YouTube service with API key (agents use shared quota)
            service = YouTubeService(api_key=True)

            # Get the most recent video we have for this agent to use as cutoff
            # This is more accurate than last_synced_at because we want videos
            # published AFTER our newest video, not after our last check
            latest_video = YouTubeFeedVideo.objects.filter(agent=agent).order_by('-published_at').first()

            published_after = None
            if latest_video:
                # Add 1 second to avoid re-fetching the same video
                published_after = (latest_video.published_at + timezone.timedelta(seconds=1)).isoformat()
                logger.info(f'Incremental sync: fetching videos after {published_after}')

            # Get max videos from settings
            max_videos = agent.settings.get('max_videos', 20)

            # Fetch channel videos with conditional request (ETag)
            logger.info(f'Checking for new videos from {agent.channel_name} ({agent.channel_id})')

            channel_data = service.get_channel_videos(
                channel_id=agent.channel_id,
                max_results=max_videos,
                published_after=published_after,
                etag=agent.etag or None,
            )

            video_ids = channel_data.get('videos', [])
            new_etag = channel_data.get('etag', '')

            # If no videos returned and we had an etag, channel hasn't changed
            if not video_ids and agent.etag:
                logger.info(f'No new videos for {agent.channel_name} (ETag match or no new content)')
                agent.last_synced_at = timezone.now()
                agent.last_sync_status = 'No new videos'
                agent.save()
                return results

            logger.info(f'Found {len(video_ids)} video(s) to process for {agent.channel_name}')

            # Process each video - only fetch details for new videos
            for video_id in video_ids:
                try:
                    # Check if video already exists - skip if so (saves API quota)
                    if YouTubeFeedVideo.objects.filter(video_id=video_id).exists():
                        logger.debug(f'Skipping existing video: {video_id}')
                        results['skipped'] += 1
                        continue

                    # Fetch video details and create project
                    video_info = service.get_video_info(video_id)

                    # Check shorts_only filter if enabled
                    if agent.settings.get('shorts_only', False):
                        duration_iso = video_info.get('duration', 'PT0S')
                        duration_seconds = parse_iso_duration_to_seconds(duration_iso)

                        # Apply same heuristics as is_short property
                        is_short = False
                        if duration_seconds <= 90:
                            is_short = True
                        elif duration_seconds <= 180:
                            description = video_info.get('description', '')
                            if len(description.strip()) < 50:
                                is_short = True

                        if not is_short:
                            logger.debug(f'Skipping non-Short video: {video_id} (duration: {duration_seconds}s)')
                            results['skipped'] += 1
                            continue

                    cls._create_video_project(agent, video_info)
                    results['created'] += 1
                    logger.info(f'Created new video project: {video_info["title"][:50]}...')

                except Exception as e:
                    logger.error(f'Error processing video {video_id}: {e}', exc_info=True)
                    results['errors'] += 1
                    results['error_messages'].append(f'{video_id}: {str(e)}')

            # Update agent sync status
            agent.last_synced_at = timezone.now()
            if results['created'] > 0:
                agent.last_sync_status = f'Added {results["created"]} new video(s)'
            else:
                agent.last_sync_status = 'No new videos'
            agent.last_sync_error = ''
            if new_etag:
                agent.etag = new_etag
            agent.save()

        except Exception as e:
            logger.error(f'Error syncing YouTube agent {agent.name}: {e}', exc_info=True)
            agent.last_sync_error = str(e)
            agent.status = YouTubeFeedAgent.Status.ERROR
            agent.save()
            results['errors'] += 1
            results['error_messages'].append(str(e))

        return results

    @classmethod
    def _create_video_project(cls, agent: YouTubeFeedAgent, video_info: dict):
        """Create a new video project from YouTube data."""
        with transaction.atomic():
            # Build content structure
            content = cls._build_video_content(video_info, agent)

            # Use AI analyzer to extract tools, categories, and topics
            analysis_result = analyze_youtube_video(video_info, user=agent.agent_user)
            tools = analysis_result.get('tools', [])
            categories = analysis_result.get('categories', [])
            topics = analysis_result.get('topics', [])

            logger.info(
                f'AI analysis for "{video_info["title"][:40]}...": '
                f'{len(tools)} tools, {len(categories)} categories, {len(topics)} topics'
            )

            # Parse published date
            published_at = cls._parse_youtube_date(video_info.get('published_at'))

            # Generate slug
            slug = generate_video_slug(video_info['title'], video_info['video_id'])

            # Create project
            project = Project.objects.create(
                user=agent.agent_user,
                slug=slug,
                title=video_info['title'],
                description=video_info.get('description', '')[:500],
                type=Project.ProjectType.VIDEO,
                external_url=f'https://www.youtube.com/watch?v={video_info["video_id"]}',
                featured_image_url=video_info.get('thumbnail_url', ''),
                content=content,
                topics=topics,
                is_showcased=True,
                is_private=False,
            )

            # Add tools and categories to project
            if tools:
                project.tools.add(*tools)
                logger.debug(f'Added {len(tools)} tools to project: {[t.name for t in tools]}')
            if categories:
                project.categories.add(*categories)
                logger.debug(f'Added {len(categories)} categories to project: {[c.name for c in categories]}')

            # Parse duration
            duration_iso = video_info.get('duration', '')
            duration_seconds = parse_iso_duration_to_seconds(duration_iso)

            # Create feed video metadata
            feed_video = YouTubeFeedVideo.objects.create(
                project=project,
                agent=agent,
                video_id=video_info['video_id'],
                channel_id=video_info['channel_id'],
                channel_name=video_info['channel_name'],
                permalink=f'https://www.youtube.com/watch?v={video_info["video_id"]}',
                thumbnail_url=video_info.get('thumbnail_url', ''),
                duration=duration_seconds,
                duration_iso=duration_iso,
                view_count=video_info.get('view_count', 0),
                like_count=video_info.get('like_count', 0),
                published_at=published_at or timezone.now(),
                tags=video_info.get('tags', []),
                category_id=video_info.get('category_id', ''),
                youtube_metadata=video_info,
            )

            logger.info(f'Created YouTube video project: {project.title} ({feed_video.video_id})')

    @classmethod
    def _update_video(cls, video_id: str, video_info: dict):
        """Update an existing YouTube video's metrics."""
        try:
            feed_video = YouTubeFeedVideo.objects.get(video_id=video_id)
            project = feed_video.project

            # Update metrics
            feed_video.view_count = video_info.get('view_count', feed_video.view_count)
            feed_video.like_count = video_info.get('like_count', feed_video.like_count)
            feed_video.youtube_metadata = video_info
            feed_video.save()

            # Update project thumbnail if changed
            if video_info.get('thumbnail_url') and project.featured_image_url != video_info['thumbnail_url']:
                project.featured_image_url = video_info['thumbnail_url']
                project.save()

            logger.debug(f'Updated YouTube video: {project.title}')
        except YouTubeFeedVideo.DoesNotExist:
            logger.warning(f'Video {video_id} not found for update')

    @classmethod
    def _build_video_content(cls, video_info: dict, agent: YouTubeFeedAgent) -> dict:
        """Build structured content for video project.

        Creates a minimal project page with just the video embed.
        """
        import uuid

        video_id = video_info['video_id']

        # Parse duration to determine if it's a Short
        duration_iso = video_info.get('duration', '')
        duration_seconds = parse_iso_duration_to_seconds(duration_iso)

        # Detect YouTube Shorts using heuristics:
        # - Under 90 seconds: definitely a Short
        # - 90-180 seconds with no/minimal description: likely a Short
        is_short = False
        if duration_seconds <= 90:
            is_short = True
        elif duration_seconds <= 180:
            description = video_info.get('description', '')
            if len(description.strip()) < 50:
                is_short = True

        # Single video section - embedded player
        video_section = {
            'id': str(uuid.uuid4()),
            'type': 'video',
            'enabled': True,
            'order': 0,
            'content': {
                'platform': 'youtube',
                'videoId': video_id,
                'url': f'https://www.youtube.com/shorts/{video_id}'
                if is_short
                else f'https://www.youtube.com/watch?v={video_id}',
                'embedUrl': f'https://www.youtube.com/embed/{video_id}',
                'isShort': is_short,
                'duration': duration_seconds,
            },
        }

        return {
            'templateVersion': 2,
            'sections': [video_section],
            'video': {
                'platform': 'youtube',
                'videoId': video_id,
                'channelId': video_info['channel_id'],
                'channelName': video_info['channel_name'],
                'isShort': is_short,
                'duration': duration_seconds,
            },
            'heroDisplayMode': 'video',
            'heroVideoUrl': f'https://www.youtube.com/shorts/{video_id}'
            if is_short
            else f'https://www.youtube.com/watch?v={video_id}',
        }

    @staticmethod
    def _parse_youtube_date(date_str: str | None) -> datetime | None:
        """Parse YouTube API date string to datetime."""
        if not date_str:
            return None

        try:
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt
        except (ValueError, AttributeError) as e:
            logger.warning(f'Failed to parse YouTube date: {date_str} - {e}')
            return None

    @classmethod
    def sync_all_active_agents(cls) -> dict:
        """Sync all active YouTube feed agents.

        Returns:
            Dictionary with overall sync results
        """
        agents = YouTubeFeedAgent.objects.filter(status=YouTubeFeedAgent.Status.ACTIVE)

        total_results = {
            'agents_synced': 0,
            'total_created': 0,
            'total_skipped': 0,
            'total_errors': 0,
        }

        for agent in agents:
            results = cls.sync_agent(agent)
            total_results['agents_synced'] += 1
            total_results['total_created'] += results['created']
            total_results['total_skipped'] += results['skipped']
            total_results['total_errors'] += results['errors']

        return total_results

    @classmethod
    def resolve_channel_id_from_handle(cls, handle: str) -> dict | None:
        """Resolve a YouTube @handle to channel ID and info.

        Args:
            handle: YouTube handle (e.g., "@AIDailyBrief")

        Returns:
            Dict with channel_id, channel_name, etc. or None if not found
        """
        try:
            # Remove @ if present
            handle_clean = handle.lstrip('@')

            # Use search to find channel by handle
            # YouTube API v3 doesn't have direct handle lookup, so we use channels.list with forHandle
            from django.conf import settings

            from core.integrations.youtube.service import get_http_client

            client = get_http_client()
            # Use YOUTUBE_API_KEY or fall back to GOOGLE_API_KEY
            api_key = getattr(settings, 'YOUTUBE_API_KEY', None) or getattr(settings, 'GOOGLE_API_KEY', None)
            params = {
                'part': 'snippet,statistics',
                'forHandle': handle_clean,
                'key': api_key,
            }

            response = client.get(
                f'{YouTubeService.BASE_URL}/channels',
                params=params,
            )
            response.raise_for_status()
            data = response.json()

            if not data.get('items'):
                logger.warning(f'Channel not found for handle: {handle}')
                return None

            item = data['items'][0]
            snippet = item['snippet']
            statistics = item.get('statistics', {})

            return {
                'channel_id': item['id'],
                'channel_name': snippet['title'],
                'description': snippet.get('description', ''),
                'thumbnail_url': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                'subscriber_count': int(statistics.get('subscriberCount', 0)),
                'video_count': int(statistics.get('videoCount', 0)),
            }

        except Exception as e:
            logger.error(f'Error resolving channel handle {handle}: {e}', exc_info=True)
            return None
