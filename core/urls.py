from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, MessageViewSet, ProjectViewSet, db_health, public_user_projects
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

# Main router for public/general endpoints
main_router = DefaultRouter()
main_router.register(r'quizzes', QuizViewSet, basename='quiz')

# Router for /me user-scoped endpoints
me_router = DefaultRouter()
me_router.register(r'conversations', ConversationViewSet, basename='me-conversation')
me_router.register(r'messages', MessageViewSet, basename='me-message')
me_router.register(r'projects', ProjectViewSet, basename='me-project')
me_router.register(r'quiz-attempts', QuizAttemptViewSet, basename='me-quiz-attempt')

urlpatterns = [
    path('db/health/', db_health, name='db-health'),
    
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
    path('me/', include(me_router.urls)),
]
