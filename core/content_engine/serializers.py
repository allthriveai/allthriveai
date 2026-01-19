"""Serializers for Content Engine API."""

from rest_framework import serializers

from .models import BrainstormSession, BrandVoice, ContentClip, ContentIdea, ScheduledPost


class BrandVoiceSerializer(serializers.ModelSerializer):
    """Serializer for BrandVoice."""

    class Meta:
        model = BrandVoice
        fields = [
            'id',
            'tone',
            'personality_traits',
            'topics',
            'signature_phrases',
            'default_cta',
            'primary_color',
            'accent_color',
            'visual_style',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContentIdeaSerializer(serializers.ModelSerializer):
    """Serializer for ContentIdea."""

    clips_count = serializers.SerializerMethodField()

    class Meta:
        model = ContentIdea
        fields = [
            'id',
            'title',
            'description',
            'content_pillar',
            'platforms',
            'source',
            'status',
            'planned_for_week',
            'order',
            'clips_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'clips_count']

    def get_clips_count(self, obj):
        return obj.clips.count()


class ContentIdeaCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ContentIdea."""

    class Meta:
        model = ContentIdea
        fields = [
            'title',
            'description',
            'content_pillar',
            'platforms',
            'source',
        ]

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ContentClipSerializer(serializers.ModelSerializer):
    """Serializer for ContentClip."""

    idea_title = serializers.CharField(source='idea.title', read_only=True)
    scheduled_posts_count = serializers.SerializerMethodField()

    class Meta:
        model = ContentClip
        fields = [
            'id',
            'title',
            'description',
            'idea',
            'idea_title',
            'scenes',
            'duration',
            'style',
            'status',
            'review_notes',
            'scheduled_posts_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'scheduled_posts_count']

    def get_scheduled_posts_count(self, obj):
        return obj.scheduled_posts.count()


class ContentClipCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ContentClip."""

    class Meta:
        model = ContentClip
        fields = [
            'title',
            'description',
            'idea',
            'scenes',
            'duration',
            'style',
        ]

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ContentClipUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating ContentClip (iteration)."""

    feedback = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = ContentClip
        fields = [
            'title',
            'description',
            'scenes',
            'duration',
            'style',
            'status',
            'review_notes',
            'feedback',
        ]

    def update(self, instance, validated_data):
        feedback = validated_data.pop('feedback', None)
        if feedback:
            # Append feedback to review_notes
            if instance.review_notes:
                instance.review_notes += f'\n\n---\n\n{feedback}'
            else:
                instance.review_notes = feedback
        return super().update(instance, validated_data)


class ScheduledPostSerializer(serializers.ModelSerializer):
    """Serializer for ScheduledPost."""

    clip_title = serializers.CharField(source='clip.title', read_only=True)
    platform_display = serializers.CharField(source='get_platform_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ScheduledPost
        fields = [
            'id',
            'clip',
            'clip_title',
            'platform',
            'platform_display',
            'text_content',
            'platform_specific',
            'scheduled_for',
            'status',
            'status_display',
            'published_at',
            'platform_post_id',
            'platform_url',
            'error_message',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'published_at',
            'platform_post_id',
            'platform_url',
            'error_message',
            'created_at',
            'updated_at',
        ]


class ScheduledPostCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ScheduledPost."""

    class Meta:
        model = ScheduledPost
        fields = [
            'clip',
            'platform',
            'text_content',
            'platform_specific',
            'scheduled_for',
        ]

    def validate_clip(self, value):
        if value.status != ContentClip.Status.APPROVED:
            raise serializers.ValidationError('Only approved clips can be scheduled.')
        return value

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        # Update clip status to scheduled
        clip = validated_data['clip']
        clip.status = ContentClip.Status.SCHEDULED
        clip.save()
        return super().create(validated_data)


class BrainstormSessionSerializer(serializers.ModelSerializer):
    """Serializer for BrainstormSession."""

    ideas_count = serializers.SerializerMethodField()

    class Meta:
        model = BrainstormSession
        fields = [
            'id',
            'title',
            'description',
            'messages',
            'target_week',
            'ideas_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'ideas_count']

    def get_ideas_count(self, obj):
        return obj.generated_ideas.count()


class CalendarViewSerializer(serializers.Serializer):
    """Serializer for calendar view data."""

    ideas = ContentIdeaSerializer(many=True)
    clips = ContentClipSerializer(many=True)
    scheduled = ScheduledPostSerializer(many=True)
    published = ScheduledPostSerializer(many=True)


class PipelineStatsSerializer(serializers.Serializer):
    """Serializer for pipeline statistics."""

    ideas_count = serializers.IntegerField()
    clips_draft_count = serializers.IntegerField()
    clips_review_count = serializers.IntegerField()
    clips_approved_count = serializers.IntegerField()
    scheduled_count = serializers.IntegerField()
    published_count = serializers.IntegerField()
