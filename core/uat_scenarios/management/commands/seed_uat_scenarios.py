"""
Management command to seed UAT scenarios and categories from YAML file.

This command loads UAT scenario data from core/fixtures/uat_scenarios.yaml,
which serves as the source of truth for UAT scenario configuration.

Usage:
    python manage.py seed_uat_scenarios                    # Seed all categories and scenarios
    python manage.py seed_uat_scenarios --categories-only  # Only seed categories
    python manage.py seed_uat_scenarios --scenarios-only   # Only seed scenarios
    python manage.py seed_uat_scenarios --dry-run          # Show what would be done

The command will:
- Create/update categories
- Create/update scenarios, matching by title
- Look up assignees by email
- Look up categories by slug
"""

from datetime import datetime
from pathlib import Path

import yaml
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from core.uat_scenarios.models import UATCategory, UATScenario, UATTestRun

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed UAT scenarios and categories from YAML file (source of truth)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--scenarios-only',
            action='store_true',
            help='Only seed scenarios, skip categories',
        )
        parser.add_argument(
            '--categories-only',
            action='store_true',
            help='Only seed categories, skip scenarios',
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
            help='Path to YAML file (default: core/fixtures/uat_scenarios.yaml)',
        )

    def get_yaml_path(self, options):
        """Get path to YAML file."""
        if options['file']:
            return Path(options['file'])

        # Default location
        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        return base_dir / 'core' / 'fixtures' / 'uat_scenarios.yaml'

    def load_yaml(self, yaml_path):
        """Load and parse YAML file."""
        if not yaml_path.exists():
            raise FileNotFoundError(f'YAML file not found: {yaml_path}')

        with open(yaml_path, encoding='utf-8') as f:
            return yaml.safe_load(f)

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        scenarios_only = options['scenarios_only']
        categories_only = options['categories_only']

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
            'categories_created': 0,
            'categories_updated': 0,
            'scenarios_created': 0,
            'scenarios_updated': 0,
            'test_runs_created': 0,
            'test_runs_updated': 0,
        }

        try:
            with transaction.atomic():
                # Seed categories first (scenarios reference them)
                if not scenarios_only:
                    self.seed_categories(data.get('categories', []), stats, dry_run)

                # Seed scenarios
                if not categories_only:
                    self.seed_scenarios(data.get('scenarios', []), stats, dry_run)
                    self.seed_test_runs(data.get('test_runs', []), stats, dry_run)

                if dry_run:
                    # Rollback in dry run mode
                    raise DryRunException()

        except DryRunException:
            pass  # Expected for dry run

        # Print summary
        self.print_summary(stats, dry_run)

    def seed_categories(self, categories_data, stats, dry_run):
        """Seed UAT categories from YAML data."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SEEDING UAT CATEGORIES'))
        self.stdout.write('=' * 60)

        for cat_data in categories_data:
            name = cat_data.get('name')
            if not name:
                self.stdout.write(self.style.WARNING('  Skipping category without name'))
                continue

            slug = cat_data.get('slug', '')

            defaults = {
                'name': name,
                'color': cat_data.get('color', 'slate'),
                'order': cat_data.get('order', 0),
                'is_active': cat_data.get('is_active', True),
            }

            # Look up by slug first, then by name
            category = None
            if slug:
                category = UATCategory.objects.filter(slug=slug).first()
            if not category:
                category = UATCategory.objects.filter(name__iexact=name).first()

            if category:
                # Update existing
                for field, value in defaults.items():
                    setattr(category, field, value)
                category.save()
                stats['categories_updated'] += 1
                self.stdout.write(self.style.WARNING(f'  ~ Updated: {name}'))
            else:
                # Create new
                category = UATCategory.objects.create(slug=slug, **defaults)
                stats['categories_created'] += 1
                self.stdout.write(self.style.SUCCESS(f'  + Created: {name}'))

    def seed_scenarios(self, scenarios_data, stats, dry_run):
        """Seed UAT scenarios from YAML data."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SEEDING UAT SCENARIOS'))
        self.stdout.write('=' * 60)

        # Cache lookups
        category_cache = {cat.slug: cat for cat in UATCategory.objects.all()}

        for scenario_data in scenarios_data:
            title = scenario_data.get('title')
            if not title:
                self.stdout.write(self.style.WARNING('  Skipping scenario without title'))
                continue

            # Look up category
            category = None
            category_slug = scenario_data.get('category', '')
            if category_slug:
                category = category_cache.get(category_slug)
                if not category:
                    self.stdout.write(self.style.NOTICE(f'  ! Category not found for "{title}": {category_slug}'))

            defaults = {
                'description': scenario_data.get('description', '').strip(),
                'category': category,
                'order': scenario_data.get('order', 0),
                'is_archived': scenario_data.get('is_archived', False),
            }

            # Try to find existing scenario by title
            scenario = UATScenario.objects.filter(title__iexact=title).first()

            if scenario:
                # Update existing
                for field, value in defaults.items():
                    setattr(scenario, field, value)
                scenario.save()
                stats['scenarios_updated'] += 1
                self.stdout.write(self.style.WARNING(f'  ~ Updated: {title[:50]}'))
            else:
                # Create new
                scenario = UATScenario.objects.create(title=title, **defaults)
                stats['scenarios_created'] += 1
                self.stdout.write(self.style.SUCCESS(f'  + Created: {title[:50]}'))

    def seed_test_runs(self, test_runs_data, stats, dry_run):
        """Seed UAT test runs from YAML data."""
        if not test_runs_data:
            return

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SEEDING UAT TEST RUNS'))
        self.stdout.write('=' * 60)

        # Cache lookups
        scenario_cache = {s.title.lower(): s for s in UATScenario.objects.all()}
        user_cache = {user.email: user for user in User.objects.filter(role='admin')}

        for run_data in test_runs_data:
            scenario_title = run_data.get('scenario')
            if not scenario_title:
                self.stdout.write(self.style.WARNING('  Skipping test run without scenario'))
                continue

            # Look up scenario
            scenario = scenario_cache.get(scenario_title.lower())
            if not scenario:
                self.stdout.write(self.style.NOTICE(f'  ! Scenario not found: {scenario_title}'))
                continue

            # Parse date_tested
            date_tested = None
            if run_data.get('date_tested'):
                try:
                    date_str = str(run_data['date_tested'])
                    date_tested = datetime.fromisoformat(date_str).date()
                except (ValueError, AttributeError):
                    self.stdout.write(self.style.NOTICE(f'  ! Invalid date_tested for "{scenario_title}"'))
                    continue
            else:
                self.stdout.write(self.style.WARNING('  Skipping test run without date_tested'))
                continue

            # Look up tested_by
            tested_by = None
            tested_by_email = run_data.get('tested_by', '')
            if tested_by_email:
                tested_by = user_cache.get(tested_by_email)
                if not tested_by:
                    self.stdout.write(self.style.NOTICE(f'  ! Tester not found: {tested_by_email}'))

            result = run_data.get('result')
            if not result:
                self.stdout.write(self.style.WARNING('  Skipping test run without result'))
                continue

            # Check if test run already exists (same scenario + date + tester)
            existing = UATTestRun.objects.filter(
                scenario=scenario,
                date_tested=date_tested,
                tested_by=tested_by,
            ).first()

            defaults = {
                'result': result,
                'notes': run_data.get('notes', ''),
            }

            if existing:
                # Update existing
                for field, value in defaults.items():
                    setattr(existing, field, value)
                existing.save()
                stats['test_runs_updated'] += 1
                self.stdout.write(self.style.WARNING(f'  ~ Updated: {scenario_title[:30]} ({date_tested})'))
            else:
                # Create new
                UATTestRun.objects.create(
                    scenario=scenario,
                    date_tested=date_tested,
                    tested_by=tested_by,
                    **defaults,
                )
                stats['test_runs_created'] += 1
                self.stdout.write(self.style.SUCCESS(f'  + Created: {scenario_title[:30]} ({date_tested})'))

    def print_summary(self, stats, dry_run):
        """Print summary of operations."""
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SUMMARY'))
        self.stdout.write('=' * 60)

        prefix = '[DRY RUN] Would have ' if dry_run else ''

        self.stdout.write(f'\n{prefix}Categories:')
        self.stdout.write(f'  Created: {stats["categories_created"]}')
        self.stdout.write(f'  Updated: {stats["categories_updated"]}')

        self.stdout.write(f'\n{prefix}Scenarios:')
        self.stdout.write(f'  Created: {stats["scenarios_created"]}')
        self.stdout.write(f'  Updated: {stats["scenarios_updated"]}')

        self.stdout.write(f'\n{prefix}Test Runs:')
        self.stdout.write(f'  Created: {stats["test_runs_created"]}')
        self.stdout.write(f'  Updated: {stats["test_runs_updated"]}')

        total = sum(stats.values())

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\n[DRY RUN] {total} total operations would be performed'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n{total} total operations completed'))


class DryRunException(Exception):
    """Exception to trigger rollback in dry run mode."""

    pass
