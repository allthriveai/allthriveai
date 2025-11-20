# Referral System Documentation

## Overview

The AllThrive AI referral system allows users to invite friends by sharing a unique referral code. This system tracks referrals and is designed to support future reward programs.

## Features

- **Unique Referral Codes**: Each user automatically gets a unique 8-character referral code
- **Usage Tracking**: Track how many times a referral code has been used
- **Referral Status**: Monitor referrals through different stages (pending, completed, rewarded)
- **Sharing Options**: Users can copy their code or share via link with native share functionality
- **Admin Interface**: Full Django admin support for managing referrals

## Database Models

### ReferralCode
Stores individual referral codes for users.

**Fields:**
- `code` (CharField): Unique 8-character code (auto-generated)
- `user` (OneToOneField): The user who owns this code
- `uses_count` (IntegerField): Number of times the code has been used
- `max_uses` (IntegerField, optional): Maximum allowed uses (null = unlimited)
- `is_active` (BooleanField): Whether the code can be used
- `expires_at` (DateTimeField, optional): Expiration date (null = never expires)

**Methods:**
- `is_valid()`: Check if the code is currently valid
- `increment_usage()`: Increment the usage counter

### Referral
Tracks individual referral relationships.

**Fields:**
- `referrer` (ForeignKey): User who made the referral
- `referred_user` (OneToOneField): User who was referred
- `referral_code` (ForeignKey): The code that was used
- `status` (CharField): Current status (pending/completed/rewarded/cancelled)
- `notes` (TextField): Internal notes
- `reward_data` (JSONField): Data about rewards given

**Methods:**
- `mark_completed()`: Mark the referral as completed
- `mark_rewarded(reward_info)`: Mark as rewarded with optional reward details

## API Endpoints

All endpoints are under `/api/v1/` and require authentication unless noted.

### Get User's Referral Code
```
GET /api/v1/me/referral-code/
```
Returns the authenticated user's referral code. Auto-creates one if it doesn't exist.

**Response:**
```json
{
  "id": 1,
  "code": "ABC123XY",
  "username": "johndoe",
  "created_at": "2025-11-19T15:00:00Z",
  "uses_count": 5,
  "max_uses": null,
  "is_active": true,
  "expires_at": null,
  "is_valid": true,
  "referral_url": "http://localhost:3000/signup?ref=ABC123XY"
}
```

### Get Referral Statistics
```
GET /api/v1/me/referral-code/stats/
```
Returns statistics about the user's referrals.

**Response:**
```json
{
  "total_referrals": 5,
  "pending_referrals": 2,
  "completed_referrals": 3,
  "rewarded_referrals": 0,
  "total_uses": 5
}
```

### List User's Referrals
```
GET /api/v1/me/referrals/
```
Returns a list of all referrals made by the user.

**Response:**
```json
[
  {
    "id": 1,
    "referrer_username": "johndoe",
    "referred_username": "janedoe",
    "referral_code_value": "ABC123XY",
    "created_at": "2025-11-18T10:00:00Z",
    "status": "completed",
    "status_display": "Completed",
    "reward_data": {}
  }
]
```

### Validate Referral Code
```
GET /api/v1/referrals/validate/{code}/
```
Validates if a referral code exists and is valid for use.

**Response (valid):**
```json
{
  "valid": true,
  "referrer_username": "johndoe"
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "error": "Invalid referral code"
}
```

### Regenerate Referral Code
```
POST /api/v1/me/referral-code/regenerate/
```
Deactivates the current code and generates a new one. Use with caution as old links will stop working.

## Frontend Components

### ReferralCodeDisplay
Located at: `frontend/src/components/referrals/ReferralCodeDisplay.tsx`

A reusable component that displays a referral code with:
- Large, easy-to-read code display
- Copy-to-clipboard functionality for both code and URL
- Native share functionality (falls back to clipboard on unsupported browsers)
- Usage statistics
- Active/inactive status indicator

**Props:**
```typescript
interface ReferralCodeDisplayProps {
  code: string;
  referralUrl: string;
  usesCount: number;
  maxUses?: number | null;
  isValid: boolean;
}
```

### Account Settings Integration
The referral section is integrated into `AccountSettingsPage.tsx` and displays:
- User's referral code with copy/share functionality
- Statistics cards showing:
  - Total referrals
  - Pending referrals
  - Completed referrals
  - Rewarded referrals
- Information box explaining how the system works

## Usage

### For Users
1. Navigate to Account Settings
2. Scroll to the "Referrals" section
3. Copy your referral code or link
4. Share with friends via the share button or manually

### For Administrators
1. Access Django Admin at `/admin/`
2. Navigate to "Referral codes" or "Referrals"
3. View, filter, and manage referral codes and relationships
4. Update referral statuses (e.g., mark as rewarded)
5. Disable codes if needed

## Future Enhancements

The system is designed to support future reward programs:

1. **Reward Configuration**: Add reward rules in the admin
2. **Automatic Rewards**: Trigger rewards when referrals reach certain statuses
3. **Reward History**: Track what rewards have been given
4. **Tiered Rewards**: Different rewards based on number of successful referrals
5. **Time-based Campaigns**: Limited-time referral bonuses

## Code Generation

Referral codes are generated using Django's `get_random_string()` utility:
- 8 characters long
- Uses uppercase letters (excluding confusing ones like I, O, L) and numbers
- Checked for uniqueness at the database level
- Format: `ABCD1234`

## Security Considerations

1. **Rate Limiting**: Consider adding rate limiting to the validation endpoint
2. **User Verification**: Ensure referred users complete necessary verification steps
3. **Fraud Prevention**: Monitor for suspicious patterns (e.g., one user creating multiple accounts)
4. **Code Privacy**: Codes are unique but not secret - they're meant to be shared

## Testing

To test the referral system:

1. **Backend Tests**: Run `make test-backend`
2. **Manual Testing**:
   - Create a user account
   - Navigate to Account Settings
   - Verify referral code is generated
   - Copy the referral link
   - Create a new account using the referral link (when signup integration is added)
   - Verify the referral appears in the original user's dashboard

## Integration with Signup

To integrate referral codes with the signup process:

1. **Capture Referral Code**: Extract `ref` parameter from URL query string
2. **Validate Code**: Call `/api/v1/referrals/validate/{code}/` endpoint
3. **Store Temporarily**: Keep code in signup form state
4. **Create Referral**: After successful user creation, create a Referral record
5. **Update Code Usage**: Increment the referral code's usage counter

Example flow:
```typescript
// 1. On signup page load
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get('ref');

// 2. Validate if present
if (refCode) {
  const isValid = await api.get(`/referrals/validate/${refCode}/`);
  // Show validation feedback
}

// 3. Include in signup payload
const signupData = {
  // ... other fields
  referralCode: refCode
};
```

## Troubleshooting

**Issue**: Referral code not appearing in Account Settings
- Check backend logs for errors
- Verify migrations have been applied
- Ensure user is authenticated
- Check browser console for API errors

**Issue**: Copy functionality not working
- Verify HTTPS connection (clipboard API requires secure context)
- Check browser compatibility
- Fallback to manual copy should be displayed

**Issue**: Referral code already used by another user
- This is a database constraint violation
- Code generation should handle uniqueness automatically
- If recurring, check code generation logic

## API Response Examples

See the API Endpoints section above for detailed response formats.
