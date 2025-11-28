"""Tests for referral code validation and sanitization."""

from django.test import TestCase

from core.referrals.models import ReferralCode
from core.referrals.utils import ReferralCodeValidator, check_code_availability, generate_default_referral_code
from core.users.models import User


class ReferralCodeValidatorTestCase(TestCase):
    """Test referral code validation logic."""

    def test_valid_codes(self):
        """Test that valid codes pass validation."""
        valid_codes = [
            'JOHN',
            'JOHN2024',
            'MY-CODE',
            'MY_CODE',
            'ABC',  # Minimum length
            'A' * 20,  # Maximum length
            'Test123',
            'user-name_123',
        ]

        for code in valid_codes:
            with self.subTest(code=code):
                is_valid, error = ReferralCodeValidator.validate(code)
                self.assertTrue(is_valid, f'Expected {code} to be valid, but got: {error}')
                self.assertEqual(error, '')

    def test_length_validation(self):
        """Test length requirements."""
        # Too short
        is_valid, error = ReferralCodeValidator.validate('AB')
        self.assertFalse(is_valid)
        self.assertIn('at least 3 characters', error)

        # Too long
        is_valid, error = ReferralCodeValidator.validate('A' * 21)
        self.assertFalse(is_valid)
        self.assertIn('at most 20 characters', error)

    def test_pattern_validation(self):
        """Test that only alphanumeric, hyphens, and underscores are allowed."""
        invalid_codes = [
            'john doe',  # Space
            'john.doe',  # Dot
            'john@doe',  # @
            'john#doe',  # #
            'john!doe',  # !
            'john+doe',  # +
            'émile',  # Accented character
        ]

        for code in invalid_codes:
            with self.subTest(code=code):
                is_valid, error = ReferralCodeValidator.validate(code)
                self.assertFalse(is_valid)
                self.assertIn('letters, numbers, hyphens, and underscores', error)

    def test_reserved_words(self):
        """Test that reserved words are blocked."""
        reserved_codes = [
            'ADMIN',
            'API',
            'AUTH',
            'BILLING',
            'LOGIN',
            'LOGOUT',
            'SUPPORT',
            'SYSTEM',
        ]

        for code in reserved_codes:
            with self.subTest(code=code):
                is_valid, error = ReferralCodeValidator.validate(code)
                self.assertFalse(is_valid)
                self.assertIn('reserved word', error)

    def test_profanity_filter(self):
        """Test that profanity is blocked."""
        # Note: Using milder profanity for testing
        profane_codes = [
            'DAMN',
            'HELL',
            'CRAP',
        ]

        for code in profane_codes:
            with self.subTest(code=code):
                is_valid, error = ReferralCodeValidator.validate(code)
                self.assertFalse(is_valid)
                self.assertIn('inappropriate language', error)

    def test_empty_code(self):
        """Test that empty codes are rejected."""
        is_valid, error = ReferralCodeValidator.validate('')
        self.assertFalse(is_valid)
        self.assertIn('cannot be empty', error)

    def test_sanitize(self):
        """Test code sanitization."""
        test_cases = [
            ('john doe', 'JOHNDOE'),  # Removes spaces
            ('john.doe', 'JOHNDOE'),  # Removes dots
            ('john@doe', 'JOHNDOE'),  # Removes @
            ('john_doe', 'JOHN_DOE'),  # Keeps underscores
            ('john-doe', 'JOHN-DOE'),  # Keeps hyphens
            ('JohnDoe123', 'JOHNDOE123'),  # Keeps alphanumeric
            ('a' * 25, 'A' * 20),  # Truncates to max length
            ('  john  ', 'JOHN'),  # Strips whitespace
        ]

        for input_code, expected in test_cases:
            with self.subTest(input=input_code):
                result = ReferralCodeValidator.sanitize(input_code)
                self.assertEqual(result, expected)


class GenerateDefaultReferralCodeTestCase(TestCase):
    """Test default referral code generation."""

    def test_generate_from_valid_username(self):
        """Test generating code from a valid username."""
        code = generate_default_referral_code('johndoe')
        self.assertEqual(code, 'JOHNDOE')

    def test_generate_from_username_with_special_chars(self):
        """Test generating code from username with special characters."""
        code = generate_default_referral_code('john.doe')
        # Should remove dots and uppercase
        self.assertEqual(code, 'JOHNDOE')

    def test_generate_from_short_username(self):
        """Test generating code from username that's too short."""
        code = generate_default_referral_code('ab')
        # Should add random suffix
        self.assertGreater(len(code), 3)
        self.assertTrue(code.startswith('AB'))

    def test_generate_from_profane_username(self):
        """Test generating code from profane username."""
        code = generate_default_referral_code('damn')
        # Should fallback to random code with prefix
        self.assertIsNotNone(code)
        self.assertGreaterEqual(len(code), 8)

    def test_generate_from_empty_username(self):
        """Test generating code from empty username."""
        code = generate_default_referral_code('')
        # Should generate fully random code
        self.assertEqual(len(code), 8)
        # Check it only contains allowed characters
        self.assertTrue(all(c in '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' for c in code))


class CheckCodeAvailabilityTestCase(TestCase):
    """Test code availability checking."""

    def setUp(self):
        """Set up test users and codes."""
        self.user1 = User.objects.create_user(username='user1', email='user1@example.com', password='testpass123')
        self.user2 = User.objects.create_user(username='user2', email='user2@example.com', password='testpass123')

        # Create referral code for user1
        self.code1 = ReferralCode.objects.create(user=self.user1, code='TAKEN')

    def test_code_not_available_when_taken(self):
        """Test that taken codes return as unavailable."""
        is_available = check_code_availability('TAKEN')
        self.assertFalse(is_available)

    def test_code_available_when_not_taken(self):
        """Test that untaken codes return as available."""
        is_available = check_code_availability('AVAILABLE')
        self.assertTrue(is_available)

    def test_case_insensitive_check(self):
        """Test that availability check is case-insensitive."""
        # Code is stored as "TAKEN"
        self.assertFalse(check_code_availability('taken'))
        self.assertFalse(check_code_availability('Taken'))
        self.assertFalse(check_code_availability('TAKEN'))

    def test_exclude_user_from_check(self):
        """Test that a user's own code is available to them."""
        # User1 has code "TAKEN"
        # When checking availability for user1, should return True (they can keep it)
        is_available = check_code_availability('TAKEN', exclude_user_id=self.user1.id)
        self.assertTrue(is_available)

        # But for another user, it should be unavailable
        is_available = check_code_availability('TAKEN', exclude_user_id=self.user2.id)
        self.assertFalse(is_available)

    def test_code_available_after_deletion(self):
        """Test that codes become available after deletion."""
        # Initially unavailable
        self.assertFalse(check_code_availability('TAKEN'))

        # Delete the code
        self.code1.delete()

        # Now available
        self.assertTrue(check_code_availability('TAKEN'))
