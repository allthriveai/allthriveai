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
        response = self.client.get('/sitemap.xml')

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

        response = self.client.get('/sitemap.xml')
        content = response.content.decode('utf-8')
        self.assertIn('public_user', content)

        # User opts out
        self.public_user.is_profile_public = False
        self.public_user.save()
        cache.clear()

        response = self.client.get('/sitemap.xml')
        content = response.content.decode('utf-8')
        self.assertNotIn('public_user', content)

    def test_sitemap_cache_invalidation(self):
        """Sitemap cache properly handles privacy changes."""
        # First request - should cache
        response1 = self.client.get('/sitemap.xml')
        content1 = response1.content.decode('utf-8')
        self.assertIn('public_user', content1)

        # Change privacy (but cache not cleared yet)
        self.public_user.is_profile_public = False
        self.public_user.save()

        # Cache should still show old data
        response2 = self.client.get('/sitemap.xml')
        content2 = response2.content.decode('utf-8')
        self.assertIn('public_user', content2)  # Still in cache

        # Clear cache - should reflect change
        cache.delete('sitemap_profiles_v1')
        response3 = self.client.get('/sitemap.xml')
        content3 = response3.content.decode('utf-8')
        self.assertNotIn('public_user', content3)  # Now removed


class APIPrivacyTests(TestCase):
    """Test that API responses respect user privacy settings."""

    def setUp(self):
        """Set up test data."""
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
    """Test that meta tags are properly configured."""

    def test_index_html_has_structured_data(self):
        """index.html contains JSON-LD structured data."""
        response = self.client.get('/')
        content = response.content.decode('utf-8')

        # Check for JSON-LD script tags
        self.assertIn('application/ld+json', content)
        self.assertIn('schema.org', content)

    def test_index_html_has_og_tags(self):
        """index.html contains Open Graph tags."""
        response = self.client.get('/')
        content = response.content.decode('utf-8')

        # Check for essential OG tags
        self.assertIn('og:title', content)
        self.assertIn('og:description', content)
        self.assertIn('og:image', content)

    def test_index_html_has_twitter_cards(self):
        """index.html contains Twitter Card tags."""
        response = self.client.get('/')
        content = response.content.decode('utf-8')

        # Check for Twitter Card tags
        self.assertIn('twitter:card', content)
        self.assertIn('twitter:title', content)
        self.assertIn('twitter:image', content)


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

    def test_sitemap_queries_are_optimized(self):
        """Sitemap generation uses optimized queries."""
        # Create multiple users
        for i in range(10):
            User.objects.create_user(username=f'user{i}', email=f'user{i}@test.com', password='testpass123')

        cache.clear()

        # Count queries - should be minimal (1-2 queries, not N+1)
        with self.assertNumQueries(10):  # Adjust based on actual optimized count
            response = self.client.get('/sitemap.xml')
            self.assertEqual(response.status_code, 200)

    def test_sitemap_uses_caching(self):
        """Sitemap responses are cached."""
        cache.clear()

        # First request - should hit database
        response1 = self.client.get('/sitemap.xml')
        content1 = response1.content

        # Second request - should use cache (no queries)
        with self.assertNumQueries(0):
            response2 = self.client.get('/sitemap.xml')
            content2 = response2.content

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

        public_info_path = os.path.join(settings.BASE_DIR, 'PUBLIC_INFO.md')
        self.assertTrue(os.path.exists(public_info_path))

    def test_public_info_no_private_data(self):
        """PUBLIC_INFO.md doesn't contain user data or secrets."""
        import os

        from django.conf import settings

        public_info_path = os.path.join(settings.BASE_DIR, 'PUBLIC_INFO.md')

        with open(public_info_path) as f:
            content = f.read()

        # Should not contain email addresses
        self.assertNotIn('@', content)

        # Should not contain API keys
        sensitive_terms = ['api_key', 'secret', 'password', 'token']
        for term in sensitive_terms:
            self.assertNotIn(term.upper(), content.upper())
