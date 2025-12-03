"""
Management command to export tools and companies to YAML file.

This command exports tool and company data from the database back to
core/fixtures/tools.yaml, allowing admin changes to be synced to the
source of truth file.

Usage:
    python manage.py export_tools                  # Export all tools and companies
    python manage.py export_tools --tools-only    # Only export tools
    python manage.py export_tools --companies-only # Only export companies
    python manage.py export_tools --dry-run       # Show what would be exported
    python manage.py export_tools --output FILE   # Export to custom file

This is useful for:
- Syncing admin edits (especially whats_new) back to version control
- Creating backups of tool data
- Migrating tools between environments
"""

from pathlib import Path

import yaml
from django.core.management.base import BaseCommand

from core.tools.models import Company, Tool


class LiteralStr(str):
    """String subclass for literal block style in YAML."""

    pass


def literal_str_representer(dumper, data):
    """Represent multi-line strings with literal block style."""
    if '\n' in data:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
    return dumper.represent_scalar('tag:yaml.org,2002:str', data)


# Register custom representer
yaml.add_representer(LiteralStr, literal_str_representer)


class Command(BaseCommand):
    help = 'Export tools and companies from database to YAML file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tools-only',
            action='store_true',
            help='Only export tools, skip companies',
        )
        parser.add_argument(
            '--companies-only',
            action='store_true',
            help='Only export companies, skip tools',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be exported without writing file',
        )
        parser.add_argument(
            '--output',
            type=str,
            default=None,
            help='Output file path (default: core/fixtures/tools.yaml)',
        )
        parser.add_argument(
            '--active-only',
            action='store_true',
            default=True,
            help='Only export active tools and companies (default: True)',
        )

    def get_output_path(self, options):
        """Get output file path."""
        if options['output']:
            return Path(options['output'])

        # Default location
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        return base_dir / 'core' / 'fixtures' / 'tools.yaml'

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        tools_only = options['tools_only']
        companies_only = options['companies_only']
        active_only = options['active_only']

        output_path = self.get_output_path(options)

        data = {}
        stats = {
            'companies': 0,
            'tools': 0,
        }

        # Export companies
        if not tools_only:
            data['companies'] = self.export_companies(active_only, stats)

        # Export tools
        if not companies_only:
            data['tools'] = self.export_tools(active_only, stats)

        # Generate YAML with header
        yaml_content = self.generate_yaml(data)

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\n[DRY RUN] Would write to: {output_path}'))
            self.stdout.write('\n' + '=' * 60)
            self.stdout.write('YAML PREVIEW (first 100 lines):')
            self.stdout.write('=' * 60 + '\n')
            preview_lines = yaml_content.split('\n')[:100]
            self.stdout.write('\n'.join(preview_lines))
            if len(yaml_content.split('\n')) > 100:
                self.stdout.write('\n... (truncated)')
        else:
            # Write to file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(yaml_content)
            self.stdout.write(self.style.SUCCESS(f'\n✓ Exported to: {output_path}'))

        # Print summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('EXPORT SUMMARY'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'  Companies: {stats["companies"]}')
        self.stdout.write(f'  Tools: {stats["tools"]}')

    def export_companies(self, active_only, stats):
        """Export companies to list of dicts."""
        queryset = Company.objects.all().order_by('name')
        if active_only:
            queryset = queryset.filter(is_active=True)

        companies = []
        for company in queryset:
            company_data = {
                'name': company.name,
            }

            # Only include non-empty fields
            if company.tagline:
                company_data['tagline'] = company.tagline
            if company.description:
                company_data['description'] = LiteralStr(company.description.strip())
            if company.website_url:
                company_data['website_url'] = company.website_url
            if company.logo_url:
                company_data['logo_url'] = company.logo_url
            if company.founded_year:
                company_data['founded_year'] = company.founded_year
            if company.headquarters:
                company_data['headquarters'] = company.headquarters
            if company.twitter_handle:
                company_data['twitter_handle'] = company.twitter_handle
            if company.github_url:
                company_data['github_url'] = company.github_url
            if company.linkedin_url:
                company_data['linkedin_url'] = company.linkedin_url
            if company.careers_url:
                company_data['careers_url'] = company.careers_url

            companies.append(company_data)
            stats['companies'] += 1

        return companies

    def export_tools(self, active_only, stats):
        """Export tools to list of dicts."""
        queryset = Tool.objects.select_related('company').all().order_by('category', 'name')
        if active_only:
            queryset = queryset.filter(is_active=True)

        tools = []
        for tool in queryset:
            tool_data = {
                'name': tool.name,
            }

            # Company reference
            if tool.company:
                tool_data['company'] = tool.company.name

            # Required fields
            tool_data['tagline'] = tool.tagline or ''
            if tool.description:
                tool_data['description'] = LiteralStr(tool.description.strip())
            tool_data['category'] = tool.category
            tool_data['tool_type'] = tool.tool_type
            tool_data['website_url'] = tool.website_url

            # Optional fields - only include if non-empty
            if tool.logo_url:
                tool_data['logo_url'] = tool.logo_url
            if tool.banner_url:
                tool_data['banner_url'] = tool.banner_url
            if tool.documentation_url:
                tool_data['documentation_url'] = tool.documentation_url
            if tool.pricing_url:
                tool_data['pricing_url'] = tool.pricing_url
            if tool.github_url:
                tool_data['github_url'] = tool.github_url
            if tool.twitter_handle:
                tool_data['twitter_handle'] = tool.twitter_handle
            if tool.discord_url:
                tool_data['discord_url'] = tool.discord_url

            # Pricing
            tool_data['pricing_model'] = tool.pricing_model
            tool_data['has_free_tier'] = tool.has_free_tier
            if tool.starting_price:
                tool_data['starting_price'] = tool.starting_price
            if tool.requires_api_key:
                tool_data['requires_api_key'] = tool.requires_api_key
            if tool.requires_waitlist:
                tool_data['requires_waitlist'] = tool.requires_waitlist

            # Lists - only include if non-empty
            if tool.tags:
                tool_data['tags'] = tool.tags
            if tool.key_features:
                tool_data['key_features'] = tool.key_features
            if tool.use_cases:
                tool_data['use_cases'] = tool.use_cases
            if tool.usage_tips:
                tool_data['usage_tips'] = tool.usage_tips
            if tool.best_practices:
                tool_data['best_practices'] = tool.best_practices
            if tool.limitations:
                tool_data['limitations'] = tool.limitations
            if tool.alternatives:
                tool_data['alternatives'] = tool.alternatives

            # Technical details
            if tool.overview:
                tool_data['overview'] = LiteralStr(tool.overview.strip())
            if tool.model_info:
                tool_data['model_info'] = tool.model_info
            if tool.integrations:
                tool_data['integrations'] = tool.integrations
            if tool.api_available:
                tool_data['api_available'] = tool.api_available
            if tool.languages_supported:
                tool_data['languages_supported'] = tool.languages_supported

            # SEO
            if tool.meta_description:
                tool_data['meta_description'] = tool.meta_description
            if tool.keywords:
                tool_data['keywords'] = tool.keywords

            # Media
            if tool.screenshot_urls:
                tool_data['screenshot_urls'] = tool.screenshot_urls
            if tool.demo_video_url:
                tool_data['demo_video_url'] = tool.demo_video_url

            # Status (only include non-default values)
            if tool.is_featured:
                tool_data['is_featured'] = tool.is_featured
            if tool.is_verified:
                tool_data['is_verified'] = tool.is_verified

            # Whats new - this is the key field that gets edited in admin
            if tool.whats_new:
                tool_data['whats_new'] = tool.whats_new

            tools.append(tool_data)
            stats['tools'] += 1

        return tools

    def generate_yaml(self, data):
        """Generate YAML content with header."""
        header = """# =============================================================================
# AllThrive AI Tool Directory - Source of Truth
# =============================================================================
# This file is the canonical source for all tool and company data.
#
# USAGE:
#   - Load tools: docker compose exec web python manage.py seed_tools
#   - Export admin changes: docker compose exec web python manage.py export_tools
#
# CONVENTIONS:
#   - Tools are organized by category for readability
#   - Each tool MUST have: name, tagline, description, category, website_url
#   - Optional fields will use sensible defaults if omitted
#   - Company references use the company name (must exist in companies section)
#
# EDITABLE FIELDS (preserved during seed, exportable from admin):
#   - whats_new: Recent updates/changelog
#   - All other fields are synced from this file
# =============================================================================

"""

        # Custom YAML dump settings for cleaner output
        yaml_content = yaml.dump(
            data,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=100,
            indent=2,
        )

        return header + yaml_content
