"""
Tests for user avatar URL validation.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

User = get_user_model()


class AvatarURLValidationTestCase(TestCase):
    """Test avatar URL validation."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

    def test_github_avatar_url_allowed(self):
        """Test that GitHub avatar URLs are allowed."""
        self.user.avatar_url = 'https://avatars.githubusercontent.com/u/12345'
        self.user.clean()  # Should not raise

    def test_google_avatar_url_allowed(self):
        """Test that Google avatar URLs are allowed."""
        self.user.avatar_url = 'https://lh3.googleusercontent.com/a/photo.jpg'
        self.user.clean()  # Should not raise

    def test_gravatar_url_allowed(self):
        """Test that Gravatar URLs are allowed."""
        self.user.avatar_url = 'https://www.gravatar.com/avatar/12345'
        self.user.clean()  # Should not raise

    @override_settings(MINIO_ENDPOINT_PUBLIC='localhost:9000')
    def test_minio_avatar_url_allowed(self):
        """Test that MinIO avatar URLs are allowed."""
        minio_endpoint = settings.MINIO_ENDPOINT_PUBLIC
        self.user.avatar_url = f'http://{minio_endpoint}/allthrive-media/public/avatars/user_1/test.jpg'
        self.user.clean()  # Should not raise

    @override_settings(MINIO_ENDPOINT_PUBLIC='minio.example.com')
    def test_minio_custom_domain_allowed(self):
        """Test that MinIO URLs with custom domain are allowed."""
        self.user.avatar_url = 'https://minio.example.com/allthrive-media/public/avatars/user_1/test.jpg'
        self.user.clean()  # Should not raise

    def test_invalid_domain_rejected(self):
        """Test that URLs from non-allowed domains are rejected."""
        self.user.avatar_url = 'https://malicious-site.com/avatar.jpg'
        with self.assertRaises(ValidationError) as cm:
            self.user.clean()
        self.assertIn('Avatar URL must be from an allowed domain', str(cm.exception))

    def test_empty_avatar_url_allowed(self):
        """Test that empty avatar URL is allowed."""
        self.user.avatar_url = ''
        self.user.clean()  # Should not raise

    def test_none_avatar_url_allowed(self):
        """Test that None avatar URL is allowed."""
        self.user.avatar_url = None
        self.user.clean()  # Should not raise

    def test_agent_user_bypass_validation(self):
        """Test that agent users can use any avatar URL."""
        from core.users.models import UserRole

        agent_user = User.objects.create_user(
            username='agentuser', email='agent@example.com', password='testpass123', role=UserRole.AGENT
        )
        agent_user.avatar_url = 'https://any-domain.com/avatar.jpg'
        agent_user.clean()  # Should not raise - agents bypass validation
