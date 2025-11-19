from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, MessageViewSet, ProjectViewSet, db_health, public_user_projects, csp_report
from .upload_views import upload_image
from .quiz_views import QuizViewSet, QuizAttemptViewSet
from .auth_views import (
    GoogleLogin,
    GitHubLogin,
    current_user,
    logout_view,
    signup,
    oauth_urls,
    oauth_callback,
    csrf_token,
    UserProfileView,
    user_activity,
    username_profile_view,
)
from .auth_chat_views import auth_chat_stream, auth_chat_state, project_chat_stream
from .project_chat_views import project_chat_stream_v2
from .referral_views import ReferralCodeViewSet, ReferralViewSet, validate_referral_code
from .social_views import (
    list_connections,
    available_providers,
    connect_provider,
    oauth_callback as social_oauth_callback,
    disconnect_provider,
    connection_status,
)
from .github_sync_views import (
    github_sync_status,
    github_sync_trigger,
    github_repos_list,
    github_sync_single_repo,
)
from .taxonomy_views import (
    TaxonomyViewSet,
    UserTagViewSet,
    user_personalization_overview,
    track_interaction,
)

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

# Taxonomy router (public but auth-required)
taxonomy_router = DefaultRouter()
taxonomy_router.register(r'taxonomies', TaxonomyViewSet, basename='taxonomy')

urlpatterns = [
    path('db/health/', db_health, name='db-health'),
    path('csp-report/', csp_report, name='csp_report'),  # CSP violation reporting
    
    # Public user endpoints
    path('users/<str:username>/', username_profile_view, name='public_user_profile'),
    path('users/<str:username>/projects/', public_user_projects, name='public_user_projects'),
    
    # Quiz endpoints (public/general)
    path('', include(main_router.urls)),
    
    # Authentication endpoints
    path('auth/csrf/', csrf_token, name='csrf_token'),
    path('auth/signup/', signup, name='signup'),
    path('auth/google/', GoogleLogin.as_view(), name='google_login'),
    path('auth/github/', GitHubLogin.as_view(), name='github_login'),
    path('auth/me/', current_user, name='current_user'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/urls/', oauth_urls, name='oauth_urls'),
    path('auth/callback/', oauth_callback, name='oauth_callback'),
    
    # Auth chat endpoints
    path('auth/chat/stream/', auth_chat_stream, name='auth_chat_stream'),
    path('auth/chat/state/', auth_chat_state, name='auth_chat_state'),
    
    # Project chat endpoints
    path('project/chat/stream/', project_chat_stream, name='project_chat_stream'),  # Old version
    path('project/chat/v2/stream/', project_chat_stream_v2, name='project_chat_stream_v2'),  # New LLM-powered
    
    # User-scoped /me endpoints
    path('me/profile/', UserProfileView.as_view(), name='me_profile'),
    path('me/activity/', user_activity, name='user_activity'),
    path('me/personalization/', user_personalization_overview, name='user_personalization'),
    path('me/interactions/', track_interaction, name='track_interaction'),
    path('me/', include(me_router.urls)),
    
    # Taxonomy endpoints
    path('', include(taxonomy_router.urls)),
    
    # Upload endpoints
    path('upload/image/', upload_image, name='upload_image'),
    
    # Referral validation endpoint (public)
    path('referrals/validate/<str:code>/', validate_referral_code, name='validate_referral_code'),
    
    # Social connection endpoints
    path('social/connections/', list_connections, name='social_connections'),
    path('social/providers/', available_providers, name='social_providers'),
    path('social/connect/<str:provider>/', connect_provider, name='social_connect'),
    path('social/callback/<str:provider>/', social_oauth_callback, name='social_callback'),
    path('social/disconnect/<str:provider>/', disconnect_provider, name='social_disconnect'),
    path('social/status/<str:provider>/', connection_status, name='social_status'),
    
    # GitHub sync endpoints
    path('github/sync/status/', github_sync_status, name='github_sync_status'),
    path('github/sync/trigger/', github_sync_trigger, name='github_sync_trigger'),
    path('github/repos/', github_repos_list, name='github_repos_list'),
    path('github/sync/repo/', github_sync_single_repo, name='github_sync_single_repo'),
]
