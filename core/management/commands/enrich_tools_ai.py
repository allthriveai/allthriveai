"""
AI-powered tool and company metadata enrichment.

This command uses an LLM to analyze tools and companies in the YAML file
and enrich them with better topic assignments and metadata.

Usage:
    python manage.py enrich_tools_ai                    # Enrich all tools
    python manage.py enrich_tools_ai --dry-run          # Preview without saving
    python manage.py enrich_tools_ai --tools-only       # Only enrich tools
    python manage.py enrich_tools_ai --companies-only   # Only enrich companies
    python manage.py enrich_tools_ai --limit 5          # Process only 5 items
    python manage.py enrich_tools_ai --tool "Claude"    # Enrich specific tool
"""

import json
import time
from pathlib import Path

import yaml
from django.conf import settings
from django.core.management.base import BaseCommand

# Available topics for assignment (from seed_topics.py)
AVAILABLE_TOPICS = [
    # AI Tool topics
    'Vector Databases',
    'RAG',
    'LLM Providers',
    'Embedding Providers',
    'Authentication',
    'Image Generation',
    'Video Generation',
    'Voice AI',
    'Code Assistants',
    'Agent Frameworks',
    'Observability',
    'Orchestration',
    # Technology/infrastructure topics
    'Web Frameworks',
    'Databases',
    'DevOps',
    'Cloud Platforms',
    'Programming Languages',
    'Testing',
    # Project topics (less common for tools)
    'Chatbots & Conversation Projects',
    'Websites & Apps Built with AI',
    'Images, Design & Branding',
    'Video & Multimodal Media',
    'Workflows & Automation',
    'Productivity',
    'Developer & Coding Projects',
    'AI Agents & Multi-Tool Systems',
    'AI Models & Research',
    'Data & Analytics',
]

TOOL_ENRICHMENT_PROMPT = """Analyze this AI tool/technology and provide enriched metadata.

TOOL DATA:
Name: {name}
Tagline: {tagline}
Description: {description}
Category: {category}
Website: {website_url}
Current Tags: {tags}

AVAILABLE TOPICS (select 1-5 most relevant):
{topics_list}

Respond with a JSON object containing ONLY these fields:
{{
  "topic_slugs": ["slug-1", "slug-2"],
  "ideal_for": ["use case 1", "use case 2", "use case 3"],
  "not_ideal_for": ["anti-pattern 1", "anti-pattern 2"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "key_features": [
    {{"title": "Feature Name", "description": "Brief description"}},
    {{"title": "Feature Name 2", "description": "Brief description"}}
  ],
  "use_cases": [
    {{"title": "Use Case", "description": "How it's used", "example": "Concrete example"}}
  ]
}}

CRITICAL RULES:
1. topic_slugs MUST ONLY contain slugs from the AVAILABLE TOPICS list above. DO NOT invent new topics!
2. Valid slugs are exactly: vector-databases, rag, llm-providers, embedding-providers, authentication,
   image-generation, video-generation, voice-ai, code-assistants, agent-frameworks, observability,
   orchestration, web-frameworks, databases, devops, cloud-platforms, programming-languages, testing,
   chatbots-conversation-projects, websites-apps-built-with-ai, images-design-branding,
   video-multimodal-media, workflows-automation, productivity, developer-coding-projects,
   ai-agents-multi-tool-systems, ai-models-research, data-analytics
3. Select topics based on the tool's PRIMARY function, not tangential features
4. ideal_for: describe WHO should use this (startups, teams building RAG apps, etc.)
5. not_ideal_for should describe use cases where this tool is NOT the best choice
6. keywords should be SEO-friendly search terms users might use to find this tool
7. key_features should highlight 2-4 standout capabilities
8. use_cases should provide 1-3 concrete examples of how the tool is used

Only return valid JSON, no markdown formatting or explanation."""

COMPANY_ENRICHMENT_PROMPT = """Analyze this AI company and provide enriched metadata.

COMPANY DATA:
Name: {name}
Tagline: {tagline}
Description: {description}
Website: {website_url}
Founded: {founded_year}
Headquarters: {headquarters}

Respond with a JSON object containing ONLY these fields:
{{
  "focus_areas": ["area 1", "area 2", "area 3"],
  "target_customers": ["customer segment 1", "customer segment 2"],
  "key_differentiators": ["what makes them unique 1", "what makes them unique 2"]
}}

IMPORTANT RULES:
1. focus_areas should describe their main product/technology areas
2. target_customers should describe who uses their products
3. key_differentiators should highlight what sets them apart from competitors

Only return valid JSON, no markdown formatting or explanation."""


def slugify_topic(topic_name: str) -> str:
    """Convert topic name to slug format."""
    import re

    slug = topic_name.lower()
    slug = re.sub(r'[&,]', '', slug)  # Remove & and commas
    slug = re.sub(r'\s+', '-', slug)  # Replace spaces with dashes
    slug = re.sub(r'-+', '-', slug)  # Collapse multiple dashes
    slug = slug.strip('-')  # Remove leading/trailing dashes
    return slug


