from rest_framework import serializers
from .models import Conversation, Message, Project, ReferralCode, Referral


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'title', 'created_at', 'updated_at', 'messages']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for user projects with access control.

    Exposes the fields needed to render profile grids and project pages. The
    `username` field is included so the frontend can easily construct
    `/{username}/{slug}` URLs.
    
    Content field is sanitized to prevent XSS in stored JSON data.
    Slug is auto-generated from title if not provided.
    """

    username = serializers.ReadOnlyField(source='user.username')
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Project
        fields = [
            'id',
            'username',
            'title',
            'slug',
            'description',
            'type',
            'is_showcase',
            'is_archived',
            'thumbnail_url',
            'content',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'username', 'created_at', 'updated_at']
    
    def validate_content(self, value):
        """Validate content JSON structure, sanitize HTML, and enforce size limits."""
        import json
        import bleach
        
        if not isinstance(value, dict):
            raise serializers.ValidationError("Content must be a JSON object.")
        
        # Define allowed structure - only accept known keys
        allowed_keys = {'blocks', 'cover', 'tags', 'metadata'}
        provided_keys = set(value.keys())
        
        if not provided_keys.issubset(allowed_keys):
            invalid_keys = provided_keys - allowed_keys
            raise serializers.ValidationError(
                f"Content contains invalid keys: {', '.join(invalid_keys)}. "
                f"Allowed keys: {', '.join(allowed_keys)}"
            )
        
        # Sanitize text content in blocks to prevent XSS
        if 'blocks' in value:
            if not isinstance(value['blocks'], list):
                raise serializers.ValidationError("'blocks' must be a list.")
            
            for i, block in enumerate(value.get('blocks', [])):
                if not isinstance(block, dict):
                    raise serializers.ValidationError(
                        f"Block at index {i} must be a JSON object."
                    )
                
                # Sanitize text fields in blocks
                if 'text' in block and isinstance(block['text'], str):
                    block['text'] = bleach.clean(
                        block['text'],
                        tags=['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3'],
                        attributes={'a': ['href', 'title']},
                        strip=True
                    )
                
                # Sanitize title fields
                if 'title' in block and isinstance(block['title'], str):
                    block['title'] = bleach.clean(
                        block['title'],
                        tags=[],
                        strip=True
                    )
        
        # Validate tags structure
        if 'tags' in value:
            if not isinstance(value['tags'], list):
                raise serializers.ValidationError("'tags' must be a list.")
            
            # Limit number of tags
            if len(value['tags']) > 20:
                raise serializers.ValidationError("Maximum 20 tags allowed.")
            
            # Sanitize each tag
            value['tags'] = [
                bleach.clean(str(tag), tags=[], strip=True)[:50]
                for tag in value['tags']
            ]
        
        # Validate metadata structure
        if 'metadata' in value and not isinstance(value['metadata'], dict):
            raise serializers.ValidationError("'metadata' must be a JSON object.")
        
        # Check size limit AFTER sanitization
        content_str = json.dumps(value)
        if len(content_str) > 100000:  # 100KB limit
            raise serializers.ValidationError(
                "Content size exceeds maximum allowed (100KB)."
            )
        
        return value
    
    def validate_thumbnail_url(self, value):
        """Validate thumbnail URL if provided."""
        if value:
            from django.core.validators import URLValidator
            from django.core.exceptions import ValidationError as DjangoValidationError
            validator = URLValidator()
            try:
                validator(value)
            except DjangoValidationError:
                raise serializers.ValidationError("Invalid thumbnail URL.")
        return value


class ReferralCodeSerializer(serializers.ModelSerializer):
    """Serializer for user referral codes.
    
    Exposes the referral code and usage statistics for a user.
    The user field is read-only and automatically set to the authenticated user.
    """
    
    username = serializers.ReadOnlyField(source='user.username')
    is_valid = serializers.SerializerMethodField()
    referral_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ReferralCode
        fields = [
            'id',
            'code',
            'username',
            'created_at',
            'uses_count',
            'max_uses',
            'is_active',
            'expires_at',
            'is_valid',
            'referral_url',
        ]
        read_only_fields = ['id', 'code', 'username', 'created_at', 'uses_count']
    
    def get_is_valid(self, obj):
        """Check if the referral code is currently valid."""
        return obj.is_valid()
    
    def get_referral_url(self, obj):
        """Generate a full referral URL."""
        from django.conf import settings
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        return f"{base_url}/signup?ref={obj.code}"


class ReferralSerializer(serializers.ModelSerializer):
    """Serializer for individual referrals.
    
    Tracks the relationship between referrer and referred users.
    """
    
    referrer_username = serializers.ReadOnlyField(source='referrer.username')
    referred_username = serializers.SerializerMethodField()
    referral_code_value = serializers.ReadOnlyField(source='referral_code.code')
    status_display = serializers.ReadOnlyField(source='get_status_display')
    
    class Meta:
        model = Referral
        fields = [
            'id',
            'referrer_username',
            'referred_username',
            'referral_code_value',
            'created_at',
            'status',
            'status_display',
            'reward_data',
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_referred_username(self, obj):
        """Get referred user's username if available."""
        return obj.referred_user.username if obj.referred_user else None


class ReferralStatsSerializer(serializers.Serializer):
    """Serializer for referral statistics."""
    
    total_referrals = serializers.IntegerField()
    pending_referrals = serializers.IntegerField()
    completed_referrals = serializers.IntegerField()
    rewarded_referrals = serializers.IntegerField()
    total_uses = serializers.IntegerField()
