"""Management command to seed battle prompts for prompt battles."""

from django.core.management.base import BaseCommand

from core.battles.models import PromptChallengePrompt

# Default prompts for battles - designed for AI image generation battles
DEFAULT_PROMPTS = [
    # Dreamscapes
    'A floating city in the clouds at golden hour',
    'An underwater garden where fish swim among glowing flowers',
    'A treehouse village connected by rope bridges at sunset',
    'A crystal cave with light refracting through gemstones',
    'A magical library where books fly through the air',
    # Characters
    'A wise old wizard in their enchanted workshop',
    'A cyberpunk street vendor in a neon-lit alley',
    'A forest spirit emerging from ancient oak trees',
    'A dragon hatchling discovering fire for the first time',
    'A robot learning to paint in an art studio',
    # Scenarios
    'The moment a phoenix rises from ashes',
    'Two travelers meeting at a crossroads under a starry sky',
    'A scientist making a breakthrough discovery',
    'A musician playing to a crowd of magical creatures',
    'An explorer finding a hidden temple in the jungle',
    # Abstract/Conceptual
    'The concept of time visualized as a physical space',
    'What hope would look like as a living creature',
    'A world where gravity works differently',
    'The boundary between dreams and reality',
    'A symphony transformed into visual art',
    # Seasonal/Weather
    'First snow falling on a busy city street',
    'A thunderstorm over a peaceful meadow',
    'Cherry blossoms floating on a still pond',
    'Northern lights dancing over ice mountains',
    'A summer festival with floating lanterns',
    # Food/Objects
    'A feast fit for royalty on an impossible table',
    'An antique shop with objects from different eras',
    'A magical kitchen where ingredients cook themselves',
    'A garden of mechanical flowers that bloom at night',
    'A cozy reading nook in an impossible location',
]


class Command(BaseCommand):
    help = 'Seed battle prompts for prompt battles feature'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Delete all existing prompts and reseed',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating',
        )

    def handle(self, *args, **options):
        force = options['force']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))

        existing_count = PromptChallengePrompt.objects.count()

        if existing_count > 0 and not force:
            self.stdout.write(
                self.style.WARNING(
                    f'Found {existing_count} existing prompts. '
                    'Use --force to delete and reseed, or add new prompts manually.'
                )
            )
            return

        if force and not dry_run:
            deleted_count = PromptChallengePrompt.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f'Deleted {deleted_count} existing prompts'))

        created_count = 0
        for prompt_text in DEFAULT_PROMPTS:
            # Check if prompt already exists (by text)
            if not dry_run:
                prompt, created = PromptChallengePrompt.objects.get_or_create(
                    prompt_text=prompt_text,
                    defaults={
                        'difficulty': 'medium',
                        'is_active': True,
                        'weight': 1.0,
                    },
                )
                if created:
                    created_count += 1
                    self.stdout.write(f'  Created: {prompt_text[:50]}...')
            else:
                self.stdout.write(f'  Would create: {prompt_text[:50]}...')
                created_count += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f'\nWould create {created_count} prompts'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nCreated {created_count} prompts'))
            total = PromptChallengePrompt.objects.filter(is_active=True).count()
            self.stdout.write(self.style.SUCCESS(f'Total active prompts: {total}'))
