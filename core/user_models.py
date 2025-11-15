from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    EXPLORER = 'explorer', 'Explorer'
    EXPERT = 'expert', 'Expert'
    MENTOR = 'mentor', 'Mentor'
    PATRON = 'patron', 'Patron'
    ADMIN = 'admin', 'Admin'


class User(AbstractUser):
    """Custom user model with role-based permissions."""
    
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EXPLORER,
        help_text='User role determines access level and permissions'
    )
    
    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-date_joined']
    
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
