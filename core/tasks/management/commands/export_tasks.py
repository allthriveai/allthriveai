"""
Management command to export tasks and task options to YAML file.

This command exports task data from the database to core/fixtures/tasks.yaml,
allowing admin changes to be version controlled.

Usage:
    python manage.py export_tasks                  # Export all tasks and options
    python manage.py export_tasks --options-only   # Only export task options
    python manage.py export_tasks --tasks-only     # Only export tasks
    python manage.py export_tasks --dry-run        # Show what would be exported
    python manage.py export_tasks --output FILE    # Export to custom file

This is useful for:
- Version controlling task configuration (statuses, types, priorities)
- Backing up task data
- Migrating tasks between environments
"""

from pathlib import Path

import yaml
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.tasks.models import Task, TaskOption

User = get_user_model()


class LiteralStr(str):
    """String subclass for literal block style in YAML."""

    pass


def literal_str_representer(dumper, data):
    """Represent multi-line strings with literal block style."""
    if '\n' in data:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
    return dumper.represent_scalar('tag:yaml.org,2002:str', data)


# Register custom representer
yaml.add_representer(LiteralStr, literal_str_representer)


class Command(BaseCommand):
    help = 'Export tasks and task options from database to YAML file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tasks-only',
            action='store_true',
            help='Only export tasks, skip options',
        )
        parser.add_argument(
            '--options-only',
            action='store_true',
            help='Only export task options, skip tasks',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be exported without writing file',
        )
        parser.add_argument(
            '--output',
            type=str,
            default=None,
            help='Output file path (default: core/fixtures/tasks.yaml)',
        )
        parser.add_argument(
            '--include-archived',
            action='store_true',
            help='Include archived tasks (default: exclude)',
        )

    def get_output_path(self, options):
        """Get output file path."""
        if options['output']:
            return Path(options['output'])

        # Default location
        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        return base_dir / 'core' / 'fixtures' / 'tasks.yaml'

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        tasks_only = options['tasks_only']
        options_only = options['options_only']
        include_archived = options['include_archived']

        output_path = self.get_output_path(options)

        data = {}
        stats = {
            'statuses': 0,
            'types': 0,
            'priorities': 0,
            'tasks': 0,
        }

        # Export task options
        if not tasks_only:
            data['statuses'] = self.export_options('status', stats)
            data['types'] = self.export_options('type', stats)
            data['priorities'] = self.export_options('priority', stats)

        # Export tasks
        if not options_only:
            data['tasks'] = self.export_tasks(include_archived, stats)

        # Generate YAML with header
        yaml_content = self.generate_yaml(data)

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\n[DRY RUN] Would write to: {output_path}'))
            self.stdout.write('\n' + '=' * 60)
            self.stdout.write('YAML PREVIEW (first 100 lines):')
            self.stdout.write('=' * 60 + '\n')
            preview_lines = yaml_content.split('\n')[:100]
            self.stdout.write('\n'.join(preview_lines))
            if len(yaml_content.split('\n')) > 100:
                self.stdout.write('\n... (truncated)')
        else:
            # Ensure directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            # Write to file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(yaml_content)
            self.stdout.write(self.style.SUCCESS(f'\n✓ Exported to: {output_path}'))

        # Print summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('EXPORT SUMMARY'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'  Statuses: {stats["statuses"]}')
        self.stdout.write(f'  Types: {stats["types"]}')
        self.stdout.write(f'  Priorities: {stats["priorities"]}')
        self.stdout.write(f'  Tasks: {stats["tasks"]}')

    def export_options(self, option_type, stats):
        """Export task options of a specific type."""
        queryset = TaskOption.objects.filter(
            option_type=option_type,
            is_active=True,
        ).order_by('order', 'name')

        # Map option_type to stats key
        stats_key_map = {
            'status': 'statuses',
            'type': 'types',
            'priority': 'priorities',
        }
        stats_key = stats_key_map.get(option_type, f'{option_type}s')

        options = []
        for opt in queryset:
            option_data = {
                'name': opt.name,
                'slug': opt.slug,
                'color': opt.color,
                'order': opt.order,
            }

            # Only include non-default values
            if opt.icon:
                option_data['icon'] = opt.icon
            if opt.is_default:
                option_data['is_default'] = True
            if opt.is_closed_status and option_type == 'status':
                option_data['is_closed_status'] = True

            options.append(option_data)
            stats[stats_key] += 1

        return options

    def export_tasks(self, include_archived, stats):
        """Export tasks to list of dicts."""
        queryset = Task.objects.select_related('status', 'task_type', 'priority', 'assignee').order_by(
            'status__order', 'order_in_status', '-created_at'
        )

        if not include_archived:
            queryset = queryset.filter(is_archived=False)

        tasks = []
        for task in queryset:
            task_data = {
                'title': task.title,
                'status': task.status.slug,
            }

            # Description (use literal style for multiline)
            if task.description:
                task_data['description'] = LiteralStr(task.description.strip())

            # Optional references (use slugs for portability)
            if task.task_type:
                task_data['task_type'] = task.task_type.slug
            if task.priority:
                task_data['priority'] = task.priority.slug
            if task.assignee:
                task_data['assignee'] = task.assignee.email

            # Order
            if task.order_in_status:
                task_data['order_in_status'] = task.order_in_status

            # Dates
            if task.due_date:
                task_data['due_date'] = task.due_date.isoformat()
            if task.completed_at:
                task_data['completed_at'] = task.completed_at.isoformat()

            # Status
            if task.is_archived:
                task_data['is_archived'] = True

            tasks.append(task_data)
            stats['tasks'] += 1

        return tasks

    def generate_yaml(self, data):
        """Generate YAML content with header."""
        header = """# =============================================================================
# AllThrive AI Task Tracker - Tasks Configuration
# =============================================================================
# This file contains task options (statuses, types, priorities) and tasks.
#
# USAGE:
#   - Load tasks: docker compose exec web python manage.py seed_tasks
#   - Export changes: docker compose exec web python manage.py export_tasks
#
# CONVENTIONS:
#   - Options are referenced by slug (auto-generated from name if not provided)
#   - Assignees are referenced by email
#   - Dates use ISO 8601 format
#   - Multi-line descriptions use YAML literal block style (|)
# =============================================================================

"""

        # Custom YAML dump settings for cleaner output
        yaml_content = yaml.dump(
            data,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=100,
            indent=2,
        )

        return header + yaml_content
