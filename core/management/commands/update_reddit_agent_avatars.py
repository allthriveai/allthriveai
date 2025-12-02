"""
Management command to update existing Reddit agent users with Reddit logo avatars.
Run with: python manage.py update_reddit_agent_avatars
"""

from django.core.management.base import BaseCommand

from core.users.models import User, UserRole


class Command(BaseCommand):
    help = 'Update existing Reddit agent users to use the Reddit logo as their avatar'

    def handle(self, *args, **options):
        self.stdout.write('Finding Reddit agent users...')

        reddit_agents = User.objects.filter(role=UserRole.AGENT, username__icontains='reddit-agent')

        total_agents = reddit_agents.count()
        self.stdout.write(f'Found {total_agents} Reddit agent user(s)')

        if total_agents == 0:
            self.stdout.write(self.style.WARNING('No Reddit agents found.'))
            return

        updated_count = 0
        for agent in reddit_agents:
            if agent.avatar_url != '/Reddit-logo.svg':
                agent.avatar_url = '/Reddit-logo.svg'
                agent.save()
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f'Updated avatar for {agent.username}'))
            else:
                self.stdout.write(f'{agent.username} already has Reddit logo')

        self.stdout.write(self.style.SUCCESS(f'\nUpdated {updated_count} of {total_agents} Reddit agent avatar(s)'))
