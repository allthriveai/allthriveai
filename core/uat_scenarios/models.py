from django.conf import settings
from django.db import models
from django.utils.text import slugify


class UATCategory(models.Model):
    """Category for grouping UAT scenarios (e.g., Auth, Projects, Chat, API)."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    color = models.CharField(max_length=50, default='slate', help_text='Tailwind color name')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'UAT Category'
        verbose_name_plural = 'UAT Categories'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class UATScenario(models.Model):
    """
    UAT Scenario - defines WHAT to test.
    Test runs track WHEN/WHO/RESULT of each test execution.
    """

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    title = models.CharField(max_length=255, help_text='Scenario name/title')
    description = models.TextField(blank=True, help_text='Test steps and expected behavior')
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        help_text='Priority level: low, medium, high, critical',
    )

    # Category for grouping
    category = models.ForeignKey(
        UATCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scenarios',
        help_text='Category for grouping scenarios',
    )

    # Ordering and status
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)

    # Link to task created from failed test run
    linked_task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uat_scenarios',
        help_text='Task created from a failed test run',
    )

    # Audit fields
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_uat_scenarios',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_uat_scenarios',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-created_at']
        verbose_name = 'UAT Scenario'
        verbose_name_plural = 'UAT Scenarios'
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['is_archived', '-created_at']),
            models.Index(fields=['category', 'order']),
        ]

    def __str__(self):
        return self.title

    @property
    def latest_test_run(self):
        """Get the most recent test run for this scenario."""
        return self.test_runs.first()

    @property
    def test_run_count(self):
        """Get the number of test runs for this scenario."""
        return self.test_runs.count()


class UATTestRun(models.Model):
    """
    A single test execution of a UAT scenario.
    Tracks when it was tested, by whom, and the result.
    """

    class Result(models.TextChoices):
        PASS = 'pass', 'Pass'
        FAIL = 'fail', 'Fail'
        NA = 'na', 'N/A'

    scenario = models.ForeignKey(
        UATScenario,
        on_delete=models.CASCADE,
        related_name='test_runs',
        help_text='The scenario that was tested',
    )
    date_tested = models.DateField(help_text='Date when the test was run')
    result = models.CharField(
        max_length=10,
        choices=Result.choices,
        help_text='Test result: pass/fail/na',
    )
    notes = models.TextField(blank=True, help_text='Notes or observations from this test run')
    tested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uat_test_runs',
        help_text='Admin who ran this test',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_tested', '-created_at']
        verbose_name = 'UAT Test Run'
        verbose_name_plural = 'UAT Test Runs'
        indexes = [
            models.Index(fields=['scenario', '-date_tested']),
            models.Index(fields=['result']),
            models.Index(fields=['tested_by', '-date_tested']),
            models.Index(fields=['-date_tested', '-created_at']),
        ]

    def __str__(self):
        return f'{self.scenario.title} - {self.date_tested} - {self.get_result_display()}'
