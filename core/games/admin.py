"""Admin configuration for the games app."""

from django.contrib import admin

from core.games.models import GameScore


@admin.register(GameScore)
class GameScoreAdmin(admin.ModelAdmin):
    """Admin for game scores."""

    list_display = ['user', 'game', 'score', 'created_at']
    list_filter = ['game', 'created_at']
    search_fields = ['user__username', 'user__email']
    ordering = ['-score', '-created_at']
    readonly_fields = ['created_at']
