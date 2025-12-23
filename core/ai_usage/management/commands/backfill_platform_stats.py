"""Backfill PlatformDailyStats for historical data."""

from datetime import date, timedelta

from django.core.management.base import BaseCommand

from core.ai_usage.tasks import aggregate_platform_daily_stats


class Command(BaseCommand):
    help = 'Backfill PlatformDailyStats for historical platform analytics'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days to backfill (default: 90)',
        )
        parser.add_argument(
            '--start-date',
            type=str,
            help='Start date in YYYY-MM-DD format (overrides --days)',
        )
        parser.add_argument(
            '--end-date',
            type=str,
            help='End date in YYYY-MM-DD format (default: yesterday)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be processed without making changes',
        )
        parser.add_argument(
            '--today',
            action='store_true',
            help='Also include today (normally skips since data is incomplete)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        include_today = options['today']

        # Determine end date (default: yesterday, unless --today is set)
        if options['end_date']:
            end_date = date.fromisoformat(options['end_date'])
        elif include_today:
            end_date = date.today()
        else:
            end_date = date.today() - timedelta(days=1)

        # Determine start date
        if options['start_date']:
            start_date = date.fromisoformat(options['start_date'])
        else:
            start_date = end_date - timedelta(days=options['days'] - 1)

        # Validate date range
        if start_date > end_date:
            self.stderr.write(self.style.ERROR('Start date cannot be after end date'))
            return

        total_days = (end_date - start_date).days + 1

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('  Backfilling Platform Daily Stats'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'Date range: {start_date} to {end_date} ({total_days} days)')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be made\n'))

        processed = 0
        errors = 0

        # Process each day from oldest to newest
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.isoformat()

            if dry_run:
                self.stdout.write(f'  Would process {date_str}')
            else:
                try:
                    # Call the task synchronously
                    result = aggregate_platform_daily_stats(date_str)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  ✅ {date_str}: {result.get("total_users", 0)} users, '
                            f'${result.get("total_ai_cost", 0):.2f} AI cost'
                        )
                    )
                    processed += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f'  ❌ {date_str}: {e}'))
                    errors += 1

            current_date += timedelta(days=1)

        # Summary
        self.stdout.write('')
        self.stdout.write('=' * 60)
        if dry_run:
            self.stdout.write(self.style.WARNING(f'Dry run complete: would process {total_days} days'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Backfill complete: processed {processed} days'))
            if errors:
                self.stdout.write(self.style.ERROR(f'Errors: {errors} days failed'))
