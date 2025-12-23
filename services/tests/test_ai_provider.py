"""
Tests for AI Provider Service

Consolidated test suite with reduced redundancy while maintaining full coverage.
"""

from unittest.mock import Mock, patch

from django.conf import settings
from django.test import TestCase

from services.ai.provider import AIProvider


class AIProviderTestCase(TestCase):
    """Test cases for AIProvider class."""

    def test_provider_initialization_default(self):
        """Test default provider initialization."""
        with patch.object(settings, 'DEFAULT_AI_PROVIDER', 'openai'):
            with patch('services.ai.provider.AIProvider._initialize_client'):
                ai = AIProvider()
                self.assertEqual(ai.current_provider, 'openai')

    def test_provider_initialization_specified(self):
        """Test provider initialization with specified provider."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='openai')
            self.assertEqual(ai.current_provider, 'openai')

    def test_set_provider_switches_correctly(self):
        """Test switching between all supported providers."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='openai')
            self.assertEqual(ai.current_provider, 'openai')

            for provider in ['anthropic', 'gemini']:
                ai.set_provider(provider)
                self.assertEqual(ai.current_provider, provider)

    def test_invalid_provider(self):
        """Test that invalid provider raises ValueError."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='openai')
            with self.assertRaises(ValueError) as context:
                ai.set_provider('invalid_provider')
            self.assertIn('Invalid provider', str(context.exception))


class ProviderCredentialsTestCase(TestCase):
    """Test missing credentials handling for each provider."""

    def test_openai_missing_credentials(self):
        """Test OpenAI initialization fails without credentials."""
        with patch.object(settings, 'OPENAI_API_KEY', None):
            with self.assertRaises(ValueError) as context:
                AIProvider(provider='openai')
            self.assertIn('OpenAI API key not configured', str(context.exception))

    def test_anthropic_missing_credentials(self):
        """Test Anthropic initialization fails without credentials."""
        with patch.object(settings, 'ANTHROPIC_API_KEY', None):
            with self.assertRaises(ValueError) as context:
                AIProvider(provider='anthropic')
            self.assertIn('Anthropic API key not configured', str(context.exception))

    def test_gemini_missing_credentials(self):
        """Test Gemini initialization fails without credentials."""
        with patch.object(settings, 'GOOGLE_API_KEY', None):
            with self.assertRaises(ValueError) as context:
                AIProvider(provider='gemini')
            self.assertIn('Google API key not configured', str(context.exception))


class ProviderCompletionTestCase(TestCase):
    """Test completion for each provider."""

    def _create_openai_mock(self, response_text='Test response'):
        """Create standard OpenAI mock response."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = response_text
        mock_response.usage = Mock()
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30
        return mock_response

    @patch('openai.OpenAI')
    def test_openai_complete(self, mock_openai_client):
        """Test OpenAI completion."""
        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = self._create_openai_mock()
        mock_openai_client.return_value = mock_client_instance

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            response = ai.complete('Test prompt')

            self.assertEqual(response, 'Test response')
            mock_client_instance.chat.completions.create.assert_called_once()

    @patch('anthropic.Anthropic')
    def test_anthropic_complete(self, mock_anthropic_client):
        """Test Anthropic completion."""
        mock_response = Mock()
        mock_response.content = [Mock()]
        mock_response.content[0].text = 'Test response'
        mock_response.usage.input_tokens = 10
        mock_response.usage.output_tokens = 20

        mock_client_instance = Mock()
        mock_client_instance.messages.create.return_value = mock_response
        mock_anthropic_client.return_value = mock_client_instance

        with patch.object(settings, 'ANTHROPIC_API_KEY', 'test-key'):
            ai = AIProvider(provider='anthropic')
            response = ai.complete('Test prompt')

            self.assertEqual(response, 'Test response')
            mock_client_instance.messages.create.assert_called_once()

    @patch('google.generativeai.GenerativeModel')
    @patch('google.generativeai.configure')
    def test_gemini_complete(self, mock_configure, mock_generative_model):
        """Test Gemini completion with usage tracking."""
        mock_response = Mock()
        mock_response.text = 'Test response'
        mock_usage = Mock()
        mock_usage.prompt_token_count = 10
        mock_usage.candidates_token_count = 20
        mock_usage.total_token_count = 30
        mock_response.usage_metadata = mock_usage

        mock_model_instance = Mock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_generative_model.return_value = mock_model_instance

        with patch.object(settings, 'GOOGLE_API_KEY', 'test-key'):
            ai = AIProvider(provider='gemini')
            response = ai.complete('Test prompt')

            self.assertEqual(response, 'Test response')
            mock_configure.assert_called_with(api_key='test-key')
            self.assertEqual(ai.last_usage['total_tokens'], 30)

    @patch('openai.OpenAI')
    def test_complete_with_system_message(self, mock_openai_client):
        """Test completion with system message."""
        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = self._create_openai_mock()
        mock_openai_client.return_value = mock_client_instance

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', system_message='You are a helpful AI.')

            call_args = mock_client_instance.chat.completions.create.call_args
            messages = call_args.kwargs['messages']
            self.assertEqual(len(messages), 2)
            self.assertEqual(messages[0]['role'], 'system')
            self.assertEqual(messages[0]['content'], 'You are a helpful AI.')


