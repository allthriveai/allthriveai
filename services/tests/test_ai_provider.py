"""
Tests for AI Provider Service
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

    def test_set_provider(self):
        """Test switching between providers."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='openai')
            self.assertEqual(ai.current_provider, 'openai')

            ai.set_provider('anthropic')
            self.assertEqual(ai.current_provider, 'anthropic')

            ai.set_provider('gemini')
            self.assertEqual(ai.current_provider, 'gemini')

    def test_invalid_provider(self):
        """Test that invalid provider raises ValueError."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='openai')

            with self.assertRaises(ValueError) as context:
                ai.set_provider('invalid_provider')

            self.assertIn('Invalid provider', str(context.exception))

    def test_openai_initialization_missing_credentials(self):
        """Test OpenAI initialization fails without credentials."""
        with patch.object(settings, 'OPENAI_API_KEY', None):
            with self.assertRaises(ValueError) as context:
                AIProvider(provider='openai')

            self.assertIn('OpenAI API key not configured', str(context.exception))

    def test_anthropic_initialization_missing_credentials(self):
        """Test Anthropic initialization fails without credentials."""
        with patch.object(settings, 'ANTHROPIC_API_KEY', None):
            with self.assertRaises(ValueError) as context:
                AIProvider(provider='anthropic')

            self.assertIn('Anthropic API key not configured', str(context.exception))

    def test_gemini_initialization_missing_credentials(self):
        """Test Gemini initialization fails without credentials."""
        with patch.object(settings, 'GOOGLE_API_KEY', None):
            with self.assertRaises(ValueError) as context:
                AIProvider(provider='gemini')

            self.assertIn('Google API key not configured', str(context.exception))

    @patch('openai.OpenAI')
    def test_openai_complete(self, mock_openai_client):
        """Test OpenAI completion."""
        # Mock response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Test response'

        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = mock_response
        mock_openai_client.return_value = mock_client_instance

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            response = ai.complete('Test prompt')

            self.assertEqual(response, 'Test response')
            mock_client_instance.chat.completions.create.assert_called_once()

    @patch('anthropic.Anthropic')
    def test_anthropic_complete(self, mock_anthropic_client):
        """Test Anthropic completion."""
        # Mock response
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
        """Test Gemini completion."""
        # Mock response
        mock_response = Mock()
        mock_response.text = 'Test response'
        # Mock usage metadata
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
            mock_model_instance.generate_content.assert_called_once()

            # Check usage tracking
            self.assertEqual(ai.last_usage['total_tokens'], 30)

    @patch('openai.OpenAI')
    def test_complete_with_system_message(self, mock_openai_client):
        """Test completion with system message."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Test response'

        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = mock_response
        mock_openai_client.return_value = mock_client_instance

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', system_message='You are a helpful AI.')

            # Verify system message was included
            call_args = mock_client_instance.chat.completions.create.call_args
            messages = call_args.kwargs['messages']
            self.assertEqual(len(messages), 2)
            self.assertEqual(messages[0]['role'], 'system')
            self.assertEqual(messages[0]['content'], 'You are a helpful AI.')


class PurposeBasedModelSelectionTestCase(TestCase):
    """Test cases for purpose-based model selection (gpt-4o-mini default, gpt-5 for reasoning)."""

    def test_get_model_for_purpose_default(self):
        """Test that default purpose returns gpt-4o-mini."""
        from services.ai.provider import get_model_for_purpose

        model = get_model_for_purpose('openai', 'default')
        self.assertEqual(model, 'gpt-4o-mini')

    def test_get_model_for_purpose_reasoning(self):
        """Test that reasoning purpose returns gpt-5-mini."""
        from services.ai.provider import get_model_for_purpose

        model = get_model_for_purpose('openai', 'reasoning')
        self.assertIn('gpt-5', model)

    def test_get_model_for_purpose_gemini_image(self):
        """Test that image purpose for gemini returns the configured image model."""
        from services.ai.provider import get_model_for_purpose

        model = get_model_for_purpose('gemini', 'image')
        # The model should be from settings.AI_MODELS['gemini']['image']
        # Default is gemini-3-pro-image-preview, can be overridden via env var
        self.assertIn('gemini', model.lower())
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

    def test_is_reasoning_model_gpt5(self):
        """Test that gpt-5 models are detected as reasoning."""
        from services.ai.provider import is_reasoning_model

        self.assertTrue(is_reasoning_model('gpt-5-mini-2025-08-07'))
        self.assertTrue(is_reasoning_model('gpt-5-pro'))
        self.assertTrue(is_reasoning_model('gpt-5'))

    def test_is_reasoning_model_o1_o3(self):
        """Test that o1 and o3 models are detected as reasoning."""
        from services.ai.provider import is_reasoning_model

        self.assertTrue(is_reasoning_model('o1-preview'))
        self.assertTrue(is_reasoning_model('o1-mini'))
        self.assertTrue(is_reasoning_model('o3-mini'))

    def test_is_reasoning_model_standard_models(self):
        """Test that standard models are NOT detected as reasoning."""
        from services.ai.provider import is_reasoning_model

        self.assertFalse(is_reasoning_model('gpt-4o-mini'))
        self.assertFalse(is_reasoning_model('gpt-4o'))
        self.assertFalse(is_reasoning_model('gpt-4-turbo'))
        self.assertFalse(is_reasoning_model('claude-3-5-sonnet'))
        self.assertFalse(is_reasoning_model('gemini-2.0-flash'))


