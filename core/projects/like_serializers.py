"""Serializers for ProjectLike model."""

from rest_framework import serializers

from .models import ProjectLike


class ProjectLikeSerializer(serializers.ModelSerializer):
    """Serializer for project likes."""

    username = serializers.ReadOnlyField(source='user.username')
    project_slug = serializers.ReadOnlyField(source='project.slug')

    class Meta:
        model = ProjectLike
        fields = ['id', 'username', 'project_slug', 'created_at']
        read_only_fields = ['id', 'username', 'project_slug', 'created_at']
