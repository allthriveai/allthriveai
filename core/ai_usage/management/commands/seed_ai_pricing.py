"""
Management command to seed AI provider pricing and recalculate costs.

Usage:
    python manage.py seed_ai_pricing              # Seed pricing and recalculate costs
    python manage.py seed_ai_pricing --dry-run   # Show what would be done
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone

from core.ai_usage.models import AIProviderPricing, AIUsageLog

# Current pricing for AI models (prices per million tokens)
# Source: Provider pricing pages as of Dec 2024
AI_PRICING_DATA = [
    # OpenAI - https://openai.com/pricing
    {
        'provider': 'openai',
        'model': 'gpt-4o-mini',
        'input_price_per_million': Decimal('0.15'),
        'output_price_per_million': Decimal('0.60'),
    },
    {
        'provider': 'openai',
        'model': 'gpt-5-mini-2025-08-07',
        'input_price_per_million': Decimal('0.15'),
        'output_price_per_million': Decimal('0.60'),
    },
    {
        'provider': 'openai',
        'model': 'gpt-4-turbo',
        'input_price_per_million': Decimal('10.00'),
        'output_price_per_million': Decimal('30.00'),
    },
    {
        'provider': 'openai',
        'model': 'gpt-4o',
        'input_price_per_million': Decimal('2.50'),
        'output_price_per_million': Decimal('10.00'),
    },
    {
        'provider': 'openai',
        'model': 'gpt-3.5-turbo',
        'input_price_per_million': Decimal('0.50'),
        'output_price_per_million': Decimal('1.50'),
    },
    # Azure (same pricing as OpenAI)
    {
        'provider': 'azure',
        'model': 'gpt-4.1',
        'input_price_per_million': Decimal('2.50'),
        'output_price_per_million': Decimal('10.00'),
    },
    # Anthropic - https://www.anthropic.com/pricing
    {
        'provider': 'anthropic',
        'model': 'claude-3-5-sonnet',
        'input_price_per_million': Decimal('3.00'),
        'output_price_per_million': Decimal('15.00'),
    },
    {
        'provider': 'anthropic',
        'model': 'claude-3-haiku',
        'input_price_per_million': Decimal('0.25'),
        'output_price_per_million': Decimal('1.25'),
    },
    {
        'provider': 'anthropic',
        'model': 'claude-sonnet-4-20250514',
        'input_price_per_million': Decimal('3.00'),
        'output_price_per_million': Decimal('15.00'),
    },
    # Google/Gemini - https://ai.google.dev/pricing
    {
        'provider': 'gemini',
        'model': 'gemini-3-pro-image-preview',
        'input_price_per_million': Decimal('1.25'),
        'output_price_per_million': Decimal('5.00'),
    },
    {
        'provider': 'google',
        'model': 'gemini-3-pro-image-preview',
        'input_price_per_million': Decimal('1.25'),
        'output_price_per_million': Decimal('5.00'),
    },
    {
        'provider': 'gemini',
        'model': 'gemini-1.5-pro',
        'input_price_per_million': Decimal('1.25'),
        'output_price_per_million': Decimal('5.00'),
    },
    {
        'provider': 'gemini',
        'model': 'gemini-1.5-flash',
        'input_price_per_million': Decimal('0.075'),
        'output_price_per_million': Decimal('0.30'),
    },
]


class Command(BaseCommand):
    help = 'Seed AI provider pricing and recalculate existing usage costs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--skip-recalc',
            action='store_true',
            help='Skip recalculating costs for existing logs',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        skip_recalc = options['skip_recalc']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be made\n'))

        # Seed pricing data
        self.stdout.write('Seeding AI provider pricing...')
        created = 0
        updated = 0

        for data in AI_PRICING_DATA:
            if dry_run:
                exists = AIProviderPricing.objects.filter(provider=data['provider'], model=data['model']).exists()
                action = 'update' if exists else 'create'
                self.stdout.write(f"  Would {action}: {data['provider']}/{data['model']}")
            else:
                obj, was_created = AIProviderPricing.objects.update_or_create(
                    provider=data['provider'],
                    model=data['model'],
                    defaults={
                        'input_price_per_million': data['input_price_per_million'],
                        'output_price_per_million': data['output_price_per_million'],
                        'is_active': True,
                        'effective_date': timezone.now(),
                    },
                )
                if was_created:
                    created += 1
                    self.stdout.write(f"  Created: {data['provider']}/{data['model']}")
                else:
                    updated += 1
                    self.stdout.write(f"  Updated: {data['provider']}/{data['model']}")

        if not dry_run:
            self.stdout.write(self.style.SUCCESS(f'\nPricing: {created} created, {updated} updated'))

        # Recalculate costs
        if skip_recalc:
            self.stdout.write('\nSkipping cost recalculation (--skip-recalc)')
            return

        self.stdout.write('\nRecalculating costs for existing usage logs...')

        # Get logs with zero cost
        logs_to_update = AIUsageLog.objects.filter(total_cost=0)
        total_logs = logs_to_update.count()

        if total_logs == 0:
            self.stdout.write('  No logs with zero cost found')
            return

        self.stdout.write(f'  Found {total_logs} logs to recalculate')

        recalculated = 0
        missing_pricing = set()

        for log in logs_to_update:
            try:
                pricing = AIProviderPricing.objects.get(provider=log.provider, model=log.model, is_active=True)

                input_cost = Decimal(log.input_tokens or 0) / Decimal(1_000_000) * pricing.input_price_per_million
                output_cost = Decimal(log.output_tokens or 0) / Decimal(1_000_000) * pricing.output_price_per_million
                total_cost = input_cost + output_cost

                if not dry_run:
                    log.input_cost = input_cost
                    log.output_cost = output_cost
                    log.total_cost = total_cost
                    log.save(update_fields=['input_cost', 'output_cost', 'total_cost'])

                recalculated += 1

            except AIProviderPricing.DoesNotExist:
                missing_pricing.add(f'{log.provider}/{log.model}')

        if missing_pricing:
            self.stdout.write(self.style.WARNING(f'\n  Missing pricing for: {", ".join(sorted(missing_pricing))}'))

        if dry_run:
            self.stdout.write(f'\n  Would recalculate {recalculated} logs')
        else:
            self.stdout.write(self.style.SUCCESS(f'\n  Recalculated {recalculated} logs'))

            # Show totals
            total_cost = AIUsageLog.objects.aggregate(total=Sum('total_cost'))['total'] or 0
            self.stdout.write(f'\nTotal AI cost: ${total_cost:.4f}')
