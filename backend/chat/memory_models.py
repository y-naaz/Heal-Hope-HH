from django.db import models
from django.utils import timezone
from users.models import CustomUser
from chat.models import ChatRoom, Message
import json

class UserMemory(models.Model):
    """Store user-specific memory for personalized AI responses"""
    
    MEMORY_TYPES = [
        ('preference', 'User Preference'),
        ('personal_info', 'Personal Information'),
        ('mood_pattern', 'Mood Pattern'),
        ('trigger', 'Trigger Information'),
        ('coping_strategy', 'Effective Coping Strategy'),
        ('goal', 'Personal Goal'),
        ('progress', 'Progress Update'),
        ('session_note', 'Session Note'),
    ]
    
    IMPORTANCE_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='memories')
    memory_type = models.CharField(max_length=20, choices=MEMORY_TYPES)
    content = models.TextField()
    context = models.JSONField(default=dict)  # Additional context data
    importance = models.CharField(max_length=10, choices=IMPORTANCE_LEVELS, default='medium')
    
    # Memory metadata
    source_message = models.ForeignKey(Message, on_delete=models.SET_NULL, null=True, blank=True)
    session_id = models.CharField(max_length=100, blank=True)  # For grouping related memories
    
    # Temporal information
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)  # For temporary memories
    last_accessed = models.DateTimeField(auto_now=True)
    access_count = models.IntegerField(default=0)
    
    # Memory validity
    is_active = models.BooleanField(default=True)
    confidence_score = models.FloatField(default=1.0)  # 0.0 to 1.0
    
    # Vector embedding for similarity search
    embedding_id = models.CharField(max_length=100, blank=True)  # Reference to vector DB
    
    class Meta:
        ordering = ['-importance', '-created_at']
        indexes = [
            models.Index(fields=['user', 'memory_type']),
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['created_at']),
            models.Index(fields=['importance']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.get_memory_type_display()}: {self.content[:50]}..."
    
    def increment_access(self):
        """Increment access count and update last accessed time"""
        self.access_count += 1
        self.last_accessed = timezone.now()
        self.save(update_fields=['access_count', 'last_accessed'])
    
    def is_expired(self):
        """Check if memory has expired"""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False

class ConversationMemory(models.Model):
    """Store conversation-level memory for context retention"""
    
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='conversation_memories')
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='conversation_memories')
    
    # Conversation summary and key points
    summary = models.TextField()
    key_topics = models.JSONField(default=list)  # List of main topics discussed
    emotional_state = models.JSONField(default=dict)  # User's emotional journey
    mentioned_concerns = models.JSONField(default=list)  # Specific concerns raised
    suggested_resources = models.JSONField(default=list)  # Resources provided
    
    # Conversation metadata
    message_count = models.IntegerField(default=0)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    session_quality = models.CharField(max_length=20, blank=True)  # productive, challenging, crisis, etc.
    
    # Follow-up information
    needs_followup = models.BooleanField(default=False)
    followup_notes = models.TextField(blank=True)
    next_check_in = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['room']),
            models.Index(fields=['needs_followup']),
        ]
    
    def __str__(self):
        return f"Conversation: {self.user.email} - {self.start_time.strftime('%Y-%m-%d %H:%M')}"

class VectorMemory(models.Model):
    """Store vector embeddings for RAG functionality"""
    
    CONTENT_TYPES = [
        ('message', 'Chat Message'),
        ('document', 'Knowledge Document'),
        ('resource', 'Mental Health Resource'),
        ('strategy', 'Coping Strategy'),
        ('memory', 'User Memory'),
    ]
    
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES)
    content_id = models.CharField(max_length=100)  # ID of the source content
    content_text = models.TextField()
    
    # Vector information
    vector_id = models.CharField(max_length=100, unique=True)  # ID in vector database
    collection_name = models.CharField(max_length=100)  # Collection in vector DB
    
    # Metadata for filtering
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True)
    tags = models.JSONField(default=list)
    metadata = models.JSONField(default=dict)
    
    # Quality metrics
    embedding_quality = models.FloatField(default=1.0)
    usage_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['content_type', 'user']),
            models.Index(fields=['collection_name']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.get_content_type_display()}: {self.content_text[:50]}..."

