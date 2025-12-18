import csv
import io
from datetime import datetime

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsAdminRole

from .models import Task, TaskDashboard, TaskOption
from .serializers import (
    AdminUserSerializer,
    TaskBulkUpdateSerializer,
    TaskCreateSerializer,
    TaskDashboardSerializer,
    TaskOptionSerializer,
    TaskReorderSerializer,
    TaskSerializer,
    TaskStatsSerializer,
)

User = get_user_model()


class TaskOptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing task options (status, type, priority).
    Admin-only access for CRUD operations.
    """

    queryset = TaskOption.objects.all()
    serializer_class = TaskOptionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        """Filter by option_type if provided."""
        queryset = super().get_queryset()
        option_type = self.request.query_params.get('option_type')
        if option_type:
            queryset = queryset.filter(option_type=option_type)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder options within a type."""
        option_type = request.data.get('option_type')
        order_list = request.data.get('order', [])

        if not option_type or not order_list:
            return Response({'error': 'option_type and order list required'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for idx, option_id in enumerate(order_list):
                TaskOption.objects.filter(id=option_id, option_type=option_type).update(order=idx)

        return Response({'status': 'reordered'})


class TaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tasks.
    Admin-only access with filtering, search, and bulk operations.
    """

    queryset = Task.objects.select_related('status', 'task_type', 'priority', 'assignee', 'created_by', 'updated_by')
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_serializer_class(self):
        if self.action == 'create':
            return TaskCreateSerializer
        return TaskSerializer

    def get_queryset(self):
        """Apply filters from query params."""
        queryset = super().get_queryset()

        # Status filter (comma-separated IDs)
        status_ids = self.request.query_params.get('status')
        if status_ids:
            ids = [int(id) for id in status_ids.split(',') if id.isdigit()]
            if ids:
                queryset = queryset.filter(status_id__in=ids)

        # Type filter
        type_ids = self.request.query_params.get('task_type')
        if type_ids:
            ids = [int(id) for id in type_ids.split(',') if id.isdigit()]
            if ids:
                queryset = queryset.filter(task_type_id__in=ids)

        # Priority filter
        priority_ids = self.request.query_params.get('priority')
        if priority_ids:
            ids = [int(id) for id in priority_ids.split(',') if id.isdigit()]
            if ids:
                queryset = queryset.filter(priority_id__in=ids)

        # Assignee filter
        assignee_ids = self.request.query_params.get('assignee')
        if assignee_ids:
            if assignee_ids == 'unassigned':
                queryset = queryset.filter(assignee__isnull=True)
            else:
                ids = [int(id) for id in assignee_ids.split(',') if id.isdigit()]
                if ids:
                    queryset = queryset.filter(assignee_id__in=ids)

        # Due date filter
        due_filter = self.request.query_params.get('due')
        if due_filter:
            now = timezone.now()
            if due_filter == 'overdue':
                queryset = queryset.filter(due_date__lt=now, completed_at__isnull=True)
            elif due_filter == 'today':
                queryset = queryset.filter(due_date__date=now.date())
            elif due_filter == 'week':
                from datetime import timedelta

                week_end = now + timedelta(days=7)
                queryset = queryset.filter(due_date__gte=now, due_date__lte=week_end)

        # Search filter
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))

        # Archived filter (default: exclude archived)
        show_archived = self.request.query_params.get('archived', 'false')
        if show_archived.lower() != 'true':
            queryset = queryset.filter(is_archived=False)

        # Sorting
        sort_by = self.request.query_params.get('sort_by', 'order_in_status')
        sort_dir = self.request.query_params.get('sort_dir', 'asc')
        if sort_dir == 'desc':
            sort_by = f'-{sort_by}'
        queryset = queryset.order_by(sort_by)

        return queryset

    def perform_update(self, serializer):
        """Track who updated the task and handle completion."""
        instance = serializer.instance
        new_status = serializer.validated_data.get('status')

        # Check if moving to a closed status
        completed_at = None
        if new_status and new_status.is_closed_status and not instance.completed_at:
            completed_at = timezone.now()
        elif new_status and not new_status.is_closed_status:
            completed_at = None

        serializer.save(
            updated_by=self.request.user,
            completed_at=completed_at if 'status' in serializer.validated_data else instance.completed_at,
        )

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Bulk update multiple tasks."""
        serializer = TaskBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        task_ids = serializer.validated_data.pop('task_ids')
        update_fields = {k: v for k, v in serializer.validated_data.items() if v is not None}

        if not update_fields:
            return Response({'error': 'No fields to update'}, status=status.HTTP_400_BAD_REQUEST)

        # Add audit field
        update_fields['updated_by'] = request.user
        update_fields['updated_at'] = timezone.now()

        # Handle completion if status changes to closed
        if 'status' in update_fields and update_fields['status'].is_closed_status:
            update_fields['completed_at'] = timezone.now()

        updated_count = Task.objects.filter(id__in=task_ids).update(**update_fields)

        return Response(
            {
                'status': 'updated',
                'count': updated_count,
            }
        )

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder a task within or between status columns."""
        serializer = TaskReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        task_id = serializer.validated_data['task_id']
        new_order = serializer.validated_data['new_order']
        new_status_id = serializer.validated_data.get('new_status_id')

        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            old_status_id = task.status_id
            old_order = task.order_in_status

            # If changing status
            if new_status_id and new_status_id != old_status_id:
                # Close gap in old column
                Task.objects.filter(status_id=old_status_id, order_in_status__gt=old_order).update(
                    order_in_status=models.F('order_in_status') - 1
                )

                # Make space in new column
                Task.objects.filter(status_id=new_status_id, order_in_status__gte=new_order).update(
                    order_in_status=models.F('order_in_status') + 1
                )

                # Update task
                new_status = TaskOption.objects.get(id=new_status_id)
                task.status = new_status
                task.order_in_status = new_order

                # Handle completion
                if new_status.is_closed_status:
                    task.completed_at = timezone.now()
                else:
                    task.completed_at = None

                task.updated_by = request.user
                task.save()

            # Same column reorder
            elif new_order != old_order:
                if new_order > old_order:
                    # Moving down
                    Task.objects.filter(
                        status_id=old_status_id, order_in_status__gt=old_order, order_in_status__lte=new_order
                    ).update(order_in_status=models.F('order_in_status') - 1)
                else:
                    # Moving up
                    Task.objects.filter(
                        status_id=old_status_id, order_in_status__gte=new_order, order_in_status__lt=old_order
                    ).update(order_in_status=models.F('order_in_status') + 1)

                task.order_in_status = new_order
                task.updated_by = request.user
                task.save()

        return Response({'status': 'reordered'})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get task statistics for dashboard."""
        now = timezone.now()
        from datetime import timedelta

        week_from_now = now + timedelta(days=7)

        base_qs = Task.objects.filter(is_archived=False)

        # Count by status
        status_counts = dict(
            base_qs.values('status__slug').annotate(count=Count('id')).values_list('status__slug', 'count')
        )

        # Count by priority
        priority_counts = dict(
            base_qs.exclude(priority__isnull=True)
            .values('priority__slug')
            .annotate(count=Count('id'))
            .values_list('priority__slug', 'count')
        )

        stats = {
            'total': base_qs.count(),
            'by_status': status_counts,
            'by_priority': priority_counts,
            'overdue': base_qs.filter(due_date__lt=now, completed_at__isnull=True).count(),
            'due_soon': base_qs.filter(
                due_date__gte=now, due_date__lte=week_from_now, completed_at__isnull=True
            ).count(),
            'unassigned': base_qs.filter(assignee__isnull=True).count(),
        }

        serializer = TaskStatsSerializer(stats)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export tasks to CSV file."""
        queryset = self.get_queryset()

        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="tasks_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'

        writer = csv.writer(response)

        # Header row
        writer.writerow(
            [
                'ID',
                'Title',
                'Description',
                'Status',
                'Type',
                'Priority',
                'Assignee Email',
                'Due Date',
                'Completed At',
                'Created At',
                'Created By',
                'Is Archived',
            ]
        )

        # Data rows
        for task in queryset:
            writer.writerow(
                [
                    task.id,
                    task.title,
                    task.description,
                    task.status.name if task.status else '',
                    task.task_type.name if task.task_type else '',
                    task.priority.name if task.priority else '',
                    task.assignee.email if task.assignee else '',
                    task.due_date.isoformat() if task.due_date else '',
                    task.completed_at.isoformat() if task.completed_at else '',
                    task.created_at.isoformat(),
                    task.created_by.email if task.created_by else '',
                    'Yes' if task.is_archived else 'No',
                ]
            )

        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def import_csv(self, request):
        """
        Import tasks from CSV file.
        Expected columns: Title, Description, Status, Type, Priority, Assignee Email, Due Date
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        if not csv_file.name.endswith('.csv'):
            return Response({'error': 'File must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)

        # Read and decode CSV
        try:
            decoded_file = csv_file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(decoded_file))
        except UnicodeDecodeError:
            return Response(
                {'error': 'Unable to decode file. Please ensure it is UTF-8 encoded.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cache lookups for options
        statuses = {opt.name.lower(): opt for opt in TaskOption.objects.filter(option_type='status', is_active=True)}
        types = {opt.name.lower(): opt for opt in TaskOption.objects.filter(option_type='type', is_active=True)}
        priorities = {
            opt.name.lower(): opt for opt in TaskOption.objects.filter(option_type='priority', is_active=True)
        }
        admin_users = {u.email.lower(): u for u in User.objects.filter(role='admin', is_active=True)}

        # Get defaults
        default_status = TaskOption.objects.filter(option_type='status', is_default=True).first()
        if not default_status:
            default_status = TaskOption.objects.filter(option_type='status', is_active=True).first()

        created_count = 0
        updated_count = 0
        errors = []

        with transaction.atomic():
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                title = row.get('Title', '').strip()
                if not title:
                    errors.append(f'Row {row_num}: Title is required')
                    continue

                # Parse fields
                description = row.get('Description', '').strip()

                # Look up status (required)
                status_name = row.get('Status', '').strip().lower()
                task_status = statuses.get(status_name, default_status)

                # Look up type (optional)
                type_name = row.get('Type', '').strip().lower()
                task_type = types.get(type_name) if type_name else None

                # Look up priority (optional)
                priority_name = row.get('Priority', '').strip().lower()
                task_priority = priorities.get(priority_name) if priority_name else None

                # Look up assignee (optional)
                assignee_email = row.get('Assignee Email', '').strip().lower()
                assignee = admin_users.get(assignee_email) if assignee_email else None

                # Parse due date (optional)
                due_date = None
                due_date_str = row.get('Due Date', '').strip()
                if due_date_str:
                    try:
                        # Try ISO format first
                        due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00'))
                    except ValueError:
                        try:
                            # Try common formats
                            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
                                try:
                                    due_date = datetime.strptime(due_date_str, fmt)
                                    break
                                except ValueError:
                                    continue
                        except Exception:
                            errors.append(f'Row {row_num}: Invalid due date format "{due_date_str}"')

                # Check if updating existing task by ID
                task_id = row.get('ID', '').strip()
                if task_id and task_id.isdigit():
                    try:
                        task = Task.objects.get(id=int(task_id))
                        task.title = title
                        task.description = description
                        task.status = task_status
                        task.task_type = task_type
                        task.priority = task_priority
                        task.assignee = assignee
                        task.due_date = due_date
                        task.updated_by = request.user
                        task.save()
                        updated_count += 1
                    except Task.DoesNotExist:
                        errors.append(f'Row {row_num}: Task ID {task_id} not found')
                else:
                    # Create new task
                    # Get next order in status
                    max_order = (
                        Task.objects.filter(status=task_status).aggregate(max_order=models.Max('order_in_status'))[
                            'max_order'
                        ]
                        or 0
                    )

                    Task.objects.create(
                        title=title,
                        description=description,
                        status=task_status,
                        task_type=task_type,
                        priority=task_priority,
                        assignee=assignee,
                        due_date=due_date,
                        order_in_status=max_order + 1,
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    created_count += 1

        return Response(
            {
                'created': created_count,
                'updated': updated_count,
                'errors': errors[:20],  # Limit errors returned
                'total_errors': len(errors),
            }
        )

    @action(detail=False, methods=['get'])
    def csv_template(self, request):
        """Download a CSV template for importing tasks."""
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="task_import_template.csv"'

        writer = csv.writer(response)

        # Header row with all importable columns
        writer.writerow(
            [
                'Title',
                'Description',
                'Status',
                'Type',
                'Priority',
                'Assignee Email',
                'Due Date',
            ]
        )

        # Example row
        writer.writerow(
            [
                'Example Task Title',
                'Optional description of the task',
                'To Do',
                'Feature',
                'Medium',
                'admin@example.com',
                '2024-12-31',
            ]
        )

        return response


class TaskDashboardViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing saved dashboard configurations.
    Admin-only access.
    """

    queryset = TaskDashboard.objects.select_related('created_by')
    serializer_class = TaskDashboardSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        """Show shared dashboards and user's own private dashboards."""
        queryset = super().get_queryset()
        return queryset.filter(Q(is_shared=True) | Q(created_by=self.request.user))

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder dashboards."""
        order_list = request.data.get('order', [])

        if not order_list:
            return Response({'error': 'order list required'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for idx, dashboard_id in enumerate(order_list):
                TaskDashboard.objects.filter(id=dashboard_id).update(order=idx)

        return Response({'status': 'reordered'})


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for listing admin users.
    Used for assignee dropdowns.
    """

    queryset = User.objects.filter(role='admin', is_active=True)
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None  # Return all admins without pagination
