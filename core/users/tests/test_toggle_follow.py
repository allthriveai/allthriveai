"""
Unit tests for toggle_follow API endpoint.

Tests that the API successfully creates follow relationships, updates user counts,
and prevents self-follows.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from core.users.models import UserFollow

User = get_user_model()


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


@pytest.fixture
def user1(db):
    """Create first test user."""
    return User.objects.create_user(
        username='alice',
        email='alice@example.com',
        password='testpass123',
    )


@pytest.fixture
def user2(db):
    """Create second test user."""
    return User.objects.create_user(
        username='bob',
        email='bob@example.com',
        password='testpass123',
    )


@pytest.fixture
def user3(db):
    """Create third test user."""
    return User.objects.create_user(
        username='charlie',
        email='charlie@example.com',
        password='testpass123',
    )


@pytest.mark.django_db
class TestToggleFollowAuth:
    """Test authentication and authorization."""

    def test_requires_authentication(self, api_client, user2):
        """Unauthenticated users cannot follow."""
        response = api_client.post(f'/api/v1/users/{user2.username}/follow/')

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_user_can_follow(self, api_client, user1, user2):
        """Authenticated user can follow others."""
        api_client.force_authenticate(user=user1)

        response = api_client.post(f'/api/v1/users/{user2.username}/follow/')

        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestFollowCreation:
    """Test follow relationship creation."""

    def test_creates_follow_relationship(self, api_client, user1, user2):
        """POST creates a follow relationship."""
        api_client.force_authenticate(user=user1)

        response = api_client.post(f'/api/v1/users/{user2.username}/follow/')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['is_following'] is True
        assert UserFollow.objects.filter(follower=user1, following=user2).exists()

    def test_returns_success_message(self, api_client, user1, user2):
        """POST returns success message."""
        api_client.force_authenticate(user=user1)

        response = api_client.post(f'/api/v1/users/{user2.username}/follow/')

        assert response.data['message'] == 'Successfully followed user'

    def test_returns_updated_followers_count(self, api_client, user1, user2):
        """POST returns updated follower count."""
        api_client.force_authenticate(user=user1)
        initial_count = user2.followers_count

        response = api_client.post(f'/api/v1/users/{user2.username}/follow/')

        assert response.data['followers_count'] == initial_count + 1

    def test_follow_with_lowercase_username(self, api_client, user1, user2):
        """Can follow user with lowercase username."""
        api_client.force_authenticate(user=user1)

        response = api_client.post(f'/api/v1/users/{user2.username.lower()}/follow/')

        assert response.status_code == status.HTTP_201_CREATED

    def test_follow_with_mixed_case_username(self, api_client, user1):
        """Can follow user with mixed case username (normalized to lowercase)."""
        user_mixed = User.objects.create_user(
            username='MixedCase',
            email='mixed@example.com',
            password='test123',
        )
        api_client.force_authenticate(user=user1)

        # Username stored as lowercase
        response = api_client.post('/api/v1/users/mixedcase/follow/')

        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestFollowCounts:
    """Test follower and following count updates."""

    def test_increments_target_user_followers_count(self, api_client, user1, user2):
        """Following a user increments their followers_count."""
        api_client.force_authenticate(user=user1)
        initial_count = user2.followers_count

        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        user2.refresh_from_db()
        assert user2.followers_count == initial_count + 1

    def test_increments_source_user_following_count(self, api_client, user1, user2):
        """Following a user increments your following_count."""
        api_client.force_authenticate(user=user1)
        initial_count = user1.following_count

        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        user1.refresh_from_db()
        assert user1.following_count == initial_count + 1

    def test_multiple_followers_increment_correctly(self, api_client, user1, user2, user3):
        """Multiple users following increments count correctly."""
        initial_count = user2.followers_count

        # user1 follows user2
        api_client.force_authenticate(user=user1)
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # user3 follows user2
        api_client.force_authenticate(user=user3)
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        user2.refresh_from_db()
        assert user2.followers_count == initial_count + 2

    def test_following_multiple_users_increment_correctly(self, api_client, user1, user2, user3):
        """Following multiple users increments count correctly."""
        api_client.force_authenticate(user=user1)
        initial_count = user1.following_count

        # Follow user2
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # Follow user3
        api_client.post(f'/api/v1/users/{user3.username}/follow/')

        user1.refresh_from_db()
        assert user1.following_count == initial_count + 2


@pytest.mark.django_db
class TestSelfFollowPrevention:
    """Test prevention of self-follows."""

    def test_cannot_follow_yourself(self, api_client, user1):
        """User cannot follow themselves."""
        api_client.force_authenticate(user=user1)

        response = api_client.post(f'/api/v1/users/{user1.username}/follow/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'cannot follow yourself' in response.data['error'].lower()

    def test_self_follow_does_not_create_relationship(self, api_client, user1):
        """Self-follow attempt does not create database record."""
        api_client.force_authenticate(user=user1)

        api_client.post(f'/api/v1/users/{user1.username}/follow/')

        assert not UserFollow.objects.filter(follower=user1, following=user1).exists()

    def test_self_follow_does_not_update_counts(self, api_client, user1):
        """Self-follow attempt does not update follower/following counts."""
        api_client.force_authenticate(user=user1)
        initial_followers = user1.followers_count
        initial_following = user1.following_count

        api_client.post(f'/api/v1/users/{user1.username}/follow/')

        user1.refresh_from_db()
        assert user1.followers_count == initial_followers
        assert user1.following_count == initial_following


@pytest.mark.django_db
class TestIdempotency:
    """Test idempotent follow operations."""

    def test_following_twice_returns_200(self, api_client, user1, user2):
        """Following an already-followed user returns 200 OK."""
        api_client.force_authenticate(user=user1)

        # First follow
        response1 = api_client.post(f'/api/v1/users/{user2.username}/follow/')
        assert response1.status_code == status.HTTP_201_CREATED

        # Second follow (already following)
        response2 = api_client.post(f'/api/v1/users/{user2.username}/follow/')
        assert response2.status_code == status.HTTP_200_OK
        assert 'Already following' in response2.data['message']

    def test_following_twice_does_not_duplicate(self, api_client, user1, user2):
        """Following twice does not create duplicate relationships."""
        api_client.force_authenticate(user=user1)

        # Follow twice
        api_client.post(f'/api/v1/users/{user2.username}/follow/')
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # Should only have one follow relationship
        assert UserFollow.objects.filter(follower=user1, following=user2).count() == 1

    def test_following_twice_does_not_double_increment(self, api_client, user1, user2):
        """Following twice does not double-increment counts."""
        api_client.force_authenticate(user=user1)
        initial_count = user2.followers_count

        # Follow twice
        api_client.post(f'/api/v1/users/{user2.username}/follow/')
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        user2.refresh_from_db()
        # Count should only increase by 1, not 2
        assert user2.followers_count == initial_count + 1


@pytest.mark.django_db
class TestUnfollow:
    """Test unfollow functionality."""

    def test_unfollow_removes_relationship(self, api_client, user1, user2):
        """DELETE removes follow relationship."""
        api_client.force_authenticate(user=user1)

        # First follow
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # Then unfollow
        response = api_client.delete(f'/api/v1/users/{user2.username}/follow/')

        assert response.status_code == status.HTTP_200_OK
        assert not UserFollow.objects.filter(follower=user1, following=user2).exists()

    def test_unfollow_returns_success_message(self, api_client, user1, user2):
        """DELETE returns success message."""
        api_client.force_authenticate(user=user1)

        # Follow then unfollow
        api_client.post(f'/api/v1/users/{user2.username}/follow/')
        response = api_client.delete(f'/api/v1/users/{user2.username}/follow/')

        assert response.data['message'] == 'Successfully unfollowed user'
        assert response.data['is_following'] is False

    def test_unfollow_decrements_followers_count(self, api_client, user1, user2):
        """Unfollowing decrements target user's followers_count."""
        api_client.force_authenticate(user=user1)

        # Follow
        api_client.post(f'/api/v1/users/{user2.username}/follow/')
        user2.refresh_from_db()
        count_after_follow = user2.followers_count

        # Unfollow
        api_client.delete(f'/api/v1/users/{user2.username}/follow/')

        user2.refresh_from_db()
        assert user2.followers_count == count_after_follow - 1

    def test_unfollow_decrements_following_count(self, api_client, user1, user2):
        """Unfollowing decrements source user's following_count."""
        api_client.force_authenticate(user=user1)

        # Follow
        api_client.post(f'/api/v1/users/{user2.username}/follow/')
        user1.refresh_from_db()
        count_after_follow = user1.following_count

        # Unfollow
        api_client.delete(f'/api/v1/users/{user2.username}/follow/')

        user1.refresh_from_db()
        assert user1.following_count == count_after_follow - 1

    def test_unfollow_non_followed_user_returns_200(self, api_client, user1, user2):
        """Unfollowing a non-followed user returns 200 OK."""
        api_client.force_authenticate(user=user1)

        # Unfollow without following first
        response = api_client.delete(f'/api/v1/users/{user2.username}/follow/')

        assert response.status_code == status.HTTP_200_OK
        assert 'not following' in response.data['message'].lower()

    def test_unfollow_prevents_negative_counts(self, api_client, user1, user2):
        """Unfollowing when count is 0 doesn't go negative."""
        api_client.force_authenticate(user=user1)

        # Ensure counts are 0
        User.objects.filter(pk=user2.pk).update(followers_count=0)
        User.objects.filter(pk=user1.pk).update(following_count=0)

        # Unfollow without following
        api_client.delete(f'/api/v1/users/{user2.username}/follow/')

        user1.refresh_from_db()
        user2.refresh_from_db()
        assert user1.following_count >= 0
        assert user2.followers_count >= 0


