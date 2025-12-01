"""
Tests for AI Provider Service
"""

from unittest.mock import Mock, patch

from django.conf import settings
from django.test import TestCase

from services.ai_provider import AIProvider


class AIProviderTestCase(TestCase):
    """Test cases for AIProvider class."""

    def test_provider_initialization_default(self):
        """Test default provider initialization."""
        with patch.object(settings, 'DEFAULT_AI_PROVIDER', 'azure'):
            with patch('services.ai_provider.AIProvider._initialize_client'):
                ai = AIProvider()
                self.assertEqual(ai.current_provider, 'azure')

    def test_provider_initialization_specified(self):
        """Test provider initialization with specified provider."""
        with patch('services.ai_provider.AIProvider._initialize_client'):
            ai = AIProvider(provider='openai')
            self.assertEqual(ai.current_provider, 'openai')

    def test_set_provider(self):
        """Test switching between providers."""
        with patch('services.ai_provider.AIProvider._initialize_client'):
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
        with patch('services.ai_provider.AIProvider._initialize_client'):
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