class KnowledgeBase(models.Model):
    """Store curated mental health knowledge for RAG"""
    
    KNOWLEDGE_TYPES = [
        ('technique', 'Coping Technique'),
        ('information', 'Educational Information'),
        ('resource', 'Resource/Referral'),
        ('crisis_response', 'Crisis Response'),
        ('therapy_note', 'Therapy Notes'),
        ('research', 'Research Finding'),
    ]
    
    DIFFICULTY_LEVELS = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]
    
    title = models.CharField(max_length=200)
    content = models.TextField()
    knowledge_type = models.CharField(max_length=20, choices=KNOWLEDGE_TYPES)
    
    # Categorization
    topics = models.JSONField(default=list)  # ['anxiety', 'depression', 'coping']
    difficulty_level = models.CharField(max_length=15, choices=DIFFICULTY_LEVELS, default='beginner')
    target_conditions = models.JSONField(default=list)  # Mental health conditions this applies to
    
    # Content metadata
    source = models.CharField(max_length=200, blank=True)  # Source of information
    author = models.CharField(max_length=100, blank=True)
    is_evidence_based = models.BooleanField(default=True)
    effectiveness_rating = models.FloatField(default=0.0)  # 0-10 rating
    
    # Usage tracking
    usage_count = models.IntegerField(default=0)
    positive_feedback = models.IntegerField(default=0)
    negative_feedback = models.IntegerField(default=0)
    
    # Vector reference
    vector_id = models.CharField(max_length=100, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-effectiveness_rating', '-usage_count']
        indexes = [
            models.Index(fields=['knowledge_type', 'is_active']),
            models.Index(fields=['effectiveness_rating']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.get_knowledge_type_display()})"
    
    def get_effectiveness_score(self):
        """Calculate effectiveness score based on usage and feedback"""
        if self.usage_count == 0:
            return self.effectiveness_rating
        
        feedback_ratio = (self.positive_feedback - self.negative_feedback) / self.usage_count
        return (self.effectiveness_rating + feedback_ratio * 5) / 2

class MemoryInteraction(models.Model):
    """Track how memories are used and their effectiveness"""
    
    memory = models.ForeignKey(UserMemory, on_delete=models.CASCADE, related_name='interactions')
    message = models.ForeignKey(Message, on_delete=models.CASCADE)
    
    # How the memory was used
    retrieval_score = models.FloatField()  # Similarity score when retrieved
    was_helpful = models.BooleanField(null=True, blank=True)  # User feedback
    response_quality = models.FloatField(null=True, blank=True)  # AI response quality
    
    # Context of usage
    query_text = models.TextField()  # What was being searched for
    context_type = models.CharField(max_length=50)  # crisis, support, general, etc.
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['memory', 'created_at']),
        ]
    
    def __str__(self):
        return f"Memory interaction: {self.memory_id} - Score: {self.retrieval_score}"

class PersonalizationProfile(models.Model):
    """Store user's personalization preferences and learned patterns"""
    
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='personalization_profile')
    
    # Communication preferences
    preferred_tone = models.CharField(max_length=20, default='supportive')  # supportive, professional, casual
    response_length = models.CharField(max_length=20, default='medium')  # brief, medium, detailed
    crisis_sensitivity = models.CharField(max_length=20, default='high')  # low, medium, high
    
    # Learned patterns
    effective_strategies = models.JSONField(default=list)  # What works for this user
    trigger_patterns = models.JSONField(default=list)  # Common triggers
    mood_patterns = models.JSONField(default=dict)  # Mood trends and patterns
    interaction_patterns = models.JSONField(default=dict)  # How user typically interacts
    
    # Personalization settings
    memory_retention_days = models.IntegerField(default=90)  # How long to keep memories
    enable_proactive_suggestions = models.BooleanField(default=True)
    enable_mood_predictions = models.BooleanField(default=True)
    
    # Learning metrics
    adaptation_score = models.FloatField(default=0.5)  # How well AI has adapted to user
    interaction_count = models.IntegerField(default=0)
    last_pattern_update = models.DateTimeField(auto_now_add=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Personalization Profile: {self.user.email}"
    
    def update_patterns(self):
        """Update learned patterns based on recent interactions"""
        # This would contain logic to analyze recent interactions and update patterns
        self.last_pattern_update = timezone.now()
        self.save()
