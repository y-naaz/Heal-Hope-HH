from rest_framework import serializers
from .models import (
    MoodEntry, JournalEntry, Goal, Activity, Appointment, 
    UserSettings, MeditationSession, DashboardInsight
)

class MoodEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodEntry
        fields = ['id', 'mood', 'score', 'note', 'factors', 'date', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = ['id', 'title', 'content', 'mood', 'tags', 'word_count', 'is_private', 'date', 'created_at', 'updated_at']
        read_only_fields = ['id', 'word_count', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class GoalSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.ReadOnlyField()
    
    class Meta:
        model = Goal
        fields = [
            'id', 'title', 'description', 'category', 'target_value', 'current_value', 
            'unit', 'start_date', 'end_date', 'status', 'priority', 'reminders', 
            'progress_percentage', 'completed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'progress_percentage', 'completed_at', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ['id', 'activity_type', 'title', 'description', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = [
            'id', 'therapist_name', 'therapist_id', 'appointment_type', 'session_format',
            'date', 'time', 'duration_minutes', 'status', 'notes', 'location', 
            'video_link', 'reminder_sent', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'reminder_sent', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = [
            'theme', 'notifications_enabled', 'mood_reminders', 'journal_reminders',
            'goal_reminders', 'privacy_mode', 'data_sharing', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

class MeditationSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeditationSession
        fields = ['id', 'session_name', 'duration_minutes', 'completed', 'session_type', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class DashboardInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardInsight
        fields = [
            'id', 'insight_type', 'title', 'description', 'icon', 'action_text',
            'action_url', 'priority', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

# Analytics and Summary Serializers
class MoodAnalyticsSerializer(serializers.Serializer):
    average_score = serializers.FloatField()
    most_common_mood = serializers.CharField()
    weekly_improvement = serializers.FloatField()
    total_entries = serializers.IntegerField()
    mood_distribution = serializers.DictField()
    recent_trend = serializers.CharField()

class DashboardStatsSerializer(serializers.Serializer):
    today_mood = serializers.CharField(allow_null=True)
    meditation_streak = serializers.IntegerField()
    goals_completed = serializers.IntegerField()
    goals_active = serializers.IntegerField()
    journal_entries_count = serializers.IntegerField()
    next_appointment = serializers.DictField(allow_null=True)
    weekly_goals_progress = serializers.FloatField()

class RecentActivitySerializer(serializers.Serializer):
    activity_type = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    icon = serializers.CharField()
    timestamp = serializers.DateTimeField()
    metadata = serializers.DictField()
