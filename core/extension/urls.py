"""
URL configuration for AllThrive Web Clipper Extension API
"""

from django.urls import path

from .views import (
    create_clipped_project,
    extension_auth_callback,
    extension_auth_page,
    extension_user_info,
    verify_extension_token,
)

urlpatterns = [
    # Authentication flow
    path('auth/', extension_auth_page, name='extension_auth'),
    path('auth/callback/', extension_auth_callback, name='extension_auth_callback'),
    # API endpoints
    path('verify/', verify_extension_token, name='extension_verify'),
    path('clip/', create_clipped_project, name='extension_clip'),
    path('me/', extension_user_info, name='extension_me'),
]
