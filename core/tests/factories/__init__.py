"""
Test Factories

Factory Boy factories for creating test data with unique, isolated values.
Using these factories instead of Model.objects.create() prevents constraint
violations from hardcoded usernames.

Usage:
    from core.tests.factories import UserFactory, ProjectFactory

    # Create a user with auto-generated unique username
    user = UserFactory()

    # Create a user with specific traits
    admin = UserFactory(admin=True)
    agent = UserFactory(agent=True)

    # Override specific fields
    user = UserFactory(username='specific_name', email='specific@test.com')
"""

from .battles import BattleSubmissionFactory, PromptBattleFactory
from .community import MessageFactory, RoomFactory
from .projects import ProjectFactory
from .users import UserFactory

__all__ = [
    'UserFactory',
    'ProjectFactory',
    'PromptBattleFactory',
    'BattleSubmissionFactory',
    'RoomFactory',
    'MessageFactory',
]
