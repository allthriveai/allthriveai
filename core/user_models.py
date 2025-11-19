from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError
from urllib.parse import urlparse
import bleach


class UserRole(models.TextChoices):
    EXPLORER = 'explorer', 'Explorer'
    EXPERT = 'expert', 'Expert'
    MENTOR = 'mentor', 'Mentor'
    PATRON = 'patron', 'Patron'
    ADMIN = 'admin', 'Admin'


class User(AbstractUser):
    """Custom user model with role-based permissions."""
    
    # Override email to make it unique
    email = models.EmailField(unique=True, blank=False)
    
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EXPLORER,
        help_text='User role determines access level and permissions'
    )
    
    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    website_url = models.URLField(blank=True, null=True, help_text='Personal website or portfolio URL')
    calendar_url = models.URLField(blank=True, null=True, help_text='Public calendar URL for scheduling')
    
    class Meta:
        ordering = ['-date_joined']
    
    def clean(self):
        """Validate and sanitize user input fields."""
        super().clean()
        
        # Sanitize bio to prevent XSS attacks
        if self.bio:
            allowed_tags = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li']
            allowed_attrs = {'a': ['href', 'title']}
            self.bio = bleach.clean(
                self.bio,
                tags=allowed_tags,
                attributes=allowed_attrs,
                strip=True
            )
            # Limit bio length
            if len(self.bio) > 5000:
                raise ValidationError("Bio must be less than 5000 characters.")
        
        # Validate avatar_url is from allowed domains
        if self.avatar_url:
            allowed_domains = [
                'githubusercontent.com',
                'gravatar.com',
                'googleusercontent.com',
                'github.com',
                'avatars.githubusercontent.com'
            ]
            try:
                parsed = urlparse(self.avatar_url)
                domain = parsed.netloc
                if not any(allowed in domain for allowed in allowed_domains):
                    raise ValidationError(
                        f"Avatar URL must be from an allowed domain: {', '.join(allowed_domains)}"
                    )
            except Exception as e:
                raise ValidationError(f"Invalid avatar URL: {str(e)}")
    
    def save(self, *args, **kwargs):
        """Normalize username to lowercase for case-insensitivity."""
        if self.username:
            self.username = self.username.lower()
        # Run validation before saving
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
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
