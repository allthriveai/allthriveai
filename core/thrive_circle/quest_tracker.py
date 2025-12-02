"""
Quest Tracker Service - Auto-tracks user actions and updates quest progress.

This service listens for user actions (via signals or direct calls) and
automatically updates relevant quest progress for users who have active quests.

Action types that trigger quest progress:
- comment_created: User posted a comment
- project_created: User created a project
- project_liked: User liked/hearted a project
- quiz_completed: User completed a quiz
- quiz_perfect: User scored 100% on a quiz
- image_generated: User generated an image with Nano Banana
- github_imported: User imported a GitHub repo
- profile_viewed: User viewed another user's profile
- page_visited: User visited a specific page
- search_used: User used semantic search
- daily_login: User logged in today
"""

import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import QuestCategory, SideQuest, UserSideQuest

logger = logging.getLogger(__name__)


# Action to quest type mapping
ACTION_QUEST_MAPPING = {
    # Community actions
    'comment_created': ['comment_post', 'daily_engagement', 'daily_activity'],
    'project_liked': ['react_to_projects', 'daily_engagement', 'daily_activity'],
    'user_followed': ['follow_users', 'daily_engagement'],
    'feedback_given': ['give_feedback', 'daily_engagement', 'daily_activity'],
    # Learning actions
    'quiz_completed': ['complete_quiz', 'quiz_streak', 'daily_activity'],
    'quiz_perfect': ['perfect_quiz', 'quiz_streak'],
    'topic_explored': ['explore_topics'],
    # Creative actions
    'project_created': ['create_project', 'daily_activity'],
    'image_generated': ['generate_image', 'daily_activity'],
    'github_imported': ['import_github', 'daily_activity'],
    'description_added': ['add_description'],
    # Exploration actions
    'page_visited': ['visit_pages'],
    'profile_viewed': ['explore_profiles'],
    'search_used': ['use_search'],
    'easter_egg_found': ['find_easter_egg'],
    # Daily actions
    'daily_login': ['daily_login', 'daily_activity'],
    # Meta actions
    'streak_reached': ['streak_milestone'],
    'level_reached': ['level_up'],
}


