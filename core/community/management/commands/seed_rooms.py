"""
Management command to seed default community rooms (The Lounge).

Usage:
    python manage.py seed_rooms           # Create all default rooms
    python manage.py seed_rooms --reset   # Delete and recreate rooms
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from core.community.models import Room

# Default forum rooms for The Lounge
# Note: Starting with just General room. More rooms can be added as the community grows.
DEFAULT_ROOMS = [
    {
        'slug': 'general',
        'name': 'General',
        'description': 'Welcome to the community! Introduce yourself and chat about anything AI-related.',
        'icon': 'comments',
        'position': 0,
        'is_default': True,
    },
    # Future rooms (uncomment as community grows):
    # {
    #     'slug': 'announcements',
    #     'name': 'Announcements',
    #     'description': 'Official updates, new features, and community news from the AllThrive team.',
    #     'icon': 'bullhorn',
    #     'position': 1,
    #     'is_default': False,
    #     'min_trust_to_post': 5,
    # },
    # {
    #     'slug': 'showcase',
    #     'name': 'Showcase',
    #     'description': 'Share your AI projects, get feedback, and celebrate wins with the community.',
    #     'icon': 'star',
    #     'position': 2,
    #     'is_default': False,
    # },
    # {
    #     'slug': 'help',
    #     'name': 'Help & Support',
    #     'description': 'Need help with AI tools or the platform? Ask questions and get answers from the community.',
    #     'icon': 'circle-question',
    #     'position': 3,
    #     'is_default': False,
    # },
    # {
    #     'slug': 'learning',
    #     'name': 'Learning Together',
    #     'description': 'Share resources, discuss tutorials, and learn AI skills together.',
    #     'icon': 'graduation-cap',
    #     'position': 4,
    #     'is_default': False,
    # },
    # {
    #     'slug': 'tools-and-tech',
    #     'name': 'Tools & Tech',
    #     'description': 'Discuss AI tools, compare features, and share tips and tricks.',
    #     'icon': 'wrench',
    #     'position': 5,
    #     'is_default': False,
    # },
    # {
    #     'slug': 'off-topic',
    #     'name': 'Off Topic',
    #     'description': 'Chat about anything not AI-related. Hobbies, life, random thoughts - all welcome!',
    #     'icon': 'coffee',
    #     'position': 6,
    #     'is_default': False,
    # },
    # {
    #     'slug': 'feedback',
    #     'name': 'Feedback & Ideas',
    #     'description': 'Share your ideas for improving AllThrive. Feature requests, bug reports, and suggestions.',
    #     'icon': 'lightbulb',
    #     'position': 7,
    #     'is_default': False,
    # },
]


class Command(BaseCommand):
    help = 'Seed default community rooms for The Lounge'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing default rooms and recreate them',
        )

    def handle(self, *args, **options):
        reset = options['reset']

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('  Seeding Community Rooms (The Lounge)'))
        self.stdout.write(self.style.SUCCESS('=' * 60 + '\n'))

        if reset:
            self.stdout.write(self.style.WARNING('Resetting default rooms...'))
            # Only delete system-created forum rooms (no creator)
            deleted_count, _ = Room.objects.filter(
                room_type='forum',
                creator__isnull=True,
                slug__in=[r['slug'] for r in DEFAULT_ROOMS],
            ).delete()
            self.stdout.write(f'  Deleted {deleted_count} existing rooms\n')

        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for room_data in DEFAULT_ROOMS:
                slug = room_data['slug']
                defaults = {
                    'name': room_data['name'],
                    'description': room_data['description'],
                    'icon': room_data['icon'],
                    'position': room_data['position'],
                    'is_default': room_data.get('is_default', False),
                    'room_type': 'forum',
                    'visibility': 'public',
                    'is_active': True,
                    'min_trust_to_join': room_data.get('min_trust_to_join', 0),
                    'min_trust_to_post': room_data.get('min_trust_to_post', 0),
                }

                room, created = Room.objects.update_or_create(
                    slug=slug,
                    defaults=defaults,
                )

                if created:
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f'  ✅ Created: {room.name}'))
                else:
                    updated_count += 1
                    self.stdout.write(f'  📝 Updated: {room.name}')

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('  Summary'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'  Created: {created_count}')
        self.stdout.write(f'  Updated: {updated_count}')
        self.stdout.write(f'  Total rooms: {len(DEFAULT_ROOMS)}')
        self.stdout.write('')
