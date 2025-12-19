"""URL configuration for the games app."""

from django.urls import path

from core.games import views

urlpatterns = [
    path('scores/', views.submit_score, name='submit_score'),
    path('scores/<str:game>/me/', views.my_high_score, name='my_high_score'),
    path('scores/<str:game>/leaderboard/', views.leaderboard, name='leaderboard'),
]
