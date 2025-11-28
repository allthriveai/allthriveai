from django.core.management.base import BaseCommand

from core.taxonomy.models import Taxonomy


class Command(BaseCommand):
    help = 'Seed topics from frontend/src/config/topics.ts into Taxonomy'

    def handle(self, *args, **options):
        # Topics synced with frontend/src/config/topics.ts
        topics_data = [
            {
                'name': 'Chatbots & Conversation Projects',
                'description': (
                    'Chat and text-based experiences: Q&A bots, conversational guides, ' 'coaching/mentor bots.'
                ),
                'color': 'blue',
            },
            {
                'name': 'Websites & Apps Built with AI',
                'description': (
                    'Sites and apps where AI helps power the experience: landing pages, tools, ' 'dashboards.'
                ),
                'color': 'cyan',
            },
            {
                'name': 'Images, Design & Branding',
                'description': 'Visual work with AI: illustrations, brand systems, social graphics, UI mockups.',
                'color': 'purple',
            },
            {
                'name': 'Video & Multimodal Media',
                'description': 'AI-generated or AI-edited videos, animations, and multimodal content.',
                'color': 'red',
            },
            {
                'name': 'Podcasts & Educational Series',
                'description': 'AI-related podcasts, interviews, lecture series, tutorials, and learning journeys.',
                'color': 'amber',
            },
            {
                'name': 'Games & Interactive Experiences',
                'description': 'Playable and interactive projects: story games, simulations, quizzes, challenges.',
                'color': 'pink',
            },
            {
                'name': 'Workflows & Automation',
                'description': 'Multi-step flows: n8n/Zapier-style pipelines and "when X then Y" automations with AI.',
                'color': 'indigo',
            },
            {
                'name': 'Productivity',
                'description': 'Systems that help you get things done: task boards, planning spaces, AI-powered notes.',
                'color': 'emerald',
            },
            {
                'name': 'Developer & Coding Projects',
                'description': 'Code-centric work: dev tools, libraries, CLIs, coding helpers, infra projects.',
                'color': 'slate',
            },
            {
                'name': 'Prompt Collections & Templates',
                'description': 'Reusable prompts and frameworks: prompt packs, templates, scripts, prompt systems.',
                'color': 'teal',
            },
            {
                'name': 'Thought Experiments & Concept Pieces',
                'description': 'Creative outlets, ideas, and AI exploration.',
                'color': 'fuchsia',
            },
            {
                'name': 'Wellness & Personal Growth',
                'description': 'Inner growth and projects for wellbeing.',
                'color': 'lime',
            },
            {
                'name': 'AI Agents & Multi-Tool Systems',
                'description': 'AI agents and systems that reason, call tools, and coordinate multi-step work.',
                'color': 'violet',
            },
            {
                'name': 'AI Models & Research',
                'description': 'Custom models, fine-tuning, research, and ML experiments.',
                'color': 'orange',
            },
            {
                'name': 'Data & Analytics',
                'description': 'Data visualization, analytics dashboards, and insights projects.',
                'color': 'yellow',
            },
        ]

        created_count = 0
        updated_count = 0

        for data in topics_data:
            topic, created = Taxonomy.objects.get_or_create(
                name=data['name'],
                defaults={
                    'taxonomy_type': 'topic',
                    'description': data['description'],
                    'color': data['color'],
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created topic: {topic.name}'))
            else:
                # Update existing topic
                topic.taxonomy_type = 'topic'
                topic.description = data['description']
                topic.color = data['color']
                topic.is_active = True
                topic.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated topic: {topic.name}'))

        self.stdout.write(self.style.SUCCESS(f'\n✓ Topics seeded! Created: {created_count}, Updated: {updated_count}'))
