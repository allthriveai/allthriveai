"""
Billing API Views

Handles Stripe webhooks and billing-related API endpoints.
"""

import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SubscriptionTier, TokenPackage
from .serializers import (
    CancelSubscriptionSerializer,
    CreateSubscriptionSerializer,
    CreateTokenPurchaseSerializer,
    SubscriptionChangeSerializer,
    TokenPackageSerializer,
    TokenPurchaseSerializer,
    TokenTransactionSerializer,
    UpdateSubscriptionSerializer,
    UserTokenBalanceSerializer,
)
from .services import StripeService, StripeServiceError
from .utils import get_available_tiers, get_subscription_status

logger = logging.getLogger(__name__)


# ===== Webhook Endpoint =====


@csrf_exempt
@require_http_methods(['POST'])
def stripe_webhook(request):
    """
    Handle Stripe webhook events.

    This endpoint receives events from Stripe when subscriptions change,
    payments succeed, or other events occur.
    """
    payload = request.body
    sig_header = request.headers.get('stripe-signature')

    if not sig_header:
        logger.warning('Webhook received without signature header')
        return HttpResponse('Missing signature', status=400)

    try:
        # Verify webhook signature
        event = StripeService.verify_webhook_signature(payload, sig_header)

        logger.info(f"Received Stripe webhook: {event['type']}")

        # Handle different event types
        event_type = event['type']
        event_data = event['data']

        # Subscription events
        if event_type == 'customer.subscription.created':
            StripeService.handle_subscription_updated(event_data)

        elif event_type == 'customer.subscription.updated':
            StripeService.handle_subscription_updated(event_data)

        elif event_type == 'customer.subscription.deleted':
            StripeService.handle_subscription_deleted(event_data)

        # Payment events
        elif event_type == 'payment_intent.succeeded':
            StripeService.handle_payment_intent_succeeded(event_data)

        elif event_type == 'payment_intent.payment_failed':
            logger.warning(f"Payment failed for payment_intent: {event_data['object']['id']}")

        # Invoice events
        elif event_type == 'invoice.payment_succeeded':
            logger.info(f"Invoice payment succeeded: {event_data['object']['id']}")

        elif event_type == 'invoice.payment_failed':
            logger.warning(f"Invoice payment failed: {event_data['object']['id']}")

        else:
            logger.info(f'Unhandled webhook event type: {event_type}')

        return HttpResponse('Webhook received', status=200)

    except StripeServiceError as e:
        logger.error(f'Webhook signature verification failed: {e}')
        return HttpResponse('Invalid signature', status=400)

    except Exception as e:
        logger.error(f'Error processing webhook: {e}', exc_info=True)
        return HttpResponse('Webhook processing failed', status=500)


# ===== Public Endpoints (No Auth Required) =====


@api_view(['GET'])
def list_subscription_tiers(request):
    """
    List all available subscription tiers.

    GET /api/v1/billing/tiers/
    """
    tiers = get_available_tiers()
    return Response(tiers)


@api_view(['GET'])
def list_token_packages(request):
    """
    List all available token packages.

    GET /api/v1/billing/packages/
    """
    packages = TokenPackage.objects.filter(is_active=True).order_by('display_order')
    serializer = TokenPackageSerializer(packages, many=True)
    return Response(serializer.data)


