"""
DEPRECATED: This command has been merged into seed_tools.

Use instead:
    python manage.py seed_tools                    # Seed both companies and tools
    python manage.py seed_tools --companies-only   # Seed only companies

Companies are now defined in core/fixtures/tools.yaml alongside tools.
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'DEPRECATED: Use seed_tools instead. Companies are now seeded from tools.yaml'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING(
                '\n'
                + '=' * 60
                + '\nDEPRECATED COMMAND'
                + '\n'
                + '=' * 60
                + '\n\nThis command has been merged into seed_tools.'
                + '\nCompanies and tools are now managed together in:'
                + '\n  core/fixtures/tools.yaml'
                + '\n\nUse instead:'
                + '\n  python manage.py seed_tools                  # Seed all'
                + '\n  python manage.py seed_tools --companies-only # Companies only'
                + '\n'
                + '=' * 60
                + '\n'
            )
        )

        # Optionally run the new command
        from django.core.management import call_command

        self.stdout.write('\nRunning seed_tools --companies-only...\n')
        call_command('seed_tools', companies_only=True)
