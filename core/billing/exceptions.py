"""
Billing Exceptions

Custom exceptions for the billing system.
"""


class BillingError(Exception):
    """Base exception for billing-related errors."""

    pass


class InsufficientTokensError(BillingError):
    """Raised when user doesn't have enough tokens."""

    pass


class SubscriptionLimitExceededError(BillingError):
    """Raised when user exceeds their subscription limits."""

    pass


class InvalidTierError(BillingError):
    """Raised when attempting to use an invalid tier."""

    pass


class NoActiveSubscriptionError(BillingError):
    """Raised when user doesn't have an active subscription."""

    pass


class FeatureNotAvailableError(BillingError):
    """Raised when user tries to access a feature not in their tier."""

    pass


class StripeWebhookError(BillingError):
    """Raised when webhook processing fails."""

    pass
