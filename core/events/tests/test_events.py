"""Tests for Event model and API endpoints."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.events.models import Event
from core.users.models import User


class EventModelTest(TestCase):
    """Test Event model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.now = timezone.now()

    def test_create_event(self):
        """Test creating an event."""
        event = Event.objects.create(
            title='Test Event',
            description='Test description',
            start_date=self.now,
            end_date=self.now + timedelta(hours=2),
            location='Test Location',
            created_by=self.user,
        )
        self.assertEqual(event.title, 'Test Event')
        self.assertEqual(event.created_by, self.user)

    def test_event_is_upcoming(self):
        """Test is_upcoming property."""
        future_event = Event.objects.create(
            title='Future Event',
            start_date=self.now + timedelta(days=1),
            end_date=self.now + timedelta(days=1, hours=2),
        )
        self.assertTrue(future_event.is_upcoming)
        self.assertFalse(future_event.is_past)
        self.assertFalse(future_event.is_ongoing)

    def test_event_is_past(self):
        """Test is_past property."""
        past_event = Event.objects.create(
            title='Past Event',
            start_date=self.now - timedelta(days=2),
            end_date=self.now - timedelta(days=1),
        )
        self.assertTrue(past_event.is_past)
        self.assertFalse(past_event.is_upcoming)
        self.assertFalse(past_event.is_ongoing)

    def test_event_is_ongoing(self):
        """Test is_ongoing property."""
        ongoing_event = Event.objects.create(
            title='Ongoing Event',
            start_date=self.now - timedelta(hours=1),
            end_date=self.now + timedelta(hours=1),
        )
        self.assertTrue(ongoing_event.is_ongoing)
        self.assertFalse(ongoing_event.is_past)
        self.assertFalse(ongoing_event.is_upcoming)


class EventAPITest(TestCase):
    """Test Event API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.admin = User.objects.create_superuser(username='admin', email='admin@example.com', password='adminpass123')
        self.now = timezone.now()

    def test_list_events_unauthenticated(self):
        """Test that unauthenticated users cannot list events."""
        response = self.client.get('/api/v1/events/')
        self.assertEqual(response.status_code, 401)

    def test_list_events_authenticated(self):
        """Test that authenticated users can list events."""
        self.client.force_authenticate(user=self.user)
        Event.objects.create(
            title='Test Event',
            start_date=self.now,
            end_date=self.now + timedelta(hours=2),
            is_published=True,
        )
        response = self.client.get('/api/v1/events/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_create_event_requires_admin(self):
        """Test that only admins can create events."""
        self.client.force_authenticate(user=self.user)
        data = {
            'title': 'New Event',
            'start_date': (self.now + timedelta(days=1)).isoformat(),
            'end_date': (self.now + timedelta(days=1, hours=2)).isoformat(),
        }
        response = self.client.post('/api/v1/events/', data, format='json')
        self.assertEqual(response.status_code, 403)

    def test_create_event_as_admin(self):
        """Test that admins can create events."""
        self.client.force_authenticate(user=self.admin)
        data = {
            'title': 'Admin Event',
            'start_date': (self.now + timedelta(days=1)).isoformat(),
            'end_date': (self.now + timedelta(days=1, hours=2)).isoformat(),
        }
        response = self.client.post('/api/v1/events/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Event.objects.count(), 1)
