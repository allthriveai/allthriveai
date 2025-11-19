# Settings Redesign Documentation

## Overview

The account settings page has been redesigned to feature a secondary left navigation menu, allowing users to easily navigate between different settings sections. This design is inspired by modern web applications like Dribbble and provides a cleaner, more organized interface.

## Architecture

### Components

#### SettingsLayout (`frontend/src/components/layouts/SettingsLayout.tsx`)
- Secondary sidebar component with navigation for settings sections
- Uses `NavLink` from React Router for active state management
- Includes icons from Heroicons for visual clarity
- Responsive design with overflow handling

### Pages

#### Main Settings Pages
1. **Edit Profile** (`/account/settings`) - `AccountSettingsPage.tsx`
   - **Profile Photo**: Drag-and-drop file upload with live preview (uploads to MinIO)
   - **Profile Information**:
     - Username (editable with validation)
     - First name and last name (side-by-side on desktop)
     - Bio (5000 character limit with counter)
     - Website URL (personal website or portfolio)
     - Calendar URL (Calendly, Cal.com, etc.)
   - **Account Information** (read-only):
     - Email
     - Account role
   - Username validation (unique, 3-30 characters, lowercase alphanumeric with hyphens/underscores)
   - Fully functional with API integration

2. **Password** (`/account/settings/password`) - `PasswordSettingsPage.tsx`
   - Change password functionality
   - Current password validation
   - Password confirmation
   - Security requirements (min 8 characters)
   - Fully functional with API integration

3. **Social Profiles** (`/account/settings/social`) - `SocialSettingsPage.tsx`
   - Placeholder for social media connections
   - Coming soon state

4. **Email Notifications** (`/account/settings/notifications`) - `NotificationsSettingsPage.tsx`
   - Placeholder for notification preferences
   - Coming soon state

5. **Billing** (`/account/settings/billing`) - `BillingSettingsPage.tsx`
   - Placeholder for billing and subscription management
   - Coming soon state

6. **Privacy & Security** (`/account/settings/privacy`) - `PrivacySettingsPage.tsx`
   - Placeholder for privacy controls
   - Coming soon state

7. **Teams** (`/account/settings/teams`) - `TeamsSettingsPage.tsx`
   - Placeholder for team management
   - Coming soon state

## Navigation Structure

```
Account Settings
├── Edit Profile (default)
├── Password
├── Social Profiles
├── Email Notifications
├── Billing
├── Privacy & Security
└── Teams
```

## Routes

All settings routes are protected and require authentication:

- `/account/settings` - Edit Profile
- `/account/settings/password` - Password
- `/account/settings/social` - Social Profiles
- `/account/settings/notifications` - Email Notifications
- `/account/settings/billing` - Billing
- `/account/settings/privacy` - Privacy & Security
- `/account/settings/teams` - Teams

## Design Features

### Secondary Sidebar
- Fixed width (256px / w-64)
- Glass morphism styling for consistency
- Active state highlighting with primary color
- Smooth transitions
- Icon + label navigation items

### Content Area
- Flexible width that fills remaining space
- Scrollable overflow
- Consistent padding (32px / p-8)
- Maximum content width for readability (varies by page)

### Visual Consistency
- Uses existing design system (glass-strong, primary colors)
- Dark mode support
- Consistent form styling
- Standard button patterns
- Success/error feedback

## API Integration

### Edit Profile
- **Endpoint**: `PATCH /api/v1/me/profile/`
- **Fields**:
  - `username` (required): User's unique identifier
  - `first_name`: User's first name
  - `last_name`: User's last name
  - `bio`: User biography (max 5000 characters)
  - `avatar_url`: Profile photo URL
  - `website_url`: Personal website or portfolio link
  - `calendar_url`: Public calendar/booking link
- **Validation**:
  - Username: unique, 3-30 characters, lowercase letters/numbers/hyphens/underscores only
  - Automatic lowercase normalization
  - XSS prevention on bio field
  - URL validation for avatar_url, website_url, calendar_url
- **Features**:
  - Large profile photo preview with fallback to initials
  - Real-time character counter for bio
  - Success/error feedback
  - Responsive two-column layout for name fields

### Change Password
- **Endpoint**: `POST /api/v1/auth/change-password/`
- **Fields**: current_password, new_password
- **Validation**:
  - Password match confirmation
  - Minimum length requirement
  - Current password verification

## Future Enhancements

### Planned Features
1. **Social Profiles**: Connect GitHub, LinkedIn, Twitter accounts
2. **Email Notifications**: Granular notification preferences
3. **Billing**: Stripe integration for subscriptions
4. **Privacy & Security**:
   - Two-factor authentication
   - Active sessions management
   - Data export/deletion
5. **Teams**:
   - Create and manage teams
   - Team member invitations
   - Role-based permissions

### Mobile Responsiveness
The current implementation should be enhanced with:
- Collapsible secondary sidebar on mobile
- Hamburger menu for settings navigation
- Touch-optimized controls

## Usage

### Adding a New Settings Page

1. Create new page component in `frontend/src/pages/settings/`:
```typescript
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';

export default function NewSettingsPage() {
  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          {/* Your content here */}
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
```

2. Add route in `frontend/src/routes/index.tsx`:
```typescript
import NewSettingsPage from '@/pages/settings/NewSettingsPage';

// In routes:
<Route
  path="/account/settings/new-page"
  element={
    <ProtectedRoute>
      <NewSettingsPage />
    </ProtectedRoute>
  }
/>
```

3. Add navigation item in `SettingsLayout.tsx`:
```typescript
{
  label: 'New Page',
  path: '/account/settings/new-page',
  icon: YourIcon,
}
```

## Testing

To test the new settings interface:

1. Start the development server (should already be running)
2. Navigate to `http://localhost:3000/account/settings`
3. Test navigation between different settings pages
4. Verify active state highlighting
5. Test form submissions on Edit Profile and Password pages

## Accessibility

- Semantic HTML structure
- Keyboard navigation support via NavLink
- Clear visual feedback for active states
- Form labels properly associated
- Error messages clearly communicated

## Performance

- Lazy loading of settings pages via React Router
- Minimal re-renders with proper state management
- Optimized form submissions with loading states
- Debounced input handling where appropriate
