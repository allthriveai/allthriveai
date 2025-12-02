"""Services package."""

# Main exports for convenient imports
from .ai import AIProvider
from .gamification import BattleService, LearningPathService
from .integrations.social import SocialOAuthService
from .integrations.storage import StorageService

__all__ = [
    'AIProvider',
    'BattleService',
    'LearningPathService',
    'SocialOAuthService',
    'StorageService',
]
