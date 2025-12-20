"""
Management command to seed games to Weaviate for unified search.

Usage:
    python manage.py seed_games           # Seed all games to Weaviate
    python manage.py seed_games --reset   # Delete and reseed games
"""

import uuid

from django.core.management.base import BaseCommand

from core.games.config import GAMES
from core.games.models import GameScore
from services.weaviate import WeaviateClient, WeaviateSchema
from services.weaviate.embeddings import get_embedding_service


class Command(BaseCommand):
    help = 'Seed games to Weaviate for unified search'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing game entries and reseed',
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

        # Ensure Game collection exists
        collection_name = WeaviateSchema.GAME_COLLECTION
        try:
            if not client.client.schema.exists(collection_name):
                self.stdout.write(f'Creating {collection_name} collection...')
                client.client.schema.create_class(WeaviateSchema.get_game_schema())
                self.stdout.write(self.style.SUCCESS(f'  Created: {collection_name}'))
            else:
                self.stdout.write(f'Collection {collection_name} already exists')

                if options['reset']:
                    self.stdout.write('Resetting: Deleting all games from collection...')
                    client.client.schema.delete_class(collection_name)
                    client.client.schema.create_class(WeaviateSchema.get_game_schema())
                    self.stdout.write(self.style.SUCCESS('  Collection reset'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to setup collection: {e}'))
            return

        # Get embedding service
        embedding_service = get_embedding_service()

        # Seed games
        self.stdout.write('Seeding games to Weaviate...')

        for game in GAMES:
            try:
                # Generate stable UUID from game_id
                weaviate_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f'game:{game["game_id"]}'))

                # Create combined text for embedding
                combined_text = f"{game['title']} {game['description']} {' '.join(game['topic_tags'])}"

                # Generate embedding
                embedding = embedding_service.generate_embedding(combined_text)

                if embedding is None:
                    self.stdout.write(self.style.WARNING(f'  Failed to generate embedding for {game["title"]}'))
                    continue

                # Get player count from database
                player_count = GameScore.objects.filter(game=game['game_id']).values('user').distinct().count()

                # Prepare data object
                data_object = {
                    'game_id': game['game_id'],
                    'weaviate_uuid': weaviate_uuid,
                    'title': game['title'],
                    'combined_text': combined_text,
                    'description': game['description'],
                    'learning_outcomes': game['learning_outcomes'],
                    'topic_tags': game['topic_tags'],
                    'difficulty': game['difficulty'],
                    'url': game['url'],
                    'player_count': player_count,
                    'content_type_name': 'Game',
                }

                # Check if game already exists
                existing = client.get_by_property(
                    collection=collection_name,
                    property_name='game_id',
                    property_value=game['game_id'],
                )

                if existing:
                    # Update existing
                    existing_uuid = existing.get('_additional', {}).get('id')
                    if existing_uuid:
                        client.client.data_object.update(
                            data_object=data_object,
                            class_name=collection_name,
                            uuid=existing_uuid,
                            vector=embedding,
                        )
                        self.stdout.write(self.style.SUCCESS(f'  Updated: {game["title"]}'))
                else:
                    # Create new
                    client.client.data_object.create(
                        data_object=data_object,
                        class_name=collection_name,
                        uuid=weaviate_uuid,
                        vector=embedding,
                    )
                    self.stdout.write(self.style.SUCCESS(f'  Created: {game["title"]}'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Failed to seed {game["title"]}: {e}'))

        self.stdout.write(self.style.SUCCESS(f'\nSeeded {len(GAMES)} games to Weaviate!'))
