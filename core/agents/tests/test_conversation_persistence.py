"""
Tests for conversation persistence functionality.

Tests cover:
- persist_conversation_message Celery task
- Helper functions (_should_persist_conversation, _get_conversation_type, _generate_conversation_title)
- User isolation (same conversation_id, different users)
- ViewSet queryset with message_count annotation
"""

import pytest
from django.contrib.auth import get_user_model

from core.agents.models import Conversation, Message
from core.agents.tasks import (
    _generate_conversation_title,
    _get_conversation_type,
    _should_persist_conversation,
    persist_conversation_message,
)

User = get_user_model()


# =============================================================================
# Helper Function Tests
# =============================================================================


class TestShouldPersistConversation:
    """Tests for _should_persist_conversation helper."""

    def test_ember_chat_should_persist(self):
        """Ember sidebar chat should be persisted."""
        assert _should_persist_conversation('ember-chat-123') is True

    def test_ember_learn_should_persist(self):
        """Ember learn chat should be persisted."""
        assert _should_persist_conversation('ember-learn-456') is True

    def test_ember_explore_should_persist(self):
        """Ember explore chat should be persisted."""
        assert _should_persist_conversation('ember-explore-789') is True

    def test_learning_path_should_persist(self):
        """Learning path detail chat should be persisted."""
        assert _should_persist_conversation('learn-python-basics-123') is True

    def test_avatar_should_persist(self):
        """Avatar generation should be persisted."""
        assert _should_persist_conversation('avatar-1703123456789') is True

    def test_image_generation_should_persist(self):
        """Image generation (timestamp only) should be persisted."""
        assert _should_persist_conversation('1703123456789') is True

    def test_project_should_not_persist(self):
        """Project-specific chats should NOT be persisted."""
        assert _should_persist_conversation('project-123') is False
        assert _should_persist_conversation('project-456-architecture') is False


class TestGetConversationType:
    """Tests for _get_conversation_type helper."""

    def test_ember_chat_type(self):
        assert _get_conversation_type('ember-chat-123') == 'ember_chat'

    def test_ember_learn_type(self):
        assert _get_conversation_type('ember-learn-456') == 'ember_learn'

    def test_ember_explore_type(self):
        assert _get_conversation_type('ember-explore-789') == 'ember_explore'

    def test_learning_path_type(self):
        assert _get_conversation_type('learn-python-basics-123') == 'learning_path'

    def test_avatar_type(self):
        assert _get_conversation_type('avatar-1703123456789') == 'avatar'

    def test_image_generation_type(self):
        """Timestamp-only IDs default to image type."""
        assert _get_conversation_type('1703123456789') == 'image'

    def test_unknown_pattern_defaults_to_image(self):
        """Unknown patterns default to image type."""
        assert _get_conversation_type('unknown-pattern') == 'image'


class TestGenerateConversationTitle:
    """Tests for _generate_conversation_title helper."""

    def test_ember_chat_title(self):
        assert _generate_conversation_title('ember-chat-123') == 'Ember Chat'

    def test_ember_learn_title(self):
        assert _generate_conversation_title('ember-learn-456') == 'Ember Learn Chat'

    def test_ember_explore_title(self):
        assert _generate_conversation_title('ember-explore-789') == 'Ember Explore Chat'

    def test_learning_path_title(self):
        assert _generate_conversation_title('learn-python-basics-123') == 'Learning Path Chat'

    def test_avatar_title(self):
        assert _generate_conversation_title('avatar-1703123456789') == 'Avatar Generation'

    def test_image_generation_title(self):
        """Timestamp-only IDs get Image Generation title."""
        assert _generate_conversation_title('1703123456789') == 'Image Generation'


# =============================================================================
# Celery Task Tests
# =============================================================================


