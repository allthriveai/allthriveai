"""
Community Factories

Factories for creating test rooms and messages.
"""

import factory
from factory.django import DjangoModelFactory

from core.community.models import Message, Room

from .users import UserFactory


class RoomFactory(DjangoModelFactory):
    """Factory for creating test community rooms."""

    class Meta:
        model = Room

    # Required fields with sequences for uniqueness
    name = factory.Sequence(lambda n: f'Test Room {n}')
    slug = factory.Sequence(lambda n: f'test-room-{n}')
    description = factory.Faker('sentence')

    # Defaults
    room_type = 'forum'
    visibility = 'public'
    icon = 'comments'

    # Creator
    created_by = factory.SubFactory(UserFactory)

    class Params:
        # Room type traits
        circle = factory.Trait(
            room_type='circle',
            name=factory.Sequence(lambda n: f'Test Circle {n}'),
        )
        dm = factory.Trait(
            room_type='dm',
            visibility='private',
        )
        private = factory.Trait(
            visibility='private',
        )


class MessageFactory(DjangoModelFactory):
    """Factory for creating test messages."""

    class Meta:
        model = Message

    room = factory.SubFactory(RoomFactory)
    sender = factory.SubFactory(UserFactory)
    content = factory.Faker('paragraph')

    # Defaults
    message_type = 'text'

    class Params:
        # Message type traits
        system = factory.Trait(
            message_type='system',
            content='System message',
        )
        pinned = factory.Trait(
            is_pinned=True,
        )
