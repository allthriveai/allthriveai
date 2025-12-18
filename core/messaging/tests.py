"""Tests for messaging app."""

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.projects.models import Project
from core.users.models import User

from .models import ConnectionRequest, DirectMessage, DirectMessageThread, UserBlock

# Test password - S106 is acceptable in test files
TEST_PASSWORD = 'testpass123'  # noqa: S105


class ConnectionRequestModelTest(TestCase):
    """Test ConnectionRequest model."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='requester',
            email='requester@test.com',
            password=TEST_PASSWORD,
        )
        self.user2 = User.objects.create_user(
            username='recipient',
            email='recipient@test.com',
            password=TEST_PASSWORD,
        )
        self.project = Project.objects.create(
            user=self.user2,
            title='Test Project',
            contact_enabled=True,
        )

    def test_create_connection_request(self):
        """Test creating a connection request."""
        request = ConnectionRequest.objects.create(
            requester=self.user1,
            recipient=self.user2,
            project=self.project,
            intro_message='Hello, I want to connect!',
        )
        self.assertEqual(request.status, ConnectionRequest.Status.PENDING)
        self.assertIsNotNone(request.expires_at)

    def test_accept_creates_thread(self):
        """Test accepting a request creates a message thread."""
        request = ConnectionRequest.objects.create(
            requester=self.user1,
            recipient=self.user2,
            project=self.project,
            intro_message='Hello!',
        )
        thread = request.accept()

        self.assertEqual(request.status, ConnectionRequest.Status.ACCEPTED)
        self.assertIsNotNone(thread)
        self.assertEqual(thread.participants.count(), 2)
        self.assertIn(self.user1, thread.participants.all())
        self.assertIn(self.user2, thread.participants.all())

    def test_decline_request(self):
        """Test declining a request."""
        request = ConnectionRequest.objects.create(
            requester=self.user1,
            recipient=self.user2,
            project=self.project,
            intro_message='Hello!',
        )
        request.decline()

        self.assertEqual(request.status, ConnectionRequest.Status.DECLINED)
        self.assertIsNotNone(request.responded_at)


class DirectMessageTest(TestCase):
    """Test DirectMessage model."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='sender',
            email='sender@test.com',
            password=TEST_PASSWORD,
        )
        self.user2 = User.objects.create_user(
            username='receiver',
            email='receiver@test.com',
            password=TEST_PASSWORD,
        )
        self.thread, _ = DirectMessageThread.objects.get_or_create_for_users(self.user1, self.user2)

    def test_send_message_updates_thread(self):
        """Test sending a message updates thread's last message info."""
        _message = DirectMessage.objects.create(
            thread=self.thread,
            sender=self.user1,
            content='Hello!',
        )

        self.thread.refresh_from_db()
        self.assertEqual(self.thread.last_message_preview, 'Hello!')
        self.assertEqual(self.thread.last_message_sender, self.user1)

    def test_unread_count(self):
        """Test unread message count."""
        DirectMessage.objects.create(
            thread=self.thread,
            sender=self.user1,
            content='Message 1',
        )
        DirectMessage.objects.create(
            thread=self.thread,
            sender=self.user1,
            content='Message 2',
        )

        # user2 should have 2 unread messages
        self.assertEqual(self.thread.get_unread_count(self.user2), 2)
        # user1 should have 0 (they sent the messages)
        self.assertEqual(self.thread.get_unread_count(self.user1), 0)


class UserBlockTest(TestCase):
    """Test UserBlock model."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='blocker',
            email='blocker@test.com',
            password=TEST_PASSWORD,
        )
        self.user2 = User.objects.create_user(
            username='blocked',
            email='blocked@test.com',
            password=TEST_PASSWORD,
        )

    def test_block_user(self):
        """Test blocking a user."""
        UserBlock.objects.create(blocker=self.user1, blocked=self.user2)

        self.assertTrue(UserBlock.is_blocked(self.user1, self.user2))
        self.assertFalse(UserBlock.is_blocked(self.user2, self.user1))

    def test_either_blocked(self):
        """Test checking if either user blocked the other."""
        UserBlock.objects.create(blocker=self.user1, blocked=self.user2)

        self.assertTrue(UserBlock.either_blocked(self.user1, self.user2))
        self.assertTrue(UserBlock.either_blocked(self.user2, self.user1))


class MessagingAPITest(APITestCase):
    """Test messaging API endpoints."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='requester',
            email='requester@test.com',
            password=TEST_PASSWORD,
        )
        self.user2 = User.objects.create_user(
            username='recipient',
            email='recipient@test.com',
            password=TEST_PASSWORD,
        )
        self.project = Project.objects.create(
            user=self.user2,
            title='Test Project',
            contact_enabled=True,
        )

    def test_create_contact_request(self):
        """Test creating a contact request via API."""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            reverse('create_contact_request', kwargs={'project_id': self.project.id}),
            {'intro_message': 'Hi, I love your project!'},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending')

    def test_cannot_contact_own_project(self):
        """Test user cannot send contact request to their own project."""
        self.client.force_authenticate(user=self.user2)

        response = self.client.post(
            reverse('create_contact_request', kwargs={'project_id': self.project.id}),
            {'intro_message': 'Hello!'},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_connection_request(self):
        """Test accepting a connection request via API."""
        request = ConnectionRequest.objects.create(
            requester=self.user1,
            recipient=self.user2,
            project=self.project,
            intro_message='Hello!',
        )

        self.client.force_authenticate(user=self.user2)
        response = self.client.post(
            reverse('connection-request-accept', kwargs={'pk': request.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'accepted')
        self.assertIn('thread_id', response.data)

    def test_send_message(self):
        """Test sending a message via API."""
        thread, _ = DirectMessageThread.objects.get_or_create_for_users(self.user1, self.user2)

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse('thread_messages', kwargs={'pk': thread.id}),
            {'content': 'Hello there!'},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['content'], 'Hello there!')

    def test_unread_count(self):
        """Test getting unread message count."""
        thread, _ = DirectMessageThread.objects.get_or_create_for_users(self.user1, self.user2)
        DirectMessage.objects.create(
            thread=thread,
            sender=self.user1,
            content='Test message',
        )

        self.client.force_authenticate(user=self.user2)
        response = self.client.get(reverse('unread_count'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread_count'], 1)
