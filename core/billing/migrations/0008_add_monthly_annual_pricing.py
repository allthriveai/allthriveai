# Migration for switching to monthly and annual pricing

from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        # Remove old quarterly pricing fields
        migrations.RemoveField(
            model_name='subscriptiontier',
            name='price_quarterly',
        ),
        migrations.RemoveField(
            model_name='subscriptiontier',
            name='stripe_price_id_quarterly',
        ),
        # Add new monthly and annual pricing fields
        migrations.AddField(
            model_name='subscriptiontier',
            name='price_monthly',
            field=models.DecimalField(
                decimal_places=2,
                help_text='Price in USD per month',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
                default=Decimal('0.00'),
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='subscriptiontier',
            name='price_annual',
            field=models.DecimalField(
                decimal_places=2,
                help_text='Price in USD per year',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
                default=Decimal('0.00'),
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='subscriptiontier',
            name='stripe_price_id_monthly',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='subscriptiontier',
            name='stripe_price_id_annual',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        # Update model ordering
        migrations.AlterModelOptions(
            name='subscriptiontier',
            options={
                'ordering': ['display_order', 'price_monthly'],
                'verbose_name': 'Subscription Tier',
                'verbose_name_plural': 'Subscription Tiers',
            },
        ),
    ]
