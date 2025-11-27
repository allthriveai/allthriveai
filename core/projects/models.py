from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.text import slugify

from core.taxonomy.models import Taxonomy
from core.tools.models import Tool


class ProjectQuerySet(models.QuerySet):
    """Custom QuerySet for Project with security and performance methods."""

    def for_user(self, user):
        """Return projects accessible to the given user."""
        if user.is_staff:
            return self.all()
        # User's own projects (published or draft) + public showcase projects from others
        # Note: Explore pages now show all public projects regardless of is_published status
        return self.filter(models.Q(user=user) | models.Q(is_showcase=True, is_archived=False, is_private=False))

    def public_showcase(self):
        """Return only public showcase projects (not private, not archived)."""
        return self.filter(is_showcase=True, is_archived=False, is_private=False)

    def by_user(self, username):
        """Return projects by username."""
        return self.filter(user__username=username)


class Project(models.Model):
    """User project that appears in profile showcase/playground and has a unique URL.

    Projects are always scoped to a single user and identified publicly by
    `/{username}/{slug}`. The `content` field stores the structured layout
    blocks used to render the portfolio-style page.
    """

    class ProjectType(models.TextChoices):
        GITHUB_REPO = 'github_repo', 'GitHub Repository'
        FIGMA_DESIGN = 'figma_design', 'Figma Design'
        IMAGE_COLLECTION = 'image_collection', 'Image Collection'
        PROMPT = 'prompt', 'Prompt / Conversation'
        OTHER = 'other', 'Other'

    objects = ProjectQuerySet.as_manager()

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    slug = models.SlugField(max_length=200)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(
        max_length=32,
        choices=ProjectType.choices,
        default=ProjectType.OTHER,
    )
    is_showcase = models.BooleanField(default=True, help_text='Display in showcase section')
    is_highlighted = models.BooleanField(
        default=False, db_index=True, help_text='Featured at top of profile (only one per user)'
    )
    is_private = models.BooleanField(default=False, help_text='Hidden from public, only visible to owner')
    is_archived = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True, help_text='Whether project is publicly visible')
    published_at = models.DateTimeField(null=True, blank=True, help_text='When project was first published')
    # CharField supports both full URLs and relative paths (e.g., /path/to/image)
    banner_url = models.CharField(max_length=500, blank=True, default='', help_text='Banner image URL')
    # Featured image for cards and social sharing
    featured_image_url = models.CharField(
        max_length=500, blank=True, default='', help_text='Featured image for project cards'
    )
    # External project URL (e.g., live demo, GitHub repo)
    external_url = models.URLField(
        max_length=500, blank=True, default='', help_text='External URL for this project (e.g., live demo, GitHub repo)'
    )
    # Tools used in this project
    tools = models.ManyToManyField(
        Tool, blank=True, related_name='projects', help_text='Tools/technologies used in this project'
    )
    # Categories for filtering and organization (predefined taxonomy)
    categories = models.ManyToManyField(
        Taxonomy,
        blank=True,
        related_name='projects',
        limit_choices_to={'taxonomy_type': 'category', 'is_active': True},
        help_text='Categories that organize this project (from predefined Taxonomy)',
    )
    # User-generated topics (free-form, moderated)
    topics = ArrayField(
        models.CharField(max_length=50),
        blank=True,
        default=list,
        help_text='User-generated topics (moderated for inappropriate content)',
    )
    # Structured layout blocks for the project page (cover, tags, text/image blocks)
    content = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'slug'],
                name='unique_project_slug_per_user',
            ),
            models.UniqueConstraint(
                fields=['user', 'external_url'],
                condition=models.Q(external_url__isnull=False) & ~models.Q(external_url=''),
                name='unique_external_url_per_user',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'slug']),
            models.Index(fields=['user', 'external_url']),  # For duplicate detection
            models.Index(fields=['is_showcase', 'is_archived', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['is_published', '-published_at']),  # For browse/explore pages
        ]

    def __str__(self):
        return f'{self.title} ({self.user.username}/{self.slug})'

    @property
    def heart_count(self):
        """Get the number of hearts/likes for this project."""
        return self.likes.count()

    def ensure_unique_slug(self):
        """Ensure `slug` is set and unique for this user.

        If slug is empty, generate from title. If there is a collision for this
        user, append a numeric suffix (-2, -3, ...) until unique.
        Optimized to use a single database query.
        """
        base = self.slug or self.title or 'project'
        slug = slugify(base) or 'project'

        # Check if base slug is available
        existing = Project.objects.filter(user=self.user, slug=slug).exclude(pk=self.pk)
        if not existing.exists():
            self.slug = slug
            return

        # Find all similar slugs in a single query (e.g., 'my-project', 'my-project-2', 'my-project-3')
        similar_slugs = (
            Project.objects.filter(user=self.user, slug__startswith=f'{slug}-')
            .exclude(pk=self.pk)
            .values_list('slug', flat=True)
        )

        # Extract numeric suffixes and find the next available number
        used_numbers = set()
        for existing_slug in similar_slugs:
            # Extract suffix after last dash
            suffix = existing_slug[len(slug) + 1 :]  # +1 for the dash
            if suffix.isdigit():
                used_numbers.add(int(suffix))

        # Find first available number starting from 2
        counter = 2
        while counter in used_numbers:
            counter += 1

        self.slug = f'{slug}-{counter}'

    def save(self, *args, **kwargs):
        # Only attempt slug handling if we have a user (may not be set in some
        # migration contexts).
        if self.user_id:
            self.ensure_unique_slug()

            # Ensure only one highlighted project per user
            if self.is_highlighted:
                # Un-highlight any other projects for this user
                Project.objects.filter(user=self.user, is_highlighted=True).exclude(pk=self.pk).update(
                    is_highlighted=False
                )

        # Set published_at timestamp when first published
        if self.is_published and not self.published_at:
            from django.utils import timezone

            self.published_at = timezone.now()

        super().save(*args, **kwargs)


