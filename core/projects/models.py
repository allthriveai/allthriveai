from django.conf import settings
from django.db import models
from django.utils.text import slugify


class ProjectQuerySet(models.QuerySet):
    """Custom QuerySet for Project with security and performance methods."""

    def for_user(self, user):
        """Return projects accessible to the given user."""
        if user.is_staff:
            return self.all()
        # User's own projects (published or draft) + published public showcase projects from others
        return self.filter(models.Q(user=user) | models.Q(is_showcase=True, is_published=True, is_archived=False))

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
        GITHUB_REPO = "github_repo", "GitHub Repository"
        IMAGE_COLLECTION = "image_collection", "Image Collection"
        PROMPT = "prompt", "Prompt / Conversation"
        OTHER = "other", "Other"

    objects = ProjectQuerySet.as_manager()

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects")
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
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "slug"],
                name="unique_project_slug_per_user",
            )
        ]
        indexes = [
            models.Index(fields=["user", "slug"]),
            models.Index(fields=["is_showcase", "is_archived", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.user.username}/{self.slug})"

    def ensure_unique_slug(self):
        """Ensure `slug` is set and unique for this user.

        If slug is empty, generate from title. If there is a collision for this
        user, append a numeric suffix (-2, -3, ...) until unique.
        """
        base = self.slug or self.title or "project"
        slug = slugify(base) or "project"
        existing = Project.objects.filter(user=self.user, slug=slug).exclude(pk=self.pk)
        counter = 2
        while existing.exists():
            candidate = f"{slug}-{counter}"
            existing = Project.objects.filter(user=self.user, slug=candidate).exclude(pk=self.pk)
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
