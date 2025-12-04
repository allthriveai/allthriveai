"""
URL configuration for Prompt Battles.

Includes REST API endpoints for battles, invitations, and stats.
WebSocket routes are configured in core/routing.py.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'battles', views.PromptBattleViewSet, basename='battle')
router.register(r'invitations', views.BattleInvitationViewSet, basename='battle-invitation')

urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),
    # Stats and leaderboard
    path('stats/', views.battle_stats, name='battle-stats'),
    path('leaderboard/', views.battle_leaderboard, name='battle-leaderboard'),
]
