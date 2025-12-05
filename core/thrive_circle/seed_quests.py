"""
Seed data for Quest Categories and Side Quests.

Run this after migrations to populate initial quest data:
    python manage.py shell < core/thrive_circle/seed_quests.py

Or import and call seed_all_quests() from a data migration.
"""

import logging

logger = logging.getLogger(__name__)


def seed_categories():
    """Create the initial quest categories."""
    from core.thrive_circle.models import QuestCategory

    categories = [
        {
            'name': 'Community Builder',
            'slug': 'community-builder',
            'description': 'Connect with fellow creators! Comment on projects, share feedback, and help others grow.',
            'category_type': 'community',
            'icon': 'faUsers',
            'color_from': 'pink-500',
            'color_to': 'rose-500',
            'completion_bonus_points': 150,
            'order': 1,
            'is_featured': True,
        },
        {
            'name': 'Learning Explorer',
            'slug': 'learning-explorer',
            'description': 'Expand your AI knowledge! Complete quizzes, explore new topics, and level up your skills.',
            'category_type': 'learning',
            'icon': 'faGraduationCap',
            'color_from': 'blue-500',
            'color_to': 'indigo-500',
            'completion_bonus_points': 200,
            'order': 2,
            'is_featured': True,
        },
        {
            'name': 'Creative Maker',
            'slug': 'creative-maker',
            'description': (
                'Show off your creativity! Create projects, generate images with Nano Banana, and build your portfolio.'
            ),
            'category_type': 'creative',
            'icon': 'faPaintBrush',
            'color_from': 'purple-500',
            'color_to': 'violet-500',
            'completion_bonus_points': 200,
            'order': 3,
            'is_featured': True,
        },
        {
            'name': 'Site Explorer',
            'slug': 'site-explorer',
            'description': 'Discover all AllThrive has to offer! A scavenger hunt through features and hidden gems.',
            'category_type': 'exploration',
            'icon': 'faCompass',
            'color_from': 'emerald-500',
            'color_to': 'teal-500',
            'completion_bonus_points': 100,
            'order': 4,
            'is_featured': False,
        },
        {
            'name': 'Daily Challenges',
            'slug': 'daily-challenges',
            'description': 'Quick daily tasks to keep you engaged and earning points every day!',
            'category_type': 'daily',
            'icon': 'faCalendarCheck',
            'color_from': 'amber-500',
            'color_to': 'orange-500',
            'completion_bonus_points': 50,
            'order': 5,
            'is_featured': True,
        },
    ]

    created_categories = {}
    for cat_data in categories:
        cat, created = QuestCategory.objects.update_or_create(
            slug=cat_data['slug'],
            defaults=cat_data,
        )
        created_categories[cat.slug] = cat
        status = 'Created' if created else 'Updated'
        logger.info(f'{status} category: {cat.name}')

    return created_categories


def seed_community_quests(category):
    """Create community engagement quests."""
    from core.thrive_circle.models import SideQuest

    quests = [
        {
            'title': 'Spread Encouragement',
            'description': "Leave a comment on someone else's project. Your feedback makes a difference!",
            'quest_type': 'comment_post',
            'difficulty': 'easy',
            'requirements': {'action': 'comment_created', 'target': 1},
            'points_reward': 15,
            'order': 1,
        },
        {
            'title': 'Friendly Neighbor',
            'description': 'Comment on 3 different projects to connect with the community.',
            'quest_type': 'comment_post',
            'difficulty': 'easy',
            'requirements': {'action': 'comment_created', 'target': 3},
            'points_reward': 30,
            'order': 2,
        },
        {
            'title': 'Community Voice',
            'description': 'Leave thoughtful comments on 10 projects. Your feedback matters!',
            'quest_type': 'comment_post',
            'difficulty': 'medium',
            'requirements': {'action': 'comment_created', 'target': 10},
            'points_reward': 75,
            'order': 3,
        },
        {
            'title': 'Show Some Love',
            'description': 'Like 5 projects that inspire you.',
            'quest_type': 'react_to_projects',
            'difficulty': 'easy',
            'requirements': {'action': 'project_liked', 'target': 5},
            'points_reward': 20,
            'order': 4,
        },
        {
            'title': 'Heart Giver',
            'description': 'Like 25 amazing projects across the community.',
            'quest_type': 'react_to_projects',
            'difficulty': 'medium',
            'requirements': {'action': 'project_liked', 'target': 25},
            'points_reward': 50,
            'order': 5,
        },
        {
            'title': 'Profile Hunter',
            'description': 'Discover 5 creators by visiting their profiles.',
            'quest_type': 'explore_profiles',
            'difficulty': 'easy',
            'requirements': {'action': 'profile_viewed', 'target': 5},
            'points_reward': 25,
            'order': 6,
        },
    ]

    for quest_data in quests:
        quest_data['category'] = category
        quest, created = SideQuest.objects.update_or_create(
            title=quest_data['title'],
            category=category,
            defaults=quest_data,
        )
        status = 'Created' if created else 'Updated'
        logger.info(f'{status} quest: {quest.title}')


