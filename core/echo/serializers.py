"""Serializers for Echo API."""

from rest_framework import serializers

from .models import EchoProfile, OnboardingPhase


class EchoProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for EchoProfile.

    Supports GET (retrieve profile) and PATCH (partial updates).
    Auto-creates profile if it doesn't exist on GET.
    """

    VALID_PHASES = [choice[0] for choice in OnboardingPhase.choices]
    VALID_PLATFORMS = ['twitter', 'linkedin', 'youtube', 'newsletter', 'tiktok', 'instagram']

    class Meta:
        model = EchoProfile
        fields = [
            'id',
            'onboarding_phase',
            'goals',
            'target_platforms',
            'content_pillars',
            'asana_enabled',
            'audience_description',
            'preferred_posting_times',
            'is_onboarded',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_onboarded', 'created_at', 'updated_at']

    def validate_onboarding_phase(self, value):
        """Validate onboarding_phase is a valid choice."""
        if value and value not in self.VALID_PHASES:
            raise serializers.ValidationError(
                f"Invalid onboarding_phase: {value}. Must be one of: {self.VALID_PHASES}"
            )
        return value

    def validate_target_platforms(self, value):
        """Validate target_platforms contains valid platform names."""
        if value:
            invalid = [p for p in value if p not in self.VALID_PLATFORMS]
            if invalid:
                raise serializers.ValidationError(
                    f"Invalid platforms: {invalid}. Must be from: {self.VALID_PLATFORMS}"
                )
        return value

    def validate_goals(self, value):
        """Validate goals is a list of strings."""
        if value is not None and not isinstance(value, list):
            raise serializers.ValidationError("goals must be a list of strings")
        if value:
            for item in value:
                if not isinstance(item, str):
                    raise serializers.ValidationError("Each goal must be a string")
        return value

    def validate_content_pillars(self, value):
        """Validate content_pillars is a list of strings."""
        if value is not None and not isinstance(value, list):
            raise serializers.ValidationError("content_pillars must be a list of strings")
        if value:
            for item in value:
                if not isinstance(item, str):
                    raise serializers.ValidationError("Each content pillar must be a string")
        return value
