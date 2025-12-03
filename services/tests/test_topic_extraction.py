"""Tests for TopicExtractionService."""

from unittest.mock import patch

import pytest

from services.ai.topic_extraction import TopicExtractionService


@pytest.mark.django_db
class TestTopicExtractionService:
    """Test topic extraction from Reddit posts."""

    def test_prepare_text(self):
        """Test text preparation for analysis."""
        service = TopicExtractionService()

        result = service._prepare_text(
            title='Test Title', selftext='Test content', subreddit='TestSub', link_flair='Showcase'
        )

        assert 'Subreddit: TestSub' in result
        assert 'Flair: Showcase' in result
        assert 'Title: Test Title' in result
        assert 'Content: Test content' in result

    def test_prepare_text_truncates_long_content(self):
        """Test that long content is truncated."""
        service = TopicExtractionService()
        long_text = 'A' * 3000

        result = service._prepare_text(title='Title', selftext=long_text, subreddit='TestSub', link_flair='')

        # Should be truncated to 2000 chars
        assert long_text[:2000] in result
        assert long_text[2001:] not in result

    def test_extract_basic_includes_subreddit(self):
        """Test basic extraction always includes subreddit."""
        service = TopicExtractionService()

        topics = service._extract_basic(
            title='Some title', selftext='', subreddit='ChatGPT', link_flair='', max_topics=10
        )

        assert 'chatgpt' in topics

    def test_extract_basic_detects_tools(self):
        """Test basic extraction detects common AI tools."""
        service = TopicExtractionService()

        topics = service._extract_basic(
            title='Using Claude and ChatGPT together',
            selftext='I built something with LangChain and Python',
            subreddit='AITools',
            link_flair='',
            max_topics=10,
        )

        # Should detect multiple tools
        assert any(t in ['claude', 'chatgpt', 'langchain', 'python'] for t in topics)

    def test_extract_basic_respects_max_topics(self):
        """Test that basic extraction respects max_topics limit."""
        service = TopicExtractionService()

        topics = service._extract_basic(
            title='Claude ChatGPT GPT-4 Midjourney Stable Diffusion',
            selftext='Python JavaScript TypeScript React API Automation',
            subreddit='AITools',
            link_flair='',
            max_topics=5,
        )

        assert len(topics) <= 5

    def test_extract_basic_excludes_generic_flairs(self):
        """Test that generic flairs are excluded."""
        service = TopicExtractionService()

        topics = service._extract_basic(
            title='Test', selftext='', subreddit='Test', link_flair='Discussion', max_topics=10
        )

        # 'discussion' should be excluded
        assert 'discussion' not in topics

    def test_extract_basic_includes_meaningful_flairs(self):
        """Test that meaningful flairs are included."""
        service = TopicExtractionService()

        topics = service._extract_basic(
            title='Test', selftext='', subreddit='Test', link_flair='Tutorial', max_topics=10
        )

        # 'tutorial' should be included
        assert 'tutorial' in topics

    @patch.object(TopicExtractionService, '_extract_with_ai')
    def test_extract_topics_uses_ai_by_default(self, mock_ai):
        """Test that AI extraction is attempted first."""
        mock_ai.return_value = ['test', 'topics']
        service = TopicExtractionService()

        topics = service.extract_topics_from_reddit_post(
            title='Test', selftext='Content', subreddit='Test', link_flair='', max_topics=10
        )

        assert mock_ai.called
        assert topics == ['test', 'topics']

    @patch.object(TopicExtractionService, '_extract_with_ai')
    def test_extract_topics_falls_back_on_error(self, mock_ai):
        """Test fallback to basic extraction on AI error."""
        mock_ai.side_effect = Exception('AI error')
        service = TopicExtractionService()

        topics = service.extract_topics_from_reddit_post(
            title='Test ChatGPT', selftext='', subreddit='AITools', link_flair='', max_topics=10
        )

        # Should fallback and still extract basic topics
        assert 'aitools' in topics

    def test_extract_topics_empty_text(self):
        """Test extraction with empty text returns subreddit."""
        service = TopicExtractionService()

        topics = service.extract_topics_from_reddit_post(
            title='', selftext='', subreddit='Test', link_flair='', max_topics=10
        )

        assert topics == ['test']

    def test_extract_topics_no_subreddit(self):
        """Test extraction with no subreddit returns empty list."""
        service = TopicExtractionService()

        topics = service.extract_topics_from_reddit_post(
            title='', selftext='', subreddit='', link_flair='', max_topics=10
        )

        assert topics == []

    @pytest.mark.django_db
    def test_match_categories_maps_flairs(self):
        """Test that flairs are correctly mapped to categories."""
        from core.taxonomy.models import Taxonomy

        # Create test category
        Taxonomy.objects.create(name='Showcase', slug='showcase', taxonomy_type='category', is_active=True)

        service = TopicExtractionService()
        categories = service.match_categories(topics=['test'], link_flair='Showcase')

        assert len(categories) > 0
        assert categories[0].slug == 'showcase'

    @pytest.mark.django_db
    def test_match_tools_by_name(self):
        """Test tool matching by exact name."""
        from core.tools.models import Tool

        # Create test tool
        Tool.objects.create(
            name='Claude',
            slug='claude',
            tagline='AI assistant',
            description='Test',
            website_url='https://claude.ai',
            is_active=True,
        )

        service = TopicExtractionService()
        tools = service.match_tools(['claude', 'nonexistent'])

        assert len(tools) == 1
        assert tools[0].name == 'Claude'

    @pytest.mark.django_db
    def test_match_tools_by_slug(self):
        """Test tool matching by slug."""
        from core.tools.models import Tool

        # Create test tool
        Tool.objects.create(
            name='GitHub Copilot',
            slug='github-copilot',
            tagline='AI pair programmer',
            description='Test',
            website_url='https://github.com/features/copilot',
            is_active=True,
        )

        service = TopicExtractionService()
        tools = service.match_tools(['github copilot'])

        assert len(tools) == 1
        assert tools[0].slug == 'github-copilot'
