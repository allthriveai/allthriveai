# E2E Test Checklist

Comprehensive checklist of Playwright E2E tests to implement for AllThrive AI.

**Last Updated**: December 2024
**Current Coverage**: ~12-15% of 65+ routes

---

## Current Test Coverage

| Test File | Lines | Status |
|-----------|-------|--------|
| `intelligent-chat.spec.ts` | 1,155 | ✅ Extensive |
| `prompt-battles.spec.ts` | 1,547 | ✅ Comprehensive |
| `personalization.spec.ts` | 535 | ✅ Good |
| `security.spec.ts` | 340 | ✅ Comprehensive |
| `hero-editor.spec.ts` | 265 | ✅ Good |
| `side-quests.spec.ts` | 140 | ⚠️ Basic |
| `events-calendar.spec.ts` | 95 | ⚠️ Basic |
| `pricing-faq.spec.ts` | 80 | ⚠️ Minimal |
| `login.spec.ts` | 65 | ✅ Complete |
| `smoke.spec.ts` | 51 | ✅ CI sanity |
| `admin-prompt-editor.spec.ts` | 985 | ✅ Comprehensive |

---

## 🔴 CRITICAL PRIORITY

### 1. `checkout.spec.ts` - Payment & Subscription Flow
- [ ] Navigate to pricing page and view all plans
- [ ] Select a plan and proceed to checkout
- [ ] Complete Stripe checkout flow (test mode)
- [ ] Verify subscription status updates after payment
- [ ] Test checkout cancellation/abandonment
- [ ] Verify billing page displays current plan
- [ ] Test plan upgrade flow
- [ ] Test plan downgrade flow
- [ ] Verify checkout success page displays correctly
- [ ] Test payment failure handling

### 2. `project-management.spec.ts` - Project CRUD
- [ ] Create new project via UI
- [ ] Create new project via chat integration
- [ ] Edit project title
- [ ] Edit project description
- [ ] Add hero image to project
- [ ] Add hero video to project
- [ ] Add slideshow images to project
- [ ] Remove media items from project
- [ ] Toggle project visibility (public/private)
- [ ] Delete project with confirmation dialog
- [ ] Cancel project deletion
- [ ] Verify project appears on user profile after creation
- [ ] Verify project URL routing (`/:username/:projectSlug`)
- [ ] Test project auto-save functionality
- [ ] Test project draft vs published states

### 3. `admin-prompt-editor.spec.ts` - Prompt Challenge Admin ✅ COMPLETE (29 tests)
- [x] Navigate to admin prompt challenge page (admin user)
- [x] View list of prompt challenge prompts
- [x] Add new prompt
- [x] Edit existing prompt
- [x] Select single prompt for editing
- [x] Bulk select multiple prompts
- [x] Bulk edit selected prompts
- [x] Bulk delete with confirmation dialog
- [x] Cancel bulk delete
- [x] Verify non-admin cannot access page
- [x] Test pagination/infinite scroll if applicable
- [x] Test search/filter prompts

### 4. `quizzes.spec.ts` - Quiz System
- [ ] Navigate to quiz list page
- [ ] View available quizzes
- [ ] Start a quiz
- [ ] Answer single-choice question
- [ ] Answer multiple-choice question
- [ ] Navigate between quiz questions
- [ ] Submit completed quiz
- [ ] View quiz results/score
- [ ] Retry failed quiz
- [ ] View quiz completion history
- [ ] Test quiz timer (if applicable)
- [ ] Test partial quiz progress saving

---

## 🟡 HIGH PRIORITY

### 5. `learning-paths.spec.ts` - Learning System
- [ ] Navigate to learn page
- [ ] View available learning content/modules
- [ ] Start a learning module
- [ ] Progress through lesson content
- [ ] Complete a lesson
- [ ] Track progress through module
- [ ] Complete entire module
- [ ] Verify completion status persists
- [ ] View learning history/progress

### 6. `thrive-circle.spec.ts` - Community Features
- [ ] Navigate to Thrive Circle page
- [ ] View circle content
- [ ] Join a circle
- [ ] Leave a circle
- [ ] View circle members
- [ ] Post in circle (if applicable)
- [ ] View circle activity feed

