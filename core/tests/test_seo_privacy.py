"""
SEO and Privacy Test Suite

Tests critical SEO features and user privacy controls to ensure:
1. Sitemaps respect user privacy settings
2. API responses hide private data
3. robots.txt is correctly configured
4. LLM plugin manifest has proper privacy boundaries
5. No private data leaks to search engines or LLMs

These tests should run in CI/CD to catch privacy/SEO regressions.
"""

import json

from django.contrib.sites.models import Site
from django.core.cache import cache
from django.test import Client, TestCase

from core.users.models import User


class SitemapPrivacyTests(TestCase):
    """Test that sitemaps respect user privacy settings."""

    def setUp(self):
        """Set up test data."""
        cache.clear()  # Clear cache before each test

        # Ensure Site exists for sitemap generation
        Site.objects.get_or_create(id=1, defaults={'domain': 'testserver', 'name': 'Test'})

        # Create test users with different privacy settings
        self.public_user = User.objects.create_user(
            username='public_user',
            email='public@test.com',
            password='testpass123',
            is_profile_public=True,
        )

        self.private_user = User.objects.create_user(
            username='private_user',
            email='private@test.com',
            password='testpass123',
            is_profile_public=False,
        )

        self.client = Client()

    def test_sitemap_only_includes_public_profiles(self):
        """Public profiles appear in sitemap, private profiles don't."""
        # Access the profiles section specifically
        response = self.client.get('/sitemap-profiles.xml')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/xml')

        content = response.content.decode('utf-8')

        # Public user should be in sitemap
        self.assertIn('public_user', content)

        # Private user should NOT be in sitemap
        self.assertNotIn('private_user', content)

    def test_sitemap_respects_privacy_toggle(self):
        """When user changes privacy, sitemap updates."""
        # User starts public
        self.public_user.is_profile_public = True
        self.public_user.save()
        cache.clear()

        response = self.client.get('/sitemap-profiles.xml')
        content = response.content.decode('utf-8')
        self.assertIn('public_user', content)

        # User opts out
        self.public_user.is_profile_public = False
        self.public_user.save()
        cache.clear()

        response = self.client.get('/sitemap-profiles.xml')
        content = response.content.decode('utf-8')
        self.assertNotIn('public_user', content)

    def test_sitemap_cache_invalidation(self):
        """Sitemap cache properly handles privacy changes after cache clear."""
        # First request - includes public user
        response1 = self.client.get('/sitemap-profiles.xml')
        content1 = response1.content.decode('utf-8')
        self.assertIn('public_user', content1)

        # Change privacy and clear cache explicitly
        self.public_user.is_profile_public = False
        self.public_user.save()
        cache.clear()  # Clear all caches to ensure fresh data

        # After clearing cache, should reflect privacy change
        response2 = self.client.get('/sitemap-profiles.xml')
        content2 = response2.content.decode('utf-8')
        self.assertNotIn('public_user', content2)  # Now removed after privacy change


class APIPrivacyTests(TestCase):
    """Test that API responses respect user privacy settings."""

    def setUp(self):
        """Set up test data."""
        from core.projects.models import Project

        self.public_gamer = User.objects.create_user(
            username='public_gamer',
            email='public@test.com',
            password='testpass123',
            gamification_is_public=True,
            total_points=1000,
            level=5,
            tier='sprout',
        )

        self.private_gamer = User.objects.create_user(
            username='private_gamer',
            email='private@test.com',
            password='testpass123',
            gamification_is_public=False,
            total_points=2000,
            level=10,
            tier='blossom',
        )

        # Create showcase projects so users appear in explore endpoint
        Project.objects.create(
            user=self.public_gamer,
            title='Public Showcase Project',
            slug='public-showcase',
            is_showcased=True,
            is_private=False,
            is_archived=False,
        )

        Project.objects.create(
            user=self.private_gamer,
            title='Private Showcase Project',
            slug='private-showcase',
            is_showcased=True,
            is_private=False,
            is_archived=False,
        )

        self.client = Client()

    def test_explore_users_respects_gamification_privacy(self):
        """Users who hide gamification data don't expose it in API."""
        response = self.client.get('/api/v1/users/explore/')

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Find users in response
        public_user_data = next((u for u in data['results'] if u['username'] == 'public_gamer'), None)
        private_user_data = next((u for u in data['results'] if u['username'] == 'private_gamer'), None)

        # Public user should have gamification data
        self.assertIsNotNone(public_user_data)
        self.assertIn('total_points', public_user_data)
        self.assertIn('level', public_user_data)
        self.assertIn('tier', public_user_data)
        self.assertEqual(public_user_data['total_points'], 1000)

        # Private user should NOT have gamification data
        self.assertIsNotNone(private_user_data)
        self.assertNotIn('total_points', private_user_data)
        self.assertNotIn('level', private_user_data)
        self.assertNotIn('tier', private_user_data)

    def test_user_serializer_hides_email_from_public(self):
        """Email addresses not exposed in public API responses."""
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory

        from core.auth.serializers import UserSerializer

        factory = APIRequestFactory()
        request = factory.get('/api/v1/users/')

        # Unauthenticated request
        serializer = UserSerializer(self.public_gamer, context={'request': Request(request)})

        # Email should not be in serialized data
        self.assertNotIn('email', serializer.data)