class QuestTracker:
    """
    Service for tracking user actions and updating quest progress.

    Usage:
        from core.thrive_circle.quest_tracker import QuestTracker

        # Track a user action
        QuestTracker.track_action(user, 'comment_created', {'project_id': 123})

        # Check if user can repeat a quest
        can_repeat = QuestTracker.can_repeat_quest(user, quest)

        # Get today's daily quests for user
        daily_quests = QuestTracker.get_daily_quests(user)
    """

    @classmethod
    def track_action(cls, user, action: str, context: dict | None = None) -> list:
        """
        Track a user action and update relevant quest progress.

        Args:
            user: The user who performed the action
            action: The action type (e.g., 'comment_created', 'quiz_completed')
            context: Optional context data (e.g., {'project_id': 123, 'score': 95})

        Returns:
            List of completed quest IDs (if any were completed by this action)
        """
        context = context or {}
        completed_quests = []

        # Get quest types that match this action
        matching_quest_types = ACTION_QUEST_MAPPING.get(action, [])
        if not matching_quest_types:
            logger.debug(f'No quest types match action: {action}')
            return completed_quests

        # Get user's active quests that match these types
        active_quests = UserSideQuest.objects.filter(
            user=user,
            status='in_progress',
            is_completed=False,
            side_quest__quest_type__in=matching_quest_types,
            side_quest__is_active=True,
        ).select_related('side_quest')

        for user_quest in active_quests:
            quest = user_quest.side_quest

            # Check if this specific action matches the quest requirements
            if not cls._matches_requirements(quest, action, context):
                continue

            # Update progress
            with transaction.atomic():
                user_quest.current_progress = F('current_progress') + 1
                user_quest.progress_data = cls._update_progress_data(user_quest.progress_data, action, context)
                user_quest.save(update_fields=['current_progress', 'progress_data', 'updated_at'])

                # Refresh to get actual value after F() expression
                user_quest.refresh_from_db()

                # Check if completed
                if user_quest.current_progress >= user_quest.target_progress:
                    user_quest.complete()
                    completed_quests.append(str(quest.id))

                    logger.info(
                        'Quest completed via auto-tracking',
                        extra={
                            'user_id': user.id,
                            'quest_id': str(quest.id),
                            'quest_title': quest.title,
                            'action': action,
                        },
                    )

        return completed_quests

    @classmethod
    def _matches_requirements(cls, quest: SideQuest, action: str, context: dict) -> bool:
        """Check if the action matches the quest's specific requirements."""
        requirements = quest.requirements

        # Check action type matches
        required_action = requirements.get('action')
        if required_action and required_action != action:
            return False

        # Check timeframe if specified
        timeframe = requirements.get('timeframe')
        if timeframe:
            # For daily quests, only count actions from today
            if timeframe == 'day':
                today = timezone.now().date()
                action_date = context.get('timestamp', timezone.now()).date()
                if action_date != today:
                    return False
            # Weekly timeframe
            elif timeframe == 'week':
                week_start = timezone.now().date() - timedelta(days=timezone.now().weekday())
                action_date = context.get('timestamp', timezone.now()).date()
                if action_date < week_start:
                    return False

        # Check minimum score for quiz quests
        min_score = requirements.get('min_score')
        if min_score and action in ['quiz_completed', 'quiz_perfect']:
            score = context.get('score', 0)
            if score < min_score:
                return False

        # Check specific topic if required
        required_topic = requirements.get('topic')
        if required_topic:
            action_topic = context.get('topic')
            if action_topic != required_topic:
                return False

        return True

    @classmethod
    def _update_progress_data(cls, progress_data: dict, action: str, context: dict) -> dict:
        """Update progress data with action details."""
        if not progress_data:
            progress_data = {}

        # Track last activity
        progress_data['last_activity'] = timezone.now().isoformat()
        progress_data['last_action'] = action

        # Track unique items (e.g., unique projects commented on)
        if 'unique_items' not in progress_data:
            progress_data['unique_items'] = []

        item_id = context.get('item_id') or context.get('project_id') or context.get('quiz_id')
        if item_id and item_id not in progress_data['unique_items']:
            progress_data['unique_items'].append(item_id)

        # Track action count
        action_key = f'{action}_count'
        progress_data[action_key] = progress_data.get(action_key, 0) + 1

        return progress_data

    @classmethod
    def can_repeat_quest(cls, user, quest: SideQuest) -> bool:
        """Check if a user can repeat a repeatable quest."""
        if not quest.is_repeatable:
            return False

        # Get user's most recent completion of this quest
        last_completion = (
            UserSideQuest.objects.filter(
                user=user,
                side_quest=quest,
                is_completed=True,
            )
            .order_by('-completed_at')
            .first()
        )

        if not last_completion:
            return True  # Never completed, can start

        if not last_completion.completed_at:
            return True  # Completed but no timestamp, allow repeat

        # Check cooldown
        cooldown_delta = timedelta(hours=quest.repeat_cooldown_hours)
        can_repeat_at = last_completion.completed_at + cooldown_delta

        return timezone.now() >= can_repeat_at

    @classmethod
    def get_daily_quests(cls, user, limit: int = 3) -> list:
        """
        Get today's daily quests for a user.

        Returns a mix of:
        - Any daily quests the user has in progress
        - New daily quests they haven't started yet

        Args:
            user: The user
            limit: Max number of daily quests to return

        Returns:
            List of SideQuest objects
        """
        today = timezone.now().date()

        # Get daily quests the user is already working on
        in_progress = list(
            SideQuest.objects.filter(
                is_daily=True,
                is_active=True,
                user_progresses__user=user,
                user_progresses__status='in_progress',
            ).distinct()[:limit]
        )

        if len(in_progress) >= limit:
            return in_progress

        # Get available daily quests the user hasn't started today
        remaining_slots = limit - len(in_progress)
        in_progress_ids = [q.id for q in in_progress]

        available = list(
            SideQuest.objects.filter(
                is_daily=True,
                is_active=True,
            )
            .exclude(id__in=in_progress_ids)
            .exclude(
                # Exclude quests completed today
                user_progresses__user=user,
                user_progresses__completed_at__date=today,
            )
            .order_by('?')[:remaining_slots]  # Random selection
        )

        return in_progress + available

    @classmethod
    def auto_start_daily_quests(cls, user) -> list:
        """
        Automatically start today's daily quests for a user.

        Called on login or when viewing the side quests page.

        Returns:
            List of newly started UserSideQuest objects
        """
        daily_quests = cls.get_daily_quests(user)
        started = []

        for quest in daily_quests:
            # Check if already started
            existing = UserSideQuest.objects.filter(user=user, side_quest=quest).first()
            if existing:
                continue

            # Start the quest
            target = quest.requirements.get('target', 1)
            user_quest = UserSideQuest.objects.create(
                user=user,
                side_quest=quest,
                status='in_progress',
                current_progress=0,
                target_progress=target,
            )
            started.append(user_quest)

            logger.info(
                'Auto-started daily quest for user',
                extra={
                    'user_id': user.id,
                    'quest_id': str(quest.id),
                    'quest_title': quest.title,
                },
            )

        return started

    @classmethod
    def get_category_progress(cls, user, category: QuestCategory) -> dict:
        """
        Get user's progress in a quest category.

        Returns:
            {
                'total_quests': 5,
                'completed_quests': 3,
                'in_progress_quests': 1,
                'completion_percentage': 60,
                'is_complete': False,
                'bonus_claimed': False,
            }
        """
        quests = category.quests.filter(is_active=True)
        total = quests.count()

        user_quests = UserSideQuest.objects.filter(
            user=user,
            side_quest__category=category,
            side_quest__is_active=True,
        )

        completed = user_quests.filter(is_completed=True).count()
        in_progress = user_quests.filter(status='in_progress', is_completed=False).count()

        # Check if user has claimed category completion bonus
        bonus_claimed = user_quests.filter(
            side_quest__quest_type='category_complete',
            is_completed=True,
        ).exists()

        return {
            'total_quests': total,
            'completed_quests': completed,
            'in_progress_quests': in_progress,
            'completion_percentage': int(completed / total * 100) if total > 0 else 0,
            'is_complete': completed >= total and total > 0,
            'bonus_claimed': bonus_claimed,
        }


# Convenience function for use in signals
def track_quest_action(user, action: str, context: dict | None = None) -> list:
    """Convenience wrapper for QuestTracker.track_action."""
    return QuestTracker.track_action(user, action, context)
