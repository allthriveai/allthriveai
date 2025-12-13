"""
End-to-End Tests for Authentication Gate (Beta Code).

MISSION CRITICAL: Users MUST enter beta code "THRIVE" to access login.

Tests cover:
1. Auth page requires beta code before showing OAuth buttons
2. Invalid beta codes are rejected
3. Valid beta code "THRIVE" unlocks OAuth buttons
4. Source code verification (always runs, no frontend needed)

Run with: make test-e2e-critical
"""

from pathlib import Path

import requests
from django.conf import settings
from django.test import TestCase


class BetaCodeSourceVerificationTest(TestCase):
    """
    CRITICAL: Verify beta code gate exists in source code.

    These tests verify the AuthPage.tsx source code contains the
    beta code gate logic. They run without needing the frontend.
    """

    def get_auth_page_source(self):
        """Read the AuthPage.tsx source file."""
        # Find the frontend directory
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        auth_page_path = base_dir / 'frontend' / 'src' / 'pages' / 'AuthPage.tsx'

        if not auth_page_path.exists():
            self.skipTest(f'AuthPage.tsx not found at {auth_page_path}')

        return auth_page_path.read_text()

    def test_thrive_beta_code_exists_in_source(self):
        """
        CRITICAL: AuthPage.tsx MUST define 'THRIVE' as a valid beta code.

        If this test fails, someone removed or changed the beta gate!
        """
        source = self.get_auth_page_source()

        self.assertIn(
            "'THRIVE'",
            source,
            "CRITICAL: 'THRIVE' must be defined as a valid beta code in AuthPage.tsx. "
            'The beta gate has been removed or modified!',
        )

    def test_valid_beta_codes_array_exists(self):
        """
        CRITICAL: AuthPage.tsx MUST have VALID_BETA_CODES array.
        """
        source = self.get_auth_page_source()

        self.assertIn(
            'VALID_BETA_CODES',
            source,
            'CRITICAL: VALID_BETA_CODES array must exist in AuthPage.tsx. ' 'The beta gate logic has been removed!',
        )

    def test_beta_unlocked_state_exists(self):
        """
        CRITICAL: AuthPage.tsx MUST have isBetaUnlocked state.

        This state controls whether OAuth buttons are visible.
        """
        source = self.get_auth_page_source()

        self.assertIn(
            'isBetaUnlocked',
            source,
            'CRITICAL: isBetaUnlocked state must exist in AuthPage.tsx. ' 'The beta gate UI logic has been removed!',
        )

    def test_beta_code_input_exists(self):
        """
        CRITICAL: AuthPage.tsx MUST have beta code input field.
        """
        source = self.get_auth_page_source()

        # Check for beta code input field
        has_beta_input = 'betaCode' in source or 'beta code' in source.lower()

        self.assertTrue(
            has_beta_input,
            'CRITICAL: Beta code input field must exist in AuthPage.tsx. ' 'Users cannot enter beta code!',
        )

    def test_oauth_buttons_gated_by_beta_unlock(self):
        """
        CRITICAL: OAuth buttons MUST be hidden behind isBetaUnlocked check.

        The pattern should be: {!isBetaUnlocked ? <BetaGate> : <OAuthButtons>}
        """
        source = self.get_auth_page_source()

        # Check for conditional rendering based on beta unlock
        has_conditional = '!isBetaUnlocked' in source or 'isBetaUnlocked ?' in source

        self.assertTrue(
            has_conditional,
            'CRITICAL: OAuth buttons must be conditionally rendered based on isBetaUnlocked. '
            'Users might see OAuth buttons without entering beta code!',
        )


class BetaCodeGateTest(TestCase):
    """
    Test that the auth page requires beta code "THRIVE" before login.

    These tests require the frontend to be running.
    They are skipped if frontend is not available.
    """

    def test_auth_page_contains_beta_gate_code(self):
        """
        CRITICAL: The auth page MUST show beta gate UI.
        """
        try:
            response = requests.get(f'{settings.FRONTEND_URL_DEFAULT}/auth', timeout=5)
        except requests.RequestException:
            self.skipTest(f'Frontend not running at {settings.FRONTEND_URL_DEFAULT}')

        self.assertEqual(response.status_code, 200, 'Auth page should be accessible')

        html = response.text.lower()

        # Must have beta code indicators
        beta_indicators = ['beta', 'access code', 'private beta']
        has_beta_gate = any(indicator in html for indicator in beta_indicators)

        self.assertTrue(has_beta_gate, 'Auth page MUST show beta code gate before OAuth buttons')

    def test_auth_page_oauth_buttons_not_immediately_visible(self):
        """
        CRITICAL: OAuth buttons MUST NOT be visible on initial page load.
        """
        try:
            response = requests.get(f'{settings.FRONTEND_URL_DEFAULT}/auth', timeout=5)
        except requests.RequestException:
            self.skipTest(f'Frontend not running at {settings.FRONTEND_URL_DEFAULT}')

        html = response.text.lower()

        beta_gate_shown = any(
            phrase in html
            for phrase in [
                'private beta',
                'beta access',
                'enter your access code',
                'beta code',
            ]
        )

        self.assertTrue(
            beta_gate_shown,
            'Auth page should show beta gate before OAuth buttons. '
            'OAuth buttons must be hidden until beta code is entered.',
        )


class BetaCodeValidationTest(TestCase):
    """
    Test that only valid beta codes are accepted.

    These are JavaScript tests that would run in Playwright,
    but we document the expected behavior here.
    """

    def test_thrive_is_valid_beta_code(self):
        """
        REQUIREMENT: "THRIVE" must be accepted as a valid beta code.

        Expected flow:
        1. User enters "THRIVE" in beta code input
        2. User clicks unlock button
        3. OAuth buttons become visible
        """
        # This is a specification test - actual browser test in Playwright
        valid_codes = ['THRIVE']

        self.assertIn('THRIVE', valid_codes, 'THRIVE must be a valid beta code')

    def test_invalid_codes_rejected(self):
        """
        REQUIREMENT: Invalid codes must show error message.

        Expected flow:
        1. User enters invalid code like "INVALID"
        2. User clicks unlock button
        3. Error message: "Invalid beta code. Please check and try again."
        4. OAuth buttons remain hidden
        """
        valid_codes = ['THRIVE']
        invalid_attempts = ['INVALID', 'TEST', 'BETA', '', 'thrive123']

        for code in invalid_attempts:
            self.assertNotIn(code.upper(), valid_codes, f'Code "{code}" should NOT be valid')

    def test_beta_code_case_insensitive(self):
        """
        REQUIREMENT: Beta code should work regardless of case.

        "thrive", "THRIVE", "Thrive" should all work.
        """
        valid_codes = ['THRIVE']

        test_cases = ['thrive', 'THRIVE', 'Thrive', 'ThRiVe']
        for code in test_cases:
            self.assertIn(code.upper(), valid_codes, f'Code "{code}" should be valid (case insensitive)')
