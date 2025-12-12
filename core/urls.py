from django.conf import settings
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.ai_usage import views as admin_analytics_views

from .achievements.views import AchievementViewSet, get_user_achievements
from .agents.auth_chat_views import auth_chat_finalize, auth_chat_state, auth_chat_stream
from .agents.profile_views import profile_generate_auto, profile_generate_stream, profile_preview_sections
from .agents.project_chat_views import project_chat_stream_v2
from .agents.views import ConversationViewSet, CreateProjectFromImageView, MessageViewSet, detect_intent
from .auth.impersonation import (
    impersonation_status,
    list_impersonatable_users,
    list_impersonation_logs,
    start_impersonation,
    stop_impersonation,
)
from .auth.views import (
    UserProfileView,
    convert_guest_account,
    csrf_token,
    current_user,
    deactivate_account,
    delete_account,
    login_view,
    logout_view,
    oauth_callback,
    oauth_urls,
    signup,
    user_activity,
    user_activity_insights,
    username_profile_view,
)
from .auth.views_token import generate_ws_connection_token
from .battles.views import (
    BattleInvitationViewSet,
    PromptBattleViewSet,
    accept_invitation_by_token,
    battle_leaderboard,
    battle_stats,
    expire_battles,
    generate_battle_link,
    get_invitation_by_token,
    get_user_battles,
)
from .events.views import EventViewSet
from .integrations.figma.views import get_file_preview as get_figma_file_preview
from .integrations.figma.views import list_user_files as list_figma_files
from .integrations.github.views import (
    get_task_status,
    import_github_repo_async,
    list_user_repos,
)
from .integrations.gitlab.views import list_user_projects as list_gitlab_projects
from .integrations.views import import_from_url, list_integrations, scrape_url_for_project
from .projects.comment_views import ProjectCommentViewSet
from .projects.topic_suggestions import get_topic_suggestions
from .projects.tracking_views import track_batch_clicks, track_project_click, track_project_view
from .projects.views import (
    ProjectViewSet,
    delete_project_by_id,
    explore_projects,
    get_project_by_slug,
    personalization_status,
    public_user_projects,
    semantic_search,
    toggle_project_promotion,
    user_clipped_projects,
    user_liked_projects,
)
from .quizzes.views import QuizAttemptViewSet, QuizViewSet
from .referrals.views import ReferralCodeViewSet, ReferralViewSet, validate_referral_code
from .social.views import (
    available_providers,
    connect_li,
    connect_provider,
    connection_status,
    disconnect_li,
    disconnect_provider,
    list_connections,
    status_li,
)
from .social.views import oauth_callback as social_oauth_callback
from .taxonomy.views import TaxonomyViewSet, UserTagViewSet, track_interaction, user_personalization_overview
from .thrive_circle.views import (
    AdminCircleViewSet,
    CircleViewSet,
    PointActivityViewSet,
    QuestCategoryViewSet,
    SideQuestViewSet,
    ThriveCircleViewSet,
)
from .tools.views import (
    ToolBookmarkViewSet,
    ToolComparisonViewSet,
    ToolReviewViewSet,
    ToolViewSet,
    recommendation_quiz_questions,
    recommendation_quiz_submit,
)
from .uploads.views import upload_file, upload_image
from .users.invitation_api_views import (
    approve_invitation,
    bulk_approve_invitations,
    bulk_reject_invitations,
    invitation_stats,
    list_invitations,
    reject_invitation,
)
from .users.invitation_views import request_invitation
from .users.views import (
    delete_personalization_data,
    explore_users,
    export_personalization_data,
    get_profile_sections,
    list_followers,
    list_following,
    onboarding_progress,
    personalization_settings,
    reset_personalization_settings,
    reset_profile_sections,
    toggle_follow,
    toggle_project_in_showcase,
    update_profile_sections,
)
from .views import ai_analytics_views, csp_report, db_health

