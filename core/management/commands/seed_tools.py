"""
Management command to seed tools and companies from YAML file.

This command loads tool and company data from core/fixtures/tools.yaml,
which serves as the source of truth for the tool directory.

Usage:
    python manage.py seed_tools                    # Seed all tools and companies
    python manage.py seed_tools --tools-only       # Only seed tools
    python manage.py seed_tools --companies-only   # Only seed companies
    python manage.py seed_tools --dry-run          # Show what would be done

The 'whats_new' field is preserved during updates as it's meant to be
edited via Django admin and synced back via export_tools command.
"""

from pathlib import Path

import yaml
from django.core.management.base import BaseCommand
from django.db import transaction

from core.tools.models import Company, Tool


class Command(BaseCommand):
    help = 'Seed tools and companies from YAML file (source of truth)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tools-only',
            action='store_true',
            help='Only seed tools, skip companies',
        )
        parser.add_argument(
            '--companies-only',
            action='store_true',
            help='Only seed companies, skip tools',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--file',
            type=str,
            default=None,
            help='Path to YAML file (default: core/fixtures/tools.yaml)',
        )

    def get_yaml_path(self, options):
        """Get path to YAML file."""
        if options['file']:
            return Path(options['file'])

        # Default location
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        return base_dir / 'core' / 'fixtures' / 'tools.yaml'

    def load_yaml(self, yaml_path):
        """Load and parse YAML file."""
        if not yaml_path.exists():
            raise FileNotFoundError(f'YAML file not found: {yaml_path}')

        with open(yaml_path, encoding='utf-8') as f:
            return yaml.safe_load(f)

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        tools_only = options['tools_only']
        companies_only = options['companies_only']

        yaml_path = self.get_yaml_path(options)
        self.stdout.write(f'Loading from: {yaml_path}')

        try:
            data = self.load_yaml(yaml_path)
        except FileNotFoundError as e:
            self.stdout.write(self.style.ERROR(str(e)))
            return
        except yaml.YAMLError as e:
            self.stdout.write(self.style.ERROR(f'YAML parse error: {e}'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No changes will be made\n'))

        stats = {
            'companies_created': 0,
            'companies_updated': 0,
            'tools_created': 0,
            'tools_updated': 0,
            'tools_linked': 0,
        }

        try:
            with transaction.atomic():
                # Seed companies first (tools reference them)
                if not tools_only:
                    self.seed_companies(data.get('companies', []), stats, dry_run)

                # Seed tools
                if not companies_only:
                    self.seed_tools(data.get('tools', []), stats, dry_run)

                if dry_run:
                    # Rollback in dry run mode
                    raise DryRunException()

        except DryRunException:
            pass  # Expected for dry run

        # Print summary
        self.print_summary(stats, dry_run)

    def seed_companies(self, companies_data, stats, dry_run):
        """Seed companies from YAML data."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SEEDING COMPANIES'))
        self.stdout.write('=' * 60)

        for company_data in companies_data:
            name = company_data.get('name')
            if not name:
                self.stdout.write(self.style.WARNING('  Skipping company without name'))
                continue

            defaults = {
                'tagline': company_data.get('tagline', ''),
                'description': company_data.get('description', ''),
                'website_url': company_data.get('website_url', ''),
                'logo_url': company_data.get('logo_url', ''),
                'founded_year': company_data.get('founded_year'),
                'headquarters': company_data.get('headquarters', ''),
                'twitter_handle': company_data.get('twitter_handle', ''),
                'github_url': company_data.get('github_url', ''),
                'linkedin_url': company_data.get('linkedin_url', ''),
                'careers_url': company_data.get('careers_url', ''),
                'is_active': True,
            }

            company, created = Company.objects.get_or_create(
                name=name,
                defaults=defaults,
            )

            if created:
                stats['companies_created'] += 1
                self.stdout.write(self.style.SUCCESS(f'  + Created: {name}'))
            else:
                # Update existing company
                for field, value in defaults.items():
                    if value is not None:  # Only update non-None values
                        setattr(company, field, value)
                company.save()
                stats['companies_updated'] += 1
                self.stdout.write(self.style.WARNING(f'  ~ Updated: {name}'))

    def seed_tools(self, tools_data, stats, dry_run):
        """Seed tools from YAML data."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SEEDING TOOLS'))
        self.stdout.write('=' * 60)

        for tool_data in tools_data:
            name = tool_data.get('name')
            if not name:
                self.stdout.write(self.style.WARNING('  Skipping tool without name'))
                continue

            # Look up company by name
            company = None
            company_name = tool_data.get('company')
            if company_name:
                company = Company.objects.filter(name__iexact=company_name).first()
                if not company:
                    self.stdout.write(self.style.NOTICE(f'  ! Company not found for {name}: {company_name}'))

            # Build defaults dict
            defaults = {
                'tagline': tool_data.get('tagline', ''),
                'description': tool_data.get('description', ''),
                'category': tool_data.get('category', 'other'),
                'tool_type': tool_data.get('tool_type', 'ai_tool'),
                'website_url': tool_data.get('website_url', ''),
                'logo_url': tool_data.get('logo_url', ''),
                'banner_url': tool_data.get('banner_url', ''),
                'documentation_url': tool_data.get('documentation_url', ''),
                'pricing_url': tool_data.get('pricing_url', ''),
                'github_url': tool_data.get('github_url', ''),
                'twitter_handle': tool_data.get('twitter_handle', ''),
                'discord_url': tool_data.get('discord_url', ''),
                'pricing_model': tool_data.get('pricing_model', 'freemium'),
                'starting_price': tool_data.get('starting_price', ''),
                'has_free_tier': tool_data.get('has_free_tier', True),
                'requires_api_key': tool_data.get('requires_api_key', False),
                'requires_waitlist': tool_data.get('requires_waitlist', False),
                'tags': tool_data.get('tags', []),
                'key_features': tool_data.get('key_features', []),
                'use_cases': tool_data.get('use_cases', []),
                'usage_tips': tool_data.get('usage_tips', []),
                'best_practices': tool_data.get('best_practices', []),
                'limitations': tool_data.get('limitations', []),
                'alternatives': tool_data.get('alternatives', []),
                'overview': tool_data.get('overview', ''),
                'model_info': tool_data.get('model_info', {}),
                'integrations': tool_data.get('integrations', []),
                'api_available': tool_data.get('api_available', False),
                'languages_supported': tool_data.get('languages_supported', []),
                'meta_description': tool_data.get('meta_description', ''),
                'keywords': tool_data.get('keywords', []),
                'screenshot_urls': tool_data.get('screenshot_urls', []),
                'demo_video_url': tool_data.get('demo_video_url', ''),
                'is_active': tool_data.get('is_active', True),
                'is_featured': tool_data.get('is_featured', False),
                'is_verified': tool_data.get('is_verified', False),
                'company': company,
            }

            tool, created = Tool.objects.get_or_create(
                name=name,
                defaults=defaults,
            )

            if created:
                stats['tools_created'] += 1
                self.stdout.write(self.style.SUCCESS(f'  + Created: {name}'))
            else:
                # Update existing tool, but preserve whats_new
                existing_whats_new = tool.whats_new
                for field, value in defaults.items():
                    if value is not None:
                        setattr(tool, field, value)
                # Restore whats_new (editable field, preserved during sync)
                tool.whats_new = existing_whats_new
                tool.save()
                stats['tools_updated'] += 1
                self.stdout.write(self.style.WARNING(f'  ~ Updated: {name} (whats_new preserved)'))

            # Track company linking
            if company and tool.company == company:
                if created or tool.company != company:
                    stats['tools_linked'] += 1

    def print_summary(self, stats, dry_run):
        """Print summary of operations."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SUMMARY'))
        self.stdout.write('=' * 60)

        prefix = '[DRY RUN] Would have ' if dry_run else ''

        self.stdout.write(f'\n{prefix}Companies:')
        self.stdout.write(f"  Created: {stats['companies_created']}")
        self.stdout.write(f"  Updated: {stats['companies_updated']}")

        self.stdout.write(f'\n{prefix}Tools:')
        self.stdout.write(f"  Created: {stats['tools_created']}")
        self.stdout.write(f"  Updated: {stats['tools_updated']}")
        self.stdout.write(f"  Linked to companies: {stats['tools_linked']}")

        total = (
            stats['companies_created'] + stats['companies_updated'] + stats['tools_created'] + stats['tools_updated']
        )

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\n[DRY RUN] {total} total operations would be performed'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n✓ {total} total operations completed'))
            self.stdout.write(self.style.NOTICE('\nNote: whats_new field is preserved during updates.'))
            self.stdout.write(
                self.style.NOTICE('Use "python manage.py export_tools" to sync admin changes back to YAML.')
            )


class DryRunException(Exception):
    """Exception to trigger rollback in dry run mode."""

    pass
