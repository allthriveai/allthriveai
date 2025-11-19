from rest_framework import serializers
from .models import Taxonomy, UserTag, UserInteraction


class TaxonomySerializer(serializers.ModelSerializer):
    """Serializer for predefined taxonomies."""
    
    category_display = serializers.ReadOnlyField(source='get_category_display')
    
    class Meta:
        model = Taxonomy
        fields = [
            'id',
            'name',
            'category',
            'category_display',
            'description',
            'is_active',
        ]
        read_only_fields = ['id']


class UserTagSerializer(serializers.ModelSerializer):
    """Serializer for user tags with personalization data."""
    
    source_display = serializers.ReadOnlyField(source='get_source_display')
    taxonomy_name = serializers.ReadOnlyField(source='taxonomy.name')
    taxonomy_category = serializers.ReadOnlyField(source='taxonomy.category')
    
    class Meta:
        model = UserTag
        fields = [
            'id',
            'name',
            'taxonomy',
            'taxonomy_name',
            'taxonomy_category',
            'source',
            'source_display',
            'confidence_score',
            'interaction_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserTagCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating user tags (manual selection)."""
    
    class Meta:
        model = UserTag
        fields = ['taxonomy', 'name']
    
    def validate(self, data):
        """Ensure either taxonomy or name is provided."""
        if not data.get('taxonomy') and not data.get('name'):
            raise serializers.ValidationError(
                "Either taxonomy or name must be provided."
            )
        
        # If taxonomy is provided, use its name
        if data.get('taxonomy'):
            data['name'] = data['taxonomy'].name
        
        return data
    
    def create(self, validated_data):
        """Create a user tag with manual source."""
        validated_data['user'] = self.context['request'].user
        validated_data['source'] = UserTag.TagSource.MANUAL
        validated_data['confidence_score'] = 1.0
        return super().create(validated_data)


class UserInteractionSerializer(serializers.ModelSerializer):
    """Serializer for tracking user interactions."""
    
    interaction_type_display = serializers.ReadOnlyField(source='get_interaction_type_display')
    
    class Meta:
        model = UserInteraction
        fields = [
            'id',
            'interaction_type',
            'interaction_type_display',
            'metadata',
            'extracted_keywords',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class UserPersonalizationSerializer(serializers.Serializer):
    """Serializer for user personalization overview."""
    
    manual_tags = UserTagSerializer(many=True, read_only=True)
    auto_generated_tags = UserTagSerializer(many=True, read_only=True)
    available_taxonomies = TaxonomySerializer(many=True, read_only=True)
    total_interactions = serializers.IntegerField(read_only=True)
