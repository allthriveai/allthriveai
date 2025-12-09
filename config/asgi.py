"""
ASGI config for AllThrive AI project.

Exposes the ASGI callable as a module-level variable named ``application``.
Supports both HTTP and WebSocket protocols with JWT authentication.
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

from core.agents.middleware import JWTAuthMiddlewareStack
from core.agents.routing import websocket_urlpatterns

# Note: AllowedHostsOriginValidator removed - origin validation is handled by:
# 1. Connection token authentication (JWTAuthMiddlewareStack)
# 2. CORS configuration for API endpoints
# 3. ALB/CloudFront layer restrictions
application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