# Main router for public/general endpoints
main_router = DefaultRouter()
main_router.register(r'quizzes', QuizViewSet, basename='quiz')

# Router for /me user-scoped endpoints
me_router = DefaultRouter()
me_router.register(r'conversations', ConversationViewSet, basename='me-conversation')
me_router.register(r'messages', MessageViewSet, basename='me-message')
me_router.register(r'projects', ProjectViewSet, basename='me-project')
me_router.register(r'quiz-attempts', QuizAttemptViewSet, basename='me-quiz-attempt')
me_router.register(r'referral-code', ReferralCodeViewSet, basename='me-referral-code')
me_router.register(r'referrals', ReferralViewSet, basename='me-referrals')
me_router.register(r'tags', UserTagViewSet, basename='me-tags')
me_router.register(r'battles', PromptBattleViewSet, basename='me-battles')
me_router.register(r'battle-invitations', BattleInvitationViewSet, basename='me-battle-invitations')
me_router.register(r'thrive-circle', ThriveCircleViewSet, basename='me-thrive-circle')
me_router.register(r'point-activities', PointActivityViewSet, basename='me-point-activities')
me_router.register(r'side-quests', SideQuestViewSet, basename='me-side-quests')
me_router.register(r'quest-categories', QuestCategoryViewSet, basename='me-quest-categories')
me_router.register(r'achievements', AchievementViewSet, basename='me-achievements')
me_router.register(r'circles', CircleViewSet, basename='me-circles')

# Taxonomy router (public but auth-required)
taxonomy_router = DefaultRouter()
taxonomy_router.register(r'taxonomies', TaxonomyViewSet, basename='taxonomy')

# Tool router (public read, auth-required for reviews/bookmarks)
tool_router = DefaultRouter()
tool_router.register(r'tools', ToolViewSet, basename='tool')
tool_router.register(r'tool-reviews', ToolReviewViewSet, basename='tool-review')
tool_router.register(r'tool-comparisons', ToolComparisonViewSet, basename='tool-comparison')
tool_router.register(r'tool-bookmarks', ToolBookmarkViewSet, basename='tool-bookmark')

# Events router (read for all auth users, write for admins)
events_router = DefaultRouter()
events_router.register(r'events', EventViewSet, basename='event')

