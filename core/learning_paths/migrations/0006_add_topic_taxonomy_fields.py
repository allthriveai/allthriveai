"""
Add topic_taxonomy FK fields to learning paths models.

This adds proper ForeignKey relationships to Taxonomy for topics,
replacing the CharField with hardcoded TOPIC_CHOICES.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0052_add_topics_taxonomy_to_project'),
        ('learning_paths', '0005_learningoutcome_userskillproficiency_contentgap_and_more'),
    ]

    operations = [
        # UserLearningPath: topic CharField -> topic_taxonomy FK
        migrations.AddField(
            model_name='userlearningpath',
            name='topic_taxonomy',
            field=models.ForeignKey(
                blank=True,
                null=True,
                help_text='Topic taxonomy for this learning path',
                limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
                on_delete=django.db.models.deletion.PROTECT,
                related_name='learning_paths',
                to='core.taxonomy',
            ),
        ),
        # Concept: topic CharField -> topic_taxonomy FK
        migrations.AddField(
            model_name='concept',
            name='topic_taxonomy',
            field=models.ForeignKey(
                blank=True,
                null=True,
                help_text='Topic taxonomy this concept belongs to',
                limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
                on_delete=django.db.models.deletion.PROTECT,
                related_name='concepts',
                to='core.taxonomy',
            ),
        ),
        # ContentGap: topic CharField -> topic_taxonomy FK
        migrations.AddField(
            model_name='contentgap',
            name='topic_taxonomy',
            field=models.ForeignKey(
                blank=True,
                null=True,
                help_text='Topic taxonomy for this content gap',
                limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='content_gaps',
                to='core.taxonomy',
            ),
        ),
    ]
