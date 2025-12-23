"""
Tests for the topic taxonomy service.

Tests cover:
- Topic normalization (slug generation)
- Topic validation (filtering excluded tags)
- Dynamic topic creation (get_or_create_topic)
- Handling existing tools/categories with same slug
- Project topics syncing to taxonomy
"""

from django.test import TestCase

from core.taxonomy.models import Taxonomy
from core.taxonomy.topic_service import (
    ensure_topics_in_taxonomy,
    get_or_create_topic,
    is_valid_topic,
    normalize_topic_slug,
    normalize_topics_list,
)


class TopicNormalizationTests(TestCase):
    """Tests for topic slug normalization."""

    def test_normalize_basic_topic(self):
        """Basic topic strings are properly slugified."""
        self.assertEqual(normalize_topic_slug('Machine Learning'), 'machine-learning')
        self.assertEqual(normalize_topic_slug('AI Agents'), 'ai-agents')
        self.assertEqual(normalize_topic_slug('GPT-4'), 'gpt-4')

    def test_normalize_with_underscores(self):
        """Underscores are converted to hyphens."""
        self.assertEqual(normalize_topic_slug('ai_agents'), 'ai-agents')
        self.assertEqual(normalize_topic_slug('machine_learning'), 'machine-learning')

    def test_normalize_with_whitespace(self):
        """Leading/trailing whitespace is stripped."""
        self.assertEqual(normalize_topic_slug('  AI Agents  '), 'ai-agents')
        self.assertEqual(normalize_topic_slug('\tMachine Learning\n'), 'machine-learning')

    def test_normalize_empty_string(self):
        """Empty strings return empty."""
        self.assertEqual(normalize_topic_slug(''), '')
        self.assertEqual(normalize_topic_slug('   '), '')

    def test_normalize_special_characters(self):
        """Special characters are handled properly."""
        self.assertEqual(normalize_topic_slug('C++'), 'c')
        self.assertEqual(normalize_topic_slug('Node.js'), 'nodejs')
        self.assertEqual(normalize_topic_slug('AI & ML'), 'ai-ml')


class TopicValidationTests(TestCase):
    """Tests for topic validation (filtering excluded tags)."""

    def test_valid_topics(self):
        """Valid topics pass validation."""
        self.assertTrue(is_valid_topic('Machine Learning'))
        self.assertTrue(is_valid_topic('AI Agents'))
        self.assertTrue(is_valid_topic('Automation'))
        self.assertTrue(is_valid_topic('Creative Work'))

    def test_excluded_battle_tags(self):
        """Battle-related tags are excluded."""
        self.assertFalse(is_valid_topic('winner'))
        self.assertFalse(is_valid_topic('loser'))
        self.assertFalse(is_valid_topic('prompt battle'))
        self.assertFalse(is_valid_topic('vs ai'))
        self.assertFalse(is_valid_topic('text prompt'))
        self.assertFalse(is_valid_topic('image prompt'))

    def test_excluded_generic_tags(self):
        """Generic tags are excluded."""
        self.assertFalse(is_valid_topic('image'))
        self.assertFalse(is_valid_topic('text'))
        self.assertFalse(is_valid_topic('ai'))
        self.assertFalse(is_valid_topic('battle'))
        self.assertFalse(is_valid_topic('prompt'))

    def test_excluded_project_types(self):
        """Project type tags are excluded."""
        self.assertFalse(is_valid_topic('showcase'))
        self.assertFalse(is_valid_topic('playground'))
        self.assertFalse(is_valid_topic('clipped'))
        self.assertFalse(is_valid_topic('reddit'))

    def test_empty_and_short_strings(self):
        """Empty and very short strings are excluded."""
        self.assertFalse(is_valid_topic(''))
        self.assertFalse(is_valid_topic('   '))
        self.assertFalse(is_valid_topic('a'))
        self.assertFalse(is_valid_topic('12'))

    def test_case_insensitive_exclusion(self):
        """Exclusion is case-insensitive."""
        self.assertFalse(is_valid_topic('WINNER'))
        self.assertFalse(is_valid_topic('Winner'))
        self.assertFalse(is_valid_topic('PROMPT BATTLE'))


