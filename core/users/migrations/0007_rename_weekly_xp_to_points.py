from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0006_user_achievement_categories_earned_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='user',
            old_name='weekly_xp_gained',
            new_name='weekly_points_gained',
        ),
    ]
