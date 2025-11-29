from django.core.management.base import BaseCommand

from core.taxonomy.models import Taxonomy


class Command(BaseCommand):
    help = 'Seed project categories (synced with frontend/src/config/topics.ts)'

    def handle(self, *args, **options):
        """Create predefined categories for project filtering."""
        # Cleanup old categories
        try:
            categories_to_remove = ['Images, Design & Branding', 'Video & Multimodal Media']
            for cat_name in categories_to_remove:
                old_cat = Taxonomy.objects.filter(name=cat_name).first()
                if old_cat:
                    self.stdout.write(self.style.WARNING(f'Removing deprecated category: {old_cat.name}'))
                    old_cat.delete()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error cleaning up old categories: {e}'))

        categories_data = [
            {
                'name': 'Chatbots & Conversation',
                'slug': 'chatbots-conversation',
                'description': (
                    'Chat and text-based experiences: Q&A bots, ' 'conversational guides, coaching/mentor bots.'
                ),
                'color': 'blue',
            },
            {
                'name': 'Websites & Apps',
                'slug': 'websites-apps',
                'description': 'Sites and apps where AI helps power the experience: landing pages, tools, dashboards.',
                'color': 'cyan',
            },
            {
                'name': 'Images & Video',
                'slug': 'images-video',
                'description': 'Visual content: AI-generated images, videos, illustrations, and animations.',
                'color': 'purple',
            },
            {
                'name': 'Design (Mockups & UI)',
                'slug': 'design-ui',
                'description': (
                    'UI/UX design work: mockups, prototypes, brand systems, and interface concepts (e.g. Figma).'
                ),
                'color': 'pink',
            },
            {
                'name': 'Audio & Multimodal',
                'slug': 'audio-multimodal',
                'description': 'Audio, music, speech synthesis, and complex multimodal experiences.',
                'color': 'red',
            },
            {
                'name': 'Podcasts & Education',
                'slug': 'podcasts-education',
                'description': 'AI-related podcasts, interviews, lecture series, tutorials, and learning journeys.',
                'color': 'amber',
            },
            {
                'name': 'Games & Interactive',
                'slug': 'games-interactive',
                'description': 'Playable and interactive projects: story games, simulations, quizzes, challenges.',
                'color': 'pink',
            },
            {
                'name': 'Workflows & Automation',
                'slug': 'workflows-automation',
                'description': 'Multi-step flows: n8n/Zapier-style pipelines and automations with AI.',
                'color': 'indigo',
            },
            {
                'name': 'Productivity',
                'slug': 'productivity',
                'description': 'Systems that help you get things done: task boards, planning spaces, AI-powered notes.',
                'color': 'emerald',
            },
            {
                'name': 'Developer & Coding',
                'slug': 'developer-coding',
                'description': 'Code-centric work: dev tools, libraries, CLIs, coding helpers, infra projects.',
                'color': 'slate',
            },
            {
                'name': 'Prompt Collections & Templates',
                'slug': 'prompts-templates',
                'description': 'Reusable prompts and frameworks: prompt packs, templates, scripts, prompt systems.',
                'color': 'teal',
            },
            {
                'name': 'Thought Experiments',
                'slug': 'thought-experiments',
                'description': 'Creative outlets, ideas, and AI exploration.',
                'color': 'fuchsia',
            },
            {
                'name': 'Wellness & Personal Growth',
                'slug': 'wellness-growth',
                'description': 'Inner growth and projects for wellbeing.',
                'color': 'lime',
            },
            {
                'name': 'AI Agents & Multi-Tool Systems',
                'slug': 'ai-agents-multitool',
                'description': 'AI agents that reason, call tools, and coordinate multi-step work.',
                'color': 'violet',
            },
            {
                'name': 'AI Models & Research',
                'slug': 'ai-models-research',
                'description': 'Custom models, fine-tuning, research, and ML experiments.',
                'color': 'orange',
            },
            {
                'name': 'Data & Analytics',
                'slug': 'data-analytics',
                'description': 'Data visualization, analytics dashboards, and insights projects.',
                'color': 'yellow',
            },
        ]

        created_count = 0
        updated_count = 0

        for data in categories_data:
            taxonomy, created = Taxonomy.objects.get_or_create(
                name=data['name'],
                defaults={
                    'taxonomy_type': Taxonomy.TaxonomyType.CATEGORY,
                    'description': data['description'],
                    'color': data['color'],
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✅ Created category: {taxonomy.name}'))
            else:
                # Update existing category
                taxonomy.taxonomy_type = Taxonomy.TaxonomyType.CATEGORY
                taxonomy.description = data['description']
                taxonomy.color = data['color']
                taxonomy.is_active = True
                taxonomy.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'🔄 Updated category: {taxonomy.name}'))

        self.stdout.write(
            self.style.SUCCESS(f'\n✅ Seeding complete! Created {created_count}, Updated {updated_count}')
        )
