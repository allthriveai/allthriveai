"""
Models for role management and upgrade requests.
"""
from django.db import models
from django.conf import settings
from .user_models import UserRole


class RoleUpgradeRequest(models.Model):
    """
    Tracks user requests to upgrade their role.
    Requires admin approval for Mentor and Admin roles.
    """
    
    class RequestStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CANCELLED = 'cancelled', 'Cancelled'
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='role_upgrade_requests'
    )
    
    current_role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        help_text='Role at the time of request'
    )
    
    requested_role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        help_text='Role user is requesting'
    )
    
    reason = models.TextField(
        help_text='User\'s explanation for requesting this role'
    )
    
    status = models.CharField(
        max_length=20,
        choices=RequestStatus.choices,
        default=RequestStatus.PENDING
    )
    
    # Admin review fields
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_role_requests'
    )
    
    review_notes = models.TextField(
        blank=True,
        help_text='Admin notes about the decision'
    )
    
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username}: {self.current_role} → {self.requested_role} ({self.status})"
    
    def can_auto_approve(self) -> bool:
        """
        Check if this request can be auto-approved.
        
        Auto-approve rules:
        - Explorer → Expert: Yes
        - Explorer → Patron: Yes
        - Expert → Patron: Yes
        - Any → Mentor: No (requires admin approval)
        - Any → Admin: No (requires admin approval)
        """
        # Mentor and Admin always require approval
        if self.requested_role in [UserRole.MENTOR, UserRole.ADMIN]:
            return False
        
        # Expert and Patron can be auto-approved from lower roles
        role_hierarchy = {
            UserRole.EXPLORER: 1,
            UserRole.EXPERT: 2,
            UserRole.MENTOR: 3,
            UserRole.PATRON: 4,
            UserRole.ADMIN: 5,
        }
        
        current_level = role_hierarchy.get(self.current_role, 0)
        requested_level = role_hierarchy.get(self.requested_role, 0)
        
        # Can only upgrade to higher level (not downgrade)
        if requested_level <= current_level:
            return False
        
        # Expert and Patron can be auto-approved
        return self.requested_role in [UserRole.EXPERT, UserRole.PATRON]


class RolePermission(models.Model):
    """
    Defines what permissions each role has.
    This is for documentation and UI display purposes.
    """
    
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        unique=True
    )
    
    display_name = models.CharField(max_length=100)
    description = models.TextField()
    badge_color = models.CharField(max_length=20, default='gray')
    
    # Permission flags
    can_create_projects = models.BooleanField(default=True)
    max_projects = models.IntegerField(default=10)
    
    can_create_showcase = models.BooleanField(default=False)
    max_showcase_projects = models.IntegerField(default=0)
    
    can_access_ai_chat = models.BooleanField(default=True)
    ai_requests_per_day = models.IntegerField(default=10)
    
    can_mentor_users = models.BooleanField(default=False)
    can_access_mentorship = models.BooleanField(default=False)
    
    can_access_premium_features = models.BooleanField(default=False)
    
    can_moderate_content = models.BooleanField(default=False)
    can_manage_users = models.BooleanField(default=False)
    
    # Priority and display order
    hierarchy_level = models.IntegerField(default=1)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['hierarchy_level']
    
    def __str__(self):
        return f"{self.display_name} (Level {self.hierarchy_level})"
