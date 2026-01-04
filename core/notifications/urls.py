"""URL configuration for notifications module."""

from django.urls import path

from core.notifications import views

app_name = 'notifications'

urlpatterns = [
    path('unsubscribe/', views.unsubscribe, name='unsubscribe'),
    path('preferences/', views.update_preferences, name='update_preferences'),
    path('me/preferences/', views.my_email_preferences, name='my_email_preferences'),
    # SMS endpoints
    path('sms-opt-in/', views.sms_opt_in, name='sms_opt_in'),
    path('me/sms-preferences/', views.my_sms_preferences, name='my_sms_preferences'),
]
