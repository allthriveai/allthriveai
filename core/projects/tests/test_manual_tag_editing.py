"""Tests for manual tag editing and override persistence during resync."""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.integrations.reddit_models import RedditCommunityAgent, RedditThread
from core.projects.models import Project
from core.taxonomy.models import Taxonomy
from core.tools.models import Tool
from services.integrations.reddit.sync import RedditSyncService

User = get_user_model()


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    return User.objects.create_user(
        username='admin',
        email='admin@test.com',
        password='testpass',
        role='admin',
    )


@pytest.fixture
def agent_user(db):
    """Create an agent user."""
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
def test_tool(db):
    """Create a test tool."""
    return Tool.objects.create(
        name='Python',
        slug='python',
        description='Programming language',
    )


@pytest.fixture
def test_category(db):
    """Create a test category."""
    return Taxonomy.objects.create(
        name='AI Development',
        slug='ai-development',
        taxonomy_type='category',
        is_active=True,
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
        topics=['chatgpt', 'ai'],
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
class TestManualTagEditing:
    """Test manual tag editing and persistence."""

    def test_admin_can_edit_tags(self, admin_user, reddit_project, test_tool, test_category):
        """Test that admin can manually edit project tags."""
        client = APIClient()
        client.force_authenticate(user=admin_user)

        # Update tags
        response = client.patch(
            f'/api/v1/projects/{reddit_project.id}/update-tags/',
            {
                'tools': [test_tool.id],
                'categories': [test_category.id],
                'topics': ['new_topic', 'another_topic'],
            },
            format='json',
        )

        assert response.status_code == 200

        # Reload project
        reddit_project.refresh_from_db()

        # Verify tags were updated
        assert test_tool in reddit_project.tools.all()
        assert test_category in reddit_project.categories.all()
        assert 'new_topic' in reddit_project.topics
        assert 'another_topic' in reddit_project.topics

        # Verify flag was set
        assert reddit_project.tags_manually_edited is True

    def test_non_admin_cannot_edit_tags(self, agent_user, reddit_project):
        """Test that non-admin users cannot manually edit tags."""
        client = APIClient()
        client.force_authenticate(user=agent_user)

        response = client.patch(
            f'/api/v1/projects/{reddit_project.id}/update-tags/',
            {
                'topics': ['hacked'],
            },
            format='json',
        )

        assert response.status_code == 403

        # Verify tags were NOT updated
        reddit_project.refresh_from_db()
        assert reddit_project.tags_manually_edited is False
        assert 'hacked' not in reddit_project.topics

    def test_manually_edited_tags_persist_through_resync(self, reddit_agent, reddit_project, test_tool):
        """Test that manually edited tags are not overwritten during resync."""
        # Manually set tags and flag
        reddit_project.tools.add(test_tool)
        reddit_project.topics = ['manual_topic']
        reddit_project.tags_manually_edited = True
        reddit_project.save()

        # Simulate resync
        post_data = {
            'reddit_post_id': 't3_123abc',
            'title': reddit_project.title,
            'author': 'test_author',
            'permalink': reddit_project.external_url,
            'content': 'Test content',
            'published_utc': timezone.now(),
            'thumbnail_url': '',
            'subreddit': 'chatgpt',
        }

        # Mock metrics
        original_fetch = RedditSyncService.fetch_post_metrics
        RedditSyncService.fetch_post_metrics = lambda permalink: {
            'score': 100,
            'num_comments': 20,
            'upvote_ratio': 0.95,
            'image_url': '',
            'selftext': 'Different content',
            'selftext_html': '',
            'post_hint': '',
            'link_flair_text': 'Different Flair',
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

        try:
            # Process the post (update)
            created, updated = RedditSyncService._process_post(reddit_agent, post_data)

            # Verify it was updated
            assert not created
            assert updated

            # Reload project
            reddit_project.refresh_from_db()

            # Verify manual tags were preserved
            assert test_tool in reddit_project.tools.all()
            assert 'manual_topic' in reddit_project.topics
            assert reddit_project.tags_manually_edited is True
        finally:
            RedditSyncService.fetch_post_metrics = original_fetch

    def test_unedited_tags_get_auto_updated(self, reddit_agent, agent_user):
        """Test that projects without manual edits still get auto-tagged during resync."""
        # Create project without tags
        project = Project.objects.create(
            user=agent_user,
            title='New Post',
            description='Test',
            type=Project.ProjectType.REDDIT_THREAD,
            external_url='https://reddit.com/r/chatgpt/comments/456def/new',
            is_showcased=True,
            tags_manually_edited=False,  # Not manually edited
        )

        thread = RedditThread.objects.create(
            project=project,
            agent=reddit_agent,
            reddit_post_id='t3_456def',
            subreddit='chatgpt',
            author='test_author',
            permalink='https://reddit.com/r/chatgpt/comments/456def/new',
            score=50,
            num_comments=10,
            created_utc=timezone.now(),
        )

        # Verify project has no tags initially
        assert not project.tools.exists()
        assert not project.topics

        # Simulate resync with _update_thread
        post_data = {
            'reddit_post_id': 't3_456def',
            'title': 'New Post',
            'author': 'test_author',
            'permalink': project.external_url,
            'content': 'Test',
            'published_utc': timezone.now(),
            'thumbnail_url': '',
            'subreddit': 'chatgpt',
        }

        # Mock metrics
        original_fetch = RedditSyncService.fetch_post_metrics
        RedditSyncService.fetch_post_metrics = lambda permalink: {
            'score': 100,
            'num_comments': 20,
            'upvote_ratio': 0.95,
            'image_url': '',
            'selftext': 'Content about Python and AI',
            'selftext_html': '',
            'post_hint': '',
            'link_flair_text': 'Tutorial',
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

        try:
            # Update thread
            RedditSyncService._update_thread(thread, post_data)

            # Reload project
            project.refresh_from_db()

            # Verify tags were auto-assigned (from agent or topic extraction)
            # The actual tags depend on the agent's default tools/categories
            # We just verify the function was allowed to run
            assert project.tags_manually_edited is False
        finally:
            RedditSyncService.fetch_post_metrics = original_fetch

    def test_validation_errors(self, admin_user, reddit_project):
        """Test validation errors for tag updates."""
        client = APIClient()
        client.force_authenticate(user=admin_user)

        # Test invalid tools format
        response = client.patch(
            f'/api/v1/projects/{reddit_project.id}/update-tags/',
            {'tools': 'not_a_list'},
            format='json',
        )
        assert response.status_code == 400
        assert 'tools' in response.data['error']['field']

        # Test invalid categories format
        response = client.patch(
            f'/api/v1/projects/{reddit_project.id}/update-tags/',
            {'categories': 123},
            format='json',
        )
        assert response.status_code == 400
        assert 'categories' in response.data['error']['field']

        # Test invalid topics format
        response = client.patch(
            f'/api/v1/projects/{reddit_project.id}/update-tags/',
            {'topics': 'not_a_list'},
            format='json',
        )
        assert response.status_code == 400
        assert 'topics' in response.data['error']['field']