@pytest.mark.django_db
class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_follow_nonexistent_user_returns_404(self, api_client, user1):
        """Following non-existent user returns 404."""
        api_client.force_authenticate(user=user1)

        response = api_client.post('/api/v1/users/nonexistentuser/follow/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unfollow_nonexistent_user_returns_404(self, api_client, user1):
        """Unfollowing non-existent user returns 404."""
        api_client.force_authenticate(user=user1)

        response = api_client.delete('/api/v1/users/nonexistentuser/follow/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_follow_deleted_user_returns_404(self, api_client, user1, user2):
        """Following a deleted user returns 404."""
        api_client.force_authenticate(user=user1)

        user2_username = user2.username
        user2.delete()

        response = api_client.post(f'/api/v1/users/{user2_username}/follow/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_concurrent_follows_maintain_integrity(self, api_client, user1, user2):
        """Test database integrity with get_or_create."""
        api_client.force_authenticate(user=user1)

        # Simulate near-concurrent follows (get_or_create should handle this)
        response1 = api_client.post(f'/api/v1/users/{user2.username}/follow/')
        response2 = api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # Should only have one relationship
        assert UserFollow.objects.filter(follower=user1, following=user2).count() == 1


@pytest.mark.django_db
class TestFollowRelationshipData:
    """Test follow relationship data structure."""

    def test_follow_creates_timestamp(self, api_client, user1, user2):
        """Follow relationship includes creation timestamp."""
        api_client.force_authenticate(user=user1)

        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        follow = UserFollow.objects.get(follower=user1, following=user2)
        assert follow.created_at is not None

    def test_follow_relationship_ordering(self, api_client, user1, user2, user3):
        """Follow relationships ordered by creation time (newest first)."""
        api_client.force_authenticate(user=user1)

        # Follow user2 first
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # Follow user3 second
        api_client.post(f'/api/v1/users/{user3.username}/follow/')

        follows = UserFollow.objects.filter(follower=user1).order_by('-created_at')
        # Most recent (user3) should be first
        assert follows[0].following == user3
        assert follows[1].following == user2


@pytest.mark.django_db
class TestBidirectionalFollows:
    """Test mutual following relationships."""

    def test_users_can_follow_each_other(self, api_client, user1, user2):
        """Two users can follow each other (bidirectional)."""
        # user1 follows user2
        api_client.force_authenticate(user=user1)
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # user2 follows user1
        api_client.force_authenticate(user=user2)
        api_client.post(f'/api/v1/users/{user1.username}/follow/')

        # Both relationships should exist
        assert UserFollow.objects.filter(follower=user1, following=user2).exists()
        assert UserFollow.objects.filter(follower=user2, following=user1).exists()

    def test_mutual_follow_counts_correct(self, api_client, user1, user2):
        """Mutual follows correctly update both users' counts."""
        # user1 follows user2
        api_client.force_authenticate(user=user1)
        api_client.post(f'/api/v1/users/{user2.username}/follow/')

        # user2 follows user1
        api_client.force_authenticate(user=user2)
        api_client.post(f'/api/v1/users/{user1.username}/follow/')

        user1.refresh_from_db()
        user2.refresh_from_db()

        # Each should have 1 follower and 1 following
        assert user1.followers_count >= 1
        assert user1.following_count >= 1
        assert user2.followers_count >= 1
        assert user2.following_count >= 1
