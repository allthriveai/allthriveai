"""URL routes for integrations module.

These routes are included at /api/v1/integrations/
"""

from django.urls import path

from .asana_views import (
    asana_authorize,
    asana_callback,
    asana_disconnect,
    asana_status,
)

app_name = 'integrations'

urlpatterns = [
    # Asana OAuth endpoints
    path('asana/authorize/', asana_authorize, name='asana-authorize'),
    path('asana/callback/', asana_callback, name='asana-callback'),
    path('asana/status/', asana_status, name='asana-status'),
    path('asana/disconnect/', asana_disconnect, name='asana-disconnect'),
]
