from django.core.management.base import BaseCommand

from core.tools.models import Tool


class Command(BaseCommand):
    help = 'Seed AI tools into the Tool model (programmatically loaded, whats_new is editable)'

    def handle(self, *args, **options):
        # Define tools with their core attributes
        # whats_new can be updated via admin/API separately
        tools_data = [
            {
                'name': 'ChatGPT',
                'tagline': 'AI-powered conversational assistant',
                'description': (
                    'ChatGPT by OpenAI provides natural language interactions powered by GPT models. '
                    'Ideal for conversations, content creation, coding help, and more.'
                ),
                'category': 'chat',
                'website_url': 'https://chat.openai.com',
                'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['NLP', 'OpenAI', 'Conversation', 'GPT'],
                'key_features': [
                    {'title': 'Natural Conversations', 'description': 'Engage in human-like dialogue'},
                    {'title': 'Code Generation', 'description': 'Generate and debug code'},
                    {'title': 'Content Creation', 'description': 'Write articles, emails, and more'},
                ],
                'usage_tips': [
                    'Be specific in your prompts',
                    'Use iterative refinement',
                    'Break complex tasks into steps',
                ],
                'best_practices': [
                    'Provide context for better responses',
                    'Use system messages to set behavior',
                    'Verify factual information',
                ],
            },
            {
                'name': 'Claude',
                'tagline': 'AI assistant by Anthropic',
                'description': (
                    'Claude is an AI assistant created by Anthropic with a focus on being helpful, '
                    'harmless, and honest. Strong at analysis, coding, and creative writing.'
                ),
                'category': 'chat',
                'website_url': 'https://claude.ai',
                'logo_url': 'https://mintlify.s3-us-west-1.amazonaws.com/anthropic/logo/light.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['NLP', 'Anthropic', 'Conversation', 'Claude'],
                'key_features': [
                    {'title': 'Long Context', 'description': 'Handle extensive documents and conversations'},
                    {'title': 'Code Understanding', 'description': 'Analyze and generate complex code'},
                    {'title': 'Nuanced Responses', 'description': 'Thoughtful and detailed answers'},
                ],
                'usage_tips': [
                    'Use for document analysis',
                    'Leverage long context window',
                    'Good for ethical reasoning',
                ],
                'best_practices': [
                    'Provide full context upfront',
                    'Use for research and synthesis',
                    'Good for code review',
                ],
            },
            {
                'name': 'Midjourney',
                'tagline': 'AI art generation platform',
                'description': (
                    'Midjourney creates stunning AI-generated images from text prompts. '
                    'Popular for artistic, photorealistic, and stylized imagery.'
                ),
                'category': 'image',
                'website_url': 'https://midjourney.com',
                'logo_url': 'https://cdn.worldvectorlogo.com/logos/midjourney.svg',
                'pricing_model': 'subscription',
                'has_free_tier': False,
                'tags': ['Image Generation', 'Art', 'Creative'],
                'key_features': [
                    {'title': 'High-Quality Images', 'description': 'Professional-grade AI art'},
                    {'title': 'Style Variety', 'description': 'From photorealistic to abstract'},
                    {'title': 'Community Gallery', 'description': 'Browse and learn from others'},
                ],
                'usage_tips': [
                    'Study prompt engineering',
                    'Use style references',
                    'Iterate with variations',
                ],
                'best_practices': [
                    'Be descriptive in prompts',
                    'Use aspect ratios appropriately',
                    'Leverage community knowledge',
                ],
            },
            {
                'name': 'GitHub Copilot',
                'tagline': 'AI pair programmer',
                'description': (
                    'GitHub Copilot suggests code and entire functions in real-time from your editor. '
                    'Trained on billions of lines of code.'
                ),
                'category': 'code',
                'website_url': 'https://github.com/features/copilot',
                'logo_url': 'https://github.githubassets.com/assets/copilot-logo.svg',
                'pricing_model': 'subscription',
                'has_free_tier': False,
                'tags': ['Code', 'Development', 'GitHub', 'Productivity'],
                'key_features': [
                    {'title': 'Code Completion', 'description': 'AI-powered code suggestions'},
                    {'title': 'Multi-Language', 'description': 'Supports dozens of languages'},
                    {'title': 'Context-Aware', 'description': 'Understands your codebase'},
                ],
                'usage_tips': [
                    'Write clear function names',
                    'Use comments to guide suggestions',
                    'Review all generated code',
                ],
                'best_practices': [
                    'Verify security implications',
                    'Understand generated code',
                    'Use as a learning tool',
                ],
            },
            {
                'name': 'Cursor',
                'tagline': 'AI-first code editor',
                'description': (
                    'Cursor is a code editor built from the ground up with AI at its core. '
                    'Features include AI chat, codebase-wide understanding, and natural language editing.'
                ),
                'category': 'code',
                'website_url': 'https://cursor.sh',
                'logo_url': 'https://cursor.sh/brand/icon.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['Code', 'Editor', 'AI', 'Development'],
                'key_features': [
                    {'title': 'AI Chat', 'description': 'Chat with your codebase'},
                    {'title': 'Cmd+K', 'description': 'Natural language code editing'},
                    {'title': 'Codebase Context', 'description': 'AI understands your entire project'},
                ],
                'usage_tips': [
                    'Use Cmd+K for quick edits',
                    'Chat with @codebase for project questions',
                    'Leverage AI for refactoring',
                ],
                'best_practices': [
                    'Index your codebase',
                    'Use specific prompts',
                    'Review AI suggestions',
                ],
            },
            {
                'name': 'Notion AI',
                'tagline': 'AI-powered knowledge workspace',
                'description': (
                    'Notion AI brings AI directly into your workspace for writing, brainstorming, '
                    'summarizing, and organizing information.'
                ),
                'category': 'productivity',
                'website_url': 'https://notion.so/product/ai',
                'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['Productivity', 'Writing', 'Organization', 'Knowledge Management'],
                'key_features': [
                    {'title': 'AI Writing', 'description': 'Generate and improve content'},
                    {'title': 'Summarization', 'description': 'Condense long documents'},
                    {'title': 'Database Integration', 'description': 'AI works with your data'},
                ],
                'usage_tips': [
                    'Use AI blocks inline',
                    'Summarize meeting notes',
                    'Generate content outlines',
                ],
                'best_practices': [
                    'Organize with databases',
                    'Use templates',
                    'Combine AI with structured data',
                ],
            },
        ]

        created_count = 0
        updated_count = 0

        for data in tools_data:
            tool, created = Tool.objects.get_or_create(
                name=data['name'],
                defaults={
                    'tagline': data['tagline'],
                    'description': data['description'],
                    'category': data['category'],
                    'website_url': data['website_url'],
                    'logo_url': data.get('logo_url', ''),
                    'pricing_model': data['pricing_model'],
                    'has_free_tier': data['has_free_tier'],
                    'tags': data['tags'],
                    'key_features': data.get('key_features', []),
                    'usage_tips': data.get('usage_tips', []),
                    'best_practices': data.get('best_practices', []),
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created tool: {tool.name}'))
            else:
                # Update core fields (but preserve whats_new - it's editable!)
                tool.tagline = data['tagline']
                tool.description = data['description']
                tool.category = data['category']
                tool.website_url = data['website_url']
                tool.logo_url = data.get('logo_url', '')
                tool.pricing_model = data['pricing_model']
                tool.has_free_tier = data['has_free_tier']
                tool.tags = data['tags']
                tool.key_features = data.get('key_features', [])
                tool.usage_tips = data.get('usage_tips', [])
                tool.best_practices = data.get('best_practices', [])
                # NOTE: whats_new is NOT updated here - it's managed separately!
                tool.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated tool: {tool.name} (whats_new preserved)'))

        self.stdout.write(self.style.SUCCESS(f'\n✓ Tools seeded! Created: {created_count}, Updated: {updated_count}'))
        self.stdout.write(
            self.style.NOTICE('\nNote: whats_new field is preserved during updates and can be edited via Django admin.')
        )