class PurposeBasedModelSelectionTestCase(TestCase):
    """Test cases for purpose-based model selection."""

    def test_get_model_for_purpose_default(self):
        """Test that default purpose returns gpt-4o-mini."""
        from services.ai.provider import get_model_for_purpose

        self.assertEqual(get_model_for_purpose('openai', 'default'), 'gpt-4o-mini')

    def test_get_model_for_purpose_reasoning(self):
        """Test that reasoning purpose returns gpt-5-mini."""
        from services.ai.provider import get_model_for_purpose

        self.assertIn('gpt-5', get_model_for_purpose('openai', 'reasoning'))

    def test_get_model_for_purpose_gemini_image(self):
        """Test that image purpose for gemini returns configured image model."""
        from services.ai.provider import get_model_for_purpose

        model = get_model_for_purpose('gemini', 'image')
        self.assertTrue(model.startswith('gemini-'))

    def test_get_model_for_purpose_invalid_falls_back(self):
        """Test that invalid purpose falls back to default with warning."""
        from services.ai.provider import get_model_for_purpose

        with self.assertLogs('services.ai.provider', level='WARNING') as logs:
            model = get_model_for_purpose('openai', 'invalid_purpose')

        self.assertEqual(model, 'gpt-4o-mini')
        self.assertTrue(any('Invalid AI purpose' in log for log in logs.output))

    def test_get_model_for_purpose_unknown_provider_fallback(self):
        """Test fallback for unknown provider."""
        from services.ai.provider import get_model_for_purpose

        with self.assertLogs('services.ai.provider', level='WARNING') as logs:
            model = get_model_for_purpose('unknown_provider', 'default')

        self.assertEqual(model, 'gpt-4o-mini')
        self.assertTrue(any('No model configured' in log for log in logs.output))


class ReasoningModelDetectionTestCase(TestCase):
    """Test cases for is_reasoning_model() helper."""

    def test_reasoning_models_detected(self):
        """Test that reasoning models are correctly detected."""
        from services.ai.provider import is_reasoning_model

        reasoning_models = ['gpt-5-mini-2025-08-07', 'gpt-5-pro', 'gpt-5', 'o1-preview', 'o1-mini', 'o3-mini']
        for model in reasoning_models:
            self.assertTrue(is_reasoning_model(model), f'{model} should be detected as reasoning')

    def test_standard_models_not_detected(self):
        """Test that standard models are NOT detected as reasoning."""
        from services.ai.provider import is_reasoning_model

        standard_models = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'claude-3-5-sonnet', 'gemini-2.0-flash']
        for model in standard_models:
            self.assertFalse(is_reasoning_model(model), f'{model} should NOT be detected as reasoning')


