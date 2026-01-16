"""Seed listing_type taxonomy for The Collective."""

from django.core.management.base import BaseCommand

from core.taxonomy.models import Taxonomy


class Command(BaseCommand):
    help = 'Seed listing_type taxonomy for Asks and Offers'

    def handle(self, *args, **options):
        # Categories with their subtypes
        # Structure: { category: [subtypes] }
        listing_type_hierarchy = {
            'project': {
                'name': 'Project',
                'description': 'Apps, tools, agents, things you built or want to discover',
                'subtypes': [
                    {'name': 'App', 'slug': 'app', 'description': 'App or tool you built'},
                    {'name': 'AI Agent', 'slug': 'agent', 'description': 'AI agent or assistant'},
                    {
                        'name': 'MCP Server',
                        'slug': 'listing-mcp-server',
                        'description': 'Model Context Protocol server',
                    },
                    {'name': 'Side Project', 'slug': 'side-project', 'description': 'Side project or experiment'},
                ],
            },
            'content': {
                'name': 'Content',
                'description': 'Articles, courses, newsletters, resources',
                'subtypes': [
                    {'name': 'Article', 'slug': 'article', 'description': 'Blog post, essay, or written content'},
                    {'name': 'Newsletter', 'slug': 'newsletter', 'description': 'Newsletter or Substack'},
                    {'name': 'Course', 'slug': 'course', 'description': 'Course or tutorial'},
                    {'name': 'Download', 'slug': 'download', 'description': 'Template, resource, or download'},
                    {'name': 'Recommendation', 'slug': 'recommendation', 'description': 'Something I love'},
                ],
            },
            'services': {
                'name': 'Services',
                'description': 'Consulting, freelance work, professional help',
                'subtypes': [
                    {'name': 'Consulting', 'slug': 'listing-consulting', 'description': 'Professional consulting'},
                    {'name': 'Freelance', 'slug': 'listing-freelance', 'description': 'Freelance or contract work'},
                    {'name': 'Hiring', 'slug': 'listing-hiring', 'description': 'Job posting or looking for work'},
                ],
            },
            'mentorship': {
                'name': 'Mentorship',
                'description': 'Guidance, advice, learning together',
                'subtypes': [
                    {'name': 'Mentor', 'slug': 'listing-mentor', 'description': 'Mentorship or advising'},
                    {
                        'name': 'Accountability',
                        'slug': 'listing-accountability',
                        'description': 'Accountability partner',
                    },
                    {'name': 'Learning', 'slug': 'listing-learning', 'description': 'Learning together'},
                ],
            },
            'listing-feedback': {
                'name': 'Feedback',
                'description': 'Beta testing, reviews, critiques',
                'subtypes': [
                    {'name': 'Beta Testing', 'slug': 'listing-beta-testing', 'description': 'Beta testers wanted'},
                    {
                        'name': 'Code Review',
                        'slug': 'listing-code-review',
                        'description': 'Code review or technical feedback',
                    },
                    {
                        'name': 'Design Critique',
                        'slug': 'listing-design-critique',
                        'description': 'Design or UX feedback',
                    },
                    {
                        'name': 'General Feedback',
                        'slug': 'listing-general-feedback',
                        'description': 'General feedback on anything',
                    },
                ],
            },
            'growth': {
                'name': 'Growth',
                'description': 'Promotion, audience building, introductions',
                'subtypes': [
                    {'name': 'Promotion', 'slug': 'listing-promotion', 'description': 'Shoutout or promotion'},
                    {'name': 'Introduction', 'slug': 'listing-introduction', 'description': 'Intro to someone'},
                    {
                        'name': 'Collaboration',
                        'slug': 'listing-collaboration',
                        'description': 'Collaboration or partnership',
                    },
                ],
            },
        }

        created_count = 0
        updated_count = 0

        # First, deactivate all existing listing_type taxonomies
        Taxonomy.objects.filter(taxonomy_type='listing_type').update(is_active=False)

        for category_slug, category_data in listing_type_hierarchy.items():
            # Create/update the category (parent)
            category, created = Taxonomy.objects.update_or_create(
                slug=category_slug,
                taxonomy_type='listing_type',
                defaults={
                    'name': category_data['name'],
                    'description': category_data['description'],
                    'is_active': True,
                    'parent': None,  # Categories have no parent
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created category: {category.name}'))
            else:
                updated_count += 1
                self.stdout.write(f'Updated category: {category.name}')

            # Create/update subtypes
            for subtype_data in category_data['subtypes']:
                subtype, created = Taxonomy.objects.update_or_create(
                    slug=subtype_data['slug'],
                    taxonomy_type='listing_type',
                    defaults={
                        'name': subtype_data['name'],
                        'description': subtype_data['description'],
                        'is_active': True,
                        'parent': category,  # Link to parent category
                    },
                )

                if created:
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f'  Created subtype: {subtype.name}'))
                else:
                    updated_count += 1
                    self.stdout.write(f'  Updated subtype: {subtype.name}')

        self.stdout.write(self.style.SUCCESS(f'\nSeeding complete! Created {created_count}, Updated {updated_count}'))
