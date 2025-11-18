"""Tests for health check endpoints."""

from django.test import TestCase, Client


class HealthCheckTests(TestCase):
    """Ensure health endpoints respond correctly."""

    def setUp(self):
        self.client = Client()

    def test_root_health_endpoint_returns_ok(self):
        response = self.client.get('/db/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_versioned_health_endpoint_returns_ok(self):
        response = self.client.get('/api/v1/db/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
