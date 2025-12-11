"""Management command to delete a user by username."""

from django.core.management.base import BaseCommand, CommandError

from core.users.models import User


class Command(BaseCommand):
    """Delete a user by username."""

    help = 'Delete a user by username'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username to delete')
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        username = options['username']
        force = options['force']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f'User "{username}" does not exist') from None

        self.stdout.write(f'Found user: {user.username} (ID: {user.id}, Email: {user.email})')

        if not force:
            confirm = input(f'Are you sure you want to delete user "{username}"? [y/N]: ')
            if confirm.lower() != 'y':
                self.stdout.write(self.style.WARNING('Aborted'))
                return

        # Delete the user (cascades to related objects)
        user.delete()
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted user "{username}"'))
