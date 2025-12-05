"""Serializers for User models."""

from rest_framework import serializers

from core.users.models import User


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal serializer for user data in nested relationships.

    Use this when you only need basic user info (id, username, avatar)
    for displaying in lists, comments, etc.
    """

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'avatar_url',
        ]
        read_only_fields = fields


class UserPublicSerializer(serializers.ModelSerializer):
    """Public user profile serializer.

    Includes public profile information that can be displayed
    on profile pages and public-facing views.
    """

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'avatar_url',
            'bio',
            'tagline',
            'location',
            'pronouns',
            'current_status',
            'website_url',
            'linkedin_url',
            'twitter_url',
            'github_url',
            'youtube_url',
            'instagram_url',
            'role',
        ]
        read_only_fields = fields
