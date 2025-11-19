from django.db import models
from django.utils.text import slugify
from .user_models import User, UserRole
from .audit_models import UserAuditLog
from .role_models import RoleUpgradeRequest, RolePermission
from .referral_models import ReferralCode, Referral, ReferralStatus
from .taxonomy_models import Taxonomy, UserTag, UserInteraction

# Export User and UserRole for easy imports
__all__ = [
    'User', 'UserRole', 'Conversation', 'Message', 'Project', 
    'UserAuditLog', 'RoleUpgradeRequest', 'RolePermission',
    'ReferralCode', 'Referral', 'ReferralStatus',
    'Taxonomy', 'UserTag', 'UserInteraction', 'SoftDeleteManager', 'BaseModel'
]


class SoftDeleteManager(models.Manager):
    """Manager that excludes soft-deleted objects by default."""
    
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class BaseModel(models.Model):
    """Base model with soft delete capability and audit timestamps.
    
    All models that need soft deletion should inherit from this.
    Soft deleted objects are excluded from default queries but can be
    accessed via all_objects manager.
    """
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text='Timestamp when object was soft deleted'
    )
    
    objects = SoftDeleteManager()
    all_objects = models.Manager()  # Include soft-deleted objects
    
    class Meta:
        abstract = True
    
    def soft_delete(self):
        """Mark object as deleted without removing from database."""
        from django.utils import timezone
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])
    
    def restore(self):
        """Restore a soft-deleted object."""
        self.deleted_at = None
        self.save(update_fields=['deleted_at'])
    
    @property
    def is_deleted(self):
        """Check if object is soft-deleted."""
        return self.deleted_at is not None


class Conversation(BaseModel):
    """Model to store AI conversation history.
    
    Supports soft deletion to maintain audit trail even when user deletes conversations.
    """
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='conversations')
    title = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['-updated_at', 'deleted_at']),
        ]

    def __str__(self):
        username = self.user.username if self.user else 'Unknown'
        return f"{self.title or 'Conversation'} - {username}"


class Message(models.Model):
    """Model to store individual messages in a conversation.
    
    Messages are CASCADE deleted if conversation is hard-deleted,
    but soft-deletion of conversation preserves messages.
    """
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['conversation', 'role']),
        ]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."


class ProjectQuerySet(models.QuerySet):
    """Custom QuerySet for Project with security and performance methods."""
    
    def for_user(self, user):
        """Return projects accessible to the given user."""
        if user.is_staff:
            return self.all()
        # User's own projects (published or draft) + published public showcase projects from others
        return self.filter(
            models.Q(user=user) | 
            models.Q(is_showcase=True, is_published=True, is_archived=False)
        )
    
    def public_showcase(self):
        """Return only published public showcase projects."""
        return self.filter(is_showcase=True, is_published=True, is_archived=False)
    
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
        IMAGE_COLLECTION = 'image_collection', 'Image Collection'
        PROMPT = 'prompt', 'Prompt / Conversation'
        OTHER = 'other', 'Other'
    
    objects = ProjectQuerySet.as_manager()

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    slug = models.SlugField(max_length=200)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(
        max_length=32,
        choices=ProjectType.choices,
        default=ProjectType.OTHER,
    )
    is_showcase = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False, help_text="Whether project is publicly visible")
    published_at = models.DateTimeField(null=True, blank=True, help_text="When project was first published")
    thumbnail_url = models.URLField(blank=True, null=True)
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
            )
        ]
        indexes = [
            models.Index(fields=['user', 'slug']),
            models.Index(fields=['is_showcase', 'is_archived', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.title} ({self.user.username}/{self.slug})"

    def ensure_unique_slug(self):
        """Ensure `slug` is set and unique for this user.

        If slug is empty, generate from title. If there is a collision for this
        user, append a numeric suffix (-2, -3, ...) until unique.
        """
        base = self.slug or self.title or 'project'
        slug = slugify(base) or 'project'
        existing = (
            Project.objects.filter(user=self.user, slug=slug)
            .exclude(pk=self.pk)
        )
        counter = 2
        while existing.exists():
            candidate = f"{slug}-{counter}"
            existing = (
                Project.objects.filter(user=self.user, slug=candidate)
                .exclude(pk=self.pk)
            )
            if not existing.exists():
                slug = candidate
                break
            counter += 1
        self.slug = slug

    def save(self, *args, **kwargs):
        # Only attempt slug handling if we have a user (may not be set in some
        # migration contexts).
        if self.user_id:
            self.ensure_unique_slug()
        super().save(*args, **kwargs)
