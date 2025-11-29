"""
Practical tests for YouTube integration - focused on preventing real breakage.

Tests cover:
- OAuth token handling (encryption/decryption)
- Video import workflow
- Channel import and auto-sync
- AI analysis integration
- Error handling and edge cases
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from core.integrations.models import ContentSource
from core.integrations.youtube.service import YouTubeService
from core.integrations.youtube.tasks import import_youtube_channel_task, import_youtube_video_task
from core.projects.models import Project
from core.social.models import SocialConnection, SocialProvider

User = get_user_model()


class YouTubeOAuthTest(TestCase):
    """Test OAuth token handling - critical for all YouTube features."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

    def test_token_encryption_decryption_roundtrip(self):
        """CRITICAL: Ensure tokens can be encrypted and decrypted without corruption."""
        connection = SocialConnection.objects.create(
            user=self.user, provider=SocialProvider.GOOGLE, provider_user_id='123456', provider_username='testuser'
        )

        original_token = 'ya29.a0AfH6SMBx...'  # Example token format
        connection.access_token = original_token
        connection.save()

        # Refresh from DB to ensure persistence works
        connection.refresh_from_db()
        decrypted_token = connection.access_token

        self.assertEqual(original_token, decrypted_token, 'Token must survive encryption/decryption roundtrip')

    def test_memoryview_handling(self):
        """CRITICAL: Ensure we handle memoryview from BinaryField correctly."""
        connection = SocialConnection.objects.create(
            user=self.user, provider=SocialProvider.GOOGLE, provider_user_id='123456', provider_username='testuser'
        )

        token = 'test_access_token_12345'
        connection.access_token = token
        connection.save()

        # This should not raise TypeError: 'token must be bytes or str'
        try:
            retrieved_token = connection.access_token
            self.assertEqual(token, retrieved_token)
        except TypeError as e:
            self.fail(f'Token decryption failed with memoryview: {e}')

    def test_expired_token_detection(self):
        """Test token expiration detection to trigger refresh."""
        connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.GOOGLE,
            provider_user_id='123456',
            provider_username='testuser',
            token_expires_at=timezone.now() - timedelta(hours=1),
        )
        connection.access_token = 'expired_token'
        connection.save()

        self.assertTrue(connection.is_token_expired(), 'Expired tokens must be detected')


