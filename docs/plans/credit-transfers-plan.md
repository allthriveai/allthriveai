# Credit Transfers Plan

## Overview

Allow users to transfer AllThrive credits to each other for tips, gifts, and peer support. This is a lightweight internal ledger system (no Stripe required for transfers).

## Key Decisions

| Decision | Choice |
|----------|--------|
| Transfer fee | 0% - free transfers between users |
| Minimum transfer | 10 credits |
| Maximum transfer | 10,000 credits per transaction |
| Daily limit | 50,000 credits per day (prevents abuse) |
| Recipient requirements | Must have verified account |

---

## Use Cases

1. **Tip creators with credits** - Alternative to cash tips in TipModal
2. **Gift friends** - Send credits to other users
3. **Community rewards** - Reward helpful community members
4. **Bounties** - Offer credits for help with projects

---

## Data Models

Add to `core/billing/models.py`:

```python
class CreditTransfer(models.Model):
    """Track credit transfers between users."""
    TRANSFER_TYPES = [
        ('tip', 'Creator Tip'),
        ('gift', 'Gift'),
        ('reward', 'Community Reward'),
        ('bounty', 'Bounty'),
        ('other', 'Other'),
    ]

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='credits_sent')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='credits_received')

    amount = models.PositiveIntegerField()  # Credits transferred
    transfer_type = models.CharField(max_length=20, choices=TRANSFER_TYPES, default='gift')

    # Optional context
    message = models.TextField(blank=True, max_length=500)
    is_anonymous = models.BooleanField(default=False)

    # Link to related objects (optional)
    product = models.ForeignKey('marketplace.Product', null=True, blank=True, on_delete=models.SET_NULL)
    project = models.ForeignKey('projects.Project', null=True, blank=True, on_delete=models.SET_NULL)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sender', 'created_at']),
            models.Index(fields=['recipient', 'created_at']),
        ]


class CreditTransferSettings(models.Model):
    """User preferences for receiving credit transfers."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='credit_transfer_settings')

    # Receiving preferences
    accept_transfers = models.BooleanField(default=True)
    accept_anonymous = models.BooleanField(default=True)
    minimum_amount = models.PositiveIntegerField(default=10)

    # Notifications
    notify_on_receive = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

---

## Services

Create `core/billing/services/credit_transfer.py`:

```python
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta

