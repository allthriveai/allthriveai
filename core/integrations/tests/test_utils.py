"""Tests for integration utilities (slug normalization, locks, error responses)."""

import time

from django.core.cache import cache
from django.test import TestCase
from rest_framework import status

from core.integrations.utils import (
    IntegrationErrorCode,
    acquire_import_lock,
    error_response,
    normalize_slug,
    release_import_lock,
    success_response,
)


class SlugNormalizationTestCase(TestCase):
    """Test slug normalization utility."""

    def test_normalize_slug_underscores(self):
        """Test underscore replacement in slugs."""
        self.assertEqual(normalize_slug('my_project'), 'my-project')
        self.assertEqual(normalize_slug('drupal_install_profile'), 'drupal-install-profile')

    def test_normalize_slug_spaces(self):
        """Test space replacement in slugs."""
        self.assertEqual(normalize_slug('My Awesome Project'), 'my-awesome-project')

    def test_normalize_slug_special_chars(self):
        """Test special character handling."""
        self.assertEqual(normalize_slug('Hello World & More!'), 'hello-world-more')
        self.assertEqual(normalize_slug('Test@Project#123'), 'testproject123')

    def test_normalize_slug_unicode(self):
        """Test unicode character handling."""
        self.assertEqual(normalize_slug('Café Resume'), 'cafe-resume')

    def test_normalize_slug_empty(self):
        """Test empty string handling."""
        self.assertEqual(normalize_slug(''), 'project')


class ImportLockTestCase(TestCase):
    """Test import lock acquisition and release."""

    def setUp(self):
        """Clear cache before each test."""
        cache.clear()

    def tearDown(self):
        """Clear cache after each test."""
        cache.clear()

    def test_acquire_lock_success(self):
        """Test successful lock acquisition."""
        self.assertTrue(acquire_import_lock(1))

    def test_acquire_lock_already_held(self):
        """Test lock acquisition when already held."""
        # First acquire should succeed
        self.assertTrue(acquire_import_lock(1))
        # Second acquire should fail
        self.assertFalse(acquire_import_lock(1))

    def test_acquire_lock_different_users(self):
        """Test lock acquisition for different users."""
        self.assertTrue(acquire_import_lock(1))
        self.assertTrue(acquire_import_lock(2))  # Different user, should succeed

    def test_release_lock(self):
        """Test lock release."""
        acquire_import_lock(1)
        release_import_lock(1)
        # Should be able to acquire again
        self.assertTrue(acquire_import_lock(1))

    def test_lock_expiry(self):
        """Test lock auto-expires after timeout."""
        acquire_import_lock(1, timeout=1)
        time.sleep(2)
        # Lock should be released
        self.assertTrue(acquire_import_lock(1))


class ResponseBuildersTestCase(TestCase):
    """Test response builder utilities."""

    def test_success_response(self):
        """Test success response format."""
        response = success_response({'project_id': 123})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['project_id'], 123)

    def test_error_response(self):
        """Test error response format."""
        response = error_response(
            error='Test error', error_code=IntegrationErrorCode.INVALID_URL, suggestion='Try a different URL'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error'], 'Test error')
        self.assertEqual(response.data['error_code'], IntegrationErrorCode.INVALID_URL)
        self.assertEqual(response.data['suggestion'], 'Try a different URL')

    def test_error_response_with_extra_data(self):
        """Test error response with additional data."""
        response = error_response(
            error='Duplicate', error_code=IntegrationErrorCode.DUPLICATE_IMPORT, project={'id': 1, 'title': 'Test'}
        )
        self.assertEqual(response.data['project']['id'], 1)
        self.assertEqual(response.data['project']['title'], 'Test')


# TODO: Add tests for get_integration_token and check_duplicate_project
# These require User and SocialAccount/Project models
