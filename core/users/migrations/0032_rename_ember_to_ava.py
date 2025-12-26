# Generated migration to rename Ember user to Ava

from django.db import migrations


def rename_ember_to_ava(apps, schema_editor):
    """Rename the Ember user to Ava."""
    User = apps.get_model('users', 'User')

    try:
        ember_user = User.objects.get(username='ember')
        ember_user.username = 'ava'
        ember_user.email = 'ava@allthrive.ai'
        ember_user.first_name = 'Ava'
        ember_user.save(update_fields=['username', 'email', 'first_name'])
    except User.DoesNotExist:
        # Ember user doesn't exist yet (fresh database)
        pass


def rename_ava_to_ember(apps, schema_editor):
    """Reverse: Rename Ava back to Ember."""
    User = apps.get_model('users', 'User')

    try:
        ava_user = User.objects.get(username='ava')
        ava_user.username = 'ember'
        ava_user.email = 'ember@allthrive.ai'
        ava_user.first_name = 'Ember'
        ava_user.save(update_fields=['username', 'email', 'first_name'])
    except User.DoesNotExist:
        pass


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0031_invitationrequest_skill_level'),
    ]

    operations = [
        migrations.RunPython(rename_ember_to_ava, rename_ava_to_ember),
    ]
