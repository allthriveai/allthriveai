from django.core.management.base import BaseCommand

from core.taxonomy.models import Taxonomy
from core.tools.models import Tool


class Command(BaseCommand):
    """Link Tool entities to corresponding Taxonomy entries."""

    help = 'Link Tool entities to corresponding Taxonomy entries for personalization'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))

        tools = Tool.objects.all()
        total_tools = tools.count()
        linked_count = 0
        created_taxonomy_count = 0
        already_linked_count = 0

        self.stdout.write(f'\nProcessing {total_tools} tools...')

        for tool in tools:
            # Skip if already linked
            if tool.taxonomy:
                self.stdout.write(self.style.SUCCESS(f'✓ {tool.name} - Already linked to taxonomy'))
                already_linked_count += 1
                continue

            # Try to find matching taxonomy by name
            taxonomy = Taxonomy.objects.filter(name__iexact=tool.name, category='tool').first()

            if not taxonomy:
                # Create taxonomy if it doesn't exist
                if not dry_run:
                    taxonomy = Taxonomy.objects.create(
                        name=tool.name,
                        category='tool',
                        description=tool.description[:500] if tool.description else '',  # Truncate if needed
                        website_url=tool.website_url,
                        logo_url=tool.logo_url if tool.logo_url else None,
                        usage_tips=tool.usage_tips if tool.usage_tips else [],
                        best_for=tool.best_practices[:5] if tool.best_practices else [],
                        is_active=tool.is_active,
                    )
                    self.stdout.write(self.style.WARNING(f'+ Created taxonomy for {tool.name}'))
                    created_taxonomy_count += 1
                else:
                    self.stdout.write(self.style.WARNING(f'[DRY RUN] Would create taxonomy for {tool.name}'))
                    created_taxonomy_count += 1
                    continue  # Skip linking in dry run mode

            # Link tool to taxonomy
            if not dry_run:
                tool.taxonomy = taxonomy
                tool.save(update_fields=['taxonomy'])
                self.stdout.write(self.style.SUCCESS(f'→ Linked {tool.name} to taxonomy'))
                linked_count += 1
            else:
                self.stdout.write(self.style.SUCCESS(f'[DRY RUN] Would link {tool.name} to taxonomy'))
                linked_count += 1

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('\n📊 Summary:'))
        self.stdout.write(f'  Total tools processed: {total_tools}')
        self.stdout.write(f'  Already linked: {already_linked_count}')
        self.stdout.write(f'  Newly linked: {linked_count}')
        self.stdout.write(f'  Taxonomies created: {created_taxonomy_count}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n⚠️  This was a DRY RUN - no changes were made'))
            self.stdout.write('Run without --dry-run to apply changes')
        else:
            self.stdout.write(self.style.SUCCESS('\n✅ All tools have been processed!'))