class CreditTransferService:
    """Handle credit transfers between users."""

    MIN_TRANSFER = 10
    MAX_TRANSFER = 10_000
    DAILY_LIMIT = 50_000

    @staticmethod
    def validate_transfer(sender, recipient, amount) -> tuple[bool, str]:
        """Validate a transfer can be made."""
        # Check amount bounds
        if amount < CreditTransferService.MIN_TRANSFER:
            return False, f"Minimum transfer is {CreditTransferService.MIN_TRANSFER} credits"

        if amount > CreditTransferService.MAX_TRANSFER:
            return False, f"Maximum transfer is {CreditTransferService.MAX_TRANSFER} credits"

        # Check sender balance
        if sender.credit_balance < amount:
            return False, "Insufficient credits"

        # Check daily limit
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_sent = CreditTransfer.objects.filter(
            sender=sender,
            created_at__gte=today_start
        ).aggregate(total=Sum('amount'))['total'] or 0

        if today_sent + amount > CreditTransferService.DAILY_LIMIT:
            remaining = CreditTransferService.DAILY_LIMIT - today_sent
            return False, f"Daily limit reached. You can send {remaining} more credits today."

        # Check recipient settings
        settings, _ = CreditTransferSettings.objects.get_or_create(user=recipient)
        if not settings.accept_transfers:
            return False, "This user is not accepting credit transfers"

        if amount < settings.minimum_amount:
            return False, f"This user requires a minimum of {settings.minimum_amount} credits"

        # Can't send to yourself
        if sender == recipient:
            return False, "You cannot send credits to yourself"

        return True, "OK"

    @staticmethod
    @transaction.atomic
    def transfer_credits(
        sender,
        recipient,
        amount: int,
        transfer_type: str = 'gift',
        message: str = '',
        is_anonymous: bool = False,
        product=None,
        project=None,
    ) -> CreditTransfer:
        """Execute a credit transfer."""
        # Validate
        is_valid, error_msg = CreditTransferService.validate_transfer(sender, recipient, amount)
        if not is_valid:
            raise ValidationError(error_msg)

        # Deduct from sender (with row lock)
        sender_profile = User.objects.select_for_update().get(pk=sender.pk)
        sender_profile.credit_balance -= amount
        sender_profile.save(update_fields=['credit_balance'])

        # Add to recipient
        recipient_profile = User.objects.select_for_update().get(pk=recipient.pk)
        recipient_profile.credit_balance += amount
        recipient_profile.save(update_fields=['credit_balance'])

        # Create transfer record
        transfer = CreditTransfer.objects.create(
            sender=sender,
            recipient=recipient,
            amount=amount,
            transfer_type=transfer_type,
            message=message,
            is_anonymous=is_anonymous,
            product=product,
            project=project,
        )

        # Send notification
        if CreditTransferSettings.objects.filter(user=recipient, notify_on_receive=True).exists():
            CreditTransferService._send_notification(transfer)

        return transfer

    @staticmethod
    def _send_notification(transfer):
        """Send notification to recipient."""
        from core.notifications.services import NotificationService

        if transfer.is_anonymous:
            sender_name = "Someone"
        else:
            sender_name = transfer.sender.get_full_name() or transfer.sender.username

        NotificationService.create_notification(
            user=transfer.recipient,
            notification_type='credit_received',
            title=f"{sender_name} sent you {transfer.amount} credits!",
            message=transfer.message[:100] if transfer.message else None,
            related_user=None if transfer.is_anonymous else transfer.sender,
        )

    @staticmethod
    def get_transfer_history(user, direction='all', limit=50):
        """Get user's transfer history."""
        if direction == 'sent':
            return CreditTransfer.objects.filter(sender=user)[:limit]
        elif direction == 'received':
            return CreditTransfer.objects.filter(recipient=user)[:limit]
        else:
            return CreditTransfer.objects.filter(
                models.Q(sender=user) | models.Q(recipient=user)
            )[:limit]

    @staticmethod
    def get_transfer_stats(user) -> dict:
        """Get user's transfer statistics."""
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        return {
            'total_sent': CreditTransfer.objects.filter(sender=user).aggregate(Sum('amount'))['amount__sum'] or 0,
            'total_received': CreditTransfer.objects.filter(recipient=user).aggregate(Sum('amount'))['amount__sum'] or 0,
            'sent_today': CreditTransfer.objects.filter(sender=user, created_at__gte=today_start).aggregate(Sum('amount'))['amount__sum'] or 0,
            'daily_limit_remaining': CreditTransferService.DAILY_LIMIT - (CreditTransfer.objects.filter(sender=user, created_at__gte=today_start).aggregate(Sum('amount'))['amount__sum'] or 0),
        }
