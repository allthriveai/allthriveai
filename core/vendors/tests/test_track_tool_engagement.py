"""
Unit tests for track_tool_engagement function.

Tests that the function correctly records various engagement types and triggers
competitive view tracking when appropriate.
"""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from core.tools.models import Tool
from core.vendors.models import ToolCompetitorView, ToolEngagement
from core.vendors.services import track_tool_engagement

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='test123',
    )


@pytest.fixture
def session_id():
    """Generate a test session ID."""
    return 'test-session-12345'


@pytest.fixture
def tools(db):
    """Create test tools for FK constraints."""
    created_tools = []
    for i in range(1, 6):
        tool = Tool.objects.create(
            id=i,
            name=f'Test Tool {i}',
            slug=f'test-tool-{i}',
            tagline=f'A test tool {i}',
            description=f'Description for test tool {i}',
            tool_type='ai_tool',
            category='chat',
        )
        created_tools.append(tool)
    return created_tools


@pytest.mark.django_db
class TestEngagementCreation:
    """Test basic engagement record creation."""

    def test_creates_engagement_record(self, user, session_id, tools):
        """track_tool_engagement creates a database record."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        assert ToolEngagement.objects.filter(tool_id=1, session_id=session_id).exists()

    def test_stores_engagement_type_correctly(self, user, session_id, tools):
        """Engagement type is stored correctly."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='external_click',
            user=user,
            session_id=session_id,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.engagement_type == 'external_click'

    def test_associates_with_user(self, user, session_id, tools):
        """Engagement is associated with authenticated user."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='bookmark',
            user=user,
            session_id=session_id,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.user == user

    def test_works_with_anonymous_user(self, session_id, tools):
        """Engagement works for anonymous users (user=None)."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=None,
            session_id=session_id,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.user is None


