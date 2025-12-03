"""
Django management command to populate allie user with fake data for testing/demo.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.agents.models import Conversation, Message
from core.projects.models import Project
from core.quizzes.models import Quiz, QuizAttempt
from core.users.models import User, UserRole


class Command(BaseCommand):
    help = 'Populate allie user with fake data for testing/demo purposes'

    def handle(self, *args, **options):
        try:
            user = User.objects.get(username='allie')
            self.stdout.write(self.style.SUCCESS(f'Found user: {user.username}'))
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR("User 'allie' not found. Please create the user first."))
            return

        # Update user profile
        self.stdout.write('Updating user profile...')
        user.email = 'allie@example.com'
        user.first_name = 'Allie'
        user.last_name = 'Thompson'
        user.role = UserRole.EXPERT
        user.bio = (
            'Full-stack developer passionate about AI and machine learning. '
            'I love building tools that make complex technology accessible to everyone.\n\n'
            'Currently exploring LangChain, vector databases, and AI-powered applications.'
        )
        user.tagline = 'AI Developer & Creative Problem Solver'
        user.location = 'San Francisco, CA'
        user.pronouns = 'she/her'
        user.current_status = 'Building cool AI stuff 🚀'
        user.avatar_url = 'https://avatars.githubusercontent.com/u/1234567'
        user.github_url = 'https://github.com/alliethompson'
        user.linkedin_url = 'https://linkedin.com/in/alliethompson'
        user.twitter_url = 'https://twitter.com/alliecodes'
        user.playground_is_public = True
        user.save()
        self.stdout.write(self.style.SUCCESS('✓ Updated user profile'))

        # Create projects
        self.stdout.write('\nCreating projects...')
        projects_data = [
            {
                'slug': 'ai-chatbot-assistant',
                'title': 'AI Chatbot Assistant',
                'description': (
                    'A conversational AI assistant built with LangChain and OpenAI GPT-4. '
                    'Features include context retention, multi-turn conversations, and custom personality training.'
                ),
                'type': Project.ProjectType.GITHUB_REPO,
                'is_showcase': True,
                'is_private': False,
                'thumbnail_url': 'https://avatars.githubusercontent.com/u/example1',
                'content': {
                    'blocks': [
                        {'type': 'cover', 'title': 'AI Chatbot Assistant', 'subtitle': 'Conversational AI with Memory'},
                        {'type': 'text', 'content': 'Built using LangChain, OpenAI, and Redis for vector storage.'},
                        {'type': 'tags', 'tags': ['Python', 'LangChain', 'OpenAI', 'Redis']},
                    ]
                },
            },
            {
                'slug': 'vector-search-demo',
                'title': 'Vector Search Demo',
                'description': (
                    'Semantic search implementation using RedisVL and embeddings. '
                    'Demonstrates similarity search and clustering techniques.'
                ),
                'type': Project.ProjectType.GITHUB_REPO,
                'is_showcase': True,
                'is_private': False,
                'thumbnail_url': 'https://avatars.githubusercontent.com/u/example2',
                'content': {
                    'blocks': [
                        {'type': 'cover', 'title': 'Vector Search Demo'},
                        {'type': 'tags', 'tags': ['Python', 'RedisVL', 'Machine Learning']},
                    ]
                },
            },
            {
                'slug': 'image-gallery-project',
                'title': 'Design Portfolio',
                'description': 'A collection of UI/UX designs and creative work.',
                'type': Project.ProjectType.IMAGE_COLLECTION,
                'is_showcase': True,
                'is_private': False,
                'thumbnail_url': 'https://avatars.githubusercontent.com/u/example3',
                'content': {
                    'blocks': [
                        {'type': 'cover', 'title': 'Design Portfolio'},
                        {'type': 'text', 'content': 'My creative design work and visual experiments.'},
                    ]
                },
            },
            {
                'slug': 'work-in-progress',
                'title': 'Work in Progress - ML Pipeline',
                'description': 'Building a machine learning data pipeline for real-time predictions.',
                'type': Project.ProjectType.OTHER,
                'is_showcase': False,
                'is_private': True,
                'content': {'blocks': []},
            },
        ]

        for proj_data in projects_data:
            project, created = Project.objects.update_or_create(user=user, slug=proj_data['slug'], defaults=proj_data)
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created project: {project.title}'))
            else:
                self.stdout.write(self.style.WARNING(f'  ↻ Updated project: {project.title}'))

        # Create conversations
        self.stdout.write('\nCreating conversations...')
        conversations_data = [
            {
                'title': 'Getting Started with LangChain',
                'messages': [
                    {
                        'role': 'user',
                        'content': 'How do I get started with LangChain for building a chatbot?',
                    },
                    {
                        'role': 'assistant',
                        'content': (
                            "Great question! To get started with LangChain for building a chatbot, you'll want to: "
                            '1) Install LangChain via pip, 2) Set up your OpenAI API key, '
                            '3) Create a simple chain with a prompt template, and 4) Add memory for context retention.'
                        ),
                    },
                    {
                        'role': 'user',
                        'content': "What's the best way to handle conversation memory?",
                    },
                    {
                        'role': 'assistant',
                        'content': (
                            'For conversation memory, I recommend using ConversationBufferMemory or '
                            'ConversationSummaryMemory depending on your needs. Buffer memory keeps recent messages, '
                            'while summary memory condenses older context.'
                        ),
                    },
                ],
            },
            {
                'title': 'Vector Database Selection',
                'messages': [
                    {
                        'role': 'user',
                        'content': 'Should I use RedisVL or another vector database?',
                    },
                    {
                        'role': 'assistant',
                        'content': (
                            'RedisVL is an excellent choice! It offers fast performance, built-in caching, and '
                            'integrates well with existing Redis infrastructure. '
                            "It's particularly good for real-time applications."
                        ),
                    },
                ],
            },
            {
                'title': 'Python Best Practices',
                'messages': [
                    {
                        'role': 'user',
                        'content': 'What are some Python best practices for async operations?',
                    },
                    {
                        'role': 'assistant',
                        'content': (
                            'Key async best practices: 1) Use `async def` for coroutines, '
                            '2) Always `await` async calls, 3) Use asyncio.gather() for concurrent operations, '
                            '4) Handle exceptions properly with try/except in async contexts.'
                        ),
                    },
                ],
            },
        ]

        for conv_data in conversations_data:
            conversation = Conversation.objects.create(user=user, title=conv_data['title'])
            for msg_data in conv_data['messages']:
                Message.objects.create(conversation=conversation, role=msg_data['role'], content=msg_data['content'])
            self.stdout.write(self.style.SUCCESS(f'  ✓ Created conversation: {conversation.title}'))

        # Create quizzes
        self.stdout.write('\nCreating quizzes...')

        # Check if there are any published quizzes
        existing_quizzes = Quiz.objects.filter(is_private=False)
        if existing_quizzes.exists():
            self.stdout.write(f'Found {existing_quizzes.count()} published quizzes')

            # Create quiz attempts
            quiz = existing_quizzes.first()
            questions = list(quiz.questions.all()[:5])  # Get first 5 questions

            if questions:
                # Create a completed attempt
                completed_attempt = QuizAttempt.objects.create(
                    quiz=quiz,
                    user=user,
                    score=4,
                    total_questions=5,
                    started_at=timezone.now() - timedelta(days=2),
                    completed_at=timezone.now() - timedelta(days=2, hours=23, minutes=45),
                    answers={
                        str(questions[0].id): {'answer': 'true', 'correct': True, 'timeSpent': 15},
                        str(questions[1].id): {'answer': 'false', 'correct': True, 'timeSpent': 20},
                        str(questions[2].id): {'answer': 'true', 'correct': False, 'timeSpent': 18},
                        str(questions[3].id): {'answer': 'true', 'correct': True, 'timeSpent': 12},
                        str(questions[4].id): {'answer': 'false', 'correct': True, 'timeSpent': 25},
                    },
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  ✓ Created completed quiz attempt: {completed_attempt.percentage_score}% on '{quiz.title}'"
                    )
                )

                # Create an in-progress attempt
                QuizAttempt.objects.create(
                    quiz=quiz,
                    user=user,
                    score=2,
                    total_questions=5,
                    started_at=timezone.now() - timedelta(hours=1),
                    answers={
                        str(questions[0].id): {'answer': 'true', 'correct': True, 'timeSpent': 10},
                        str(questions[1].id): {'answer': 'false', 'correct': True, 'timeSpent': 15},
                    },
                )
                self.stdout.write(self.style.SUCCESS(f"  ✓ Created in-progress quiz attempt on '{quiz.title}'"))
            else:
                self.stdout.write(self.style.WARNING('  ! No questions found in quiz'))
        else:
            self.stdout.write(self.style.WARNING('  ! No published quizzes found to create attempts'))

        # Summary
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(self.style.SUCCESS('✓ Successfully populated allie user with fake data!'))
        self.stdout.write('\nSummary:')
        self.stdout.write(f'  • User profile updated with role: {user.get_role_display()}')
        self.stdout.write(f'  • Projects: {user.projects.count()}')
        self.stdout.write(f'  • Conversations: {user.conversations.count()}')
        self.stdout.write(f'  • Quiz attempts: {user.quiz_attempts.count()}')
        self.stdout.write('=' * 50)
