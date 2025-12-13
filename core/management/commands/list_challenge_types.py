"""List all challenge types in the database."""

from django.core.management.base import BaseCommand

from core.battles.models import ChallengeType


class Command(BaseCommand):
    help = 'List all challenge types'

    def handle(self, *args, **options):
        cts = ChallengeType.objects.all().order_by('order')
        self.stdout.write(f'Total Challenge Types: {cts.count()}')
        self.stdout.write('')

        for ct in cts:
            self.stdout.write(self.style.SUCCESS(f'{ct.key}: {ct.name}'))
            # Show first template to verify content
            if ct.templates:
                self.stdout.write(f'  Template: {ct.templates[0][:100]}')
            self.stdout.write('')
