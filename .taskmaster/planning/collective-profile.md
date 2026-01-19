# PRD: Collective Profile Features

## Overview
Complete the remaining profile features for The AI Network Collective.

## Features

### 1. Profile: Achievements Section
Display user achievement badges on their profile.

**Requirements:**
- Show achievement badges with icon and name
- Hover shows description tooltip
- Only show earned achievements
- Use Neon Glass design system (glass-panel, glass-card)
- Use Heroicons, NO emojis

**Test Steps:**
1. Navigate to http://localhost:3000/@allierays
2. Scroll to 'Achievements' section
3. Verify achievement badges display with icon and name
4. Hover over badge - should show description tooltip
5. curl http://localhost:8000/api/users/{username}/achievements/ returns data

### 2. Listing: Create Ask Flow
Full flow to create an ask listing.

**Requirements:**
- Form at /listings/new?intent=ask
- Fields: title, description, listing type
- Publish saves to database
- Redirects to listing detail page
- Appears on user's profile in Asks section

**Test Steps:**
1. Log in as test user
2. Navigate to http://localhost:3000/listings/new?intent=ask
3. Fill in title: 'Test Ask'
4. Fill in description
5. Select a listing type
6. Click Publish
7. Verify redirect to listing detail page
8. Navigate to profile - new ask should appear in Asks section

### 3. Listing: Create Offer Flow
Full flow to create an offer listing.

**Requirements:**
- Form at /listings/new?intent=offer
- Fields: title, description, listing type, optional price
- Publish saves to database
- Redirects to listing detail page
- Appears on user's profile in Offers section

**Test Steps:**
1. Log in as test user
2. Navigate to http://localhost:3000/listings/new?intent=offer
3. Fill in title: 'Test Offer'
4. Fill in description
5. Select a listing type
6. Optionally set price
7. Click Publish
8. Verify redirect to listing detail page
9. Navigate to profile - new offer should appear in Offers section

### 4. Listing: Edit Flow
Edit existing listing from profile.

**Requirements:**
- Edit button on listing cards (owner only)
- Pre-populated form
- Save updates database
- Changes visible on detail page

**Test Steps:**
1. Log in as test user with existing listings
2. Navigate to your profile
3. Find a listing and click edit button
4. Modify the title
5. Click Save
6. Verify changes persisted on detail page
7. curl http://localhost:8000/api/listings/{slug}/ shows updated title

### 5. Listing: Delete Flow
Delete listing from profile.

**Requirements:**
- Delete button on listing cards (owner only)
- Confirmation modal
- Hard delete from database
- Removed from profile

**Test Steps:**
1. Log in as test user with existing listings
2. Navigate to your profile
3. Find a listing and click delete button
4. Confirm deletion in modal
5. Verify listing no longer appears on profile
6. curl http://localhost:8000/api/listings/{slug}/ returns 404

### 6. Collective: Landing Page
Landing page with hero and waitlist form.

**Requirements:**
- Hero section with tagline
- Waitlist email input
- Responsive layout
- No console errors

**Test Steps:**
1. Navigate to http://localhost:3000/collective
2. Verify hero section renders with tagline
3. Verify waitlist email input is visible
4. Check page loads without console errors
5. Verify responsive layout on mobile viewport

### 7. Collective: Waitlist Submission
Email capture for waitlist.

**Requirements:**
- Email validation
- POST to /api/waitlist/
- Success message on submit
- Store in database

**Test Steps:**
1. Navigate to http://localhost:3000/collective
2. Enter email: test@example.com
3. Click submit button
4. Verify success message appears
5. curl POST http://localhost:8000/api/waitlist/ with email returns 201
6. Check database: Waitlist.objects.filter(email='test@example.com').exists()

### 8. Curated Links: CRUD
Add/edit/delete curated links on profile.

**Requirements:**
- Add link button in Things I Love section
- Form: URL, title, description
- Edit existing links
- Delete links
- Changes persist

**Test Steps:**
1. Log in as test user
2. Navigate to profile -> Things I Love section
3. Click 'Add Link' button
4. Fill in URL and title
5. Save - verify link appears in section
6. Edit the link - verify changes persist
7. Delete the link - verify it disappears
