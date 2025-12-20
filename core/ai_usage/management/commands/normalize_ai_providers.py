"""
Management command to normalize AI provider names in existing usage logs.

This fixes historical data where different provider names were used for the same provider
(e.g., 'google' vs 'gemini').
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from core.ai_usage.models import AIProviderPricing, AIUsageLog

# Provider name mappings: old_name -> canonical_name
PROVIDER_MAPPINGS = {
    'google': 'gemini',
}


class Command(BaseCommand):
    help = 'Normalize AI provider names in usage logs and pricing tables'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))
            self.stdout.write('')

        # Normalize usage logs
        self.stdout.write('Normalizing AI usage logs...')
        for old_name, new_name in PROVIDER_MAPPINGS.items():
            count = AIUsageLog.objects.filter(provider=old_name).count()
            if count > 0:
                if dry_run:
                    self.stdout.write(f'  Would update {count} logs: {old_name} -> {new_name}')
                else:
                    with transaction.atomic():
                        updated = AIUsageLog.objects.filter(provider=old_name).update(provider=new_name)
                        self.stdout.write(self.style.SUCCESS(f'  Updated {updated} logs: {old_name} -> {new_name}'))
            else:
                self.stdout.write(f'  No logs found with provider={old_name}')

        # Normalize pricing table
        self.stdout.write('')
        self.stdout.write('Normalizing AI pricing table...')
        for old_name, new_name in PROVIDER_MAPPINGS.items():
            count = AIProviderPricing.objects.filter(provider=old_name).count()
            if count > 0:
                if dry_run:
                    self.stdout.write(f'  Would update {count} pricing entries: {old_name} -> {new_name}')
                else:
                    with transaction.atomic():
                        updated = AIProviderPricing.objects.filter(provider=old_name).update(provider=new_name)
                        self.stdout.write(
                            self.style.SUCCESS(f'  Updated {updated} pricing entries: {old_name} -> {new_name}')
                        )
            else:
                self.stdout.write(f'  No pricing entries found with provider={old_name}')

        # Recalculate costs for affected logs
        if not dry_run:
            self.stdout.write('')
            self.stdout.write('Recalculating costs for logs with $0 cost...')
            zero_cost_logs = AIUsageLog.objects.filter(total_cost=0, total_tokens__gt=0)
            recalculated = 0
            for log in zero_cost_logs[:1000]:  # Limit to 1000 at a time
                pricing = (
                    AIProviderPricing.objects.filter(
                        provider=log.provider,
                        model=log.model,
                        is_active=True,
                    )
                    .order_by('-effective_date')
                    .first()
                )
                if pricing:
                    from decimal import Decimal

                    input_cost = (Decimal(log.input_tokens) / Decimal('1000000')) * pricing.input_price_per_million
                    output_cost = (Decimal(log.output_tokens) / Decimal('1000000')) * pricing.output_price_per_million
                    total_cost = input_cost + output_cost

                    log.input_cost = input_cost
                    log.output_cost = output_cost
                    log.total_cost = total_cost
                    log.pricing_version = pricing
                    log.save()
                    recalculated += 1

            self.stdout.write(self.style.SUCCESS(f'  Recalculated {recalculated} logs'))

        # Summary
        self.stdout.write('')
        self.stdout.write('Current provider distribution:')
        from django.db.models import Count

        provider_counts = AIUsageLog.objects.values('provider').annotate(count=Count('id')).order_by('-count')
        for item in provider_counts:
            self.stdout.write(f"  {item['provider']}: {item['count']} logs")

        if dry_run:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('DRY RUN complete. Run without --dry-run to apply changes.'))
        else:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('Provider normalization complete!'))
