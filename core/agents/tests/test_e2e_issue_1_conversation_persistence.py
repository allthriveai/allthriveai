"""
Integration test for E2E Issue 1: Conversation Persistence Bug

This test validates the fix for the bug documented in:
/docs/e2e-issues-found/2025-12-26-journey-tests.md

Original Issue:
- E2E test `ai-chat-flow.spec.ts` found that after sending chat messages,
  `GET /api/v1/me/conversations/` returned 0 conversations
- WebSocket messages were only stored in Redis cache (15-min TTL)
- Messages were never persisted to the Conversation/Message models

Expected Behavior After Fix:
- After chat messages are processed, conversations should be persisted
- GET /api/v1/me/conversations/ should return the conversation with messages
- message_count should reflect the number of messages in the conversation

Test Strategy:
1. Simulate what happens during a WebSocket chat session
2. Call persist_conversation_message (what _process_with_ava now calls)
3. Verify the conversations API returns the persisted data
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.agents.models import Conversation
from core.agents.tasks import persist_conversation_message

User = get_user_model()


@pytest.mark.django_db
class TestE2EIssue1ConversationPersistence:
    """
    Integration tests that simulate the E2E flow from ai-chat-flow.spec.ts.

    These tests verify that after chat messages are processed:
    1. Conversations are persisted to the database
    2. The conversations API returns the correct data
    3. message_count is accurate
    """

    @pytest.fixture
    def user(self):
        """Create a test user."""
        return User.objects.create_user(
            username='e2e_test_user',
            email='e2e@example.com',
            password='testpass123',
        )

    @pytest.fixture
    def api_client(self, user):
        """Create authenticated API client."""
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_conversations_api_returns_zero_before_chat(self, api_client):
        """
        GIVEN: A user with no chat history
        WHEN: They call GET /api/v1/me/conversations/
        THEN: They should get 0 conversations (baseline check)
        """
        response = api_client.get('/api/v1/me/conversations/')

        assert response.status_code == 200
        data = response.json()

        # Should be empty initially
        results = data.get('results', data)
        assert len(results) == 0

    def test_conversations_api_returns_data_after_chat_persistence(self, api_client, user):
        """
        GIVEN: A user sends chat messages via WebSocket
        WHEN: The persist_conversation_message task runs (called on stream complete)
        THEN: GET /api/v1/me/conversations/ should return the conversation

        This test simulates the exact flow that was broken in Issue 1.
        """
        # Simulate what happens during a chat session:
        # 1. User sends message via WebSocket
        # 2. _process_with_ava streams response and accumulates it
        # 3. On 'complete' event, persist_conversation_message.delay() is called

        conversation_id = f'ava-chat-{user.id}'

        # Simulate first chat exchange
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='I want to learn about building AI chatbots',
            assistant_message='Great choice! Building AI chatbots is a fantastic way to learn...',
        )

        # Simulate second chat exchange (follow-up)
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='What tools would I need?',
            assistant_message='For building chatbots, you would typically need Python, LangChain...',
        )

        # Now call the API - this is what the E2E test does
        response = api_client.get('/api/v1/me/conversations/')

        assert response.status_code == 200
        data = response.json()
        results = data.get('results', data)

        # THE KEY ASSERTION: Should have at least 1 conversation
        # This is what failed in the original E2E test (returned 0)
        assert len(results) >= 1, f'Expected at least 1 conversation, got {len(results)}'

        # Verify the conversation details
        conversation = results[0]
        assert conversation['conversation_id'] == conversation_id
        assert conversation['conversation_type'] == 'ava_chat'
        assert conversation['title'] == 'Ava Chat'

        # Should have 4 messages (2 user + 2 assistant)
        assert conversation['message_count'] == 4

    def test_multi_turn_conversation_preserves_context(self, api_client, user):
        """
        GIVEN: A user has a multi-turn conversation
        WHEN: Each turn is persisted
        THEN: All messages should be in order and accessible

        This tests the "context preservation" aspect from the E2E test.
        """
        conversation_id = f'ava-chat-{user.id}'

        # Turn 1: Learning question
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='I want to learn about building AI chatbots',
            assistant_message='Great! Let me help you get started with AI chatbots...',
        )

        # Turn 2: Follow-up
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='What tools would I need?',
            assistant_message='You will need Python, an LLM API like OpenAI...',
        )

        # Turn 3: Discovery
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='Show me some chatbot projects people have built',
            assistant_message='Here are some popular chatbot projects on the platform...',
        )

        # Turn 4: Navigation
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='Take me to explore',
            assistant_message='Navigating you to the explore page...',
        )

        # Verify via API
        response = api_client.get('/api/v1/me/conversations/')
        data = response.json()
        results = data.get('results', data)

        assert len(results) == 1
        conversation = results[0]

        # 4 turns × 2 messages = 8 messages
        assert conversation['message_count'] == 8

        # Verify messages are in the response
        assert 'messages' in conversation
        messages = conversation['messages']
        assert len(messages) == 8

        # Check order: user, assistant, user, assistant, ...
        for i, msg in enumerate(messages):
            expected_role = 'user' if i % 2 == 0 else 'assistant'
            assert msg['role'] == expected_role, f'Message {i} should be {expected_role}'

    def test_conversation_persists_after_simulated_page_refresh(self, api_client, user):
        """
        GIVEN: User has a chat session and "refreshes" the page
        WHEN: They call the conversations API again
        THEN: The conversation should still be there

        This simulates the E2E test "STEP 5: Verify conversation persists after refresh"
        """
        conversation_id = f'ava-chat-{user.id}'

        # Initial chat
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='Hello Ava!',
            assistant_message='Hello! How can I help you today?',
        )

        # First API call (before "refresh")
        response1 = api_client.get('/api/v1/me/conversations/')
        data1 = response1.json()
        results1 = data1.get('results', data1)
        count_before = len(results1)

        # Simulate page refresh - just call API again
        # In a real scenario, the page would reload but the DB persists

        # Second API call (after "refresh")
        response2 = api_client.get('/api/v1/me/conversations/')
        data2 = response2.json()
        results2 = data2.get('results', data2)
        count_after = len(results2)

        # Count should be the same
        assert count_after == count_before
        assert count_after >= 1

    def test_conversation_persists_after_logout_login(self, user):
        """
        GIVEN: User has a chat session, logs out, and logs back in
        WHEN: They call the conversations API
        THEN: Their conversation should still be there

        This simulates the E2E test "conversation history loads after logout and login"
        """
        conversation_id = f'ava-chat-{user.id}'

        # Chat while "logged in"
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message=f'Test message {user.id}',
            assistant_message='Got it!',
        )

        # Create new API client (simulates logout)
        client1 = APIClient()
        client1.force_authenticate(user=user)
        response1 = client1.get('/api/v1/me/conversations/')
        data1 = response1.json()
        count_before = len(data1.get('results', data1))

        # "Logout" - create unauthenticated client
        client_anon = APIClient()
        response_anon = client_anon.get('/api/v1/me/conversations/')
        # Unauthenticated should fail or return empty
        assert response_anon.status_code in [401, 403]

        # "Login" again - new authenticated client
        client2 = APIClient()
        client2.force_authenticate(user=user)
        response2 = client2.get('/api/v1/me/conversations/')
        data2 = response2.json()
        count_after = len(data2.get('results', data2))

        # Should have same number of conversations
        assert count_after == count_before

    def test_different_conversation_types_all_persist(self, api_client, user):
        """
        GIVEN: User has different types of chat sessions
        WHEN: Each type is persisted
        THEN: All should appear in the conversations API
        """
        # Ava sidebar chat
        persist_conversation_message(
            user_id=user.id,
            conversation_id=f'ava-chat-{user.id}',
            user_message='Sidebar message',
            assistant_message='Sidebar response',
        )

        # Ava learn chat
        persist_conversation_message(
            user_id=user.id,
            conversation_id=f'ava-learn-{user.id}',
            user_message='Learn message',
            assistant_message='Learn response',
        )

        # Learning path chat
        persist_conversation_message(
            user_id=user.id,
            conversation_id=f'learn-python-basics-{user.id}',
            user_message='Python question',
            assistant_message='Python answer',
        )

        # Avatar generation
        persist_conversation_message(
            user_id=user.id,
            conversation_id='avatar-1703123456789',
            user_message='Create avatar',
            assistant_message='Avatar created!',
        )

        # Image generation
        persist_conversation_message(
            user_id=user.id,
            conversation_id='1703123456790',
            user_message='Create image',
            assistant_message='Image created!',
        )

        # Verify all are returned
        response = api_client.get('/api/v1/me/conversations/')
        data = response.json()
        results = data.get('results', data)

        # Should have 5 different conversations
        assert len(results) == 5

        # Verify types
        types = {c['conversation_type'] for c in results}
        assert types == {'ava_chat', 'ava_learn', 'learning_path', 'avatar', 'image'}

    def test_project_conversations_not_persisted(self, api_client, user):
        """
        GIVEN: User has project-specific chat (which should NOT be persisted)
        WHEN: persist_conversation_message is called for project chat
        THEN: It should be skipped and not appear in conversations API
        """
        # Try to persist a project conversation
        persist_conversation_message(
            user_id=user.id,
            conversation_id='project-123',
            user_message='Project question',
            assistant_message='Project answer',
        )

        # Also persist a regular chat
        persist_conversation_message(
            user_id=user.id,
            conversation_id=f'ava-chat-{user.id}',
            user_message='Regular question',
            assistant_message='Regular answer',
        )

        # Verify only the regular chat appears
        response = api_client.get('/api/v1/me/conversations/')
        data = response.json()
        results = data.get('results', data)

        # Should only have 1 conversation (the ava-chat, not project)
        assert len(results) == 1
        assert results[0]['conversation_type'] == 'ava_chat'


@pytest.mark.django_db
class TestE2EIssue1EdgeCases:
    """Edge case tests for conversation persistence."""

    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username='edge_case_user',
            email='edge@example.com',
            password='testpass123',
        )

    @pytest.fixture
    def api_client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_empty_assistant_response_still_persists(self, api_client, user):
        """
        Edge case: What if assistant response is empty?
        The task should still create records (user message is valuable).
        """
        persist_conversation_message(
            user_id=user.id,
            conversation_id=f'ava-chat-{user.id}',
            user_message='Hello',
            assistant_message='',  # Empty response
        )

        response = api_client.get('/api/v1/me/conversations/')
        data = response.json()
        results = data.get('results', data)

        # Should still have the conversation
        assert len(results) == 1
        assert results[0]['message_count'] == 2  # Both messages created

    def test_very_long_message_persists(self, api_client, user):
        """
        Edge case: Very long messages should persist without truncation.
        """
        long_message = 'A' * 10000  # 10k characters
        long_response = 'B' * 10000

        persist_conversation_message(
            user_id=user.id,
            conversation_id=f'ava-chat-{user.id}',
            user_message=long_message,
            assistant_message=long_response,
        )

        # Verify via direct DB query (API might paginate)
        conversation = Conversation.objects.get(user=user)
        messages = conversation.messages.all()

        assert messages[0].content == long_message
        assert messages[1].content == long_response

    def test_unicode_messages_persist(self, api_client, user):
        """
        Edge case: Unicode/emoji messages should persist correctly.
        """
        persist_conversation_message(
            user_id=user.id,
            conversation_id=f'ava-chat-{user.id}',
            user_message='Hello! 👋 How are you? 你好',
            assistant_message='I am great! 🎉 很高兴见到你',
        )

        conversation = Conversation.objects.get(user=user)
        messages = list(conversation.messages.all())

        assert '👋' in messages[0].content
        assert '你好' in messages[0].content
        assert '🎉' in messages[1].content
        assert '很高兴见到你' in messages[1].content
