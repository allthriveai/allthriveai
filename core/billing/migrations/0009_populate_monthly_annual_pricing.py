# Data migration to populate monthly and annual pricing from quarterly prices

from decimal import Decimal

from django.db import migrations


def populate_pricing(apps, schema_editor):
    """
    Populate monthly and annual pricing based on standard conversion.
    Assuming quarterly was the middle ground, we'll set:
    - Monthly = Quarterly / 2.5 (slight premium for monthly)
    - Annual = Quarterly * 4 * 0.83 (17% discount for annual)
    """
    SubscriptionTier = apps.get_model('billing', 'SubscriptionTier')

    # Standard pricing (you can adjust these)
    pricing_map = {
        'free': {
            'monthly': Decimal('0.00'),
            'annual': Decimal('0.00'),
        },
        'community_pro': {
            'monthly': Decimal('15.00'),
            'annual': Decimal('150.00'),  # $12.50/mo when paid annually
        },
        'pro_learn': {
            'monthly': Decimal('30.00'),
            'annual': Decimal('300.00'),  # $25/mo when paid annually
        },
        'creator_mentor': {
            'monthly': Decimal('60.00'),
            'annual': Decimal('600.00'),  # $50/mo when paid annually
        },
    }

    for tier in SubscriptionTier.objects.all():
        if tier.tier_type in pricing_map:
            tier.price_monthly = pricing_map[tier.tier_type]['monthly']
            tier.price_annual = pricing_map[tier.tier_type]['annual']
            tier.save()


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0008_add_monthly_annual_pricing'),
    ]

    operations = [
        migrations.RunPython(populate_pricing, reverse_code=migrations.RunPython.noop),
    ]
