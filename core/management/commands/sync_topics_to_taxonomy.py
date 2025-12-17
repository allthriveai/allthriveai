"""
Management command to sync all existing project topics to the Topic taxonomy.

This command scans all projects and ensures their topics exist in the
Taxonomy model with taxonomy_type='topic'. This is useful for:
- Initial population of the topic taxonomy
- Catching up after bulk imports
- Periodic maintenance

Usage:
    python manage.py sync_topics_to_taxonomy
    python manage.py sync_topics_to_taxonomy --dry-run
    python manage.py sync_topics_to_taxonomy --source quizzes
"""

from collections import Counter

from django.core.management.base import BaseCommand

from core.projects.models import Project
from core.quizzes.models import Quiz
from core.taxonomy.models import Taxonomy
from core.taxonomy.topic_service import ensure_topics_in_taxonomy, is_valid_topic


class Command(BaseCommand):
    help = 'Sync existing project/quiz topics to the Topic taxonomy'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating',
        )
        parser.add_argument(
            '--source',
            choices=['all', 'projects', 'quizzes'],
            default='all',
            help='Source to sync topics from (default: all)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        source = options['source']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be made'))

        # Get existing topic count
        existing_topics = set(
            Taxonomy.objects.filter(taxonomy_type=Taxonomy.TaxonomyType.TOPIC).values_list('slug', flat=True)
        )
        self.stdout.write(f'Existing topics in taxonomy: {len(existing_topics)}')

        # Collect all topics from sources
        all_topics = Counter()

        if source in ('all', 'projects'):
            self.stdout.write('\nScanning projects...')
            project_count = 0
            for project in Project.objects.filter(is_archived=False).only('topics'):
                if project.topics:
                    project_count += 1
                    for topic in project.topics:
                        if is_valid_topic(topic):
                            all_topics[topic.strip()] += 1

            self.stdout.write(f'  Found topics in {project_count} projects')

        if source in ('all', 'quizzes'):
            self.stdout.write('\nScanning quizzes...')
            quiz_count = 0
            for quiz in Quiz.objects.filter(is_published=True).only('topics', 'topic'):
                quiz_count += 1
                # Check both topics array and legacy topic field
                topics_to_add = []
                if quiz.topics:
                    topics_to_add.extend(quiz.topics)
                if quiz.topic:
                    topics_to_add.append(quiz.topic)

                for topic in topics_to_add:
                    if is_valid_topic(topic):
                        all_topics[topic.strip()] += 1

            self.stdout.write(f'  Found topics in {quiz_count} quizzes')

        # Show top topics
        self.stdout.write(f'\nTotal unique topics found: {len(all_topics)}')
        self.stdout.write('\nTop 20 topics by usage:')
        for topic, count in all_topics.most_common(20):
            self.stdout.write(f'  {topic}: {count} uses')

        # Create new topics
        if not dry_run:
            self.stdout.write('\nCreating new topics in taxonomy...')
            new_topics = ensure_topics_in_taxonomy(list(all_topics.keys()))
            new_count = len([t for t in new_topics if t.slug not in existing_topics])
            self.stdout.write(self.style.SUCCESS(f'\nCreated {new_count} new topics in taxonomy'))
        else:
            # Calculate how many would be new
            from core.taxonomy.topic_service import normalize_topic_slug

            new_slugs = set()
            for topic in all_topics.keys():
                slug = normalize_topic_slug(topic)
                if slug and slug not in existing_topics:
                    new_slugs.add(slug)

            self.stdout.write(self.style.WARNING(f'\nWould create {len(new_slugs)} new topics (dry run)'))

        # Final count
        final_count = Taxonomy.objects.filter(taxonomy_type=Taxonomy.TaxonomyType.TOPIC).count()
        self.stdout.write(f'\nTotal topics in taxonomy: {final_count}')
