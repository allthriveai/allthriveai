"""Delete the old material_texture challenge type."""

from django.core.management.base import BaseCommand

from core.battles.models import ChallengeType


class Command(BaseCommand):
    help = 'Delete the old material_texture challenge type that was replaced'

    def handle(self, *args, **options):
        deleted_count, _ = ChallengeType.objects.filter(key='material_texture').delete()

        if deleted_count > 0:
            self.stdout.write(self.style.SUCCESS(f'✓ Deleted {deleted_count} material_texture challenge type'))
        else:
            self.stdout.write(
                self.style.WARNING('No material_texture challenge type found (already deleted or never existed)')
            )

        # Show remaining challenge types
        remaining = ChallengeType.objects.count()
        self.stdout.write(f'Total challenge types remaining: {remaining}')
