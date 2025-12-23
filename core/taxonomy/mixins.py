"""Mixins for taxonomy-related model fields."""

import uuid

from django.db import models


class WeaviateSyncMixin(models.Model):
    """Mixin for tracking Weaviate vector database sync status.

    Provides fields needed to track when content was last indexed in Weaviate
    and to maintain a stable UUID for the Weaviate object.

    Apply to: Project, Quiz, Tool, MicroLesson
    """

    weaviate_uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        db_index=True,
        help_text='Stable UUID for Weaviate object reference',
    )

    last_indexed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text='When this content was last indexed in Weaviate',
    )

    class Meta:
        abstract = True

    def needs_reindex(self) -> bool:
        """Check if content needs to be reindexed in Weaviate.

        Returns True if:
        - Never indexed (last_indexed_at is None)
        - Updated after last index (updated_at > last_indexed_at)
        """
        if self.last_indexed_at is None:
            return True
        # Check if model has updated_at field
        if hasattr(self, 'updated_at') and self.updated_at:
            return self.updated_at > self.last_indexed_at
        return False


class ContentMetadataMixin(models.Model):
    """Shared taxonomy fields for all content types.

    Provides consistent content classification fields that can be:
    - AI-populated automatically during import
    - Manually set/overridden by users
    - Used for filtering and recommendations

    Apply to: Project, Quiz, SideQuest, MicroLesson
    """

    content_type_taxonomy = models.ForeignKey(
        'core.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_of_type',
        limit_choices_to={'taxonomy_type': 'content_type', 'is_active': True},
        help_text='Content format (article, video, code-repo, course, etc.)',
    )

    time_investment = models.ForeignKey(
        'core.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_with_time',
        limit_choices_to={'taxonomy_type': 'time_investment', 'is_active': True},
        help_text='Time to consume (quick, short, medium, deep-dive)',
    )

    difficulty_taxonomy = models.ForeignKey(
        'core.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_with_difficulty',
        limit_choices_to={'taxonomy_type': 'difficulty', 'is_active': True},
        help_text='Content difficulty level (beginner, intermediate, advanced)',
    )

    pricing_taxonomy = models.ForeignKey(
        'core.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_with_pricing',
        limit_choices_to={'taxonomy_type': 'pricing', 'is_active': True},
        help_text='Pricing tier (free, freemium, paid)',
    )

    ai_tag_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='AI-generated tag metadata: {field: {confidence, model, timestamp}}',
    )

    class Meta:
        abstract = True