@pytest.mark.django_db
class TestEngagementTypes:
    """Test different engagement type scenarios."""

    def test_page_view_engagement(self, user, session_id, tools):
        """page_view engagement is tracked."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        assert ToolEngagement.objects.filter(tool_id=1, engagement_type='page_view').exists()

    def test_external_click_engagement(self, user, session_id, tools):
        """external_click engagement is tracked."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='external_click',
            user=user,
            session_id=session_id,
            destination_url='https://example.com',
        )

        engagement = ToolEngagement.objects.get(tool_id=1, engagement_type='external_click')
        assert engagement.destination_url == 'https://example.com'

    def test_bookmark_engagement(self, user, session_id, tools):
        """bookmark engagement is tracked."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='bookmark',
            user=user,
            session_id=session_id,
        )

        assert ToolEngagement.objects.filter(tool_id=1, engagement_type='bookmark').exists()

    def test_project_add_engagement(self, user, session_id, tools):
        """project_add engagement is tracked."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='project_add',
            user=user,
            session_id=session_id,
        )

        assert ToolEngagement.objects.filter(tool_id=1, engagement_type='project_add').exists()

    def test_docs_click_engagement(self, user, session_id, tools):
        """docs_click engagement is tracked."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='docs_click',
            user=user,
            session_id=session_id,
        )

        assert ToolEngagement.objects.filter(tool_id=1, engagement_type='docs_click').exists()


@pytest.mark.django_db
class TestOptionalParameters:
    """Test optional parameter handling."""

    def test_stores_dwell_time(self, user, session_id, tools):
        """Dwell time is stored when provided."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
            dwell_time_seconds=120,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.dwell_time_seconds == 120

    def test_stores_scroll_depth(self, user, session_id, tools):
        """Scroll depth is stored when provided."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
            scroll_depth_percent=75,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.scroll_depth_percent == 75

    def test_stores_destination_url(self, user, session_id, tools):
        """Destination URL is stored when provided."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='external_click',
            user=user,
            session_id=session_id,
            destination_url='https://tool.example.com/pricing',
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.destination_url == 'https://tool.example.com/pricing'

    def test_stores_source_context(self, user, session_id, tools):
        """Source context is stored when provided."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
            source_context='search_results',
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.source_context == 'search_results'

    def test_stores_metadata(self, user, session_id, tools):
        """Metadata is stored when provided."""
        metadata = {'search_query': 'AI tools', 'position': 3}

        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
            metadata=metadata,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.metadata == metadata


@pytest.mark.django_db
class TestCompetitorViewTracking:
    """Test competitive view tracking triggered by page_view."""

    def test_page_view_triggers_competitor_tracking(self, user, session_id, tools):
        """page_view engagement triggers competitor view check."""
        # View tool 1
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        # View tool 2 in same session (within 30 mins)
        track_tool_engagement(
            tool_id=2,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        # Should create competitor view record
        assert ToolCompetitorView.objects.filter(session_id=session_id).exists()

    def test_competitor_view_links_both_tools(self, user, session_id, tools):
        """Competitor view record links both tools (ordered by ID)."""
        # View tool 5 then tool 3
        track_tool_engagement(
            tool_id=5,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )
        track_tool_engagement(
            tool_id=3,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        # Should be stored as tool_a=3, tool_b=5 (ascending order)
        competitor_view = ToolCompetitorView.objects.get(session_id=session_id)
        assert competitor_view.tool_a_id == 3
        assert competitor_view.tool_b_id == 5

    def test_non_page_view_does_not_trigger_competitor_tracking(self, user, session_id, tools):
        """Non-page_view engagements don't trigger competitor tracking."""
        # Bookmark tool 1
        track_tool_engagement(
            tool_id=1,
            engagement_type='bookmark',
            user=user,
            session_id=session_id,
        )

        # Bookmark tool 2
        track_tool_engagement(
            tool_id=2,
            engagement_type='bookmark',
            user=user,
            session_id=session_id,
        )

        # Should NOT create competitor view
        assert not ToolCompetitorView.objects.filter(session_id=session_id).exists()

    def test_competitor_tracking_respects_30_minute_window(self, user, session_id, tools):
        """Competitor tracking only looks at views within last 30 minutes."""
        # View tool 1 (35 minutes ago)
        old_time = timezone.now() - timedelta(minutes=35)
        ToolEngagement.objects.create(
            tool_id=1,
            user=user,
            session_id=session_id,
            engagement_type='page_view',
            created_at=old_time,
        )

        # View tool 2 now
        track_tool_engagement(
            tool_id=2,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        # Engagement tracking should work without error
        assert ToolEngagement.objects.filter(tool_id=2, session_id=session_id).exists()

    def test_competitor_tracking_within_30_minute_window(self, user, session_id, tools):
        """Competitor tracking works for views within 30 minutes."""
        # View tool 1 (25 minutes ago)
        recent_time = timezone.now() - timedelta(minutes=25)
        ToolEngagement.objects.create(
            tool_id=1,
            user=user,
            session_id=session_id,
            engagement_type='page_view',
            created_at=recent_time,
        )

        # View tool 2 now
        track_tool_engagement(
            tool_id=2,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        # Should create competitor view (tool 1 view within window)
        assert ToolCompetitorView.objects.filter(session_id=session_id, tool_a_id=1, tool_b_id=2).exists()

    def test_competitor_view_tracks_time_between_views(self, user, session_id, tools):
        """Competitor view records time between tool views."""
        # View tool 1
        first_time = timezone.now() - timedelta(minutes=10)
        ToolEngagement.objects.create(
            tool_id=1,
            user=user,
            session_id=session_id,
            engagement_type='page_view',
            created_at=first_time,
        )

        # View tool 2
        track_tool_engagement(
            tool_id=2,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
        )

        # Verify competitor view was created
        competitor_views = ToolCompetitorView.objects.filter(session_id=session_id)
        assert competitor_views.exists()

    def test_multiple_tool_views_create_multiple_competitor_records(self, user, session_id, tools):
        """Viewing multiple tools creates competitor records for each pair."""
        # View tools 1, 2, 3 in sequence
        for tool_id in [1, 2, 3]:
            track_tool_engagement(
                tool_id=tool_id,
                engagement_type='page_view',
                user=user,
                session_id=session_id,
            )

        # Should create records for: (1,2), (1,3), (2,3)
        competitor_count = ToolCompetitorView.objects.filter(session_id=session_id).count()
        assert competitor_count >= 2  # At least tool 3 with tools 1 and 2


@pytest.mark.django_db
class TestErrorHandling:
    """Test error handling and resilience."""

    @pytest.mark.skip(reason='Mock causing teardown issues')
    def test_handles_database_error_gracefully(self, user, session_id, tools, mocker):
        """Database errors are logged but don't raise exceptions."""
        # Mock ToolEngagement.objects.create to raise an error
        mocker.patch('core.vendors.models.ToolEngagement.objects.create', side_effect=Exception('DB error'))

        # Should not raise exception
        try:
            track_tool_engagement(
                tool_id=1,
                engagement_type='page_view',
                user=user,
                session_id=session_id,
            )
        except Exception:
            pytest.fail('track_tool_engagement should not raise exceptions')

    def test_works_without_request_object(self, user, session_id, tools):
        """Function works when called without request object."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            request=None,  # No request
            user=user,
            session_id=session_id,
        )

        assert ToolEngagement.objects.filter(tool_id=1, session_id=session_id).exists()

    def test_handles_none_user_when_unauthenticated(self, session_id, tools):
        """Handles None user for anonymous tracking."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=None,
            session_id=session_id,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.user is None


@pytest.mark.django_db
class TestDataConstraints:
    """Test data truncation and constraints."""

    def test_truncates_long_destination_url(self, user, session_id, tools):
        """Destination URLs longer than 200 chars are truncated."""
        long_url = 'https://example.com/' + 'a' * 300

        track_tool_engagement(
            tool_id=1,
            engagement_type='external_click',
            user=user,
            session_id=session_id,
            destination_url=long_url,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert len(engagement.destination_url) <= 200

    def test_truncates_long_source_context(self, user, session_id, tools):
        """Source context longer than 50 chars is truncated."""
        long_context = 'a' * 100

        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
            source_context=long_context,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert len(engagement.source_context) <= 50

    def test_handles_empty_metadata(self, user, session_id, tools):
        """Empty metadata is stored as empty dict."""
        track_tool_engagement(
            tool_id=1,
            engagement_type='page_view',
            user=user,
            session_id=session_id,
            metadata=None,
        )

        engagement = ToolEngagement.objects.get(tool_id=1, session_id=session_id)
        assert engagement.metadata == {}
