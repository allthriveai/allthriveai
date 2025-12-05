"""
URL patterns for the Creator Marketplace API.

All endpoints are prefixed with /api/v1/marketplace/
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CreatorAccountView,
    CreatorDashboardView,
    CreatorSalesView,
    ProductViewSet,
    UserLibraryView,
    YouTubeImportView,
    marketplace_browse,
    product_public_detail,
)

app_name = 'marketplace'

# Router for product CRUD operations
router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')

urlpatterns = [
    # Creator account management
    path('creator/', CreatorAccountView.as_view(), name='creator-account'),
    path('creator/dashboard/', CreatorDashboardView.as_view(), name='creator-dashboard'),
    path('creator/sales/', CreatorSalesView.as_view(), name='creator-sales'),
    # AI Import endpoints
    path('import/youtube/', YouTubeImportView.as_view(), name='import-youtube'),
    # Products router (CRUD)
    path('', include(router.urls)),
    # User library (purchased products)
    path('library/', UserLibraryView.as_view(), name='user-library'),
    # Public browse endpoints
    path('browse/', marketplace_browse, name='marketplace-browse'),
    # Public product detail (by username/slug)
    path('<str:username>/<str:slug>/', product_public_detail, name='product-detail'),
]
