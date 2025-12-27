"""
Member context service for Ava agent.

Provides unified context about a member including:
- Learning preferences and progress
- Personalization data (UserTags, tool preferences)
- Profile information
"""

from .member_context import (
    FeatureInterests,
    Interest,
    LearningPreferences,
    LearningProgress,
    LearningStats,
    LearningSuggestion,
    MemberContext,
    MemberContextService,
    TaxonomyPreferences,
    ToolPreference,
)

__all__ = [
    # Service
    'MemberContextService',
    # TypedDicts for type hints
    'MemberContext',
    'LearningPreferences',
    'LearningStats',
    'LearningProgress',
    'LearningSuggestion',
    'ToolPreference',
    'Interest',
    'TaxonomyPreferences',
    'FeatureInterests',
]
