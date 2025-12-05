"""Django admin configuration for Events app."""

from dateutil.relativedelta import relativedelta
from django import forms
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import Event, EventRSVP


class EventAdminForm(forms.ModelForm):
    """Custom form for Event admin with recurring event support."""

    create_recurring = forms.BooleanField(
        required=False, initial=False, help_text='Create multiple monthly recurring events'
    )
    num_months = forms.IntegerField(
        required=False,
        initial=12,
        min_value=1,
        max_value=24,
        help_text='Number of months to create recurring events (1-24)',
    )

    class Meta:
        model = Event
        fields = [
            'title',
            'description',
            'start_date',
            'end_date',
            'is_all_day',
            'timezone_name',
            'location',
            'event_url',
            'color',
            'thumbnail',
            'is_published',
            'create_recurring',
            'num_months',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only show recurring options for new events
        if self.instance.pk:
            self.fields['create_recurring'].widget = forms.HiddenInput()
            self.fields['num_months'].widget = forms.HiddenInput()


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    """Admin interface for Event model."""

    form = EventAdminForm
    list_display = [
        'title',
        'colored_status',
        'start_date',
        'end_date',
        'location',
        'is_published',
        'created_by',
        'updated_at',
    ]
    list_filter = [
        'is_published',
        'is_all_day',
        'start_date',
        'created_at',
    ]
    search_fields = [
        'title',
        'description',
        'location',
    ]
    readonly_fields = [
        'created_at',
        'updated_at',
        'created_by',
        'updated_by',
        'status_display',
    ]
    fieldsets = (
        (
            'Event Details',
            {
                'fields': (
                    'title',
                    'description',
                    'status_display',
                )
            },
        ),
        (
            'Date & Time',
            {
                'fields': (
                    'start_date',
                    'end_date',
                    'is_all_day',
                    'timezone_name',
                )
            },
        ),
        (
            'Recurring Events',
            {
                'classes': ('collapse',),
                'fields': (
                    'create_recurring',
                    'num_months',
                ),
                'description': (
                    'Create multiple monthly recurring events (e.g., monthly Zoom meetings). '
                    'This only appears when creating a new event.'
                ),
            },
        ),
        (
            'Location & Links',
            {
                'fields': (
                    'location',
                    'event_url',
                )
            },
        ),
        (
            'Visual',
            {
                'fields': (
                    'color',
                    'thumbnail',
                )
            },
        ),
        ('Publishing', {'fields': ('is_published',)}),
        (
            'Metadata',
            {
                'classes': ('collapse',),
                'fields': (
                    'created_by',
                    'updated_by',
                    'created_at',
                    'updated_at',
                ),
            },
        ),
    )
    date_hierarchy = 'start_date'
    ordering = ['-start_date']
    list_per_page = 25

    @admin.display(description='Status')
    def colored_status(self, obj):
        """Display event status with color coding."""
        if obj.is_ongoing:
            return format_html('<span style="color: #22c55e; font-weight: bold;">● Ongoing</span>')
        elif obj.is_upcoming:
            return format_html('<span style="color: #3b82f6; font-weight: bold;">○ Upcoming</span>')
        else:
            return format_html('<span style="color: #94a3b8;">◌ Past</span>')

    @admin.display(description='Event Status')
    def status_display(self, obj):
        """Display detailed status information."""
        now = timezone.now()
        if obj.is_ongoing:
            return format_html(
                '<div style="padding: 10px; background-color: #dcfce7; border-left: 4px solid #22c55e; '
                'border-radius: 4px;">'
                '<strong style="color: #16a34a;">Event is currently ongoing</strong><br>'
                '<span style="color: #166534; font-size: 12px;">Started: {} • Ends: {}</span>'
                '</div>',
                obj.start_date.strftime('%b %d, %Y at %I:%M %p'),
                obj.end_date.strftime('%b %d, %Y at %I:%M %p'),
            )
        elif obj.is_upcoming:
            days_until = (obj.start_date - now).days
            return format_html(
                '<div style="padding: 10px; background-color: #dbeafe; border-left: 4px solid #3b82f6; '
                'border-radius: 4px;">'
                '<strong style="color: #1d4ed8;">Upcoming event</strong><br>'
                '<span style="color: #1e40af; font-size: 12px;">Starts in {} days on {}</span>'
                '</div>',
                days_until,
                obj.start_date.strftime('%b %d, %Y at %I:%M %p'),
            )
        else:
            days_ago = (now - obj.end_date).days
            return format_html(
                '<div style="padding: 10px; background-color: #f1f5f9; border-left: 4px solid #94a3b8; '
                'border-radius: 4px;">'
                '<strong style="color: #64748b;">Past event</strong><br>'
                '<span style="color: #475569; font-size: 12px;">Ended {} days ago on {}</span>'
                '</div>',
                days_ago,
                obj.end_date.strftime('%b %d, %Y at %I:%M %p'),
            )

    def save_model(self, request, obj, form, change):
        """Set created_by and updated_by fields, and handle recurring events."""
        if not change:
            # New object
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

        # Handle recurring events (only for new events)
        if not change and form.cleaned_data.get('create_recurring'):
            num_months = form.cleaned_data.get('num_months', 12)
            self._create_recurring_events(obj, num_months, request.user, request)

    def _create_recurring_events(self, base_event, num_months, user, request):
        """Create recurring monthly events based on the base event."""
        from django.contrib import messages

        events_created = []

        # Calculate the duration of the event
        event_duration = base_event.end_date - base_event.start_date

        # Create events for the next N months
        for month_offset in range(1, num_months):
            # Calculate new start date (same day of month, next months)
            new_start = base_event.start_date + relativedelta(months=month_offset)
            new_end = new_start + event_duration

            # Create the recurring event
            recurring_event = Event.objects.create(
                title=base_event.title,
                description=base_event.description,
                start_date=new_start,
                end_date=new_end,
                location=base_event.location,
                event_url=base_event.event_url,
                is_all_day=base_event.is_all_day,
                color=base_event.color,
                thumbnail=base_event.thumbnail,
                timezone_name=base_event.timezone_name,
                is_published=base_event.is_published,
                created_by=user,
                updated_by=user,
            )
            events_created.append(recurring_event)

        # Show success message
        if events_created:
            self.message_user(
                request,
                (
                    f'✓ Successfully created {len(events_created)} recurring monthly events! '
                    f'Total events: {num_months} (including the original).'
                ),
                messages.SUCCESS,
            )

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('created_by', 'updated_by')


@admin.register(EventRSVP)
class EventRSVPAdmin(admin.ModelAdmin):
    """Admin interface for EventRSVP model."""

    list_display = ['user', 'event', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__username', 'user__email', 'event__title']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['user', 'event']

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('user', 'event')