def seed_learning_quests(category):
    """Create learning/quiz quests."""
    from core.thrive_circle.models import SideQuest

    quests = [
        {
            'title': 'Quiz Starter',
            'description': 'Complete a quiz to test your AI knowledge!',
            'quest_type': 'complete_quiz',
            'difficulty': 'easy',
            'requirements': {'action': 'quiz_completed', 'target': 1},
            'points_reward': 20,
            'order': 1,
        },
        {
            'title': 'Quiz Enthusiast',
            'description': 'Complete 5 quizzes to expand your knowledge.',
            'quest_type': 'complete_quiz',
            'difficulty': 'medium',
            'requirements': {'action': 'quiz_completed', 'target': 5},
            'points_reward': 50,
            'order': 2,
        },
        {
            'title': 'Quiz Master',
            'description': 'Complete 15 quizzes across different topics.',
            'quest_type': 'complete_quiz',
            'difficulty': 'hard',
            'requirements': {'action': 'quiz_completed', 'target': 15},
            'points_reward': 100,
            'order': 3,
        },
        {
            'title': 'Perfectionist',
            'description': 'Score 100% on any quiz. You got this!',
            'quest_type': 'perfect_quiz',
            'difficulty': 'medium',
            'requirements': {'action': 'quiz_perfect', 'target': 1, 'min_score': 100},
            'points_reward': 40,
            'order': 4,
        },
        {
            'title': 'Flawless',
            'description': 'Achieve perfect scores on 5 different quizzes.',
            'quest_type': 'perfect_quiz',
            'difficulty': 'hard',
            'requirements': {'action': 'quiz_perfect', 'target': 5, 'min_score': 100},
            'points_reward': 100,
            'order': 5,
        },
        {
            'title': 'Topic Explorer',
            'description': 'Try quizzes in 3 different topics to broaden your horizons.',
            'quest_type': 'explore_topics',
            'difficulty': 'medium',
            'requirements': {'action': 'quiz_completed', 'target': 3, 'unique_topics': True},
            'points_reward': 60,
            'order': 6,
        },
    ]

    for quest_data in quests:
        quest_data['category'] = category
        quest, created = SideQuest.objects.update_or_create(
            title=quest_data['title'],
            category=category,
            defaults=quest_data,
        )
        status = 'Created' if created else 'Updated'
        logger.info(f'{status} quest: {quest.title}')


