from django.contrib import admin
from .models import (
    MoodEntry, JournalEntry, Goal, Activity, Appointment, 
    UserSettings, MeditationSession, DashboardInsight
)

@admin.register(MoodEntry)
class MoodEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'mood', 'score', 'date', 'created_at')
    list_filter = ('mood', 'date', 'created_at')
    search_fields = ('user__username', 'note')
    ordering = ('-date',)

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'mood', 'word_count', 'date', 'is_private')
    list_filter = ('mood', 'is_private', 'date', 'created_at')
    search_fields = ('user__username', 'title', 'content')
    ordering = ('-created_at',)

@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'category', 'status', 'progress_percentage', 'target_value', 'current_value')
    list_filter = ('status', 'category', 'priority', 'created_at')
    search_fields = ('user__username', 'title', 'description')
    ordering = ('-created_at',)

@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'activity_type', 'created_at')
    list_filter = ('activity_type', 'created_at')
    search_fields = ('user__username', 'title', 'description')
    ordering = ('-created_at',)

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'therapist_name', 'appointment_type', 'date', 'time', 'status')
    list_filter = ('status', 'appointment_type', 'session_format', 'date')
    search_fields = ('user__username', 'therapist_name', 'notes')
    ordering = ('date', 'time')

@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ('user', 'theme', 'notifications_enabled', 'privacy_mode')
    list_filter = ('theme', 'notifications_enabled', 'privacy_mode')
    search_fields = ('user__username',)

@admin.register(MeditationSession)
class MeditationSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'session_name', 'duration_minutes', 'completed', 'session_type', 'created_at')
    list_filter = ('completed', 'session_type', 'created_at')
    search_fields = ('user__username', 'session_name')
    ordering = ('-created_at',)

@admin.register(DashboardInsight)
class DashboardInsightAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'insight_type', 'priority', 'is_active', 'created_at')
    list_filter = ('insight_type', 'priority', 'is_active', 'created_at')
    search_fields = ('user__username', 'title', 'description')
    ordering = ('-priority', '-created_at')
