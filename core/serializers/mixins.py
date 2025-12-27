"""
Reusable serializer mixins for Django REST Framework.

These mixins extract common patterns found across serializers to reduce
code duplication and improve maintainability.
"""

from typing import Any


class CamelCaseFieldsMixin:
    """
    Mixin to convert snake_case field names to camelCase in serializer output.

    Define CAMEL_CASE_FIELDS as a dict mapping snake_case -> camelCase for fields
    that need conversion. Fields not in the mapping are passed through unchanged.

    Usage:
        class MySerializer(CamelCaseFieldsMixin, serializers.ModelSerializer):
            CAMEL_CASE_FIELDS = {
                'user_avatar_url': 'userAvatarUrl',
                'is_promoted': 'isPromoted',
                'created_at': 'createdAt',
            }

            class Meta:
                model = MyModel
                fields = ['id', 'user_avatar_url', 'is_promoted', 'created_at']
    """

    # Subclasses define their field mappings
    CAMEL_CASE_FIELDS: dict[str, str] = {}

    def to_representation(self, instance: Any) -> dict[str, Any]:
        """Convert snake_case field names to camelCase."""
        data = super().to_representation(instance)
        return self._apply_camel_case_conversion(data)

    def _apply_camel_case_conversion(self, data: dict[str, Any]) -> dict[str, Any]:
        """Apply camelCase conversion to a data dictionary."""
        if not self.CAMEL_CASE_FIELDS:
            return data

        camel_case_data = {}
        for key, value in data.items():
            new_key = self.CAMEL_CASE_FIELDS.get(key, key)
            camel_case_data[new_key] = value
        return camel_case_data


class UserFromRequestMixin:
    """
    Mixin to automatically set user from request context on create.

    This is a common pattern where the current user should be set as the
    owner/creator of a new object.

    Usage:
        class MySerializer(UserFromRequestMixin, serializers.ModelSerializer):
            class Meta:
                model = MyModel
                fields = ['id', 'title', 'content']

    The mixin will automatically set validated_data['user'] from the request.
    Override USER_FIELD_NAME to use a different field name (e.g., 'creator', 'author').
    """

    # Field name to set with the user. Override in subclass if different.
    USER_FIELD_NAME: str = 'user'

    def create(self, validated_data: dict[str, Any]) -> Any:
        """Set user from request context before creating."""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data[self.USER_FIELD_NAME] = request.user
        return super().create(validated_data)


class AnnotatedFieldMixin:
    """
    Mixin providing helper for annotated field patterns with fallback queries.

    This is a common pattern where views pre-annotate querysets to avoid N+1
    queries, but serializers need a fallback for single-object cases.

    Usage:
        class MySerializer(AnnotatedFieldMixin, serializers.ModelSerializer):
            is_liked = serializers.SerializerMethodField()

            def get_is_liked(self, obj):
                return self.get_annotated_or_query(
                    obj=obj,
                    annotation_attr='_is_liked',
                    fallback_query=lambda: Like.objects.filter(
                        user=self.context['request'].user,
                        item=obj
                    ).exists(),
                    requires_auth=True,
                )
    """

    def get_annotated_or_query(
        self,
        obj: Any,
        annotation_attr: str,
        fallback_query: callable,
        requires_auth: bool = True,
        default_unauthenticated: Any = False,
        self_check_field: str | None = None,
        self_check_value: Any = None,
    ) -> Any:
        """
        Get annotated value or fall back to query.

        Args:
            obj: The model instance being serialized
            annotation_attr: The name of the annotation attribute (e.g., '_is_liked')
            fallback_query: A callable that performs the database query
            requires_auth: If True, returns default_unauthenticated for anonymous users
            default_unauthenticated: Value to return for unauthenticated users
            self_check_field: Optional field to compare with current user for "self" check
            self_check_value: Value to return if the object belongs to current user

        Returns:
            The annotated value, query result, or default
        """
        request = self.context.get('request')

        # Check authentication if required
        if requires_auth:
            if not request or not request.user.is_authenticated:
                return default_unauthenticated

        # Check if this is the user's own object (e.g., can't follow yourself)
        if self_check_field is not None:
            obj_user_id = getattr(obj, self_check_field, None)
            if obj_user_id is not None and request and request.user.id == obj_user_id:
                return self_check_value

        # Use pre-annotated value if available (avoids N+1 in list views)
        if hasattr(obj, annotation_attr):
            return getattr(obj, annotation_attr)

        # Fallback to query (for single-object serialization)
        return fallback_query()
