# Generated migration for ProjectLike model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0027_project_external_url'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectLike',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'project',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name='likes', to='core.project'
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='project_likes',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='projectlike',
            constraint=models.UniqueConstraint(fields=('user', 'project'), name='unique_project_like_per_user'),
        ),
        migrations.AddIndex(
            model_name='projectlike',
            index=models.Index(fields=['project', '-created_at'], name='core_projec_project_idx'),
        ),
        migrations.AddIndex(
            model_name='projectlike',
            index=models.Index(fields=['user', '-created_at'], name='core_projec_user_id_idx'),
        ),
    ]
