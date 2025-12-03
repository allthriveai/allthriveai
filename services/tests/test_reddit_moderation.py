"""
Tests for Reddit content moderation in sync service.
"""

from unittest.mock import MagicMock, patch

import pytest

from services.integrations.reddit.sync import RedditSyncService


class TestRedditContentModeration:
    """Test Reddit content moderation functionality."""

    @patch('services.reddit_sync_service.ContentModerator')
    @patch('services.reddit_sync_service.ImageModerator')
    def test_moderate_content_text_approved(self, mock_image_moderator, mock_text_moderator):
        """Test that clean text content is approved."""
        # Mock text moderation - approved
        mock_text_moderator.return_value.moderate.return_value = {
            'approved': True,
            'flagged': False,
            'reason': 'Content approved',
            'categories': {},
            'confidence': 0.0,
        }

        # Mock image moderation - no image
        mock_image_moderator.return_value.moderate_image.return_value = {
            'approved': True,
            'flagged': False,
            'reason': 'No image provided',
            'categories': {},
            'confidence': 0.0,
        }

        approved, reason, moderation_data = RedditSyncService._moderate_content(
            title='Great AI tool for coding',
            selftext='This is a helpful discussion about AI',
            image_url='',
            subreddit='ChatGPT',
        )

        assert approved is True
        assert reason == 'Content approved'
        assert 'text' in moderation_data

    @patch('services.reddit_sync_service.ContentModerator')
    def test_moderate_content_text_rejected(self, mock_text_moderator):
        """Test that inappropriate text content is rejected."""
        # Mock text moderation - rejected
        mock_text_moderator.return_value.moderate.return_value = {
            'approved': False,
            'flagged': True,
            'reason': 'Content flagged: contains hate speech',
            'categories': {'hate': 0.95},
            'confidence': 0.95,
        }

        approved, reason, moderation_data = RedditSyncService._moderate_content(
            title='Inappropriate content',
            selftext='Contains hate speech and offensive language',
            image_url='',
            subreddit='ChatGPT',
        )

        assert approved is False
        assert 'hate speech' in reason
        assert 'text' in moderation_data

    @patch('services.reddit_sync_service.ContentModerator')
    @patch('services.reddit_sync_service.ImageModerator')
    def test_moderate_content_image_rejected(self, mock_image_moderator, mock_text_moderator):
        """Test that inappropriate images are rejected."""
        # Mock text moderation - approved
        mock_text_moderator.return_value.moderate.return_value = {
            'approved': True,
            'flagged': False,
            'reason': 'Content approved',
            'categories': {},
            'confidence': 0.0,
        }

        # Mock image moderation - rejected
        mock_image_moderator.return_value.moderate_image.return_value = {
            'approved': False,
            'flagged': True,
            'reason': 'Image flagged: contains explicit or sexual content',
            'categories': {'explicit': 0.9},
            'confidence': 0.9,
        }

        approved, reason, moderation_data = RedditSyncService._moderate_content(
            title='Some post',
            selftext='Clean text content',
            image_url='https://example.com/inappropriate-image.jpg',
            subreddit='ChatGPT',
        )

        assert approved is False
        assert 'explicit' in reason.lower() or 'sexual' in reason.lower()
        assert 'image' in moderation_data

    @patch('services.reddit_sync_service.ContentModerator')
    @patch('services.reddit_sync_service.ImageModerator')
    def test_moderate_content_both_approved(self, mock_image_moderator, mock_text_moderator):
        """Test that clean text and image content is approved."""
        # Mock text moderation - approved
        mock_text_moderator.return_value.moderate.return_value = {
            'approved': True,
            'flagged': False,
            'reason': 'Content approved',
            'categories': {},
            'confidence': 0.0,
        }

        # Mock image moderation - approved
        mock_image_moderator.return_value.moderate_image.return_value = {
            'approved': True,
            'flagged': False,
            'reason': 'Image approved',
            'categories': {},
            'confidence': 0.0,
        }

        approved, reason, moderation_data = RedditSyncService._moderate_content(
            title='Helpful coding assistant',
            selftext='Discussion about ChatGPT for programming',
            image_url='https://example.com/screenshot.png',
            subreddit='ChatGPT',
        )

        assert approved is True
        assert reason == 'Content approved'
        assert 'text' in moderation_data
        assert 'image' in moderation_data


@pytest.mark.django_db
class TestRedditThreadCreationWithModeration:
    """Test Reddit thread creation with moderation checks."""

    @patch('services.reddit_sync_service.RedditSyncService.fetch_post_metrics')
    @patch('services.reddit_sync_service.ContentModerator')
    def test_create_thread_skips_nsfw_content(self, mock_text_moderator, mock_fetch_metrics):
        """Test that NSFW content marked by Reddit is skipped."""
        mock_fetch_metrics.return_value = {
            'score': 100,
            'num_comments': 50,
            'over_18': True,  # NSFW content
            'image_url': '',
            'selftext': '',
            'selftext_html': '',
            'post_hint': '',
            'link_flair_text': '',
            'link_flair_background_color': '',
            'is_video': False,
            'video_url': '',
            'video_duration': 0,
            'is_gallery': False,
            'gallery_images': [],
            'domain': '',
            'url': '',
            'spoiler': False,
            'upvote_ratio': 0.95,
        }

        # Create a mock bot
        bot = MagicMock()
        bot.settings = {'min_score': 10}

        post_data = {
            'reddit_post_id': 't3_test123',
            'title': 'Test Post',
            'author': 'testuser',
            'permalink': 'https://reddit.com/r/test/comments/test123',
            'content': 'Test content',
            'published_utc': None,
            'thumbnail_url': '',
            'subreddit': 'test',
        }

        # Should return early without creating thread
        result = RedditSyncService._create_thread(bot, post_data)

        # Verify it was skipped (no thread created)
        assert result is None
        # Text moderation should not be called for NSFW content
        mock_text_moderator.return_value.moderate.assert_not_called()