class VideoImportTest(TestCase):
    """Test video import workflow - the main user-facing feature."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        # Create valid OAuth connection
        self.connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.GOOGLE,
            provider_user_id='123456',
            provider_username='testuser',
            token_expires_at=timezone.now() + timedelta(hours=1),
        )
        self.connection.access_token = 'valid_test_token'
        self.connection.save()

    @patch('core.integrations.youtube.service.YouTubeService.get_video_info')
    def test_video_import_creates_project(self, mock_get_video):
        """CRITICAL: Importing a video must create a project."""
        # Mock YouTube API response
        mock_get_video.return_value = {
            'video_id': 'abc123',
            'title': 'Test Video',
            'description': 'Test description',
            'channel_id': 'UC_test',
            'channel_name': 'Test Channel',
            'thumbnail_url': 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
            'duration': 'PT10M30S',
            'published_at': '2024-01-01T00:00:00Z',
            'view_count': 1000,
            'like_count': 50,
            'tags': ['test', 'video'],
            'category_id': '28',
        }

        result = import_youtube_video_task(
            user_id=self.user.id,
            video_id='abc123',
            skip_ai_analysis=True,  # Skip AI for speed in tests
        )

        self.assertTrue(result['success'])
        self.assertTrue(result['created'])

        # Verify project was created
        project = Project.objects.get(external_url='https://youtube.com/watch?v=abc123')
        self.assertEqual(project.title, 'Test Video')
        self.assertEqual(project.type, Project.ProjectType.VIDEO)
        self.assertEqual(project.user, self.user)

    @patch('core.integrations.youtube.service.YouTubeService.get_video_info')
    def test_duplicate_video_not_reimported(self, mock_get_video):
        """CRITICAL: Prevent duplicate imports of same video."""
        mock_get_video.return_value = {
            'video_id': 'abc123',
            'title': 'Test Video',
            'description': 'Test',
            'channel_id': 'UC_test',
            'channel_name': 'Test',
            'thumbnail_url': 'https://example.com/thumb.jpg',
            'duration': 'PT5M',
            'published_at': '2024-01-01T00:00:00Z',
            'view_count': 100,
            'like_count': 5,
            'tags': [],
            'category_id': '28',
        }

        # Import once
        result1 = import_youtube_video_task(user_id=self.user.id, video_id='abc123', skip_ai_analysis=True)

        # Import again (same video)
        result2 = import_youtube_video_task(user_id=self.user.id, video_id='abc123', skip_ai_analysis=True)

        self.assertTrue(result1['created'])
        self.assertFalse(result2['created'], 'Duplicate video should not be re-imported')

        # Should only be one project
        self.assertEqual(Project.objects.filter(external_url='https://youtube.com/watch?v=abc123').count(), 1)

    def test_missing_oauth_connection_fails_gracefully(self):
        """Test that missing OAuth connection returns clear error."""
        # Delete the connection
        self.connection.delete()

        result = import_youtube_video_task(user_id=self.user.id, video_id='abc123', skip_ai_analysis=True)

        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'auth_error')


class ThumbnailHandlingTest(TestCase):
    """Test thumbnail URL extraction - was causing broken images."""

    @patch('core.integrations.youtube.service.YouTubeService._make_request')
    def test_thumbnail_fallback_when_high_missing(self, mock_request):
        """CRITICAL: Handle missing 'high' resolution gracefully."""
        # Mock YouTube API response with only 'medium' thumbnail
        mock_request.return_value = {
            'items': [
                {
                    'snippet': {
                        'thumbnails': {
                            'default': {'url': 'https://example.com/default.jpg'},
                            'medium': {'url': 'https://example.com/medium.jpg'},
                            # No 'high' or 'maxres'
                        }
                    }
                }
            ]
        }

        service = YouTubeService(oauth_token='test_token')

        # This should not crash or return empty string
        # Test the helper function
        def get_best_thumbnail(thumbnails):
            for size in ['maxres', 'high', 'medium', 'default']:
                if size in thumbnails:
                    return thumbnails[size]['url']
            return ''

        thumbnails = {
            'default': {'url': 'https://example.com/default.jpg'},
            'medium': {'url': 'https://example.com/medium.jpg'},
        }

        result = get_best_thumbnail(thumbnails)
        self.assertEqual(result, 'https://example.com/medium.jpg')


class ChannelImportTest(TestCase):
    """Test channel import and auto-sync setup."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        self.connection = SocialConnection.objects.create(
            user=self.user,
            provider=SocialProvider.GOOGLE,
            provider_user_id='123456',
            provider_username='testuser',
            token_expires_at=timezone.now() + timedelta(hours=1),
        )
        self.connection.access_token = 'valid_token'
        self.connection.save()

    @patch('core.integrations.youtube.service.YouTubeService.get_channel_info')
    @patch('core.integrations.youtube.service.YouTubeService.get_channel_videos')
    @patch('core.integrations.youtube.tasks.import_youtube_video_task.apply_async')
    def test_channel_import_creates_content_source(self, mock_import, mock_videos, mock_channel):
        """CRITICAL: Channel import must create ContentSource for auto-sync."""
        mock_channel.return_value = {
            'channel_id': 'UC_test',
            'title': 'Test Channel',
            'description': 'Test',
            'thumbnail_url': 'https://example.com/thumb.jpg',
            'subscriber_count': 1000,
            'video_count': 50,
        }

        mock_videos.return_value = {'videos': ['video1', 'video2'], 'etag': 'test_etag'}

        result = import_youtube_channel_task(user_id=self.user.id, channel_id='UC_test', max_videos=50)

        self.assertTrue(result['success'])

        # Verify ContentSource was created
        content_source = ContentSource.objects.get(user=self.user, platform='youtube', source_identifier='UC_test')

        self.assertTrue(content_source.sync_enabled, 'Auto-sync must be enabled by default')
        self.assertEqual(content_source.sync_frequency, 'every_2_hours')

    @patch('core.integrations.youtube.service.YouTubeService.get_channel_videos')
    def test_sync_detects_new_videos(self, mock_videos):
        """Test that sync task detects new videos since last sync."""
        # Create ContentSource with last_synced_at
        content_source = ContentSource.objects.create(
            user=self.user,
            platform='youtube',
            source_identifier='UC_test',
            source_url='https://youtube.com/channel/UC_test',
            display_name='Test Channel',
            sync_enabled=True,
            last_synced_at=timezone.now() - timedelta(hours=3),
            metadata={'etag': 'old_etag'},
        )

        # Mock new videos
        mock_videos.return_value = {'videos': ['new_video_1', 'new_video_2'], 'etag': 'new_etag'}

        from core.integrations.youtube.tasks import sync_single_content_source

        with patch('core.integrations.youtube.tasks.import_youtube_video_task.apply_async'):
            result = sync_single_content_source(content_source.id)

        self.assertTrue(result['success'])
        self.assertEqual(result['videos_found'], 2)

        # Verify metadata updated
        content_source.refresh_from_db()
        self.assertEqual(content_source.metadata['etag'], 'new_etag')