def seed_creative_quests(category):
    """Create project/creative quests."""
    from core.thrive_circle.models import SideQuest

    quests = [
        # === BEGINNER QUESTS ===
        {
            'title': 'First Creation',
            'description': 'Create your very first project to start building your portfolio!',
            'quest_type': 'create_project',
            'difficulty': 'easy',
            'requirements': {'action': 'project_created', 'target': 1},
            'points_reward': 25,
            'order': 1,
            'narrative_intro': (
                'Welcome to the Creative Maker path! Every great portfolio starts with a single project. '
                "Whether it's an AI chatbot, a design, or a prompt collection - let's showcase your first creation."
            ),
            'narrative_complete': (
                "Congratulations! You've created your first project. This is the beginning of your creative journey. "
                'Your work is now visible to the AllThrive community!'
            ),
        },
        {
            'title': 'Banana Time',
            'description': 'Generate your first AI image with Nano Banana!',
            'quest_type': 'generate_image',
            'difficulty': 'easy',
            'requirements': {'action': 'image_generated', 'target': 1},
            'points_reward': 20,
            'order': 2,
            'narrative_intro': (
                'Ready to create some AI art? Nano Banana is our friendly image generator. '
                'Head to the Banana tool and bring your imagination to life!'
            ),
            'narrative_complete': (
                'Look at you, digital artist! Your first AI-generated image is born. ' 'The possibilities are endless!'
            ),
        },
        {
            'title': 'GitHub Showcase',
            'description': 'Import a project from GitHub to showcase your code.',
            'quest_type': 'import_github',
            'difficulty': 'easy',
            'requirements': {'action': 'github_imported', 'target': 1},
            'points_reward': 30,
            'order': 3,
            'narrative_intro': (
                "Got cool code on GitHub? Let's bring it over! Import a repository to auto-generate "
                'a beautiful project page with AI-powered descriptions.'
            ),
            'narrative_complete': (
                'Your GitHub project now has a home on AllThrive! ' 'The AI has helped create a polished showcase page.'
            ),
        },
        # === GUIDED MULTI-STEP QUEST ===
        {
            'title': 'Complete Creator Journey',
            'description': 'A guided adventure through all the creative tools on AllThrive.',
            'quest_type': 'create_project',
            'difficulty': 'medium',
            'requirements': {'action': 'guided_steps', 'target': 4},
            'points_reward': 100,
            'order': 4,
            'is_guided': True,
            'estimated_minutes': 15,
            'narrative_intro': (
                'Welcome to the Complete Creator Journey! This guided quest will take you through '
                "all the ways you can showcase your work on AllThrive. By the end, you'll be a pro "
                'at using our creative tools.'
            ),
            'narrative_complete': (
                "You've completed the Creator Journey! You now know all the ways to build your "
                'portfolio on AllThrive. Keep creating and inspiring others!'
            ),
            'steps': [
                {
                    'id': 'step_create',
                    'title': 'Create a Project',
                    'description': 'Start by creating any type of project using the Project Agent.',
                    'destination_url': '/projects/new',
                    'action_trigger': 'project_created',
                    'icon': 'plus',
                },
                {
                    'id': 'step_banana',
                    'title': 'Generate an Image',
                    'description': 'Try out Nano Banana to create AI art.',
                    'destination_url': '/tools/banana',
                    'action_trigger': 'image_generated',
                    'icon': 'sparkles',
                },
                {
                    'id': 'step_describe',
                    'title': 'Add a Rich Description',
                    'description': 'Edit your project to add a detailed description.',
                    'destination_url': '/projects',
                    'action_trigger': 'description_added',
                    'icon': 'pencil',
                },
                {
                    'id': 'step_showcase',
                    'title': 'Add to Showcase',
                    'description': "Mark a project as 'Showcase' to feature it on your profile.",
                    'destination_url': '/projects',
                    'action_trigger': 'showcase_added',
                    'icon': 'star',
                },
            ],
        },
        # === INTERMEDIATE QUESTS ===
        {
            'title': 'Portfolio Pro',
            'description': 'Build a portfolio with 5 projects to showcase your range.',
            'quest_type': 'create_project',
            'difficulty': 'medium',
            'requirements': {'action': 'project_created', 'target': 5},
            'points_reward': 75,
            'order': 5,
            'narrative_intro': (
                'Time to show your range! A diverse portfolio with multiple projects ' 'shows the depth of your skills.'
            ),
            'narrative_complete': (
                'Impressive! You now have 5 projects in your portfolio. ' "That's a solid foundation!"
            ),
        },
        {
            'title': 'Digital Artist',
            'description': 'Generate 10 unique images with Nano Banana.',
            'quest_type': 'generate_image',
            'difficulty': 'medium',
            'requirements': {'action': 'image_generated', 'target': 10},
            'points_reward': 60,
            'order': 6,
            'narrative_intro': 'Practice makes perfect! Keep experimenting with different prompts and styles.',
            'narrative_complete': "You're becoming a true digital artist! 10 AI creations and counting.",
        },
        {
            'title': 'Code Portfolio',
            'description': 'Import 3 GitHub repositories to showcase your coding projects.',
            'quest_type': 'import_github',
            'difficulty': 'medium',
            'requirements': {'action': 'github_imported', 'target': 3},
            'points_reward': 60,
            'order': 7,
        },
        {
            'title': 'Storyteller',
            'description': 'Add detailed descriptions to 3 of your projects.',
            'quest_type': 'add_description',
            'difficulty': 'medium',
            'requirements': {'action': 'description_added', 'target': 3, 'min_length': 100},
            'points_reward': 45,
            'order': 8,
            'narrative_intro': ('Great projects deserve great descriptions! Tell the story behind your work.'),
            'narrative_complete': (
                'Your projects now have compelling stories. ' 'This helps others understand your creative process!'
            ),
        },
        # === ADVANCED QUESTS ===
        {
            'title': 'Prolific Creator',
            'description': 'Create 15 amazing projects across any category.',
            'quest_type': 'create_project',
            'difficulty': 'hard',
            'requirements': {'action': 'project_created', 'target': 15},
            'points_reward': 150,
            'order': 9,
            'narrative_complete': (
                "15 projects! You're a true creative force on AllThrive. " 'Your portfolio is impressive!'
            ),
        },
        {
            'title': 'Gallery Master',
            'description': 'Generate 50 images with Nano Banana to master AI art.',
            'quest_type': 'generate_image',
            'difficulty': 'hard',
            'requirements': {'action': 'image_generated', 'target': 50},
            'points_reward': 120,
            'order': 10,
            'narrative_complete': (
                "50 AI images! You've truly mastered the art of AI generation. " 'Consider showcasing your best work!'
            ),
        },
        # === EPIC QUEST ===
        {
            'title': 'Creative Legend',
            'description': 'Create 30 projects and become a creative legend on AllThrive.',
            'quest_type': 'create_project',
            'difficulty': 'epic',
            'requirements': {'action': 'project_created', 'target': 30},
            'points_reward': 300,
            'order': 11,
            'narrative_intro': (
                'This is the ultimate creative challenge. ' 'Only the most dedicated creators earn this badge.'
            ),
            'narrative_complete': (
                'YOU ARE A CREATIVE LEGEND! 30 projects is an incredible achievement. '
                'Your dedication to creating and sharing inspires the entire community!'
            ),
        },
    ]

    for quest_data in quests:
        quest_data['category'] = category
        quest, created = SideQuest.objects.update_or_create(
            title=quest_data['title'],
            category=category,
            defaults=quest_data,
        )
        status = 'Created' if created else 'Updated'
        logger.info(f'{status} quest: {quest.title}')


