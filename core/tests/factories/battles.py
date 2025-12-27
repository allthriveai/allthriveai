"""
Battle Factories

Factories for creating test battles and submissions.
"""

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from core.battles.models import BattleStatus, BattleSubmission, PromptBattle

from .users import UserFactory


class PromptBattleFactory(DjangoModelFactory):
    """Factory for creating test prompt battles."""

    class Meta:
        model = PromptBattle

    # Required fields
    challenger = factory.SubFactory(UserFactory)
    opponent = factory.SubFactory(UserFactory)
    challenge_text = factory.Sequence(lambda n: f'Test challenge {n}: Create an AI prompt for...')

    # Defaults
    status = BattleStatus.PENDING
    battle_type = 'pip'
    duration_minutes = 10

    class Params:
        # Battle state traits
        active = factory.Trait(
            status=BattleStatus.ACTIVE,
            started_at=factory.LazyFunction(timezone.now),
        )
        completed = factory.Trait(
            status=BattleStatus.COMPLETED,
            started_at=factory.LazyFunction(lambda: timezone.now() - timezone.timedelta(hours=1)),
            completed_at=factory.LazyFunction(timezone.now),
        )
        expired = factory.Trait(
            status=BattleStatus.EXPIRED,
        )
        # Battle type traits
        solo = factory.Trait(
            battle_type='solo',
            opponent=None,
        )


class BattleSubmissionFactory(DjangoModelFactory):
    """Factory for creating test battle submissions."""

    class Meta:
        model = BattleSubmission

    battle = factory.SubFactory(PromptBattleFactory)
    user = factory.SubFactory(UserFactory)
    prompt_text = factory.Sequence(lambda n: f'Test submission prompt {n}')

    # Defaults
    submitted_at = factory.LazyFunction(timezone.now)

    class Params:
        # Submission result traits
        winning = factory.Trait(
            is_winner=True,
        )
