"""
Base test classes with shared setup, teardown, and helper methods.

These classes follow DRY principles by consolidating common test patterns
used across the AllThrive AI test suite.
"""

from rest_framework.test import APIClient, APITestCase

from core.users.models import User


class BaseAPITestCase(APITestCase):
    """Base test case with common API testing utilities."""

    def setUp(self):
        """Set up test client and create a test user."""
        super().setUp()
        self.client = APIClient()
        self.user = self.create_test_user()

    def create_test_user(self, username='testuser', email='test@example.com', **kwargs):
        """
        Create a test user with default or custom attributes.

        Args:
            username: Username for the test user
            email: Email for the test user
            **kwargs: Additional user attributes

        Returns:
            User instance
        """
        return User.objects.create_user(username=username, email=email, password='testpass123', **kwargs)

    def authenticate_user(self, user=None):
        """
        Authenticate a user for API requests.

        Args:
            user: User instance to authenticate (defaults to self.user)
        """
        user = user or self.user
        self.client.force_authenticate(user=user)

    def create_admin_user(self, username='admin', email='admin@example.com'):
        """
        Create an admin user.

        Args:
            username: Username for the admin user
            email: Email for the admin user

        Returns:
            Admin user instance
        """
        return User.objects.create_superuser(username=username, email=email, password='adminpass123')

    def assertSuccessResponse(self, response, status_code=200):
        """
        Assert that response is successful with expected status code.

        Args:
            response: API response object
            status_code: Expected HTTP status code
        """
        self.assertEqual(response.status_code, status_code)

    def assertErrorResponse(self, response, status_code=400):
        """
        Assert that response is an error with expected status code.

        Args:
            response: API response object
            status_code: Expected HTTP status code
        """
        self.assertEqual(response.status_code, status_code)


class BaseAuthenticatedTestCase(BaseAPITestCase):
    """Base test case with authenticated user by default."""

    def setUp(self):
        """Set up test client with authenticated user."""
        super().setUp()
        self.authenticate_user()


class BaseMockTestCase(BaseAPITestCase):
    """Base test case with common mock helper methods."""

    def create_mock_response(self, status_code=200, json_data=None):
        """
        Create a mock HTTP response.

        Args:
            status_code: HTTP status code for the mock response
            json_data: Dictionary to be returned by json() method

        Returns:
            Mock response object
        """
        from unittest.mock import MagicMock

        mock_response = MagicMock()
        mock_response.status_code = status_code
        if json_data is not None:
            mock_response.json.return_value = json_data
        return mock_response

    def create_mock_agent(self, mock_astream_events=None):
        """
        Create a mock agent with common configuration.

        Args:
            mock_astream_events: Mock async stream events (optional)

        Returns:
            Mock agent object
        """
        from unittest.mock import MagicMock, Mock

        mock_agent = MagicMock()
        if mock_astream_events:
            mock_agent.astream_events = mock_astream_events
        mock_agent.get_state.return_value = Mock(values={'messages': []})
        return mock_agent
