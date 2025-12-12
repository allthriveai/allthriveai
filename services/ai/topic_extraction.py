"""Topic extraction service using AI to identify relevant topics from text."""

import logging

from core.taxonomy.models import Taxonomy
from core.tools.models import Tool
from services.ai import AIProvider

logger = logging.getLogger(__name__)


class TopicExtractionService:
    """Extract and match topics from text using AI and existing taxonomy."""

    def __init__(self):
        self.ai = AIProvider()  # Use default provider from settings

    def extract_topics_from_reddit_post(
        self,
        title: str,
        selftext: str = '',
        subreddit: str = '',
        link_flair: str = '',
        max_topics: int = 10,
    ) -> list[str]:
        """
        Extract topics from a Reddit post using AI and match against existing taxonomy.

        Args:
            title: Post title
            selftext: Post body text
            subreddit: Subreddit name
            link_flair: Link flair text
            max_topics: Maximum number of topics to return

        Returns:
            List of topic strings (lowercase, normalized)
        """
        # Fetch existing taxonomies for matching
        existing_tools = list(Tool.objects.filter(is_active=True).values_list('name', flat=True))
        existing_categories = list(
            Taxonomy.objects.filter(taxonomy_type='category', is_active=True).values_list('name', flat=True)
        )

        # Build context for AI
        combined_text = self._prepare_text(title, selftext, subreddit, link_flair)

        if not combined_text.strip():
            return [subreddit.lower()] if subreddit else []

        # Use AI to extract topics
        try:
            topics = self._extract_with_ai(
                combined_text,
                subreddit,
                link_flair,
                existing_tools,
                existing_categories,
                max_topics,
            )
            logger.info(f'Extracted {len(topics)} topics from Reddit post: {title[:50]}...')
            return topics
        except Exception as e:
            logger.error(f'Error extracting topics with AI: {e}', exc_info=True)
            # Fallback to basic extraction
            return self._extract_basic(title, selftext, subreddit, link_flair, max_topics)

    def _prepare_text(self, title: str, selftext: str, subreddit: str, link_flair: str) -> str:
        """Prepare combined text for analysis."""
        parts = []
        if subreddit:
            parts.append(f'Subreddit: {subreddit}')
        if link_flair:
            parts.append(f'Flair: {link_flair}')
        if title:
            parts.append(f'Title: {title}')
        if selftext:
            # Truncate long selftext to avoid token limits
            truncated_selftext = selftext[:2000] if len(selftext) > 2000 else selftext
            parts.append(f'Content: {truncated_selftext}')
        return '\n\n'.join(parts)

    def _extract_with_ai(
        self,
        text: str,
        subreddit: str,
        link_flair: str,
        existing_tools: list[str],
        existing_categories: list[str],
        max_topics: int,
    ) -> list[str]:
        """Use AI to extract topics and match against existing taxonomy."""
        system_message = """You are a topic extraction expert for an AI tools and projects platform.
Your task is to identify relevant topics, tools, technologies, and categories from Reddit posts.

Focus on:
- AI tools and technologies (e.g., ChatGPT, Claude, Stable Diffusion, LangChain)
- Programming languages and frameworks
- Technical concepts and methodologies
- Project categories (e.g., automation, data analysis, creative work)
- Domain-specific terms

Return ONLY a comma-separated list of lowercase topics. No explanations or extra text.
Maximum {max_topics} topics. Prioritize the most relevant and specific topics."""

        # Build tool/category hints
        tool_hints = ', '.join(existing_tools[:20]) if existing_tools else 'no specific tools yet'
        category_hints = ', '.join(existing_categories[:10]) if existing_categories else 'no specific categories yet'

        prompt = f"""Analyze this Reddit post and extract relevant topics:

{text}

Existing tools in our database (use these exact names if they match): {tool_hints}

Existing categories in our database (use these exact names if they match): {category_hints}

Extract up to {max_topics} relevant topics as a comma-separated list (lowercase):"""

        response = self.ai.complete(
            prompt=prompt,
            system_message=system_message.format(max_topics=max_topics),
            temperature=0.3,  # Lower temperature for more consistent results
            max_tokens=200,
        )

        # Parse response
        topics = [t.strip().lower() for t in response.split(',') if t.strip()]

        # Always include subreddit as first topic
        if subreddit and subreddit.lower() not in topics:
            topics.insert(0, subreddit.lower())

        # Add link flair if meaningful
        if link_flair and link_flair.lower() not in ['discussion', 'question', 'showcase']:
            if link_flair.lower() not in topics:
                topics.append(link_flair.lower())

        # Deduplicate and limit
        seen = set()
        unique_topics = []
        for topic in topics:
            if topic not in seen and len(unique_topics) < max_topics:
                seen.add(topic)
                unique_topics.append(topic)

        return unique_topics

    def _extract_basic(
        self,
        title: str,
        selftext: str,
        subreddit: str,
        link_flair: str,
        max_topics: int,
    ) -> list[str]:
        """Fallback basic extraction without AI."""
        topics = []

        # Add subreddit
        if subreddit:
            topics.append(subreddit.lower())

        # Add link flair if meaningful
        if link_flair and link_flair.lower() not in ['discussion', 'question', 'showcase']:
            topics.append(link_flair.lower())

        # Basic keyword detection
        combined_text = (title + ' ' + selftext).lower()

        # Common AI tools
        tool_keywords = [
            'claude',
            'chatgpt',
            'gpt-4',
            'gpt-3',
            'copilot',
            'midjourney',
            'stable diffusion',
            'dall-e',
            'langchain',
            'openai',
            'anthropic',
            'llama',
            'mistral',
            'gemini',
            'hugging face',
            'replicate',
            'python',
            'javascript',
            'typescript',
            'react',
            'nextjs',
            'api',
            'automation',
            'machine learning',
            'deep learning',
            'nlp',
        ]

        for keyword in tool_keywords:
            if keyword in combined_text and keyword not in topics:
                topics.append(keyword)
                if len(topics) >= max_topics:
                    break

        return topics[:max_topics]

    def match_tools(self, topics: list[str]) -> list[Tool]:
        """
        Match extracted topics to existing Tool objects.

        Args:
            topics: List of topic strings

        Returns:
            List of matching Tool objects
        """
        matched_tools = []

        for topic in topics:
            # Try exact name match first
            tool = Tool.objects.filter(name__iexact=topic, is_active=True).first()
            if tool and tool not in matched_tools:
                matched_tools.append(tool)
                continue

            # Try slug match
            tool = Tool.objects.filter(slug__iexact=topic.replace(' ', '-'), is_active=True).first()
            if tool and tool not in matched_tools:
                matched_tools.append(tool)
                continue

            # Try tags match
            tools = Tool.objects.filter(tags__contains=[topic], is_active=True)[:1]
            if tools and tools[0] not in matched_tools:
                matched_tools.append(tools[0])

        return matched_tools

    def match_categories(self, topics: list[str], link_flair: str = '') -> list[Taxonomy]:
        """
        Match extracted topics to existing Category taxonomies.

        Args:
            topics: List of topic strings
            link_flair: Link flair for additional matching

        Returns:
            List of matching Taxonomy objects (categories)
        """
        matched_categories = []

        # Flair to category mapping
        flair_mapping = {
            'showcase': 'showcase',
            'question': 'ai-learning',
            'tutorial': 'ai-learning',
            'discussion': 'ai-discussion',
            'help': 'ai-learning',
            'news': 'ai-news',
            'project': 'showcase',
            'bug': 'troubleshooting',
            'feature request': 'feature-requests',
        }

        # Try flair mapping first
        if link_flair:
            category_slug = flair_mapping.get(link_flair.lower())
            if category_slug:
                category = Taxonomy.objects.filter(
                    slug=category_slug,
                    taxonomy_type='category',
                    is_active=True,
                ).first()
                if category and category not in matched_categories:
                    matched_categories.append(category)

        # Match topics to categories
        for topic in topics:
            # Try exact name match
            category = Taxonomy.objects.filter(
                name__iexact=topic,
                taxonomy_type='category',
                is_active=True,
            ).first()
            if category and category not in matched_categories:
                matched_categories.append(category)
                continue

            # Try slug match
            category = Taxonomy.objects.filter(
                slug__iexact=topic.replace(' ', '-'),
                taxonomy_type='category',
                is_active=True,
            ).first()
            if category and category not in matched_categories:
                matched_categories.append(category)

        return matched_categories
