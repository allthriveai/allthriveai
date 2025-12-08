"""
Management command to seed subscription tiers and token packages.

This command creates or updates:
- 4 Subscription Tiers (Free, Community Pro, Pro Learn, Creator/Mentor)
- 3 Token Packages (Starter, Booster, Power)

Run with: python manage.py seed_billing
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from core.billing.models import SubscriptionTier, TokenPackage


class Command(BaseCommand):
    help = 'Seed subscription tiers and token packages from Feature Matrix'

    def add_arguments(self, parser):
        parser.add_argument(
            '--with-stripe',
            action='store_true',
            help='Also create Stripe products and prices (requires STRIPE_SECRET_KEY)',
        )

    def handle(self, *args, **options):
        with_stripe = options.get('with_stripe', False)

        self.stdout.write(self.style.SUCCESS('🌱 Seeding billing data...'))
        self.stdout.write('')

        with transaction.atomic():
            # Seed subscription tiers
            self.seed_subscription_tiers(with_stripe)
            self.stdout.write('')

            # Seed token packages
            self.seed_token_packages(with_stripe)
            self.stdout.write('')

        self.stdout.write(self.style.SUCCESS('✅ Billing data seeded successfully!'))

        if not with_stripe:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('ℹ️  Run with --with-stripe to create Stripe products'))
            self.stdout.write(self.style.WARNING('   (Requires STRIPE_SECRET_KEY in .env)'))

    def seed_subscription_tiers(self, with_stripe=False):
        """Seed subscription tiers based on Feature Matrix."""
        self.stdout.write(self.style.MIGRATE_HEADING('📋 Seeding Subscription Tiers'))

        tiers_data = [
            {
                'tier_type': 'free',
                'slug': 'free-explorer',
                'name': 'Free / Explorer',
                'description': 'Perfect for exploring All Thrive and trying out basic features',
                'price_monthly': Decimal('0.00'),
                'price_annual': Decimal('0.00'),
                'trial_period_days': 0,
                'monthly_ai_requests': 20,  # Very limited - just enough to try it out
                'has_marketplace_access': True,  # Free to browse/engage, no cost to us
                'has_go1_courses': False,  # Costs us money
                'has_ai_mentor': True,  # Basic access (limited by AI quota)
                'has_quests': True,  # Community engagement, no cost
                'has_circles': True,  # Community engagement, no cost
                'has_projects': True,  # Portfolio building, no cost
                'has_creator_tools': False,  # Premium feature
                'has_analytics': False,  # Premium feature
                'display_order': 0,
            },
            {
                'tier_type': 'community_pro',
                'slug': 'community-pro',
                'name': 'Community Pro',
                'description': 'Full community access with insights and higher AI quota',
                'price_monthly': Decimal('15.00'),  # $15/month
                'price_annual': Decimal('153.00'),  # $153/year (15% discount - save $27/year)
                'trial_period_days': 7,
                'monthly_ai_requests': 500,  # Good for active community members
                'has_marketplace_access': True,
                'has_go1_courses': False,  # Costs us money - only for Pro Learn
                'has_ai_mentor': True,
                'has_quests': True,
                'has_circles': True,
                'has_projects': True,
                'has_creator_tools': False,
                'has_analytics': True,  # Community Pro gets analytics
                'display_order': 1,
            },
            {
                'tier_type': 'pro_learn',
                'slug': 'pro-learn',
                'name': 'Pro Learn',
                'description': 'Everything in Community Pro plus Go1 course library and higher AI quota',
                'price_monthly': Decimal('40.00'),  # $40/month
                'price_annual': Decimal('408.00'),  # $408/year (15% discount - save $72/year)
                'trial_period_days': 0,
                'monthly_ai_requests': 2000,  # High limit for serious learners
                'has_marketplace_access': True,
                'has_go1_courses': True,  # ONLY Pro Learn has Go1 courses (costs us money)
                'has_ai_mentor': True,
                'has_quests': True,
                'has_circles': True,
                'has_projects': True,
                'has_creator_tools': False,
                'has_analytics': True,
                'display_order': 2,
            },
            {
                'tier_type': 'creator_mentor',
                'slug': 'creator-mentor',
                'name': 'Creator',
                'description': 'Sell prompts, templates & courses. Free to join, 8% fee on sales.',
                'price_monthly': Decimal('0.00'),  # Free - revenue from 8% marketplace fee
                'price_annual': Decimal('0.00'),  # Free
                'trial_period_days': 0,
                'monthly_ai_requests': 500,  # Reasonable limit for creators
                'has_marketplace_access': True,
                'has_go1_courses': False,  # Creators don't need courses - they CREATE content
                'has_ai_mentor': True,
                'has_quests': True,
                'has_circles': True,
                'has_projects': True,
                'has_creator_tools': True,  # ONLY creators get creator tools
                'has_analytics': True,
                'display_order': 3,
            },
        ]

        created_count = 0
        updated_count = 0

        for tier_data in tiers_data:
            tier_type = tier_data['tier_type']
            tier, created = SubscriptionTier.objects.update_or_create(tier_type=tier_type, defaults=tier_data)

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✅ Created: {tier.name} (${tier.price_monthly}/mo)'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'  ♻️  Updated: {tier.name} (${tier.price_monthly}/mo)'))

            # Create Stripe products if requested
            if with_stripe and tier.price_monthly > 0:
                self._create_stripe_product(tier)

        self.stdout.write(self.style.SUCCESS(f'  📊 Created: {created_count} | Updated: {updated_count}'))

    def seed_token_packages(self, with_stripe=False):
        """Seed token packages based on Feature Matrix."""
        self.stdout.write(self.style.MIGRATE_HEADING('🪙  Seeding Token Packages'))

        packages_data = [
            {
                'package_type': 'starter',
                'slug': 'starter-100k',
                'name': 'Starter',
                'description': '100,000 AI tokens - perfect for occasional extra requests',
                'token_amount': 100000,
                'price': Decimal('5.00'),
                'display_order': 0,
            },
            {
                'package_type': 'booster',
                'slug': 'booster-500k',
                'name': 'Booster',
                'description': '500,000 AI tokens - great for power users',
                'token_amount': 500000,
                'price': Decimal('20.00'),
                'display_order': 1,
            },
            {
                'package_type': 'power',
                'slug': 'power-1m',
                'name': 'Power',
                'description': '1,000,000 AI tokens - maximum value for heavy usage',
                'token_amount': 1000000,
                'price': Decimal('35.00'),
                'display_order': 2,
            },
        ]

        created_count = 0
        updated_count = 0

        for package_data in packages_data:
            package_type = package_data['package_type']
            package, created = TokenPackage.objects.update_or_create(package_type=package_type, defaults=package_data)

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✅ Created: {package.name} - {package.token_amount:,} tokens for ${package.price}'
                    )
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'  ♻️  Updated: {package.name} - {package.token_amount:,} tokens for ${package.price}'
                    )
                )

            # Create Stripe products if requested
            if with_stripe:
                self._create_stripe_product(package)

        self.stdout.write(self.style.SUCCESS(f'  📊 Created: {created_count} | Updated: {updated_count}'))

    def _create_stripe_product(self, obj):
        """
        Create Stripe product and price for a tier or package using StripeService.
        """
        from core.billing.services import StripeService, StripeServiceError

        try:
            if isinstance(obj, SubscriptionTier):
                StripeService.sync_subscription_tier_to_stripe(obj)
                self.stdout.write(
                    self.style.SUCCESS(f'    ✅ Synced to Stripe: {obj.name} (product={obj.stripe_product_id[:20]}...)')
                )
            elif isinstance(obj, TokenPackage):
                StripeService.sync_token_package_to_stripe(obj)
                self.stdout.write(
                    self.style.SUCCESS(f'    ✅ Synced to Stripe: {obj.name} (product={obj.stripe_product_id[:20]}...)')
                )
        except StripeServiceError as e:
            self.stdout.write(self.style.ERROR(f'    ❌ Failed to sync {obj.name}: {e}'))
