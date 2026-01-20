"""URL configuration for Echo API."""

from django.urls import path

from .views import EchoProfileView

app_name = 'echo'

urlpatterns = [
    path('profile/', EchoProfileView.as_view(), name='profile'),
]
