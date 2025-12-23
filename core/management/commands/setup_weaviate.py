"""
Management command to set up Weaviate vector database schema.

Usage:
    python manage.py setup_weaviate                  # Create all collections
    python manage.py setup_weaviate --reset          # Delete and recreate collections
    python manage.py setup_weaviate --check          # Check connection status only
    python manage.py setup_weaviate --reindex        # Trigger full reindex of all projects
    python manage.py setup_weaviate --reindex-users  # Trigger full reindex of user profiles
    python manage.py setup_weaviate --reindex-all    # Reindex ALL content types
"""

from django.core.management.base import BaseCommand

from services.weaviate import WeaviateClient, WeaviateSchema


class Command(BaseCommand):
    help = 'Set up Weaviate vector database schema for personalization'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing collections and recreate them',
        )
        parser.add_argument(
            '--check',
            action='store_true',
            help='Only check connection status',
        )
        parser.add_argument(
            '--reindex',
            action='store_true',
            help='Trigger full reindex of all projects to Weaviate',
        )
        parser.add_argument(
            '--reindex-users',
            action='store_true',
            help='Trigger full reindex of user profiles to Weaviate',
        )
        parser.add_argument(
            '--reindex-all',
            action='store_true',
            help='Trigger full reindex of ALL content (projects, users, quizzes, tools, concepts, lessons)',
        )

    def handle(self, *args, **options):
        client = WeaviateClient()

        # Check connection
        self.stdout.write('Checking Weaviate connection...')

        if not client.is_available():
            self.stdout.write(
                self.style.ERROR(
                    f'Failed to connect to Weaviate at {client.url}. '
                    'Make sure Weaviate is running (docker-compose up weaviate)'
                )
            )
            return

        self.stdout.write(self.style.SUCCESS(f'Connected to Weaviate at {client.url}'))

        if options['check']:
            # Just check connection and exit
            return

        # Handle reindex options
        if options['reindex'] or options['reindex_users'] or options['reindex_all']:
            self._handle_reindex(options)
            return

        if options['reset']:
            self.stdout.write('Deleting existing collections...')
            results = WeaviateSchema.delete_all_collections(client.client)
            for name, success in results.items():
                if success:
                    self.stdout.write(f'  Deleted: {name}')
                else:
                    self.stdout.write(self.style.WARNING(f'  Failed to delete: {name}'))

        # Create collections
        self.stdout.write('Creating collections...')
        results = client.ensure_schema()

        for name, success in results.items():
            if success:
                self.stdout.write(self.style.SUCCESS(f'  Created: {name}'))
            else:
                self.stdout.write(self.style.ERROR(f'  Failed: {name}'))

        self.stdout.write(self.style.SUCCESS('Weaviate setup complete!'))

    def _handle_reindex(self, options):
        """Handle reindex operations."""
        from services.weaviate.tasks import (
            full_reindex_concepts,
            full_reindex_micro_lessons,
            full_reindex_projects,
            full_reindex_quizzes,
            full_reindex_tools,
            full_reindex_users,
        )

        if options['reindex_all']:
            # Reindex everything
            self.stdout.write('Triggering full reindex of projects...')
            result = full_reindex_projects.delay()
            self.stdout.write(self.style.SUCCESS(f'  Projects reindex queued: task_id={result.id}'))

            self.stdout.write('Triggering full reindex of users...')
            result = full_reindex_users.delay()
            self.stdout.write(self.style.SUCCESS(f'  Users reindex queued: task_id={result.id}'))

            self.stdout.write('Triggering full reindex of quizzes...')
            result = full_reindex_quizzes.delay()
            self.stdout.write(self.style.SUCCESS(f'  Quizzes reindex queued: task_id={result.id}'))

            self.stdout.write('Triggering full reindex of tools...')
            result = full_reindex_tools.delay()
            self.stdout.write(self.style.SUCCESS(f'  Tools reindex queued: task_id={result.id}'))

            self.stdout.write('Triggering full reindex of concepts...')
            result = full_reindex_concepts.delay()
            self.stdout.write(self.style.SUCCESS(f'  Concepts reindex queued: task_id={result.id}'))

            self.stdout.write('Triggering full reindex of micro lessons...')
            result = full_reindex_micro_lessons.delay()
            self.stdout.write(self.style.SUCCESS(f'  Micro lessons reindex queued: task_id={result.id}'))

            self.stdout.write(self.style.SUCCESS('\nAll reindex tasks queued! Monitor Celery logs for progress.'))
        elif options['reindex']:
            self.stdout.write('Triggering full reindex of projects...')
            result = full_reindex_projects.delay()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Projects reindex queued: task_id={result.id}\n' 'Monitor Celery logs for progress.'
                )
            )
        elif options['reindex_users']:
            self.stdout.write('Triggering full reindex of user profiles...')
            result = full_reindex_users.delay()
            self.stdout.write(
                self.style.SUCCESS(f'Users reindex queued: task_id={result.id}\n' 'Monitor Celery logs for progress.')
            )
