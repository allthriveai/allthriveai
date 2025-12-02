# Generated manually to update quest titles

from django.db import migrations


def update_quest_titles(apps, schema_editor):
    """Update quest titles to remove 'first' wording."""
    SideQuest = apps.get_model('thrive_circle', 'SideQuest')

    # Update quest titles and descriptions
    updates = [
        {
            'old_title': 'First Comment',
            'new_title': 'Spread Encouragement',
            'new_description': "Leave a comment on someone else's project. Your feedback makes a difference!",
        },
        {
            'old_title': 'First Quiz',
            'new_title': 'Quiz Starter',
            'new_description': 'Complete a quiz to test your AI knowledge!',
        },
        {
            'old_title': 'First Project',
            'new_title': 'Portfolio Builder',
            'new_description': 'Create a project to start building your portfolio!',
        },
    ]

    for update in updates:
        SideQuest.objects.filter(title=update['old_title']).update(
            title=update['new_title'],
            description=update['new_description'],
        )

    # Update Banana Time description only
    SideQuest.objects.filter(title='Banana Time').update(
        description='Generate an image with Nano Banana!',
    )


def reverse_quest_titles(apps, schema_editor):
    """Reverse the quest title updates."""
    SideQuest = apps.get_model('thrive_circle', 'SideQuest')

    # Reverse updates
    updates = [
        {
            'new_title': 'First Comment',
            'old_title': 'Spread Encouragement',
            'new_description': "Leave your first comment on someone else's project. Spread some encouragement!",
        },
        {
            'new_title': 'First Quiz',
            'old_title': 'Quiz Starter',
            'new_description': 'Complete your first quiz to test your AI knowledge!',
        },
        {
            'new_title': 'First Project',
            'old_title': 'Portfolio Builder',
            'new_description': 'Create your first project to start building your portfolio!',
        },
    ]

    for update in updates:
        SideQuest.objects.filter(title=update['old_title']).update(
            title=update['new_title'],
            description=update['new_description'],
        )

    # Reverse Banana Time description
    SideQuest.objects.filter(title='Banana Time').update(
        description='Generate your first image with Nano Banana!',
    )


class Migration(migrations.Migration):
    dependencies = [
        ('thrive_circle', '0006_add_scalability_indexes'),
    ]

    operations = [
        migrations.RunPython(update_quest_titles, reverse_quest_titles),
    ]
