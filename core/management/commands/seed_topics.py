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
                    'Chat and text-based experiences: Q&A bots, conversational guides, coaching/mentor bots.'
                ),
                'color': 'blue',
            },
            {
                'name': 'Websites & Apps Built with AI',
                'description': (
                    'Sites and apps where AI helps power the experience: landing pages, tools, dashboards.'
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
            # Tool-focused topics for discovery (used by Tools M2M)
            {
                'name': 'Vector Databases',
                'description': 'Tools for storing and searching vector embeddings.',
                'color': 'indigo',
            },
            {
                'name': 'RAG',
                'description': 'Retrieval-Augmented Generation tools and frameworks.',
                'color': 'violet',
            },
            {
                'name': 'LLM Providers',
                'description': 'Large language model APIs and services.',
                'color': 'blue',
            },
            {
                'name': 'Embedding Providers',
                'description': 'APIs for generating text and image embeddings.',
                'color': 'cyan',
            },
            {
                'name': 'Authentication',
                'description': 'Auth, SSO, and identity management tools.',
                'color': 'emerald',
            },
            {
                'name': 'Image Generation',
                'description': 'AI image generation and editing tools.',
                'color': 'pink',
            },
            {
                'name': 'Video Generation',
                'description': 'AI video creation and editing tools.',
                'color': 'red',
            },
            {
                'name': 'Voice AI',
                'description': 'Text-to-speech, speech-to-text, and voice cloning.',
                'color': 'amber',
            },
            {
                'name': 'Code Assistants',
                'description': 'AI coding assistants and IDE integrations.',
                'color': 'slate',
            },
            {
                'name': 'Agent Frameworks',
                'description': 'Frameworks for building AI agents.',
                'color': 'purple',
            },
            {
                'name': 'Observability',
                'description': 'LLM monitoring, tracing, and evaluation tools.',
                'color': 'orange',
            },
            {
                'name': 'Orchestration',
                'description': 'LLM orchestration and workflow frameworks.',
                'color': 'teal',
            },
            # Technology/infrastructure topics (for non-AI tools)
            {
                'name': 'Web Frameworks',
                'description': 'Frontend and backend web development frameworks.',
                'color': 'blue',
            },
            {
                'name': 'Databases',
                'description': 'Relational, NoSQL, and graph database systems.',
                'color': 'green',
            },
            {
                'name': 'DevOps',
                'description': 'Infrastructure, CI/CD, containers, and deployment tools.',
                'color': 'orange',
            },
            {
                'name': 'Cloud Platforms',
                'description': 'Cloud computing and hosting services.',
                'color': 'sky',
            },
            {
                'name': 'Programming Languages',
                'description': 'General-purpose and domain-specific programming languages.',
                'color': 'slate',
            },
            {
                'name': 'Testing',
                'description': 'Testing frameworks and quality assurance tools.',
                'color': 'lime',
            },
        ]

        created_count = 0
        updated_count = 0

        for data in topics_data:
            # Handle potential duplicates by using filter + first
            existing = Taxonomy.objects.filter(name=data['name']).first()

            if existing:
                # Update existing topic
                existing.taxonomy_type = 'topic'
                existing.description = data['description']
                existing.color = data['color']
                existing.is_active = True
                existing.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated topic: {existing.name}'))
            else:
                # Create new topic
                topic = Taxonomy.objects.create(
                    name=data['name'],
                    taxonomy_type='topic',
                    description=data['description'],
                    color=data['color'],
                    is_active=True,
                )
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created topic: {topic.name}'))

        self.stdout.write(self.style.SUCCESS(f'\n✓ Topics seeded! Created: {created_count}, Updated: {updated_count}'))
