"""Serializers for Prompt Battle feature."""

from rest_framework import serializers

from core.tools.models import Tool
from core.users.models import User

from .models import BattleInvitation, BattleStatus, BattleSubmission, BattleType, ChallengeType, PromptBattle


class BattleUserSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for battle participants."""

    class Meta:
        model = User
        fields = ['id', 'username', 'avatar_url']
        read_only_fields = ['id', 'username', 'avatar_url']


class BattleToolSerializer(serializers.ModelSerializer):
    """Lightweight tool serializer for battles."""

    class Meta:
        model = Tool
        fields = ['id', 'name', 'slug', 'logo_url', 'website_url']
        read_only_fields = ['id', 'name', 'slug', 'logo_url', 'website_url']


class BattleSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for battle submissions."""

    username = serializers.ReadOnlyField(source='user.username')
    user_avatar = serializers.ReadOnlyField(source='user.avatar_url')

    class Meta:
        model = BattleSubmission
        fields = [
            'id',
            'battle',
            'user',
            'username',
            'user_avatar',
            'prompt_text',
            'submission_type',
            'generated_output_url',
            'generated_output_text',
            'score',
            'criteria_scores',
            'evaluation_feedback',
            'submitted_at',
            'evaluated_at',
        ]
        read_only_fields = [
            'id',
            'username',
            'user_avatar',
            'submitted_at',
            'score',
            'criteria_scores',
            'evaluation_feedback',
            'evaluated_at',
        ]

    def validate_prompt_text(self, value):
        """Validate prompt text length."""
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Prompt must be at least 10 characters long.')

        if len(value) > 5000:
            raise serializers.ValidationError('Prompt must be less than 5000 characters.')

        return value


class ChallengeTypeSerializer(serializers.ModelSerializer):
    """Serializer for challenge type."""

    class Meta:
        model = ChallengeType
        fields = ['key', 'name', 'description']
        read_only_fields = ['key', 'name', 'description']


class PromptBattleSerializer(serializers.ModelSerializer):
    """Serializer for prompt battles with full details."""

    challenger_data = BattleUserSerializer(source='challenger', read_only=True)
    opponent_data = BattleUserSerializer(source='opponent', read_only=True)
    winner_data = BattleUserSerializer(source='winner', read_only=True)
    submissions = BattleSubmissionSerializer(many=True, read_only=True)
    challenge_type = ChallengeTypeSerializer(read_only=True)
    tool_data = BattleToolSerializer(source='tool', read_only=True)

    time_remaining = serializers.SerializerMethodField()
    is_expired = serializers.ReadOnlyField()
    user_has_submitted = serializers.SerializerMethodField()
    can_submit = serializers.SerializerMethodField()

    class Meta:
        model = PromptBattle
        fields = [
            'id',
            'challenger',
            'challenger_data',
            'opponent',
            'opponent_data',
            'challenge_text',
            'challenge_type',
            'tool',
            'tool_data',
            'status',
            'battle_type',
            'match_source',
            'duration_minutes',
            'created_at',
            'started_at',
            'expires_at',
            'completed_at',
            'winner',
            'winner_data',
            'submissions',
            'time_remaining',
            'is_expired',
            'user_has_submitted',
            'can_submit',
        ]
        read_only_fields = [
            'id',
            'challenger_data',
            'opponent_data',
            'winner_data',
            'challenge_type',
            'tool_data',
            'match_source',
            'created_at',
            'started_at',
            'expires_at',
            'completed_at',
            'winner',
            'submissions',
            'time_remaining',
            'is_expired',
        ]

    def get_time_remaining(self, obj):
        """Get time remaining in seconds."""
        return obj.time_remaining

    def get_user_has_submitted(self, obj):
        """Check if the current user has submitted."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False

        return obj.submissions.filter(user=request.user).exists()

    def get_can_submit(self, obj):
        """Check if the current user can submit."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False

        # Must be active and not expired
        if obj.status != BattleStatus.ACTIVE or obj.is_expired:
            return False

        # Must be a participant
        if request.user not in [obj.challenger, obj.opponent]:
            return False

        # Must not have submitted yet
        return not obj.submissions.filter(user=request.user).exists()

    def validate(self, data):
        """Validate battle creation."""
        # Check if challenger and opponent are different
        challenger = data.get('challenger')
        opponent = data.get('opponent')

        if challenger == opponent:
            raise serializers.ValidationError('Cannot create a battle with yourself.')

        return data


class PromptBattleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing battles."""

    challenger_username = serializers.ReadOnlyField(source='challenger.username')
    opponent_username = serializers.ReadOnlyField(source='opponent.username')
    winner_username = serializers.ReadOnlyField(source='winner.username')
    tool_data = BattleToolSerializer(source='tool', read_only=True)

    time_remaining = serializers.SerializerMethodField()
    submission_count = serializers.SerializerMethodField()

    class Meta:
        model = PromptBattle
        fields = [
            'id',
            'challenger_username',
            'opponent_username',
            'challenge_text',
            'status',
            'battle_type',
            'tool_data',
            'duration_minutes',
            'created_at',
            'started_at',
            'expires_at',
            'winner_username',
            'time_remaining',
            'submission_count',
        ]
        read_only_fields = fields

    def get_time_remaining(self, obj):
        """Get time remaining in seconds."""
        return obj.time_remaining

    def get_submission_count(self, obj):
        """Get number of submissions."""
        return obj.submissions.count()


class BattleInvitationSerializer(serializers.ModelSerializer):
    """Serializer for battle invitations."""

    sender_data = BattleUserSerializer(source='sender', read_only=True)
    recipient_data = BattleUserSerializer(source='recipient', read_only=True)
    battle_data = PromptBattleListSerializer(source='battle', read_only=True)

    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = BattleInvitation
        fields = [
            'id',
            'battle',
            'battle_data',
            'sender',
            'sender_data',
            'recipient',
            'recipient_data',
            'message',
            'status',
            'created_at',
            'responded_at',
            'expires_at',
            'is_expired',
        ]
        read_only_fields = [
            'id',
            'battle_data',
            'sender_data',
            'recipient_data',
            'created_at',
            'responded_at',
            'expires_at',
            'is_expired',
        ]

    def validate_message(self, value):
        """Validate invitation message."""
        if len(value) > 500:
            raise serializers.ValidationError('Message must be less than 500 characters.')

        return value


class CreateBattleInvitationSerializer(serializers.Serializer):
    """Serializer for creating a battle invitation."""

    opponent_username = serializers.CharField(max_length=150)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)
    battle_type = serializers.ChoiceField(choices=BattleType.choices, default=BattleType.TEXT_PROMPT)
    duration_minutes = serializers.IntegerField(default=10, min_value=1, max_value=60)

    def validate_opponent_username(self, value):
        """Validate that opponent exists."""
        try:
            opponent = User.objects.get(username=value.lower())
        except User.DoesNotExist as e:
            raise serializers.ValidationError(f"User '{value}' does not exist.") from e

        # Check if trying to battle yourself
        request = self.context.get('request')
        if request and request.user == opponent:
            raise serializers.ValidationError('Cannot create a battle with yourself.')

        return value


class BattleStatsSerializer(serializers.Serializer):
    """Serializer for user battle statistics."""

    total_battles = serializers.IntegerField()
    wins = serializers.IntegerField()
    losses = serializers.IntegerField()
    active_battles = serializers.IntegerField()
    pending_invitations = serializers.IntegerField()
    win_rate = serializers.FloatField()
    average_score = serializers.FloatField()
