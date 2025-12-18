"""
Management command to export UAT scenarios and categories to YAML file.

This command exports UAT scenario data from the database to core/fixtures/uat_scenarios.yaml,
allowing admin changes to be version controlled.

Usage:
    python manage.py export_uat_scenarios                  # Export all scenarios and categories
    python manage.py export_uat_scenarios --scenarios-only # Only export scenarios
    python manage.py export_uat_scenarios --categories-only # Only export categories
    python manage.py export_uat_scenarios --dry-run        # Show what would be exported
    python manage.py export_uat_scenarios --output FILE    # Export to custom file

This is useful for:
- Version controlling UAT scenario configuration
- Backing up scenario data
- Migrating scenarios between environments
"""

from pathlib import Path

import yaml
from django.core.management.base import BaseCommand

from core.uat_scenarios.models import UATCategory, UATScenario, UATTestRun


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
    help = 'Export UAT scenarios and categories from database to YAML file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--scenarios-only',
            action='store_true',
            help='Only export scenarios, skip categories',
        )
        parser.add_argument(
            '--categories-only',
            action='store_true',
            help='Only export categories, skip scenarios',
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
            help='Output file path (default: core/fixtures/uat_scenarios.yaml)',
        )
        parser.add_argument(
            '--include-archived',
            action='store_true',
            help='Include archived scenarios (default: exclude)',
        )

    def get_output_path(self, options):
        """Get output file path."""
        if options['output']:
            return Path(options['output'])

        # Default location
        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        return base_dir / 'core' / 'fixtures' / 'uat_scenarios.yaml'

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        scenarios_only = options['scenarios_only']
        categories_only = options['categories_only']
        include_archived = options['include_archived']

        output_path = self.get_output_path(options)

        data = {}
        stats = {
            'categories': 0,
            'scenarios': 0,
            'test_runs': 0,
        }

        # Export categories
        if not scenarios_only:
            data['categories'] = self.export_categories(stats)

        # Export scenarios
        if not categories_only:
            data['scenarios'] = self.export_scenarios(include_archived, stats)
            data['test_runs'] = self.export_test_runs(include_archived, stats)

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
            # Ensure directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            # Write to file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(yaml_content)
            self.stdout.write(self.style.SUCCESS(f'\nExported to: {output_path}'))

        # Print summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('EXPORT SUMMARY'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'  Categories: {stats["categories"]}')
        self.stdout.write(f'  Scenarios: {stats["scenarios"]}')
        self.stdout.write(f'  Test Runs: {stats["test_runs"]}')

    def export_categories(self, stats):
        """Export UAT categories to list of dicts."""
        queryset = UATCategory.objects.filter(is_active=True).order_by('order', 'name')

        categories = []
        for cat in queryset:
            cat_data = {
                'name': cat.name,
                'slug': cat.slug,
                'color': cat.color,
                'order': cat.order,
            }

            categories.append(cat_data)
            stats['categories'] += 1

        return categories

    def export_scenarios(self, include_archived, stats):
        """Export UAT scenarios to list of dicts."""
        queryset = UATScenario.objects.select_related('category').order_by('order', '-created_at')

        if not include_archived:
            queryset = queryset.filter(is_archived=False)

        scenarios = []
        for scenario in queryset:
            scenario_data = {
                'title': scenario.title,
                'order': scenario.order,
            }

            # Category (use slug for portability)
            if scenario.category:
                scenario_data['category'] = scenario.category.slug

            # Description (use literal style for multiline)
            if scenario.description:
                scenario_data['description'] = LiteralStr(scenario.description.strip())

            # Status
            if scenario.is_archived:
                scenario_data['is_archived'] = True

            scenarios.append(scenario_data)
            stats['scenarios'] += 1

        return scenarios

    def export_test_runs(self, include_archived, stats):
        """Export UAT test runs to list of dicts."""
        queryset = UATTestRun.objects.select_related('scenario', 'tested_by').order_by(
            'scenario__order', '-date_tested', '-created_at'
        )

        if not include_archived:
            queryset = queryset.filter(scenario__is_archived=False)

        test_runs = []
        for run in queryset:
            run_data = {
                'scenario': run.scenario.title,
                'date_tested': run.date_tested.isoformat(),
                'result': run.result,
            }

            # Tested by (use email for portability)
            if run.tested_by:
                run_data['tested_by'] = run.tested_by.email

            # Notes (use literal style for multiline)
            if run.notes:
                run_data['notes'] = LiteralStr(run.notes.strip())

            test_runs.append(run_data)
            stats['test_runs'] += 1

        return test_runs

    def generate_yaml(self, data):
        """Generate YAML content with header."""
        header = """# =============================================================================
# AllThrive AI - UAT Scenarios Configuration
# =============================================================================
# This file contains UAT (User Acceptance Testing) scenarios, categories, and test runs.
#
# USAGE:
#   - Load scenarios: docker compose exec web python manage.py seed_uat_scenarios
#   - Export changes: docker compose exec web python manage.py export_uat_scenarios
#
# CONVENTIONS:
#   - Categories are referenced by slug (auto-generated from name if not provided)
#   - Scenarios are referenced by title in test_runs
#   - Testers are referenced by email
#   - Dates use ISO 8601 format (YYYY-MM-DD)
#   - Multi-line descriptions use YAML literal block style (|)
#   - result values: pass, fail, na
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
