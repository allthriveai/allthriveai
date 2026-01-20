# Generated manually on 2026-01-20 - Remove ContentGoal model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content_engine', '0004_add_strategy'),
    ]

    operations = [
        migrations.DeleteModel(
            name='ContentGoal',
        ),
    ]
