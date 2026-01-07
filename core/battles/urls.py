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
    # Guest battle flow - start a Pip battle without account
    path('guest/start-pip/', views.start_guest_pip_battle, name='guest-start-pip-battle'),
    # Public endpoint for viewing completed battles (for social sharing)
    path('<int:battle_id>/public/', views.get_battle_public, name='battle-public'),
    # Share data endpoint for social sharing (OG image, share URLs)
    path('<int:battle_id>/share/', views.get_battle_share_data, name='battle-share'),
    # HTML share page with OG tags for social media crawlers
    path('<int:battle_id>/share-page/', views.battle_share_page, name='battle-share-page'),
    # Async battle management endpoints
    path('pending/', views.pending_battles, name='pending-battles'),
    path('<int:battle_id>/extend-deadline/', views.extend_battle_deadline, name='extend-deadline'),
    path('<int:battle_id>/send-reminder/', views.send_battle_reminder, name='send-reminder'),
    path('<int:battle_id>/start-turn/', views.start_battle_turn, name='start-turn'),
    # Admin - Prompt Challenge Prompts Management
    path('admin/prompt-challenge-prompts/', views.admin_prompt_list, name='admin-prompt-list'),
    path('admin/prompt-challenge-prompts/create/', views.admin_prompt_create, name='admin-prompt-create'),
    path('admin/prompt-challenge-prompts/stats/', views.admin_prompt_stats, name='admin-prompt-stats'),
    path('admin/prompt-challenge-prompts/categories/', views.admin_prompt_categories, name='admin-prompt-categories'),
    path(
        'admin/prompt-challenge-prompts/bulk-update/', views.admin_prompt_bulk_update, name='admin-prompt-bulk-update'
    ),
    path(
        'admin/prompt-challenge-prompts/bulk-delete/', views.admin_prompt_bulk_delete, name='admin-prompt-bulk-delete'
    ),
    # Keep <int:pk>/ last so it doesn't match string routes above
    path('admin/prompt-challenge-prompts/<int:pk>/', views.admin_prompt_detail, name='admin-prompt-detail'),
]
