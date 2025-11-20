"""
Middleware to read JWT from first-party cookie and expose it as an Authorization header.
This allows DRF's built-in JWTAuthentication to work with cookie-based tokens.
"""

from django.conf import settings
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


class CookieJWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
            token = request.COOKIES.get(cookie_name)
            # Only inject if header not set and token is valid (e.g., not expired)
            if token and 'authorization' not in request.headers:
                try:
                    # Validate token; raises TokenError if invalid/expired
                    AccessToken(token)
                    request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'
                except TokenError:
                    # Skip injection for invalid/expired tokens so AllowAny views won't 401
                    pass
        except Exception:
            # Never block requests due to middleware errors
            pass
        return self.get_response(request)
