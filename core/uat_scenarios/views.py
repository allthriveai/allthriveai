from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Count, OuterRef, Prefetch, Subquery
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsAdminRole
from core.tasks.models import Task, TaskOption

from .models import UATCategory, UATScenario, UATTestRun
from .serializers import (
    AdminUserSerializer,
    UATCategorySerializer,
    UATScenarioCreateSerializer,
    UATScenarioReorderSerializer,
    UATScenarioSerializer,
    UATScenarioStatsSerializer,
    UATTestRunCreateSerializer,
    UATTestRunSerializer,
)

User = get_user_model()


class UATCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing UAT categories.
    Admin-only access for CRUD operations.
    """

    queryset = UATCategory.objects.all()
    serializer_class = UATCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        """Filter by active status if provided."""
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder categories."""
        order_list = request.data.get('order', [])

        if not order_list:
            return Response({'error': 'order list required'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for idx, category_id in enumerate(order_list):
                UATCategory.objects.filter(id=category_id).update(order=idx)

        return Response({'status': 'reordered'})


class UATScenarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing UAT scenarios.
    Admin-only access with filtering, search, and bulk operations.
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_serializer_class(self):
        if self.action == 'create':
            return UATScenarioCreateSerializer
        return UATScenarioSerializer

    def get_queryset(self):
        """Apply filters and prefetch test runs."""
        queryset = (
            UATScenario.objects.select_related('category', 'created_by', 'updated_by', 'linked_task')
            .prefetch_related(
                Prefetch(
                    'test_runs',
                    queryset=UATTestRun.objects.select_related('tested_by').order_by('-date_tested', '-created_at'),
                )
            )
            .annotate(
                test_run_count=Count('test_runs'),
            )
        )

        # Category filter
        category_id = self.request.query_params.get('category')
        if category_id:
            if category_id.isdigit():
                queryset = queryset.filter(category_id=int(category_id))

        # Search filter
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(models.Q(title__icontains=search) | models.Q(description__icontains=search))

        # Archived filter (default: exclude archived)
        show_archived = self.request.query_params.get('archived', 'false')
        if show_archived.lower() != 'true':
            queryset = queryset.filter(is_archived=False)

        # Filter by latest result
        latest_result = self.request.query_params.get('latest_result')
        if latest_result:
            # Subquery to get the latest test run result for each scenario
            latest_run = UATTestRun.objects.filter(scenario=OuterRef('pk')).order_by('-date_tested', '-created_at')[:1]

            if latest_result == 'not_tested':
                queryset = queryset.filter(test_run_count=0)
            else:
                queryset = queryset.annotate(latest_result=Subquery(latest_run.values('result'))).filter(
                    latest_result=latest_result
                )

        # Sorting
        sort_by = self.request.query_params.get('sort_by', 'order')
        sort_dir = self.request.query_params.get('sort_dir', 'asc')
        if sort_dir == 'desc':
            sort_by = f'-{sort_by}'
        queryset = queryset.order_by(sort_by, '-created_at')

        return queryset

    def perform_update(self, serializer):
        """Track who updated the scenario."""
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder scenarios."""
        serializer = UATScenarioReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order_list = serializer.validated_data['order']

        with transaction.atomic():
            for idx, scenario_id in enumerate(order_list):
                UATScenario.objects.filter(id=scenario_id).update(order=idx)

        return Response({'status': 'reordered'})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get UAT scenario statistics."""
        scenarios_qs = UATScenario.objects.filter(is_archived=False)

        total_scenarios = scenarios_qs.count()
        total_test_runs = UATTestRun.objects.filter(scenario__is_archived=False).count()

        # Get latest test run for each scenario
        latest_run = UATTestRun.objects.filter(scenario=OuterRef('pk')).order_by('-date_tested', '-created_at')[:1]

        scenarios_with_latest = scenarios_qs.annotate(latest_result=Subquery(latest_run.values('result')))

        scenarios_never_tested = scenarios_with_latest.filter(latest_result__isnull=True).count()
        latest_passed = scenarios_with_latest.filter(latest_result='pass').count()
        latest_failed = scenarios_with_latest.filter(latest_result='fail').count()
        latest_na = scenarios_with_latest.filter(latest_result='na').count()

        # Calculate pass rate (excluding N/A and not tested)
        testable = latest_passed + latest_failed
        pass_rate = (latest_passed / testable * 100) if testable > 0 else 0

        # Count by category (scenarios)
        category_counts = dict(
            scenarios_qs.exclude(category__isnull=True)
            .values('category__slug')
            .annotate(count=Count('id'))
            .values_list('category__slug', 'count')
        )

        stats = {
            'total_scenarios': total_scenarios,
            'total_test_runs': total_test_runs,
            'scenarios_never_tested': scenarios_never_tested,
            'latest_passed': latest_passed,
            'latest_failed': latest_failed,
            'latest_na': latest_na,
            'pass_rate': round(pass_rate, 1),
            'by_category': category_counts,
        }

        serializer = UATScenarioStatsSerializer(stats)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def create_task(self, request, pk=None):
        """Create a task from a failed UAT scenario's latest test run."""
        scenario = self.get_object()

        if scenario.linked_task:
            return Response(
                {'error': 'Task already created for this scenario', 'task_id': scenario.linked_task.id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the latest test run
        latest_run = scenario.latest_test_run
        if not latest_run:
            return Response(
                {'error': 'No test runs found for this scenario'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if latest_run.result != 'fail':
            return Response(
                {'error': 'Can only create tasks from failed test runs'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get default status for new tasks
        default_status = TaskOption.objects.filter(option_type='status', is_default=True, is_active=True).first()
        if not default_status:
            default_status = TaskOption.objects.filter(option_type='status', is_active=True).first()

        if not default_status:
            return Response(
                {'error': 'No task status configured. Please create task statuses first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build description with scenario and test run context
        description_parts = (
            ['**UAT Scenario Failed**', '', scenario.description]
            if scenario.description
            else ['**UAT Scenario Failed**']
        )

        if latest_run.tested_by:
            description_parts.append(
                f'\n**Tested By:** {latest_run.tested_by.first_name or latest_run.tested_by.email}'
            )
        if latest_run.date_tested:
            description_parts.append(f'**Date Tested:** {latest_run.date_tested}')
        if latest_run.notes:
            description_parts.append(f'\n**Notes:** {latest_run.notes}')

        # Get next order in status
        max_order = (
            Task.objects.filter(status=default_status).aggregate(max_order=models.Max('order_in_status'))['max_order']
            or 0
        )

        # Create task
        task = Task.objects.create(
            title=f'Fix: {scenario.title}',
            description='\n'.join(description_parts),
            status=default_status,
            order_in_status=max_order + 1,
            created_by=request.user,
            updated_by=request.user,
        )

        # Link task to scenario
        scenario.linked_task = task
        scenario.updated_by = request.user
        scenario.save()

        return Response({'task_id': task.id, 'status': 'created'}, status=status.HTTP_201_CREATED)


class UATTestRunViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing UAT test runs.
    Admin-only access.
    """

    queryset = UATTestRun.objects.select_related('scenario', 'tested_by')
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_serializer_class(self):
        if self.action == 'create':
            return UATTestRunCreateSerializer
        return UATTestRunSerializer

    def get_queryset(self):
        """Filter by scenario if provided."""
        queryset = super().get_queryset()

        # Filter by scenario
        scenario_id = self.request.query_params.get('scenario')
        if scenario_id and scenario_id.isdigit():
            queryset = queryset.filter(scenario_id=int(scenario_id))

        # Filter by result
        result = self.request.query_params.get('result')
        if result:
            queryset = queryset.filter(result=result)

        # Filter by tester
        tested_by = self.request.query_params.get('tested_by')
        if tested_by and tested_by.isdigit():
            queryset = queryset.filter(tested_by_id=int(tested_by))

        return queryset.order_by('-date_tested', '-created_at')


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for listing admin users.
    Used for tester dropdowns.
    """

    queryset = User.objects.filter(role='admin', is_active=True)
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None  # Return all admins without pagination
