"""API views for YouTube integration."""

import logging

from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.integrations.base.exceptions import IntegrationAuthError
from core.integrations.models import ContentSource
from core.integrations.serializers import ContentSourceSerializer, YouTubeImportSerializer
from core.integrations.youtube.helpers import (
    extract_channel_id_from_url,
    extract_video_id_from_url,
    get_user_youtube_token,
)
from core.integrations.youtube.service import YouTubeService
from core.integrations.youtube.tasks import (
    import_youtube_channel_task,
    import_youtube_video_task,
    sync_single_content_source,
)
from core.projects.models import Project

logger = logging.getLogger(__name__)


class YouTubeViewSet(viewsets.ViewSet):
    """API endpoints for YouTube integration."""

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='my-channel')
    def my_channel(self, request):
        """
        Get the authenticated user's YouTube channel info.

        GET /api/integrations/youtube/my-channel/

        Returns:
        {
            "success": true,
            "channel": {
                "id": "UC...",
                "title": "Channel Name",
                "description": "...",
                "thumbnail_url": "...",
                "subscriber_count": 1000,
                "video_count": 50
            },
            "already_imported": false
        }
        """
        try:
            # Get YouTube OAuth token
            access_token = get_user_youtube_token(request.user)

            # Initialize YouTube service
            youtube = YouTubeService(oauth_token=access_token)

            # Get user's channel info (use "mine" parameter)
            response = youtube._make_request(
                endpoint='/channels', params={'part': 'snippet,statistics', 'mine': 'true'}
            )

            if not response.get('items'):
                return Response(
                    {'success': False, 'error': 'No YouTube channel found for this account'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            channel_data = response['items'][0]
            channel_id = channel_data['id']

            # Check if channel already imported
            already_imported = ContentSource.objects.filter(
                user=request.user, platform='youtube', source_identifier=channel_id
            ).exists()

            # Helper to get best available thumbnail
            def get_best_thumbnail(thumbnails: dict) -> str:
                for size in ['maxres', 'high', 'medium', 'default']:
                    if size in thumbnails:
                        return thumbnails[size]['url']
                return ''

            return Response(
                {
                    'success': True,
                    'channel': {
                        'id': channel_id,
                        'title': channel_data['snippet']['title'],
                        'description': channel_data['snippet'].get('description', ''),
                        'thumbnail_url': get_best_thumbnail(channel_data['snippet']['thumbnails']),
                        'subscriber_count': int(channel_data['statistics'].get('subscriberCount', 0)),
                        'video_count': int(channel_data['statistics'].get('videoCount', 0)),
                    },
                    'already_imported': already_imported,
                }
            )

        except IntegrationAuthError as e:
            logger.error(f'Auth error fetching YouTube channel: {e}')
            return Response(
                {'error': 'YouTube not connected', 'message': str(e), 'action': 'connect_youtube'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as e:
            logger.exception('Error fetching YouTube channel info')
            return Response(
                {'error': 'Failed to fetch channel info', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['get'], url_path='my-videos')
    def my_videos(self, request):
        """
        Get the authenticated user's YouTube videos for selection.

        GET /api/integrations/youtube/my-videos/?max_results=50

        Returns:
        {
            "success": true,
            "videos": [
                {
                    "id": "video_id",
                    "title": "Video Title",
                    "description": "...",
                    "thumbnail_url": "...",
                    "published_at": "2024-01-01T00:00:00Z",
                    "duration": "PT10M30S",
                    "view_count": 1000,
                    "already_imported": false
                },
                ...
            ]
        }
        """
        max_results = int(request.query_params.get('max_results', 50))

        try:
            # Get YouTube OAuth token
            access_token = get_user_youtube_token(request.user)

            # Initialize YouTube service
            youtube = YouTubeService(oauth_token=access_token)

            # Get user's channel ID first
            channel_response = youtube._make_request(
                endpoint='/channels', params={'part': 'contentDetails', 'mine': 'true'}
            )

            if not channel_response.get('items'):
                return Response(
                    {'success': False, 'error': 'No YouTube channel found'}, status=status.HTTP_404_NOT_FOUND
                )

            uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']

            # Get videos from uploads playlist
            videos_response = youtube._make_request(
                endpoint='/playlistItems',
                params={'part': 'snippet', 'playlistId': uploads_playlist_id, 'maxResults': min(max_results, 50)},
            )

            video_ids = [item['snippet']['resourceId']['videoId'] for item in videos_response.get('items', [])]

            if not video_ids:
                return Response({'success': True, 'videos': []})

            # Get detailed video info
            videos_detail_response = youtube._make_request(
                endpoint='/videos', params={'part': 'snippet,contentDetails,statistics', 'id': ','.join(video_ids)}
            )

            # Check which videos are already imported
            imported_urls = set(
                Project.objects.filter(user=request.user, external_url__contains='youtube.com/watch?v=').values_list(
                    'external_url', flat=True
                )
            )

            # Helper to get best available thumbnail
            def get_best_thumbnail(thumbnails: dict) -> str:
                for size in ['maxres', 'high', 'medium', 'default']:
                    if size in thumbnails:
                        return thumbnails[size]['url']
                return ''

            videos = []
            for video in videos_detail_response.get('items', []):
                video_id = video['id']
                video_url = f'https://youtube.com/watch?v={video_id}'

                videos.append(
                    {
                        'id': video_id,
                        'title': video['snippet']['title'],
                        'description': video['snippet']['description'][:200],
                        'thumbnail_url': get_best_thumbnail(video['snippet']['thumbnails']),
                        'published_at': video['snippet']['publishedAt'],
                        'duration': video['contentDetails']['duration'],
                        'view_count': int(video['statistics'].get('viewCount', 0)),
                        'already_imported': video_url in imported_urls,
                    }
                )

            return Response({'success': True, 'videos': videos})

        except IntegrationAuthError as e:
            logger.error(f'Auth error fetching YouTube videos: {e}')
            return Response(
                {'error': 'YouTube not connected', 'message': str(e), 'action': 'connect_youtube'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as e:
            logger.exception('Error fetching YouTube videos')
            return Response(
                {'error': 'Failed to fetch videos', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='import-channel')
    def import_channel(self, request):
        """
        Import entire YouTube channel and enable auto-sync.

        POST /api/integrations/youtube/import-channel/

        Body:
        {
            "max_videos": 50  # Optional, default 50
        }

        Returns:
        {
            "success": true,
            "task_id": "celery-task-id",
            "message": "Channel import started"
        }
        """
        user_id = request.user.id
        max_videos = request.data.get('max_videos', 50)

        try:
            # Get user's channel ID
            access_token = get_user_youtube_token(request.user)
            youtube = YouTubeService(oauth_token=access_token)

            response = youtube._make_request(endpoint='/channels', params={'part': 'id', 'mine': 'true'})

            if not response.get('items'):
                return Response(
                    {'success': False, 'error': 'No YouTube channel found'}, status=status.HTTP_404_NOT_FOUND
                )

            channel_id = response['items'][0]['id']

            logger.info(f'User {user_id} importing channel {channel_id}')

            # Queue channel import task
            task = import_youtube_channel_task.delay(
                user_id=user_id,
                channel_id=channel_id,
                max_videos=max_videos,
            )

            return Response(
                {
                    'success': True,
                    'task_id': task.id,
                    'message': 'Importing channel (auto-sync enabled)',
                    'channel_id': channel_id,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        except IntegrationAuthError as e:
            logger.error(f'Auth error importing channel: {e}')
            return Response(
                {'error': 'YouTube not connected', 'message': str(e), 'action': 'connect_youtube'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as e:
            logger.exception('Error importing channel')
            return Response(
                {'error': 'Channel import failed', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='sync-status')
    def sync_status(self, request):
        """
        Get auto-sync status for user's YouTube channel.

        GET /api/integrations/youtube/sync-status/

        Returns:
        {
            "success": true,
            "sync_enabled": true,
            "last_synced_at": "2024-01-01T00:00:00Z",
            "total_videos_imported": 25
        }
        """
        try:
            # Get user's channel ID
            access_token = get_user_youtube_token(request.user)
            youtube = YouTubeService(oauth_token=access_token)

            response = youtube._make_request(endpoint='/channels', params={'part': 'id', 'mine': 'true'})

            if not response.get('items'):
                return Response({'success': True, 'sync_enabled': False, 'message': 'No YouTube channel found'})

            channel_id = response['items'][0]['id']

            # Check if ContentSource exists
            content_source = ContentSource.objects.filter(
                user=request.user, platform='youtube', source_identifier=channel_id
            ).first()

            if not content_source:
                return Response({'success': True, 'sync_enabled': False, 'message': 'Channel not imported yet'})

            return Response(
                {
                    'success': True,
                    'sync_enabled': content_source.sync_enabled,
                    'last_synced_at': content_source.last_synced_at.isoformat()
                    if content_source.last_synced_at
                    else None,
                    'total_videos_imported': content_source.metadata.get('total_videos_imported', 0),
                    'sync_frequency': content_source.sync_frequency,
                }
            )

        except IntegrationAuthError:
            return Response({'success': True, 'sync_enabled': False, 'message': 'YouTube not connected'})
        except Exception as e:
            logger.exception('Error getting sync status')
            return Response(
                {'error': 'Failed to get sync status', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='toggle-sync')
    def toggle_sync(self, request):
        """
        Enable/disable auto-sync for YouTube channel.

        POST /api/integrations/youtube/toggle-sync/

        Body:
        {
            "enabled": true
        }

        Returns:
        {
            "success": true,
            "sync_enabled": true
        }
        """
        enabled = request.data.get('enabled', True)

        try:
            # Get user's channel ID
            access_token = get_user_youtube_token(request.user)
            youtube = YouTubeService(oauth_token=access_token)

            response = youtube._make_request(endpoint='/channels', params={'part': 'id', 'mine': 'true'})

            if not response.get('items'):
                return Response(
                    {'success': False, 'error': 'No YouTube channel found'}, status=status.HTTP_404_NOT_FOUND
                )

            channel_id = response['items'][0]['id']

            # Get or create ContentSource
            content_source = ContentSource.objects.filter(
                user=request.user, platform='youtube', source_identifier=channel_id
            ).first()

            if not content_source:
                return Response(
                    {'success': False, 'error': 'Channel not imported yet. Import your channel first.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Toggle sync
            content_source.sync_enabled = enabled
            content_source.save()

            logger.info(f'Auto-sync {"enabled" if enabled else "disabled"} for channel {channel_id}')

            return Response(
                {
                    'success': True,
                    'sync_enabled': content_source.sync_enabled,
                    'message': f'Auto-sync {"enabled" if enabled else "disabled"}',
                }
            )

        except IntegrationAuthError as e:
            return Response(
                {
                    'error': 'YouTube not connected',
                    'message': str(e),
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as e:
            logger.exception('Error toggling sync')
            return Response(
                {'error': 'Failed to toggle sync', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @method_decorator(ratelimit(key='user', rate='10/h', method='POST'))
    @action(detail=False, methods=['post'], url_path='import')
    def import_content(self, request):
        """
        Import YouTube video(s) or channel.

        POST /api/integrations/youtube/import/

        Body:
        {
            "video_url": "https://youtube.com/watch?v=abc123",  # OR
            "channel_url": "https://youtube.com/channel/UC...",
            "is_showcase": true,
            "is_private": false,
            "max_videos": 50  # For channel import
        }

        Returns:
        {
            "success": true,
            "task_id": "celery-task-id",
            "message": "Import started"
        }
        """
        serializer = YouTubeImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        user_id = request.user.id

        try:
            # Single video import
            if data.get('video_url'):
                video_id = extract_video_id_from_url(data['video_url'])
                if not video_id:
                    return Response({'error': 'Invalid YouTube video URL'}, status=status.HTTP_400_BAD_REQUEST)

                logger.info(f'User {user_id} importing video {video_id}')

                # Queue import task
                task = import_youtube_video_task.delay(
                    user_id=user_id,
                    video_id=video_id,
                    is_showcased=data.get('is_showcase', True),
                    is_private=data.get('is_private', False),
                )

                return Response(
                    {
                        'success': True,
                        'task_id': task.id,
                        'message': f'Importing video {video_id}',
                        'video_id': video_id,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )

            # Channel import
            elif data.get('channel_url'):
                channel_id = extract_channel_id_from_url(data['channel_url'])
                if not channel_id:
                    return Response({'error': 'Invalid YouTube channel URL'}, status=status.HTTP_400_BAD_REQUEST)

                logger.info(f'User {user_id} importing channel {channel_id}')

                # Queue channel import task
                task = import_youtube_channel_task.delay(
                    user_id=user_id,
                    channel_id=channel_id,
                    max_videos=data.get('max_videos', 50),
                )

                return Response(
                    {
                        'success': True,
                        'task_id': task.id,
                        'message': f'Importing channel {channel_id}',
                        'channel_id': channel_id,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )

        except IntegrationAuthError as e:
            logger.error(f'Auth error importing YouTube content: {e}')
            return Response(
                {'error': 'YouTube not connected', 'message': str(e), 'action': 'connect_youtube'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as e:
            logger.exception('Error importing YouTube content')
            return Response({'error': 'Import failed', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ContentSourceViewSet(viewsets.ModelViewSet):
    """API endpoints for managing content sources."""

    permission_classes = [IsAuthenticated]
    serializer_class = ContentSourceSerializer

    def get_queryset(self):
        """Return only the current user's content sources."""
        return ContentSource.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        """Set the user when creating a content source."""
        serializer.save(user=self.request.user)

    @method_decorator(ratelimit(key='user', rate='20/h', method='POST'))
    @action(detail=True, methods=['post'], url_path='sync')
    def sync_now(self, request, pk=None):
        """
        Manually trigger sync for a content source.

        POST /api/integrations/content-sources/{id}/sync/

        Returns:
        {
            "success": true,
            "task_id": "celery-task-id",
            "message": "Sync started"
        }
        """
        source = self.get_object()

        if source.platform != 'youtube':
            return Response(
                {'error': 'Only YouTube sources support manual sync currently'}, status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f'User {request.user.id} manually syncing source {source.id}')

        try:
            # Queue sync task
            task = sync_single_content_source.delay(source.id)

            return Response(
                {
                    'success': True,
                    'task_id': task.id,
                    'message': f'Syncing {source.display_name}',
                },
                status=status.HTTP_202_ACCEPTED,
            )

        except Exception as e:
            logger.exception(f'Error syncing source {source.id}')
            return Response({'error': 'Sync failed', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='youtube')
    def youtube_sources(self, request):
        """
        Get all YouTube content sources for the current user.

        GET /api/integrations/content-sources/youtube/

        Returns list of YouTube content sources.
        """
        sources = self.get_queryset().filter(platform='youtube')
        serializer = self.get_serializer(sources, many=True)
        return Response(serializer.data)
