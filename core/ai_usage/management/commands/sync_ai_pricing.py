"""
Management Command: Sync AI Provider Pricing

Syncs the latest pricing for AI providers (OpenAI, Anthropic, etc.)
Run this periodically or when prices change.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Count
from django.utils import timezone

from core.ai_usage.models import AIProviderPricing


class Command(BaseCommand):
    help = 'Sync AI provider pricing from latest public data'

    def add_arguments(self, parser):
        parser.add_argument('--update-active', action='store_true', help='Mark old pricing as inactive')

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n🔄 Syncing AI Provider Pricing...\n'))

        # Pricing data as of December 2025
        # Source: https://openai.com/pricing, https://anthropic.com/pricing
        pricing_data = [
            # OpenAI Models
            {
                'provider': 'openai',
                'model': 'gpt-4',
                'input_price_per_million': Decimal('30.00'),
                'output_price_per_million': Decimal('60.00'),
                'notes': 'GPT-4 - Most capable model, best for complex tasks',
            },
            {
                'provider': 'openai',
                'model': 'gpt-4-turbo',
                'input_price_per_million': Decimal('10.00'),
                'output_price_per_million': Decimal('30.00'),
                'notes': 'GPT-4 Turbo - Faster and cheaper than GPT-4',
            },
            {
                'provider': 'openai',
                'model': 'gpt-4-turbo-preview',
                'input_price_per_million': Decimal('10.00'),
                'output_price_per_million': Decimal('30.00'),
                'notes': 'GPT-4 Turbo Preview - Latest preview version',
            },
            {
                'provider': 'openai',
                'model': 'gpt-3.5-turbo',
                'input_price_per_million': Decimal('0.50'),
                'output_price_per_million': Decimal('1.50'),
                'notes': 'GPT-3.5 Turbo - Fast and affordable for most tasks',
            },
            {
                'provider': 'openai',
                'model': 'gpt-3.5-turbo-16k',
                'input_price_per_million': Decimal('3.00'),
                'output_price_per_million': Decimal('4.00'),
                'notes': 'GPT-3.5 Turbo 16K - Extended context window',
            },
            {
                'provider': 'openai',
                'model': 'text-embedding-3-small',
                'input_price_per_million': Decimal('0.02'),
                'output_price_per_million': Decimal('0.00'),
                'notes': 'Embeddings - Small model',
            },
            {
                'provider': 'openai',
                'model': 'text-embedding-3-large',
                'input_price_per_million': Decimal('0.13'),
                'output_price_per_million': Decimal('0.00'),
                'notes': 'Embeddings - Large model',
            },
            # Anthropic Models
            {
                'provider': 'anthropic',
                'model': 'claude-3-opus-20240229',
                'input_price_per_million': Decimal('15.00'),
                'output_price_per_million': Decimal('75.00'),
                'notes': 'Claude 3 Opus - Most intelligent model',
            },
            {
                'provider': 'anthropic',
                'model': 'claude-3-sonnet-20240229',
                'input_price_per_million': Decimal('3.00'),
                'output_price_per_million': Decimal('15.00'),
                'notes': 'Claude 3 Sonnet - Balanced performance and speed',
            },
            {
                'provider': 'anthropic',
                'model': 'claude-3-haiku-20240307',
                'input_price_per_million': Decimal('0.25'),
                'output_price_per_million': Decimal('1.25'),
                'notes': 'Claude 3 Haiku - Fastest and most compact',
            },
            {
                'provider': 'anthropic',
                'model': 'claude-2.1',
                'input_price_per_million': Decimal('8.00'),
                'output_price_per_million': Decimal('24.00'),
                'notes': 'Claude 2.1 - Previous generation',
            },
            {
                'provider': 'anthropic',
                'model': 'claude-2.0',
                'input_price_per_million': Decimal('8.00'),
                'output_price_per_million': Decimal('24.00'),
                'notes': 'Claude 2.0 - Previous generation',
            },
            # Google Models (if you use them)
            {
                'provider': 'google',
                'model': 'gemini-pro',
                'input_price_per_million': Decimal('0.50'),
                'output_price_per_million': Decimal('1.50'),
                'notes': 'Gemini Pro - Multimodal model',
            },
            {
                'provider': 'google',
                'model': 'gemini-ultra',
                'input_price_per_million': Decimal('10.00'),
                'output_price_per_million': Decimal('30.00'),
                'notes': 'Gemini Ultra - Most capable Google model',
            },
            # Cohere Models (if you use them)
            {
                'provider': 'cohere',
                'model': 'command',
                'input_price_per_million': Decimal('1.00'),
                'output_price_per_million': Decimal('2.00'),
                'notes': 'Cohere Command - Text generation',
            },
            {
                'provider': 'cohere',
                'model': 'command-light',
                'input_price_per_million': Decimal('0.30'),
                'output_price_per_million': Decimal('0.60'),
                'notes': 'Cohere Command Light - Faster and cheaper',
            },
        ]

        # Deactivate old pricing if requested
        if options['update_active']:
            AIProviderPricing.objects.filter(is_active=True).update(is_active=False)
            self.stdout.write(self.style.WARNING('✓ Marked all existing pricing as inactive'))

        # Create new pricing records
        created_count = 0
        for data in pricing_data:
            pricing, created = AIProviderPricing.objects.get_or_create(
                provider=data['provider'],
                model=data['model'],
                effective_date__date=timezone.now().date(),
                defaults={
                    'input_price_per_million': data['input_price_per_million'],
                    'output_price_per_million': data['output_price_per_million'],
                    'effective_date': timezone.now(),
                    'is_active': True,
                    'notes': data['notes'],
                },
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ Created: {data["provider"]}/{data["model"]} - '
                        f'In: ${data["input_price_per_million"]}/1M, Out: ${data["output_price_per_million"]}/1M'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'  ⚠ Already exists: {data["provider"]}/{data["model"]} (skipped)')
                )

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f'\n✅ Sync complete! Created {created_count}/{len(pricing_data)} pricing records.\n'
            )
        )

        # Show summary
        total_models = AIProviderPricing.objects.filter(is_active=True).count()
        by_provider = (
            AIProviderPricing.objects.filter(is_active=True)
            .values('provider')
            .annotate(count=Count('id'))
            .order_by('provider')
        )

        self.stdout.write(self.style.MIGRATE_HEADING('📊 Summary:'))
        self.stdout.write(f'  Total active models: {total_models}')
        for item in by_provider:
            self.stdout.write(f'    - {item["provider"]}: {item["count"]} models')

        self.stdout.write(
            self.style.WARNING('\n💡 Tip: Run this command periodically or when providers update their pricing.\n')
        )


# Import Count for aggregation
