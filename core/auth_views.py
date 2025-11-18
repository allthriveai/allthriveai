from django.conf import settings
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from csp.decorators import csp_exempt
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.github.views import GitHubOAuth2Adapter
from allauth.socialaccount.models import SocialAccount
from dj_rest_auth.registration.views import SocialLoginView

from .models import User
from .auth_serializers import UserSerializer, UserUpdateSerializer


class GoogleLogin(SocialLoginView):
    """Handle Google OAuth login."""
    adapter_class = GoogleOAuth2Adapter
    
    def post(self, request, *args, **kwargs):
        """Override to set JWT tokens in cookies."""
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            user = User.objects.get(email=request.data.get('email'))
            refresh = RefreshToken.for_user(user)
            
            # Set tokens in HTTP-only cookies
            response.set_cookie(
                key=settings.SIMPLE_JWT['AUTH_COOKIE'],
                value=str(refresh.access_token),
                httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
                secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            )
            
            response.set_cookie(
                key='refresh_token',
                value=str(refresh),
                httponly=True,
                secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            )
        
        return response


class GitHubLogin(SocialLoginView):
    """Handle GitHub OAuth login."""
    adapter_class = GitHubOAuth2Adapter
    
    def post(self, request, *args, **kwargs):
        """Override to set JWT tokens in cookies."""
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            user = User.objects.get(email=request.data.get('email'))
            refresh = RefreshToken.for_user(user)
            
            # Set tokens in HTTP-only cookies
            response.set_cookie(
                key=settings.SIMPLE_JWT['AUTH_COOKIE'],
                value=str(refresh.access_token),
                httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
                secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            )
            
            response.set_cookie(
                key='refresh_token',
                value=str(refresh),
                httponly=True,
                secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            )
        
        return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Get current authenticated user info."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow anyone to logout
@csrf_exempt
def logout_view(request):
    """Logout user and clear cookies."""
    response = Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    
    # Get cookie domain from settings
    cookie_domain = settings.COOKIE_DOMAIN
    cookie_secure = settings.SIMPLE_JWT['AUTH_COOKIE_SECURE']
    cookie_samesite = settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE']
    
    # Delete cookies with domain (how they were set in oauth_callback)
    response.delete_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE'],
        domain=cookie_domain,
        path='/',
        samesite=cookie_samesite,
    )
    response.delete_cookie(
        key='refresh_token',
        domain=cookie_domain,
        path='/',
        samesite=cookie_samesite,
    )
    response.delete_cookie(
        key='csrftoken',
        domain=cookie_domain,
        path='/',
        samesite=cookie_samesite,
    )
    
    # Also delete without domain as fallback
    response.delete_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE'],
        path='/',
        samesite=cookie_samesite,
    )
    response.delete_cookie(
        key='refresh_token',
        path='/',
        samesite=cookie_samesite,
    )
    response.delete_cookie(
        key='csrftoken',
        path='/',
        samesite=cookie_samesite,
    )
    
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    """Register a new user."""
    from .auth_serializers import UserCreateSerializer
    
    serializer = UserCreateSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {
                'message': 'User created successfully',
                'user': UserSerializer(user).data
            },
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_urls(request):
    """Return OAuth provider URLs for frontend."""
    base_url = request.build_absolute_uri('/')[:-1]
    
    return Response({
        'google': f'{base_url}/api/v1/auth/google/',
        'github': f'{base_url}/api/v1/auth/github/',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def csrf_token(request):
    """Return CSRF token for the frontend."""
    from django.middleware.csrf import get_token
    token = get_token(request)
    return Response({'csrfToken': token})


class UserProfileView(generics.RetrieveUpdateAPIView):
    """View for retrieving and updating user profile."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def username_profile_view(request, username):
    """View user profile by username."""
    from django.shortcuts import get_object_or_404
    
    user = get_object_or_404(User, username=username.lower())
    serializer = UserSerializer(user)
    return Response(serializer.data)


from django.http import HttpResponse
from allauth.socialaccount.models import SocialApp
from urllib.parse import urlencode

@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_redirect(request):
    """
    Direct redirect to Google OAuth without intermediate page.
    """
    provider = request.GET.get('provider', 'google')
    
    if provider == 'google':
        # Get the social app credentials
        try:
            social_app = SocialApp.objects.get(provider='google')
            client_id = social_app.client_id
        except SocialApp.DoesNotExist:
            client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']
        
        # Build Google OAuth URL
        redirect_uri = f"http://localhost:8000/accounts/google/login/callback/"
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'access_type': 'online',
        }
        
        google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return redirect(google_auth_url)
    
    # Fallback to allauth for other providers
    return redirect(f'/accounts/{provider}/login/?process=login')


@api_view(['GET'])
@permission_classes([AllowAny])
@csp_exempt()
def oauth_callback(request):
    """
    Handle OAuth callback and close popup after setting authentication cookies.
    This is called after successful OAuth authentication.
    """
    if request.user.is_authenticated:
        # Generate JWT tokens
        refresh = RefreshToken.for_user(request.user)
        access_token = str(refresh.access_token)
        refresh_token_str = str(refresh)
        
        # Redirect to user profile with cookies set
        username = request.user.username
        redirect_url = f"{settings.FRONTEND_URL}/{username}"
        response = redirect(redirect_url)
        
        # Set JWT tokens in HTTP-only cookies with shared domain
        cookie_domain = settings.COOKIE_DOMAIN
        response.set_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            value=access_token,
            domain=cookie_domain,
            httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
            secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
            samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            path='/',
        )
        
        response.set_cookie(
            key='refresh_token',
            value=refresh_token_str,
            domain=cookie_domain,
            httponly=True,
            secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
            samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            path='/',
        )
        
        return response
    else:
        # OAuth failed, redirect to login with error
        return redirect(f"{settings.FRONTEND_URL}/login?error=oauth_failed")
