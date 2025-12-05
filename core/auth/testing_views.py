"""
Test-only authentication views.

These views are ONLY available when DEBUG=True and should NOT be used in production.
They provide simple email/password authentication for e2e testing purposes.
"""

import time

from django.conf import settings
from django.contrib.auth import login
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.users.models import User

from .serializers import UserSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def test_login(request):
    """
    Test-only login endpoint for e2e testing.

    ONLY available when DEBUG=True.

    Accepts email/password or username/password and creates a session.
    """
    if not settings.DEBUG:
        return Response(
            {'error': 'This endpoint is only available in development mode'}, status=status.HTTP_403_FORBIDDEN
        )

    start_time = time.time()

    # Get credentials
    email = request.data.get('email')
    password = request.data.get('password')
    username = request.data.get('username')

    if not password:
        return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Try to find user by email or username
    user = None
    if email:
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            pass
    elif username:
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            pass

    if not user:
        # Ensure minimum response time to prevent timing attacks
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    # Check password
    if not user.check_password(password):
        elapsed = time.time() - start_time
        if elapsed < 0.1:
            time.sleep(0.1 - elapsed)
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    # Log the user in - create Django session
    # Specify backend to avoid multiple backends error
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')

    # Set JWT tokens using centralized service
    from services.auth import set_auth_cookies

    serializer = UserSerializer(user, context={'request': request})
    response = Response(
        {
            'success': True,
            'message': 'Login successful',
            'data': serializer.data,
        },
        status=status.HTTP_200_OK,
    )

    # Set authentication cookies
    return set_auth_cookies(response, user)