### 7. `user-profile.spec.ts` - Profile Management
- [ ] View own profile page
- [ ] Edit display name
- [ ] Edit bio/description
- [ ] Upload profile avatar
- [ ] View profile showcase section
- [ ] Customize showcase layout
- [ ] View another user's public profile
- [ ] Verify private content not visible on public profile
- [ ] Test profile URL routing (`/:username`)
- [ ] View profile statistics/metrics

### 8. `weekly-challenges.spec.ts` - Challenges
- [ ] Navigate to challenges page
- [ ] View current week's challenge
- [ ] View challenge details and requirements
- [ ] Submit challenge entry
- [ ] View own submission
- [ ] View other submissions (if public)
- [ ] View past challenges
- [ ] View challenge leaderboard (if applicable)

### 9. `onboarding.spec.ts` - New User Flow
- [ ] New user sees Ember onboarding on first login
- [ ] Complete onboarding step 1
- [ ] Complete onboarding step 2
- [ ] Complete all onboarding steps
- [ ] Skip onboarding option works
- [ ] Onboarding state persists (doesn't show again)
- [ ] Onboarding can be restarted from settings

---

## 🟢 MEDIUM PRIORITY

### 10. `tool-directory.spec.ts` - AI Tools
- [ ] Navigate to tool directory
- [ ] View list of AI tools
- [ ] Search for specific tool
- [ ] Filter tools by category
- [ ] View tool detail page
- [ ] Save/bookmark a tool
- [ ] Remove tool from bookmarks
- [ ] View tool within project context

### 11. `admin-features.spec.ts` - Admin Panel
- [ ] Access admin analytics dashboard
- [ ] View analytics metrics
- [ ] Access invitation management page
- [ ] Create new invitation
- [ ] Revoke invitation
- [ ] Access user impersonation
- [ ] Impersonate a user
- [ ] End impersonation session
- [ ] Access circle management
- [ ] Create/edit/delete circles

### 12. `vendor-dashboard.spec.ts` - Vendor Features
- [ ] Access vendor dashboard (vendor user)
- [ ] View vendor metrics/stats
- [ ] Manage vendor products/tools
- [ ] Update vendor settings
- [ ] Verify non-vendor cannot access

### 13. `notifications-settings.spec.ts` - Notifications
- [ ] Navigate to notification settings
- [ ] Toggle email notifications
- [ ] Toggle push notifications
- [ ] Toggle specific notification types
- [ ] Verify settings persist after page reload
- [ ] Reset notification preferences

### 14. `integrations-settings.spec.ts` - Integrations
- [ ] Navigate to integrations settings
- [ ] View connected integrations
- [ ] Connect GitHub integration
- [ ] Disconnect GitHub integration
- [ ] Connect LinkedIn integration
- [ ] View integration sync status
- [ ] Manually trigger sync

### 15. `mobile-responsiveness.spec.ts` - Mobile Views
- [ ] Test homepage on mobile viewport (375x667)
- [ ] Test navigation menu on mobile
- [ ] Test chat panel on mobile
- [ ] Test battle UI on mobile
- [ ] Test profile page on mobile
- [ ] Test settings pages on mobile
- [ ] Test project detail page on mobile
- [ ] Test quiz interface on mobile

### 16. `explore-page.spec.ts` - Content Discovery
- [ ] Navigate to explore page
- [ ] View project cards
- [ ] Filter projects by category
- [ ] Sort projects (newest, popular, etc.)
- [ ] Infinite scroll/pagination works
- [ ] Click project card navigates to detail
- [ ] Search functionality (if applicable)

---

## 🔵 LOWER PRIORITY

### 17. `error-handling.spec.ts` - Error Scenarios
- [ ] 404 page displays for invalid routes
- [ ] 403 page displays for unauthorized access
- [ ] Network timeout shows appropriate message
- [ ] API error displays user-friendly message
- [ ] Rate limiting shows feedback to user
- [ ] Form validation errors display correctly
- [ ] Recover from temporary network failure

### 18. `referrals.spec.ts` - Referral Program
- [ ] Navigate to referrals page
- [ ] View referral link
- [ ] Copy referral link to clipboard
- [ ] View referral statistics
- [ ] View referred users list
- [ ] View referral rewards/credits

### 19. `account-settings-navigation.spec.ts` - Settings Navigation
- [ ] Navigate to main settings page
- [ ] Navigate to activity settings
- [ ] Navigate to battles settings
- [ ] Navigate to integrations settings
- [ ] Navigate to personalization settings
- [ ] Navigate to notifications settings
- [ ] Navigate to billing settings
- [ ] Navigate to creator settings
- [ ] Navigate to privacy settings
- [ ] Navigate to referrals page
- [ ] All settings pages load without error

### 20. `public-pages.spec.ts` - Static Pages
- [ ] About page loads correctly
- [ ] Privacy policy page loads
- [ ] Terms of service page loads
- [ ] Pricing page loads with all plans
- [ ] Extension page loads
- [ ] Feature promo page loads
- [ ] Pitch deck page (with password gate)

### 21. `privacy-settings.spec.ts` - Privacy Controls
- [ ] Navigate to privacy settings
- [ ] Toggle profile visibility
- [ ] Toggle activity visibility
- [ ] Request data export
- [ ] Download exported data
- [ ] Request account deletion
- [ ] Cancel account deletion

### 22. `billing-settings.spec.ts` - Billing Management
- [ ] Navigate to billing settings
- [ ] View current subscription
- [ ] View billing history
- [ ] Download invoice
- [ ] Update payment method
- [ ] Cancel subscription
- [ ] Reactivate subscription

---

## 🧪 EDGE CASES & ADVANCED

### 23. `concurrent-users.spec.ts` - Multi-User Scenarios
- [ ] Two users in same battle simultaneously
- [ ] Real-time updates between users
- [ ] Concurrent project edits (conflict handling)
- [ ] Chat messages sync across sessions

### 24. `accessibility.spec.ts` - A11y Testing
- [ ] Keyboard navigation works throughout app
- [ ] Screen reader compatibility
- [ ] Color contrast meets WCAG standards
- [ ] Focus states visible
- [ ] ARIA labels present

### 25. `performance.spec.ts` - Performance
- [ ] Page load times under threshold
- [ ] Large list rendering (virtual scrolling)
- [ ] Image lazy loading works
- [ ] No memory leaks on navigation

### 26. `security.spec.ts` - Security ✅
- [x] XSS prevention (user input sanitized)
- [x] CSRF tokens present on forms
- [x] Auth tokens not exposed in URL
- [x] Protected routes redirect to login
- [x] Rate limiting enforced
- [x] Security headers validation (bonus)

---

## Test Implementation Notes

### Test User Fixtures Needed
- Regular authenticated user
- Admin user
- Vendor user
- Guest/unauthenticated user
- User with subscription
- User without subscription

### Environment Variables Required
```
PLAYWRIGHT_TEST_USER_EMAIL=
PLAYWRIGHT_TEST_USER_PASSWORD=
PLAYWRIGHT_ADMIN_USER_EMAIL=
PLAYWRIGHT_ADMIN_USER_PASSWORD=
STRIPE_TEST_MODE=true
```

### Tagging Strategy
Use Playwright tags to categorize tests:
- `@smoke` - Critical path, runs on every PR
- `@critical` - Must pass before deploy
- `@slow` - Tests with long timeouts (AI generation, etc.)
- `@flaky` - Known intermittent failures
- `@skip-ci` - Requires API keys not available in CI

### Running Tests
```bash
# Run all E2E tests
cd frontend && npm run test:e2e

# Run specific test file
cd frontend && npx playwright test checkout.spec.ts

# Run tests with specific tag
cd frontend && npx playwright test --grep @smoke

# Run in headed mode for debugging
cd frontend && npx playwright test --headed
```

---

## Progress Tracking

| Priority | Total Tests | Implemented | Passing |
|----------|-------------|-------------|---------|
| 🔴 Critical | 4 files | 1 | 29 |
| 🟡 High | 5 files | 0 | 0 |
| 🟢 Medium | 7 files | 0 | 0 |
| 🔵 Lower | 6 files | 0 | 0 |
| 🧪 Advanced | 4 files | 1 | TBD |
| **Total** | **26 files** | **2** | **29+** |

---

## References

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [AllThrive Routes](../frontend/src/App.tsx)
- [Existing E2E Tests](../frontend/e2e/)
