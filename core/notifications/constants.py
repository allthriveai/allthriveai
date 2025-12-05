"""Email notification type constants."""

from enum import Enum


class EmailType(Enum):
    """Enum of all email notification types.

    Values correspond to template paths under templates/emails/.
    """

    # Billing
    BILLING_LOW_BALANCE = 'billing/low_balance'
    BILLING_QUOTA_WARNING = 'billing/quota_warning'

    # Welcome
    WELCOME_REGISTRATION = 'welcome/registration'

    # Battles
    BATTLE_INVITATION = 'battles/invitation'
    BATTLE_RESULTS = 'battles/results'

    # Achievements
    ACHIEVEMENT_UNLOCKED = 'achievements/unlocked'

    # Social
    SOCIAL_NEW_FOLLOWER = 'social/new_follower'
    SOCIAL_PROJECT_COMMENT = 'social/project_comment'

    # Quests
    QUEST_ASSIGNED = 'quests/assigned'
    QUEST_STREAK_REMINDER = 'quests/streak_reminder'

    # Invitations (platform access)
    INVITATION_REQUEST_ADMIN = 'invitations/request_admin'  # To admin when someone requests
    INVITATION_REQUEST_USER = 'invitations/request_user'  # Confirmation to requester
    INVITATION_APPROVED = 'invitations/approved'  # When request is approved

    @property
    def category(self) -> str:
        """Get preference category for this email type.

        Returns the first part of the template path (e.g., 'billing', 'battles').
        """
        return self.value.split('/')[0]

    @property
    def template_path(self) -> str:
        """Get the full template path for this email type."""
        return f'emails/{self.value}'
