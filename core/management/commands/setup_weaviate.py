"""
Management command to set up Weaviate vector database schema.

Usage:
    python manage.py setup_weaviate           # Create all collections
    python manage.py setup_weaviate --reset   # Delete and recreate collections
    python manage.py setup_weaviate --check   # Check connection status only
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
