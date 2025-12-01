"""
Management command to update existing Reddit bot users with Reddit logo avatars.
Run with: python manage.py update_reddit_bot_avatars
"""

from django.core.management.base import BaseCommand

from core.users.models import User, UserRole


class Command(BaseCommand):
    help = 'Update existing Reddit bot users to use the Reddit logo as their avatar'

    def handle(self, *args, **options):
        self.stdout.write('🔍 Finding Reddit bot users...')

        reddit_bots = User.objects.filter(role=UserRole.BOT, username__icontains='reddit-bot')

        total_bots = reddit_bots.count()
        self.stdout.write(f'Found {total_bots} Reddit bot user(s)')

        if total_bots == 0:
            self.stdout.write(self.style.WARNING('No Reddit bots found.'))
            return

        updated_count = 0
        for bot in reddit_bots:
            if bot.avatar_url != '/Reddit-logo.svg':
                bot.avatar_url = '/Reddit-logo.svg'
                bot.save()
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f'✅ Updated avatar for {bot.username}'))
            else:
                self.stdout.write(f'⏭️  {bot.username} already has Reddit logo')

        self.stdout.write(self.style.SUCCESS(f'\n✨ Updated {updated_count} of {total_bots} Reddit bot avatar(s)'))
