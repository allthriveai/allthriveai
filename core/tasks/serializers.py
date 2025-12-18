from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Task, TaskComment, TaskDashboard, TaskOption

User = get_user_model()


class TaskOptionSerializer(serializers.ModelSerializer):
    """Serializer for task options (status, type, priority).

    Slug is auto-generated from name if not provided.
    """

    # Explicitly define option_type without the auto-generated UniqueValidator
    # DRF incorrectly generates a validator from the conditional UniqueConstraint
    option_type = serializers.ChoiceField(choices=TaskOption.OptionType.choices)

    class Meta:
        model = TaskOption
        fields = [
            'id',
            'option_type',
            'name',
            'slug',
            'color',
            'icon',
            'order',
            'is_active',
            'is_default',
            'is_closed_status',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def to_internal_value(self, data):
        """Generate slug from name before validation if not provided."""
        from django.utils.text import slugify

        # Make a mutable copy if needed
        if hasattr(data, '_mutable'):
            data._mutable = True

        # Generate slug if not provided
        if not data.get('slug') and data.get('name'):
            if isinstance(data, dict):
                data['slug'] = slugify(data['name'])
            else:
                data['slug'] = slugify(data.get('name', ''))

        return super().to_internal_value(data)


class AdminUserSerializer(serializers.ModelSerializer):
    """Minimal serializer for admin users (for assignee dropdown)."""

    avatar = serializers.CharField(source='avatar_url', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'avatar']


class TaskSerializer(serializers.ModelSerializer):
    """Serializer for tasks with nested option details."""

    status_detail = TaskOptionSerializer(source='status', read_only=True)
    task_type_detail = TaskOptionSerializer(source='task_type', read_only=True)
    priority_detail = TaskOptionSerializer(source='priority', read_only=True)
    assignee_detail = AdminUserSerializer(source='assignee', read_only=True)
    created_by_detail = AdminUserSerializer(source='created_by', read_only=True)
    updated_by_detail = AdminUserSerializer(source='updated_by', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            # FK IDs for writes
            'status',
            'task_type',
            'priority',
            'assignee',
            # Nested details for reads
            'status_detail',
            'task_type_detail',
            'priority_detail',
            'assignee_detail',
            'created_by_detail',
            'updated_by_detail',
            # Other fields
            'order_in_status',
            'due_date',
            'completed_at',
            'created_at',
            'updated_at',
            'is_archived',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'completed_at',
            'status_detail',
            'task_type_detail',
            'priority_detail',
            'assignee_detail',
            'created_by_detail',
            'updated_by_detail',
        ]

    def validate_status(self, value):
        """Ensure status is a valid status option."""
        if value and value.option_type != 'status':
            raise serializers.ValidationError('Must be a status option.')
        return value

    def validate_task_type(self, value):
        """Ensure task_type is a valid type option."""
        if value and value.option_type != 'type':
            raise serializers.ValidationError('Must be a type option.')
        return value

    def validate_priority(self, value):
        """Ensure priority is a valid priority option."""
        if value and value.option_type != 'priority':
            raise serializers.ValidationError('Must be a priority option.')
        return value

    def validate_assignee(self, value):
        """Ensure assignee is an admin user."""
        if value and value.role != 'admin':
            raise serializers.ValidationError('Assignee must be an admin user.')
        return value


class TaskCreateSerializer(TaskSerializer):
    """Serializer for creating tasks with default handling."""

    status = serializers.PrimaryKeyRelatedField(
        queryset=TaskOption.objects.filter(option_type='status', is_active=True),
        required=False,
        allow_null=True,
    )
    task_type = serializers.PrimaryKeyRelatedField(
        queryset=TaskOption.objects.filter(option_type='type', is_active=True),
        required=False,
        allow_null=True,
    )
    priority = serializers.PrimaryKeyRelatedField(
        queryset=TaskOption.objects.filter(option_type='priority', is_active=True),
        required=False,
        allow_null=True,
    )

    def create(self, validated_data):
        """Set defaults for status, type, priority if not provided."""
        if not validated_data.get('status'):
            default_status = TaskOption.objects.filter(option_type='status', is_default=True, is_active=True).first()
            if default_status:
                validated_data['status'] = default_status

        if not validated_data.get('task_type'):
            default_type = TaskOption.objects.filter(option_type='type', is_default=True, is_active=True).first()
            if default_type:
                validated_data['task_type'] = default_type

        if not validated_data.get('priority'):
            default_priority = TaskOption.objects.filter(
                option_type='priority', is_default=True, is_active=True
            ).first()
            if default_priority:
                validated_data['priority'] = default_priority

        # Set created_by from request user
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        return super().create(validated_data)


class TaskBulkUpdateSerializer(serializers.Serializer):
    """Serializer for bulk updating multiple tasks."""

    task_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )
    status = serializers.PrimaryKeyRelatedField(
        queryset=TaskOption.objects.filter(option_type='status', is_active=True),
        required=False,
        allow_null=True,
    )
    assignee = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='admin'),
        required=False,
        allow_null=True,
    )
    priority = serializers.PrimaryKeyRelatedField(
        queryset=TaskOption.objects.filter(option_type='priority', is_active=True),
        required=False,
        allow_null=True,
    )
    is_archived = serializers.BooleanField(required=False)


class TaskReorderSerializer(serializers.Serializer):
    """Serializer for reordering tasks within a status column."""

    task_id = serializers.IntegerField()
    new_status_id = serializers.IntegerField(required=False)
    new_order = serializers.IntegerField(min_value=0)


class TaskDashboardSerializer(serializers.ModelSerializer):
    """Serializer for saved dashboard views."""

    created_by_detail = AdminUserSerializer(source='created_by', read_only=True)

    class Meta:
        model = TaskDashboard
        fields = [
            'id',
            'name',
            'slug',
            'view_mode',
            'filters',
            'sort_by',
            'sort_direction',
            'is_default',
            'order',
            'icon',
            'created_by',
            'created_by_detail',
            'is_shared',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at', 'created_by_detail']

    def create(self, validated_data):
        """Set created_by from request user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class TaskStatsSerializer(serializers.Serializer):
    """Serializer for task statistics."""

    total = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    by_priority = serializers.DictField(child=serializers.IntegerField())
    overdue = serializers.IntegerField()
    due_soon = serializers.IntegerField()
    unassigned = serializers.IntegerField()


class TaskCommentSerializer(serializers.ModelSerializer):
    """Serializer for task comments."""

    author_detail = AdminUserSerializer(source='author', read_only=True)

    class Meta:
        model = TaskComment
        fields = [
            'id',
            'task',
            'author',
            'author_detail',
            'content',
            'created_at',
            'updated_at',
            'is_deleted',
        ]
        read_only_fields = ['id', 'author', 'author_detail', 'created_at', 'updated_at', 'is_deleted']

    def create(self, validated_data):
        """Set author from request user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['author'] = request.user
        return super().create(validated_data)
