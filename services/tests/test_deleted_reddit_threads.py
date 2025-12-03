"""Tests for deleted Reddit thread tracking to prevent resync recreation."""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from core.integrations.reddit_models import (
    DeletedRedditThread,
    RedditCommunityAgent,
    RedditThread,
)
from core.projects.models import Project
from services.integrations.reddit.sync import RedditSyncService

User = get_user_model()


@pytest.fixture
def admin_user(db):
    """Create an admin user for testing."""
    return User.objects.create_user(
        username='admin',
        email='admin@test.com',
        password='testpass',
        role='admin',
    )


@pytest.fixture
def agent_user(db):
    """Create an agent user for testing."""
    return User.objects.create_user(
        username='chatgpt-reddit-agent',
        email='agent@test.com',
        password='testpass',
        role='agent',
    )


@pytest.fixture
def reddit_agent(agent_user):
    """Create a Reddit community agent."""
    return RedditCommunityAgent.objects.create(
        agent_user=agent_user,
        name='ChatGPT Reddit Agent',
        subreddit='chatgpt',
        status=RedditCommunityAgent.Status.ACTIVE,
        settings={'min_score': 10},
    )


@pytest.fixture
def reddit_project(agent_user, reddit_agent):
    """Create a Reddit thread project."""
    project = Project.objects.create(
        user=agent_user,
        title='Test Reddit Post',
        description='Test description',
        type=Project.ProjectType.REDDIT_THREAD,
        external_url='https://reddit.com/r/chatgpt/comments/123abc/test',
        is_showcased=True,
    )

    RedditThread.objects.create(
        project=project,
        agent=reddit_agent,
        reddit_post_id='t3_123abc',
        subreddit='chatgpt',
        author='test_author',
        permalink='https://reddit.com/r/chatgpt/comments/123abc/test',
        score=50,
        num_comments=10,
        created_utc=timezone.now(),
    )

    return project


