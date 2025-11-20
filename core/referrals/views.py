import logging

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from .models import Referral, ReferralCode, ReferralStatus
from .serializers import ReferralCodeSerializer, ReferralSerializer, ReferralStatsSerializer
from .utils import ReferralCodeValidator, check_code_availability, generate_default_referral_code

logger = logging.getLogger(__name__)


class ReferralRegenerateThrottle(UserRateThrottle):
    """Limit referral code changes to prevent abuse."""

    rate = "5/day"


class ReferralValidationThrottle(AnonRateThrottle):
    """Limit public referral code validation to prevent enumeration."""

    rate = "20/minute"


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
        """Create a referral code with smart defaults."""
        from django.db import IntegrityError

        # Generate a clean default code from username
        default_code = generate_default_referral_code(user.username)

        for attempt in range(max_attempts):
            try:
                if attempt == 0:
                    code = default_code
                else:
                    # Add suffix on collision
                    from django.utils.crypto import get_random_string

                    suffix = get_random_string(3, allowed_chars="23456789")
                    code = f"{default_code[:15]}{suffix}"

                referral_code = ReferralCode.objects.create(user=user, code=code)
                logger.info(f"Created referral code {referral_code.code} for user {user.username}")
                return referral_code
            except IntegrityError:
                logger.warning(f"Referral code collision on attempt {attempt + 1} for user {user.username}")
                if attempt == max_attempts - 1:
                    raise ValueError(f"Unable to generate unique referral code for user {user.username}")
                continue

        raise ValueError("Unable to generate unique referral code")

    def create(self, request):
        """Create a referral code for the user if they don't have one."""
        if hasattr(request.user, "referral_code"):
            return Response({"error": "You already have a referral code"}, status=status.HTTP_400_BAD_REQUEST)

        referral_code = self._create_unique_referral_code(request.user)
        serializer = self.get_serializer(referral_code)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Get referral statistics for the authenticated user."""
        try:
            referral_code = ReferralCode.objects.get(user=request.user)
        except ReferralCode.DoesNotExist:
            # Return empty stats if no referral code exists
            return Response(
                {
                    "total_referrals": 0,
                    "pending_referrals": 0,
                    "completed_referrals": 0,
                    "rewarded_referrals": 0,
                    "total_uses": 0,
                }
            )

        # Optimized: Single query with conditional aggregation to prevent N+1
        referrals = Referral.objects.filter(referrer=request.user)
        referrals_aggregate = referrals.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=ReferralStatus.PENDING)),
            completed=Count("id", filter=Q(status=ReferralStatus.COMPLETED)),
            rewarded=Count("id", filter=Q(status=ReferralStatus.REWARDED)),
        )

        stats = {
            "total_referrals": referrals_aggregate["total"] or 0,
            "pending_referrals": referrals_aggregate["pending"] or 0,
            "completed_referrals": referrals_aggregate["completed"] or 0,
            "rewarded_referrals": referrals_aggregate["rewarded"] or 0,
            "total_uses": referral_code.uses_count,
        }

        serializer = ReferralStatsSerializer(stats)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], throttle_classes=[ReferralRegenerateThrottle])
    def update_code(self, request):
        """Update the user's referral code to a custom vanity code.

        Allows users to set a memorable, custom referral code.
        The code must be:
        - 3-20 characters
        - Alphanumeric with hyphens/underscores
        - Not profane or reserved
        - Unique (not already taken)

        Rate limited to 5 times per day to prevent abuse.
        """
        custom_code = request.data.get("code", "").strip().upper()

        if not custom_code:
            return Response({"error": "Code is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate the code
        is_valid, error_msg = ReferralCodeValidator.validate(custom_code)
        if not is_valid:
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Check availability
        if not check_code_availability(custom_code, exclude_user_id=request.user.id):
            return Response({"error": "This code is already taken"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                # Update existing code
                referral_code = ReferralCode.objects.select_for_update().get(user=request.user)
                old_code = referral_code.code
                referral_code.code = custom_code
                referral_code.save(update_fields=["code"])
                logger.info(f"User {request.user.username} changed referral code from {old_code} to {custom_code}")
            except ReferralCode.DoesNotExist:
                # Create new code with custom value
                referral_code = ReferralCode.objects.create(user=request.user, code=custom_code)
                logger.info(f"User {request.user.username} created custom referral code: {custom_code}")

        serializer = self.get_serializer(referral_code)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def check_availability(self, request):
        """Check if a referral code is available.

        Allows users to preview if their desired code is available before saving.
        """
        code = request.data.get("code", "").strip().upper()

        if not code:
            return Response({"available": False, "error": "Code is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate format
        is_valid, error_msg = ReferralCodeValidator.validate(code)
        if not is_valid:
            return Response({"available": False, "error": error_msg}, status=status.HTTP_200_OK)

        # Check availability
        is_available = check_code_availability(code, exclude_user_id=request.user.id)

        return Response(
            {"available": is_available, "code": code, "error": None if is_available else "This code is already taken"}
        )


class ReferralViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing referrals made by the user.

    Read-only viewset that allows users to see who they've referred
    and the status of those referrals.
    """

    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return referrals made by the authenticated user."""
        return Referral.objects.filter(referrer=self.request.user).select_related(
            "referrer", "referred_user", "referral_code"
        )


@api_view(["GET"])
@permission_classes([AllowAny])  # Must be public for signup flow
@throttle_classes([ReferralValidationThrottle])  # Rate limit to prevent enumeration
def validate_referral_code(request, code):
    """Validate a referral code.

    Checks if a referral code exists and is valid for use.
    This endpoint can be used during signup to verify a referral code.

    Public endpoint (no authentication required) so new users can validate
    codes before creating an account.

    Rate limited to 20 requests per minute to prevent username enumeration attacks.
    """
    try:
        # Case-insensitive lookup for username-based codes
        referral_code = ReferralCode.objects.get(code__iexact=code)

        if not referral_code.is_valid():
            return Response(
                {"valid": False, "error": "This referral code is no longer valid"}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "valid": True,
                "referrer_username": referral_code.user.username,
            }
        )

    except ReferralCode.DoesNotExist:
        return Response({"valid": False, "error": "Invalid referral code"}, status=status.HTTP_404_NOT_FOUND)
