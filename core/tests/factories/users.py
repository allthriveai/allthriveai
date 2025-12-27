"""
User Factory

Factory for creating test users with unique usernames and emails.
"""

import factory
from factory.django import DjangoModelFactory

from core.users.models import User, UserRole


class UserFactory(DjangoModelFactory):
    """Factory for creating test users with unique, sequential values."""

    class Meta:
        model = User
        skip_postgeneration_save = True  # Avoid double-save with set_password

    # Required unique fields - Sequence ensures no collisions
    username = factory.Sequence(lambda n: f'testuser_{n}')
    email = factory.LazyAttribute(lambda o: f'{o.username}@test.allthrive.ai')

    # Required fields with defaults matching model
    role = UserRole.EXPLORER
    tier = 'seedling'
    is_active = True

    # Password handling - set after creation
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')

    class Params:
        # Traits for common test scenarios
        admin = factory.Trait(
            role=UserRole.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        agent = factory.Trait(
            role=UserRole.AGENT,
            tier='team',
        )
        curation = factory.Trait(
            tier='curation',
            role=UserRole.AGENT,
        )
        mentor = factory.Trait(
            role=UserRole.MENTOR,
            tier='bloom',
        )
        creator = factory.Trait(
            role=UserRole.CREATOR,
            tier='blossom',
        )
