"""URL configuration for Learning Paths."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'me/learning-paths', views.MyLearningPathsViewSet, basename='my-learning-paths')

urlpatterns = [
    path('', include(router.urls)),
    path('users/<str:username>/learning-paths/', views.UserLearningPathsView.as_view(), name='user-learning-paths'),
    path('learning-paths/topics/', views.AllTopicsView.as_view(), name='all-topics'),
]
