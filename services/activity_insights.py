"""
Activity Insights Service

Aggregates meaningful activity data for users including:
- Tool engagement from projects and quizzes
- Topic interests based on activity
- Activity trends over time
- Personalized insights
"""

import logging
from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone

from core.logging_utils import StructuredLogger

logger = logging.getLogger(__name__)


class ActivityInsightsService:
    """Service for generating user activity insights."""

    def __init__(self, user):
        self.user = user

    def get_full_insights(self):
        """Get comprehensive activity insights for the user."""
        try:
            StructuredLogger.log_service_operation(
                service_name='ActivityInsightsService',
                operation='get_full_insights',
                user=self.user,
                success=True,
            )

            return {
                'tool_engagement': self.get_tool_engagement(),
                'topic_interests': self.get_topic_interests(),
                'activity_trends': self.get_activity_trends(),
                'points_by_category': self.get_points_by_category(),
                'insights': self.get_personalized_insights(),
                'stats_summary': self.get_stats_summary(),
            }
        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to generate activity insights',
                error=e,
                user=self.user,
                extra={'operation': 'get_full_insights'},
            )
            raise

    def get_tool_engagement(self):
        """
        Aggregate tool usage from user's projects.
        Returns tools sorted by usage frequency with metadata.
        """
        try:
            from core.projects.models import Project
            from core.tools.models import Tool

            # Get all tools from user's projects (including non-showcased)
            user_projects = Project.objects.filter(
                user=self.user,
                is_archived=False,
            ).prefetch_related('tools')

            # Count tool usage
            tool_counter = Counter()
            for project in user_projects:
                for tool in project.tools.all():
                    if tool and tool.id:  # Defensive check
                        tool_counter[tool.id] += 1

            if not tool_counter:
                return []

            # Get tool details
            tool_ids = list(tool_counter.keys())
            tools = Tool.objects.filter(id__in=tool_ids)
            tool_map = {t.id: t for t in tools}

            # Build result sorted by usage
            result = []
            for tool_id, count in tool_counter.most_common(10):  # Top 10 tools
                tool = tool_map.get(tool_id)
                if tool:
                    result.append(
                        {
                            'id': tool.id,
                            'name': tool.name or 'Unknown Tool',
                            'slug': tool.slug or '',
                            'logo_url': tool.logo_url or '',
                            'category': tool.category or '',
                            'category_display': (
                                tool.get_category_display()
                                if hasattr(tool, 'get_category_display')
                                else tool.category or ''
                            ),
                            'usage_count': count,
                        }
                    )

            return result
        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to get tool engagement',
                error=e,
                user=self.user,
                extra={'operation': 'get_tool_engagement'},
            )
            return []  # Return empty list on error to prevent breaking the whole insights

    def get_side_quests_completed(self):
        """
        Get user's completed side quests.
        Returns quests sorted by completion date with category info.
        """
        from core.thrive_circle.models import UserSideQuest

        completed_quests = (
            UserSideQuest.objects.filter(
                user=self.user,
                is_completed=True,
            )
            .select_related('side_quest', 'side_quest__category')
            .order_by('-completed_at')[:10]  # Top 10 most recent
        )

        result = []
        for user_quest in completed_quests:
            quest = user_quest.side_quest
            category = quest.category
            result.append(
                {
                    'id': str(quest.id),
                    'title': quest.title,
                    'description': quest.description,
                    'difficulty': quest.difficulty,
                    'difficulty_display': (
                        quest.get_difficulty_display() if hasattr(quest, 'get_difficulty_display') else quest.difficulty
                    ),
                    'points_awarded': user_quest.points_awarded or quest.points_reward,
                    'completed_at': user_quest.completed_at.isoformat() if user_quest.completed_at else None,
                    'category_name': category.name if category else None,
                    'category_slug': category.slug if category else None,
                    'category_icon': category.icon if category else None,
                    'category_color_from': category.color_from if category else None,
                    'category_color_to': category.color_to if category else None,
                }
            )

        return result

    def get_topic_interests(self):
        """
        Aggregate topic interests from quizzes and projects.
        Returns topics sorted by engagement level.
        """
        from core.projects.models import Project
        from core.quizzes.models import QuizAttempt

        topic_scores = defaultdict(lambda: {'quiz_count': 0, 'project_count': 0, 'points': 0})

        # Get quiz topics
        quiz_attempts = QuizAttempt.objects.filter(
            user=self.user,
            completed_at__isnull=False,
        ).select_related('quiz')

        for attempt in quiz_attempts:
            topic = attempt.quiz.topic
            if topic:
                topic_scores[topic]['quiz_count'] += 1
                # Weight by score
                topic_scores[topic]['points'] += attempt.percentage_score

        # Get project topics
        user_projects = Project.objects.filter(
            user=self.user,
            is_archived=False,
        )

        for project in user_projects:
            # Use topics from project
            for topic in project.topics or []:
                topic_scores[topic]['project_count'] += 1
                topic_scores[topic]['points'] += 10  # Base points for having a project

        # Calculate engagement scores
        result = []
        for topic, data in topic_scores.items():
            engagement_score = data['quiz_count'] * 5 + data['project_count'] * 10 + data['points'] / 10
            result.append(
                {
                    'topic': topic,
                    'topic_display': self._format_topic_display(topic),
                    'quiz_count': data['quiz_count'],
                    'project_count': data['project_count'],
                    'engagement_score': round(engagement_score, 1),
                }
            )

        # Sort by engagement score
        result.sort(key=lambda x: x['engagement_score'], reverse=True)
        return result[:8]  # Top 8 topics

    def get_activity_trends(self):
        """
        Get daily activity counts for the last 30 days.
        Used for activity heatmap/trend visualization.
        """
        from core.thrive_circle.models import PointActivity

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Get daily point activities
        activities = (
            PointActivity.objects.filter(
                user=self.user,
                created_at__gte=thirty_days_ago,
            )
            .values('created_at__date')
            .annotate(
                count=Count('id'),
                points=Sum('amount'),
            )
            .order_by('created_at__date')
        )

        # Build daily data
        daily_data = {a['created_at__date']: {'count': a['count'], 'points': a['points']} for a in activities}

        result = []
        for i in range(30):
            date = (thirty_days_ago + timedelta(days=i)).date()
            data = daily_data.get(date, {'count': 0, 'points': 0})
            result.append(
                {
                    'date': date.isoformat(),
                    'activity_count': data['count'],
                    'points': data['points'] or 0,
                }
            )

        return result

    def get_points_by_category(self):
        """
        Aggregate points by activity type/category.
        """
        from core.thrive_circle.models import PointActivity

        # Get point totals by type
        points_by_type = (
            PointActivity.objects.filter(
                user=self.user,
            )
            .values('activity_type')
            .annotate(
                total=Sum('amount'),
                count=Count('id'),
            )
            .order_by('-total')
        )

        # Map display names
        type_display = {
            'quiz_complete': 'Quizzes',
            'project_create': 'Projects Created',
            'project_update': 'Project Updates',
            'comment': 'Comments',
            'reaction': 'Reactions',
            'daily_login': 'Daily Login',
            'streak_bonus': 'Streak Bonus',
            'weekly_goal': 'Weekly Goals',
            'side_quest': 'Side Quests',
            'special_event': 'Special Events',
            'referral': 'Referrals',
            'prompt_battle': 'Prompt Battles',
            'prompt_battle_win': 'Battle Wins',
        }

        # Colors for visualization
        type_colors = {
            'quiz_complete': '#10b981',  # green
            'project_create': '#3b82f6',  # blue
            'project_update': '#6366f1',  # indigo
            'comment': '#8b5cf6',  # purple
            'reaction': '#ec4899',  # pink
            'daily_login': '#f59e0b',  # amber
            'streak_bonus': '#ef4444',  # red
            'weekly_goal': '#14b8a6',  # teal
            'side_quest': '#a855f7',  # purple
            'special_event': '#f97316',  # orange
            'referral': '#06b6d4',  # cyan
            'prompt_battle': '#f43f5e',  # rose
            'prompt_battle_win': '#fbbf24',  # yellow/gold
        }

        result = []
        for item in points_by_type:
            activity_type = item['activity_type']
            result.append(
                {
                    'activity_type': activity_type,
                    'display_name': type_display.get(activity_type, activity_type),
                    'total_points': item['total'] or 0,
                    'count': item['count'],
                    'color': type_colors.get(activity_type, '#6b7280'),
                }
            )

        return result

    def get_personalized_insights(self):
        """
        Generate personalized insights based on user activity patterns.
        """
        insights = []

        # Get tool engagement
        tools = self.get_tool_engagement()
        if tools:
            top_tool = tools[0]
            insights.append(
                {
                    'type': 'top_tool',
                    'icon': 'wrench',
                    'title': 'Your Go-To Tool',
                    'description': (
                        f"You've used {top_tool['name']} in "
                        f'{top_tool["usage_count"]} project'
                        f'{"s" if top_tool["usage_count"] > 1 else ""}.'
                    ),
                    'color': 'blue',
                }
            )

        # Get topic interests
        topics = self.get_topic_interests()
        if topics:
            top_topic = topics[0]
            insights.append(
                {
                    'type': 'top_topic',
                    'icon': 'book-open',
                    'title': 'Most Explored Topic',
                    'description': f"You're most engaged with {top_topic['topic_display']}.",
                    'color': 'purple',
                }
            )

        # Streak insight
        if hasattr(self.user, 'current_streak_days') and self.user.current_streak_days > 0:
            streak = self.user.current_streak_days
            if streak >= 7:
                insights.append(
                    {
                        'type': 'streak',
                        'icon': 'fire',
                        'title': 'On Fire!',
                        'description': f"You're on a {streak}-day streak! Keep it going!",
                        'color': 'orange',
                    }
                )
            elif streak >= 3:
                insights.append(
                    {
                        'type': 'streak',
                        'icon': 'fire',
                        'title': 'Building Momentum',
                        'description': f"{streak}-day streak! You're building great habits.",
                        'color': 'yellow',
                    }
                )

        # Quiz performance insight
        from core.quizzes.models import QuizAttempt

        recent_quizzes = QuizAttempt.objects.filter(
            user=self.user,
            completed_at__isnull=False,
        ).order_by('-completed_at')[:5]

        if recent_quizzes:
            avg_score = sum(q.percentage_score for q in recent_quizzes) / len(recent_quizzes)
            if avg_score >= 80:
                insights.append(
                    {
                        'type': 'quiz_performance',
                        'icon': 'academic-cap',
                        'title': 'Quiz Pro',
                        'description': f'Your recent quiz average is {avg_score:.0f}%! Impressive!',
                        'color': 'green',
                    }
                )

        # Activity level insight
        from core.thrive_circle.models import PointActivity

        week_ago = timezone.now() - timedelta(days=7)
        weekly_activities = PointActivity.objects.filter(
            user=self.user,
            created_at__gte=week_ago,
        ).count()

        if weekly_activities >= 10:
            insights.append(
                {
                    'type': 'activity_level',
                    'icon': 'chart-bar',
                    'title': 'Super Active',
                    'description': f"You've completed {weekly_activities} activities this week!",
                    'color': 'teal',
                }
            )
        elif weekly_activities == 0:
            insights.append(
                {
                    'type': 'activity_level',
                    'icon': 'arrow-trending-up',
                    'title': 'Time to Engage',
                    'description': 'Take a quiz or create a project to start earning points!',
                    'color': 'gray',
                }
            )

        return insights[:4]  # Return max 4 insights

    def get_stats_summary(self):
        """Get summary statistics for the user."""
        try:
            from core.battles.models import PromptBattle
            from core.projects.models import Project
            from core.quizzes.models import QuizAttempt
            from core.thrive_circle.models import PointActivity, UserSideQuest

            # Total quizzes completed
            quizzes_completed = QuizAttempt.objects.filter(
                user=self.user,
                completed_at__isnull=False,
            ).count()

            # Total projects
            projects_count = Project.objects.filter(
                user=self.user,
                is_archived=False,
            ).count()

            # Total points earned
            total_points = (
                PointActivity.objects.filter(
                    user=self.user,
                ).aggregate(total=Sum('amount'))['total']
                or 0
            )

            # Side quests completed
            side_quests_completed = UserSideQuest.objects.filter(
                user=self.user,
                is_completed=True,
            ).count()

            # Prompt battles participated in (completed battles only)
            battles_count = PromptBattle.objects.filter(
                Q(challenger=self.user) | Q(opponent=self.user),
                status='completed',
            ).count()

            return {
                'quizzes_completed': quizzes_completed,
                'projects_count': projects_count,
                'total_points': total_points,
                'side_quests_completed': side_quests_completed,
                'current_streak': getattr(self.user, 'current_streak_days', 0),
                'longest_streak': getattr(self.user, 'longest_streak_days', 0),
                'battles_count': battles_count,
            }
        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to get stats summary',
                error=e,
                user=self.user,
                extra={'operation': 'get_stats_summary'},
            )
            # Return default values on error
            return {
                'quizzes_completed': 0,
                'projects_count': 0,
                'total_points': 0,
                'side_quests_completed': 0,
                'current_streak': 0,
                'longest_streak': 0,
                'battles_count': 0,
            }

    def _format_topic_display(self, topic_slug):
        """Convert topic slug to display name."""
        # Map common topic slugs to display names
        display_map = {
            'chatbots-conversation': 'Chatbots & Conversation',
            'websites-apps': 'Websites & Apps',
            'images-video': 'Images & Video',
            'design-ui': 'Design & UI',
            'video-creative-media': 'Video & Media',
            'podcasts-education': 'Podcasts & Education',
            'games-interactive': 'Games & Interactive',
            'workflows-automation': 'Workflows & Automation',
            'productivity': 'Productivity',
            'developer-coding': 'Developer & Coding',
            'prompts-templates': 'Prompts & Templates',
            'thought-experiments': 'Thought Experiments',
            'wellness-growth': 'Wellness & Growth',
            'ai-agents-multitool': 'AI Agents',
            'ai-models-research': 'AI Research',
            'data-analytics': 'Data & Analytics',
        }
        return display_map.get(topic_slug, topic_slug.replace('-', ' ').title())
