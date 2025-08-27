from django.db import models
from django.utils import timezone
from users.models import CustomUser

class ChatRoom(models.Model):
    ROOM_TYPES = [
        ('support', 'Crisis Support'),
        ('therapy', 'Therapy Session'),
        ('peer', 'Peer Support'),
        ('group', 'Group Chat'),
        ('ai', 'AI Assistant'),
    ]

    name = models.CharField(max_length=255)
    room_type = models.CharField(max_length=10, choices=ROOM_TYPES, default='support')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_private = models.BooleanField(default=True)
    max_participants = models.IntegerField(default=2)
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='created_rooms')
    participants = models.ManyToManyField(CustomUser, through='ChatParticipant', related_name='chat_rooms')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.get_room_type_display()})"

    @property
    def participant_count(self):
        return self.participants.count()

    def get_last_message(self):
        return self.messages.first()  # Since messages are ordered by -created_at

class ChatParticipant(models.Model):
    PARTICIPANT_ROLES = [
        ('user', 'User'),
        ('therapist', 'Therapist'),
        ('moderator', 'Moderator'),
        ('ai', 'AI Assistant'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=PARTICIPANT_ROLES, default='user')
    joined_at = models.DateTimeField(auto_now_add=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'room']

    def __str__(self):
        return f"{self.user.email} in {self.room.name}"

class Message(models.Model):
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('file', 'File'),
        ('audio', 'Audio'),
        ('system', 'System'),
        ('emergency', 'Emergency'),
    ]

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    content = models.TextField()
    file_attachment = models.FileField(upload_to='chat_files/', blank=True, null=True)
    image_attachment = models.ImageField(upload_to='chat_images/', blank=True, null=True)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    edited_at = models.DateTimeField(blank=True, null=True)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, blank=True, null=True, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender.email}: {self.content[:50]}..."

    def mark_as_edited(self):
        self.is_edited = True
        self.edited_at = timezone.now()
        self.save()

class MessageReaction(models.Model):
    REACTION_TYPES = [
        ('like', '👍'),
        ('love', '❤️'),
        ('support', '🤗'),
        ('helpful', '✅'),
        ('sad', '😢'),
        ('angry', '😠'),
    ]

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    reaction_type = models.CharField(max_length=10, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['message', 'user', 'reaction_type']

    def __str__(self):
        return f"{self.user.email} reacted {self.get_reaction_type_display()} to message"

class ChatSession(models.Model):
    SESSION_STATUS = [
        ('active', 'Active'),
        ('ended', 'Ended'),
        ('paused', 'Paused'),
    ]

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='sessions')
    participant = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=SESSION_STATUS, default='active')
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    session_notes = models.TextField(blank=True)
    rating = models.IntegerField(blank=True, null=True)  # 1-5 star rating
    feedback = models.TextField(blank=True)

    def __str__(self):
        return f"Session: {self.participant.email} in {self.room.name}"

    @property
    def duration(self):
        if self.ended_at:
            return self.ended_at - self.started_at
        return timezone.now() - self.started_at

class CrisisAlert(models.Model):
    SEVERITY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='crisis_alerts')
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, blank=True, null=True)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, blank=True, null=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_LEVELS, default='medium')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='active')
    alert_reason = models.TextField()
    location = models.CharField(max_length=255, blank=True)
    emergency_contacts_notified = models.BooleanField(default=False)
    responder = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, blank=True, null=True, related_name='handled_alerts')
    responded_at = models.DateTimeField(blank=True, null=True)
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Crisis Alert: {self.user.email} - {self.severity} ({self.status})"

class AIResponse(models.Model):
    RESPONSE_TYPES = [
        ('supportive', 'Supportive'),
        ('informational', 'Informational'),
        ('crisis_intervention', 'Crisis Intervention'),
        ('referral', 'Referral'),
        ('coping_strategy', 'Coping Strategy'),
    ]

    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='ai_response')
    response_type = models.CharField(max_length=20, choices=RESPONSE_TYPES, default='supportive')
    confidence_score = models.FloatField(default=0.0)  # 0.0 to 1.0
    sentiment_analysis = models.JSONField(default=dict)
    keywords_detected = models.JSONField(default=list)
    crisis_indicators = models.JSONField(default=list)
    suggested_resources = models.JSONField(default=list)
    escalation_recommended = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"AI Response to: {self.message.content[:30]}..."
