"""Audit logging models for security and change tracking."""
from django.conf import settings
from django.db import models


class UserAuditLog(models.Model):
    """Track security-relevant user actions and profile changes."""

    class Action(models.TextChoices):
        LOGIN = "login", "Login"
        LOGOUT = "logout", "Logout"
        PROFILE_UPDATE = "profile_update", "Profile Update"
        PASSWORD_CHANGE = "password_change", "Password Change"
        EMAIL_CHANGE = "email_change", "Email Change"
        ROLE_CHANGE = "role_change", "Role Change"
        FAILED_LOGIN = "failed_login", "Failed Login"
        ACCOUNT_LOCKED = "account_locked", "Account Locked"
        OAUTH_LOGIN = "oauth_login", "OAuth Login"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="audit_logs", db_index=True
    )
    action = models.CharField(max_length=50, choices=Action.choices, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    details = models.JSONField(default=dict, blank=True)
    success = models.BooleanField(default=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["action", "-timestamp"]),
            models.Index(fields=["ip_address", "-timestamp"]),
        ]
        verbose_name = "User Audit Log"
        verbose_name_plural = "User Audit Logs"

    def __str__(self):
        return f"{self.user.username} - {self.get_action_display()} at {self.timestamp}"

    @classmethod
    def log_action(cls, user, action, request=None, details=None, success=True):
        """
        Convenience method to log user actions.

        Args:
            user: User instance
            action: Action type from Action choices
            request: Django request object (optional)
            details: Additional details dict (optional)
            success: Whether the action succeeded (default True)
        """
        ip_address = None
        user_agent = ""

        if request:
            # Get IP address from request
            x_forwarded_for = request.headers.get("x-forwarded-for")
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(",")[0]
            else:
                ip_address = request.META.get("REMOTE_ADDR")

            user_agent = request.headers.get("user-agent", "")[:500]  # Limit length

        return cls.objects.create(
            user=user,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
            success=success,
        )
