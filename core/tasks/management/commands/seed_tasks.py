"""
Management command to seed tasks and task options from YAML file.

This command loads task data from core/fixtures/tasks.yaml,
which serves as the source of truth for task configuration.

Usage:
    python manage.py seed_tasks                    # Seed all options and tasks
    python manage.py seed_tasks --options-only     # Only seed task options
    python manage.py seed_tasks --tasks-only       # Only seed tasks
    python manage.py seed_tasks --dry-run          # Show what would be done

The command will:
- Create/update task options (statuses, types, priorities)
- Create/update tasks, matching by title
- Look up assignees by email
- Look up options by slug
"""

from datetime import datetime
from pathlib import Path

import yaml
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.tasks.models import Task, TaskOption

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed tasks and task options from YAML file (source of truth)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tasks-only',
            action='store_true',
            help='Only seed tasks, skip options',
        )
        parser.add_argument(
            '--options-only',
            action='store_true',
            help='Only seed task options, skip tasks',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--file',
            type=str,
            default=None,
            help='Path to YAML file (default: core/fixtures/tasks.yaml)',
        )

    def get_yaml_path(self, options):
        """Get path to YAML file."""
        if options['file']:
            return Path(options['file'])

        # Default location
        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        return base_dir / 'core' / 'fixtures' / 'tasks.yaml'

    def load_yaml(self, yaml_path):
        """Load and parse YAML file."""
        if not yaml_path.exists():
            raise FileNotFoundError(f'YAML file not found: {yaml_path}')

        with open(yaml_path, encoding='utf-8') as f:
            return yaml.safe_load(f)

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        tasks_only = options['tasks_only']
        options_only = options['options_only']

        yaml_path = self.get_yaml_path(options)
        self.stdout.write(f'Loading from: {yaml_path}')

        try:
            data = self.load_yaml(yaml_path)
        except FileNotFoundError as e:
            self.stdout.write(self.style.ERROR(str(e)))
            return
        except yaml.YAMLError as e:
            self.stdout.write(self.style.ERROR(f'YAML parse error: {e}'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No changes will be made\n'))

        stats = {
            'statuses_created': 0,
            'statuses_updated': 0,
            'types_created': 0,
            'types_updated': 0,
            'priorities_created': 0,
            'priorities_updated': 0,
            'tasks_created': 0,
            'tasks_updated': 0,
        }

        try:
            with transaction.atomic():
                # Seed options first (tasks reference them)
                if not tasks_only:
                    self.seed_options('status', data.get('statuses', []), stats, dry_run)
                    self.seed_options('type', data.get('types', []), stats, dry_run)
                    self.seed_options('priority', data.get('priorities', []), stats, dry_run)

                # Seed tasks
                if not options_only:
                    self.seed_tasks(data.get('tasks', []), stats, dry_run)

                if dry_run:
                    # Rollback in dry run mode
                    raise DryRunException()

        except DryRunException:
            pass  # Expected for dry run

        # Print summary
        self.print_summary(stats, dry_run)

    def seed_options(self, option_type, options_data, stats, dry_run):
        """Seed task options from YAML data."""
        type_label = option_type.title() + ('es' if option_type == 'status' else 's')
        # Handle irregular plurals for stats keys
        if option_type == 'status':
            stats_key = 'statuses'
        elif option_type == 'priority':
            stats_key = 'priorities'
        else:
            stats_key = f'{option_type}s'

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO(f'SEEDING {type_label.upper()}'))
        self.stdout.write('=' * 60)

        for opt_data in options_data:
            name = opt_data.get('name')
            if not name:
                self.stdout.write(self.style.WARNING(f'  Skipping {option_type} without name'))
                continue

            slug = opt_data.get('slug', '')

            defaults = {
                'name': name,
                'color': opt_data.get('color', 'slate'),
                'icon': opt_data.get('icon', ''),
                'order': opt_data.get('order', 0),
                'is_active': True,
                'is_default': opt_data.get('is_default', False),
                'is_closed_status': opt_data.get('is_closed_status', False),
            }

            # Look up by slug first, then by name
            option = None
            if slug:
                option = TaskOption.objects.filter(option_type=option_type, slug=slug).first()
            if not option:
                option = TaskOption.objects.filter(option_type=option_type, name__iexact=name).first()

            if option:
                # Update existing
                for field, value in defaults.items():
                    setattr(option, field, value)
                option.save()
                stats[f'{stats_key}_updated'] += 1
                self.stdout.write(self.style.WARNING(f'  ~ Updated: {name}'))
            else:
                # Create new
                option = TaskOption.objects.create(
                    option_type=option_type,
                    slug=slug,
                    **defaults,
                )
                stats[f'{stats_key}_created'] += 1
                self.stdout.write(self.style.SUCCESS(f'  + Created: {name}'))

    def seed_tasks(self, tasks_data, stats, dry_run):
        """Seed tasks from YAML data."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SEEDING TASKS'))
        self.stdout.write('=' * 60)

        # Cache lookups
        status_cache = {opt.slug: opt for opt in TaskOption.objects.filter(option_type='status')}
        type_cache = {opt.slug: opt for opt in TaskOption.objects.filter(option_type='type')}
        priority_cache = {opt.slug: opt for opt in TaskOption.objects.filter(option_type='priority')}
        user_cache = {user.email: user for user in User.objects.filter(is_staff=True)}

        # Get default status
        default_status = TaskOption.objects.filter(option_type='status', is_default=True).first()
        if not default_status:
            default_status = TaskOption.objects.filter(option_type='status').first()

        if not default_status:
            self.stdout.write(self.style.ERROR('  No status options found! Create statuses first.'))
            return

        for task_data in tasks_data:
            title = task_data.get('title')
            if not title:
                self.stdout.write(self.style.WARNING('  Skipping task without title'))
                continue

            # Look up references
            status_slug = task_data.get('status', '')
            status = status_cache.get(status_slug, default_status)

            task_type = None
            type_slug = task_data.get('task_type', '')
            if type_slug:
                task_type = type_cache.get(type_slug)
                if not task_type:
                    self.stdout.write(self.style.NOTICE(f'  ! Type not found for "{title}": {type_slug}'))

            priority = None
            priority_slug = task_data.get('priority', '')
            if priority_slug:
                priority = priority_cache.get(priority_slug)
                if not priority:
                    self.stdout.write(self.style.NOTICE(f'  ! Priority not found for "{title}": {priority_slug}'))

            assignee = None
            assignee_email = task_data.get('assignee', '')
            if assignee_email:
                assignee = user_cache.get(assignee_email)
                if not assignee:
                    self.stdout.write(self.style.NOTICE(f'  ! Assignee not found for "{title}": {assignee_email}'))

            # Parse dates
            due_date = None
            if task_data.get('due_date'):
                try:
                    due_date = datetime.fromisoformat(task_data['due_date'].replace('Z', '+00:00'))
                    if timezone.is_naive(due_date):
                        due_date = timezone.make_aware(due_date)
                except (ValueError, AttributeError):
                    self.stdout.write(self.style.NOTICE(f'  ! Invalid due_date for "{title}"'))

            completed_at = None
            if task_data.get('completed_at'):
                try:
                    completed_at = datetime.fromisoformat(task_data['completed_at'].replace('Z', '+00:00'))
                    if timezone.is_naive(completed_at):
                        completed_at = timezone.make_aware(completed_at)
                except (ValueError, AttributeError):
                    self.stdout.write(self.style.NOTICE(f'  ! Invalid completed_at for "{title}"'))

            defaults = {
                'description': task_data.get('description', ''),
                'status': status,
                'task_type': task_type,
                'priority': priority,
                'assignee': assignee,
                'order_in_status': task_data.get('order_in_status', 0),
                'due_date': due_date,
                'completed_at': completed_at,
                'is_archived': task_data.get('is_archived', False),
            }

            # Try to find existing task by title
            task = Task.objects.filter(title__iexact=title).first()

            if task:
                # Update existing
                for field, value in defaults.items():
                    setattr(task, field, value)
                task.save()
                stats['tasks_updated'] += 1
                self.stdout.write(self.style.WARNING(f'  ~ Updated: {title[:50]}...'))
            else:
                # Create new
                task = Task.objects.create(title=title, **defaults)
                stats['tasks_created'] += 1
                self.stdout.write(self.style.SUCCESS(f'  + Created: {title[:50]}...'))

    def print_summary(self, stats, dry_run):
        """Print summary of operations."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SUMMARY'))
        self.stdout.write('=' * 60)

        prefix = '[DRY RUN] Would have ' if dry_run else ''

        self.stdout.write(f'\n{prefix}Statuses:')
        self.stdout.write(f'  Created: {stats["statuses_created"]}')
        self.stdout.write(f'  Updated: {stats["statuses_updated"]}')

        self.stdout.write(f'\n{prefix}Types:')
        self.stdout.write(f'  Created: {stats["types_created"]}')
        self.stdout.write(f'  Updated: {stats["types_updated"]}')

        self.stdout.write(f'\n{prefix}Priorities:')
        self.stdout.write(f'  Created: {stats["priorities_created"]}')
        self.stdout.write(f'  Updated: {stats["priorities_updated"]}')

        self.stdout.write(f'\n{prefix}Tasks:')
        self.stdout.write(f'  Created: {stats["tasks_created"]}')
        self.stdout.write(f'  Updated: {stats["tasks_updated"]}')

        total = sum(stats.values())

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\n[DRY RUN] {total} total operations would be performed'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n✓ {total} total operations completed'))


class DryRunException(Exception):
    """Exception to trigger rollback in dry run mode."""

    pass
