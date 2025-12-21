"""
DEPRECATED: Use MemberContextService from services.agents.context instead.

This module provides backwards compatibility for code still importing
LearnerContextService from the learning components package.
"""

import logging
import warnings

logger = logging.getLogger(__name__)


class LearnerContextService:
    """
    DEPRECATED: Thin wrapper around MemberContextService for backwards compatibility.

    Use MemberContextService directly:
        from services.agents.context import MemberContextService
        context = MemberContextService.get_context(user_id)
    """

    @classmethod
    def get_cache_key(cls, user_id: int) -> str:
        """Get the cache key for a user's context."""
        warnings.warn(
            'LearnerContextService is deprecated. Use MemberContextService from services.agents.context instead.',
            DeprecationWarning,
            stacklevel=2,
        )
        from services.agents.context import MemberContextService

        return MemberContextService.get_cache_key(user_id)

    @classmethod
    def invalidate_cache(cls, user_id: int) -> None:
        """Invalidate cached context (call after profile updates)."""
        warnings.warn(
            'LearnerContextService is deprecated. Use MemberContextService from services.agents.context instead.',
            DeprecationWarning,
            stacklevel=2,
        )
        from services.agents.context import MemberContextService

        MemberContextService.invalidate_cache(user_id)

    @classmethod
    def get_context(cls, user_id: int | None) -> dict | None:
        """
        Get member context synchronously.

        DEPRECATED: Returns MemberContext (not LearnerContext).
        """
        warnings.warn(
            'LearnerContextService is deprecated. Use MemberContextService from services.agents.context instead.',
            DeprecationWarning,
            stacklevel=2,
        )
        from services.agents.context import MemberContextService

        return MemberContextService.get_context(user_id)

    @classmethod
    async def get_context_async(cls, user_id: int | None) -> dict | None:
        """
        Get member context asynchronously.

        DEPRECATED: Returns MemberContext (not LearnerContext).
        """
        warnings.warn(
            'LearnerContextService is deprecated. Use MemberContextService from services.agents.context instead.',
            DeprecationWarning,
            stacklevel=2,
        )
        from services.agents.context import MemberContextService

        return await MemberContextService.get_context_async(user_id)
