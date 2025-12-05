"""URL configuration for notifications module."""

from django.urls import path

from core.notifications import views

app_name = 'notifications'

urlpatterns = [
    path('unsubscribe/', views.unsubscribe, name='unsubscribe'),
    path('preferences/', views.update_preferences, name='update_preferences'),
    path('me/preferences/', views.my_email_preferences, name='my_email_preferences'),
]
