"""
Celery tasks for admin task reminders.
"""

from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone


@shared_task
def send_task_due_reminders():
    """
    Send email reminders for tasks due within the next 24 hours.
    Only sends if:
    - Task has a due date within 24 hours
    - Task is not completed
    - Task has not had a reminder sent in the last 24 hours
    - Task has an assignee
    """
    from .models import Task

    now = timezone.now()
    reminder_window = now + timedelta(hours=24)
    reminder_cooldown = now - timedelta(hours=24)

    # Get tasks due soon that need reminders
    tasks_due_soon = (
        Task.objects.filter(
            due_date__lte=reminder_window,
            due_date__gt=now,
            completed_at__isnull=True,
            is_archived=False,
            assignee__isnull=False,
        )
        .exclude(last_reminder_sent_at__gte=reminder_cooldown)
        .select_related('assignee', 'status')
    )

    reminder_count = 0
    task_ids_to_update = []

    for task in tasks_due_soon:
        if not task.assignee or not task.assignee.email:
            continue

        # Calculate hours until due
        hours_until_due = (task.due_date - now).total_seconds() / 3600

        try:
            # Send email
            subject = f'[AllThrive] Task due soon: {task.title}'

            context = {
                'task': task,
                'hours_until_due': int(hours_until_due),
                'assignee_name': task.assignee.first_name or task.assignee.username,
                'task_url': f'{settings.FRONTEND_URL}/admin/tasks',
            }

            html_message = render_to_string('tasks/email/task_due_reminder.html', context)
            plain_message = (
                f"Hi {context['assignee_name']},\n\n"
                f"Your task \"{task.title}\" is due in {context['hours_until_due']} hours.\n\n"
                f"View your tasks: {context['task_url']}\n\n"
                f"- AllThrive Team"
            )

            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[task.assignee.email],
                html_message=html_message,
                fail_silently=False,
            )

            task_ids_to_update.append(task.id)
            reminder_count += 1

        except Exception as e:
            print(f'Failed to send reminder for task {task.id}: {e}')

    # Bulk update the reminder timestamps
    if task_ids_to_update:
        Task.objects.filter(id__in=task_ids_to_update).update(last_reminder_sent_at=now)

    return f'Sent {reminder_count} task due reminders'


@shared_task
def send_overdue_task_notifications():
    """
    Send notifications for tasks that are now overdue.
    Runs daily to catch tasks that have passed their due date.
    """
    from .models import Task

    now = timezone.now()
    yesterday = now - timedelta(days=1)

    # Get tasks that became overdue in the last 24 hours
    newly_overdue = Task.objects.filter(
        due_date__lte=now,
        due_date__gt=yesterday,
        completed_at__isnull=True,
        is_archived=False,
        assignee__isnull=False,
    ).select_related('assignee', 'status')

    notification_count = 0

    for task in newly_overdue:
        if not task.assignee or not task.assignee.email:
            continue

        try:
            subject = f'[AllThrive] Task overdue: {task.title}'

            context = {
                'task': task,
                'assignee_name': task.assignee.first_name or task.assignee.username,
                'task_url': f'{settings.FRONTEND_URL}/admin/tasks',
            }

            plain_message = (
                f"Hi {context['assignee_name']},\n\n"
                f"Your task \"{task.title}\" is now overdue.\n\n"
                f"Due date was: {task.due_date.strftime('%B %d, %Y at %I:%M %p')}\n\n"
                f"View your tasks: {context['task_url']}\n\n"
                f"- AllThrive Team"
            )

            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[task.assignee.email],
                fail_silently=False,
            )

            notification_count += 1

        except Exception as e:
            print(f'Failed to send overdue notification for task {task.id}: {e}')

    return f'Sent {notification_count} overdue task notifications'