@pytest.mark.django_db
class TestDeletedRedditThreadTracking:
    """Test that deleted Reddit threads are tracked and not recreated."""

    def test_deleting_reddit_project_creates_deletion_record(self, reddit_project, admin_user):
        """Test that deleting a Reddit project creates a DeletedRedditThread record."""
        thread = reddit_project.reddit_thread
        reddit_post_id = thread.reddit_post_id
        agent = thread.agent
        subreddit = thread.subreddit

        # Import here to avoid circular imports
        from core.projects.views import ProjectViewSet

        # Create a mock request
        class MockRequest:
            def __init__(self, user):
                self.user = user

        # Delete the project
        viewset = ProjectViewSet()
        viewset.request = MockRequest(admin_user)
        viewset._record_reddit_thread_deletion(reddit_project, admin_user)

        # Check that deletion record was created
        deleted_record = DeletedRedditThread.objects.filter(reddit_post_id=reddit_post_id).first()
        assert deleted_record is not None
        assert deleted_record.agent == agent
        assert deleted_record.subreddit == subreddit
        assert deleted_record.deleted_by == admin_user
        assert 'admin' in deleted_record.deletion_reason.lower()

    def test_sync_skips_deleted_threads(self, reddit_agent, admin_user):
        """Test that sync service skips posts that have been deleted by admin."""
        # Create a deletion record
        deleted_post_id = 't3_deleted123'
        DeletedRedditThread.objects.create(
            reddit_post_id=deleted_post_id,
            agent=reddit_agent,
            subreddit='chatgpt',
            deleted_by=admin_user,
            deletion_reason='Spam post',
        )

        # Simulate processing a post with the same ID
        post_data = {
            'reddit_post_id': deleted_post_id,
            'title': 'This post was deleted',
            'author': 'test_author',
            'permalink': 'https://reddit.com/r/chatgpt/comments/deleted123/test',
            'content': 'Test content',
            'published_utc': timezone.now(),
            'thumbnail_url': '',
            'subreddit': 'chatgpt',
        }

        # Process the post
        created, updated = RedditSyncService._process_post(reddit_agent, post_data)

        # Verify that the post was NOT created or updated
        assert not created
        assert not updated

        # Verify that no project or thread was created
        assert not RedditThread.objects.filter(reddit_post_id=deleted_post_id).exists()
        assert not Project.objects.filter(external_url__contains=deleted_post_id).exists()

    def test_sync_allows_new_threads(self, reddit_agent):
        """Test that sync service still processes new threads that weren't deleted."""
        new_post_id = 't3_newpost456'

        # Ensure no deletion record exists
        assert not DeletedRedditThread.objects.filter(reddit_post_id=new_post_id).exists()

        post_data = {
            'reddit_post_id': new_post_id,
            'title': 'New Reddit Post',
            'author': 'test_author',
            'permalink': 'https://reddit.com/r/chatgpt/comments/newpost456/test',
            'content': 'Test content',
            'published_utc': timezone.now(),
            'thumbnail_url': '',
            'subreddit': 'chatgpt',
        }

        # Mock the fetch_post_metrics to avoid actual HTTP requests
        original_fetch = RedditSyncService.fetch_post_metrics
        RedditSyncService.fetch_post_metrics = lambda permalink: {
            'score': 100,
            'num_comments': 20,
            'upvote_ratio': 0.95,
            'image_url': '',
            'selftext': 'Post body',
            'selftext_html': '',
            'post_hint': '',
            'link_flair_text': '',
            'link_flair_background_color': '',
            'is_video': False,
            'video_url': '',
            'video_duration': 0,
            'is_gallery': False,
            'gallery_images': [],
            'domain': 'reddit.com',
            'url': '',
            'over_18': False,
            'spoiler': False,
        }

        # Mock moderation to approve
        original_moderate = RedditSyncService._moderate_content
        RedditSyncService._moderate_content = lambda *args, **kwargs: (True, 'Approved', {})

        try:
            # Process the post
            created, updated = RedditSyncService._process_post(reddit_agent, post_data)

            # Verify that the post WAS created
            assert created
            assert not updated

            # Verify that project and thread were created
            assert RedditThread.objects.filter(reddit_post_id=new_post_id).exists()
        finally:
            # Restore original methods
            RedditSyncService.fetch_post_metrics = original_fetch
            RedditSyncService._moderate_content = original_moderate

    def test_deletion_record_prevents_multiple_creations(self, reddit_agent, admin_user):
        """Test that a deletion record persists and prevents recreation across multiple syncs."""
        deleted_post_id = 't3_persistent123'

        # Create deletion record
        DeletedRedditThread.objects.create(
            reddit_post_id=deleted_post_id,
            agent=reddit_agent,
            subreddit='chatgpt',
            deleted_by=admin_user,
            deletion_reason='Inappropriate content',
        )

        post_data = {
            'reddit_post_id': deleted_post_id,
            'title': 'Deleted Post',
            'author': 'test_author',
            'permalink': 'https://reddit.com/r/chatgpt/comments/persistent123/test',
            'content': 'Test content',
            'published_utc': timezone.now(),
            'thumbnail_url': '',
            'subreddit': 'chatgpt',
        }

        # Try to process the post multiple times (simulating multiple syncs)
        for _ in range(3):
            created, updated = RedditSyncService._process_post(reddit_agent, post_data)
            assert not created
            assert not updated

        # Verify that no project was created after multiple attempts
        assert not RedditThread.objects.filter(reddit_post_id=deleted_post_id).exists()

        # Verify deletion record still exists
        assert DeletedRedditThread.objects.filter(reddit_post_id=deleted_post_id).exists()

    def test_bulk_delete_records_all_reddit_threads(self, reddit_agent, agent_user, admin_user):
        """Test that bulk delete records all Reddit thread deletions."""
        # Create multiple Reddit projects
        projects = []
        for i in range(3):
            project = Project.objects.create(
                user=agent_user,
                title=f'Test Post {i}',
                description='Test',
                type=Project.ProjectType.REDDIT_THREAD,
                external_url=f'https://reddit.com/r/chatgpt/comments/{i}/test',
                is_showcased=True,
            )

            RedditThread.objects.create(
                project=project,
                agent=reddit_agent,
                reddit_post_id=f't3_test{i}',
                subreddit='chatgpt',
                author='test_author',
                permalink=f'https://reddit.com/r/chatgpt/comments/{i}/test',
                score=50,
                num_comments=10,
                created_utc=timezone.now(),
            )
            projects.append(project)

        # Import viewset
        from core.projects.views import ProjectViewSet

        class MockRequest:
            def __init__(self, user):
                self.user = user

        # Delete all projects
        viewset = ProjectViewSet()
        viewset.request = MockRequest(admin_user)

        for project in projects:
            viewset._record_reddit_thread_deletion(project, admin_user)

        # Verify all deletion records were created
        for i in range(3):
            assert DeletedRedditThread.objects.filter(reddit_post_id=f't3_test{i}').exists()

    def test_moderation_failure_tracked(self, reddit_agent):
        """Test that posts failing moderation are tracked to prevent re-attempts."""
        failed_post_id = 't3_badpost123'

        post_data = {
            'reddit_post_id': failed_post_id,
            'title': 'This post will fail moderation',
            'author': 'test_author',
            'permalink': 'https://reddit.com/r/chatgpt/comments/badpost123/test',
            'content': 'Inappropriate content',
            'published_utc': timezone.now(),
            'thumbnail_url': '',
            'subreddit': 'chatgpt',
        }

        # Mock fetch_post_metrics
        original_fetch = RedditSyncService.fetch_post_metrics
        RedditSyncService.fetch_post_metrics = lambda permalink: {
            'score': 100,
            'num_comments': 20,
            'upvote_ratio': 0.95,
            'image_url': '',
            'selftext': 'Bad content',
            'selftext_html': '',
            'post_hint': '',
            'link_flair_text': '',
            'link_flair_background_color': '',
            'is_video': False,
            'video_url': '',
            'video_duration': 0,
            'is_gallery': False,
            'gallery_images': [],
            'domain': 'reddit.com',
            'url': '',
            'over_18': False,
            'spoiler': False,
        }

        # Mock moderation to reject
        original_moderate = RedditSyncService._moderate_content
        RedditSyncService._moderate_content = lambda *args, **kwargs: (
            False,
            'Inappropriate content detected',
            {'text': {'approved': False, 'reason': 'Policy violation'}},
        )

        try:
            # Process the post - should fail moderation
            created, updated = RedditSyncService._process_post(reddit_agent, post_data)

            # Verify the post was NOT created
            assert not created
            assert not updated

            # Verify deletion record was created with moderation_failed type
            deletion_record = DeletedRedditThread.objects.filter(reddit_post_id=failed_post_id).first()
            assert deletion_record is not None
            assert deletion_record.deletion_type == DeletedRedditThread.DeletionType.MODERATION_FAILED
            assert 'Failed moderation' in deletion_record.deletion_reason
            assert deletion_record.deleted_by is None  # System rejection, not admin

            # Verify project was not created
            assert not RedditThread.objects.filter(reddit_post_id=failed_post_id).exists()
        finally:
            # Restore original methods
            RedditSyncService.fetch_post_metrics = original_fetch
            RedditSyncService._moderate_content = original_moderate

    def test_moderation_failure_prevents_retry(self, reddit_agent):
        """Test that moderation failures prevent re-attempts on subsequent syncs."""
        failed_post_id = 't3_persistent_fail'

        # Manually create a moderation failure record
        DeletedRedditThread.objects.create(
            reddit_post_id=failed_post_id,
            agent=reddit_agent,
            subreddit='chatgpt',
            deleted_by=None,
            deletion_type=DeletedRedditThread.DeletionType.MODERATION_FAILED,
            deletion_reason='Failed moderation: Spam content',
        )

        post_data = {
            'reddit_post_id': failed_post_id,
            'title': 'Previously failed post',
            'author': 'test_author',
            'permalink': 'https://reddit.com/r/chatgpt/comments/persistent_fail/test',
            'content': 'Content',
            'published_utc': timezone.now(),
            'thumbnail_url': '',
            'subreddit': 'chatgpt',
        }

        # Try to process the post - should be skipped due to existing deletion record
        created, updated = RedditSyncService._process_post(reddit_agent, post_data)

        # Verify it was skipped
        assert not created
        assert not updated

        # Verify no thread was created
        assert not RedditThread.objects.filter(reddit_post_id=failed_post_id).exists()

    def test_admin_deletion_vs_moderation_failure(self, reddit_project, reddit_agent, admin_user):
        """Test that admin deletions and moderation failures are tracked with different types."""
        # Create an admin deletion
        from core.projects.views import ProjectViewSet

        class MockRequest:
            def __init__(self, user):
                self.user = user

        viewset = ProjectViewSet()
        viewset.request = MockRequest(admin_user)
        viewset._record_reddit_thread_deletion(reddit_project, admin_user)

        admin_deletion = DeletedRedditThread.objects.filter(
            reddit_post_id=reddit_project.reddit_thread.reddit_post_id
        ).first()

        # Create a moderation failure
        mod_fail_id = 't3_modfail'
        DeletedRedditThread.objects.create(
            reddit_post_id=mod_fail_id,
            agent=reddit_agent,
            subreddit='chatgpt',
            deleted_by=None,
            deletion_type=DeletedRedditThread.DeletionType.MODERATION_FAILED,
            deletion_reason='Failed moderation: Inappropriate',
        )

        mod_failure = DeletedRedditThread.objects.filter(reddit_post_id=mod_fail_id).first()

        # Verify they have different types
        assert admin_deletion.deletion_type == DeletedRedditThread.DeletionType.ADMIN_DELETED
        assert admin_deletion.deleted_by == admin_user

        assert mod_failure.deletion_type == DeletedRedditThread.DeletionType.MODERATION_FAILED
        assert mod_failure.deleted_by is None