class Command(BaseCommand):
    help = 'Enrich tools and companies with AI-generated metadata'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without saving',
        )
        parser.add_argument(
            '--tools-only',
            action='store_true',
            help='Only enrich tools, skip companies',
        )
        parser.add_argument(
            '--companies-only',
            action='store_true',
            help='Only enrich companies, skip tools',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit number of items to process',
        )
        parser.add_argument(
            '--tool',
            type=str,
            default=None,
            help='Enrich a specific tool by name',
        )
        parser.add_argument(
            '--company',
            type=str,
            default=None,
            help='Enrich a specific company by name',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Skip items that already have topic_slugs',
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

        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        return base_dir / 'core' / 'fixtures' / 'tools.yaml'

    def load_yaml(self, yaml_path):
        """Load and parse YAML file."""
        if not yaml_path.exists():
            raise FileNotFoundError(f'YAML file not found: {yaml_path}')

        with open(yaml_path, encoding='utf-8') as f:
            return yaml.safe_load(f)

    def save_yaml(self, yaml_path, data):
        """Save data to YAML file with nice formatting."""
        with open(yaml_path, 'w', encoding='utf-8') as f:
            # Custom representer for multi-line strings
            def str_representer(dumper, data):
                if '\n' in data:
                    return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
                if len(data) > 80:
                    return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='>')
                return dumper.represent_scalar('tag:yaml.org,2002:str', data)

            yaml.add_representer(str, str_representer)
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False, width=100)

    def enrich_with_ai(self, prompt: str) -> dict | None:
        """Call AI to enrich metadata."""
        try:
            from openai import OpenAI

            api_key = getattr(settings, 'OPENAI_API_KEY', None)
            if not api_key:
                self.stderr.write(self.style.ERROR('OPENAI_API_KEY not configured'))
                return None

            client = OpenAI(api_key=api_key)

            response = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {
                        'role': 'system',
                        'content': 'You are a technical analyst specializing in AI tools and developer technologies. '
                        'Provide accurate, concise metadata for tool/company enrichment. '
                        'Always respond with valid JSON only.',
                    },
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.3,  # Lower temperature for consistency
                max_tokens=1000,
                response_format={'type': 'json_object'},
            )

            content = response.choices[0].message.content
            return json.loads(content)

        except json.JSONDecodeError as e:
            self.stderr.write(self.style.ERROR(f'Failed to parse AI response as JSON: {e}'))
            return None
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'AI enrichment failed: {e}'))
            return None

    def enrich_tool(self, tool: dict, dry_run: bool) -> bool:
        """Enrich a single tool with AI-generated metadata."""
        name = tool.get('name', 'Unknown')

        # Build valid slugs set for validation
        valid_slugs = {slugify_topic(t) for t in AVAILABLE_TOPICS}

        # Build topics list for the prompt
        topics_list = '\n'.join(f'- {t} (slug: {slugify_topic(t)})' for t in AVAILABLE_TOPICS)

        prompt = TOOL_ENRICHMENT_PROMPT.format(
            name=name,
            tagline=tool.get('tagline', ''),
            description=tool.get('description', ''),
            category=tool.get('category', ''),
            website_url=tool.get('website_url', ''),
            tags=tool.get('tags', []),
            topics_list=topics_list,
        )

        self.stdout.write(f'  Enriching tool: {name}...')

        enrichment = self.enrich_with_ai(prompt)
        if not enrichment:
            self.stdout.write(self.style.WARNING(f'    ! Failed to enrich {name}'))
            return False

        # Validate and filter topic slugs - only allow valid topics
        raw_topics = enrichment.get('topic_slugs', [])
        validated_topics = [t for t in raw_topics if t in valid_slugs]
        invalid_topics = [t for t in raw_topics if t not in valid_slugs]

        if invalid_topics:
            self.stdout.write(self.style.WARNING(f'    ⚠ Filtered invalid topics: {invalid_topics}'))

        if not validated_topics:
            self.stdout.write(self.style.WARNING(f'    ! No valid topics found for {name}'))
            return False

        enrichment['topic_slugs'] = validated_topics

        # Apply enrichment to tool
        if not dry_run:
            # Topic slugs for M2M relationship
            tool['topic_slugs'] = validated_topics

            # Ideal/not ideal for discovery
            if 'ideal_for' in enrichment:
                tool['ideal_for'] = enrichment['ideal_for']
            if 'not_ideal_for' in enrichment:
                tool['not_ideal_for'] = enrichment['not_ideal_for']

            # SEO keywords
            if 'keywords' in enrichment:
                tool['keywords'] = enrichment['keywords']

            # Key features and use cases
            if 'key_features' in enrichment:
                tool['key_features'] = enrichment['key_features']
            if 'use_cases' in enrichment:
                tool['use_cases'] = enrichment['use_cases']

        # Log what was enriched
        self.stdout.write(self.style.SUCCESS(f'    ✓ Topics: {validated_topics}'))
        self.stdout.write(f'      Ideal for: {enrichment.get("ideal_for", [])}')
        self.stdout.write(f'      Keywords: {enrichment.get("keywords", [])[:5]}...')

        return True

    def enrich_company(self, company: dict, dry_run: bool) -> bool:
        """Enrich a single company with AI-generated metadata."""
        name = company.get('name', 'Unknown')

        prompt = COMPANY_ENRICHMENT_PROMPT.format(
            name=name,
            tagline=company.get('tagline', ''),
            description=company.get('description', ''),
            website_url=company.get('website_url', ''),
            founded_year=company.get('founded_year', ''),
            headquarters=company.get('headquarters', ''),
        )

        self.stdout.write(f'  Enriching company: {name}...')

        enrichment = self.enrich_with_ai(prompt)
        if not enrichment:
            self.stdout.write(self.style.WARNING(f'    ! Failed to enrich {name}'))
            return False

        # Apply enrichment to company
        if not dry_run:
            if 'focus_areas' in enrichment:
                company['focus_areas'] = enrichment['focus_areas']
            if 'target_customers' in enrichment:
                company['target_customers'] = enrichment['target_customers']
            if 'key_differentiators' in enrichment:
                company['key_differentiators'] = enrichment['key_differentiators']

        # Log what was enriched
        self.stdout.write(self.style.SUCCESS(f'    ✓ Focus areas: {enrichment.get("focus_areas", [])}'))

        return True

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        tools_only = options['tools_only']
        companies_only = options['companies_only']
        limit = options['limit']
        specific_tool = options['tool']
        specific_company = options['company']
        skip_existing = options['skip_existing']

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
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No changes will be saved\n'))

        stats = {
            'tools_enriched': 0,
            'tools_failed': 0,
            'tools_skipped': 0,
            'companies_enriched': 0,
            'companies_failed': 0,
            'companies_skipped': 0,
        }

        # Enrich companies
        if not tools_only:
            self.stdout.write('\n' + '=' * 60)
            self.stdout.write(self.style.HTTP_INFO('ENRICHING COMPANIES'))
            self.stdout.write('=' * 60 + '\n')

            companies = data.get('companies', [])
            if specific_company:
                companies = [c for c in companies if c.get('name', '').lower() == specific_company.lower()]
                if not companies:
                    self.stdout.write(self.style.WARNING(f'Company not found: {specific_company}'))

            if limit:
                companies = companies[:limit]

            for company in companies:
                # Rate limiting
                time.sleep(0.5)

                if self.enrich_company(company, dry_run):
                    stats['companies_enriched'] += 1
                else:
                    stats['companies_failed'] += 1

        # Enrich tools
        if not companies_only:
            self.stdout.write('\n' + '=' * 60)
            self.stdout.write(self.style.HTTP_INFO('ENRICHING TOOLS'))
            self.stdout.write('=' * 60 + '\n')

            tools = data.get('tools', [])
            if specific_tool:
                tools = [t for t in tools if t.get('name', '').lower() == specific_tool.lower()]
                if not tools:
                    self.stdout.write(self.style.WARNING(f'Tool not found: {specific_tool}'))

            if limit:
                tools = tools[:limit]

            for tool in tools:
                # Skip if already has topics and skip_existing is set
                if skip_existing and tool.get('topic_slugs'):
                    stats['tools_skipped'] += 1
                    self.stdout.write(f'  Skipping {tool.get("name")} (already has topics)')
                    continue

                # Rate limiting
                time.sleep(0.5)

                if self.enrich_tool(tool, dry_run):
                    stats['tools_enriched'] += 1
                else:
                    stats['tools_failed'] += 1

        # Save changes
        if not dry_run:
            self.save_yaml(yaml_path, data)
            self.stdout.write(self.style.SUCCESS(f'\n✓ Saved changes to {yaml_path}'))

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.HTTP_INFO('SUMMARY'))
        self.stdout.write('=' * 60)

        prefix = '[DRY RUN] Would have ' if dry_run else ''

        if not tools_only:
            self.stdout.write(f'\n{prefix}Companies:')
            self.stdout.write(f'  Enriched: {stats["companies_enriched"]}')
            self.stdout.write(f'  Failed: {stats["companies_failed"]}')

        if not companies_only:
            self.stdout.write(f'\n{prefix}Tools:')
            self.stdout.write(f'  Enriched: {stats["tools_enriched"]}')
            self.stdout.write(f'  Skipped: {stats["tools_skipped"]}')
            self.stdout.write(f'  Failed: {stats["tools_failed"]}')

        total = stats['tools_enriched'] + stats['companies_enriched']
        if dry_run:
            self.stdout.write(self.style.WARNING(f'\n[DRY RUN] {total} items would be enriched'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n✓ {total} items enriched'))
            self.stdout.write(
                self.style.NOTICE('\nRun "python manage.py seed_tools" to load the enriched data into the database.')
            )
