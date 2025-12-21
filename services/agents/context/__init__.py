"""
Member context service for Ember agent.

Provides unified context about a member including:
- Learning preferences and progress
- Personalization data (UserTags, tool preferences)
- Profile information
"""

from .member_context import MemberContextService

__all__ = ['MemberContextService']
