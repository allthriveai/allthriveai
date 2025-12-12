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
    # Generate shareable battle link
    path('invitations/generate-link/', views.generate_battle_link, name='generate_battle_link'),
    # SMS invitation token-based endpoints
    path('invite/<str:token>/', views.get_invitation_by_token, name='invitation-by-token'),
    path('invite/<str:token>/accept/', views.accept_invitation_by_token, name='accept-invitation-by-token'),
    # Public endpoint for viewing completed battles (for social sharing)
    path('<int:battle_id>/public/', views.get_battle_public, name='battle-public'),
    # Share data endpoint for social sharing (OG image, share URLs)
    path('<int:battle_id>/share/', views.get_battle_share_data, name='battle-share'),
]
