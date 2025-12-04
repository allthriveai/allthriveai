# 🎨 Subscribe Modal Implementation Guide

**Component**: SubscribeModal
**Design System**: Neon Glass
**Status**: ✅ Ready to Integrate
**Last Updated**: 2025-12-02

---

## 📦 What Was Built

### Components Created

1. **SubscribeModal.tsx** (`frontend/src/components/billing/SubscribeModal.tsx`)
   - Beautiful neon glass modal with glassmorphism effects
   - Tier comparison cards
   - Billing cycle toggle (monthly/annual)
   - Loading and error states
   - Fully responsive
   - Keyboard accessible (ESC to close)

2. **useSubscribeModal Hook** (`frontend/src/hooks/useSubscribeModal.ts`)
   - Zustand-based global state management
   - Easy to trigger from anywhere
   - Supports pre-selection of tiers
   - Supports custom messages for paywalls

3. **SubscribeModalProvider** (`frontend/src/components/billing/SubscribeModalProvider.tsx`)
   - Wraps app and provides modal globally
   - Auto-detects 403 paywall errors
   - Automatically opens modal with correct tier
   - Handles feature-to-tier mapping

4. **Index Barrel Export** (`frontend/src/components/billing/index.ts`)
   - Clean exports for all billing components

---

## 🎨 Design Features

### Neon Glass Aesthetic
- **Glassmorphism**: Frosted glass effect with blur
- **Neon Accents**: Cyan, teal, and pink neon glows
- **Gradient Buttons**: Cyan-to-green gradient on primary actions
- **Neon Shadows**: Glowing shadows on selected cards
- **Dark Theme**: Deep navy background with ambient gradients

### Visual Hierarchy
- **Popular Badge**: "MOST POPULAR" badge on Pro Learn tier
- **Tier Colors**: Unique neon color per tier (cyan, teal, pink)
- **Selected State**: Neon ring and glow on selected tier
- **Price Display**: Large, bold pricing with monthly equivalent

### Responsive Design
- Desktop: 3-column grid
- Tablet: 2-column grid
- Mobile: Single column
- Max-width: 6xl (72rem)
- Max-height: 90vh with scroll

---

## 🚀 Integration Steps

### Step 1: Install Dependencies (if not already installed)

```bash
npm install zustand @stripe/stripe-js @stripe/react-stripe-js
```

### Step 2: Add Provider to App

In `frontend/src/App.tsx`:

```tsx
import { SubscribeModalProvider } from '@/components/billing';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SubscribeModalProvider>
        {/* Your existing app content */}
        <Router>
          <Routes>
            {/* ...routes */}
          </Routes>
        </Router>
      </SubscribeModalProvider>
    </QueryClientProvider>
  );
}
```

### Step 3: Use the Hook (Optional - Manual Trigger)

If you want to manually trigger the modal from anywhere:

```tsx
import { useSubscribeModal } from '@/hooks/useSubscribeModal';

function MyComponent() {
  const { openSubscribeModal } = useSubscribeModal();

  const handleUpgradeClick = () => {
    openSubscribeModal({
      blockedFeature: 'Advanced Analytics',
      message: 'Upgrade to Pro Learn to unlock advanced analytics dashboard',
      selectedTierSlug: 'pro_learn',
    });
  };

  return (
    <button onClick={handleUpgradeClick}>
      Upgrade Now
    </button>
  );
}
```

### Step 4: Automatic Paywall Detection

The `SubscribeModalProvider` automatically detects 403 errors with `upgrade_required: true` and opens the modal.

**Backend must return**:
```json
{
  "detail": "Analytics is not available in your current subscription tier.",
  "feature": "analytics",
  "upgrade_required": true
}
```

**Feature-to-Tier Mapping** (automatic):
- `analytics` → `pro_learn`
- `creator_tools` → `creator_mentor`
- `marketplace` → `community_pro`
- `circles` → `community_pro`

---

## 🧩 Component API

### SubscribeModal Props

```typescript
interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTierSlug?: string;        // Pre-select a tier
  blockedFeature?: string;          // Feature that triggered paywall
  message?: string;                 // Custom upgrade message
}
```

### useSubscribeModal Hook

```typescript
const {
  isOpen,                           // Modal open state
  openSubscribeModal,               // Function to open modal
  closeSubscribeModal,              // Function to close modal
  blockedFeature,                   // Current blocked feature
  message,                          // Current message
  selectedTierSlug,                 // Currently selected tier
} = useSubscribeModal();
```

