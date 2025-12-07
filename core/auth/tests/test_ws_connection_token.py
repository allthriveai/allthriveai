"""
Tests for WebSocket connection token generation endpoint.

Covers:
- Redis health check failures (503)
- Token generation failures (500)
- Successful token generation (200)
"""

import json
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework import status

User = get_user_model()


class WebSocketConnectionTokenTestCase(TestCase):
    """Test WebSocket connection token generation endpoint."""

    def setUp(self):
        """Set up test user and client."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        self.client = Client()
        self.endpoint = '/api/v1/auth/ws-connection-token/'

    def test_redis_health_check_fails_returns_503(self):
        """Test that endpoint returns 503 when Redis health check fails."""
        # Login user
        self.client.force_login(self.user)

        # Mock cache.set to succeed but cache.get to return None (health check fails)
        with patch('django.core.cache.cache') as mock_cache:
            mock_cache.set.return_value = True
            mock_cache.get.return_value = None  # Health check fails

            response = self.client.post(
                self.endpoint,
                data=json.dumps({'connection_id': 'test-connection-id'}),
                content_type='application/json',
            )

            # Verify response
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            data = json.loads(response.content)
            self.assertIn('error', data)
            self.assertEqual(data['code'], 'CACHE_UNAVAILABLE')
            self.assertIn('Cache service unavailable', data['error'])

    def test_redis_connection_error_returns_503(self):
        """Test that endpoint returns 503 when Redis connection fails."""
        # Login user
        self.client.force_login(self.user)

        # Mock cache.set to raise an exception
        with patch('django.core.cache.cache') as mock_cache:
            mock_cache.set.side_effect = Exception('Redis connection refused')

            response = self.client.post(
                self.endpoint,
                data=json.dumps({'connection_id': 'test-connection-id'}),
                content_type='application/json',
            )

            # Verify response
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            data = json.loads(response.content)
            self.assertIn('error', data)
            self.assertEqual(data['code'], 'CACHE_ERROR')
            self.assertIn('Cache service error', data['error'])
            self.assertIn('details', data)

    def test_token_generation_fails_returns_500(self):
        """Test that endpoint returns 500 when token generation fails."""
        # Login user
        self.client.force_login(self.user)

        # Mock successful cache health check
        with patch('django.core.cache.cache') as mock_cache:
            mock_cache.set.return_value = True
            mock_cache.get.return_value = '1'  # Health check passes

            # Mock token service to raise an exception
            with patch('core.auth.views_token.get_ws_token_service') as mock_service:
                mock_token_service = MagicMock()
                mock_token_service.generate_token.side_effect = Exception('Token generation failed')
                mock_service.return_value = mock_token_service

                response = self.client.post(
                    self.endpoint,
                    data=json.dumps({'connection_id': 'test-connection-id'}),
                    content_type='application/json',
                )

                # Verify response
                self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
                data = json.loads(response.content)
                self.assertIn('error', data)
                self.assertEqual(data['code'], 'TOKEN_GENERATION_ERROR')
                self.assertIn('Token generation failed', data['error'])
                self.assertIn('details', data)

    def test_successful_token_generation_returns_200(self):
        """Test that endpoint returns 200 with valid token on success."""
        # Login user
        self.client.force_login(self.user)

        # Mock successful cache health check
        with patch('django.core.cache.cache') as mock_cache:
            mock_cache.set.return_value = True
            mock_cache.get.return_value = '1'  # Health check passes

            # Mock token service to return a valid token
            with patch('core.auth.views_token.get_ws_token_service') as mock_service:
                mock_token_service = MagicMock()
                mock_token_service.generate_token.return_value = 'test-secure-token-abc123'
                mock_service.return_value = mock_token_service

                response = self.client.post(
                    self.endpoint,
                    data=json.dumps({'connection_id': 'test-connection-id'}),
                    content_type='application/json',
                )

                # Verify response
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                data = json.loads(response.content)

                # Verify response structure
                self.assertIn('connection_token', data)
                self.assertEqual(data['connection_token'], 'test-secure-token-abc123')
                self.assertIn('expires_in', data)
                self.assertEqual(data['expires_in'], 60)
                self.assertIn('connection_id', data)
                self.assertEqual(data['connection_id'], 'test-connection-id')

                # Verify token service was called correctly
                mock_token_service.generate_token.assert_called_once_with(
                    user_id=self.user.id, username=self.user.username, connection_id='test-connection-id'
                )

    def test_generates_connection_id_if_not_provided(self):
        """Test that endpoint generates a connection_id if not provided in request."""
        # Login user
        self.client.force_login(self.user)

        # Mock successful cache health check
        with patch('django.core.cache.cache') as mock_cache:
            mock_cache.set.return_value = True
            mock_cache.get.return_value = '1'  # Health check passes

            # Mock token service
            with patch('core.auth.views_token.get_ws_token_service') as mock_service:
                mock_token_service = MagicMock()
                mock_token_service.generate_token.return_value = 'test-token'
                mock_service.return_value = mock_token_service

                response = self.client.post(
                    self.endpoint,
                    data=json.dumps({}),  # No connection_id provided
                    content_type='application/json',
                )

                # Verify response
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                data = json.loads(response.content)

                # Verify a connection_id was generated
                self.assertIn('connection_id', data)
                self.assertIsNotNone(data['connection_id'])
                self.assertTrue(len(data['connection_id']) > 0)

    def test_requires_authentication(self):
        """Test that endpoint requires authentication."""
        # Don't login - make request as unauthenticated user
        response = self.client.post(
            self.endpoint,
            data=json.dumps({'connection_id': 'test-connection-id'}),
            content_type='application/json',
        )

        # Should return 401 or 403 (depending on authentication setup)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
