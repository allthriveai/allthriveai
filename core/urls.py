from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .agents.auth_chat_views import auth_chat_state, auth_chat_stream, project_chat_stream
from .agents.project_chat_views import project_chat_stream_v2
from .agents.views import ConversationViewSet, MessageViewSet
from .auth.views import (
    GitHubLogin,
    GoogleLogin,
    UserProfileView,
    csrf_token,
    current_user,
    logout_view,
    oauth_callback,
    oauth_urls,
    signup,
    user_activity,
    username_profile_view,
)
from .battles.views import (
    BattleInvitationViewSet,
    PromptBattleViewSet,
    battle_leaderboard,
    battle_stats,
    expire_battles,
)
from .integrations.github.views import (
    github_repos_list,
    github_sync_single_repo,
    github_sync_status,
    github_sync_trigger,
)
from .projects.views import ProjectViewSet, public_user_projects
from .quizzes.views import QuizAttemptViewSet, QuizViewSet
from .referrals.views import ReferralCodeViewSet, ReferralViewSet, validate_referral_code
from .social.views import (
    available_providers,
    connect_provider,
    connection_status,
    disconnect_provider,
    list_connections,
)
from .social.views import oauth_callback as social_oauth_callback
from .taxonomy.views import TaxonomyViewSet, UserTagViewSet, track_interaction, user_personalization_overview
from .tools.views import ToolBookmarkViewSet, ToolComparisonViewSet, ToolReviewViewSet, ToolViewSet
from .uploads.views import upload_file, upload_image
from .views import csp_report, db_health

# Main router for public/general endpoints
main_router = DefaultRouter()
main_router.register(r"quizzes", QuizViewSet, basename="quiz")

# Router for /me user-scoped endpoints
me_router = DefaultRouter()
me_router.register(r"conversations", ConversationViewSet, basename="me-conversation")
me_router.register(r"messages", MessageViewSet, basename="me-message")
me_router.register(r"projects", ProjectViewSet, basename="me-project")
me_router.register(r"quiz-attempts", QuizAttemptViewSet, basename="me-quiz-attempt")
me_router.register(r"referral-code", ReferralCodeViewSet, basename="me-referral-code")
me_router.register(r"referrals", ReferralViewSet, basename="me-referrals")
me_router.register(r"tags", UserTagViewSet, basename="me-tags")
me_router.register(r"battles", PromptBattleViewSet, basename="me-battles")
me_router.register(r"battle-invitations", BattleInvitationViewSet, basename="me-battle-invitations")

# Taxonomy router (public but auth-required)
taxonomy_router = DefaultRouter()
taxonomy_router.register(r"taxonomies", TaxonomyViewSet, basename="taxonomy")

# Tool router (public read, auth-required for reviews/bookmarks)
tool_router = DefaultRouter()
tool_router.register(r"tools", ToolViewSet, basename="tool")
tool_router.register(r"tool-reviews", ToolReviewViewSet, basename="tool-review")
tool_router.register(r"tool-comparisons", ToolComparisonViewSet, basename="tool-comparison")
tool_router.register(r"tool-bookmarks", ToolBookmarkViewSet, basename="tool-bookmark")

urlpatterns = [
    path("db/health/", db_health, name="db-health"),
    path("csp-report/", csp_report, name="csp_report"),  # CSP violation reporting
    # Public user endpoints
    path("users/<str:username>/", username_profile_view, name="public_user_profile"),
    path("users/<str:username>/projects/", public_user_projects, name="public_user_projects"),
    # Quiz endpoints (public/general)
    path("", include(main_router.urls)),
    # Authentication endpoints
    path("auth/csrf/", csrf_token, name="csrf_token"),
    path("auth/signup/", signup, name="signup"),
    path("auth/google/", GoogleLogin.as_view(), name="google_login"),
    path("auth/github/", GitHubLogin.as_view(), name="github_login"),
    path("auth/me/", current_user, name="current_user"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/urls/", oauth_urls, name="oauth_urls"),
    path("auth/callback/", oauth_callback, name="oauth_callback"),
    # Auth chat endpoints
    path("auth/chat/stream/", auth_chat_stream, name="auth_chat_stream"),
    path("auth/chat/state/", auth_chat_state, name="auth_chat_state"),
    # Project chat endpoints
    path("project/chat/stream/", project_chat_stream, name="project_chat_stream"),  # Old version
    path("project/chat/v2/stream/", project_chat_stream_v2, name="project_chat_stream_v2"),  # New LLM-powered
    # User-scoped /me endpoints
    path("me/profile/", UserProfileView.as_view(), name="me_profile"),
    path("me/activity/", user_activity, name="user_activity"),
    path("me/personalization/", user_personalization_overview, name="user_personalization"),
    path("me/interactions/", track_interaction, name="track_interaction"),
    path("me/", include(me_router.urls)),
    # Taxonomy endpoints
    path("", include(taxonomy_router.urls)),
    # Tool endpoints
    path("", include(tool_router.urls)),
    # Upload endpoints
    path("upload/image/", upload_image, name="upload_image"),
    path("upload/file/", upload_file, name="upload_file"),
    # Referral validation endpoint (public)
    path("referrals/validate/<str:code>/", validate_referral_code, name="validate_referral_code"),
    # Social connection endpoints
    path("social/connections/", list_connections, name="social_connections"),
    path("social/providers/", available_providers, name="social_providers"),
    path("social/connect/<str:provider>/", connect_provider, name="social_connect"),
    path("social/callback/<str:provider>/", social_oauth_callback, name="social_callback"),
    path("social/disconnect/<str:provider>/", disconnect_provider, name="social_disconnect"),
    path("social/status/<str:provider>/", connection_status, name="social_status"),
    # GitHub sync endpoints
    path("github/sync/status/", github_sync_status, name="github_sync_status"),
    path("github/sync/trigger/", github_sync_trigger, name="github_sync_trigger"),
    path("github/repos/", github_repos_list, name="github_repos_list"),
    path("github/sync/repo/", github_sync_single_repo, name="github_sync_single_repo"),
    # Battle endpoints
    path("battles/stats/", battle_stats, name="battle_stats"),
    path("battles/leaderboard/", battle_leaderboard, name="battle_leaderboard"),
    path("battles/expire/", expire_battles, name="expire_battles"),
]
