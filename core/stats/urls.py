"""
URL Configuration for stats app
"""

from django.urls import path

from . import views

app_name = 'stats'

urlpatterns = [
    path('platform/', views.platform_stats, name='platform'),
]
