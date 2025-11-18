from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, MessageViewSet, ProjectViewSet, db_health
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
)
from .auth_chat_views import auth_chat_stream, auth_chat_state

router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'projects', ProjectViewSet, basename='project')

urlpatterns = [
    path('db/health/', db_health, name='db-health'),
    
    # Authentication endpoints
    path('auth/csrf/', csrf_token, name='csrf_token'),
    path('auth/signup/', signup, name='signup'),
    path('auth/google/', GoogleLogin.as_view(), name='google_login'),
    path('auth/github/', GitHubLogin.as_view(), name='github_login'),
    path('auth/me/', current_user, name='current_user'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/urls/', oauth_urls, name='oauth_urls'),
    path('auth/callback/', oauth_callback, name='oauth_callback'),
    path('auth/profile/', UserProfileView.as_view(), name='user_profile'),
    
    # Auth chat endpoints
    path('auth/chat/stream/', auth_chat_stream, name='auth_chat_stream'),
    path('auth/chat/state/', auth_chat_state, name='auth_chat_state'),
    
    path('', include(router.urls)),
]