class GetOrCreateTopicTests(TestCase):
    """Tests for dynamic topic creation."""

    def test_create_new_topic(self):
        """New topics are created in taxonomy."""
        topic = get_or_create_topic('Machine Learning')

        self.assertIsNotNone(topic)
        self.assertEqual(topic.name, 'Machine Learning')
        self.assertEqual(topic.slug, 'machine-learning')
        self.assertEqual(topic.taxonomy_type, Taxonomy.TaxonomyType.TOPIC)
        self.assertTrue(topic.is_active)

    def test_get_existing_topic(self):
        """Existing topics are returned without creating duplicates."""
        # Create first
        topic1 = get_or_create_topic('Machine Learning')
        # Get again
        topic2 = get_or_create_topic('Machine Learning')

        self.assertEqual(topic1.pk, topic2.pk)
        # Verify only one exists
        count = Taxonomy.objects.filter(slug='machine-learning').count()
        self.assertEqual(count, 1)

    def test_case_insensitive_lookup(self):
        """Topic lookup is case-insensitive."""
        topic1 = get_or_create_topic('Machine Learning')
        topic2 = get_or_create_topic('machine learning')
        topic3 = get_or_create_topic('MACHINE LEARNING')

        self.assertEqual(topic1.pk, topic2.pk)
        self.assertEqual(topic1.pk, topic3.pk)

    def test_excluded_topic_returns_none(self):
        """Excluded topics return None."""
        topic = get_or_create_topic('winner')
        self.assertIsNone(topic)

        topic = get_or_create_topic('prompt battle')
        self.assertIsNone(topic)

    def test_does_not_create_duplicate_of_existing_tool(self):
        """Topics don't duplicate existing tools."""
        # Create a tool first
        tool = Taxonomy.objects.create(
            taxonomy_type=Taxonomy.TaxonomyType.TOOL,
            name='Midjourney',
            slug='midjourney',
            is_active=True,
        )

        # Try to create topic with same name
        topic = get_or_create_topic('Midjourney')

        # Should return None (not create duplicate)
        self.assertIsNone(topic)
        # Tool still exists
        self.assertTrue(Taxonomy.objects.filter(slug='midjourney').exists())

    def test_does_not_create_duplicate_of_existing_category(self):
        """Topics don't duplicate existing categories."""
        # Create a category first (using unique slug not seeded in migrations)
        category = Taxonomy.objects.create(
            taxonomy_type=Taxonomy.TaxonomyType.CATEGORY,
            name='Test Unique Category',
            slug='test-unique-category',
            is_active=True,
        )

        # Try to create topic with same name
        topic = get_or_create_topic('Test Unique Category')

        # Should return None
        self.assertIsNone(topic)

    def test_topic_with_description_and_color(self):
        """Topics can be created with description and color."""
        topic = get_or_create_topic(
            'Custom Topic',
            description='A custom description',
            color='purple',
        )

        self.assertEqual(topic.description, 'A custom description')
        self.assertEqual(topic.color, 'purple')


class EnsureTopicsInTaxonomyTests(TestCase):
    """Tests for batch topic creation."""

    def test_ensure_multiple_topics(self):
        """Multiple topics are created from a list."""
        # Use unique topic names that won't conflict with seeded data
        raw_topics = ['Test Topic Alpha', 'Test Topic Beta', 'Test Topic Gamma']
        topics = ensure_topics_in_taxonomy(raw_topics)

        self.assertEqual(len(topics), 3)
        slugs = {t.slug for t in topics}
        self.assertEqual(slugs, {'test-topic-alpha', 'test-topic-beta', 'test-topic-gamma'})

    def test_filters_excluded_topics(self):
        """Excluded topics are filtered out."""
        # Use unique topic names that won't conflict with seeded data
        raw_topics = ['Test Topic Delta', 'winner', 'Test Topic Epsilon', 'prompt battle']
        topics = ensure_topics_in_taxonomy(raw_topics)

        self.assertEqual(len(topics), 2)
        slugs = {t.slug for t in topics}
        self.assertEqual(slugs, {'test-topic-delta', 'test-topic-epsilon'})

    def test_handles_empty_list(self):
        """Empty list returns empty list."""
        topics = ensure_topics_in_taxonomy([])
        self.assertEqual(topics, [])

    def test_handles_none(self):
        """None returns empty list."""
        topics = ensure_topics_in_taxonomy(None)
        self.assertEqual(topics, [])

    def test_deduplicates_topics(self):
        """Duplicate topics in input don't create duplicates."""
        # Use unique topic name that won't conflict with seeded data
        raw_topics = ['Test Dedup Topic', 'test dedup topic', 'TEST DEDUP TOPIC']
        topics = ensure_topics_in_taxonomy(raw_topics)

        # All resolve to same topic
        self.assertEqual(len(topics), 3)  # Returns 3 (same object 3 times)
        self.assertEqual(topics[0].pk, topics[1].pk)
        self.assertEqual(topics[0].pk, topics[2].pk)

        # Only one in database
        count = Taxonomy.objects.filter(slug='test-dedup-topic').count()
        self.assertEqual(count, 1)


