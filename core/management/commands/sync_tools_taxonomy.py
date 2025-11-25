from django.core.management.base import BaseCommand

from core.taxonomy.models import Taxonomy
from core.tools.models import Tool


class Command(BaseCommand):
    help = 'Sync all Tools to Taxonomy entries (1:1 relationship)'

    def handle(self, *args, **options):
        tools = Tool.objects.all()
        created_count = 0
        linked_count = 0
        updated_count = 0

        for tool in tools:
            # Get or create taxonomy entry for this tool
            taxonomy, created = Taxonomy.objects.get_or_create(
                name=tool.name,
                defaults={
                    'taxonomy_type': 'tool',
                    'description': tool.tagline or tool.description[:200],
                    'website_url': tool.website_url,
                    'logo_url': tool.logo_url,
                    'usage_tips': tool.usage_tips or [],
                    'best_for': tool.use_cases or [],
                    'is_active': tool.is_active,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created taxonomy: {taxonomy.name}'))
            else:
                # Update existing taxonomy with latest tool info
                taxonomy.taxonomy_type = 'tool'
                taxonomy.description = tool.tagline or tool.description[:200]
                taxonomy.website_url = tool.website_url
                taxonomy.logo_url = tool.logo_url
                taxonomy.usage_tips = tool.usage_tips or []
                taxonomy.best_for = tool.use_cases or []
                taxonomy.is_active = tool.is_active
                taxonomy.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated taxonomy: {taxonomy.name}'))

            # Link tool to taxonomy if not already linked
            if tool.taxonomy != taxonomy:
                tool.taxonomy = taxonomy
                tool.save(update_fields=['taxonomy'])
                linked_count += 1
                self.stdout.write('  → Linked tool to taxonomy')

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Sync complete! Created: {created_count}, Updated: {updated_count}, Linked: {linked_count}'
            )
        )
