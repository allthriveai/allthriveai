"""Battles domain - Prompt battle competitions.

This domain handles competitive prompt generation battles between users,
including battle invitations, submissions, and scoring.
"""

from .models import (
    BattleInvitation,
    BattleStatus,
    BattleSubmission,
    BattleType,
    InvitationStatus,
    PromptBattle,
    SubmissionType,
)
from .views import BattleInvitationViewSet, PromptBattleViewSet, battle_leaderboard, battle_stats, expire_battles

__all__ = [
    # Models
    'PromptBattle',
    'BattleSubmission',
    'BattleInvitation',
    'BattleStatus',
    'BattleType',
    'SubmissionType',
    'InvitationStatus',
    # Views
    'PromptBattleViewSet',
    'BattleInvitationViewSet',
    'battle_stats',
    'battle_leaderboard',
    'expire_battles',
]