class OpenAIReasoningModelHandlingTestCase(TestCase):
    """Test that reasoning models correctly handle temperature and max_tokens parameters."""

    def _setup_openai_mock(self, mock_openai_client):
        """Common setup for OpenAI mocks."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Test response'
        mock_response.usage = Mock()
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30

        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = mock_response
        mock_openai_client.return_value = mock_client_instance
        return mock_client_instance

    @patch('openai.OpenAI')
    def test_reasoning_model_no_temperature(self, mock_openai_client):
        """Test that reasoning models don't receive temperature parameter."""
        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='reasoning', temperature=0.7)

            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertNotIn('temperature', call_args.kwargs)

    @patch('openai.OpenAI')
    def test_default_model_has_temperature(self, mock_openai_client):
        """Test that default models receive temperature parameter."""
        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='default', temperature=0.7)

            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertIn('temperature', call_args.kwargs)
            self.assertEqual(call_args.kwargs['temperature'], 0.7)

    @patch('openai.OpenAI')
    def test_reasoning_model_uses_max_completion_tokens(self, mock_openai_client):
        """Test that reasoning models use max_completion_tokens instead of max_tokens."""
        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='reasoning', max_tokens=500)

            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertIn('max_completion_tokens', call_args.kwargs)
            self.assertNotIn('max_tokens', call_args.kwargs)
            self.assertEqual(call_args.kwargs['max_completion_tokens'], 500)

    @patch('openai.OpenAI')
    def test_default_model_uses_max_tokens(self, mock_openai_client):
        """Test that default models use max_tokens parameter."""
        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='default', max_tokens=500)

            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertIn('max_tokens', call_args.kwargs)
            self.assertNotIn('max_completion_tokens', call_args.kwargs)

    @patch('openai.OpenAI')
    def test_purpose_selects_correct_model(self, mock_openai_client):
        """Test that purpose parameter selects the correct model."""
        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')

            # Test default purpose
            ai.complete('Test prompt', purpose='default')
            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertEqual(call_args.kwargs['model'], 'gpt-4o-mini')

            # Test reasoning purpose
            ai.complete('Test prompt', purpose='reasoning')
            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertIn('gpt-5', call_args.kwargs['model'])

    @patch('openai.OpenAI')
    def test_explicit_model_overrides_purpose(self, mock_openai_client):
        """Test that explicit model parameter overrides purpose-based selection."""
        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', model='gpt-4-turbo', purpose='reasoning')

            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertEqual(call_args.kwargs['model'], 'gpt-4-turbo')