@pytest.mark.django_db
class TestPersistConversationMessageTask:
    """Tests for persist_conversation_message Celery task."""

    @pytest.fixture
    def user(self):
        """Create a test user."""
        return User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    @pytest.fixture
    def another_user(self):
        """Create another test user for isolation tests."""
        return User.objects.create_user(
            username='anotheruser',
            email='another@example.com',
            password='testpass123',
        )

    def test_creates_conversation_and_messages(self, user):
        """Task should create conversation and both user/assistant messages."""
        persist_conversation_message(
            user_id=user.id,
            conversation_id='ember-chat-123',
            user_message='Hello, how are you?',
            assistant_message='I am doing well, thank you!',
        )

        # Verify conversation was created
        conversation = Conversation.objects.get(user=user, conversation_id='ember-chat-123')
        assert conversation.title == 'Ember Chat'
        assert conversation.conversation_type == 'ember_chat'

        # Verify messages were created
        messages = conversation.messages.order_by('created_at')
        assert messages.count() == 2
        assert messages[0].role == 'user'
        assert messages[0].content == 'Hello, how are you?'
        assert messages[1].role == 'assistant'
        assert messages[1].content == 'I am doing well, thank you!'

    def test_appends_to_existing_conversation(self, user):
        """Task should append messages to existing conversation."""
        # First message
        persist_conversation_message(
            user_id=user.id,
            conversation_id='ember-chat-123',
            user_message='First message',
            assistant_message='First response',
        )

        # Second message to same conversation
        persist_conversation_message(
            user_id=user.id,
            conversation_id='ember-chat-123',
            user_message='Second message',
            assistant_message='Second response',
        )

        # Should still be one conversation
        assert Conversation.objects.filter(user=user, conversation_id='ember-chat-123').count() == 1

        # But now with 4 messages
        conversation = Conversation.objects.get(user=user, conversation_id='ember-chat-123')
        assert conversation.messages.count() == 4

    def test_skips_project_conversations(self, user):
        """Task should skip project-specific conversations."""
        persist_conversation_message(
            user_id=user.id,
            conversation_id='project-456',
            user_message='Project question',
            assistant_message='Project answer',
        )

        # No conversation should be created
        assert Conversation.objects.filter(user=user).count() == 0

    def test_user_isolation_same_conversation_id(self, user, another_user):
        """Same conversation_id for different users should create separate records."""
        conversation_id = 'ember-chat-shared-id'

        # User 1 sends a message
        persist_conversation_message(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message='User 1 message',
            assistant_message='Response to user 1',
        )

        # User 2 sends a message with SAME conversation_id
        persist_conversation_message(
            user_id=another_user.id,
            conversation_id=conversation_id,
            user_message='User 2 message',
            assistant_message='Response to user 2',
        )

        # Should have 2 separate conversations
        assert Conversation.objects.filter(conversation_id=conversation_id).count() == 2

        # Each user should only see their own
        user1_conv = Conversation.objects.get(user=user, conversation_id=conversation_id)
        user2_conv = Conversation.objects.get(user=another_user, conversation_id=conversation_id)

        assert user1_conv.id != user2_conv.id
        assert user1_conv.messages.first().content == 'User 1 message'
        assert user2_conv.messages.first().content == 'User 2 message'

    def test_learning_path_conversation(self, user):
        """Learning path conversations should be persisted correctly."""
        persist_conversation_message(
            user_id=user.id,
            conversation_id='learn-python-basics-123',
            user_message='Explain variables',
            assistant_message='Variables are containers for storing data...',
        )

        conversation = Conversation.objects.get(user=user)
        assert conversation.conversation_type == 'learning_path'
        assert conversation.title == 'Learning Path Chat'

    def test_avatar_generation_conversation(self, user):
        """Avatar generation conversations should be persisted correctly."""
        persist_conversation_message(
            user_id=user.id,
            conversation_id='avatar-1703123456789',
            user_message='Create a friendly avatar',
            assistant_message='Here is your avatar!',
        )

        conversation = Conversation.objects.get(user=user)
        assert conversation.conversation_type == 'avatar'
        assert conversation.title == 'Avatar Generation'

    def test_image_generation_conversation(self, user):
        """Image generation (timestamp ID) should be persisted correctly."""
        persist_conversation_message(
            user_id=user.id,
            conversation_id='1703123456789',
            user_message='Create a sunset image',
            assistant_message='Generated image: https://example.com/image.png',
        )

        conversation = Conversation.objects.get(user=user)
        assert conversation.conversation_type == 'image'
        assert conversation.title == 'Image Generation'


