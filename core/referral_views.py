from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from django.db.models import Count, Q, F
from django.db import transaction
from .models import ReferralCode, Referral, ReferralStatus
from .serializers import (
    ReferralCodeSerializer,
    ReferralSerializer,
    ReferralStatsSerializer,
)
import logging

logger = logging.getLogger(__name__)


class ReferralRegenerateThrottle(UserRateThrottle):
    """Limit referral code regeneration to prevent abuse."""
    rate = '3/day'


class ReferralCodeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user referral codes.
    
    Provides endpoints to:
    - Get the authenticated user's referral code
    - Create a referral code if one doesn't exist
    - View referral statistics
    """
    
    serializer_class = ReferralCodeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return only the current user's referral code."""
        return ReferralCode.objects.filter(user=self.request.user)
    
    def list(self, request):
        """Get the authenticated user's referral code.
        
        If the user doesn't have a referral code yet, create one automatically.
        """
        try:
            referral_code = ReferralCode.objects.get(user=request.user)
        except ReferralCode.DoesNotExist:
            # Auto-create referral code for user with collision handling
            referral_code = self._create_unique_referral_code(request.user)
        
        serializer = self.get_serializer(referral_code)
        return Response(serializer.data)
    
    def _create_unique_referral_code(self, user, max_attempts=10):
        """Create a referral code using username with fallback."""
        from django.db import IntegrityError
        
        # Try to use username as code (case-insensitive, uppercase)
        username_code = user.username.upper()
        
        for attempt in range(max_attempts):
            try:
                if attempt == 0:
                    # First attempt: use username
                    code = username_code
                else:
                    # Fallback: username + number suffix
                    code = f"{username_code}{attempt}"
                
                referral_code = ReferralCode.objects.create(user=user, code=code)
                logger.info(f"Created referral code {referral_code.code} for user {user.username}")
                return referral_code
            except IntegrityError:
                # Code collision - try with suffix
                logger.warning(f"Referral code collision on attempt {attempt + 1} for user {user.username}")
                if attempt == max_attempts - 1:
                    raise ValueError(f"Unable to generate unique referral code for username {user.username}")
                continue
        
        raise ValueError("Unable to generate unique referral code")
    
    def create(self, request):
        """Create a referral code for the user if they don't have one."""
        if hasattr(request.user, 'referral_code'):
            return Response(
                {'error': 'You already have a referral code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        referral_code = self._create_unique_referral_code(request.user)
        serializer = self.get_serializer(referral_code)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get referral statistics for the authenticated user."""
        try:
            referral_code = ReferralCode.objects.get(user=request.user)
        except ReferralCode.DoesNotExist:
            # Return empty stats if no referral code exists
            return Response({
                'total_referrals': 0,
                'pending_referrals': 0,
                'completed_referrals': 0,
                'rewarded_referrals': 0,
                'total_uses': 0,
            })
        
        # Optimized: Single query with conditional aggregation to prevent N+1
        referrals = Referral.objects.filter(referrer=request.user)
        referrals_aggregate = referrals.aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status=ReferralStatus.PENDING)),
            completed=Count('id', filter=Q(status=ReferralStatus.COMPLETED)),
            rewarded=Count('id', filter=Q(status=ReferralStatus.REWARDED)),
        )
        
        stats = {
            'total_referrals': referrals_aggregate['total'] or 0,
            'pending_referrals': referrals_aggregate['pending'] or 0,
            'completed_referrals': referrals_aggregate['completed'] or 0,
            'rewarded_referrals': referrals_aggregate['rewarded'] or 0,
            'total_uses': referral_code.uses_count,
        }
        
        serializer = ReferralStatsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], throttle_classes=[ReferralRegenerateThrottle])
    def regenerate(self, request):
        """Regenerate the user's referral code.
        
        This deactivates the old code and creates a new one.
        Use with caution as old links will stop working.
        
        Rate limited to 3 times per day to prevent abuse.
        """
        with transaction.atomic():
            try:
                # Use select_for_update to prevent race conditions
                old_code = ReferralCode.objects.select_for_update().get(user=request.user)
                old_code_value = old_code.code
                old_code.is_active = False
                old_code.save(update_fields=['is_active'])
                logger.info(f"User {request.user.username} deactivated referral code: {old_code_value}")
            except ReferralCode.DoesNotExist:
                logger.info(f"User {request.user.username} generating first referral code via regenerate")
            
            new_code = self._create_unique_referral_code(request.user)
            logger.info(f"User {request.user.username} generated new referral code: {new_code.code}")
            
        serializer = self.get_serializer(new_code)
        return Response(serializer.data)


class ReferralViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing referrals made by the user.
    
    Read-only viewset that allows users to see who they've referred
    and the status of those referrals.
    """
    
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return referrals made by the authenticated user."""
        return Referral.objects.filter(
            referrer=self.request.user
        ).select_related('referrer', 'referred_user', 'referral_code')


@api_view(['GET'])
@permission_classes([AllowAny])  # Must be public for signup flow
def validate_referral_code(request, code):
    """Validate a referral code.
    
    Checks if a referral code exists and is valid for use.
    This endpoint can be used during signup to verify a referral code.
    
    Public endpoint (no authentication required) so new users can validate
    codes before creating an account.
    
    Case-insensitive lookup for username-based codes.
    """
    try:
        # Case-insensitive lookup for username-based codes
        referral_code = ReferralCode.objects.get(code__iexact=code)
        
        if not referral_code.is_valid():
            return Response(
                {
                    'valid': False,
                    'error': 'This referral code is no longer valid'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'valid': True,
            'referrer_username': referral_code.user.username,
        })
    
    except ReferralCode.DoesNotExist:
        return Response(
            {
                'valid': False,
                'error': 'Invalid referral code'
            },
            status=status.HTTP_404_NOT_FOUND
        )
