from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminUserViewSet,
    TaskAttachmentViewSet,
    TaskCommentViewSet,
    TaskDashboardViewSet,
    TaskOptionViewSet,
    TaskViewSet,
)

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'options', TaskOptionViewSet, basename='task-option')
router.register(r'dashboards', TaskDashboardViewSet, basename='task-dashboard')
router.register(r'admins', AdminUserViewSet, basename='admin-user')
router.register(r'comments', TaskCommentViewSet, basename='task-comment')
router.register(r'attachments', TaskAttachmentViewSet, basename='task-attachment')

urlpatterns = [
    path('', include(router.urls)),
]
