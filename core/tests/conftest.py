"""
Shared pytest fixtures for core tests.

These fixtures provide common test utilities including:
- Factory-based user/model creation
- Query counting for N+1 detection
- Authenticated API clients
"""

from contextlib import contextmanager

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from core.tests.factories import (
    ProjectFactory,
    PromptBattleFactory,
    RoomFactory,
    UserFactory,
)

# =============================================================================
# Factory Fixtures
# =============================================================================


@pytest.fixture
def user():
    """Create a test user using factory."""
    return UserFactory()


@pytest.fixture
def admin_user():
    """Create an admin user using factory."""
    return UserFactory(admin=True)


@pytest.fixture
def agent_user():
    """Create an agent user using factory."""
    return UserFactory(agent=True)


@pytest.fixture
def project(user):
    """Create a test project using factory."""
    return ProjectFactory(creator=user)


@pytest.fixture
def battle():
    """Create a test battle using factory."""
    return PromptBattleFactory()


@pytest.fixture
def room():
    """Create a test room using factory."""
    return RoomFactory()


# =============================================================================
# API Client Fixtures
# =============================================================================


@pytest.fixture
def api_client():
    """Create an unauthenticated API client."""
    return APIClient()


@pytest.fixture
def authenticated_client(user):
    """Create an authenticated API client."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def admin_client(admin_user):
    """Create an admin-authenticated API client."""
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


# =============================================================================
# Query Counting Fixtures (N+1 Detection)
# =============================================================================


@contextmanager
def assert_max_queries(max_count: int):
    """
    Context manager that fails if query count exceeds max_count.

    Usage:
        with assert_max_queries(5):
            response = client.get('/api/v1/projects/')

    Raises:
        AssertionError: If more than max_count queries are executed
    """
    with CaptureQueriesContext(connection) as context:
        yield context

    if len(context) > max_count:
        queries = '\n'.join(f"  {i+1}. {q['sql'][:100]}..." for i, q in enumerate(context))
        raise AssertionError(f'Expected max {max_count} queries, got {len(context)}:\n{queries}')


@pytest.fixture
def query_counter():
    """
    Pytest fixture wrapper for assert_max_queries.

    Usage:
        def test_no_n_plus_1(authenticated_client, query_counter):
            with query_counter(5):
                authenticated_client.get('/api/v1/projects/')
    """
    return assert_max_queries


# =============================================================================
# Cleanup Fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def reset_factory_sequences():
    """Reset factory sequences between tests to avoid collisions."""
    yield
    # Reset sequences after each test
    UserFactory.reset_sequence()
    ProjectFactory.reset_sequence()
    PromptBattleFactory.reset_sequence()
    RoomFactory.reset_sequence()
