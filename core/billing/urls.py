"""
Billing URL Configuration
"""

from django.urls import path

from . import views

app_name = 'billing'

urlpatterns = [
    # Webhook
    path('webhooks/stripe/', views.stripe_webhook, name='stripe-webhook'),
    # Public endpoints
    path('tiers/', views.list_subscription_tiers, name='list-tiers'),
    path('packages/', views.list_token_packages, name='list-packages'),
    # Subscription management (authenticated)
    path('status/', views.get_subscription_status_view, name='subscription-status'),
    path('subscriptions/create/', views.create_subscription_view, name='create-subscription'),
    path('subscriptions/update/', views.update_subscription_view, name='update-subscription'),
    path('subscriptions/cancel/', views.cancel_subscription_view, name='cancel-subscription'),
    path('subscriptions/history/', views.get_subscription_history_view, name='subscription-history'),
    # Token management (authenticated)
    path('tokens/purchase/', views.create_token_purchase_view, name='purchase-tokens'),
    path('tokens/balance/', views.get_token_balance_view, name='token-balance'),
    path('tokens/transactions/', views.get_token_transactions_view, name='token-transactions'),
    path('purchases/', views.get_purchase_history_view, name='purchase-history'),
]
