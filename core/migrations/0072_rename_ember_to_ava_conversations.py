# Generated migration to rename Ember conversation types to Ava

from django.db import migrations, models


def update_conversation_types(apps, schema_editor):
    """Update conversation types and IDs from ember to ava."""
    Conversation = apps.get_model('core', 'Conversation')

    # Update conversation_type values
    type_mapping = {
        'ember_chat': 'ava_chat',
        'ember_learn': 'ava_learn',
        'ember_explore': 'ava_explore',
    }
    for old_type, new_type in type_mapping.items():
        Conversation.objects.filter(conversation_type=old_type).update(conversation_type=new_type)

    # Update conversation_id patterns (ember-* -> ava-*)
    for conversation in Conversation.objects.filter(conversation_id__startswith='ember-'):
        conversation.conversation_id = 'ava-' + conversation.conversation_id[6:]
        conversation.save(update_fields=['conversation_id'])


def reverse_conversation_types(apps, schema_editor):
    """Reverse: Update conversation types and IDs from ava back to ember."""
    Conversation = apps.get_model('core', 'Conversation')

    # Reverse conversation_type values
    type_mapping = {
        'ava_chat': 'ember_chat',
        'ava_learn': 'ember_learn',
        'ava_explore': 'ember_explore',
    }
    for old_type, new_type in type_mapping.items():
        Conversation.objects.filter(conversation_type=old_type).update(conversation_type=new_type)

    # Reverse conversation_id patterns (ava-* -> ember-*)
    for conversation in Conversation.objects.filter(conversation_id__startswith='ava-'):
        conversation.conversation_id = 'ember-' + conversation.conversation_id[4:]
        conversation.save(update_fields=['conversation_id'])


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0071_conversation_conversation_id_and_more'),
    ]

    operations = [
        # First, run the data migration
        migrations.RunPython(update_conversation_types, reverse_conversation_types),
        # Then, update the field choices
        migrations.AlterField(
            model_name='conversation',
            name='conversation_type',
            field=models.CharField(
                choices=[
                    ('ava_chat', 'Ava Sidebar Chat'),
                    ('ava_learn', 'Ava Learn Chat'),
                    ('ava_explore', 'Ava Explore Chat'),
                    ('learning_path', 'Learning Path Chat'),
                    ('avatar', 'Avatar Generation'),
                    ('image', 'Image Generation'),
                ],
                db_index=True,
                default='ava_chat',
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='conversation',
            name='conversation_id',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='WebSocket conversation ID (e.g., ava-chat-123, ava-learn-456)',
                max_length=255,
            ),
        ),
    ]
