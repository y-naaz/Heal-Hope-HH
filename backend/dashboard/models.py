from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

class MoodEntry(models.Model):
    MOOD_CHOICES = [
        ('very-sad', 'Very Sad'),
        ('sad', 'Sad'), 
        ('neutral', 'Neutral'),
        ('good', 'Good'),
        ('very-good', 'Very Good'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_mood_entries')
    mood = models.CharField(max_length=20, choices=MOOD_CHOICES)
    score = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    note = models.TextField(blank=True)
    factors = models.JSONField(default=list, blank=True)  # List of factors that influenced mood
    date = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user.username} - {self.mood} on {self.date}"

class JournalEntry(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_journal_entries')
    title = models.CharField(max_length=200)
    content = models.TextField()
    mood = models.CharField(max_length=20, choices=MoodEntry.MOOD_CHOICES, blank=True)
    tags = models.JSONField(default=list, blank=True)  # List of tags
    word_count = models.PositiveIntegerField(default=0)
    is_private = models.BooleanField(default=True)
    date = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        # Calculate word count automatically
        self.word_count = len(self.content.split()) if self.content else 0
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"

class Goal(models.Model):
    GOAL_STATUS = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('paused', 'Paused'),
        ('archived', 'Archived'),
    ]
    
    GOAL_PRIORITY = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    
    GOAL_CATEGORY = [
        ('mindfulness', 'Mindfulness'),
        ('therapy', 'Therapy'),
        ('exercise', 'Exercise'),
        ('sleep', 'Sleep'),
        ('social', 'Social'),
        ('self-care', 'Self-care'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_goals')
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=GOAL_CATEGORY)
    target_value = models.PositiveIntegerField()
    current_value = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=50)  # days, sessions, hours, etc.
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=GOAL_STATUS, default='active')
    priority = models.CharField(max_length=10, choices=GOAL_PRIORITY, default='medium')
    reminders = models.BooleanField(default=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    @property
    def progress_percentage(self):
        return min((self.current_value / self.target_value) * 100, 100) if self.target_value > 0 else 0
    
    def save(self, *args, **kwargs):
        # Mark as completed if target reached
        if self.current_value >= self.target_value and self.status != 'completed':
            self.status = 'completed'
            self.completed_at = timezone.now()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"

class Activity(models.Model):
    ACTIVITY_TYPES = [
        ('mood', 'Mood Logged'),
        ('meditation', 'Meditation'),
        ('journal', 'Journal Entry'),
        ('goal', 'Goal Updated'),
        ('appointment', 'Appointment'),
        ('crisis', 'Crisis Support'),
        ('exercise', 'Exercise'),
        ('sleep', 'Sleep'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # Additional data specific to activity type
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Activities'
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"

class Appointment(models.Model):
    APPOINTMENT_STATUS = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('rescheduled', 'Rescheduled'),
        ('no_show', 'No Show'),
    ]
    
    APPOINTMENT_TYPE = [
        ('individual', 'Individual Therapy'),
        ('group', 'Group Therapy'),
        ('consultation', 'Initial Consultation'),
        ('followup', 'Follow-up Session'),
        ('crisis', 'Crisis Intervention'),
    ]
    
    SESSION_FORMAT = [
        ('video', 'Video Call'),
        ('phone', 'Phone Call'),
        ('in-person', 'In-Person'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_appointments')
    therapist_name = models.CharField(max_length=100)
    therapist_id = models.CharField(max_length=50, blank=True)  # For future therapist integration
    appointment_type = models.CharField(max_length=20, choices=APPOINTMENT_TYPE)
    session_format = models.CharField(max_length=20, choices=SESSION_FORMAT)
    date = models.DateField()
    time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=50)
    status = models.CharField(max_length=20, choices=APPOINTMENT_STATUS, default='scheduled')
    notes = models.TextField(blank=True)
    location = models.CharField(max_length=200, blank=True)  # For in-person appointments
    video_link = models.URLField(blank=True)  # For video appointments
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['date', 'time']
    
    def __str__(self):
        return f"{self.user.username} - {self.therapist_name} on {self.date}"

class UserSettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_settings')
    theme = models.CharField(max_length=20, default='light')
    notifications_enabled = models.BooleanField(default=True)
    mood_reminders = models.BooleanField(default=True)
    journal_reminders = models.BooleanField(default=True)
    goal_reminders = models.BooleanField(default=True)
    privacy_mode = models.BooleanField(default=False)
    data_sharing = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - Settings"

class MeditationSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_meditation_sessions')
    session_name = models.CharField(max_length=100)
    duration_minutes = models.PositiveIntegerField()
    completed = models.BooleanField(default=False)
    session_type = models.CharField(max_length=50, default='guided')  # guided, breathing, etc.
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.session_name} ({self.duration_minutes}min)"

class DashboardInsight(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dashboard_insights')
    insight_type = models.CharField(max_length=50)  # mood_trend, goal_progress, etc.
    title = models.CharField(max_length=200)
    description = models.TextField()
    icon = models.CharField(max_length=50, default='lightbulb')
    action_text = models.CharField(max_length=100, blank=True)
    action_url = models.CharField(max_length=200, blank=True)
    priority = models.IntegerField(default=1)  # Higher number = higher priority
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-priority', '-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"
