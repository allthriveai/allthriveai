"""Backfill EngagementDailyStats for historical data."""

from datetime import date, timedelta

from django.core.management.base import BaseCommand

from core.ai_usage.tasks import aggregate_engagement_daily_stats


class Command(BaseCommand):
    help = 'Backfill EngagementDailyStats for historical engagement data'

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

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Determine end date (default: yesterday)
        if options['end_date']:
            end_date = date.fromisoformat(options['end_date'])
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

        self.stdout.write(f'Backfilling engagement stats from {start_date} to {end_date} ' f'({total_days} days)')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be made'))

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
                    aggregate_engagement_daily_stats(date_str)
                    self.stdout.write(self.style.SUCCESS(f'  Processed {date_str}'))
                    processed += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f'  Failed {date_str}: {e}'))
                    errors += 1

            current_date += timedelta(days=1)

        # Summary
        self.stdout.write('')
        if dry_run:
            self.stdout.write(self.style.WARNING(f'Dry run complete: would process {total_days} days'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Backfill complete: processed {processed} days'))
            if errors:
                self.stdout.write(self.style.ERROR(f'Errors: {errors} days failed'))
