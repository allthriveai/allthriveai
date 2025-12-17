"""
Seed Credit Packs for billing.

Creates the 4 credit pack tiers:
- 625 credits for $20/month
- 1,250 credits for $40/month
- 2,500 credits for $80/month
- 5,000 credits for $160/month

Usage:
    python manage.py seed_credit_packs
    python manage.py seed_credit_packs --with-stripe  # Also create Stripe products/prices
    python manage.py seed_credit_packs --force        # Delete existing and recreate
"""

from django.core.management.base import BaseCommand

from core.billing.models import CreditPack


class Command(BaseCommand):
    help = 'Seed credit pack data for billing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--with-stripe',
            action='store_true',
            help='Also create Stripe products and prices',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Delete existing credit packs and recreate',
        )

    def handle(self, *args, **options):
        with_stripe = options['with_stripe']
        force = options['force']

        if force:
            self.stdout.write(self.style.WARNING('Deleting existing credit packs...'))
            CreditPack.objects.all().delete()

        # Credit pack definitions
        credit_packs = [
            {
                'name': '625 credits',
                'credits_per_month': 625,
                'price_cents': 2000,  # $20
                'sort_order': 1,
            },
            {
                'name': '1,250 credits',
                'credits_per_month': 1250,
                'price_cents': 4000,  # $40
                'sort_order': 2,
            },
            {
                'name': '2,500 credits',
                'credits_per_month': 2500,
                'price_cents': 8000,  # $80
                'sort_order': 3,
            },
            {
                'name': '5,000 credits',
                'credits_per_month': 5000,
                'price_cents': 16000,  # $160
                'sort_order': 4,
            },
        ]

        created_count = 0
        updated_count = 0

        for pack_data in credit_packs:
            pack, created = CreditPack.objects.update_or_create(
                credits_per_month=pack_data['credits_per_month'],
                defaults={
                    'name': pack_data['name'],
                    'price_cents': pack_data['price_cents'],
                    'sort_order': pack_data['sort_order'],
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created: {pack.name} - ${pack.price_cents / 100}/mo'))
            else:
                updated_count += 1
                self.stdout.write(f'Updated: {pack.name} - ${pack.price_cents / 100}/mo')

            # Sync to Stripe if requested
            if with_stripe:
                self._sync_to_stripe(pack)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Credit packs seeded: {created_count} created, {updated_count} updated'))

        if with_stripe:
            self.stdout.write(self.style.SUCCESS('Stripe products and prices created/updated'))

    def _sync_to_stripe(self, pack):
        """Sync a credit pack to Stripe."""
        try:
            from core.billing.services import StripeService

            StripeService.sync_credit_pack_to_stripe(pack)
            self.stdout.write(f'  -> Synced to Stripe: {pack.stripe_price_id}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  -> Failed to sync to Stripe: {e}'))
