from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.quizzes.models import Quiz, QuizQuestion
from core.taxonomy.models import Taxonomy
from core.tools.models import Tool

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed initial quizzes into the database (idempotent)'

    def handle(self, *args, **options):
        # Get or create a system user for quiz creation
        system_user, created = User.objects.get_or_create(
            username='system',
            defaults={
                'email': 'system@allthrive.ai',
                'is_staff': True,
                'is_active': True,
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS('✓ Created system user for quiz ownership'))

        quizzes_data = [
            {
                'title': 'AI Agent Frameworks Showdown',
                'slug': 'ai-agent-frameworks-showdown',
                'description': (
                    'Quick dive into the most popular AI agent frameworks. '
                    'Learn which framework fits your next project in just 5 minutes!'
                ),
                'topic': 'AI Frameworks',
                'difficulty': 'beginner',
                'estimated_time': 5,
                'thumbnail_url': 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800&q=80',
                'is_published': True,
                'category_names': ['AI Agents & Multi-Tool Systems', 'Developer & Coding', 'Podcasts & Education'],
                'topic_tags': ['AI Frameworks', 'LangChain', 'LangGraph', 'CrewAI', 'AutoGen', 'Multi-Agent Systems'],
                'tool_names': ['ChatGPT', 'Claude'],  # LLMs commonly used with these frameworks
                'questions': [
                    {
                        'question': 'LangChain is best known for chaining together LLM calls and tools',
                        'type': 'true_false',
                        'correct_answer': 'true',
                        'options': None,
                        'explanation': (
                            "Correct! LangChain's core strength is creating chains that connect LLMs "
                            'with various tools, APIs, and data sources, making it easy to build '
                            'complex AI workflows.'
                        ),
                        'hint': "Think about what the name 'LangChain' suggests",
                        'order': 1,
                        'image_url': 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&q=80',
                    },
                    {
                        'question': (
                            'Which framework specializes in building multi-agent systems with graph-based workflows?'
                        ),
                        'type': 'multiple_choice',
                        'correct_answer': 'LangGraph',
                        'options': ['LangChain', 'LangGraph', 'AutoGen', 'CrewAI'],
                        'explanation': (
                            'LangGraph is specifically designed for building stateful, multi-agent '
                            "applications using graph-based workflows. It's perfect for complex "
                            'agent coordination!'
                        ),
                        'hint': "The name has 'Graph' in it",
                        'order': 2,
                        'image_url': 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800&q=80',
                    },
                    {
                        'question': 'CrewAI uses a role-based approach where AI agents work together like a team',
                        'type': 'true_false',
                        'correct_answer': 'true',
                        'options': None,
                        'explanation': (
                            'Exactly right! CrewAI is all about creating teams of AI agents with '
                            'specific roles (like manager, researcher, writer) that collaborate to '
                            'complete tasks.'
                        ),
                        'hint': "The word 'Crew' suggests teamwork",
                        'order': 3,
                        'image_url': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
                    },
                    {
                        'question': (
                            'Which framework is developed by Microsoft Research for autonomous agent conversations?'
                        ),
                        'type': 'multiple_choice',
                        'correct_answer': 'AutoGen',
                        'options': ['Semantic Kernel', 'AutoGen', 'LangChain', 'Haystack'],
                        'explanation': (
                            'AutoGen, created by Microsoft Research, enables building applications '
                            'with multiple conversational agents that can collaborate autonomously '
                            'to solve tasks.'
                        ),
                        'hint': "It starts with 'Auto' and was made by Microsoft",
                        'order': 4,
                        'image_url': 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80',
                    },
                    {
                        'question': "All major AI agent frameworks require you to use OpenAI's GPT models only",
                        'type': 'true_false',
                        'correct_answer': 'false',
                        'options': None,
                        'explanation': (
                            'False! Most modern frameworks are model-agnostic and support multiple '
                            'LLM providers including OpenAI, Anthropic, Google, open-source models, '
                            'and more.'
                        ),
                        'hint': 'Think about flexibility and vendor lock-in',
                        'order': 5,
                        'image_url': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80',
                    },
                ],
            },
            {
                'title': 'Prompt Engineering Essentials',
                'slug': 'prompt-engineering-essentials',
                'description': (
                    'Master the art of talking to AI! Learn key techniques to get better results from any AI model.'
                ),
                'topic': 'Prompt Engineering',
                'difficulty': 'beginner',
                'estimated_time': 4,
                'thumbnail_url': 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&q=80',
                'is_published': True,
                'category_names': ['Prompt Collections & Templates', 'Podcasts & Education', 'Developer & Coding'],
                'topic_tags': [
                    'Prompt Engineering',
                    'Few-shot Learning',
                    'Chain-of-Thought',
                    'AI Best Practices',
                    'LLM',
                ],
                'tool_names': ['ChatGPT', 'Claude', 'Notion AI'],  # Tools where prompt engineering is essential
                'questions': [
                    {
                        'question': 'Being specific and clear in your prompts leads to better AI responses',
                        'type': 'true_false',
                        'correct_answer': 'true',
                        'options': None,
                        'explanation': (
                            'Absolutely! Specific, clear prompts help the AI understand exactly '
                            "what you want. Compare 'write something' vs 'write a 3-paragraph blog "
                            "intro about AI ethics for beginners.'"
                        ),
                        'hint': 'Would you prefer clear or vague instructions?',
                        'order': 1,
                        'image_url': 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&q=80',
                    },
                    {
                        'question': 'What technique involves showing the AI examples before asking it to do a task?',
                        'type': 'multiple_choice',
                        'correct_answer': 'Few-shot learning',
                        'options': ['Zero-shot learning', 'Few-shot learning', 'Chain-of-thought', 'Role prompting'],
                        'explanation': (
                            'Few-shot learning! By providing 2-3 examples of input-output pairs, '
                            "you teach the AI the pattern you want. It's like showing instead of "
                            'just telling.'
                        ),
                        'hint': 'The name refers to how many examples you give',
                        'order': 2,
                        'image_url': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
                    },
                    {
                        'question': 'Chain-of-thought prompting asks the AI to explain its reasoning step by step',
                        'type': 'true_false',
                        'correct_answer': 'true',
                        'options': None,
                        'explanation': (
                            "Correct! Adding 'Let's think step by step' or 'Explain your reasoning' "
                            'helps the AI break down complex problems and often improves accuracy on '
                            'logical tasks.'
                        ),
                        'hint': 'Think about breaking things into steps',
                        'order': 3,
                        'image_url': 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80',
                    },
                    {
                        'question': 'Which is the MOST important element of a good prompt?',
                        'type': 'multiple_choice',
                        'correct_answer': 'Clear context and goals',
                        'options': [
                            'Using complex vocabulary',
                            'Making it very long',
                            'Clear context and goals',
                            'Adding emojis',
                        ],
                        'explanation': (
                            'Clear context and goals! The AI needs to understand what you want and '
                            "why. Length and fancy words don't matter if the AI doesn't know your "
                            'objective.'
                        ),
                        'hint': 'What helps someone understand a task?',
                        'order': 4,
                        'image_url': 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80',
                    },
                    {
                        'question': 'You should never iterate and refine your prompts based on the results',
                        'type': 'true_false',
                        'correct_answer': 'false',
                        'options': None,
                        'explanation': (
                            'False! Prompt engineering is iterative. Your first prompt rarely gives '
                            'perfect results. Experiment, refine, and improve based on what works '
                            "and what doesn't."
                        ),
                        'hint': 'Is practice and improvement useful?',
                        'order': 5,
                        'image_url': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
                    },
                    {
                        'question': "Giving the AI a role (like 'You are an expert teacher') can improve responses",
                        'type': 'true_false',
                        'correct_answer': 'true',
                        'options': None,
                        'explanation': (
                            'True! Role prompting helps set the tone and expertise level. '
                            "'You are a friendly Python tutor' will give different responses than "
                            "'You are a senior software architect.'"
                        ),
                        'hint': 'Does setting expectations help?',
                        'order': 6,
                        'image_url': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
                    },
                ],
            },
        ]

        created_quizzes = 0
        updated_quizzes = 0
        created_questions = 0
        updated_questions = 0

        for quiz_data in quizzes_data:
            questions_data = quiz_data.pop('questions')
            category_names = quiz_data.pop('category_names', [])
            topic_tags = quiz_data.pop('topic_tags', [])
            tool_names = quiz_data.pop('tool_names', [])
            topic_name = quiz_data.pop('topic', None)  # Extract the topic string

            # Get or create the quiz
            quiz, quiz_created = Quiz.objects.get_or_create(
                slug=quiz_data['slug'],
                defaults={
                    'title': quiz_data['title'],
                    'description': quiz_data['description'],
                    'difficulty': quiz_data['difficulty'],
                    'estimated_time': quiz_data['estimated_time'],
                    'thumbnail_url': quiz_data.get('thumbnail_url', ''),
                    'is_published': quiz_data['is_published'],
                    'created_by': system_user,
                },
            )

            if quiz_created:
                created_quizzes += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created quiz: {quiz.title}'))
            else:
                # Update existing quiz
                quiz.title = quiz_data['title']
                quiz.description = quiz_data['description']
                quiz.difficulty = quiz_data['difficulty']
                quiz.estimated_time = quiz_data['estimated_time']
                quiz.thumbnail_url = quiz_data.get('thumbnail_url', '')
                quiz.is_published = quiz_data['is_published']
                quiz.save()
                updated_quizzes += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated quiz: {quiz.title}'))

            # Set topics (ManyToMany - must be set after save)
            topics_to_set = []

            # Add the main topic if provided
            if topic_name:
                try:
                    main_topic = Taxonomy.objects.get(name=topic_name, taxonomy_type='topic', is_active=True)
                    topics_to_set.append(main_topic)
                except Taxonomy.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(f'  ⚠ Topic "{topic_name}" not found in Taxonomy. Run seed_topics first.')
                    )

            # Add additional topic tags
            if topic_tags:
                for tag_name in topic_tags:
                    try:
                        topic_tag = Taxonomy.objects.get(name=tag_name, taxonomy_type='topic', is_active=True)
                        if topic_tag not in topics_to_set:
                            topics_to_set.append(topic_tag)
                    except Taxonomy.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'  ⚠ Topic tag "{tag_name}" not found in Taxonomy.'))

            quiz.topics.set(topics_to_set)
            if topics_to_set:
                self.stdout.write(self.style.SUCCESS(f'  → Added {len(topics_to_set)} topics to {quiz.title}'))

            # Add categories (ManyToMany relationship)
            if category_names:
                categories = Taxonomy.objects.filter(name__in=category_names, taxonomy_type='category', is_active=True)
                quiz.categories.set(categories)
                category_count = categories.count()
                if category_count > 0:
                    self.stdout.write(self.style.SUCCESS(f'  → Added {category_count} categories to {quiz.title}'))
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f'  ⚠ No matching categories found for {quiz.title}. Run seed_categories first.'
                        )
                    )

            # Add tools (ManyToMany relationship)
            if tool_names:
                tools = Tool.objects.filter(name__in=tool_names, is_active=True)
                quiz.tools.set(tools)
                tool_count = tools.count()
                if tool_count > 0:
                    self.stdout.write(self.style.SUCCESS(f'  → Added {tool_count} tools to {quiz.title}'))
                else:
                    self.stdout.write(
                        self.style.WARNING(f'  ⚠ No matching tools found for {quiz.title}. Run seed_tools first.')
                    )

            # Create or update questions
            for question_data in questions_data:
                question, question_created = QuizQuestion.objects.get_or_create(
                    quiz=quiz, order=question_data['order'], defaults=question_data
                )

                if question_created:
                    created_questions += 1
                else:
                    # Update existing question
                    question.question = question_data['question']
                    question.type = question_data['type']
                    question.correct_answer = question_data['correct_answer']
                    question.options = question_data['options']
                    question.explanation = question_data['explanation']
                    question.hint = question_data['hint']
                    question.image_url = question_data.get('image_url')
                    question.save()
                    updated_questions += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Quizzes seeded! '
                f'Quizzes - Created: {created_quizzes}, Updated: {updated_quizzes} | '
                f'Questions - Created: {created_questions}, Updated: {updated_questions}'
            )
        )
