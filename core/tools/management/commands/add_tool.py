"""
Management command to add a new tool to the directory.

Usage:
    python manage.py add_tool --website https://example.com --logo /logos/example-logo.png

Or interactively:
    python manage.py add_tool
"""

import json
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from core.tools.models import Tool


class Command(BaseCommand):
    help = 'Add a new tool to the directory with AI-generated content'

    def add_arguments(self, parser):
        parser.add_argument('--website', type=str, help='Website URL for the tool')
        parser.add_argument('--logo', type=str, help='Logo path (e.g., /logos/tool-logo.png)')
        parser.add_argument('--name', type=str, help='Tool name (optional, will be extracted from website)')
        parser.add_argument('--no-ai', action='store_true', help='Skip AI content generation')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be created without saving')

    def handle(self, *args, **options):
        # Get website URL
        website = options.get('website')
        if not website:
            website = input('Enter the tool website URL: ').strip()

        if not website:
            self.stderr.write(self.style.ERROR('Website URL is required'))
            return

        # Ensure https
        if not website.startswith('http'):
            website = f'https://{website}'

        # Get logo path
        logo = options.get('logo')
        if not logo:
            logo = input('Enter the logo path (e.g., /logos/tool-logo.png): ').strip()

        # Fetch website content
        self.stdout.write(f'Fetching content from {website}...')
        try:
            page_content = self.fetch_website(website)
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to fetch website: {e}'))
            return

        # Extract or get tool name
        name = options.get('name')
        if not name:
            name = self.extract_name(page_content, website)
            confirm = input(f'Detected tool name: "{name}". Press Enter to confirm or type a new name: ').strip()
            if confirm:
                name = confirm

        slug = slugify(name)

        # Check if tool already exists
        if Tool.objects.filter(slug=slug).exists():
            self.stderr.write(self.style.ERROR(f'Tool with slug "{slug}" already exists'))
            return

        # Generate content using AI or manual input
        if options.get('no_ai'):
            tool_data = self.get_manual_input(name, website, logo)
        else:
            self.stdout.write('Generating content with AI...')
            tool_data = self.generate_ai_content(name, website, logo, page_content)

        # Show preview
        self.stdout.write(self.style.SUCCESS('\n=== Tool Preview ==='))
        self.stdout.write(f"Name: {tool_data['name']}")
        self.stdout.write(f'Slug: {slug}')
        self.stdout.write(f"Website: {tool_data['website_url']}")
        self.stdout.write(f"Logo: {tool_data['logo_url']}")
        self.stdout.write(f"Tagline: {tool_data['tagline']}")
        self.stdout.write(f"\nDescription:\n{tool_data['description']}")
        self.stdout.write(f"\nOverview:\n{tool_data['overview']}")
        self.stdout.write('\nUsage Tips:')
        for tip in tool_data['usage_tips']:
            self.stdout.write(f'  - {tip}')
        self.stdout.write("\nWhat's New:")
        for item in tool_data['whats_new']:
            self.stdout.write(f"  - [{item['date']}] {item['title']}: {item['description']}")

        if options.get('dry_run'):
            self.stdout.write(self.style.WARNING('\nDry run - not saving'))
            return

        # Confirm
        confirm = input('\nSave this tool? [y/N]: ').strip().lower()
        if confirm != 'y':
            self.stdout.write('Cancelled')
            return

        # Create the tool
        tool = Tool.objects.create(
            name=tool_data['name'],
            slug=slug,
            tagline=tool_data['tagline'],
            description=tool_data['description'],
            overview=tool_data['overview'],
            tool_type='ai_tool',
            category=tool_data.get('category', 'other'),
            website_url=tool_data['website_url'],
            logo_url=tool_data['logo_url'],
            pricing_model=tool_data.get('pricing_model', 'freemium'),
            has_free_tier=tool_data.get('has_free_tier', True),
            usage_tips=tool_data['usage_tips'],
            whats_new=tool_data['whats_new'],
            is_active=True,
        )

        self.stdout.write(self.style.SUCCESS(f'\nTool "{name}" created successfully!'))
        self.stdout.write(f'View at: /tools/{slug}')

        # Save to YAML
        yaml_path = self.save_to_yaml(tool)
        self.stdout.write(self.style.SUCCESS(f'Saved to: {yaml_path}'))

    def fetch_website(self, url: str) -> str:
        """Fetch and parse website content."""
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove scripts and styles
        for element in soup(['script', 'style', 'nav', 'footer', 'header']):
            element.decompose()

        # Get text content
        text = soup.get_text(separator='\n', strip=True)

        # Get meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        meta_content = meta_desc.get('content', '') if meta_desc else ''

        # Get title
        title = soup.find('title')
        title_text = title.get_text() if title else ''

        return f'Title: {title_text}\nMeta: {meta_content}\n\nContent:\n{text[:5000]}'

    def extract_name(self, content: str, url: str) -> str:
        """Extract tool name from content or URL."""
        # Try to get from title
        lines = content.split('\n')
        for line in lines:
            if line.startswith('Title:'):
                title = line.replace('Title:', '').strip()
                # Clean up common suffixes
                for suffix in [' - ', ' | ', ' – ', ' — ']:
                    if suffix in title:
                        title = title.split(suffix)[0].strip()
                if title:
                    return title

        # Fall back to domain name
        from urllib.parse import urlparse

        domain = urlparse(url).netloc
        name = domain.replace('www.', '').split('.')[0]
        return name.title()

    def generate_ai_content(self, name: str, website: str, logo: str, page_content: str) -> dict:
        """Generate tool content using Claude API."""
        try:
            import anthropic

            client = anthropic.Anthropic()

            prompt = f"""Based on this website content for "{name}", generate tool directory content.

Website: {website}
Page Content:
{page_content[:4000]}

Generate a JSON response with these fields:
- tagline: Short tagline (under 100 chars)
- description: 1-2 sentence description of what the tool does
- overview: 2-3 sentence overview for the Description section (no markdown, plain text)
- category: One of: chat, code, image, video, audio, writing, research, productivity, data, design, other
- pricing_model: One of: free, freemium, subscription, pay_per_use, enterprise, open_source
- has_free_tier: true/false
- usage_tips: Array of 5 practical tips for using the tool
- whats_new: Array of 2 recent updates with date (YYYY-MM-DD), title, and description

Respond ONLY with valid JSON, no markdown or explanation."""

            response = client.messages.create(
                model='claude-sonnet-4-20250514', max_tokens=1500, messages=[{'role': 'user', 'content': prompt}]
            )

            # Parse response
            response_text = response.content[0].text.strip()
            # Clean up potential markdown formatting
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]

            data = json.loads(response_text)
            data['name'] = name
            data['website_url'] = website
            data['logo_url'] = logo

            return data

        except Exception as e:
            self.stderr.write(self.style.WARNING(f'AI generation failed: {e}'))
            self.stdout.write('Falling back to manual input...')
            return self.get_manual_input(name, website, logo)

    def get_manual_input(self, name: str, website: str, logo: str) -> dict:
        """Get tool information manually."""
        self.stdout.write('\nEnter tool information manually:')

        tagline = input('Tagline (short description): ').strip()
        description = input('Description (1-2 sentences): ').strip()
        overview = input('Overview (2-3 sentences for Description section): ').strip()

        self.stdout.write(
            '\nCategories: chat, code, image, video, audio, writing, research, productivity, data, design, other'
        )
        category = input('Category: ').strip() or 'other'

        self.stdout.write('\nPricing: free, freemium, subscription, pay_per_use, enterprise, open_source')
        pricing = input('Pricing model: ').strip() or 'freemium'

        has_free = input('Has free tier? [Y/n]: ').strip().lower() != 'n'

        self.stdout.write('\nEnter 5 usage tips (one per line, empty to finish):')
        tips = []
        for i in range(5):
            tip = input(f'  Tip {i+1}: ').strip()
            if tip:
                tips.append(tip)

        self.stdout.write('\nEnter 2 "What\'s New" items:')
        whats_new = []
        for i in range(2):
            title = input(f'  Update {i+1} title: ').strip()
            if title:
                desc = input(f'  Update {i+1} description: ').strip()
                whats_new.append({'date': str(date.today()), 'title': title, 'description': desc})

        return {
            'name': name,
            'website_url': website,
            'logo_url': logo,
            'tagline': tagline,
            'description': description,
            'overview': overview,
            'category': category,
            'pricing_model': pricing,
            'has_free_tier': has_free,
            'usage_tips': tips,
            'whats_new': whats_new,
        }

    def save_to_yaml(self, tool: Tool) -> str:
        """Export all tools to YAML file for deployment."""
        from django.core.management import call_command

        yaml_path = Path(settings.BASE_DIR) / 'core' / 'fixtures' / 'tools.yaml'

        # Call export_tools to update the YAML file with all tools
        call_command('export_tools')

        return str(yaml_path)
