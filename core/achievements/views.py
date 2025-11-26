"""API views for achievements."""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Achievement, AchievementProgress, UserAchievement
from .serializers import AchievementSerializer, UserAchievementSerializer


class AchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for browsing achievements.

    Endpoints:
    - GET /api/me/achievements/ - List all available achievements
    - GET /api/me/achievements/{id}/ - Get specific achievement details
    - GET /api/me/achievements/my-achievements/ - Get user's earned achievements
    - GET /api/me/achievements/my-progress/ - Get user's progress on all achievements
    """

    serializer_class = AchievementSerializer
    permission_classes = [AllowAny]  # Public can view available achievements
    queryset = Achievement.objects.filter(is_active=True).order_by('category', 'order')

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_achievements(self, request):
        """
        Get all achievements earned by the current user.

        Returns:
            List of earned achievements with earn date and progress at unlock.
        """
        user = request.user
        earned = UserAchievement.objects.filter(user=user).select_related('achievement').order_by('-earned_at')
        serializer = UserAchievementSerializer(earned, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='my-progress')
    def my_progress(self, request):
        """
        Get user's progress on all active achievements.

        Returns achievements grouped by category with progress information.
        Secret achievements are hidden until earned.

        Returns:
            {
                "projects": [...],
                "battles": [...],
                "community": [...],
                "streaks": [...],
                "engagement": [...]
            }
        """
        user = request.user

        # Get all active achievements
        achievements = Achievement.objects.filter(is_active=True).order_by('category', 'order')

        # Build response with earned status and progress
        data = []
        for achievement in achievements:
            # Check if earned
            try:
                earned = UserAchievement.objects.get(user=user, achievement=achievement)
                achievement_data = {
                    **AchievementSerializer(achievement).data,
                    'is_earned': True,
                    'earned_at': earned.earned_at,
                    'current_value': achievement.criteria_value,
                    'progress_percentage': 100,
                }
            except UserAchievement.DoesNotExist:
                # Get progress
                try:
                    progress = AchievementProgress.objects.get(user=user, achievement=achievement)
                    achievement_data = {
                        **AchievementSerializer(achievement).data,
                        'is_earned': False,
                        'earned_at': None,
                        'current_value': progress.current_value,
                        'progress_percentage': progress.percentage,
                    }
                except AchievementProgress.DoesNotExist:
                    achievement_data = {
                        **AchievementSerializer(achievement).data,
                        'is_earned': False,
                        'earned_at': None,
                        'current_value': 0,
                        'progress_percentage': 0,
                    }

            data.append(achievement_data)

        # Group by category
        grouped = {}
        for item in data:
            category = item['category']
            if category not in grouped:
                grouped[category] = []
            grouped[category].append(item)

        return Response(grouped)
