"""Serializers for Topic admin management.

Topics are stored as Taxonomy entries with taxonomy_type='topic'.
"""

from rest_framework import serializers

from core.taxonomy.models import Taxonomy


class TopicSerializer(serializers.ModelSerializer):
    """Serializer for reading topic data.

    Note: Field names use snake_case here because the axios interceptor
    automatically converts snake_case → camelCase for the frontend.
    """

    # Rename 'name' to 'title' for frontend consistency
    title = serializers.CharField(source='name', read_only=True)
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = Taxonomy
        fields = [
            'id',
            'slug',
            'title',
            'description',
            'color',
            'is_active',
            'created_at',
            'project_count',
        ]

    def get_project_count(self, obj):
        """Get the number of projects using this topic."""
        # Use annotated value if available
        if hasattr(obj, 'project_count'):
            return obj.project_count
        # Fallback: count projects that have this topic (M2M relationship)
        from core.projects.models import Project

        return Project.objects.filter(topics=obj).count()


class TopicCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating topics.

    Note: Field names use snake_case here because the axios interceptor
    automatically converts camelCase → snake_case for request data.
    """

    title = serializers.CharField(source='name')

    class Meta:
        model = Taxonomy
        fields = ['id', 'slug', 'title', 'description', 'color', 'is_active']

    def validate_slug(self, value):
        """Ensure slug is unique (excluding current instance on update)."""
        instance = self.instance
        if Taxonomy.objects.filter(slug=value).exclude(pk=instance.pk if instance else None).exists():
            raise serializers.ValidationError('A topic with this slug already exists.')
        return value

    def create(self, validated_data):
        """Create a new topic with taxonomy_type='topic'."""
        validated_data['taxonomy_type'] = 'topic'
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Update a topic (ensure taxonomy_type stays 'topic')."""
        validated_data['taxonomy_type'] = 'topic'
        return super().update(instance, validated_data)
