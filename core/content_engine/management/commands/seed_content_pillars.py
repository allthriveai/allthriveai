from django.core.management.base import BaseCommand

from core.taxonomy.models import Taxonomy


class Command(BaseCommand):
    help = 'Seed content pillars for the Content Engine'

    def handle(self, *args, **options):
        pillars_data = [
            {
                'name': 'Educational',
                'description': (
                    'Teaching content that helps your audience learn something new. '
                    'Tutorials, how-tos, tips, and explainers.'
                ),
            },
            {
                'name': 'Behind-the-scenes',
                'description': (
                    'Authentic glimpses into your process, workspace, or daily life. '
                    'Builds connection and humanizes your brand.'
                ),
            },
            {
                'name': 'Hot Takes',
                'description': (
                    'Bold opinions and perspectives on industry trends. '
                    'Sparks discussion and positions you as a thought leader.'
                ),
            },
            {
                'name': 'Engagement',
                'description': (
                    'Content designed to start conversations. '
                    'Questions, polls, challenges, and community-building posts.'
                ),
            },
            {
                'name': 'Authority',
                'description': (
                    'Showcasing expertise through case studies, results, testimonials, and credentials. '
                    'Builds trust and credibility.'
                ),
            },
            {
                'name': 'Personal',
                'description': (
                    'Stories about your journey, struggles, wins, and lessons learned. '
                    'Creates emotional connection with your audience.'
                ),
            },
            {
                'name': 'Promotional',
                'description': (
                    'Direct promotion of your products, services, or offerings. '
                    'Use sparingly and strategically.'
                ),
            },
        ]

        created_count = 0
        skipped_count = 0

        for data in pillars_data:
            taxonomy, created = Taxonomy.objects.get_or_create(
                name=data['name'],
                taxonomy_type=Taxonomy.TaxonomyType.CONTENT_PILLAR,
                defaults={
                    'description': data['description'],
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created pillar: {taxonomy.name}'))
            else:
                skipped_count += 1
                self.stdout.write(f'Skipped pillar (already exists): {taxonomy.name}')

        self.stdout.write(
            self.style.SUCCESS(f'\nSeeding complete! Created: {created_count}, Skipped: {skipped_count}')
        )
