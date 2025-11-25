from django.core.management.base import BaseCommand

from core.taxonomy.models import Taxonomy


class Command(BaseCommand):
    help = 'Seed initial taxonomies for personalization'

    def handle(self, *args, **options):
        taxonomies_data = [
            # Interests
            {
                'name': 'AI & Machine Learning',
                'category': 'interest',
                'description': 'Artificial intelligence, machine learning, and deep learning',
            },
            {
                'name': 'Web Development',
                'category': 'interest',
                'description': 'Frontend, backend, and full-stack web development',
            },
            {
                'name': 'Data Science',
                'category': 'interest',
                'description': 'Data analysis, visualization, and statistical modeling',
            },
            {
                'name': 'Design',
                'category': 'interest',
                'description': 'UI/UX design, graphic design, and product design',
            },
            {
                'name': 'Creative Writing',
                'category': 'interest',
                'description': 'Writing, storytelling, and content creation',
            },
            {
                'name': 'Photography',
                'category': 'interest',
                'description': 'Photography, photo editing, and visual arts',
            },
            {'name': 'Music', 'category': 'interest', 'description': 'Music production, composition, and performance'},
            {'name': 'Entrepreneurship', 'category': 'interest', 'description': 'Starting and growing businesses'},
            # Skills
            {'name': 'Python', 'category': 'skill', 'description': 'Python programming language'},
            {'name': 'JavaScript', 'category': 'skill', 'description': 'JavaScript and TypeScript programming'},
            {'name': 'React', 'category': 'skill', 'description': 'React framework for building user interfaces'},
            {'name': 'Django', 'category': 'skill', 'description': 'Django web framework for Python'},
            {'name': 'SQL', 'category': 'skill', 'description': 'SQL databases and queries'},
            {'name': 'Docker', 'category': 'skill', 'description': 'Container technology and orchestration'},
            {'name': 'Cloud Computing', 'category': 'skill', 'description': 'AWS, Azure, GCP cloud platforms'},
            {
                'name': 'Project Management',
                'category': 'skill',
                'description': 'Planning, organizing, and managing projects',
            },
            # Goals
            {'name': 'Build a Portfolio', 'category': 'goal', 'description': 'Create and showcase professional work'},
            {
                'name': 'Learn New Skills',
                'category': 'goal',
                'description': 'Acquire new technical or creative abilities',
            },
            {'name': 'Career Change', 'category': 'goal', 'description': 'Transition to a new career path'},
            {'name': 'Start a Business', 'category': 'goal', 'description': 'Launch and grow a startup'},
            {'name': 'Freelance', 'category': 'goal', 'description': 'Build a freelance career'},
            {'name': 'Get Certified', 'category': 'goal', 'description': 'Earn professional certifications'},
            # Topics - synced with frontend/src/config/topics.ts
            # These are used on projects/tools and for personalizing the Explore page
            # Industries
            {'name': 'Technology', 'category': 'industry', 'description': 'Tech companies and software industry'},
            {'name': 'Healthcare', 'category': 'industry', 'description': 'Medical and healthcare sector'},
            {'name': 'Finance', 'category': 'industry', 'description': 'Financial services and fintech'},
            {'name': 'Education', 'category': 'industry', 'description': 'EdTech and learning platforms'},
            {'name': 'E-commerce', 'category': 'industry', 'description': 'Online retail and marketplaces'},
            {'name': 'Marketing', 'category': 'industry', 'description': 'Digital marketing and advertising'},
            # AI Tools
            {
                'name': 'ChatGPT',
                'category': 'tool',
                'description': 'OpenAI conversational AI chatbot for text generation and assistance',
            },
            {
                'name': 'Claude',
                'category': 'tool',
                'description': 'Anthropic AI assistant for analysis, writing, and coding',
            },
            {
                'name': 'Midjourney',
                'category': 'tool',
                'description': 'AI image generation tool for creating digital artwork',
            },
            {'name': 'DALL-E', 'category': 'tool', 'description': 'OpenAI text-to-image generation system'},
            {'name': 'Stable Diffusion', 'category': 'tool', 'description': 'Open-source AI image generation model'},
            {
                'name': 'GitHub Copilot',
                'category': 'tool',
                'description': 'AI pair programmer for code completion and suggestions',
            },
            {
                'name': 'Cursor',
                'category': 'tool',
                'description': 'AI-powered code editor built for pair programming with AI',
            },
            {'name': 'Runway', 'category': 'tool', 'description': 'AI video editing and generation platform'},
            {'name': 'ElevenLabs', 'category': 'tool', 'description': 'AI voice synthesis and text-to-speech platform'},
            {'name': 'Perplexity', 'category': 'tool', 'description': 'AI-powered search and answer engine'},
            {'name': 'Jasper', 'category': 'tool', 'description': 'AI content generation platform for marketing'},
            {'name': 'Copy.ai', 'category': 'tool', 'description': 'AI writing assistant for marketing and sales copy'},
            {'name': 'Notion AI', 'category': 'tool', 'description': 'AI assistant integrated into Notion workspace'},
            {
                'name': 'Grammarly',
                'category': 'tool',
                'description': 'AI writing assistant for grammar and style checking',
            },
            {'name': 'Synthesia', 'category': 'tool', 'description': 'AI video generation platform with AI avatars'},
            {
                'name': 'Descript',
                'category': 'tool',
                'description': 'AI audio and video editing with text-based editing',
            },
            {
                'name': 'Hugging Face',
                'category': 'tool',
                'description': 'Platform for machine learning models and datasets',
            },
            {'name': 'Replicate', 'category': 'tool', 'description': 'Platform for running AI models in the cloud'},
            {
                'name': 'Anthropic Console',
                'category': 'tool',
                'description': 'Development platform for Claude API integration',
            },
            {
                'name': 'OpenAI Playground',
                'category': 'tool',
                'description': 'Interactive testing environment for OpenAI models',
            },
            {
                'name': 'LangChain',
                'category': 'tool',
                'description': 'Framework for developing LLM-powered applications',
            },
            {'name': 'AutoGPT', 'category': 'tool', 'description': 'Autonomous AI agent for task completion'},
            {'name': 'Zapier AI', 'category': 'tool', 'description': 'AI-powered workflow automation platform'},
            {'name': 'Canva AI', 'category': 'tool', 'description': 'AI design tools integrated into Canva platform'},
            {'name': 'Adobe Firefly', 'category': 'tool', 'description': 'Adobe generative AI for creative workflows'},
        ]

        created_count = 0
        updated_count = 0

        for data in taxonomies_data:
            taxonomy, created = Taxonomy.objects.get_or_create(
                name=data['name'],
                defaults={
                    'category': data['category'],
                    'description': data['description'],
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created taxonomy: {taxonomy.name}'))
            else:
                # Update existing taxonomy
                taxonomy.category = data['category']
                taxonomy.description = data['description']
                taxonomy.is_active = True
                taxonomy.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'Updated taxonomy: {taxonomy.name}'))

        self.stdout.write(self.style.SUCCESS(f'\nSeeding complete! Created {created_count}, Updated {updated_count}'))