def seed_exploration_quests(category):
    """Create site exploration/scavenger hunt quests."""
    from core.thrive_circle.models import SideQuest

    quests = [
        # === BEGINNER EXPLORATION ===
        {
            'title': 'First Search',
            'description': 'Use the semantic search to discover projects that match your interests.',
            'quest_type': 'use_search',
            'difficulty': 'easy',
            'requirements': {'action': 'search_used', 'target': 1},
            'points_reward': 15,
            'order': 1,
            'narrative_intro': (
                "AllThrive has a powerful semantic search that understands what you're looking for. "
                'Try searching for topics that interest you - you might discover something amazing!'
            ),
            'narrative_complete': (
                "Great job! You've discovered the power of semantic search. " 'Use it to find exactly what you need!'
            ),
        },
        {
            'title': 'Profile Hopper',
            'description': 'Visit 5 different creator profiles to see what others are building.',
            'quest_type': 'explore_profiles',
            'difficulty': 'easy',
            'requirements': {'action': 'profile_viewed', 'target': 5},
            'points_reward': 20,
            'order': 2,
            'narrative_intro': (
                'Each creator on AllThrive has a unique story. '
                "Let's explore some profiles and see what inspires you!"
            ),
            'narrative_complete': (
                "You've started building connections! " 'Keep exploring to find creators who inspire you.'
            ),
        },
        # === GUIDED SITE TOUR ===
        {
            'title': 'AllThrive Grand Tour',
            'description': 'A guided scavenger hunt through all the major features of AllThrive.',
            'quest_type': 'visit_pages',
            'difficulty': 'medium',
            'requirements': {'action': 'guided_steps', 'target': 6},
            'points_reward': 120,
            'order': 3,
            'is_guided': True,
            'estimated_minutes': 10,
            'narrative_intro': (
                'Welcome to the AllThrive Grand Tour! This guided adventure will take you through '
                "all the major features of our platform. By the end, you'll know exactly where to find "
                'everything and what AllThrive has to offer.'
            ),
            'narrative_complete': (
                "Congratulations, Explorer! You've completed the Grand Tour and discovered all that "
                "AllThrive has to offer. You're now ready to make the most of the platform!"
            ),
            'steps': [
                {
                    'id': 'step_explore',
                    'title': 'Visit Explore',
                    'description': 'Check out the Explore page to discover projects from the community.',
                    'destination_url': '/explore',
                    'action_trigger': 'page_visit',
                    'icon': 'compass',
                },
                {
                    'id': 'step_learn',
                    'title': 'Visit Learn',
                    'description': 'Head to the Learn section to test your AI knowledge with quizzes.',
                    'destination_url': '/learn',
                    'action_trigger': 'page_visit',
                    'icon': 'book',
                },
                {
                    'id': 'step_play',
                    'title': 'Visit Play',
                    'description': 'Check out the Play section for Side Quests and Challenges.',
                    'destination_url': '/play',
                    'action_trigger': 'page_visit',
                    'icon': 'gamepad',
                },
                {
                    'id': 'step_tools',
                    'title': 'Visit Tools',
                    'description': 'Explore the Tools section to discover AI-powered utilities.',
                    'destination_url': '/tools',
                    'action_trigger': 'page_visit',
                    'icon': 'wrench',
                },
                {
                    'id': 'step_battles',
                    'title': 'Visit Prompt Battles',
                    'description': 'Check out Prompt Battles where AI creations compete!',
                    'destination_url': '/battles',
                    'action_trigger': 'page_visit',
                    'icon': 'trophy',
                },
                {
                    'id': 'step_marketplace',
                    'title': 'Visit Marketplace',
                    'description': 'Explore the Marketplace to discover digital products from creators.',
                    'destination_url': '/marketplace',
                    'action_trigger': 'page_visit',
                    'icon': 'shop',
                },
            ],
        },
        # === INTERMEDIATE EXPLORATION ===
        {
            'title': 'Search Expert',
            'description': 'Perform 10 different searches to master discovering content.',
            'quest_type': 'use_search',
            'difficulty': 'medium',
            'requirements': {'action': 'search_used', 'target': 10},
            'points_reward': 40,
            'order': 4,
            'narrative_complete': (
                "You've become a search expert! " "Now you can find exactly what you're looking for."
            ),
        },
        {
            'title': 'Community Explorer',
            'description': 'Visit 15 different creator profiles and discover their work.',
            'quest_type': 'explore_profiles',
            'difficulty': 'medium',
            'requirements': {'action': 'profile_viewed', 'target': 15},
            'points_reward': 45,
            'order': 5,
        },
        {
            'title': 'Project Hunter',
            'description': 'View 20 different projects across the platform.',
            'quest_type': 'visit_pages',
            'difficulty': 'medium',
            'requirements': {'action': 'project_viewed', 'target': 20},
            'points_reward': 50,
            'order': 6,
            'narrative_intro': "There are amazing projects waiting to be discovered. Let's go hunting!",
            'narrative_complete': "You've explored 20 projects! You're really getting to know the community.",
        },
        # === ADVANCED EXPLORATION ===
        {
            'title': 'Network Builder',
            'description': 'Discover 30 creators on the platform by visiting their profiles.',
            'quest_type': 'explore_profiles',
            'difficulty': 'hard',
            'requirements': {'action': 'profile_viewed', 'target': 30},
            'points_reward': 80,
            'order': 7,
            'narrative_complete': (
                "30 profiles explored! You're building quite the network. " 'Consider following some of these creators!'
            ),
        },
        {
            'title': 'Search Master',
            'description': 'Perform 50 searches and become the ultimate discovery expert.',
            'quest_type': 'use_search',
            'difficulty': 'hard',
            'requirements': {'action': 'search_used', 'target': 50},
            'points_reward': 100,
            'order': 8,
        },
        {
            'title': 'Topic Voyager',
            'description': 'Explore projects in 5 different topic categories.',
            'quest_type': 'visit_pages',
            'difficulty': 'medium',
            'requirements': {'action': 'topic_explored', 'target': 5, 'unique_topics': True},
            'points_reward': 60,
            'order': 9,
            'narrative_intro': (
                'AllThrive has projects across many topics. ' "Let's see what different categories have to offer!"
            ),
            'narrative_complete': (
                "You've explored 5 different topic areas. " 'Diversity of interests makes for a richer experience!'
            ),
        },
        # === EASTER EGG / FUN QUESTS ===
        {
            'title': 'Night Owl',
            'description': 'Visit the site between midnight and 4 AM. (Just kidding, any time works!)',
            'quest_type': 'find_easter_egg',
            'difficulty': 'easy',
            'requirements': {'action': 'page_visit', 'target': 1, 'special': 'night_mode'},
            'points_reward': 25,
            'order': 10,
            'narrative_intro': 'Some say the site looks different at night...',
            'narrative_complete': 'You found the Night Owl easter egg! Thanks for exploring at all hours.',
        },
        {
            'title': 'Style Guide Detective',
            'description': 'Find and visit the secret style guide page.',
            'quest_type': 'find_easter_egg',
            'difficulty': 'medium',
            'requirements': {'action': 'page_visit', 'target': 1, 'page': '/styleguide-neon'},
            'points_reward': 50,
            'order': 11,
            'narrative_intro': (
                "Rumor has it there's a hidden style guide page " 'showcasing the Neon Glass aesthetic...'
            ),
            'narrative_complete': (
                'You found the style guide! ' 'Now you know the secrets behind the AllThrive design system.'
            ),
        },
        # === EPIC EXPLORATION ===
        {
            'title': 'AllThrive Cartographer',
            'description': 'Explore 100 unique projects and map the entire AllThrive universe.',
            'quest_type': 'visit_pages',
            'difficulty': 'epic',
            'requirements': {'action': 'project_viewed', 'target': 100},
            'points_reward': 200,
            'order': 12,
            'narrative_intro': 'Only true explorers take on this challenge. Can you discover 100 unique projects?',
            'narrative_complete': (
                "LEGENDARY! You've explored 100 projects and truly mapped the AllThrive universe. "
                'Your knowledge of the community is unmatched!'
            ),
        },
    ]

    for quest_data in quests:
        quest_data['category'] = category
        quest, created = SideQuest.objects.update_or_create(
            title=quest_data['title'],
            category=category,
            defaults=quest_data,
        )
        status = 'Created' if created else 'Updated'
        logger.info(f'{status} quest: {quest.title}')


