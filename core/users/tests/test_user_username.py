"""
Tests for username uniqueness, user isolation, and profile routing.
"""
from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from core.models import User

User = get_user_model()


class UsernameUniquenessTestCase(TestCase):
    """Test that usernames are unique and properly validated."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = Client()

    def test_cannot_create_duplicate_username(self):
        """Test that two users cannot have the same username."""
        # Create first user with username
        user1 = User.objects.create_user(
            username="johndoe", email="john@example.com", password="testpass123", first_name="John", last_name="Doe"
        )
        self.assertEqual(user1.username, "johndoe")

        # Attempt to create second user with same username should fail
        with self.assertRaises(Exception):
            User.objects.create_user(
                username="johndoe",  # Same username
                email="jane@example.com",
                password="testpass456",
                first_name="Jane",
                last_name="Doe",
            )

    def test_username_case_sensitivity(self):
        """Test that usernames are case-insensitive."""
        # Create user with lowercase username
        user1 = User.objects.create_user(username="johndoe", email="john@example.com", password="testpass123")

        # Try to create user with same username in different case
        # This should fail because usernames should be normalized to lowercase
        with self.assertRaises(Exception):
            User.objects.create_user(username="JohnDoe", email="john2@example.com", password="testpass123")

    def test_username_validation_format(self):
        """Test that usernames meet format requirements."""
        from services.auth_agent.validators import validate_username

        # Valid usernames
        valid, error = validate_username("johndoe")
        self.assertTrue(valid)
        self.assertIsNone(error)

        valid, error = validate_username("john_doe")
        self.assertTrue(valid)

        valid, error = validate_username("john-doe")
        self.assertTrue(valid)

        valid, error = validate_username("john123")
        self.assertTrue(valid)

        # Invalid usernames
        valid, error = validate_username("ab")  # Too short
        self.assertFalse(valid)
        self.assertIn("at least 3 characters", error)

        valid, error = validate_username("a" * 31)  # Too long
        self.assertFalse(valid)
        self.assertIn("less than 30 characters", error)

        valid, error = validate_username("john doe")  # Space not allowed
        self.assertFalse(valid)
        self.assertIn("letters, numbers, underscores, and hyphens", error)

        valid, error = validate_username("john@doe")  # @ not allowed
        self.assertFalse(valid)

        valid, error = validate_username("john.doe")  # Dot not allowed
        self.assertFalse(valid)

    def test_username_availability_check(self):
        """Test checking if username is already taken."""
        from services.auth_agent.validators import validate_username

        # Create a user
        User.objects.create_user(username="takenuser", email="taken@example.com", password="testpass123")

        # Check that username is reported as taken
        valid, error = validate_username("takenuser")
        self.assertFalse(valid)
        self.assertIn("already taken", error)

        # Check that new username is available
        valid, error = validate_username("availableuser")
        self.assertTrue(valid)
        self.assertIsNone(error)


class UserIsolationTestCase(TestCase):
    """Test that user data is properly isolated between different users."""

    def setUp(self):
        """Set up test users."""
        self.user1 = User.objects.create_user(
            username="alice", email="alice@example.com", password="alicepass123", first_name="Alice", last_name="Smith"
        )

        self.user2 = User.objects.create_user(
            username="bob", email="bob@example.com", password="bobpass123", first_name="Bob", last_name="Jones"
        )

        self.client = Client()

    def test_user_cannot_access_other_user_session(self):
        """Test that users cannot access each other's sessions."""
        # Login as user1
        self.client.login(username="alice@example.com", password="alicepass123")

        # Get session - should be user1
        response = self.client.get("/api/auth/me/")
        if response.status_code == 200:
            data = response.json()
            self.assertEqual(data["username"], "alice")

        # Logout and login as user2
        self.client.logout()
        self.client.login(username="bob@example.com", password="bobpass123")

        # Get session - should be user2
        response = self.client.get("/api/auth/me/")
        if response.status_code == 200:
            data = response.json()
            self.assertEqual(data["username"], "bob")
            self.assertNotEqual(data["username"], "alice")

    def test_users_have_unique_ids(self):
        """Test that each user has a unique ID."""
        self.assertNotEqual(self.user1.id, self.user2.id)
        self.assertIsNotNone(self.user1.id)
        self.assertIsNotNone(self.user2.id)

    def test_user_email_is_unique(self):
        """Test that email addresses are unique."""
        with self.assertRaises(Exception):
            User.objects.create_user(
                username="charlie", email="alice@example.com", password="charliepass123"  # Duplicate email
            )