class OpenAIReasoningModelHandlingTestCase(TestCase):
    """Test that reasoning models correctly handle temperature and max_tokens parameters."""

    @patch('openai.OpenAI')
    def test_reasoning_model_no_temperature(self, mock_openai_client):
        """Test that reasoning models don't receive temperature parameter."""
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

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='reasoning', temperature=0.7)

            call_args = mock_client_instance.chat.completions.create.call_args
            # Temperature should NOT be in kwargs for reasoning models
            self.assertNotIn('temperature', call_args.kwargs)

    @patch('openai.OpenAI')
    def test_default_model_has_temperature(self, mock_openai_client):
        """Test that default models receive temperature parameter."""
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

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='default', temperature=0.7)

            call_args = mock_client_instance.chat.completions.create.call_args
            # Temperature SHOULD be in kwargs for default models
            self.assertIn('temperature', call_args.kwargs)
            self.assertEqual(call_args.kwargs['temperature'], 0.7)

    @patch('openai.OpenAI')
    def test_reasoning_model_uses_max_completion_tokens(self, mock_openai_client):
        """Test that reasoning models use max_completion_tokens instead of max_tokens."""
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

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='reasoning', max_tokens=500)

            call_args = mock_client_instance.chat.completions.create.call_args
            # Should use max_completion_tokens for reasoning models
            self.assertIn('max_completion_tokens', call_args.kwargs)
            self.assertNotIn('max_tokens', call_args.kwargs)
            self.assertEqual(call_args.kwargs['max_completion_tokens'], 500)

    @patch('openai.OpenAI')
    def test_default_model_uses_max_tokens(self, mock_openai_client):
        """Test that default models use max_tokens parameter."""
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

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')
            ai.complete('Test prompt', purpose='default', max_tokens=500)

            call_args = mock_client_instance.chat.completions.create.call_args
            # Should use max_tokens for default models
            self.assertIn('max_tokens', call_args.kwargs)
            self.assertNotIn('max_completion_tokens', call_args.kwargs)
            self.assertEqual(call_args.kwargs['max_tokens'], 500)

    @patch('openai.OpenAI')
    def test_purpose_selects_correct_model(self, mock_openai_client):
        """Test that purpose parameter selects the correct model."""
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

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            ai = AIProvider(provider='openai')

            # Explicit model should override purpose
            ai.complete('Test prompt', model='gpt-4-turbo', purpose='reasoning')
            call_args = mock_client_instance.chat.completions.create.call_args
            self.assertEqual(call_args.kwargs['model'], 'gpt-4-turbo')


