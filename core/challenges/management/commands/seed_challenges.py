"""
Management command to seed sample weekly challenges for development/testing.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.challenges.models import WeeklyChallenge


class Command(BaseCommand):
    help = 'Seeds sample weekly challenges for development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing challenges before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted_count = WeeklyChallenge.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f'Deleted {deleted_count} existing challenges'))

        now = timezone.now()
        current_week = now.isocalendar()[1]
        current_year = now.year

        challenges_data = [
            {
                'title': 'AI Landscapes: Nature Reimagined',
                'slug': 'ai-landscapes-nature-reimagined',
                'description': (
                    'Use any AI image generator to create a landscape that reimagines nature in '
                    'unexpected ways. Bioluminescent forests, crystal mountains, floating islands—'
                    'let your imagination run wild!'
                ),
                'prompt': 'Create an otherworldly landscape that reimagines nature',
                'status': 'active',
                'week_number': current_week,
                'year': current_year,
                'starts_at': now - timedelta(days=2),
                'submission_deadline': now + timedelta(days=5),
                'voting_deadline': now + timedelta(days=6),
                'ends_at': now + timedelta(days=7),
                'is_featured': True,
                'max_submissions_per_user': 3,
                'allow_voting': True,
                'hero_image_url': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'theme_color': '#06b6d4',
                'prizes': {
                    'first': {'type': 'tokens', 'amount': 500},
                    'second': {'type': 'tokens', 'amount': 300},
                    'third': {'type': 'tokens', 'amount': 150},
                },
                'points_config': {
                    'submit': 50,
                    'vote': 5,
                    'early_bird': 25,
                    'first_place': 200,
                    'second_place': 100,
                    'third_place': 50,
                },
                'suggested_tools': [
                    {
                        'name': 'Midjourney',
                        'url': 'https://midjourney.com',
                        'description': 'Great for photorealistic landscapes',
                    },
                    {
                        'name': 'DALL-E 3',
                        'url': 'https://openai.com/dall-e-3',
                        'description': 'Excellent prompt understanding',
                    },
                    {
                        'name': 'Leonardo AI',
                        'url': 'https://leonardo.ai',
                        'description': 'Free tier available',
                    },
                    {
                        'name': 'Stable Diffusion',
                        'url': 'https://stability.ai',
                        'description': 'Open source, run locally',
                    },
                ],
            },
            {
                'title': 'Retro Futurism: Tomorrow Yesterday',
                'slug': 'retro-futurism-tomorrow-yesterday',
                'description': (
                    """Blend vintage aesthetics with futuristic concepts.

Create AI art that imagines how people from the past envisioned the future -
think 1950s space age, art deco robots, or Victorian steampunk technology.

**Guidelines:**
- Combine retro and futuristic elements
- Any AI tool allowed
- Share your prompt for bonus community love!"""
                ),
                'prompt': 'A retro-futuristic scene blending vintage aesthetics with advanced technology',
                'status': 'upcoming',
                'week_number': current_week + 1,
                'year': current_year,
                'starts_at': now + timedelta(days=7),
                'submission_deadline': now + timedelta(days=12),
                'voting_deadline': now + timedelta(days=13),
                'ends_at': now + timedelta(days=14),
                'is_featured': False,
                'max_submissions_per_user': 3,
                'allow_voting': True,
                'hero_image_url': 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1200',
                'theme_color': '#f59e0b',
                'prizes': {
                    'first': {'type': 'tokens', 'amount': 500},
                    'second': {'type': 'tokens', 'amount': 300},
                    'third': {'type': 'tokens', 'amount': 150},
                },
                'points_config': {
                    'submit': 50,
                    'vote': 5,
                    'early_bird': 25,
                },
            },
            {
                'title': 'Portrait Revolution',
                'slug': 'portrait-revolution-week-45',
                'description': """Last week's challenge was all about pushing portrait boundaries!

Congratulations to all participants who created stunning AI portraits.""",
                'prompt': 'Create an innovative AI portrait',
                'status': 'completed',
                'week_number': current_week - 1,
                'year': current_year,
                'starts_at': now - timedelta(days=14),
                'submission_deadline': now - timedelta(days=9),
                'voting_deadline': now - timedelta(days=8),
                'ends_at': now - timedelta(days=7),
                'is_featured': False,
                'max_submissions_per_user': 3,
                'allow_voting': False,
                'hero_image_url': 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200',
                'theme_color': '#ec4899',
                'prizes': {
                    'first': {'type': 'tokens', 'amount': 500},
                    'second': {'type': 'tokens', 'amount': 300},
                    'third': {'type': 'tokens', 'amount': 150},
                },
                'points_config': {
                    'submit': 50,
                    'vote': 5,
                },
            },
        ]

        created_count = 0
        for data in challenges_data:
            challenge, created = WeeklyChallenge.objects.update_or_create(
                slug=data['slug'],
                defaults=data,
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created challenge: {challenge.title}'))
            else:
                self.stdout.write(f'Updated challenge: {challenge.title}')

        self.stdout.write(self.style.SUCCESS(f'\nSeeding complete! Created {created_count} new challenges.'))
        self.stdout.write(f'Total challenges: {WeeklyChallenge.objects.count()}')
