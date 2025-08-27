from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    ChatRoom, Message, ChatParticipant, CrisisAlert, 
    AIResponse, MessageReaction, ChatSession
)

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']

class ChatParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ChatParticipant
        fields = ['user', 'role', 'joined_at', 'is_online', 'last_seen']

class MessageReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = MessageReaction
        fields = ['user', 'reaction_type', 'created_at']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    reactions = MessageReactionSerializer(many=True, read_only=True)
    reply_to_message = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = [
            'id', 'content', 'sender', 'message_type', 'created_at', 
            'is_edited', 'edited_at', 'reply_to', 'reply_to_message',
            'reactions', 'file_attachment', 'image_attachment'
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'is_edited', 'edited_at']
    
    def get_reply_to_message(self, obj):
        if obj.reply_to:
            return {
                'id': obj.reply_to.id,
                'content': obj.reply_to.content[:100] + '...' if len(obj.reply_to.content) > 100 else obj.reply_to.content,
                'sender': obj.reply_to.sender.username
            }
        return None

class ChatRoomSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    participants = ChatParticipantSerializer(source='chatparticipant_set', many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    participant_count = serializers.ReadOnlyField()
    
    class Meta:
        model = ChatRoom
        fields = [
            'id', 'name', 'room_type', 'description', 'is_active', 
            'is_private', 'max_participants', 'created_by', 'participants',
            'participant_count', 'last_message', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_last_message(self, obj):
        last_message = obj.get_last_message()
        if last_message:
            return {
                'id': last_message.id,
                'content': last_message.content[:50] + '...' if len(last_message.content) > 50 else last_message.content,
                'sender': last_message.sender.username,
                'created_at': last_message.created_at
            }
        return None

class CrisisAlertSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    responder = UserSerializer(read_only=True)
    room = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = CrisisAlert
        fields = [
            'id', 'user', 'room', 'severity', 'status', 'alert_reason',
            'location', 'emergency_contacts_notified', 'responder',
            'responded_at', 'resolution_notes', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'responder', 'responded_at', 'created_at', 'updated_at'
        ]

class AIResponseSerializer(serializers.ModelSerializer):
    message = MessageSerializer(read_only=True)
    
    class Meta:
        model = AIResponse
        fields = [
            'id', 'message', 'response_type', 'confidence_score',
            'sentiment_analysis', 'keywords_detected', 'crisis_indicators',
            'suggested_resources', 'escalation_recommended', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class ChatSessionSerializer(serializers.ModelSerializer):
    participant = UserSerializer(read_only=True)
    room = ChatRoomSerializer(read_only=True)
    duration = serializers.ReadOnlyField()
    
    class Meta:
        model = ChatSession
        fields = [
            'id', 'room', 'participant', 'status', 'started_at', 
            'ended_at', 'session_notes', 'rating', 'feedback', 'duration'
        ]
        read_only_fields = ['id', 'participant', 'started_at']

# Specialized serializers for specific use cases

class ChatRoomListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing chat rooms"""
    participant_count = serializers.ReadOnlyField()
    last_message_preview = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatRoom
        fields = [
            'id', 'name', 'room_type', 'description', 'participant_count',
            'last_message_preview', 'user_role', 'updated_at'
        ]
    
    def get_last_message_preview(self, obj):
        last_message = obj.get_last_message()
        if last_message:
            return {
                'content': last_message.content[:30] + '...' if len(last_message.content) > 30 else last_message.content,
                'sender': last_message.sender.username,
                'created_at': last_message.created_at
            }
        return None
    
    def get_user_role(self, obj):
        request = self.context.get('request')
        if request and request.user:
            try:
                participant = ChatParticipant.objects.get(user=request.user, room=obj)
                return participant.role
            except ChatParticipant.DoesNotExist:
                pass
        return None

class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new messages"""
    
    class Meta:
        model = Message
        fields = ['content', 'message_type', 'reply_to', 'file_attachment', 'image_attachment']
    
    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Message content cannot be empty")
        if len(value) > 5000:
            raise serializers.ValidationError("Message content is too long (max 5000 characters)")
        return value

class CrisisAlertCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating crisis alerts"""
    
    class Meta:
        model = CrisisAlert
        fields = ['severity', 'alert_reason', 'location']
    
    def validate_severity(self, value):
        if value not in ['low', 'medium', 'high', 'critical']:
            raise serializers.ValidationError("Invalid severity level")
        return value

class UserProfileSerializer(serializers.ModelSerializer):
    """Extended user serializer with profile information"""
    profile = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']
    
    def get_profile(self, obj):
        if hasattr(obj, 'profile'):
            return {
                'bio': obj.profile.bio,
                'gender': obj.profile.gender,
                'location': obj.profile.location,
                'current_crisis_level': obj.profile.current_crisis_level,
                'last_mood_update': obj.profile.last_mood_update
            }
        return None

# WebSocket message serializers for real-time communication

class WSMessageSerializer(serializers.Serializer):
    """Serializer for WebSocket messages"""
    type = serializers.CharField()
    message = serializers.CharField(required=False)
    room_name = serializers.CharField(required=False)
    reply_to = serializers.IntegerField(required=False)
    message_id = serializers.IntegerField(required=False)
    reaction_type = serializers.CharField(required=False)
    is_typing = serializers.BooleanField(required=False)
    new_content = serializers.CharField(required=False)

class WSChatMessageSerializer(serializers.Serializer):
    """Serializer for chat messages sent via WebSocket"""
    id = serializers.IntegerField()
    content = serializers.CharField()
    sender = UserSerializer()
    message_type = serializers.CharField()
    created_at = serializers.DateTimeField()
    is_edited = serializers.BooleanField()
    edited_at = serializers.DateTimeField(allow_null=True)
    reply_to = serializers.IntegerField(allow_null=True)

class WSTypingIndicatorSerializer(serializers.Serializer):
    """Serializer for typing indicators"""
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    is_typing = serializers.BooleanField()

class WSRoomInfoSerializer(serializers.Serializer):
    """Serializer for room information sent via WebSocket"""
    room = serializers.DictField()
    participants = serializers.ListField()

class WSCrisisAlertSerializer(serializers.Serializer):
    """Serializer for crisis alerts sent via WebSocket"""
    alert = serializers.DictField()
    severity = serializers.CharField()
    resources = serializers.ListField()

class WSAIResponseSerializer(serializers.Serializer):
    """Serializer for AI responses sent via WebSocket"""
    message = WSChatMessageSerializer()
    response_type = serializers.CharField()
    confidence = serializers.FloatField()

# Statistics and analytics serializers

class ChatAnalyticsSerializer(serializers.Serializer):
    """Serializer for chat analytics data"""
    total_messages = serializers.IntegerField()
    total_participants = serializers.IntegerField()
    crisis_alerts_count = serializers.IntegerField()
    ai_responses_count = serializers.IntegerField()
    average_response_time = serializers.FloatField()
    most_active_hours = serializers.ListField()
    sentiment_distribution = serializers.DictField()

class UserChatStatsSerializer(serializers.Serializer):
    """Serializer for user-specific chat statistics"""
    messages_sent = serializers.IntegerField()
    rooms_joined = serializers.IntegerField()
    crisis_alerts_created = serializers.IntegerField()
    average_session_duration = serializers.FloatField()
    most_used_reactions = serializers.ListField()
    mood_correlation = serializers.DictField()
