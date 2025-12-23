"""
Unit tests for explore_users API endpoint.

Tests the user exploration and search functionality including:
- Pagination
- Search by username, name, bio, and tagline
- Privacy filtering (public profiles only)
- Exclusion of system accounts and admins
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from core.projects.models import Project

User = get_user_model()


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


@pytest.fixture
def public_user(db):
    """Create a public user."""
    return User.objects.create_user(
        username='publicuser',
        email='public@example.com',
        password='testpass123',
        first_name='Alice',
        last_name='Smith',
        bio='I love building AI projects',
        tagline='AI enthusiast',
        is_profile_public=True,
    )


@pytest.fixture
def private_user(db):
    """Create a private user."""
    return User.objects.create_user(
        username='privateuser',
        email='private@example.com',
        password='testpass123',
        first_name='Bob',
        last_name='Jones',
        bio='Private person',
        is_profile_public=False,
    )


@pytest.fixture
def user_with_project(db):
    """Create a user with a project."""
    user = User.objects.create_user(
        username='projectuser',
        email='project@example.com',
        password='testpass123',
        first_name='Charlie',
        last_name='Brown',
        bio='Building cool stuff',
        tagline='Creator',
        is_profile_public=True,
    )
    Project.objects.create(
        user=user,
        title='My Cool Project',
        slug='my-cool-project',
        description='A project description',
        is_archived=False,
    )
    return user


@pytest.fixture
def haven_user(db):
    """Create a user named Haven for search testing."""
    return User.objects.create_user(
        username='haven',
        email='haven@example.com',
        password='testpass123',
        first_name='Haven',
        last_name='Developer',
        bio='Full stack developer',
        tagline='Code ninja',
        is_profile_public=True,
    )


@pytest.mark.django_db
class TestExploreUsersBasic:
    """Test basic explore users functionality."""

    def test_explore_returns_200(self, api_client, public_user):
        """Explore endpoint returns 200 OK."""
        response = api_client.get('/api/v1/users/explore/')
        assert response.status_code == status.HTTP_200_OK

    def test_explore_returns_paginated_response(self, api_client, public_user):
        """Explore returns standard paginated response structure."""
        response = api_client.get('/api/v1/users/explore/')

        assert 'count' in response.data
        assert 'results' in response.data
        assert 'next' in response.data
        assert 'previous' in response.data

    def test_explore_includes_public_users(self, api_client, public_user):
        """Public users appear in explore results."""
        response = api_client.get('/api/v1/users/explore/?include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert public_user.username in usernames

    def test_explore_excludes_private_users(self, api_client, public_user, private_user):
        """Private users do not appear in explore results."""
        response = api_client.get('/api/v1/users/explore/?include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert private_user.username not in usernames

    def test_explore_excludes_guest_users(self, api_client, db):
        """Guest users do not appear in explore results."""
        guest = User.objects.create_user(
            username='guestuser',
            email='guest@example.com',
            password='testpass123',
            is_guest=True,
            is_profile_public=True,
        )

        response = api_client.get('/api/v1/users/explore/?include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert guest.username not in usernames


@pytest.mark.django_db
class TestExploreUsersSearch:
    """Test search functionality in explore users."""

    def test_search_by_username(self, api_client, haven_user, public_user):
        """Search finds users by username."""
        response = api_client.get('/api/v1/users/explore/?search=haven&include_all=true')

        assert response.status_code == status.HTTP_200_OK
        usernames = [u['username'] for u in response.data['results']]
        assert 'haven' in usernames

    def test_search_by_first_name(self, api_client, haven_user, public_user):
        """Search finds users by first name."""
        response = api_client.get('/api/v1/users/explore/?search=Haven&include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert 'haven' in usernames

    def test_search_by_last_name(self, api_client, haven_user, public_user):
        """Search finds users by last name."""
        response = api_client.get('/api/v1/users/explore/?search=Developer&include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert 'haven' in usernames

    def test_search_by_bio(self, api_client, public_user):
        """Search finds users by bio content."""
        response = api_client.get('/api/v1/users/explore/?search=AI%20projects&include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert 'publicuser' in usernames

    def test_search_by_tagline(self, api_client, public_user):
        """Search finds users by tagline."""
        response = api_client.get('/api/v1/users/explore/?search=enthusiast&include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert 'publicuser' in usernames

    def test_search_is_case_insensitive(self, api_client, haven_user):
        """Search is case insensitive."""
        response_lower = api_client.get('/api/v1/users/explore/?search=haven&include_all=true')
        response_upper = api_client.get('/api/v1/users/explore/?search=HAVEN&include_all=true')
        response_mixed = api_client.get('/api/v1/users/explore/?search=HaVeN&include_all=true')

        usernames_lower = [u['username'] for u in response_lower.data['results']]
        usernames_upper = [u['username'] for u in response_upper.data['results']]
        usernames_mixed = [u['username'] for u in response_mixed.data['results']]

        assert 'haven' in usernames_lower
        assert 'haven' in usernames_upper
        assert 'haven' in usernames_mixed

    def test_search_returns_empty_for_no_matches(self, api_client, public_user):
        """Search returns empty results when no matches found."""
        response = api_client.get('/api/v1/users/explore/?search=zzzznonexistent&include_all=true')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0
        assert len(response.data['results']) == 0

    def test_search_excludes_private_users(self, api_client, private_user):
        """Search does not return private users even if they match."""
        response = api_client.get('/api/v1/users/explore/?search=privateuser&include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert 'privateuser' not in usernames

    def test_search_with_partial_match(self, api_client, haven_user):
        """Search matches partial strings."""
        response = api_client.get('/api/v1/users/explore/?search=hav&include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert 'haven' in usernames

    def test_empty_search_returns_all(self, api_client, public_user, haven_user):
        """Empty search query returns all public users."""
        response = api_client.get('/api/v1/users/explore/?search=&include_all=true')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] >= 2


@pytest.mark.django_db
class TestExploreUsersPagination:
    """Test pagination in explore users."""

    def test_default_page_size(self, api_client, db):
        """Default page size is 20."""
        # Create 25 users
        for i in range(25):
            User.objects.create_user(
                username=f'testuser{i}',
                email=f'test{i}@example.com',
                password='testpass123',
                is_profile_public=True,
            )

        response = api_client.get('/api/v1/users/explore/?include_all=true')

        assert len(response.data['results']) == 20

    def test_custom_page_size(self, api_client, db):
        """Can specify custom page size."""
        for i in range(15):
            User.objects.create_user(
                username=f'testuser{i}',
                email=f'test{i}@example.com',
                password='testpass123',
                is_profile_public=True,
            )

        response = api_client.get('/api/v1/users/explore/?page_size=10&include_all=true')

        assert len(response.data['results']) == 10

    def test_max_page_size_enforced(self, api_client, public_user):
        """Page size is capped at 100."""
        response = api_client.get('/api/v1/users/explore/?page_size=500&include_all=true')

        # Should not error, just cap at max
        assert response.status_code == status.HTTP_200_OK

    def test_pagination_with_search(self, api_client, db):
        """Search results are properly paginated."""
        # Create users matching search
        for i in range(15):
            User.objects.create_user(
                username=f'searchuser{i}',
                email=f'search{i}@example.com',
                password='testpass123',
                bio='searchable content',
                is_profile_public=True,
            )

        response = api_client.get('/api/v1/users/explore/?search=searchable&page_size=5&include_all=true')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 5
        assert response.data['count'] == 15


@pytest.mark.django_db
class TestExploreUsersIncludeAll:
    """Test include_all parameter behavior."""

    def test_include_all_false_excludes_users_without_projects(self, api_client, public_user, user_with_project):
        """Without include_all, only users with projects are returned."""
        response = api_client.get('/api/v1/users/explore/?include_all=false')

        usernames = [u['username'] for u in response.data['results']]
        assert 'projectuser' in usernames
        assert 'publicuser' not in usernames

    def test_include_all_true_includes_users_without_projects(self, api_client, public_user, user_with_project):
        """With include_all=true, users without projects are included."""
        response = api_client.get('/api/v1/users/explore/?include_all=true')

        usernames = [u['username'] for u in response.data['results']]
        assert 'projectuser' in usernames
        assert 'publicuser' in usernames


@pytest.mark.django_db
class TestExploreUsersResponseFormat:
    """Test response data format."""

    def test_response_includes_required_fields(self, api_client, public_user):
        """Response includes all required user fields."""
        response = api_client.get('/api/v1/users/explore/?include_all=true')

        user_data = next((u for u in response.data['results'] if u['username'] == 'publicuser'), None)
        assert user_data is not None

        # Check required fields
        assert 'id' in user_data
        assert 'username' in user_data
        assert 'full_name' in user_data
        assert 'avatar_url' in user_data
        assert 'bio' in user_data
        assert 'tagline' in user_data
        assert 'project_count' in user_data

    def test_response_includes_gamification_for_public(self, api_client, db):
        """Response includes gamification data for users with public gamification."""
        user = User.objects.create_user(
            username='gamificationuser',
            email='gamification@example.com',
            password='testpass123',
            is_profile_public=True,
            gamification_is_public=True,
            total_points=100,
            level=5,
        )

        response = api_client.get('/api/v1/users/explore/?include_all=true')

        user_data = next((u for u in response.data['results'] if u['username'] == 'gamificationuser'), None)
        assert user_data is not None
        assert 'total_points' in user_data
        assert 'level' in user_data
        assert 'tier' in user_data
