# Referral System Tests

This directory contains comprehensive automated tests for the referral code system.

## Test Files

### `test_validation.py`
Tests for referral code validation and sanitization logic:
- **ReferralCodeValidatorTestCase**: Format validation (length, pattern, reserved words, profanity)
- **GenerateDefaultReferralCodeTestCase**: Default code generation from usernames
- **CheckCodeAvailabilityTestCase**: Code availability checking with case-insensitive lookups

### `test_models.py`
Tests for model methods and business logic:
- **ReferralCodeModelTestCase**: ReferralCode model (creation, validity checks, atomic increments)
- **ReferralModelTestCase**: Referral model (status transitions, state management)
- **ReferralCodeUserRelationshipTestCase**: User-to-code relationships and cascading deletes

### `test_views.py`
Tests for API endpoints:
- **ReferralCodeViewSetTestCase**: User referral code endpoints (CRUD, stats, rate limiting)
- **ValidateReferralCodeViewTestCase**: Public validation endpoint (no auth required)
- **ReferralViewSetTestCase**: Referral list endpoint (read-only, user isolation)
- **ReferralCodeCollisionHandlingTestCase**: Code uniqueness collision handling

### `test_integration.py`
End-to-end integration tests:
- **CompleteReferralFlowTestCase**: Full user journey (signup → customize → share → validate → track)
- **MultipleReferralsTestCase**: Multiple referrals and max_uses limits
- **CodeUpdateScenarios**: Code update flows (before/after usage, multiple updates)
- **ReferralStatusTransitionsTestCase**: Status state machine (PENDING → COMPLETED → REWARDED)
- **EdgeCasesTestCase**: Error conditions and boundary cases

## Running Tests

### All referral tests:
```bash
python manage.py test core.referrals.tests
```

### Specific test file:
```bash
python manage.py test core.referrals.tests.test_validation
python manage.py test core.referrals.tests.test_models
python manage.py test core.referrals.tests.test_views
python manage.py test core.referrals.tests.test_integration
```

### Specific test class:
```bash
python manage.py test core.referrals.tests.test_validation.ReferralCodeValidatorTestCase
```

### Specific test method:
```bash
python manage.py test core.referrals.tests.test_validation.ReferralCodeValidatorTestCase.test_profanity_filter
```

### With verbosity:
```bash
python manage.py test core.referrals.tests --verbosity=2
```

### Using Docker:
```bash
docker-compose exec backend python manage.py test core.referrals.tests
```

## Test Coverage

The test suite covers:

### ✅ Validation Logic
- Length requirements (3-20 characters)
- Pattern matching (alphanumeric, hyphens, underscores)
- Reserved words blocking (ADMIN, API, AUTH, etc.)
- Profanity filtering (via better-profanity library)
- Case-insensitive code lookups
- Sanitization and normalization

### ✅ Security Features
- Rate limiting (5 updates/day, 20 validations/minute)
- Profanity blocking
- Reserved word prevention
- Code uniqueness enforcement
- User isolation (can only see own referrals)

### ✅ Business Logic
- Auto-creation of codes on first access
- Atomic usage increments (F() expressions)
- Transaction safety (select_for_update)
- Code collision handling with retry logic
- Status transitions (PENDING → COMPLETED → REWARDED)
- Max uses limits
- Expiry date checks
- Active/inactive flags

### ✅ API Endpoints
- `GET /api/v1/me/referral-code/` - Get user's code (with auto-creation)
- `POST /api/v1/me/referral-code/update_code/` - Update to custom code
- `POST /api/v1/me/referral-code/check_availability/` - Check code availability
- `GET /api/v1/me/referral-code/stats/` - Get referral statistics
- `GET /api/v1/me/referrals/` - List user's referrals
- `GET /api/v1/referrals/validate/{code}/` - Public validation endpoint

### ✅ Edge Cases
- Empty/whitespace codes
- Unicode characters
- Code collisions
- Self-referrals
- Inactive codes
- Expired codes
- Max uses reached
- Multiple code updates
- Username changes (codes remain intact)

## Key Test Scenarios

### Profanity Blocking
```python
def test_profanity_filter(self):
    """Test that profanity is blocked."""
    profane_codes = ["DAMN", "HELL", "CRAP"]
    for code in profane_codes:
        is_valid, error = ReferralCodeValidator.validate(code)
        self.assertFalse(is_valid)
        self.assertIn("inappropriate language", error)
```

### Rate Limiting
```python
def test_update_code_rate_limiting(self):
    """Test that update_code endpoint is rate limited."""
    # Make 5 requests (the daily limit)
    for i in range(5):
        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": f"CODE{i}"})
        self.assertEqual(response.status_code, 200)

    # 6th request should be rate limited
    response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "CODE6"})
    self.assertEqual(response.status_code, 429)
```

### Complete User Journey
```python
def test_complete_referral_workflow(self):
    """Test complete workflow: create user, get code, share, validate, track."""
    # 1. User signs up and gets code
    # 2. User customizes code to "ALICE2024"
    # 3. New user validates code (public endpoint)
    # 4. New user signs up
    # 5. System creates referral relationship
    # 6. Referrer checks stats
    # 7. Referrer views referrals
    # 8. System marks referral completed
    # 9. System rewards referrer
    # 10. Final stats verification
```

## Dependencies

Tests require:
- Django TestCase
- DRF APIClient
- better-profanity library

## Notes

- Tests use in-memory SQLite database (fast)
- Each test is isolated (setUp/tearDown)
- Tests verify both success and failure cases
- Rate limiting tests verify throttle classes work
- Integration tests simulate real user workflows
