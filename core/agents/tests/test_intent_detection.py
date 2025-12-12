"""
Tests for LLM-based intent detection service

Run with: pytest core/agents/tests/test_intent_detection.py -v
"""

from unittest.mock import Mock, patch

import pytest

from core.agents.intent_detection import IntentDetectionService, get_intent_service


@pytest.mark.django_db
class TestIntentDetectionService:
    """Test LLM-based intent detection"""

    def setup_method(self):
        """Setup test fixtures"""
        self.service = IntentDetectionService()

    @patch('core.agents.intent_detection.AIProvider')
    @patch('core.agents.intent_detection.cache')
    def test_detects_support_intent(self, mock_cache, mock_provider_class):
        """Test detection of support/help queries"""
        # Mock cache to return None (cache miss)
        mock_cache.get.return_value = None

        # Mock AIProvider to return 'support'
        mock_provider = Mock()
        mock_provider.complete.return_value = 'support'
        mock_provider.current_provider = 'openai'
        mock_provider.current_model = 'gpt-4'
        mock_provider.last_usage = {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}
        mock_provider_class.return_value = mock_provider

        service = IntentDetectionService()
        intent = service.detect_intent('How do I add a project?')

        assert intent == 'support'
        mock_provider.complete.assert_called_once()

    @patch('core.agents.intent_detection.AIProvider')
    @patch('core.agents.intent_detection.cache')
    def test_detects_project_creation_intent(self, mock_cache, mock_provider_class):
        """Test detection of project creation intent"""
        # Mock cache to return None (cache miss)
        mock_cache.get.return_value = None

        mock_provider = Mock()
        mock_provider.complete.return_value = 'project-creation'
        mock_provider.current_provider = 'openai'
        mock_provider.current_model = 'gpt-4'
        mock_provider.last_usage = {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}
        mock_provider_class.return_value = mock_provider

        service = IntentDetectionService()
        intent = service.detect_intent('Create a new project from GitHub')

        assert intent == 'project-creation'
        mock_provider.complete.assert_called_once()

    @patch('core.agents.intent_detection.AIProvider')
    @patch('core.agents.intent_detection.cache')
    def test_detects_discovery_intent(self, mock_cache, mock_provider_class):
        """Test detection of discovery/search intent"""
        # Mock cache to return None (cache miss)
        mock_cache.get.return_value = None

        mock_provider = Mock()
        mock_provider.complete.return_value = 'discovery'
        mock_provider.current_provider = 'openai'
        mock_provider.current_model = 'gpt-4'
        mock_provider.last_usage = {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}
        mock_provider_class.return_value = mock_provider

        service = IntentDetectionService()
        intent = service.detect_intent('Show me similar AI projects')

        assert intent == 'discovery'
        mock_provider.complete.assert_called_once()

    def test_integration_type_forces_project_creation(self):
        """Test that integration type automatically sets project-creation"""
        intent = self.service.detect_intent('Let me do this', integration_type='github')

        assert intent == 'project-creation'

    @patch('core.agents.intent_detection.AIProvider')
    @patch('core.agents.intent_detection.cache')
    def test_invalid_intent_fallback(self, mock_cache, mock_provider_class):
        """Test fallback to support for invalid LLM responses"""
        # Mock cache to return None (cache miss)
        mock_cache.get.return_value = None

        mock_provider = Mock()
        mock_provider.complete.return_value = 'invalid-intent'
        mock_provider.current_provider = 'openai'
        mock_provider.current_model = 'gpt-4'
        mock_provider.last_usage = None
        mock_provider_class.return_value = mock_provider

        service = IntentDetectionService()
        intent = service.detect_intent('Random message')

        assert intent == 'support'

    @patch('core.agents.intent_detection.AIProvider')
    @patch('core.agents.intent_detection.cache')
    def test_llm_error_fallback(self, mock_cache, mock_provider_class):
        """Test fallback to support when LLM call fails"""
        # Mock cache to return None (cache miss)
        mock_cache.get.return_value = None

        mock_provider = Mock()
        mock_provider.complete.side_effect = Exception('API Error')
        mock_provider.current_provider = 'openai'
        mock_provider.current_model = 'gpt-4'
        mock_provider.last_usage = None
        mock_provider_class.return_value = mock_provider

        service = IntentDetectionService()
        intent = service.detect_intent('Test message')

        assert intent == 'support'

    def test_format_history(self):
        """Test conversation history formatting"""
        history = [
            {'sender': 'user', 'content': 'Hello'},
            {'sender': 'agent', 'content': 'Hi there!'},
            {'sender': 'user', 'content': 'I need help'},
        ]

        formatted = self.service._format_history(history)

        assert 'user: Hello' in formatted
        assert 'agent: Hi there!' in formatted
        assert 'user: I need help' in formatted

    def test_format_history_empty(self):
        """Test empty history formatting"""
        formatted = self.service._format_history([])
        assert formatted == 'No previous messages'

    def test_format_history_limits_to_3(self):
        """Test history is limited to last 3 messages"""
        history = [
            {'sender': 'user', 'content': 'Message 1'},
            {'sender': 'agent', 'content': 'Response 1'},
            {'sender': 'user', 'content': 'Message 2'},
            {'sender': 'agent', 'content': 'Response 2'},
            {'sender': 'user', 'content': 'Message 3'},
        ]

        formatted = self.service._format_history(history)

        # Should only contain last 3 messages
        assert 'Message 1' not in formatted
        assert 'Response 1' not in formatted
        assert 'Message 2' in formatted
        assert 'Response 2' in formatted
        assert 'Message 3' in formatted

    def test_get_mode_transition_message_support(self):
        """Test transition message for support mode"""
        msg = self.service.get_mode_transition_message('support')
        assert 'help' in msg.lower()

    def test_get_mode_transition_message_discovery(self):
        """Test transition message for discovery mode"""
        msg = self.service.get_mode_transition_message('discovery')
        assert 'explore' in msg.lower()

    def test_get_mode_transition_message_project_creation(self):
        """Test transition message for project creation mode"""
        msg = self.service.get_mode_transition_message('project-creation')
        assert 'project' in msg.lower()

    def test_get_mode_transition_message_github_integration(self):
        """Test transition message for GitHub integration"""
        msg = self.service.get_mode_transition_message('project-creation', integration_type='github')
        assert 'github' in msg.lower()
        assert 'repository' in msg.lower()

    def test_get_mode_transition_message_youtube_integration(self):
        """Test transition message for YouTube integration"""
        msg = self.service.get_mode_transition_message('project-creation', integration_type='youtube')
        assert 'youtube' in msg.lower()
        assert 'video' in msg.lower()

    def test_singleton_instance(self):
        """Test get_intent_service returns singleton"""
        service1 = get_intent_service()
        service2 = get_intent_service()

        assert service1 is service2


@pytest.mark.django_db
class TestIntentDetectionIntegration:
    """Integration tests with real LLM (requires API keys)"""

    @pytest.mark.skip(reason='Real LLM tests require API keys and cost money')
    def test_real_llm_support_query(self):
        """Test real LLM with support query"""
        service = get_intent_service()
        intent = service.detect_intent('How do I add a new project?')
        assert intent == 'support'

    @pytest.mark.skip(reason='Real LLM tests require API keys and cost money')
    def test_real_llm_project_creation(self):
        """Test real LLM with project creation query"""
        service = get_intent_service()
        intent = service.detect_intent('Create a new project from my GitHub repository')
        assert intent == 'project-creation'

    @pytest.mark.skip(reason='Real LLM tests require API keys and cost money')
    def test_real_llm_discovery(self):
        """Test real LLM with discovery query"""
        service = get_intent_service()
        intent = service.detect_intent('Show me similar AI projects')
        assert intent == 'discovery'
