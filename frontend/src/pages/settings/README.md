# Settings Pages

This directory contains all the individual settings pages that are displayed within the `SettingsLayout` component.

## Structure

Each settings page follows a consistent pattern:

```tsx
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';

export default function YourSettingsPage() {
  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          {/* Page content */}
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
```

## Pages

### PasswordSettingsPage.tsx
Change password functionality with validation and security checks.

**Status**: ✅ Fully Functional

### SocialSettingsPage.tsx
Social media profile connections.

**Status**: 🚧 Coming Soon

### NotificationsSettingsPage.tsx
Email notification preferences.

**Status**: 🚧 Coming Soon

### BillingSettingsPage.tsx
Billing and subscription management.

**Status**: 🚧 Coming Soon

### PrivacySettingsPage.tsx
Privacy and security controls.

**Status**: 🚧 Coming Soon

### TeamsSettingsPage.tsx
Team management and invitations.

**Status**: 🚧 Coming Soon

## Navigation

All pages are accessible via the secondary sidebar in the SettingsLayout component. The sidebar provides:
- Visual icons for each section
- Active state highlighting
- Smooth navigation transitions

## Adding a New Page

1. Create a new file in this directory following the naming convention: `YourFeatureSettingsPage.tsx`
2. Add the route in `frontend/src/routes/index.tsx`
3. Add the navigation item in `frontend/src/components/layouts/SettingsLayout.tsx`

See `/docs/SETTINGS_REDESIGN.md` for detailed implementation guide.