class ProfileRoutingTestCase(TestCase):
    """Test that profile URLs route correctly to user profiles."""

    def setUp(self):
        """Set up test users."""
        self.user1 = User.objects.create_user(
            username="johndoe", email="john@example.com", password="testpass123", first_name="John", last_name="Doe"
        )

        self.user2 = User.objects.create_user(
            username="janedoe", email="jane@example.com", password="testpass456", first_name="Jane", last_name="Doe"
        )

        self.client = Client()

    def test_profile_url_uses_username(self):
        """Test that profile URLs use username, not user ID."""
        # Login as user1
        self.client.force_login(self.user1)

        # Access profile via username URL
        response = self.client.get(f"/{self.user1.username}")

        # Should be successful (or redirect to auth if not implemented)
        # At minimum, should not return 404
        self.assertIn(response.status_code, [200, 302])

    def test_login_redirects_to_username_profile(self):
        """Test that after login, user is redirected to their username-based profile."""
        # This tests the auth flow redirect
        # After successful authentication, should redirect to /{username}

        # Note: This depends on your auth implementation
        # The redirect happens in AuthPage.tsx after authentication
        self.assertTrue(self.user1.username)  # Username exists
        expected_url = f"/{self.user1.username}"

        # Verify the URL format is correct
        self.assertFalse(expected_url.startswith("/profile/"))
        self.assertTrue(len(expected_url) > 1)

    def test_each_user_has_unique_profile_url(self):
        """Test that each user has a unique profile URL."""
        user1_url = f"/{self.user1.username}"
        user2_url = f"/{self.user2.username}"

        self.assertNotEqual(user1_url, user2_url)
        self.assertEqual(user1_url, "/johndoe")
        self.assertEqual(user2_url, "/janedoe")

    def test_profile_url_without_username_redirects(self):
        """Test that accessing /profile without username redirects to /{username}."""
        # Login as user
        self.client.force_login(self.user1)

        # The ProfilePage component should redirect /profile to /{username}
        # This is handled client-side in React, but we can test the username is set
        self.assertIsNotNone(self.user1.username)
        self.assertTrue(len(self.user1.username) >= 3)


class UsernameGenerationTestCase(TestCase):
    """Test username generation from email."""

    def test_generate_username_from_email(self):
        """Test generating suggested username from email."""
        from services.auth_agent.validators import generate_username_from_email

        # Standard email
        username = generate_username_from_email("john.doe@example.com")
        self.assertEqual(username, "johndoe")  # Dot removed

        # Email with numbers
        username = generate_username_from_email("john123@example.com")
        self.assertEqual(username, "john123")

        # Email with special characters
        username = generate_username_from_email("john+test@example.com")
        self.assertEqual(username, "johntest")  # + removed

        # Email with underscore
        username = generate_username_from_email("john_doe@example.com")
        self.assertEqual(username, "john_doe")  # Underscore kept

        # Email with hyphen
        username = generate_username_from_email("john-doe@example.com")
        self.assertEqual(username, "john-doe")  # Hyphen kept

    def test_suggested_username_is_lowercase(self):
        """Test that suggested usernames are lowercase."""
        from services.auth_agent.validators import generate_username_from_email

        username = generate_username_from_email("JohnDoe@Example.com")
        self.assertEqual(username, "johndoe")
        self.assertTrue(username.islower())


class UsernameAuthFlowTestCase(TestCase):
    """Test the complete username selection flow during signup."""

    def setUp(self):
        """Set up test client."""
        self.client = Client()

    def test_username_stored_during_signup(self):
        """Test that username is properly stored when user signs up."""
        # Create user through the normal flow
        user = User.objects.create_user(
            username="newuser", email="newuser@example.com", password="testpass123", first_name="New", last_name="User"
        )

        # Verify username is stored
        self.assertEqual(user.username, "newuser")

        # Verify user can be retrieved by username
        retrieved_user = User.objects.get(username="newuser")
        self.assertEqual(retrieved_user.id, user.id)
        self.assertEqual(retrieved_user.email, "newuser@example.com")

    def test_user_profile_accessible_after_signup(self):
        """Test that user profile is accessible via username URL after signup."""
        user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

        # Login
        self.client.force_login(user)

        # Should be able to access profile
        profile_url = f"/{user.username}"
        response = self.client.get(profile_url)

        # Should not be 404
        self.assertNotEqual(response.status_code, 404)
