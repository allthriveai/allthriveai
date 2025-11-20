from urllib.parse import urlparse

import bleach
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class UserRole(models.TextChoices):
    EXPLORER = 'explorer', 'Explorer'
    EXPERT = 'expert', 'Expert'
    MENTOR = 'mentor', 'Mentor'
    PATRON = 'patron', 'Patron'
    ADMIN = 'admin', 'Admin'
    BOT = 'bot', 'Bot'


class User(AbstractUser):
    """Custom user model with role-based permissions."""

    # Override email to make it unique
    email = models.EmailField(unique=True, blank=False)

    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EXPLORER,
        help_text='User role determines access level and permissions',
    )

    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    tagline = models.CharField(max_length=150, blank=True, help_text='Short headline or professional title')
    location = models.CharField(max_length=100, blank=True, help_text='City, state/country or "Remote"')
    pronouns = models.CharField(max_length=50, blank=True, help_text='e.g. she/her, he/him, they/them')
    current_status = models.CharField(
        max_length=200, blank=True, help_text="Current availability or what you're working on"
    )
    website_url = models.URLField(blank=True, null=True, help_text='Personal website or portfolio URL')
    calendar_url = models.URLField(blank=True, null=True, help_text='Public calendar URL for scheduling')

    # Social media links for public profile
    linkedin_url = models.URLField(blank=True, null=True, help_text='LinkedIn profile URL')
    twitter_url = models.URLField(blank=True, null=True, help_text='Twitter/X profile URL')
    github_url = models.URLField(blank=True, null=True, help_text='GitHub profile URL')
    youtube_url = models.URLField(blank=True, null=True, help_text='YouTube channel URL')
    instagram_url = models.URLField(blank=True, null=True, help_text='Instagram profile URL')

    # Privacy settings
    playground_is_public = models.BooleanField(default=True, help_text='Allow others to view your Playground projects')

    # Points and gamification
    total_points = models.IntegerField(default=0, help_text='Total points earned by user')
    level = models.IntegerField(default=1, help_text='User level calculated from points')
    current_streak = models.IntegerField(default=0, help_text='Current consecutive days login streak')
    max_streak = models.IntegerField(default=0, help_text='Longest login streak achieved')
    last_login_date = models.DateField(null=True, blank=True, help_text='Date of last login for streak tracking')

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['-total_points'], name='user_points_idx'),  # For leaderboards
            models.Index(fields=['level', '-total_points'], name='user_level_points_idx'),  # For level queries
        ]

    def clean(self):
        """Validate and sanitize user input fields."""
        super().clean()

        # Sanitize bio to prevent XSS attacks
        if self.bio:
            allowed_tags = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li']
            allowed_attrs = {'a': ['href', 'title']}
            self.bio = bleach.clean(self.bio, tags=allowed_tags, attributes=allowed_attrs, strip=True)
            # Limit bio length
            if len(self.bio) > 5000:
                raise ValidationError('Bio must be less than 5000 characters.')

        # Validate avatar_url is from allowed domains (skip for bots)
        if self.avatar_url and self.role != UserRole.BOT:
            allowed_domains = [
                'githubusercontent.com',
                'gravatar.com',
                'googleusercontent.com',
                'github.com',
                'avatars.githubusercontent.com',
            ]
            try:
                parsed = urlparse(self.avatar_url)
                domain = parsed.netloc
                if not any(allowed in domain for allowed in allowed_domains):
                    raise ValidationError(f'Avatar URL must be from an allowed domain: {", ".join(allowed_domains)}')
            except Exception as e:
                raise ValidationError(f'Invalid avatar URL: {str(e)}') from e

    def save(self, *args, **kwargs):
        """Normalize username to lowercase for case-insensitivity."""
        if self.username:
            self.username = self.username.lower()
        # Run validation before saving
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_explorer(self):
        return self.role == UserRole.EXPLORER

    @property
    def is_expert(self):
        return self.role == UserRole.EXPERT

    @property
    def is_mentor(self):
        return self.role == UserRole.MENTOR

    @property
    def is_patron(self):
        return self.role == UserRole.PATRON

    @property
    def is_admin_role(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    @property
    def is_bot(self):
        return self.role == UserRole.BOT

    def has_role_permission(self, required_role: str) -> bool:
        """Check if user has at least the required role level."""
        role_hierarchy = {
            UserRole.EXPLORER: 1,
            UserRole.EXPERT: 2,
            UserRole.MENTOR: 3,
            UserRole.PATRON: 4,
            UserRole.ADMIN: 5,
        }

        if self.is_superuser:
            return True

        user_level = role_hierarchy.get(self.role, 0)
        required_level = role_hierarchy.get(required_role, 0)

        return user_level >= required_level
