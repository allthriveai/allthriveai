from django.contrib import admin

from .models import UATCategory, UATScenario, UATTestRun


@admin.register(UATCategory)
class UATCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'color', 'order', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'slug']
    ordering = ['order', 'name']
    prepopulated_fields = {'slug': ('name',)}


class UATTestRunInline(admin.TabularInline):
    model = UATTestRun
    extra = 0
    readonly_fields = ['created_at']
    ordering = ['-date_tested', '-created_at']


@admin.register(UATScenario)
class UATScenarioAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'category',
        'test_run_count',
        'latest_result',
        'order',
        'is_archived',
        'created_at',
    ]
    list_filter = ['category', 'is_archived']
    search_fields = ['title', 'description']
    ordering = ['order', '-created_at']
    date_hierarchy = 'created_at'
    raw_id_fields = ['created_by', 'updated_by', 'linked_task']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [UATTestRunInline]

    @admin.display(description='Test Runs')
    def test_run_count(self, obj):
        return obj.test_run_count

    @admin.display(description='Latest Result')
    def latest_result(self, obj):
        latest = obj.latest_test_run
        if latest:
            return f'{latest.get_result_display()} ({latest.date_tested})'
        return '-'


@admin.register(UATTestRun)
class UATTestRunAdmin(admin.ModelAdmin):
    list_display = [
        'scenario',
        'date_tested',
        'result',
        'tested_by',
        'created_at',
    ]
    list_filter = ['result', 'date_tested', 'tested_by']
    search_fields = ['scenario__title', 'notes']
    ordering = ['-date_tested', '-created_at']
    date_hierarchy = 'date_tested'
    raw_id_fields = ['scenario', 'tested_by']
    readonly_fields = ['created_at']