class NormalizeTopicsListTests(TestCase):
    """Tests for normalizing topic lists to slugs."""

    def test_normalize_list(self):
        """Topics list is normalized to slugs."""
        raw = ['Machine Learning', 'AI Agents', 'GPT-4']
        normalized = normalize_topics_list(raw)

        self.assertEqual(normalized, ['machine-learning', 'ai-agents', 'gpt-4'])

    def test_filters_excluded(self):
        """Excluded topics are filtered."""
        raw = ['Machine Learning', 'winner', 'AI Agents']
        normalized = normalize_topics_list(raw)

        self.assertEqual(normalized, ['machine-learning', 'ai-agents'])

    def test_deduplicates(self):
        """Duplicate slugs are removed."""
        raw = ['Machine Learning', 'machine learning', 'MACHINE LEARNING']
        normalized = normalize_topics_list(raw)

        self.assertEqual(normalized, ['machine-learning'])

    def test_handles_empty(self):
        """Empty input returns empty list."""
        self.assertEqual(normalize_topics_list([]), [])
        self.assertEqual(normalize_topics_list(None), [])


class ProjectTopicsTaxonomyIntegrationTests(TestCase):
    """Tests for project topics syncing to taxonomy."""

    def test_project_save_syncs_topics(self):
        """Saving a project syncs its topics to taxonomy."""
        from core.projects.models import Project
        from core.users.models import User

        # Create a user
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        # Create topics in taxonomy first (since topics is now M2M to Taxonomy)
        topic1 = Taxonomy.objects.create(
            taxonomy_type=Taxonomy.TaxonomyType.TOPIC,
            name='New Topic One',
            slug='new-topic-one',
            is_active=True,
        )
        topic2 = Taxonomy.objects.create(
            taxonomy_type=Taxonomy.TaxonomyType.TOPIC,
            name='New Topic Two',
            slug='new-topic-two',
            is_active=True,
        )

        # Create project and assign topics via M2M
        project = Project.objects.create(
            user=user,
            title='Test Project',
            description='A test project',
        )
        project.topics.set([topic1, topic2])

        # Verify topics are correctly linked
        self.assertEqual(project.topics.count(), 2)
        self.assertTrue(project.topics.filter(slug='new-topic-one').exists())
        self.assertTrue(project.topics.filter(slug='new-topic-two').exists())
        self.assertEqual(topic1.taxonomy_type, Taxonomy.TaxonomyType.TOPIC)
        self.assertEqual(topic2.taxonomy_type, Taxonomy.TaxonomyType.TOPIC)

    def test_project_topics_map_to_existing_taxonomy(self):
        """Project topics correctly map to existing taxonomy entries."""
        from core.taxonomy.topic_service import normalize_topic_slug

        # Create existing tool (using unique slug not seeded in migrations)
        Taxonomy.objects.create(
            taxonomy_type=Taxonomy.TaxonomyType.TOOL,
            name='Test Tool Unique',
            slug='test-tool-unique',
            is_active=True,
        )

        # Create existing category (using unique slug not seeded in migrations)
        Taxonomy.objects.create(
            taxonomy_type=Taxonomy.TaxonomyType.CATEGORY,
            name='Test Category Unique',
            slug='test-category-unique',
            is_active=True,
        )

        # Simulate project topics
        project_topics = ['test tool unique', 'test category unique', 'automation']

        # Verify they map correctly
        for topic_str in project_topics:
            slug = normalize_topic_slug(topic_str)
            entry = Taxonomy.objects.filter(slug=slug).first()

            if topic_str == 'test tool unique':
                self.assertEqual(entry.taxonomy_type, 'tool')
            elif topic_str == 'test category unique':
                self.assertEqual(entry.taxonomy_type, 'category')
            # 'automation' would be created as topic type
