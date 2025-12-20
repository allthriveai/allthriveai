"""
Management command to create game teaser projects for the explore feed.

Usage:
    python manage.py seed_game_projects           # Create game projects
    python manage.py seed_game_projects --reset   # Delete and recreate game projects
"""

from django.core.management.base import BaseCommand

from core.games.config import GAMES
from core.projects.models import Project
from core.taxonomy.models import Taxonomy
from core.users.models import User

# Map game slugs to their promo image paths
GAME_PROMO_IMAGES = {
    'context-snake': '/games/game-context-snake-promo.png',
    'ethics-defender': '/games/game-ethics-defender-promo.png',
    'prompt-battle': '/games/game-prompt-battle-promo.png',
}


class Command(BaseCommand):
    help = 'Create game teaser projects for the explore feed'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing game projects and recreate them',
        )
        parser.add_argument(
            '--username',
            type=str,
            default='pip',
            help='Username to own the game projects (default: pip)',
        )

    def handle(self, *args, **options):
        username = options['username']

        # Get or create the user
        try:
            user = User.objects.get(username=username)
            self.stdout.write(f'Using existing user: @{username}')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User '{username}' not found"))
            self.stdout.write('Create the user first with: make create-pip')
            return

        # Get or create the game content type taxonomy
        game_content_type, _ = Taxonomy.objects.get_or_create(
            taxonomy_type='content_type',
            slug='content-game',
            defaults={
                'name': 'Game',
                'description': 'Interactive games and playable experiences',
                'is_active': True,
            },
        )

        if options['reset']:
            # Delete existing game projects
            deleted_count, _ = Project.objects.filter(
                user=user,
                type=Project.ProjectType.GAME,
            ).delete()
            self.stdout.write(f'Deleted {deleted_count} existing game projects')

        created_count = 0
        updated_count = 0

        for game in GAMES:
            slug = game['slug']
            promo_image = GAME_PROMO_IMAGES.get(slug, '')

            # Check if project already exists
            existing = Project.objects.filter(
                user=user,
                slug=slug,
            ).first()

            project_data = {
                'title': game['title'],
                'description': game['description'],
                'type': Project.ProjectType.GAME,
                'featured_image_url': promo_image,
                'is_showcased': True,
                'is_private': False,
                'is_archived': False,
                'is_promoted': True,  # Show games prominently in feed
                'content': {
                    'game_url': game['url'],
                    'game_id': game['game_id'],
                    'difficulty': game['difficulty'],
                    'learning_outcomes': game['learning_outcomes'],
                    'topic_tags': game['topic_tags'],
                    'heroDisplayMode': 'image',
                },
            }

            if existing:
                # Update existing project
                for key, value in project_data.items():
                    setattr(existing, key, value)
                existing.save()
                existing.categories.add(game_content_type)
                updated_count += 1
                self.stdout.write(f'  Updated: @{username}/{existing.slug}')
            else:
                # Create new project
                project = Project.objects.create(
                    user=user,
                    slug=slug,
                    **project_data,
                )
                project.categories.add(game_content_type)
                created_count += 1
                self.stdout.write(f'  Created: @{username}/{project.slug}')

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone! Created {created_count}, updated {updated_count} game projects for @{username}'
            )
        )
