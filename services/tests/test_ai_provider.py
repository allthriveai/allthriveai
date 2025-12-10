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
        with patch.object(settings, 'DEFAULT_AI_PROVIDER', 'azure'):
            with patch('services.ai.provider.AIProvider._initialize_client'):
                ai = AIProvider()
                self.assertEqual(ai.current_provider, 'azure')

    def test_provider_initialization_specified(self):
        """Test provider initialization with specified provider."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='openai')
            self.assertEqual(ai.current_provider, 'openai')

    def test_set_provider(self):
        """Test switching between providers."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='azure')
            self.assertEqual(ai.current_provider, 'azure')

            ai.set_provider('openai')
            self.assertEqual(ai.current_provider, 'openai')

            ai.set_provider('anthropic')
            self.assertEqual(ai.current_provider, 'anthropic')

            ai.set_provider('gemini')
            self.assertEqual(ai.current_provider, 'gemini')

    def test_invalid_provider(self):
        """Test that invalid provider raises ValueError."""
        with patch('services.ai.provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='azure')

            with self.assertRaises(ValueError) as context:
                ai.set_provider('invalid_provider')

            self.assertIn('Invalid provider', str(context.exception))

    def test_azure_initialization_missing_credentials(self):
        """Test Azure initialization fails without credentials."""
        with patch.object(settings, 'AZURE_OPENAI_API_KEY', None):
            with patch.object(settings, 'AZURE_OPENAI_ENDPOINT', None):
                with self.assertRaises(ValueError) as context:
                    AIProvider(provider='azure')

                self.assertIn('Azure OpenAI credentials not configured', str(context.exception))

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

    @patch('openai.AzureOpenAI')
    def test_azure_complete(self, mock_azure_client):
        """Test Azure OpenAI completion."""
        # Mock response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Test response'

        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = mock_response
        mock_azure_client.return_value = mock_client_instance

        with patch.object(settings, 'AZURE_OPENAI_API_KEY', 'test-key'):
            with patch.object(settings, 'AZURE_OPENAI_ENDPOINT', 'https://test.openai.azure.com/'):
                ai = AIProvider(provider='azure')
                response = ai.complete('Test prompt')

                self.assertEqual(response, 'Test response')
                mock_client_instance.chat.completions.create.assert_called_once()

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

    @patch('openai.AzureOpenAI')
    def test_complete_with_system_message(self, mock_azure_client):
        """Test completion with system message."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Test response'

        mock_client_instance = Mock()
        mock_client_instance.chat.completions.create.return_value = mock_response
        mock_azure_client.return_value = mock_client_instance

        with patch.object(settings, 'AZURE_OPENAI_API_KEY', 'test-key'):
            with patch.object(settings, 'AZURE_OPENAI_ENDPOINT', 'https://test.openai.azure.com/'):
                ai = AIProvider(provider='azure')
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
        """Test that image purpose for gemini returns image model."""
        from services.ai.provider import get_model_for_purpose

        model = get_model_for_purpose('gemini', 'image')
        self.assertIn('image', model.lower())

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
