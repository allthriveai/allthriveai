"""
Service Test Doubles

This module provides fake implementations of external service clients for testing.
These are "fakes" - they implement the same interface as the real services but
return predictable, configurable responses without making external API calls.

Usage:
    from core.tests.doubles import FakeGitHubService, FakeStripeService

    # In your test
    fake_github = FakeGitHubService()
    fake_github.set_readme('# My Project')
    result = await fake_github.get_readme('owner', 'repo')
    assert result == '# My Project'

Benefits over mocks:
    - Type-safe: IDE can verify method signatures
    - Behavior-based: Test behavior, not implementation details
    - Reusable: Same fake works across many tests
    - Maintainable: Changes to interface surface immediately
"""

from .github import FakeGitHubService, GitHubServiceProtocol
from .stripe import FakeStripeService, StripeServiceProtocol

__all__ = [
    'FakeGitHubService',
    'FakeStripeService',
    'GitHubServiceProtocol',
    'StripeServiceProtocol',
]
