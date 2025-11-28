from django.db import models


class Topic(models.Model):
    """
    Topics for categorizing projects and personalizing the Explore feed.
    Synced with frontend/src/config/topics.ts
    """

    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    color = models.CharField(max_length=50, help_text='Color name (e.g., blue, teal, purple)')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title']
        verbose_name = 'Topic'
        verbose_name_plural = 'Topics'
        indexes = [
            models.Index(fields=['is_active', 'slug']),
        ]

    def __str__(self):
        return self.title