```

---

## API Endpoints

Add to `core/billing/views.py`:

```python
class CreditTransferViewSet(viewsets.ViewSet):
    """Handle credit transfer operations."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def send(self, request):
        """Send credits to another user."""
        recipient_id = request.data.get('recipient_id')
        amount = int(request.data.get('amount'))
        transfer_type = request.data.get('transfer_type', 'gift')
        message = request.data.get('message', '')
        is_anonymous = request.data.get('is_anonymous', False)

        recipient = User.objects.get(id=recipient_id)

        transfer = CreditTransferService.transfer_credits(
            sender=request.user,
            recipient=recipient,
            amount=amount,
            transfer_type=transfer_type,
            message=message,
            is_anonymous=is_anonymous,
        )

        return Response({
            'transfer_id': transfer.id,
            'amount': transfer.amount,
            'new_balance': request.user.credit_balance,
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get transfer history."""
        direction = request.query_params.get('direction', 'all')
        transfers = CreditTransferService.get_transfer_history(
            request.user, direction=direction
        )
        return Response(CreditTransferSerializer(transfers, many=True).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get transfer statistics."""
        return Response(CreditTransferService.get_transfer_stats(request.user))

    @action(detail=False, methods=['get', 'patch'])
    def settings(self, request):
        """Get or update transfer settings."""
        settings, _ = CreditTransferSettings.objects.get_or_create(user=request.user)

        if request.method == 'PATCH':
            serializer = CreditTransferSettingsSerializer(
                settings, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

        return Response(CreditTransferSettingsSerializer(settings).data)
```

---

## Frontend Components

| Component | Description |
|-----------|-------------|
| `SendCreditsModal.tsx` | Modal for sending credits with amount, message, anonymous toggle |
| `SendCreditsButton.tsx` | Button that opens SendCreditsModal (for user profiles) |
| `CreditTransferHistory.tsx` | List of sent/received transfers |
| `CreditTransferSettings.tsx` | User preferences for receiving transfers |

### Integration with TipModal

Update `TipModal.tsx` to offer payment method choice:

```typescript
// In TipModal.tsx
const [paymentMethod, setPaymentMethod] = useState<'card' | 'credits'>('card');

// Show toggle if user has sufficient credits
{userCredits >= tipAmount && (
  <PaymentMethodToggle
    value={paymentMethod}
    onChange={setPaymentMethod}
    cardLabel="Pay with card"
    creditsLabel={`Pay with credits (${userCredits} available)`}
  />
)}

// On submit
if (paymentMethod === 'credits') {
  await creditTransferApi.send({
    recipient_id: creatorId,
    amount: tipAmount,
    transfer_type: 'tip',
    message: tipMessage,
    is_anonymous: isAnonymous,
  });
} else {
  // Existing Stripe flow
}
```

---

## Critical Files

### Backend
| File | Changes |
|------|---------|
| `core/billing/models.py` | Add CreditTransfer, CreditTransferSettings models |
| `core/billing/services/credit_transfer.py` | **NEW**: CreditTransferService |
| `core/billing/views.py` | Add CreditTransferViewSet |
| `core/billing/serializers.py` | Add CreditTransferSerializer, CreditTransferSettingsSerializer |
| `core/billing/urls.py` | Add credit transfer routes |

### Frontend
| File | Changes |
|------|---------|
| `components/billing/SendCreditsModal.tsx` | **NEW**: Modal for sending credits |
| `components/billing/SendCreditsButton.tsx` | **NEW**: Button for user profiles |
| `components/marketplace/TipModal.tsx` | **UPDATE**: Add credits payment option |
| `pages/settings/CreditTransferSettings.tsx` | **NEW**: User preferences |
| `services/creditTransfer.ts` | **NEW**: API service |
| `types/billing.ts` | Add CreditTransfer types |

---

## Implementation Tasks

### Week 1: Core Transfer System
- [ ] Add CreditTransfer, CreditTransferSettings models
- [ ] Create CreditTransferService with validation
- [ ] Add CreditTransferViewSet endpoints
- [ ] Add serializers
- [ ] Write unit tests for transfer logic

### Week 2: Frontend + Integration
- [ ] Create SendCreditsModal component
- [ ] Create SendCreditsButton for user profiles
- [ ] Add credit transfer history page
- [ ] Create transfer settings page
- [ ] **Integrate with TipModal** (pay with card OR credits)
- [ ] Add notifications for received credits
- [ ] End-to-end testing

---

## Summary

| Item | Value |
|------|-------|
| **Duration** | 2 weeks |
| **Dependencies** | Existing credit balance system |
| **Integration** | Marketplace TipModal (pay with credits option) |
| **Risk** | Low - simple ledger transfers |

This can run in parallel with Marketplace MVP or immediately after.