urlpatterns = [
    path('db/health/', db_health, name='db-health'),
    path('csp-report/', csp_report, name='csp_report'),  # CSP violation reporting
    # AI Analytics endpoints
    path('ai/analytics/user/', ai_analytics_views.user_ai_analytics, name='user_ai_analytics'),
    path('ai/analytics/user/spend-limit/', ai_analytics_views.check_user_spend_limit, name='check_user_spend_limit'),
    path('ai/analytics/system/', ai_analytics_views.system_ai_analytics, name='system_ai_analytics'),
    path('ai/analytics/user/<int:user_id>/reset/', ai_analytics_views.reset_user_spend, name='reset_user_spend'),
    path('ai/analytics/langsmith/health/', ai_analytics_views.langsmith_health, name='langsmith_health'),
    # Admin Analytics Dashboard endpoints (admin-only)
    path('admin/analytics/overview/', admin_analytics_views.dashboard_overview, name='admin_dashboard_overview'),
    path('admin/analytics/timeseries/', admin_analytics_views.dashboard_timeseries, name='admin_dashboard_timeseries'),
    path(
        'admin/analytics/ai-breakdown/',
        admin_analytics_views.dashboard_ai_breakdown,
        name='admin_dashboard_ai_breakdown',
    ),
    path(
        'admin/analytics/user-growth/', admin_analytics_views.dashboard_user_growth, name='admin_dashboard_user_growth'
    ),
    path('admin/analytics/content/', admin_analytics_views.dashboard_content_metrics, name='admin_dashboard_content'),
    path(
        'admin/analytics/guest-battles/',
        admin_analytics_views.dashboard_guest_battles,
        name='admin_dashboard_guest_battles',
    ),
    # Admin Invitation Management endpoints (admin-only)
    path('admin/invitations/', list_invitations, name='admin_list_invitations'),
    path('admin/invitations/stats/', invitation_stats, name='admin_invitation_stats'),
    path('admin/invitations/<int:invitation_id>/approve/', approve_invitation, name='admin_approve_invitation'),
    path('admin/invitations/<int:invitation_id>/reject/', reject_invitation, name='admin_reject_invitation'),
    path('admin/invitations/bulk-approve/', bulk_approve_invitations, name='admin_bulk_approve_invitations'),
    path('admin/invitations/bulk-reject/', bulk_reject_invitations, name='admin_bulk_reject_invitations'),
    # Admin Impersonation (Masquerade) endpoints
    path('admin/impersonate/start/', start_impersonation, name='admin_start_impersonation'),
    path('admin/impersonate/stop/', stop_impersonation, name='admin_stop_impersonation'),
    path('admin/impersonate/status/', impersonation_status, name='admin_impersonation_status'),
    path('admin/impersonate/logs/', list_impersonation_logs, name='admin_impersonation_logs'),
    path('admin/impersonate/users/', list_impersonatable_users, name='admin_impersonatable_users'),
    # Admin Circle Management endpoints
    path('admin/circles/', AdminCircleViewSet.as_view({'get': 'list'}), name='admin_circles_list'),
    path('admin/circles/users/', AdminCircleViewSet.as_view({'get': 'users'}), name='admin_circles_users'),
    path('admin/circles/assign/', AdminCircleViewSet.as_view({'post': 'assign'}), name='admin_circles_assign'),
    path('admin/circles/remove/', AdminCircleViewSet.as_view({'post': 'remove'}), name='admin_circles_remove'),
    path('admin/circles/move/', AdminCircleViewSet.as_view({'post': 'move'}), name='admin_circles_move'),
    # Explore endpoints (public)
    path('projects/explore/', explore_projects, name='explore_projects'),
    path('projects/topic-suggestions/', get_topic_suggestions, name='topic_suggestions'),
    path('projects/<int:project_id>/delete/', delete_project_by_id, name='delete_project_by_id'),
    path('projects/<int:project_id>/toggle-promotion/', toggle_project_promotion, name='toggle_project_promotion'),
    # Project tracking endpoints (analytics)
    path('projects/<int:project_id>/track-view/', track_project_view, name='track_project_view'),
    path('projects/track-click/', track_project_click, name='track_project_click'),
    path('projects/track-clicks/', track_batch_clicks, name='track_batch_clicks'),
    path('search/semantic/', semantic_search, name='semantic_search'),
    path('users/explore/', explore_users, name='explore_users'),
    # Invitation request (public, rate-limited)
    path('invitations/request/', request_invitation, name='request_invitation'),
    # Public user endpoints
    path('users/<str:username>/', username_profile_view, name='public_user_profile'),
    path('users/<str:username>/projects/', public_user_projects, name='public_user_projects'),
    path('users/<str:username>/projects/<str:slug>/', get_project_by_slug, name='get_project_by_slug'),
    path('users/<str:username>/liked-projects/', user_liked_projects, name='user_liked_projects'),
    path('users/<str:username>/clipped-projects/', user_clipped_projects, name='user_clipped_projects'),
    # Follow endpoints
    path('users/<str:username>/follow/', toggle_follow, name='toggle_follow'),
    path('users/<str:username>/followers/', list_followers, name='list_followers'),
    path('users/<str:username>/following/', list_following, name='list_following'),
    # User achievements endpoint
    path('users/<str:username>/achievements/', get_user_achievements, name='user_achievements'),
    # Profile sections endpoints
    path('users/<str:username>/profile-sections/', get_profile_sections, name='get_profile_sections'),
    path('users/<str:username>/profile-sections/update/', update_profile_sections, name='update_profile_sections'),
    path('users/<str:username>/profile-sections/reset/', reset_profile_sections, name='reset_profile_sections'),
    path('me/profile-sections/toggle-project/', toggle_project_in_showcase, name='toggle_project_in_showcase'),
    # User battles endpoint (public)
    path('users/<str:username>/battles/', get_user_battles, name='user_battles'),
    # Project comment endpoints
    path(
        'projects/<int:project_pk>/comments/',
        ProjectCommentViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='project_comments',
    ),
    path(
        'projects/<int:project_pk>/comments/<int:pk>/',
        ProjectCommentViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}),
        name='project_comment_detail',
    ),
    path(
        'projects/<int:project_pk>/comments/<int:pk>/vote/',
        ProjectCommentViewSet.as_view({'post': 'vote'}),
        name='project_comment_vote',
    ),
    # Quiz endpoints (public/general)
    path('', include(main_router.urls)),
    # Authentication endpoints
    # Note: OAuth login URLs are at /accounts/google/login/ and /accounts/github/login/
    # These are handled by django-allauth (see config/urls.py)
    path('auth/csrf/', csrf_token, name='csrf_token'),
    path('auth/login/', login_view, name='login'),
    path('auth/signup/', signup, name='signup'),
    path('auth/me/', current_user, name='current_user'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/urls/', oauth_urls, name='oauth_urls'),
    path('auth/callback/', oauth_callback, name='oauth_callback'),  # Fallback redirect
    path('auth/ws-connection-token/', generate_ws_connection_token, name='ws_connection_token'),
    # Auth chat endpoints
    path('auth/chat/stream/', auth_chat_stream, name='auth_chat_stream'),
    path('auth/chat/state/', auth_chat_state, name='auth_chat_state'),
    path('auth/chat/finalize/', auth_chat_finalize, name='auth_chat_finalize'),
    # Project chat endpoint
    path('project/chat/stream/', project_chat_stream_v2, name='project_chat_stream'),
    # Profile generation agent endpoints
    path('profile/generate/stream/', profile_generate_stream, name='profile_generate_stream'),
    path('profile/generate/auto/', profile_generate_auto, name='profile_generate_auto'),
    path('profile/generate/preview/', profile_preview_sections, name='profile_preview_sections'),
    # Agent endpoints
    path('agents/detect-intent/', detect_intent, name='detect_intent'),
    path('agents/create-project-from-image/', CreateProjectFromImageView.as_view(), name='create_project_from_image'),
    # User-scoped /me endpoints
    path('me/profile/', UserProfileView.as_view(), name='me_profile'),
    path('me/activity/', user_activity, name='user_activity'),
    path('me/activity/insights/', user_activity_insights, name='user_activity_insights'),
    path('me/personalization/', user_personalization_overview, name='user_personalization'),
    path('me/personalization/status/', personalization_status, name='personalization_status'),
    path('me/personalization/settings/', personalization_settings, name='personalization_settings'),
    path('me/personalization/settings/reset/', reset_personalization_settings, name='reset_personalization_settings'),
    path('me/personalization/export/', export_personalization_data, name='export_personalization_data'),
    path('me/personalization/delete/', delete_personalization_data, name='delete_personalization_data'),
    path('me/onboarding-progress/', onboarding_progress, name='onboarding_progress'),
    path('me/interactions/', track_interaction, name='track_interaction'),
    path('me/account/deactivate/', deactivate_account, name='deactivate_account'),
    path('me/account/delete/', delete_account, name='delete_account'),
    path('me/account/convert-guest/', convert_guest_account, name='convert_guest_account'),
    path('me/', include(me_router.urls)),
    # Learning paths endpoints
    path('', include('core.learning_paths.urls')),
    # Taxonomy endpoints
    path('', include(taxonomy_router.urls)),
    # Tool endpoints
    path('', include(tool_router.urls)),
    # Tool recommendation quiz endpoints (public)
    path('tools/recommendation-quiz/questions/', recommendation_quiz_questions, name='recommendation_quiz_questions'),
    path('tools/recommendation-quiz/submit/', recommendation_quiz_submit, name='recommendation_quiz_submit'),
    # Events endpoints
    path('', include(events_router.urls)),
    # Upload endpoints
    path('upload/image/', upload_image, name='upload_image'),
    path('upload/file/', upload_file, name='upload_file'),
    # Referral validation endpoint (public)
    path('referrals/validate/<str:code>/', validate_referral_code, name='validate_referral_code'),
    # Social connection endpoints
    path('social/connections/', list_connections, name='social_connections'),
    path('social/providers/', available_providers, name='social_providers'),
    # LinkedIn alias (to avoid ad-blocker blocking "linkedin" URLs) - must come BEFORE generic routes
    path('social/connect/li/', connect_li, name='social_connect_li'),
    path('social/disconnect/li/', disconnect_li, name='social_disconnect_li'),
    path('social/status/li/', status_li, name='social_status_li'),
    # Generic social connection routes
    path('social/connect/<str:provider>/', connect_provider, name='social_connect'),
    path('social/callback/<str:provider>/', social_oauth_callback, name='social_callback'),
    path('social/disconnect/<str:provider>/', disconnect_provider, name='social_disconnect'),
    path('social/status/<str:provider>/', connection_status, name='social_status'),
    # Generic integration endpoints
    path('integrations/import-from-url/', import_from_url, name='import_from_url'),
    path('integrations/scrape-url/', scrape_url_for_project, name='scrape_url_for_project'),
    path('integrations/available/', list_integrations, name='list_integrations'),
    path('integrations/tasks/<str:task_id>/', get_task_status, name='task_status'),
    # Billing endpoints
    path('billing/', include('core.billing.urls')),
    # Platform stats endpoints
    path('stats/', include('core.stats.urls')),
    # YouTube integration endpoints
    path('integrations/', include('core.integrations.youtube.urls')),
    # GitHub integration endpoints (legacy - use generic endpoints above)
    path('github/repos/', list_user_repos, name='github_repos'),
    path('github/import/', import_github_repo_async, name='github_import'),
    # GitLab integration endpoints
    path('gitlab/projects/', list_gitlab_projects, name='gitlab_projects'),
    # Figma integration endpoints
    path('figma/files/', list_figma_files, name='figma_files'),
    path('figma/files/<str:file_key>/preview/', get_figma_file_preview, name='figma_file_preview'),
    # Battle endpoints
    path('battles/stats/', battle_stats, name='battle_stats'),
    path('battles/leaderboard/', battle_leaderboard, name='battle_leaderboard'),
    path('battles/expire/', expire_battles, name='expire_battles'),
    # SMS battle invitation endpoints
    path(
        'battles/invitations/send_sms/',
        BattleInvitationViewSet.as_view({'post': 'send_sms'}),
        name='battle_invitation_send_sms',
    ),
    # Shareable link generation (no SMS)
    path('battles/invitations/generate-link/', generate_battle_link, name='generate_battle_link'),
    path('battles/invite/<str:token>/', get_invitation_by_token, name='invitation_by_token'),
    path('battles/invite/<str:token>/accept/', accept_invitation_by_token, name='accept_invitation_by_token'),
    # Weekly challenges endpoints
    path('', include('core.challenges.urls')),
    # Email notification endpoints
    path('notifications/', include('core.notifications.urls')),
    # Creator marketplace endpoints
    path('marketplace/', include('core.marketplace.urls')),
    # Vendor analytics endpoints
    path('', include('core.vendors.urls')),
    # Browser extension API endpoints
    path('extension/', include('core.extension.urls')),
]

# Test-only endpoints (only available in DEBUG mode)
if settings.DEBUG:
    from .auth.testing_views import test_login

    urlpatterns += [
        path('auth/test-login/', test_login, name='test_login'),
    ]
