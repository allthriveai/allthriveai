"""
Billing API Views

Handles Stripe webhooks and billing-related API endpoints.
"""

import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.logging_utils import StructuredLogger

from .models import CreditPack, SubscriptionTier, TokenPackage, WebhookEvent
from .serializers import (
    CancelSubscriptionSerializer,
    ChangeCreditPackSerializer,
    CreateSubscriptionSerializer,
    CreateTokenPurchaseSerializer,
    CreditPackSerializer,
    SubscribeCreditPackSerializer,
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
@ratelimit(key='ip', rate='100/m', method='POST', block=True)
def stripe_webhook(request):
    """
    Handle Stripe webhook events with idempotency protection.

    This endpoint receives events from Stripe when subscriptions change,
    payments succeed, or other events occur.

    Implements idempotency to prevent duplicate processing of the same event.
    """
    payload = request.body
    sig_header = request.headers.get('stripe-signature')

    if not sig_header:
        StructuredLogger.log_service_operation(
            service_name='StripeWebhook',
            operation='receive',
            success=False,
            metadata={'reason': 'missing_signature_header'},
            logger_instance=logger,
        )
        return HttpResponse('Missing signature', status=400)

    try:
        # Verify webhook signature
        event = StripeService.verify_webhook_signature(payload, sig_header)
        event_id = event['id']
        event_type = event['type']

        StructuredLogger.log_service_operation(
            service_name='StripeWebhook',
            operation='receive',
            success=True,
            metadata={'event_type': event_type, 'event_id': event_id},
            logger_instance=logger,
        )

        # Check if we've already processed this event (idempotency)
        # Use atomic transaction with select_for_update to prevent concurrent processing
        from django.db import transaction

        with transaction.atomic():
            webhook_event, created = WebhookEvent.objects.get_or_create(
                stripe_event_id=event_id,
                defaults={
                    'event_type': event_type,
                    'payload': event,
                    'processed': False,
                },
            )

            # Lock the webhook event to prevent concurrent processing
            webhook_event = WebhookEvent.objects.select_for_update().get(pk=webhook_event.pk)

            # If event already processed, return success without reprocessing
            if webhook_event.processed:
                logger.info(f'Webhook event {event_id} already processed, skipping')  # Info level ok
                return HttpResponse('Webhook already processed', status=200)

            # If event is currently being processed by another worker, skip
            if webhook_event.processing_started_at and not created:
                # Check if processing started recently (within last 5 minutes)
                # If so, another worker is handling it
                from datetime import timedelta

                from django.utils import timezone as tz

                if webhook_event.processing_started_at > tz.now() - timedelta(minutes=5):
                    logger.info(f'Webhook event {event_id} is being processed by another worker, skipping')
                    return HttpResponse('Webhook being processed', status=200)
                else:
                    # Previous processing timed out, allow retry
                    StructuredLogger.log_service_operation(
                        service_name='StripeWebhook',
                        operation='reprocess',
                        success=True,
                        metadata={'event_id': event_id, 'reason': 'previous_processing_timeout'},
                        logger_instance=logger,
                    )

            # Mark processing started (within the locked transaction)
            webhook_event.mark_processing_started()

        # Handle different event types
        event_data = event['data']

        try:
            # Checkout events
            if event_type == 'checkout.session.completed':
                StripeService.handle_checkout_session_completed(event_data)

            # Subscription events
            elif event_type == 'customer.subscription.created':
                StripeService.handle_subscription_updated(event_data)

            elif event_type == 'customer.subscription.updated':
                StripeService.handle_subscription_updated(event_data)

            elif event_type == 'customer.subscription.deleted':
                StripeService.handle_subscription_deleted(event_data)

            # Payment events
            elif event_type == 'payment_intent.succeeded':
                # Check if this is a marketplace purchase or billing purchase
                payment_intent = event_data['object']
                metadata = payment_intent.get('metadata', {})

                if metadata.get('platform') == 'allthrive_marketplace':
                    # Marketplace product purchase
                    from core.marketplace.services import MarketplaceCheckoutService

                    MarketplaceCheckoutService.handle_payment_success(payment_intent['id'])
                    logger.info(f'Processed marketplace payment: {payment_intent["id"]}')
                else:
                    # Billing purchase (token packages)
                    StripeService.handle_payment_intent_succeeded(event_data)

            elif event_type == 'payment_intent.payment_failed':
                # Check if this is a marketplace purchase
                payment_intent = event_data['object']
                metadata = payment_intent.get('metadata', {})

                if metadata.get('platform') == 'allthrive_marketplace':
                    from core.marketplace.services import MarketplaceCheckoutService

                    MarketplaceCheckoutService.handle_payment_failure(payment_intent['id'])

                StructuredLogger.log_service_operation(
                    service_name='StripeWebhook',
                    operation='payment_failed',
                    success=False,
                    metadata={'payment_intent_id': event_data['object']['id']},
                    logger_instance=logger,
                )

            # Invoice events - handle credit pack grants
            elif event_type == 'invoice.payment_succeeded':
                invoice = event_data['object']
                subscription_id = invoice.get('subscription')

                if subscription_id:
                    # Check if this is a credit pack subscription
                    import stripe

                    try:
                        subscription = stripe.Subscription.retrieve(subscription_id)
                        metadata = subscription.get('metadata', {})

                        if metadata.get('type') == 'credit_pack':
                            # This is a credit pack invoice - grant monthly credits
                            from django.contrib.auth import get_user_model
                            from django.db import transaction

                            from .credit_pack_service import CreditPackService
                            from .models import CreditPack, UserCreditPackSubscription

                            User = get_user_model()
                            user_id = metadata.get('user_id')
                            credit_pack_id = metadata.get('credit_pack_id')

                            if user_id and credit_pack_id:
                                try:
                                    user = User.objects.get(id=user_id)
                                except User.DoesNotExist:
                                    StructuredLogger.log_error(
                                        message='Credit pack invoice webhook: user not found',
                                        error=None,
                                        extra={
                                            'user_id': user_id,
                                            'subscription_id': subscription_id,
                                            'invoice_id': invoice['id'],
                                        },
                                        logger_instance=logger,
                                    )
                                    webhook_event.mark_processing_failed(f'User {user_id} not found')
                                    return HttpResponse('User not found', status=200)

                                try:
                                    credit_pack = CreditPack.objects.get(id=credit_pack_id)
                                except CreditPack.DoesNotExist:
                                    StructuredLogger.log_error(
                                        message='Credit pack invoice webhook: credit pack not found',
                                        error=None,
                                        extra={
                                            'credit_pack_id': credit_pack_id,
                                            'user_id': user_id,
                                            'subscription_id': subscription_id,
                                            'invoice_id': invoice['id'],
                                        },
                                        logger_instance=logger,
                                    )
                                    webhook_event.mark_processing_failed(f'Credit pack {credit_pack_id} not found')
                                    return HttpResponse('Credit pack not found', status=200)

                                # Verify subscription ownership to prevent metadata manipulation
                                existing_sub = UserCreditPackSubscription.objects.filter(
                                    user=user,
                                    stripe_subscription_id=subscription_id,
                                ).first()

                                # For renewal invoices, verify subscription exists and matches
                                # For initial invoices (no existing sub), we allow creation
                                if existing_sub and existing_sub.credit_pack_id != int(credit_pack_id):
                                    StructuredLogger.log_error(
                                        message='Credit pack invoice webhook: metadata mismatch',
                                        error=None,
                                        extra={
                                            'expected_credit_pack_id': existing_sub.credit_pack_id,
                                            'received_credit_pack_id': credit_pack_id,
                                            'subscription_id': subscription_id,
                                        },
                                        logger_instance=logger,
                                    )
                                    webhook_event.mark_processing_failed('Credit pack metadata mismatch')
                                    return HttpResponse('Metadata mismatch', status=200)

                                # Use atomic transaction for credit grant + subscription update
                                with transaction.atomic():
                                    # Grant monthly credits
                                    CreditPackService.grant_monthly_credits(user, credit_pack)

                                    # Update subscription period
                                    from datetime import UTC

                                    from django.utils import timezone

                                    sub, _ = UserCreditPackSubscription.objects.select_for_update().get_or_create(
                                        user=user,
                                        defaults={'credit_pack': credit_pack, 'status': 'active'},
                                    )
                                    sub.credit_pack = credit_pack
                                    sub.stripe_subscription_id = subscription_id
                                    sub.status = subscription.get('status', 'active')
                                    if subscription.get('current_period_start'):
                                        sub.current_period_start = timezone.datetime.fromtimestamp(
                                            subscription['current_period_start'], tz=UTC
                                        )
                                    if subscription.get('current_period_end'):
                                        sub.current_period_end = timezone.datetime.fromtimestamp(
                                            subscription['current_period_end'], tz=UTC
                                        )
                                    sub.credits_this_period = credit_pack.credits_per_month
                                    sub.save()

                                logger.info(
                                    f'Granted {credit_pack.credits_per_month} credits to user {user_id} '
                                    f'from credit pack {credit_pack.name}'
                                )
                    except stripe.error.StripeError as e:
                        # Log Stripe API errors but don't fail - might not be a credit pack subscription
                        logger.warning(f'Stripe API error checking subscription {subscription_id}: {e}')

                logger.info(f'Invoice payment succeeded: {invoice["id"]}')  # Info level ok

            elif event_type == 'invoice.payment_failed':
                StructuredLogger.log_service_operation(
                    service_name='StripeWebhook',
                    operation='invoice_payment_failed',
                    success=False,
                    metadata={'invoice_id': event_data['object']['id']},
                    logger_instance=logger,
                )

            else:
                logger.info(f'Unhandled webhook event type: {event_type}')  # Info level ok

            # Mark processing completed
            webhook_event.mark_processing_completed()

            return HttpResponse('Webhook received', status=200)

        except Exception as processing_error:
            # Mark processing failed
            webhook_event.mark_processing_failed(str(processing_error))
            raise

    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Webhook signature verification failed',
            error=e,
            logger_instance=logger,
        )
        return HttpResponse('Invalid signature', status=400)

    except Exception as e:
        StructuredLogger.log_error(
            message='Error processing webhook',
            error=e,
            logger_instance=logger,
        )
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
        "billing_interval": "monthly" | "annual" (required)
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
        billing_interval = serializer.validated_data['billing_interval']

        result = StripeService.create_subscription(request.user, tier, billing_interval)

        return Response(result, status=status.HTTP_201_CREATED)

    except SubscriptionTier.DoesNotExist:
        StructuredLogger.log_validation_error(
            message='Attempted to subscribe to nonexistent tier',
            user=request.user,
            errors={'tier_slug': 'Tier not found'},
            logger_instance=logger,
        )
        return Response({'error': 'Tier not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to create subscription',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_session_view(request):
    """
    Create a Stripe Checkout Session for subscription.

    POST /api/v1/billing/checkout/create/

    Body:
    {
        "tier_slug": "community-pro",
        "billing_interval": "monthly" | "annual" (required),
        "success_url": "{FRONTEND_URL}/pricing/success",
        "cancel_url": "{FRONTEND_URL}/pricing",
        "credit_pack_id": 2  // optional - adds credit pack to checkout
    }

    Returns:
    {
        "session_id": "cs_xxx",
        "url": "https://checkout.stripe.com/c/pay/cs_xxx"
    }
    """
    serializer = CreateSubscriptionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        tier = SubscriptionTier.objects.get(slug=serializer.validated_data['tier_slug'])
        billing_interval = serializer.validated_data['billing_interval']

        # Get success and cancel URLs from request, with defaults
        from django.conf import settings

        success_url = request.data.get('success_url', f'{settings.FRONTEND_URL}/pricing/success')
        cancel_url = request.data.get('cancel_url', f'{settings.FRONTEND_URL}/pricing')

        # Get optional credit pack
        credit_pack = None
        credit_pack_id = request.data.get('credit_pack_id')
        if credit_pack_id:
            try:
                credit_pack = CreditPack.objects.get(id=credit_pack_id, is_active=True)
            except CreditPack.DoesNotExist:
                return Response({'error': 'Credit pack not found'}, status=status.HTTP_404_NOT_FOUND)

        result = StripeService.create_checkout_session(
            request.user, tier, billing_interval, success_url, cancel_url, credit_pack
        )

        return Response(result, status=status.HTTP_201_CREATED)

    except SubscriptionTier.DoesNotExist:
        StructuredLogger.log_validation_error(
            message='Attempted to create checkout for nonexistent tier',
            user=request.user,
            errors={'tier_slug': 'Tier not found'},
            logger_instance=logger,
        )
        return Response({'error': 'Tier not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to create checkout session',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
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
        StructuredLogger.log_validation_error(
            message='Attempted to update to nonexistent tier',
            user=request.user,
            errors={'tier_slug': 'Tier not found'},
            logger_instance=logger,
        )
        return Response({'error': 'Tier not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to update subscription',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
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
        StructuredLogger.log_error(
            message='Failed to cancel subscription',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
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
        StructuredLogger.log_validation_error(
            message='Attempted to purchase nonexistent token package',
            user=request.user,
            errors={'package_slug': 'Package not found'},
            logger_instance=logger,
        )
        return Response({'error': 'Package not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to create token purchase',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
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
    purchases = (
        request.user.token_purchases.filter(status='completed').select_related('package').order_by('-created_at')[:20]
    )  # Last 20
    serializer = TokenPurchaseSerializer(purchases, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subscription_history_view(request):
    """
    Get user's subscription change history.

    GET /api/v1/billing/subscriptions/history/
    """
    changes = request.user.subscription_changes.select_related('from_tier', 'to_tier', 'subscription').all()[
        :20
    ]  # Last 20
    serializer = SubscriptionChangeSerializer(changes, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_portal_session_view(request):
    """
    Create a Stripe Customer Portal session for managing billing.

    POST /api/v1/billing/portal/

    Body (optional):
    {
        "return_url": "https://example.com/account/settings/billing"
    }

    Returns:
    {
        "url": "https://billing.stripe.com/session/xxx"
    }
    """
    try:
        return_url = request.data.get('return_url')
        result = StripeService.create_customer_portal_session(request.user, return_url)
        return Response(result)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to create portal session',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
        error_code = 'NO_STRIPE_CUSTOMER' if 'No Stripe customer' in str(e) else 'PORTAL_ERROR'
        return Response({'error': str(e), 'error_code': error_code}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_invoices_view(request):
    """
    List user's invoices from Stripe.

    GET /api/v1/billing/invoices/
    GET /api/v1/billing/invoices/?limit=20

    Returns:
    {
        "invoices": [
            {
                "id": "in_xxx",
                "number": "ABC-001",
                "amount_paid": 999,
                "currency": "usd",
                "status": "paid",
                "created": 1699999999,
                "invoice_pdf": "https://...",
                "hosted_invoice_url": "https://..."
            }
        ],
        "has_more": false
    }
    """
    try:
        limit = int(request.query_params.get('limit', 10))
        result = StripeService.list_invoices(request.user, limit)
        return Response(result)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to list invoices',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError:
        return Response({'error': 'Invalid limit parameter'}, status=status.HTTP_400_BAD_REQUEST)


# ===== Credit Pack Endpoints =====


@api_view(['GET'])
def list_credit_packs_view(request):
    """
    List all available credit packs.

    GET /api/v1/billing/credit-packs/
    """
    packs = CreditPack.objects.filter(is_active=True).order_by('sort_order')
    serializer = CreditPackSerializer(packs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_credit_pack_status_view(request):
    """
    Get user's credit pack subscription status.

    GET /api/v1/billing/credit-pack/status/

    Returns:
    {
        "has_credit_pack": true,
        "credit_pack": {
            "id": 1,
            "name": "1,250 credits",
            "credits_per_month": 1250,
            "price_cents": 4000
        },
        "status": "active",
        "credit_pack_balance": 850,
        "current_period_start": "2024-01-01T00:00:00Z",
        "current_period_end": "2024-02-01T00:00:00Z",
        "credits_this_period": 1250
    }
    """
    from .credit_pack_service import CreditPackService

    status_data = CreditPackService.get_user_credit_pack_status(request.user)
    return Response(status_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscribe_credit_pack_view(request):
    """
    Subscribe to a credit pack.

    POST /api/v1/billing/credit-pack/subscribe/

    Body:
    {
        "credit_pack_id": 2
    }

    Returns:
    {
        "success": true,
        "subscription_id": "sub_xxx"
    }
    """
    serializer = SubscribeCreditPackSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .credit_pack_service import CreditPackService

        pack = CreditPack.objects.get(id=serializer.validated_data['credit_pack_id'])
        subscription = CreditPackService.subscribe(request.user, pack)

        return Response(
            {
                'success': True,
                'subscription_id': subscription.id,
            },
            status=status.HTTP_201_CREATED,
        )

    except CreditPack.DoesNotExist:
        return Response({'error': 'Credit pack not found'}, status=status.HTTP_404_NOT_FOUND)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to subscribe to credit pack',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_credit_pack_view(request):
    """
    Change to a different credit pack.

    POST /api/v1/billing/credit-pack/change/

    Body:
    {
        "credit_pack_id": 3
    }

    Returns:
    {
        "success": true
    }
    """
    serializer = ChangeCreditPackSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .credit_pack_service import CreditPackService

        pack = CreditPack.objects.get(id=serializer.validated_data['credit_pack_id'])
        CreditPackService.change_pack(request.user, pack)

        return Response({'success': True})

    except CreditPack.DoesNotExist:
        return Response({'error': 'Credit pack not found'}, status=status.HTTP_404_NOT_FOUND)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to change credit pack',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_credit_pack_view(request):
    """
    Cancel credit pack subscription.

    POST /api/v1/billing/credit-pack/cancel/

    Returns:
    {
        "success": true,
        "message": "Credit pack subscription cancelled. Remaining credits have been forfeited."
    }
    """
    try:
        from .credit_pack_service import CreditPackService

        CreditPackService.cancel(request.user)

        return Response(
            {
                'success': True,
                'message': 'Credit pack subscription cancelled. Remaining credits have been forfeited.',
            }
        )

    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except StripeServiceError as e:
        StructuredLogger.log_error(
            message='Failed to cancel credit pack',
            error=e,
            user=request.user,
            logger_instance=logger,
        )
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
