"""URL routes for Listings API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ListingViewSet, UserListingsViewSet

router = DefaultRouter()
router.register(r'listings', ListingViewSet, basename='listing')

# Nested routes for user listings
user_listings_router = DefaultRouter()
user_listings_router.register(r'listings', UserListingsViewSet, basename='user-listing')

urlpatterns = [
    path('', include(router.urls)),
    # User-specific listings: /api/v1/users/{username}/listings/
    path('users/<str:username>/', include(user_listings_router.urls)),
]
