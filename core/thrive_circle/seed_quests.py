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
                'Show off your creativity! Create projects, generate images with Nano Banana, '
                'and build your portfolio.'
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
            'title': 'First Comment',
            'description': "Leave your first comment on someone else's project. Spread some encouragement!",
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
            'title': 'First Quiz',
            'description': 'Complete your first quiz to test your AI knowledge!',
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
        {
            'title': 'First Project',
            'description': 'Create your first project to start building your portfolio!',
            'quest_type': 'create_project',
            'difficulty': 'easy',
            'requirements': {'action': 'project_created', 'target': 1},
            'points_reward': 25,
            'order': 1,
        },
        {
            'title': 'Portfolio Builder',
            'description': 'Create 5 projects to showcase your work.',
            'quest_type': 'create_project',
            'difficulty': 'medium',
            'requirements': {'action': 'project_created', 'target': 5},
            'points_reward': 75,
            'order': 2,
        },
        {
            'title': 'Prolific Creator',
            'description': 'Create 15 amazing projects.',
            'quest_type': 'create_project',
            'difficulty': 'hard',
            'requirements': {'action': 'project_created', 'target': 15},
            'points_reward': 150,
            'order': 3,
        },
        {
            'title': 'Banana Time',
            'description': 'Generate your first image with Nano Banana!',
            'quest_type': 'generate_image',
            'difficulty': 'easy',
            'requirements': {'action': 'image_generated', 'target': 1},
            'points_reward': 20,
            'order': 4,
        },
        {
            'title': 'Digital Artist',
            'description': 'Generate 10 images with Nano Banana.',
            'quest_type': 'generate_image',
            'difficulty': 'medium',
            'requirements': {'action': 'image_generated', 'target': 10},
            'points_reward': 60,
            'order': 5,
        },
        {
            'title': 'GitHub Importer',
            'description': 'Import a project from GitHub to showcase your code.',
            'quest_type': 'import_github',
            'difficulty': 'easy',
            'requirements': {'action': 'github_imported', 'target': 1},
            'points_reward': 30,
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


def seed_exploration_quests(category):
    """Create site exploration/scavenger hunt quests."""
    from core.thrive_circle.models import SideQuest

    quests = [
        {
            'title': 'Search Seeker',
            'description': 'Use the semantic search feature to find interesting projects.',
            'quest_type': 'use_search',
            'difficulty': 'easy',
            'requirements': {'action': 'search_used', 'target': 1},
            'points_reward': 15,
            'order': 1,
        },
        {
            'title': 'Search Pro',
            'description': "Perform 10 searches to find exactly what you're looking for.",
            'quest_type': 'use_search',
            'difficulty': 'medium',
            'requirements': {'action': 'search_used', 'target': 10},
            'points_reward': 40,
            'order': 2,
        },
        {
            'title': 'Profile Explorer',
            'description': 'Visit 10 different creator profiles.',
            'quest_type': 'explore_profiles',
            'difficulty': 'easy',
            'requirements': {'action': 'profile_viewed', 'target': 10},
            'points_reward': 30,
            'order': 3,
        },
        {
            'title': 'Network Builder',
            'description': 'Discover 25 creators on the platform.',
            'quest_type': 'explore_profiles',
            'difficulty': 'medium',
            'requirements': {'action': 'profile_viewed', 'target': 25},
            'points_reward': 60,
            'order': 4,
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
