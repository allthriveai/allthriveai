"""
Add topic_taxonomy FK field to SideQuest model.

This adds a proper ForeignKey relationship to Taxonomy for topics,
replacing the CharField with hardcoded TOPIC_CHOICES.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0052_add_topics_taxonomy_to_project'),
        ('thrive_circle', '0009_alter_pointactivity_activity_type'),
    ]

    operations = [
        # SideQuest: topic CharField -> topic_taxonomy FK
        migrations.AddField(
            model_name='sidequest',
            name='topic_taxonomy',
            field=models.ForeignKey(
                blank=True,
                null=True,
                help_text='Topic taxonomy this quest belongs to (null = universal quest)',
                limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='side_quests',
                to='core.taxonomy',
            ),
        ),
    ]