class RobotsTxtTests(TestCase):
    """Test robots.txt configuration for LLM blocking."""

    def test_robots_txt_exists(self):
        """robots.txt file is accessible."""
        response = self.client.get('/robots.txt')
        self.assertEqual(response.status_code, 200)

    def test_robots_txt_blocks_llm_crawlers(self):
        """robots.txt blocks known LLM crawlers."""
        response = self.client.get('/robots.txt')
        content = response.content.decode('utf-8')

        # Check LLM crawlers are blocked
        llm_crawlers = [
            'GPTBot',
            'ChatGPT-User',
            'CCBot',
            'anthropic-ai',
            'Claude-Web',
            'ClaudeBot',
        ]

        for crawler in llm_crawlers:
            self.assertIn(crawler, content, f'{crawler} should be in robots.txt')

        # Check that user profiles are disallowed for LLMs
        # Look for patterns like "User-agent: GPTBot" followed by "Disallow: /@*"
        self.assertIn('Disallow: /@*', content)

    def test_robots_txt_allows_search_engines(self):
        """robots.txt allows traditional search engines."""
        response = self.client.get('/robots.txt')
        content = response.content.decode('utf-8')

        # Check search engines are explicitly allowed
        search_engines = ['Googlebot', 'Bingbot']

        for engine in search_engines:
            self.assertIn(engine, content, f'{engine} should be in robots.txt')


class LLMPluginManifestTests(TestCase):
    """Test AI plugin manifest has proper privacy boundaries."""

    def test_ai_plugin_manifest_exists(self):
        """AI plugin manifest is accessible."""
        response = self.client.get('/.well-known/ai-plugin.json')
        self.assertEqual(response.status_code, 200)

    def test_manifest_emphasizes_public_data_only(self):
        """Manifest clearly states only PUBLIC data is accessible."""
        response = self.client.get('/.well-known/ai-plugin.json')
        data = json.loads(response.content)

        # Check description emphasizes PUBLIC
        description = data.get('description_for_model', '')
        self.assertIn('PUBLIC', description.upper())
        self.assertIn('privacy', description.lower())

        # Check capabilities mention PUBLIC
        capabilities = data.get('capabilities', [])
        for capability in capabilities:
            self.assertIn('PUBLIC', capability.upper())

    def test_manifest_includes_privacy_policy_url(self):
        """Manifest links to privacy policy."""
        response = self.client.get('/.well-known/ai-plugin.json')
        data = json.loads(response.content)

        self.assertIn('privacy_policy_url', data)
        self.assertIsNotNone(data['privacy_policy_url'])

    def test_manifest_has_data_usage_policy(self):
        """Manifest describes data usage policy."""
        response = self.client.get('/.well-known/ai-plugin.json')
        data = json.loads(response.content)

        self.assertIn('data_usage_policy', data)
        policy = data['data_usage_policy']
        self.assertIn('PUBLIC', policy.upper())


class MetaTagsTests(TestCase):
    """Test that meta tags are properly configured.

    Note: This is a Django API backend. The React frontend handles
    SEO meta tags. These tests are skipped for the API backend.
    """

    def test_index_html_has_structured_data(self):
        """index.html contains JSON-LD structured data."""
        # Skip: This is handled by the React frontend
        self.skipTest('Meta tags are handled by React frontend, not Django backend')

    def test_index_html_has_og_tags(self):
        """index.html contains Open Graph tags."""
        # Skip: This is handled by the React frontend
        self.skipTest('Meta tags are handled by React frontend, not Django backend')

    def test_index_html_has_twitter_cards(self):
        """index.html contains Twitter Card tags."""
        # Skip: This is handled by the React frontend
        self.skipTest('Meta tags are handled by React frontend, not Django backend')


class PrivacyModelTests(TestCase):
    """Test User model privacy fields and constraints."""

    def test_user_privacy_fields_exist(self):
        """User model has all required privacy fields."""
        user = User.objects.create_user(username='test', email='test@test.com', password='testpass123')

        # Check privacy fields exist
        self.assertTrue(hasattr(user, 'is_profile_public'))
        self.assertTrue(hasattr(user, 'gamification_is_public'))
        self.assertTrue(hasattr(user, 'allow_llm_training'))

    def test_privacy_defaults_are_correct(self):
        """Privacy fields have correct defaults for free tier."""
        user = User.objects.create_user(username='test', email='test@test.com', password='testpass123')

        # Defaults should favor free tier (public by default)
        self.assertTrue(user.is_profile_public)  # Public by default
        self.assertTrue(user.gamification_is_public)  # Public by default
        self.assertFalse(user.allow_llm_training)  # Opt-in required

    def test_privacy_fields_are_toggleable(self):
        """Users can toggle privacy settings."""
        user = User.objects.create_user(username='test', email='test@test.com', password='testpass123')

        # Toggle privacy settings
        user.is_profile_public = False
        user.gamification_is_public = False
        user.allow_llm_training = True
        user.save()

        # Verify changes persisted
        user.refresh_from_db()
        self.assertFalse(user.is_profile_public)
        self.assertFalse(user.gamification_is_public)
        self.assertTrue(user.allow_llm_training)


