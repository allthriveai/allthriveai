"""Referrals domain - User referral system.

This domain handles referral code generation, tracking,
and referral reward management.
"""
from .models import Referral, ReferralCode, ReferralStatus
from .serializers import ReferralCodeSerializer, ReferralSerializer, ReferralStatsSerializer
from .views import ReferralCodeViewSet, ReferralViewSet, validate_referral_code

__all__ = [
    # Models
    "ReferralCode",
    "Referral",
    "ReferralStatus",
    # Views
    "ReferralCodeViewSet",
    "ReferralViewSet",
    "validate_referral_code",
    # Serializers
    "ReferralCodeSerializer",
    "ReferralSerializer",
    "ReferralStatsSerializer",
]
