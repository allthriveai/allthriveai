"""Data migration to create UserAvatar records from existing avatar_url fields."""

from django.db import migrations


def migrate_existing_avatars(apps, schema_editor):
    """Create UserAvatar records for users who already have avatar_url set."""
    User = apps.get_model('users', 'User')
    UserAvatar = apps.get_model('avatars', 'UserAvatar')

    # Get all users with non-empty avatar_url
    users_with_avatars = User.objects.filter(avatar_url__isnull=False).exclude(avatar_url='')

    avatars_to_create = []
    for user in users_with_avatars:
        avatars_to_create.append(
            UserAvatar(
                user=user,
                image_url=user.avatar_url,
                creation_mode='legacy',
                is_current=True,
            )
        )

    # Bulk create for efficiency
    if avatars_to_create:
        UserAvatar.objects.bulk_create(avatars_to_create)
        print(f'Created {len(avatars_to_create)} UserAvatar records from existing avatar_url fields')


def reverse_migration(apps, schema_editor):
    """Remove legacy UserAvatar records."""
    UserAvatar = apps.get_model('avatars', 'UserAvatar')
    deleted_count, _ = UserAvatar.objects.filter(creation_mode='legacy').delete()
    print(f'Deleted {deleted_count} legacy UserAvatar records')


class Migration(migrations.Migration):
    dependencies = [
        ('avatars', '0001_initial'),
        ('users', '0026_add_avatar_fields'),
    ]

    operations = [
        migrations.RunPython(migrate_existing_avatars, reverse_migration),
    ]
