"""
Data migration to seed default TaskOption values.
"""

from django.db import migrations


def seed_default_options(apps, schema_editor):
    """Create default status, type, and priority options."""
    TaskOption = apps.get_model('tasks', 'TaskOption')

    # Default statuses for Kanban columns
    statuses = [
        {
            'name': 'Backlog',
            'slug': 'backlog',
            'color': 'slate',
            'order': 0,
            'is_default': True,
            'is_closed_status': False,
        },
        {'name': 'To Do', 'slug': 'todo', 'color': 'blue', 'order': 1, 'is_default': False, 'is_closed_status': False},
        {
            'name': 'In Progress',
            'slug': 'in-progress',
            'color': 'yellow',
            'order': 2,
            'is_default': False,
            'is_closed_status': False,
        },
        {
            'name': 'Review',
            'slug': 'review',
            'color': 'purple',
            'order': 3,
            'is_default': False,
            'is_closed_status': False,
        },
        {'name': 'Done', 'slug': 'done', 'color': 'green', 'order': 4, 'is_default': False, 'is_closed_status': True},
    ]

    for status_data in statuses:
        TaskOption.objects.create(option_type='status', **status_data)

    # Default priorities
    priorities = [
        {'name': 'Low', 'slug': 'low', 'color': 'slate', 'order': 0, 'is_default': False},
        {'name': 'Medium', 'slug': 'medium', 'color': 'yellow', 'order': 1, 'is_default': True},
        {'name': 'High', 'slug': 'high', 'color': 'orange', 'order': 2, 'is_default': False},
        {'name': 'Critical', 'slug': 'critical', 'color': 'red', 'order': 3, 'is_default': False},
    ]

    for priority_data in priorities:
        TaskOption.objects.create(option_type='priority', **priority_data)

    # Default task types
    types = [
        {'name': 'Task', 'slug': 'task', 'icon': 'check-circle', 'color': 'slate', 'order': 0, 'is_default': True},
        {'name': 'Bug', 'slug': 'bug', 'icon': 'bug-ant', 'color': 'red', 'order': 1, 'is_default': False},
        {'name': 'Feature', 'slug': 'feature', 'icon': 'sparkles', 'color': 'purple', 'order': 2, 'is_default': False},
        {
            'name': 'Improvement',
            'slug': 'improvement',
            'icon': 'arrow-trending-up',
            'color': 'blue',
            'order': 3,
            'is_default': False,
        },
    ]

    for type_data in types:
        TaskOption.objects.create(option_type='type', **type_data)


def reverse_seed(apps, schema_editor):
    """Remove seeded data."""
    TaskOption = apps.get_model('tasks', 'TaskOption')
    TaskOption.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('tasks', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_default_options, reverse_seed),
    ]