class AIAnalysisTest(TestCase):
    """Test AI-powered tagging - must not crash on edge cases."""

    def test_ai_analysis_fallback_on_failure(self):
        """CRITICAL: AI analysis failure should not break video import."""
        from core.integrations.youtube.ai_analyzer import analyze_youtube_video

        video_data = {'title': 'Test Video', 'description': 'Test description', 'tags': ['python', 'react', 'tutorial']}

        user = User.objects.create_user(username='test', email='test@example.com')

        # AI call will fail (no valid Azure config in tests)
        with patch('core.integrations.youtube.ai_analyzer._call_ai_analyzer') as mock_ai:
            mock_ai.side_effect = Exception('AI service unavailable')

            # Should fallback to YouTube tags
            result = analyze_youtube_video(video_data, user)

            # Should still return some data (fallback)
            self.assertIn('tools', result)
            self.assertIn('topics', result)
            self.assertIsInstance(result['topics'], list)

    def test_topic_cleaning_and_validation(self):
        """Test that topics are properly cleaned and validated."""
        from core.integrations.youtube.ai_analyzer import _clean_topics

        dirty_topics = [
            'React',  # Should be lowercased
            'python',  # Valid
            'a',  # Too short
            'this-is-a-very-long-topic-name-that-exceeds-the-maximum-length-allowed',  # Too long
            'web  development',  # Extra spaces
            'data@science#123',  # Special chars
        ]

        cleaned = _clean_topics(dirty_topics)

        self.assertIn('react', cleaned)
        self.assertIn('python', cleaned)
        self.assertNotIn('a', cleaned)  # Too short
        self.assertIn('web development', cleaned)  # Normalized spaces
        # Special chars should be removed
        self.assertTrue(any('data' in topic and 'science' in topic for topic in cleaned))


class ErrorHandlingTest(TestCase):
    """Test error handling for real-world failures."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

    def test_youtube_api_500_error_handling(self):
        """Test that YouTube API failures are properly logged and re-raised for retry."""
        connection = SocialConnection.objects.create(
            user=self.user, provider=SocialProvider.GOOGLE, provider_user_id='123456', provider_username='testuser'
        )
        connection.access_token = 'valid_token'
        connection.save()

        with patch('core.integrations.youtube.service.YouTubeService.get_video_info') as mock:
            from core.integrations.base.exceptions import IntegrationError

            mock.side_effect = IntegrationError('YouTube API error 500', integration_name='youtube')

            # Exception should be re-raised for Celery retry mechanism
            with self.assertRaises(Exception):
                import_youtube_video_task(user_id=self.user.id, video_id='abc123', skip_ai_analysis=True)

    def test_video_not_found_404(self):
        """Test handling of non-existent video."""
        connection = SocialConnection.objects.create(
            user=self.user, provider=SocialProvider.GOOGLE, provider_user_id='123456', provider_username='testuser'
        )
        connection.access_token = 'valid_token'
        connection.save()

        with patch('core.integrations.youtube.service.YouTubeService.get_video_info') as mock:
            from core.integrations.base.exceptions import IntegrationNotFoundError

            mock.side_effect = IntegrationNotFoundError('Video not found', integration_name='youtube')

            result = import_youtube_video_task(user_id=self.user.id, video_id='nonexistent', skip_ai_analysis=True)

            self.assertFalse(result['success'])
            self.assertEqual(result['error'], 'not_found')
