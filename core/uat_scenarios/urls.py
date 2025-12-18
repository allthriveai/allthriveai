from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminUserViewSet,
    UATCategoryViewSet,
    UATScenarioViewSet,
    UATTestRunViewSet,
)

router = DefaultRouter()
router.register(r'scenarios', UATScenarioViewSet, basename='uat-scenario')
router.register(r'categories', UATCategoryViewSet, basename='uat-category')
router.register(r'test-runs', UATTestRunViewSet, basename='uat-test-run')
router.register(r'admins', AdminUserViewSet, basename='uat-admin-user')

urlpatterns = [
    path('', include(router.urls)),
]
