"""
Management command to seed quest categories and side quests.

Usage:
    python manage.py seed_quests
    python manage.py seed_quests --category creative-maker
    python manage.py seed_quests --category site-explorer
"""

from django.core.management.base import BaseCommand

from core.thrive_circle.seed_quests import (
    seed_all_quests,
    seed_categories,
    seed_community_quests,
    seed_creative_quests,
    seed_daily_quests,
    seed_exploration_quests,
    seed_learning_quests,
)


class Command(BaseCommand):
    help = 'Seed quest categories and side quests'

    def add_arguments(self, parser):
        parser.add_argument(
            '--category',
            type=str,
            help='Specific category to seed (e.g., creative-maker, site-explorer)',
        )

    def handle(self, *args, **options):
        category_slug = options.get('category')

        if category_slug:
            # Seed specific category
            categories = seed_categories()
            if category_slug not in categories:
                self.stderr.write(self.style.ERROR(f'Category "{category_slug}" not found'))
                return

            category = categories[category_slug]
            self.stdout.write(f'Seeding quests for category: {category.name}')

            if category_slug == 'community-builder':
                seed_community_quests(category)
            elif category_slug == 'learning-explorer':
                seed_learning_quests(category)
            elif category_slug == 'creative-maker':
                seed_creative_quests(category)
            elif category_slug == 'site-explorer':
                seed_exploration_quests(category)
            elif category_slug == 'daily-challenges':
                seed_daily_quests(category)

            self.stdout.write(self.style.SUCCESS(f'Successfully seeded {category.name} quests'))
        else:
            # Seed all categories and quests
            self.stdout.write('Seeding all quest categories and quests...')
            seed_all_quests()
            self.stdout.write(self.style.SUCCESS('Successfully seeded all quests'))