def seed_daily_quests(category):
    """Create rotating daily quests."""
    from core.thrive_circle.models import SideQuest

    quests = [
        {
            'title': 'Daily Check-In',
            'description': 'Log in today to continue your streak!',
            'quest_type': 'daily_login',
            'difficulty': 'easy',
            'requirements': {'action': 'daily_login', 'target': 1, 'timeframe': 'day'},
            'points_reward': 10,
            'order': 1,
            'is_daily': True,
            'is_repeatable': True,
            'repeat_cooldown_hours': 20,  # Can repeat after 20 hours
        },
        {
            'title': 'Daily Comment',
            'description': "Leave a comment on someone's project today.",
            'quest_type': 'daily_engagement',
            'difficulty': 'easy',
            'requirements': {'action': 'comment_created', 'target': 1, 'timeframe': 'day'},
            'points_reward': 15,
            'order': 2,
            'is_daily': True,
            'is_repeatable': True,
            'repeat_cooldown_hours': 20,
        },
        {
            'title': 'Daily Like',
            'description': 'Show appreciation by liking 3 projects today.',
            'quest_type': 'daily_engagement',
            'difficulty': 'easy',
            'requirements': {'action': 'project_liked', 'target': 3, 'timeframe': 'day'},
            'points_reward': 12,
            'order': 3,
            'is_daily': True,
            'is_repeatable': True,
            'repeat_cooldown_hours': 20,
        },
        {
            'title': 'Daily Quiz',
            'description': 'Complete a quiz today to keep learning!',
            'quest_type': 'daily_activity',
            'difficulty': 'easy',
            'requirements': {'action': 'quiz_completed', 'target': 1, 'timeframe': 'day'},
            'points_reward': 15,
            'order': 4,
            'is_daily': True,
            'is_repeatable': True,
            'repeat_cooldown_hours': 20,
        },
        {
            'title': 'Daily Explorer',
            'description': 'Visit 2 creator profiles today.',
            'quest_type': 'daily_activity',
            'difficulty': 'easy',
            'requirements': {'action': 'profile_viewed', 'target': 2, 'timeframe': 'day'},
            'points_reward': 10,
            'order': 5,
            'is_daily': True,
            'is_repeatable': True,
            'repeat_cooldown_hours': 20,
        },
    ]

    for quest_data in quests:
        quest_data['category'] = category
        quest, created = SideQuest.objects.update_or_create(
            title=quest_data['title'],
            category=category,
            defaults=quest_data,
        )
        status = 'Created' if created else 'Updated'
        logger.info(f'{status} quest: {quest.title}')


def seed_all_quests():
    """Seed all categories and quests."""
    logger.info('Seeding quest categories and quests...')

    # Create categories
    categories = seed_categories()

    # Seed quests for each category
    if 'community-builder' in categories:
        seed_community_quests(categories['community-builder'])

    if 'learning-explorer' in categories:
        seed_learning_quests(categories['learning-explorer'])

    if 'creative-maker' in categories:
        seed_creative_quests(categories['creative-maker'])

    if 'site-explorer' in categories:
        seed_exploration_quests(categories['site-explorer'])

    if 'daily-challenges' in categories:
        seed_daily_quests(categories['daily-challenges'])

    logger.info('Quest seeding complete!')


if __name__ == '__main__':
    import django

    django.setup()
    seed_all_quests()
