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

__all__ = [
    # Models
    'PromptBattle',
    'BattleSubmission',
    'BattleInvitation',
    'BattleStatus',
    'BattleType',
    'SubmissionType',
    'InvitationStatus',
]
