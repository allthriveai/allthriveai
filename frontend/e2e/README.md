# E2E Tests for Project Editing

## Overview

These end-to-end tests verify the project editing functionality, specifically the new sidebar edit tray feature.

## Test Coverage

### Project Edit Tray (`project-edit.spec.ts`)

**Opening the Tray:**
- ✅ Opens via "Quick Edit" button in options menu
- ✅ Opens via `E` keyboard shortcut
- ✅ Shows all three tabs (Content, Hero Display, Settings)

**Editing Functionality:**
- ✅ Updates project title with autosave
- ✅ Updates description
- ✅ Shows "Saving..." → "Saved at [time]" indicator
- ✅ Tray stays open during edits
- ✅ Changes reflect immediately in main view
- ✅ Input fields retain values after save

**UI Interactions:**
- ✅ Closes with X button
- ✅ Closes by clicking overlay
- ✅ Switches between tabs
- ✅ Opens full editor from tray
- ✅ `E` key doesn't trigger when typing in inputs

**Data Integrity:**
- ✅ Preserves like/heart state after edits

**Hero Display Tab:**
- ✅ Switches between display modes (Image, Video, Quote, Slideshow, Slide Up)
- ✅ Shows appropriate inputs for each mode

**Settings Tab:**
- ✅ Toggles showcase setting
- ✅ Toggles private setting
- ✅ Updates project slug
- ✅ URL updates when slug changes

## Prerequisites

### 1. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 2. Configure Test Environment

Create `e2e/.env` based on `.env.example`:

```bash
cp e2e/.env.example e2e/.env
```

Edit `e2e/.env` with your test credentials:

```env
TEST_USER_EMAIL=your-test-email@example.com
TEST_USER_PASSWORD=your-test-password
TEST_USER_USERNAME=your-username
TEST_PROJECT_SLUG=test-project-slug
```

### 3. Ensure Backend is Running

Make sure your Django backend is running:

```bash
# In the project root
make up
```

### 4. Ensure Frontend Dev Server is Running

The tests will automatically start the dev server, but you can also start it manually:

```bash
npm run dev
```

## Running Tests

### Run all e2e tests:

```bash
npm run test:e2e
```

### Run specific test file:

```bash
npx playwright test e2e/project-edit.spec.ts
```

### Run tests in headed mode (see browser):

```bash
npx playwright test --headed
```

### Run specific test:

```bash
npx playwright test -g "should update project title"
```

### Debug mode:

```bash
npx playwright test --debug
```

### Run with UI mode:

```bash
npx playwright test --ui
```

## Test Data Setup

**Important:** These tests require:

1. **A test user account** - The user credentials must exist in your database
2. **A test project** - The project with the slug specified in TEST_PROJECT_SLUG must exist and be owned by the test user
3. **Authentication working** - OAuth or email/password login must be functional

### Creating Test Data

You can create test data via:

1. **Django admin** - Create user and project manually
2. **Django management command** - Write a custom command to seed test data
3. **API calls** - Use the frontend to create test data once

## CI/CD Integration

To run tests in CI:

```yaml
# Example GitHub Actions
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

## Viewing Test Reports

After running tests:

```bash
npx playwright show-report
```

## Troubleshooting

### Tests fail with "not visible" errors
- Check that selectors match your current UI
- Increase timeout if needed: `{ timeout: 10000 }`
- Run in headed mode to see what's happening

### Authentication fails
- Verify test credentials are correct
- Check that login endpoint is working
- Ensure cookies/session handling is correct

### Project not found
- Verify TEST_PROJECT_SLUG exists
- Ensure project is owned by test user
- Check URL structure matches routes

### Autosave not triggering
- Check AUTOSAVE_DEBOUNCE_MS value (default 2000ms)
- Increase wait timeout in tests
- Verify backend is receiving save requests

## Writing New Tests

When adding new tests:

1. Follow existing test structure
2. Use descriptive test names
3. Include beforeEach setup when needed
4. Clean up test data if necessary
5. Add assertions for both UI and API state
6. Test both success and error cases

### Example Test Template:

```typescript
test('should do something', async ({ page }) => {
  // Navigate
  await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);

  // Action
  await page.click('button:has-text("Action")');

  // Assert
  await expect(page.locator('text=Expected Result')).toBeVisible();
});
```

## Related Documentation

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Sidebar Edit Tray Feature](../../docs/SIDEBAR_EDIT_TRAY.md)
- [Project Editor Page](../src/pages/ProjectEditorPage.tsx)
- [Project Detail Page](../src/pages/ProjectDetailPage.tsx)
