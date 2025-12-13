"""
Management command to refresh "What's New" sections for tools.

Uses web search and AI to find noteworthy updates for tools,
only updating when there's genuinely new content.

Usage:
    python manage.py refresh_tool_news              # Refresh all tools
    python manage.py refresh_tool_news --tool chatgpt  # Single tool
    python manage.py refresh_tool_news --dry-run   # Preview changes
    python manage.py refresh_tool_news --limit 10  # Process N tools
"""

import json
import logging
from datetime import date, datetime, timedelta

from django.core.management.base import BaseCommand

from core.tools.models import Tool
from services.ai import AIProvider

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Refresh 'What's New' sections for tools using web search and AI"

    def add_arguments(self, parser):
        parser.add_argument(
            '--tool',
            type=str,
            help='Specific tool slug to refresh (e.g., chatgpt)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Limit number of tools to process (0 = all)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without saving',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update even if recent news exists',
        )
        parser.add_argument(
            '--skip-empty-overview',
            action='store_true',
            help='Also update empty overview fields',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        tool_slug = options.get('tool')
        limit = options['limit']
        update_overview = options['skip_empty_overview']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be saved\n'))

        # Get tools to process
        if tool_slug:
            tools = Tool.objects.filter(slug=tool_slug, is_active=True)
            if not tools.exists():
                self.stderr.write(self.style.ERROR(f'Tool "{tool_slug}" not found'))
                return
        else:
            tools = Tool.objects.filter(is_active=True).order_by('name')
            if limit > 0:
                tools = tools[:limit]

        total = tools.count()
        self.stdout.write(f'Processing {total} tool(s)...\n')

        updated = 0
        skipped = 0
        errors = 0

        for i, tool in enumerate(tools, 1):
            self.stdout.write(f'\n[{i}/{total}] {tool.name}')

            try:
                result = self._process_tool(tool, dry_run, force, update_overview)
                if result == 'updated':
                    updated += 1
                elif result == 'skipped':
                    skipped += 1
                else:
                    errors += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Error: {e}'))
                logger.exception(f'Error processing tool {tool.slug}')
                errors += 1

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(f'Updated: {updated}'))
        self.stdout.write(f'Skipped: {skipped}')
        if errors:
            self.stdout.write(self.style.ERROR(f'Errors: {errors}'))

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDry run complete - no changes saved'))

    def _process_tool(self, tool: Tool, dry_run: bool, force: bool, update_overview: bool) -> str:
        """Process a single tool. Returns 'updated', 'skipped', or 'error'."""
        # Check if we should skip based on recent updates
        latest_date = self._get_latest_news_date(tool)
        days_since_update = (date.today() - latest_date).days if latest_date else 365

        if not force and days_since_update < 14:
            self.stdout.write(f'  Skipping - last update {days_since_update} days ago')
            return 'skipped'

        # Search for recent news
        self.stdout.write('  Searching for updates...')
        news_data = self._search_for_news(tool, latest_date)

        if not news_data or not news_data.get('updates'):
            self.stdout.write(self.style.WARNING('  No noteworthy updates found'))
            return 'skipped'

        # Process updates
        new_updates = news_data.get('updates', [])
        new_overview = news_data.get('overview') if update_overview and not tool.overview else None

        if not new_updates and not new_overview:
            self.stdout.write(self.style.WARNING('  Nothing to update'))
            return 'skipped'

        # Show what we found
        for update in new_updates:
            self.stdout.write(
                self.style.SUCCESS(f"  + [{update.get('date', 'N/A')}] {update.get('title', 'Untitled')}")
            )

        if new_overview:
            self.stdout.write(self.style.SUCCESS(f'  + New overview: {new_overview[:60]}...'))

        if dry_run:
            return 'updated'

        # Merge updates (prepend new, keep max 5)
        existing_updates = tool.whats_new or []
        merged_updates = self._merge_updates(new_updates, existing_updates)

        # Save
        tool.whats_new = merged_updates
        if new_overview:
            tool.overview = new_overview
        tool.save(update_fields=['whats_new'] + (['overview'] if new_overview else []))

        self.stdout.write(self.style.SUCCESS(f'  Saved {len(new_updates)} new update(s)'))
        return 'updated'

    def _get_latest_news_date(self, tool: Tool) -> date | None:
        """Get the date of the most recent whats_new entry."""
        if not tool.whats_new:
            return None

        latest = None
        for item in tool.whats_new:
            date_str = item.get('date')
            if date_str:
                try:
                    item_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    if latest is None or item_date > latest:
                        latest = item_date
                except ValueError:
                    continue
        return latest

    def _search_for_news(self, tool: Tool, latest_date: date | None) -> dict | None:
        """Search for recent news and use AI to extract noteworthy updates."""
        try:
            # Build context for AI
            existing_news = tool.whats_new or []
            existing_titles = [item.get('title', '').lower() for item in existing_news]

            cutoff_date = latest_date or (date.today() - timedelta(days=90))
            cutoff_str = cutoff_date.strftime('%Y-%m-%d')

            # Use AI to search and evaluate
            ai = AIProvider(provider='openai')

            prompt = f"""Find recent noteworthy updates for the AI tool "{tool.name}".

Tool Info:
- Website: {tool.website_url}
- Description: {tool.description[:300] if tool.description else 'N/A'}
- Current "What's New" titles: {existing_titles[:3] if existing_titles else 'None'}

Instructions:
1. Search your knowledge for significant updates to {tool.name} after {cutoff_str}
2. Only include MAJOR updates: new features, significant improvements, major releases
3. Do NOT include: minor bug fixes, routine maintenance, marketing announcements
4. Do NOT duplicate existing titles
5. If nothing noteworthy, return empty updates array

Return JSON only:
{{
    "updates": [
        {{
            "date": "YYYY-MM-DD",
            "title": "Short title (max 60 chars)",
            "description": "One sentence description of the update"
        }}
    ],
    "overview": "2-3 sentence overview of what {tool.name} does (only if you can improve on existing)"
}}

Return maximum 2 updates. Return empty updates array if nothing noteworthy."""

            response = ai.complete(
                prompt=prompt,
                system_message='You are a tech news analyst. Return valid JSON only, no markdown.',
                max_tokens=800,
                temperature=0.3,
            )

            if not response:
                return None

            # Parse response
            response_text = response.strip()
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]

            return json.loads(response_text)

        except json.JSONDecodeError as e:
            logger.warning(f'Failed to parse AI response for {tool.slug}: {e}')
            return None
        except Exception as e:
            logger.warning(f'Error searching for news for {tool.slug}: {e}')
            return None

    def _merge_updates(self, new_updates: list, existing_updates: list, max_items: int = 5) -> list:
        """Merge new updates with existing, avoiding duplicates."""
        # Normalize existing titles for comparison
        existing_titles = {item.get('title', '').lower().strip() for item in existing_updates}

        # Filter out duplicates from new updates
        unique_new = []
        for update in new_updates:
            title = update.get('title', '').lower().strip()
            if title and title not in existing_titles:
                unique_new.append(update)
                existing_titles.add(title)

        # Prepend new updates, then add existing
        merged = unique_new + existing_updates

        # Sort by date (newest first)
        def get_date(item):
            date_str = item.get('date', '')
            try:
                return datetime.strptime(date_str, '%Y-%m-%d')
            except ValueError:
                return datetime.min

        merged.sort(key=get_date, reverse=True)

        # Keep only max items
        return merged[:max_items]
