"""
Unit tests for UserRecommendationService.

Tests that the service correctly matches users based on shared interests, roles,
and goals, excludes already-followed users, and handles edge cases.
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from core.taxonomy.models import Taxonomy
from core.users.models import UserFollow
from core.users.services.recommendations import UserRecommendationService

User = get_user_model()


@pytest.fixture
def recommendation_service():
    """Create a UserRecommendationService instance."""
    return UserRecommendationService()


@pytest.fixture
def interest_ai(db):
    """Create AI & ML interest taxonomy."""
    return Taxonomy.objects.create(
        name='AI & Machine Learning',
        slug='test-interest-ai-ml',
        taxonomy_type='interest',
        is_active=True,
    )


@pytest.fixture
def interest_web(db):
    """Create Web Development interest taxonomy."""
    return Taxonomy.objects.create(
        name='Web Development',
        slug='test-interest-web-dev',
        taxonomy_type='interest',
        is_active=True,
    )


@pytest.fixture
def goal_learn(db):
    """Create Learn new skills goal taxonomy."""
    return Taxonomy.objects.create(
        name='Learn New Skills',
        slug='test-goal-learn-skills',
        taxonomy_type='goal',
        is_active=True,
    )


@pytest.fixture
def role_developer(db):
    """Create Developer role taxonomy."""
    return Taxonomy.objects.create(
        name='Developer',
        slug='test-role-developer',
        taxonomy_type='role',
        is_active=True,
    )


@pytest.fixture
def user_alice(db, interest_ai, goal_learn):
    """Create test user Alice with AI interest and learn goal."""
    user = User.objects.create_user(
        username='alice',
        email='alice@example.com',
        password='testpass123',
    )
    user.interests.add(interest_ai)
    user.goals.add(goal_learn)
    return user


@pytest.fixture
def user_bob(db, interest_ai, interest_web, goal_learn):
    """Create test user Bob with AI & Web interests and learn goal."""
    user = User.objects.create_user(
        username='bob',
        email='bob@example.com',
        password='testpass123',
        tagline='AI enthusiast and web developer',
    )
    user.interests.add(interest_ai, interest_web)
    user.goals.add(goal_learn)
    return user


@pytest.fixture
def user_charlie(db, interest_web, role_developer):
    """Create test user Charlie with Web interest and developer role."""
    user = User.objects.create_user(
        username='charlie',
        email='charlie@example.com',
        password='testpass123',
        bio='I build websites and web applications.',
    )
    user.interests.add(interest_web)
    user.roles.add(role_developer)
    return user


@pytest.fixture
def user_no_preferences(db):
    """Create test user with no interests, roles, or goals."""
    return User.objects.create_user(
        username='newbie',
        email='newbie@example.com',
        password='testpass123',
    )


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear cache before each test."""
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestGetConnectionSuggestions:
    """Test get_connection_suggestions method."""

    def test_returns_users_with_shared_interests(self, recommendation_service, user_alice, user_bob):
        """Users with shared interests are returned as suggestions."""
        result = recommendation_service.get_connection_suggestions(user_alice)

        assert result['has_suggestions'] is True
        assert len(result['suggestions']) >= 1

        # Bob should be suggested (shares AI interest)
        usernames = [s['username'] for s in result['suggestions']]
        assert 'bob' in usernames

    def test_excludes_self_from_suggestions(self, recommendation_service, user_alice, user_bob):
        """Current user is never included in suggestions."""
        result = recommendation_service.get_connection_suggestions(user_alice)

        usernames = [s['username'] for s in result['suggestions']]
        assert 'alice' not in usernames

    def test_excludes_already_followed_users(self, recommendation_service, user_alice, user_bob):
        """Users that are already followed are excluded."""
        # Alice follows Bob
        UserFollow.objects.create(follower=user_alice, following=user_bob)
        user_alice.following_count = 1
        user_alice.save()

        result = recommendation_service.get_connection_suggestions(user_alice)

        usernames = [s['username'] for s in result['suggestions']]
        assert 'bob' not in usernames

    def test_returns_empty_for_user_with_no_preferences(self, recommendation_service, user_no_preferences):
        """Users with no interests/roles/goals get empty suggestions."""
        result = recommendation_service.get_connection_suggestions(user_no_preferences)

        assert result['has_suggestions'] is False
        assert result['suggestions'] == []
        assert result['reason'] == 'no_user_preferences'
        assert result['cta']['url'] == '/settings/profile'

    def test_respects_limit_parameter(self, recommendation_service, user_alice, user_bob, user_charlie, interest_ai):
        """Limit parameter controls max suggestions returned."""
        # Give Charlie AI interest so both Bob and Charlie match
        user_charlie.interests.add(interest_ai)

        result = recommendation_service.get_connection_suggestions(user_alice, limit=1)

        assert len(result['suggestions']) == 1

    def test_clamps_limit_to_valid_range(self, recommendation_service, user_alice):
        """Limit is clamped between 1 and 10."""
        # Test lower bound
        result = recommendation_service.get_connection_suggestions(user_alice, limit=0)
        # Should not raise, internally clamped to 1

        # Test upper bound
        result = recommendation_service.get_connection_suggestions(user_alice, limit=100)
        # Should not raise, internally clamped to 10

    def test_includes_match_reason(self, recommendation_service, user_alice, user_bob):
        """Suggestions include human-readable match reason."""
        result = recommendation_service.get_connection_suggestions(user_alice)

        assert len(result['suggestions']) > 0
        suggestion = result['suggestions'][0]
        assert 'match_reason' in suggestion
        assert len(suggestion['match_reason']) > 0

    def test_includes_tagline_when_available(self, recommendation_service, user_alice, user_bob):
        """Suggestions include tagline when user has one."""
        result = recommendation_service.get_connection_suggestions(user_alice)

        bob_suggestion = next(s for s in result['suggestions'] if s['username'] == 'bob')
        assert bob_suggestion['tagline'] == 'AI enthusiast and web developer'

    def test_falls_back_to_bio_when_no_tagline(self, recommendation_service, user_bob, user_charlie):
        """Falls back to truncated bio when no tagline set."""
        result = recommendation_service.get_connection_suggestions(user_bob)

        charlie_suggestion = next((s for s in result['suggestions'] if s['username'] == 'charlie'), None)
        if charlie_suggestion:
            assert charlie_suggestion['tagline'] == 'I build websites and web applications.'

    def test_includes_cta(self, recommendation_service, user_alice, user_bob):
        """Result includes CTA for discovering more creators."""
        result = recommendation_service.get_connection_suggestions(user_alice)

        assert 'cta' in result
        assert result['cta']['url'] == '/explore?tab=creators'
        assert 'label' in result['cta']

    def test_caches_results(self, recommendation_service, user_alice, user_bob):
        """Results are cached for performance."""
        # First call
        result1 = recommendation_service.get_connection_suggestions(user_alice)

        # Verify cache is set
        cache_key = f'connect:suggestions:{user_alice.id}'
        cached = cache.get(cache_key)
        assert cached is not None
        assert cached == result1

    def test_returns_cached_results(self, recommendation_service, user_alice, user_bob):
        """Subsequent calls return cached results."""
        # First call populates cache
        result1 = recommendation_service.get_connection_suggestions(user_alice)

        # Add a new user that would match - but cache should be used
        new_user = User.objects.create_user(
            username='newmatch',
            email='newmatch@example.com',
            password='test123',
        )
        new_user.interests.set(user_alice.interests.all())

        # Second call should return cached (without new user)
        result2 = recommendation_service.get_connection_suggestions(user_alice)
        assert result1 == result2