---

## 🎯 User Flow

### 1. User Hits Paywall
```
User clicks "View Analytics"
→ API returns 403 with upgrade_required
→ Axios interceptor catches error
→ SubscribeModalProvider extracts feature info
→ Modal opens with:
   - Feature: "analytics"
   - Message: "Upgrade to Pro Learn..."
   - Pre-selected tier: "pro_learn"
```

### 2. User Selects Tier
```
Modal displays 3 tiers:
- Community Pro ($9/month)
- Pro Learn ($29/month) [SELECTED] [MOST POPULAR]
- Creator/Mentor ($99/month)

User can:
- Switch billing cycle (monthly/annual)
- Select different tier
- View feature comparison
```

### 3. User Confirms
```
User clicks "Continue to Payment"
→ Modal calls createSubscription() mutation
→ Shows loading state
→ On success: Modal closes, subscription updated
→ On error: Shows error message, stays open
```

---

## 🔧 Customization

### Add More Tier Colors

In `getTierNeonColor()`:

```tsx
const getTierNeonColor = (tierType: string) => {
  switch (tierType) {
    case 'community_pro':
      return 'neon-cyan';
    case 'pro_learn':
      return 'neon-teal';
    case 'creator_mentor':
      return 'neon-pink';
    case 'enterprise':  // NEW
      return 'neon-green';  // NEW
    default:
      return 'neon-cyan';
  }
};
```

### Add More Features to Display

In `getFeatureList()`:

```tsx
if (tier.hasCustomFeature) features.push('Custom Feature Name');
```

### Change Popular Tier

In tier cards rendering:

```tsx
const isPopular = tier.tierType === 'creator_mentor'; // Change this
```

---

## 🎨 Neon Glass CSS Variables Used

The modal uses these CSS variables from `index.css`:

```css
--bg-primary: #020617;
--bg-secondary: #0f172a;
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #64748b;

--neon-cyan: #0EA5E9;
--neon-teal: #22D3EE;
--neon-green: #4ade80;
--neon-pink: #FB37FF;

--gradient-primary: linear-gradient(135deg, #22d3ee, #4ade80);

--glass-fill: rgba(255, 255, 255, 0.08);
--glass-fill-subtle: rgba(255, 255, 255, 0.05);
--glass-fill-strong: rgba(255, 255, 255, 0.12);
--glass-border: rgba(148, 163, 184, 0.35);

--shadow-neon: 0 0 20px rgba(34, 211, 238, 0.3), 0 0 10px rgba(34, 211, 238, 0.1);
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] **Modal Opens**
  - Trigger from paywall (403 error)
  - Trigger manually with hook
  - Verify correct tier is pre-selected

- [ ] **Visual Design**
  - Glass effect visible
  - Neon glows render correctly
  - Popular badge shows on Pro Learn
  - Selected tier has neon ring

- [ ] **Interactions**
  - Billing cycle toggle works
  - Tier selection updates state
  - ESC key closes modal
  - Click outside closes modal
  - Close button works

- [ ] **Responsiveness**
  - Mobile: Single column
  - Tablet: 2 columns
  - Desktop: 3 columns
  - Modal scrolls on small screens

- [ ] **States**
  - Loading spinner shows while fetching tiers
  - Error message displays on API failure
  - "Continue to Payment" button disabled when no tier selected
  - Processing state shows during subscription creation

### Unit Test Example

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SubscribeModal } from './SubscribeModal';

describe('SubscribeModal', () => {
  it('renders with neon glass styling', () => {
    render(
      <SubscribeModal
        isOpen={true}
        onClose={() => {}}
        blockedFeature="Analytics"
      />
    );

    expect(screen.getByText(/Choose Your Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Analytics/i)).toBeInTheDocument();
  });

  it('pre-selects tier based on feature', () => {
    render(
      <SubscribeModal
        isOpen={true}
        onClose={() => {}}
        selectedTierSlug="pro_learn"
      />
    );

    expect(screen.getByText(/Selected/i)).toBeInTheDocument();
  });
});
```

---

## 📊 Analytics to Track

Once integrated, track these metrics:

```typescript
// Track modal views
analytics.track('Subscribe Modal Viewed', {
  blockedFeature: 'analytics',
  selectedTierSlug: 'pro_learn',
  billingCycle: 'annual',
});

// Track tier selection
analytics.track('Tier Selected', {
  tierSlug: 'pro_learn',
  billingCycle: 'annual',
  previousTier: 'free',
});

// Track conversion
analytics.track('Subscription Started', {
  tierSlug: 'pro_learn',
  billingCycle: 'annual',
  price: 29,
  triggeredBy: 'paywall',
  blockedFeature: 'analytics',
});
```

---

## 🚨 Troubleshooting

### Modal Doesn't Open on 403

**Check**:
1. Is `SubscribeModalProvider` wrapping your app?
2. Does the 403 response include `upgrade_required: true`?
3. Is the response structure correct?

**Debug**:
```tsx
// Add to SubscribeModalProvider
console.log('403 Response:', error.response.data);
```

### Tiers Not Loading

**Check**:
1. Is `getSubscriptionTiers()` API working?
2. Check React Query DevTools
3. Verify API endpoint returns tiers

**Debug**:
```tsx
const { data, error, isLoading } = useQuery({
  queryKey: ['subscription-tiers'],
  queryFn: getSubscriptionTiers,
});

console.log({ data, error, isLoading });
```

### Styling Broken

**Check**:
1. Are neon glass CSS variables defined in `index.css`?
2. Is Tailwind properly configured?
3. Are CSS custom properties supported in browser?

**Fix**: Ensure `index.css` is imported in `main.tsx`

---

## 🔜 Next Steps

### 1. Add Stripe Payment Form (TODO)

The modal currently shows tiers but needs a payment form:

```tsx
// Step 1: When user clicks "Continue to Payment"
// → Show Stripe Elements payment form
// → Collect card details
// → Process payment
// → Activate subscription

// Will be implemented in next phase
```

### 2. Add Loading Skeleton

While tiers are loading:

```tsx
{tiersLoading && (
  <div className="grid grid-cols-3 gap-6 p-8">
    {[1, 2, 3].map((i) => (
      <div key={i} className="animate-pulse">
        <div className="h-64 bg-glass-fill rounded-lg" />
      </div>
    ))}
  </div>
)}
```

### 3. Add Animations

Use Framer Motion for smooth animations:

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
>
  {/* Modal content */}
</motion.div>
```

---

## 📚 Related Files

### Frontend
- `frontend/src/components/billing/SubscribeModal.tsx` - Main modal component
- `frontend/src/components/billing/SubscribeModalProvider.tsx` - Global provider
- `frontend/src/hooks/useSubscribeModal.ts` - State management hook
- `frontend/src/services/billing.ts` - API service functions
- `frontend/src/index.css` - Neon glass design system

### Backend
- `core/billing/permissions.py` - Permission classes
- `core/billing/views.py` - Subscription API endpoints
- `core/views/ai_analytics_views.py` - Example paywall usage

---

## 💡 Usage Examples

### Example 1: Manual Trigger from Button

```tsx
import { useSubscribeModal } from '@/hooks/useSubscribeModal';

function AnalyticsDashboard() {
  const { openSubscribeModal } = useSubscribeModal();
  const { data: subscription } = useSubscription();

  if (!subscription.hasAnalytics) {
    return (
      <div className="p-8 text-center">
        <h2>Analytics is a Premium Feature</h2>
        <button onClick={() => openSubscribeModal({
          blockedFeature: 'Advanced Analytics',
          selectedTierSlug: 'pro_learn',
        })}>
          Upgrade to Pro Learn
        </button>
      </div>
    );
  }

  return <ActualAnalyticsDashboard />;
}
```

### Example 2: Automatic from API Error

```tsx
// This happens automatically when SubscribeModalProvider is active

async function fetchAnalytics() {
  try {
    const data = await api.get('/api/ai-analytics/user/');
    return data;
  } catch (error) {
    // If this is a 403 with upgrade_required,
    // the modal will open automatically!
    throw error;
  }
}
```

### Example 3: From Pricing Page

```tsx
import { useNavigate } from 'react-router-dom';
import { useSubscribeModal } from '@/hooks/useSubscribeModal';

function PricingCard({ tier }) {
  const { openSubscribeModal } = useSubscribeModal();

  return (
    <button onClick={() => openSubscribeModal({
      selectedTierSlug: tier.tierType,
    })}>
      Select {tier.name}
    </button>
  );
}
```

---

**Status**: ✅ Ready for Integration
**Next Phase**: Add Stripe payment form
**Blockers**: None

**Created**: 2025-12-02
**Version**: 1.0
