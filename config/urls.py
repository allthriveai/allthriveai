"""URL configuration for allthrive-ai-django project."""
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('accounts/', include('allauth.urls')),
    path('', lambda request: HttpResponse('AllThrive AI is running. Visit /admin/ or /api/')),
]
