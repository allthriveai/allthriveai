"""
Management command to auto-assign topics to tools based on their category.

This is a one-time migration script to populate the topics M2M relationship
for existing tools that don't have topics assigned.

Usage:
    python manage.py assign_tool_topics           # Assign topics
    python manage.py assign_tool_topics --dry-run # Preview changes
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from core.taxonomy.models import Taxonomy
from core.tools.models import Tool

# Category to topic slug mapping
# Each category maps to one or more topic slugs
CATEGORY_TOPIC_MAP = {
    # AI Tool categories
    'chat': ['llm-providers'],
    'code': ['code-assistants'],
    'image': ['image-generation'],
    'video': ['video-generation'],
    'audio': ['voice-ai'],
    'writing': ['llm-providers'],
    'research': ['llm-providers'],
    'productivity': ['productivity'],
    'data': ['observability'],
    'design': ['image-generation'],
    # Technology categories
    'framework': ['web-frameworks'],
    'database': ['databases'],
    'infrastructure': ['devops'],
    'cloud': ['cloud-platforms'],
    'language': ['programming-languages'],
    'testing': ['testing'],
    'developer-tools': ['devops'],
    'developer_tools': ['devops'],
    'other': [],
}

# Special tool name patterns for more specific assignments
TOOL_NAME_PATTERNS = {
    # Vector databases (override generic database category)
    'qdrant': ['vector-databases', 'rag', 'embedding-providers'],
    'weaviate': ['vector-databases', 'rag', 'embedding-providers'],
    'pinecone': ['vector-databases', 'rag', 'embedding-providers'],
    'chroma': ['vector-databases', 'rag', 'embedding-providers'],
    'milvus': ['vector-databases', 'rag', 'embedding-providers'],
    # LLM providers
    'claude': ['llm-providers'],
    'gpt': ['llm-providers'],
    'gemini': ['llm-providers'],
    'mistral': ['llm-providers'],
    'llama': ['llm-providers'],
    'grok': ['llm-providers'],
    # Agent frameworks
    'langchain': ['agent-frameworks', 'orchestration', 'rag', 'llm-providers'],
    'llamaindex': ['agent-frameworks', 'rag', 'orchestration'],
    'llama index': ['agent-frameworks', 'rag', 'orchestration'],  # Alternate spelling
    'crewai': ['agent-frameworks'],
    'autogen': ['agent-frameworks'],
    'dspy': ['agent-frameworks', 'orchestration'],
    # Code assistants
    'cursor': ['code-assistants'],
    'copilot': ['code-assistants'],
    'codeium': ['code-assistants'],
    'tabnine': ['code-assistants'],
    'claude code': ['code-assistants'],
    # Observability
    'langsmith': ['observability', 'orchestration'],
    'langfuse': ['observability'],
    'helicone': ['observability'],
    'promptlayer': ['observability'],
    # Embedding providers
    'openai': ['llm-providers', 'embedding-providers'],
    'cohere': ['llm-providers', 'embedding-providers'],
    'voyage': ['embedding-providers'],
    # Redis vector
    'redisvl': ['vector-databases', 'rag'],
    # Graph databases
    'neo4j': ['databases'],
    # Redis (cache/in-memory database)
    'redis': ['databases'],
    # Image generation
    'dall-e': ['image-generation'],
    'midjourney': ['image-generation'],
    'stable diffusion': ['image-generation'],
    'ideogram': ['image-generation'],
    'leonardo': ['image-generation'],
    # Voice AI
    'elevenlabs': ['voice-ai'],
    'whisper': ['voice-ai'],
    'deepgram': ['voice-ai'],
    'resemble': ['voice-ai'],
    # RAG tools
    'notebooklm': ['rag', 'llm-providers'],
    'perplexity': ['rag', 'llm-providers', 'research'],
}


class Command(BaseCommand):
    help = 'Auto-assign topics to tools based on their category'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Reassign topics even for tools that already have topics',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']

        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No changes will be made\n'))

        # Get all topic slugs we'll be using
        all_topic_slugs = set()
        for slugs in CATEGORY_TOPIC_MAP.values():
            all_topic_slugs.update(slugs)
        for slugs in TOOL_NAME_PATTERNS.values():
            all_topic_slugs.update(slugs)

        # Verify topics exist
        existing_topics = {
            t.slug: t
            for t in Taxonomy.objects.filter(
                taxonomy_type='topic',
                is_active=True,
                slug__in=all_topic_slugs,
            )
        }

        missing_topics = all_topic_slugs - set(existing_topics.keys())
        if missing_topics:
            self.stdout.write(self.style.ERROR(f'Missing topics in database: {missing_topics}'))
            self.stdout.write('Run "python manage.py seed_topics" first.')
            return

        self.stdout.write(f'Found {len(existing_topics)} topics for assignment\n')

        # Get tools to process
        if force:
            tools = Tool.objects.filter(is_active=True)
        else:
            # Only tools without topics
            tools = Tool.objects.filter(is_active=True, topics__isnull=True)

        total = tools.count()
        self.stdout.write(f'Processing {total} tools...\n')

        stats = {'assigned': 0, 'skipped': 0, 'no_mapping': 0}

        try:
            with transaction.atomic():
                for tool in tools:
                    topic_slugs = self._get_topics_for_tool(tool)

                    if not topic_slugs:
                        stats['no_mapping'] += 1
                        self.stdout.write(self.style.NOTICE(f'  ? {tool.name} ({tool.category}) - no mapping'))
                        continue

                    # Get topic objects
                    topics = [existing_topics[slug] for slug in topic_slugs if slug in existing_topics]

                    if not topics:
                        stats['skipped'] += 1
                        continue

                    if not dry_run:
                        tool.topics.set(topics)

                    stats['assigned'] += 1
                    topic_names = [t.name for t in topics]
                    self.stdout.write(self.style.SUCCESS(f'  ✓ {tool.name} → {topic_names}'))

                if dry_run:
                    raise DryRunException()

        except DryRunException:
            pass

        # Summary
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(self.style.HTTP_INFO('SUMMARY'))
        self.stdout.write('=' * 50)
        prefix = '[DRY RUN] Would have ' if dry_run else ''
        self.stdout.write(f'{prefix}Assigned topics: {stats["assigned"]}')
        self.stdout.write(f'{prefix}Skipped (no mapping): {stats["no_mapping"]}')
        self.stdout.write(f'{prefix}Skipped (other): {stats["skipped"]}')

    def _get_topics_for_tool(self, tool):
        """Determine which topics to assign to a tool."""
        tool_name_lower = tool.name.lower()

        # Check name patterns first (more specific)
        for pattern, topic_slugs in TOOL_NAME_PATTERNS.items():
            if pattern in tool_name_lower:
                return topic_slugs

        # Fall back to category mapping
        category = tool.category
        if category in CATEGORY_TOPIC_MAP:
            return CATEGORY_TOPIC_MAP[category]

        return []


class DryRunException(Exception):
    """Exception to trigger rollback in dry run mode."""

    pass
