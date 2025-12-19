"""Seed initial learning concepts from topics and tools."""

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from core.learning_paths.models import Concept
from core.tools.models import Tool


class Command(BaseCommand):
    help = 'Seed initial learning concepts into the database (idempotent)'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        # Core AI concepts organized by topic
        concepts_data = [
            # Chatbots & Conversation
            {
                'name': 'Prompt Engineering',
                'topic': 'chatbots-conversation',
                'description': 'The art of crafting effective prompts to get better results from AI models.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 10,
                'keywords': ['prompts', 'prompt design', 'prompt templates', 'few-shot', 'zero-shot'],
            },
            {
                'name': 'Conversational AI',
                'topic': 'chatbots-conversation',
                'description': 'Building AI systems that can engage in natural, human-like conversations.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 15,
                'keywords': ['chatbot', 'dialogue', 'conversation', 'chat interface'],
            },
            {
                'name': 'System Prompts',
                'topic': 'chatbots-conversation',
                'description': 'Using system prompts to define AI behavior and personality.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 5,
                'keywords': ['system message', 'persona', 'instructions', 'role'],
            },
            # AI Agents & Multi-Tool Systems
            {
                'name': 'AI Agents',
                'topic': 'ai-agents-multitool',
                'description': 'Autonomous AI systems that can plan and execute multi-step tasks.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 15,
                'keywords': ['agent', 'autonomous', 'planning', 'tool use'],
            },
            {
                'name': 'RAG (Retrieval-Augmented Generation)',
                'topic': 'ai-agents-multitool',
                'description': 'Combining retrieval systems with LLMs to provide accurate, grounded responses.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 20,
                'keywords': ['RAG', 'retrieval', 'vector search', 'embeddings', 'knowledge base'],
            },
            {
                'name': 'Tool Calling',
                'topic': 'ai-agents-multitool',
                'description': 'Enabling AI models to use external tools and APIs.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 10,
                'keywords': ['function calling', 'tools', 'API', 'actions'],
            },
            {
                'name': 'Multi-Agent Systems',
                'topic': 'ai-agents-multitool',
                'description': 'Coordinating multiple AI agents to solve complex problems.',
                'base_difficulty': 'advanced',
                'estimated_minutes': 20,
                'keywords': ['multi-agent', 'orchestration', 'collaboration', 'swarm'],
            },
            {
                'name': 'Vector Embeddings',
                'topic': 'ai-agents-multitool',
                'description': 'Converting text to numerical vectors for semantic search and similarity.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 15,
                'keywords': ['embeddings', 'vectors', 'semantic search', 'similarity'],
            },
            # Images & Video
            {
                'name': 'Image Generation',
                'topic': 'images-video',
                'description': 'Creating images from text descriptions using AI models.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 10,
                'keywords': ['text-to-image', 'image generation', 'DALL-E', 'Midjourney', 'Stable Diffusion'],
            },
            {
                'name': 'Image Prompting',
                'topic': 'images-video',
                'description': 'Crafting effective prompts for image generation models.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 10,
                'keywords': ['image prompts', 'style', 'composition', 'negative prompts'],
            },
            {
                'name': 'Diffusion Models',
                'topic': 'images-video',
                'description': 'Understanding how diffusion models generate images.',
                'base_difficulty': 'advanced',
                'estimated_minutes': 20,
                'keywords': ['diffusion', 'noise', 'denoising', 'latent space'],
            },
            {
                'name': 'Video Generation',
                'topic': 'images-video',
                'description': 'Creating videos from text or images using AI.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 15,
                'keywords': ['text-to-video', 'video synthesis', 'animation', 'Sora', 'Runway'],
            },
            # Developer & Coding
            {
                'name': 'AI Code Assistants',
                'topic': 'developer-coding',
                'description': 'Using AI to help write, review, and debug code.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 10,
                'keywords': ['Copilot', 'code completion', 'code generation', 'debugging'],
            },
            {
                'name': 'LLM APIs',
                'topic': 'developer-coding',
                'description': 'Integrating Large Language Model APIs into applications.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 15,
                'keywords': ['API', 'OpenAI', 'Anthropic', 'integration', 'SDK'],
            },
            {
                'name': 'Streaming Responses',
                'topic': 'developer-coding',
                'description': 'Implementing real-time streaming for LLM responses.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 10,
                'keywords': ['streaming', 'SSE', 'real-time', 'tokens'],
            },
            # Workflows & Automation
            {
                'name': 'AI Automation',
                'topic': 'workflows-automation',
                'description': 'Automating repetitive tasks with AI assistance.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 10,
                'keywords': ['automation', 'workflow', 'no-code', 'Zapier', 'Make'],
            },
            {
                'name': 'AI Pipelines',
                'topic': 'workflows-automation',
                'description': 'Building multi-step AI processing pipelines.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 15,
                'keywords': ['pipeline', 'chain', 'workflow', 'orchestration'],
            },
            # AI Models & Research
            {
                'name': 'Large Language Models',
                'topic': 'ai-models-research',
                'description': 'Understanding how LLMs work and their capabilities.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 15,
                'keywords': ['LLM', 'GPT', 'Claude', 'transformer', 'foundation model'],
            },
            {
                'name': 'Fine-Tuning',
                'topic': 'ai-models-research',
                'description': 'Customizing pre-trained models for specific tasks.',
                'base_difficulty': 'advanced',
                'estimated_minutes': 25,
                'keywords': ['fine-tuning', 'training', 'LoRA', 'custom model'],
            },
            {
                'name': 'Model Context Window',
                'topic': 'ai-models-research',
                'description': 'Understanding and managing context window limitations.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 10,
                'keywords': ['context window', 'tokens', 'context length', 'memory'],
            },
            # Data & Analytics
            {
                'name': 'AI Data Analysis',
                'topic': 'data-analytics',
                'description': 'Using AI to analyze and extract insights from data.',
                'base_difficulty': 'intermediate',
                'estimated_minutes': 15,
                'keywords': ['data analysis', 'insights', 'patterns', 'Code Interpreter'],
            },
            # Productivity
            {
                'name': 'AI Writing Assistant',
                'topic': 'productivity',
                'description': 'Using AI to improve writing, editing, and content creation.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 10,
                'keywords': ['writing', 'editing', 'content', 'copywriting'],
            },
            {
                'name': 'AI Research Assistant',
                'topic': 'productivity',
                'description': 'Leveraging AI to accelerate research and learning.',
                'base_difficulty': 'beginner',
                'estimated_minutes': 10,
                'keywords': ['research', 'summarization', 'learning', 'knowledge'],
            },
        ]

        # Create concepts
        for concept_data in concepts_data:
            concept, created = Concept.objects.update_or_create(
                slug=slugify(concept_data['name']),
                defaults={
                    'name': concept_data['name'],
                    'topic': concept_data['topic'],
                    'description': concept_data['description'],
                    'base_difficulty': concept_data['base_difficulty'],
                    'estimated_minutes': concept_data['estimated_minutes'],
                    'keywords': concept_data.get('keywords', []),
                    'is_active': True,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(f'  + Created concept: {concept.name}')
            else:
                updated_count += 1

        # Link concepts to tools where appropriate
        tool_concept_links = [
            ('chatgpt', 'Large Language Models'),
            ('chatgpt', 'Prompt Engineering'),
            ('chatgpt', 'Conversational AI'),
            ('claude', 'Large Language Models'),
            ('claude', 'Prompt Engineering'),
            ('claude', 'Conversational AI'),
            ('midjourney', 'Image Generation'),
            ('midjourney', 'Image Prompting'),
            ('dall-e-3', 'Image Generation'),
            ('dall-e-3', 'Image Prompting'),
            ('stable-diffusion', 'Image Generation'),
            ('stable-diffusion', 'Diffusion Models'),
            ('github-copilot', 'AI Code Assistants'),
            ('cursor', 'AI Code Assistants'),
            ('langchain', 'AI Agents'),
            ('langchain', 'RAG (Retrieval-Augmented Generation)'),
            ('langchain', 'Tool Calling'),
            ('perplexity', 'AI Research Assistant'),
            ('notion-ai', 'AI Writing Assistant'),
            ('sora', 'Video Generation'),
            ('runway', 'Video Generation'),
        ]

        linked_count = 0
        for tool_slug, concept_name in tool_concept_links:
            try:
                tool = Tool.objects.get(slug=tool_slug)
                concept = Concept.objects.get(name=concept_name)
                if concept.tool != tool:
                    # Don't overwrite if already linked to another tool
                    if concept.tool is None:
                        concept.tool = tool
                        concept.save(update_fields=['tool'])
                        linked_count += 1
            except (Tool.DoesNotExist, Concept.DoesNotExist):
                pass  # Tool or concept not found, skip

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'✓ Created {created_count} new concepts'))
        self.stdout.write(self.style.SUCCESS(f'✓ Updated {updated_count} existing concepts'))
        self.stdout.write(self.style.SUCCESS(f'✓ Linked {linked_count} concepts to tools'))
        self.stdout.write('')

        # Summary by topic
        self.stdout.write('Concepts by topic:')
        from core.taxonomy.models import Taxonomy

        topic_taxonomies = Taxonomy.objects.filter(taxonomy_type='topic', is_active=True).order_by('order', 'name')
        for topic in topic_taxonomies:
            count = Concept.objects.filter(topic=topic, is_active=True).count()
            if count > 0:
                self.stdout.write(f'  {topic.name}: {count} concepts')