class ProjectLike(models.Model):
    """Track user likes/hearts on projects."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_likes')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'project'],
                name='unique_project_like_per_user',
            )
        ]
        indexes = [
            models.Index(fields=['project', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} likes {self.project.title}'


class ProjectComment(models.Model):
    """User comments/feedback on projects with AI moderation."""

    class ModerationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        FLAGGED = 'flagged', 'Flagged for Manual Review'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_comments')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField(help_text='Comment content')

    # Moderation fields
    moderation_status = models.CharField(
        max_length=20, choices=ModerationStatus.choices, default=ModerationStatus.PENDING, db_index=True
    )
    moderation_reason = models.TextField(blank=True, default='', help_text='Reason for moderation decision')
    moderation_data = models.JSONField(default=dict, blank=True, help_text='Full moderation API response data')
    moderated_at = models.DateTimeField(null=True, blank=True, help_text='When moderation was performed')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', 'moderation_status', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['moderation_status', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username} on {self.project.title}: {self.content[:50]}'

    def upvote_count(self):
        """Get number of upvotes. Use annotation when querying lists."""
        # Check if value was annotated in queryset
        if hasattr(self, '_upvote_count'):
            return self._upvote_count
        return self.votes.filter(vote_type='up').count()

    def downvote_count(self):
        """Get number of downvotes. Use annotation when querying lists."""
        # Check if value was annotated in queryset
        if hasattr(self, '_downvote_count'):
            return self._downvote_count
        return self.votes.filter(vote_type='down').count()

    def score(self):
        """Get net score (upvotes - downvotes). Use annotation when querying lists."""
        # Check if value was annotated in queryset
        if hasattr(self, '_score'):
            return self._score
        return self.upvote_count() - self.downvote_count()


class CommentVote(models.Model):
    """Track user votes (upvote/downvote) on comments."""

    class VoteType(models.TextChoices):
        UP = 'up', 'Upvote'
        DOWN = 'down', 'Downvote'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comment_votes')
    comment = models.ForeignKey(ProjectComment, on_delete=models.CASCADE, related_name='votes')
    vote_type = models.CharField(max_length=4, choices=VoteType.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'comment'],
                name='unique_comment_vote_per_user',
            )
        ]
        indexes = [
            models.Index(fields=['comment', 'vote_type']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username} {self.vote_type}votes comment #{self.comment.id}'


# Django signals for automatic personalization


@receiver(post_save, sender=Project)
def auto_tag_project_on_save(sender, instance, created, **kwargs):
    """
    Automatically detect user preferences when a project is created or updated.

    This signal triggers the personalization system to:
    1. Extract tools mentioned in the project
    2. Create/update UserTags with confidence scores
    3. Link detected tools to the project

    Only runs when the project has a user (not during migrations).
    """
    # Only auto-tag if project has a user
    if not instance.user:
        return

    # Import here to avoid circular imports
    from core.taxonomy.services import auto_tag_project

    try:
        auto_tag_project(instance)
    except Exception as e:
        # Log error but don't fail the save operation
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error auto-tagging project '{instance.title}': {e}", exc_info=True)