@pytest.mark.django_db
class TestBuildMatchReason:
    """Test _build_match_reason helper method."""

    def test_no_shared_interests(self, recommendation_service):
        """Returns generic message when no shared interests."""
        reason = recommendation_service._build_match_reason([])
        assert reason == 'Active creator in the community'

    def test_one_shared_interest(self, recommendation_service):
        """Returns specific message for one shared interest."""
        reason = recommendation_service._build_match_reason(['AI'])
        assert reason == 'You both love AI'

    def test_two_shared_interests(self, recommendation_service):
        """Returns message combining two interests."""
        reason = recommendation_service._build_match_reason(['AI', 'Design'])
        assert reason == 'You both love AI and Design'

    def test_three_or_more_shared_interests(self, recommendation_service):
        """Returns truncated message for many interests."""
        reason = recommendation_service._build_match_reason(['AI', 'Design', 'Web', 'Mobile'])
        assert 'You share interests in AI, Design' in reason
        assert 'and more' in reason


@pytest.mark.django_db
class TestInvalidateCache:
    """Test cache invalidation."""

    def test_invalidates_user_cache(self, recommendation_service, user_alice, user_bob):
        """invalidate_cache removes cached suggestions."""
        # Populate cache
        recommendation_service.get_connection_suggestions(user_alice)
        cache_key = f'connect:suggestions:{user_alice.id}'
        assert cache.get(cache_key) is not None

        # Invalidate
        recommendation_service.invalidate_cache(user_alice.id)

        assert cache.get(cache_key) is None


@pytest.mark.django_db
class TestGetUserTopTools:
    """Test _get_user_top_tools helper method."""

    def test_returns_empty_for_user_with_no_projects(self, recommendation_service, user_alice):
        """Returns empty list when user has no projects."""
        tools = recommendation_service._get_user_top_tools(user_alice)
        assert tools == []

    def test_returns_tool_structure(self, recommendation_service, user_alice, db):
        """Returns correct tool structure with id, name, slug."""
        from core.projects.models import Project
        from core.tools.models import Tool

        # Create a tool
        tool = Tool.objects.create(
            name='ChatGPT',
            slug='chatgpt',
            description='AI assistant',
            is_active=True,
        )

        # Create a project with the tool
        project = Project.objects.create(
            user=user_alice,
            title='Test Project',
            description='Test',
            is_private=False,
            is_archived=False,
        )
        project.tools.add(tool)

        tools = recommendation_service._get_user_top_tools(user_alice)

        assert len(tools) == 1
        assert tools[0]['id'] == tool.id
        assert tools[0]['name'] == 'ChatGPT'
        assert tools[0]['slug'] == 'chatgpt'


@pytest.mark.django_db
class TestSuggestionStructure:
    """Test the structure of returned suggestions."""

    def test_suggestion_has_required_fields(self, recommendation_service, user_alice, user_bob):
        """Each suggestion has all required fields."""
        result = recommendation_service.get_connection_suggestions(user_alice)

        assert len(result['suggestions']) > 0
        suggestion = result['suggestions'][0]

        required_fields = [
            'user_id',
            'username',
            'display_name',
            'avatar_url',
            'tagline',
            'tier',
            'level',
            'match_reason',
            'shared_interests',
            'top_tools',
            'followers_count',
            'is_following',
        ]

        for field in required_fields:
            assert field in suggestion, f'Missing field: {field}'

    def test_is_following_always_false(self, recommendation_service, user_alice, user_bob):
        """is_following is always False (since we exclude followed users)."""
        result = recommendation_service.get_connection_suggestions(user_alice)

        for suggestion in result['suggestions']:
            assert suggestion['is_following'] is False
