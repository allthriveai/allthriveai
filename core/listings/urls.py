"""URL routes for Listings API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ListingViewSet, UserListingsViewSet

router = DefaultRouter()
router.register(r'listings', ListingViewSet, basename='listing')

# User listings viewset (not a nested router to avoid intercepting /users/{username}/)
user_listings_router = DefaultRouter()
user_listings_router.register(r'', UserListingsViewSet, basename='user-listing')

urlpatterns = [
    path('', include(router.urls)),
    # User-specific listings: /api/v1/users/{username}/listings/
    # NOTE: Must use explicit path to avoid intercepting /users/{username}/ profile route
    path('users/<str:username>/listings/', include(user_listings_router.urls)),
]
