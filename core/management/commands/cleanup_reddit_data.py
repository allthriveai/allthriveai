"""
Management command to clean up orphaned Reddit data from the database.

This removes:
1. Reddit agent user accounts (username pattern *-reddit-agent with tier='curation')
2. All projects created by those agents

The User model has on_delete=CASCADE for projects, so deleting the user
will automatically delete their projects and all related data (likes,
comments, views, etc.).

Run with dry-run first to see what would be deleted:
    python manage.py cleanup_reddit_data --dry-run

Then run for real:
    python manage.py cleanup_reddit_data

On production via ECS:
    make aws-run-command CMD="cleanup_reddit_data --dry-run"
    make aws-run-command CMD="cleanup_reddit_data"
"""

from django.core.management.base import BaseCommand
from django.db.models import Q

from core.projects.models import Project
from core.users.models import User


class Command(BaseCommand):
    help = 'Clean up orphaned Reddit agent users and their projects'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  Reddit Data Cleanup'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        if dry_run:
            self.stdout.write(self.style.WARNING('\n  DRY RUN MODE - No changes will be made\n'))

        # Find Reddit agent users
        # Note: Project.user field (not creator) links to User
        reddit_agents = User.objects.filter(
            Q(username__endswith='-reddit-agent') | Q(username__endswith='-reddit-bot'),
            tier='curation',
        )

        agent_count = reddit_agents.count()
        self.stdout.write(f'\n  Found {agent_count} Reddit agent user(s):')

        if agent_count == 0:
            self.stdout.write(self.style.SUCCESS('\n  No Reddit agents found. Database is clean!\n'))
            return

        # List the agents and their projects
        total_projects = 0
        agent_ids = []

        for agent in reddit_agents:
            # Project.user is the FK field, not creator
            project_count = Project.objects.filter(user=agent).count()
            total_projects += project_count
            agent_ids.append(agent.id)
            self.stdout.write(f'    - {agent.username} (ID: {agent.id}) - {project_count} projects')

        self.stdout.write(f'\n  Total projects that will be cascade-deleted: {total_projects}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n  Dry run complete. Run without --dry-run to delete.\n'))
            return

        # Perform deletion
        # Deleting the User will cascade delete their projects and all related data
        self.stdout.write('\n  Deleting users (projects cascade automatically)...')

        deleted_count, deleted_details = User.objects.filter(id__in=agent_ids).delete()

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  Cleanup Complete'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'\n  Total objects deleted: {deleted_count}')
        self.stdout.write('  Breakdown:')
        for model, count in deleted_details.items():
            self.stdout.write(f'    - {model}: {count}')
        self.stdout.write('')
