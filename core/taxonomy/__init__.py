"""Taxonomy domain - Tags and categorization system.

This domain handles taxonomy management, user tags,
user interactions, and personalization.
"""
from .models import Taxonomy, UserInteraction, UserTag
from .views import TaxonomyViewSet, UserTagViewSet, track_interaction, user_personalization_overview

__all__ = [
    # Models
    "Taxonomy",
    "UserTag",
    "UserInteraction",
    # Views
    "TaxonomyViewSet",
    "UserTagViewSet",
    "user_personalization_overview",
    "track_interaction",
]
