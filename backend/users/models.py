from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return self.email

class UserProfile(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
        ('P', 'Prefer not to say'),
    ]

    CRISIS_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True)
    location = models.CharField(max_length=100, blank=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=15, blank=True)
    therapist_name = models.CharField(max_length=100, blank=True)
    therapist_phone = models.CharField(max_length=15, blank=True)
    current_crisis_level = models.CharField(max_length=10, choices=CRISIS_LEVEL_CHOICES, default='low')
    last_mood_update = models.DateTimeField(blank=True, null=True)
    privacy_settings = models.JSONField(default=dict)
    notification_preferences = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - Profile"

class MoodEntry(models.Model):
    MOOD_CHOICES = [
        (1, 'Very Bad'),
        (2, 'Bad'), 
        (3, 'Okay'),
        (4, 'Good'),
        (5, 'Very Good'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='mood_entries')
    mood_level = models.IntegerField(choices=MOOD_CHOICES)
    notes = models.TextField(blank=True)
    energy_level = models.IntegerField(default=3)  # 1-5 scale
    anxiety_level = models.IntegerField(default=3)  # 1-5 scale
    sleep_hours = models.FloatField(blank=True, null=True)
    exercise_minutes = models.IntegerField(default=0)
    medication_taken = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - Mood: {self.get_mood_level_display()} ({self.created_at.date()})"

class Goal(models.Model):
    GOAL_CATEGORIES = [
        ('mental_health', 'Mental Health'),
        ('physical_health', 'Physical Health'),
        ('relationships', 'Relationships'),
        ('career', 'Career'),
        ('personal_growth', 'Personal Growth'),
        ('hobbies', 'Hobbies'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('paused', 'Paused'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='goals')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=GOAL_CATEGORIES, default='mental_health')
    target_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    progress_percentage = models.IntegerField(default=0)
    is_recurring = models.BooleanField(default=False)
    recurring_frequency = models.CharField(max_length=20, blank=True)  # daily, weekly, monthly
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.title}"

class JournalEntry(models.Model):
    MOOD_TAGS = [
        ('happy', 'Happy'),
        ('sad', 'Sad'),
        ('anxious', 'Anxious'),
        ('angry', 'Angry'),
        ('confused', 'Confused'),
        ('excited', 'Excited'),
        ('grateful', 'Grateful'),
        ('hopeful', 'Hopeful'),
        ('stressed', 'Stressed'),
        ('calm', 'Calm'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='journal_entries')
    title = models.CharField(max_length=200)
    content = models.TextField()
    mood_tags = models.JSONField(default=list)  # Store multiple mood tags
    is_private = models.BooleanField(default=True)
    word_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        self.word_count = len(self.content.split())
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} - {self.title} ({self.created_at.date()})"