class TokenLimitTestCase(TestCase):
    """Test cases for token limit safeguards."""

    def test_estimate_token_count(self):
        """Test token estimation for various inputs."""
        from services.ai.provider import estimate_token_count

        # Empty/None
        self.assertEqual(estimate_token_count(''), 0)
        self.assertEqual(estimate_token_count(None), 0)

        # Short text - minimum 1 token
        self.assertEqual(estimate_token_count('Hi'), 1)
        self.assertGreaterEqual(estimate_token_count('Hello'), 1)

        # Longer text - ~1 token per 3 chars
        self.assertEqual(estimate_token_count('a' * 300), 100)

    def test_get_token_limits(self):
        """Test get_token_limits returns valid configuration."""
        from services.ai.provider import get_token_limits

        soft, hard, output = get_token_limits()
        self.assertGreater(soft, 0)
        self.assertGreater(hard, 0)
        self.assertGreater(output, 0)
        self.assertGreaterEqual(hard, soft)

    def test_get_token_limits_from_settings(self):
        """Test get_token_limits respects settings."""
        from services.ai.provider import get_token_limits

        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 5000):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 20000):
                with patch.object(settings, 'AI_OUTPUT_TOKEN_LIMIT', 2048):
                    soft, hard, output = get_token_limits()
                    self.assertEqual(soft, 5000)
                    self.assertEqual(hard, 20000)
                    self.assertEqual(output, 2048)

    def test_check_token_limits_within_limits(self):
        """Test check_token_limits passes for normal requests."""
        from services.ai.provider import check_token_limits

        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 8000):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 32000):
                allowed, tokens = check_token_limits('Hello world')
                self.assertTrue(allowed)
                self.assertGreater(tokens, 0)

    def test_check_token_limits_includes_system_message(self):
        """Test check_token_limits includes system message in count."""
        from services.ai.provider import check_token_limits

        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 8000):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 32000):
                _, tokens_without_system = check_token_limits('Hello')
                _, tokens_with_system = check_token_limits('Hello', system_message='You are helpful.')
                self.assertGreater(tokens_with_system, tokens_without_system)

    def test_check_token_limits_soft_limit_warns(self):
        """Test check_token_limits warns but allows requests above soft limit."""
        from services.ai.provider import check_token_limits

        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 10):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 100000):
                with self.assertLogs('services.ai.provider', level='WARNING') as logs:
                    allowed, _ = check_token_limits('a' * 100)

                self.assertTrue(allowed)
                self.assertTrue(any('approaching token limit' in log for log in logs.output))

    def test_check_token_limits_hard_limit_raises(self):
        """Test check_token_limits raises error for requests above hard limit."""
        from services.ai.provider import TokenLimitExceededError, check_token_limits

        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 5):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 10):
                with self.assertRaises(TokenLimitExceededError) as context:
                    check_token_limits('a' * 100)

                self.assertGreater(context.exception.estimated_tokens, 10)
                self.assertEqual(context.exception.limit, 10)
                self.assertIn('too large', context.exception.message)

    def test_token_limit_exceeded_error(self):
        """Test TokenLimitExceededError has correct attributes."""
        from services.ai.provider import TokenLimitExceededError

        error = TokenLimitExceededError(estimated_tokens=50000, limit=32000)
        self.assertEqual(error.estimated_tokens, 50000)
        self.assertEqual(error.limit, 32000)
        self.assertIn('50000', error.message)
        self.assertIn('32000', error.message)

        # Custom message
        custom_error = TokenLimitExceededError(estimated_tokens=50000, limit=32000, message='Custom error message')
        self.assertEqual(custom_error.message, 'Custom error message')


class TokenLimitIntegrationTestCase(TestCase):
    """Test token limits are enforced during API calls."""

    def _setup_openai_mock(self, mock_openai_client):
        """Common setup for OpenAI mocks."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Test response'
        mock_response.usage = Mock()
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30

        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = mock_response
        mock_openai_client.return_value = mock_client_instance
        return mock_client_instance

    @patch('openai.OpenAI')
    def test_complete_checks_token_limits(self, mock_openai_client):
        """Test that complete() method checks token limits before API call."""
        from services.ai.provider import TokenLimitExceededError

        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 10):
                ai = AIProvider(provider='openai')

                with self.assertRaises(TokenLimitExceededError):
                    ai.complete('a' * 100)

                mock_client_instance.chat.completions.create.assert_not_called()

    @patch('openai.OpenAI')
    def test_complete_allows_within_limits(self, mock_openai_client):
        """Test that complete() allows requests within token limits."""
        mock_client_instance = self._setup_openai_mock(mock_openai_client)

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 8000):
                with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 32000):
                    ai = AIProvider(provider='openai')
                    response = ai.complete('Short prompt')

                    self.assertEqual(response, 'Test response')
                    mock_client_instance.chat.completions.create.assert_called_once()

    @patch('openai.OpenAI')
    def test_stream_complete_checks_token_limits(self, mock_openai_client):
        """Test that stream_complete() method checks token limits before API call."""
        from services.ai.provider import TokenLimitExceededError

        mock_client_instance = Mock()
        mock_openai_client.return_value = mock_client_instance

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 10):
                ai = AIProvider(provider='openai')

                with self.assertRaises(TokenLimitExceededError):
                    list(ai.stream_complete('a' * 100))

                mock_client_instance.chat.completions.create.assert_not_called()