# ===== Authenticated Endpoints =====


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subscription_status_view(request):
    """
    Get current user's subscription status.

    GET /api/v1/billing/status/

    Returns complete billing information including:
    - Current tier and features
    - AI request usage
    - Token balance
    - Subscription dates
    """
    status_data = get_subscription_status(request.user)
    return Response(status_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_subscription_view(request):
    """
    Create a new subscription for the current user.

    POST /api/v1/billing/subscriptions/create/

    Body:
    {
        "tier_slug": "community-pro",
        "billing_interval": "monthly" | "annual" (optional, defaults to "monthly")
    }

    Returns:
    {
        "subscription_id": "sub_xxx",
        "status": "active" | "trialing",
        "client_secret": "pi_xxx_secret_xxx",
        "trial_end": "2024-01-15T00:00:00Z"
    }
    """
    serializer = CreateSubscriptionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        tier = SubscriptionTier.objects.get(slug=serializer.validated_data['tier_slug'])
        billing_interval = serializer.validated_data.get('billing_interval', 'monthly')

        result = StripeService.create_subscription(request.user, tier, billing_interval)

        return Response(result, status=status.HTTP_201_CREATED)

    except SubscriptionTier.DoesNotExist:
        logger.warning(f'User {request.user.id} attempted to subscribe to nonexistent tier')
        return Response({'error': 'Tier not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        logger.error(f'Failed to create subscription: {e}')
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_subscription_view(request):
    """
    Update user's subscription to a different tier.

    POST /api/v1/billing/subscriptions/update/

    Body:
    {
        "tier_slug": "pro-learn"
    }

    Returns:
    {
        "subscription_id": "sub_xxx",
        "from_tier": "Community Pro",
        "to_tier": "Pro Learn",
        "change_type": "upgraded" | "downgraded"
    }
    """
    serializer = UpdateSubscriptionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        tier = SubscriptionTier.objects.get(slug=serializer.validated_data['tier_slug'])

        result = StripeService.update_subscription(request.user, tier)

        return Response(result)

    except SubscriptionTier.DoesNotExist:
        logger.warning(f'User {request.user.id} attempted to update to nonexistent tier')
        return Response({'error': 'Tier not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        logger.error(f'Failed to update subscription: {e}')
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_subscription_view(request):
    """
    Cancel user's subscription.

    POST /api/v1/billing/subscriptions/cancel/

    Body:
    {
        "immediate": false  // true = cancel now, false = cancel at period end
    }

    Returns:
    {
        "subscription_id": "sub_xxx",
        "status": "canceled",
        "cancel_at_period_end": true,
        "period_end": "2024-03-31T00:00:00Z"
    }
    """
    serializer = CancelSubscriptionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        immediate = serializer.validated_data.get('immediate', False)
        result = StripeService.cancel_subscription(request.user, immediate)

        return Response(result)

    except StripeServiceError as e:
        logger.error(f'Failed to cancel subscription: {e}')
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_token_purchase_view(request):
    """
    Create a payment intent for token purchase.

    POST /api/v1/billing/tokens/purchase/

    Body:
    {
        "package_slug": "booster-500k"
    }

    Returns:
    {
        "payment_intent_id": "pi_xxx",
        "client_secret": "pi_xxx_secret_xxx",
        "amount": 20.00,
        "token_amount": 500000,
        "purchase_id": 123
    }
    """
    serializer = CreateTokenPurchaseSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        package = TokenPackage.objects.get(slug=serializer.validated_data['package_slug'])

        result = StripeService.create_token_purchase(request.user, package)

        return Response(result, status=status.HTTP_201_CREATED)

    except TokenPackage.DoesNotExist:
        logger.warning(f'User {request.user.id} attempted to purchase nonexistent token package')
        return Response({'error': 'Package not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        logger.error(f'Failed to create token purchase: {e}')
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_token_balance_view(request):
    """
    Get user's current token balance.

    GET /api/v1/billing/tokens/balance/
    """
    try:
        balance = request.user.token_balance
        serializer = UserTokenBalanceSerializer(balance)
        return Response(serializer.data)
    except AttributeError:
        logger.info(f'User {request.user.id} has no token balance record, returning default')
        return Response({'balance': 0, 'total_purchased': 0, 'total_used': 0}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_token_transactions_view(request):
    """
    Get user's token transaction history.

    GET /api/v1/billing/tokens/transactions/
    """
    transactions = request.user.token_transactions.all()[:50]  # Last 50
    serializer = TokenTransactionSerializer(transactions, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_purchase_history_view(request):
    """
    Get user's token purchase history.

    GET /api/v1/billing/purchases/
    """
    purchases = request.user.token_purchases.filter(status='completed').order_by('-created_at')[:20]  # Last 20
    serializer = TokenPurchaseSerializer(purchases, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subscription_history_view(request):
    """
    Get user's subscription change history.

    GET /api/v1/billing/subscriptions/history/
    """
    changes = request.user.subscription_changes.all()[:20]  # Last 20
    serializer = SubscriptionChangeSerializer(changes, many=True)
    return Response(serializer.data)
