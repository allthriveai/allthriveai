from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UATCategory, UATScenario, UATTestRun

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    """Minimal serializer for admin users (for assignee/tester dropdown)."""

    avatar = serializers.CharField(source='avatar_url', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'avatar']


class UATCategorySerializer(serializers.ModelSerializer):
    """Serializer for UAT categories."""

    class Meta:
        model = UATCategory
        fields = [
            'id',
            'name',
            'slug',
            'color',
            'order',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
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


class UATTestRunSerializer(serializers.ModelSerializer):
    """Serializer for UAT test runs."""

    tested_by_detail = AdminUserSerializer(source='tested_by', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)

    class Meta:
        model = UATTestRun
        fields = [
            'id',
            'scenario',
            'date_tested',
            'result',
            'result_display',
            'notes',
            'tested_by',
            'tested_by_detail',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'tested_by_detail', 'result_display']


class UATTestRunCreateSerializer(UATTestRunSerializer):
    """Serializer for creating test runs - auto-sets tested_by."""

    class Meta(UATTestRunSerializer.Meta):
        read_only_fields = ['id', 'created_at', 'tested_by', 'tested_by_detail', 'result_display']

    def create(self, validated_data):
        """Set tested_by from request user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['tested_by'] = request.user
        return super().create(validated_data)


class UATScenarioSerializer(serializers.ModelSerializer):
    """Serializer for UAT scenarios with nested test runs."""

    category_detail = UATCategorySerializer(source='category', read_only=True)
    created_by_detail = AdminUserSerializer(source='created_by', read_only=True)
    updated_by_detail = AdminUserSerializer(source='updated_by', read_only=True)
    test_runs = UATTestRunSerializer(many=True, read_only=True)
    test_run_count = serializers.IntegerField(read_only=True)
    latest_test_run = UATTestRunSerializer(read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = UATScenario
        fields = [
            'id',
            'title',
            'description',
            'priority',
            'priority_display',
            # FK IDs for writes
            'category',
            # Nested details for reads
            'category_detail',
            'created_by_detail',
            'updated_by_detail',
            # Test runs
            'test_runs',
            'test_run_count',
            'latest_test_run',
            # Other fields
            'order',
            'is_archived',
            'linked_task',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'category_detail',
            'created_by_detail',
            'updated_by_detail',
            'test_runs',
            'test_run_count',
            'latest_test_run',
            'priority_display',
        ]


class UATScenarioCreateSerializer(UATScenarioSerializer):
    """Serializer for creating UAT scenarios."""

    def create(self, validated_data):
        """Set created_by from request user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class UATScenarioReorderSerializer(serializers.Serializer):
    """Serializer for reordering scenarios."""

    order = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text='List of scenario IDs in desired order',
    )


class UATScenarioStatsSerializer(serializers.Serializer):
    """Serializer for UAT scenario statistics."""

    total_scenarios = serializers.IntegerField()
    total_test_runs = serializers.IntegerField()
    scenarios_never_tested = serializers.IntegerField()
    # Latest run stats (based on most recent run per scenario)
    latest_passed = serializers.IntegerField()
    latest_failed = serializers.IntegerField()
    latest_na = serializers.IntegerField()
    pass_rate = serializers.FloatField()
    by_category = serializers.DictField(child=serializers.IntegerField())
