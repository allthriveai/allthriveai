"""Serializers for Project model."""

from rest_framework import serializers

from .constants import MAX_CONTENT_SIZE, MAX_PROJECT_TAGS, MAX_TAG_LENGTH
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for user projects with access control.

    Exposes the fields needed to render profile grids and project pages. The
    `username` field is included so the frontend can easily construct
    `/{username}/{slug}` URLs.

    Content field is sanitized to prevent XSS in stored JSON data.
    Slug is auto-generated from title if not provided.
    """

    username = serializers.ReadOnlyField(source="user.username")
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "username",
            "title",
            "slug",
            "description",
            "type",
            "is_showcase",
            "is_archived",
            "thumbnail_url",
            "content",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "username", "created_at", "updated_at"]

    def validate_content(self, value):
        """Validate content JSON structure, sanitize HTML, and enforce size limits."""
        import json

        import bleach

        if not isinstance(value, dict):
            raise serializers.ValidationError("Content must be a JSON object.")

        # Define allowed structure - only accept known keys
        allowed_keys = {"blocks", "cover", "tags", "metadata"}
        provided_keys = set(value.keys())

        if not provided_keys.issubset(allowed_keys):
            invalid_keys = provided_keys - allowed_keys
            raise serializers.ValidationError(
                f"Content contains invalid keys: {', '.join(invalid_keys)}. " f"Allowed keys: {', '.join(allowed_keys)}"
            )

        # Sanitize text content in blocks to prevent XSS
        if "blocks" in value:
            if not isinstance(value["blocks"], list):
                raise serializers.ValidationError("'blocks' must be a list.")

            for i, block in enumerate(value.get("blocks", [])):
                if not isinstance(block, dict):
                    raise serializers.ValidationError(f"Block at index {i} must be a JSON object.")

                # Sanitize text fields in blocks
                if "text" in block and isinstance(block["text"], str):
                    block["text"] = bleach.clean(
                        block["text"],
                        tags=["p", "br", "strong", "em", "a", "ul", "ol", "li", "code", "pre", "h1", "h2", "h3"],
                        attributes={"a": ["href", "title"]},
                        strip=True,
                    )

                # Sanitize title fields
                if "title" in block and isinstance(block["title"], str):
                    block["title"] = bleach.clean(block["title"], tags=[], strip=True)

        # Validate tags structure
        if "tags" in value:
            if not isinstance(value["tags"], list):
                raise serializers.ValidationError("'tags' must be a list.")

            # Limit number of tags
            if len(value["tags"]) > MAX_PROJECT_TAGS:
                raise serializers.ValidationError(f"Maximum {MAX_PROJECT_TAGS} tags allowed.")

            # Sanitize each tag
            value["tags"] = [bleach.clean(str(tag), tags=[], strip=True)[:MAX_TAG_LENGTH] for tag in value["tags"]]

        # Validate metadata structure
        if "metadata" in value and not isinstance(value["metadata"], dict):
            raise serializers.ValidationError("'metadata' must be a JSON object.")

        # Check size limit AFTER sanitization
        content_str = json.dumps(value)
        if len(content_str) > MAX_CONTENT_SIZE:
            raise serializers.ValidationError(
                f"Content size exceeds maximum allowed ({MAX_CONTENT_SIZE / 1000:.0f}KB)."
            )

        return value

    def validate_thumbnail_url(self, value):
        """Validate thumbnail URL if provided."""
        if value:
            from django.core.exceptions import ValidationError as DjangoValidationError
            from django.core.validators import URLValidator

            validator = URLValidator()
            try:
                validator(value)
            except DjangoValidationError:
                raise serializers.ValidationError("Invalid thumbnail URL.")
        return value
