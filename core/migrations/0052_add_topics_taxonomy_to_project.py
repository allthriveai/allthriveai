"""
Add topics_taxonomy M2M field to Project and Quiz models.

This adds proper ManyToMany relationships to Taxonomy for topics,
replacing the ArrayField of text strings.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0051_seed_topic_choices_taxonomy'),
    ]

    operations = [
        # Project: topics ArrayField -> topics_taxonomy M2M
        migrations.AddField(
            model_name='project',
            name='topics_taxonomy',
            field=models.ManyToManyField(
                blank=True,
                help_text='Topic taxonomies for this project',
                limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
                related_name='topic_projects',
                to='core.taxonomy',
            ),
        ),
        # Quiz: topics ArrayField -> topics_taxonomy M2M
        # Also replacing the legacy topic CharField
        migrations.AddField(
            model_name='quiz',
            name='topics_taxonomy',
            field=models.ManyToManyField(
                blank=True,
                help_text='Topic taxonomies for this quiz',
                limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
                related_name='topic_quizzes',
                to='core.taxonomy',
            ),
        ),
    ]