class TokenLimitTestCase(TestCase):
    """Test cases for token limit safeguards."""

    def test_estimate_token_count_empty(self):
        """Test token estimation for empty string."""
        from services.ai.provider import estimate_token_count

        self.assertEqual(estimate_token_count(''), 0)
        self.assertEqual(estimate_token_count(None), 0)

    def test_estimate_token_count_short_text(self):
        """Test token estimation for short text."""
        from services.ai.provider import estimate_token_count

        # "Hello" = 5 chars, should be ~2 tokens (5 // 3 = 1, max(1, 1) = 1)
        self.assertGreaterEqual(estimate_token_count('Hello'), 1)
        # Minimum is 1 token for non-empty text
        self.assertEqual(estimate_token_count('Hi'), 1)

    def test_estimate_token_count_longer_text(self):
        """Test token estimation for longer text."""
        from services.ai.provider import estimate_token_count

        # 300 chars should be ~100 tokens (300 // 3 = 100)
        text = 'a' * 300
        self.assertEqual(estimate_token_count(text), 100)

    def test_get_token_limits_defaults(self):
        """Test get_token_limits returns defaults when settings not configured."""
        from services.ai.provider import (
            get_token_limits,
        )

        soft, hard, output = get_token_limits()
        # Should return configured values or defaults
        self.assertGreater(soft, 0)
        self.assertGreater(hard, 0)
        self.assertGreater(output, 0)
        self.assertGreaterEqual(hard, soft)  # Hard limit should be >= soft limit

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
                # Short prompt should pass
                allowed, tokens = check_token_limits('Hello world')
                self.assertTrue(allowed)
                self.assertGreater(tokens, 0)

    def test_check_token_limits_with_system_message(self):
        """Test check_token_limits includes system message in count."""
        from services.ai.provider import check_token_limits

        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 8000):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 32000):
                # Both prompt and system message should be counted
                _, tokens_without_system = check_token_limits('Hello')
                _, tokens_with_system = check_token_limits('Hello', system_message='You are helpful.')

                self.assertGreater(tokens_with_system, tokens_without_system)

    def test_check_token_limits_soft_limit_warns(self):
        """Test check_token_limits warns but allows requests above soft limit."""
        from services.ai.provider import check_token_limits

        # Set soft limit very low, hard limit high
        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 10):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 100000):
                # 100 char text = ~33 tokens, above soft limit but below hard limit
                text = 'a' * 100
                with self.assertLogs('services.ai.provider', level='WARNING') as logs:
                    allowed, tokens = check_token_limits(text)

                self.assertTrue(allowed)  # Should still be allowed
                self.assertTrue(any('approaching token limit' in log for log in logs.output))

    def test_check_token_limits_hard_limit_raises(self):
        """Test check_token_limits raises error for requests above hard limit."""
        from services.ai.provider import TokenLimitExceededError, check_token_limits

        # Set hard limit very low
        with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 5):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 10):
                # 100 char text = ~33 tokens, above hard limit
                text = 'a' * 100
                with self.assertRaises(TokenLimitExceededError) as context:
                    check_token_limits(text)

                self.assertGreater(context.exception.estimated_tokens, 10)
                self.assertEqual(context.exception.limit, 10)
                self.assertIn('too large', context.exception.message)

    def test_token_limit_exceeded_error_attributes(self):
        """Test TokenLimitExceededError has correct attributes."""
        from services.ai.provider import TokenLimitExceededError

        error = TokenLimitExceededError(estimated_tokens=50000, limit=32000)
        self.assertEqual(error.estimated_tokens, 50000)
        self.assertEqual(error.limit, 32000)
        # Default message includes the numbers
        self.assertIn('50000', error.message)
        self.assertIn('32000', error.message)

    def test_token_limit_exceeded_error_custom_message(self):
        """Test TokenLimitExceededError accepts custom message."""
        from services.ai.provider import TokenLimitExceededError

        error = TokenLimitExceededError(estimated_tokens=50000, limit=32000, message='Custom error message')
        self.assertEqual(error.message, 'Custom error message')

    @patch('openai.OpenAI')
    def test_complete_checks_token_limits(self, mock_openai_client):
        """Test that complete() method checks token limits before API call."""
        from services.ai.provider import TokenLimitExceededError

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

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 10):
                ai = AIProvider(provider='openai')

                # Large prompt should be rejected before API call
                large_prompt = 'a' * 100  # ~33 tokens
                with self.assertRaises(TokenLimitExceededError):
                    ai.complete(large_prompt)

                # API should NOT have been called
                mock_client_instance.chat.completions.create.assert_not_called()

    @patch('openai.OpenAI')
    def test_complete_allows_within_limits(self, mock_openai_client):
        """Test that complete() allows requests within token limits."""
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

        with patch.object(settings, 'OPENAI_API_KEY', 'test-key'):
            with patch.object(settings, 'AI_TOKEN_SOFT_LIMIT', 8000):
                with patch.object(settings, 'AI_TOKEN_HARD_LIMIT', 32000):
                    ai = AIProvider(provider='openai')
                    response = ai.complete('Short prompt')

                    self.assertEqual(response, 'Test response')
                    # API should have been called
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

                # Large prompt should be rejected before API call
                large_prompt = 'a' * 100  # ~33 tokens
                with self.assertRaises(TokenLimitExceededError):
                    # Need to iterate the generator to trigger the check
                    list(ai.stream_complete(large_prompt))

                # API should NOT have been called
                mock_client_instance.chat.completions.create.assert_not_called()