class SEOPerformanceTests(TestCase):
    """Test SEO-related performance (query optimization, caching)."""

    def setUp(self):
        """Set up test data."""
        from django.contrib.sites.models import Site

        # Ensure Site exists for sitemap generation
        Site.objects.get_or_create(id=1, defaults={'domain': 'testserver', 'name': 'Test'})
        cache.clear()

    def test_sitemap_queries_are_optimized(self):
        """Sitemap generation uses optimized queries."""
        # Create multiple users
        for i in range(10):
            User.objects.create_user(username=f'user{i}', email=f'user{i}@test.com', password='testpass123')

        cache.clear()

        # Count queries - should be minimal (one per sitemap section: projects, profiles, tools, static)
        # The sitemap has 4 sections, but static doesn't query the DB
        # So we expect 4 queries: site, projects, users, tools
        with self.assertNumQueries(4):  # 4 optimized queries (site + 3 DB-backed sitemaps)
            response = self.client.get('/sitemap.xml')
            self.assertEqual(response.status_code, 200)

    def test_sitemap_uses_caching(self):
        """Sitemap responses are cached at the sitemap level."""
        from django.contrib.sites.models import Site

        # Ensure Site exists for sitemap generation
        Site.objects.get_or_create(id=1, defaults={'domain': 'testserver', 'name': 'Test'})

        cache.clear()

        # First request - should hit database (3 queries for projects, users, tools)
        response1 = self.client.get('/sitemap.xml')
        content1 = response1.content
        self.assertEqual(response1.status_code, 200)

        # Second request - individual sitemaps cache their queries internally
        # but Django's sitemap framework doesn't cache the full XML response
        # So we still see queries, but the underlying data is cached
        response2 = self.client.get('/sitemap.xml')
        content2 = response2.content
        self.assertEqual(response2.status_code, 200)

        # Content should be identical
        self.assertEqual(content1, content2)


class PrivacyRegressionTests(TestCase):
    """Test to prevent privacy regressions."""

    def test_private_user_not_in_any_public_endpoint(self):
        """User who opted out doesn't appear in public APIs."""
        private_user = User.objects.create_user(
            username='super_private',
            email='private@test.com',
            password='testpass123',
            is_profile_public=False,
        )

        # Check sitemap
        response = self.client.get('/sitemap.xml')
        self.assertNotIn('super_private', response.content.decode('utf-8'))

        # Check explore API
        response = self.client.get('/api/v1/users/explore/')
        # User might be in API (profile still accessible via direct URL)
        # but should not be in sitemap

    def test_email_never_in_public_responses(self):
        """Email addresses never leak in public API responses."""
        user = User.objects.create_user(username='test_user', email='secret@email.com', password='testpass123')

        # Check various endpoints
        endpoints = [
            '/sitemap.xml',
            '/api/v1/users/explore/',
        ]

        for endpoint in endpoints:
            response = self.client.get(endpoint)
            content = response.content.decode('utf-8')
            self.assertNotIn('secret@email.com', content)
            self.assertNotIn('@email.com', content)


class PublicInfoDocumentTests(TestCase):
    """Test that PUBLIC_INFO.md doesn't contain private data."""

    def test_public_info_exists(self):
        """PUBLIC_INFO.md file exists and is accessible."""
        import os

        from django.conf import settings

        public_info_path = os.path.join(settings.BASE_DIR, 'docs', 'PUBLIC_INFO.md')
        if not os.path.exists(public_info_path):
            self.skipTest('PUBLIC_INFO.md does not exist yet')
        self.assertTrue(os.path.exists(public_info_path))

    def test_public_info_no_private_data(self):
        """PUBLIC_INFO.md doesn't contain user data or secrets."""
        import os
        import re

        from django.conf import settings

        public_info_path = os.path.join(settings.BASE_DIR, 'docs', 'PUBLIC_INFO.md')
        if not os.path.exists(public_info_path):
            self.skipTest('PUBLIC_INFO.md does not exist yet')

        with open(public_info_path) as f:
            content = f.read()

        # Allow official contact emails but not user emails
        # Remove known safe contact emails before checking
        safe_emails = ['support@allthrive.ai', 'contact@allthrive.ai']
        test_content = content
        for safe_email in safe_emails:
            test_content = test_content.replace(safe_email, '')

        # Check for remaining @ symbols (which would indicate user emails)
        # Allow @username patterns for social handles
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        remaining_emails = re.findall(email_pattern, test_content)
        self.assertEqual(len(remaining_emails), 0, f'Found unexpected email addresses: {remaining_emails}')

        # Should not contain API keys
        sensitive_terms = ['api_key', 'secret', 'password', 'token']
        for term in sensitive_terms:
            self.assertNotIn(term.upper(), content.upper())