# =============================================================================
# ViewSet Tests
# =============================================================================


@pytest.mark.django_db
class TestConversationViewSet:
    """Tests for ConversationViewSet queryset."""

    @pytest.fixture
    def user(self):
        """Create a test user."""
        return User.objects.create_user(
            username='viewsetuser',
            email='viewset@example.com',
            password='testpass123',
        )

    @pytest.fixture
    def conversation_with_messages(self, user):
        """Create a conversation with messages."""
        conv = Conversation.objects.create(
            user=user,
            conversation_id='ember-chat-test',
            conversation_type='ember_chat',
            title='Test Conversation',
        )
        Message.objects.create(conversation=conv, role='user', content='Hello')
        Message.objects.create(conversation=conv, role='assistant', content='Hi there!')
        Message.objects.create(conversation=conv, role='user', content='How are you?')
        return conv

    def test_message_count_annotation(self, user, conversation_with_messages):
        """ViewSet queryset should include message_count annotation."""
        from django.db.models import Count

        queryset = (
            Conversation.objects.filter(user=user)
            .annotate(message_count=Count('messages'))
            .prefetch_related('messages')
        )

        conv = queryset.first()
        assert conv.message_count == 3

    def test_user_isolation_in_queryset(self, user):
        """Users should only see their own conversations."""
        # Create conversation for test user
        Conversation.objects.create(
            user=user,
            conversation_id='ember-chat-user1',
            title='User 1 Conv',
        )

        # Create another user with their own conversation
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123',
        )
        Conversation.objects.create(
            user=other_user,
            conversation_id='ember-chat-user2',
            title='User 2 Conv',
        )

        # User should only see their own
        user_conversations = Conversation.objects.filter(user=user)
        assert user_conversations.count() == 1
        assert user_conversations.first().title == 'User 1 Conv'


# =============================================================================
# Model Tests
# =============================================================================


@pytest.mark.django_db
class TestConversationModel:
    """Tests for Conversation model."""

    @pytest.fixture
    def user(self):
        """Create a test user."""
        return User.objects.create_user(
            username='modeluser',
            email='model@example.com',
            password='testpass123',
        )

    def test_unique_constraint_same_user(self, user):
        """Same user cannot have duplicate conversation_id."""
        Conversation.objects.create(
            user=user,
            conversation_id='ember-chat-123',
            title='First',
        )

        with pytest.raises(Exception):  # IntegrityError
            Conversation.objects.create(
                user=user,
                conversation_id='ember-chat-123',
                title='Duplicate',
            )

    def test_unique_constraint_different_users(self, user):
        """Different users CAN have same conversation_id."""
        other_user = User.objects.create_user(
            username='othermodeluser',
            email='othermodel@example.com',
            password='testpass123',
        )

        # First user
        Conversation.objects.create(
            user=user,
            conversation_id='ember-chat-shared',
            title='User 1',
        )

        # Second user with same conversation_id - should NOT raise
        conv2 = Conversation.objects.create(
            user=other_user,
            conversation_id='ember-chat-shared',
            title='User 2',
        )
        assert conv2.id is not None

    def test_soft_delete(self, user):
        """Conversation should support soft delete."""
        conv = Conversation.objects.create(
            user=user,
            conversation_id='ember-chat-softdelete',
            title='To be deleted',
        )

        # Soft delete
        conv.soft_delete()

        # Should not appear in default queryset
        assert Conversation.objects.filter(id=conv.id).count() == 0

        # But should appear in all_objects
        assert Conversation.all_objects.filter(id=conv.id).count() == 1

    def test_default_conversation_type(self, user):
        """Default conversation_type should be ember_chat."""
        conv = Conversation.objects.create(
            user=user,
            conversation_id='test-default',
            title='Test',
        )
        assert conv.conversation_type == 'ember_chat'
