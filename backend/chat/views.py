from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from .models import ChatRoom, Message, ChatParticipant, CrisisAlert, AIResponse
from .serializers import (
    ChatRoomSerializer, MessageSerializer, CrisisAlertSerializer,
    ChatParticipantSerializer
)
from .ai_support import get_ai_response, detect_crisis_keywords, get_emergency_resources, get_support_resources

User = get_user_model()

class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return chat rooms where user is a participant"""
        return ChatRoom.objects.filter(
            participants=self.request.user
        ).order_by('-updated_at')

    def perform_create(self, serializer):
        """Create a new chat room with the current user as creator"""
        chat_room = serializer.save(created_by=self.request.user)
        # Add creator as participant
        ChatParticipant.objects.create(
            user=self.request.user,
            room=chat_room,
            role='user'
        )

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a chat room"""
        room = self.get_object()
        participant, created = ChatParticipant.objects.get_or_create(
            user=request.user,
            room=room,
            defaults={'role': 'user'}
        )
        
        if created:
            return Response({
                'message': 'Successfully joined the room',
                'participant': ChatParticipantSerializer(participant).data
            })
        else:
            return Response({
                'message': 'Already a member of this room',
                'participant': ChatParticipantSerializer(participant).data
            })

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave a chat room"""
        room = self.get_object()
        try:
            participant = ChatParticipant.objects.get(user=request.user, room=room)
            participant.delete()
            return Response({'message': 'Successfully left the room'})
        except ChatParticipant.DoesNotExist:
            return Response(
                {'error': 'You are not a member of this room'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages for a specific room"""
        room = self.get_object()
        
        # Check if user is participant
        if not ChatParticipant.objects.filter(user=request.user, room=room).exists():
            return Response(
                {'error': 'You are not a member of this room'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        messages = Message.objects.filter(room=room, is_deleted=False).order_by('-created_at')
        
        # Pagination
        page_size = int(request.query_params.get('page_size', 50))
        offset = int(request.query_params.get('offset', 0))
        
        paginated_messages = messages[offset:offset + page_size]
        serialized_messages = MessageSerializer(paginated_messages, many=True).data
        
        return Response({
            'messages': serialized_messages,
            'total_count': messages.count(),
            'has_more': messages.count() > offset + page_size
        })

    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):
        """Get participants for a specific room"""
        room = self.get_object()
        participants = ChatParticipant.objects.filter(room=room)
        serializer = ChatParticipantSerializer(participants, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def create_support_room(self, request):
        """Create a crisis support room for the current user"""
        room_name = f"support_{request.user.id}"
        
        # Check if support room already exists
        existing_room = ChatRoom.objects.filter(
            name=room_name,
            room_type='support'
        ).first()
        
        if existing_room:
            return Response({
                'message': 'Support room already exists',
                'room': ChatRoomSerializer(existing_room).data
            })
        
        # Create new support room
        room = ChatRoom.objects.create(
            name=room_name,
            room_type='support',
            description=f'Crisis support for {request.user.username}',
            created_by=request.user,
            is_private=True
        )
        
        # Add user as participant
        ChatParticipant.objects.create(
            user=request.user,
            room=room,
            role='user'
        )
        
        return Response({
            'message': 'Support room created successfully',
            'room': ChatRoomSerializer(room).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def create_ai_room(self, request):
        """Create an AI assistant room for the current user"""
        room_name = f"ai_{request.user.id}"
        
        # Check if AI room already exists
        existing_room = ChatRoom.objects.filter(
            name=room_name,
            room_type='ai'
        ).first()
        
        if existing_room:
            return Response({
                'message': 'AI room already exists',
                'room': ChatRoomSerializer(existing_room).data
            })
        
        # Create new AI room
        room = ChatRoom.objects.create(
            name=room_name,
            room_type='ai',
            description=f'AI Assistant for {request.user.username}',
            created_by=request.user,
            is_private=True
        )
        
        # Add user as participant
        ChatParticipant.objects.create(
            user=request.user,
            room=room,
            role='user'
        )
        
        # Add AI assistant as participant
        ai_user, created = User.objects.get_or_create(
            username='ai_assistant',
            defaults={
                'email': 'ai@mentalhealth.com',
                'first_name': 'AI',
                'last_name': 'Assistant'
            }
        )
        
        ChatParticipant.objects.create(
            user=ai_user,
            room=room,
            role='ai'
        )
        
        return Response({
            'message': 'AI room created successfully',
            'room': ChatRoomSerializer(room).data
        }, status=status.HTTP_201_CREATED)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return messages from rooms where user is a participant"""
        user_rooms = ChatRoom.objects.filter(participants=self.request.user)
        return Message.objects.filter(
            room__in=user_rooms,
            is_deleted=False
        ).order_by('-created_at')

    def perform_create(self, serializer):
        """Create a new message"""
        message = serializer.save(sender=self.request.user)
        
        # Check for crisis keywords
        crisis_keywords = detect_crisis_keywords(message.content)
        if crisis_keywords:
            # Create crisis alert
            CrisisAlert.objects.create(
                user=self.request.user,
                room=message.room,
                message=message,
                severity='high' if any(word in message.content.lower() 
                                     for word in ['suicide', 'kill', 'die']) else 'medium',
                alert_reason=f"Crisis keywords detected: {', '.join(crisis_keywords)}"
            )

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        """Add a reaction to a message"""
        message = self.get_object()
        reaction_type = request.data.get('reaction_type')
        
        if not reaction_type:
            return Response(
                {'error': 'reaction_type is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .models import MessageReaction
        reaction, created = MessageReaction.objects.get_or_create(
            message=message,
            user=request.user,
            reaction_type=reaction_type
        )
        
        return Response({
            'message': 'Reaction added' if created else 'Reaction already exists',
            'reaction_type': reaction_type
        })

    @action(detail=True, methods=['delete'])
    def unreact(self, request, pk=None):
        """Remove a reaction from a message"""
        message = self.get_object()
        reaction_type = request.data.get('reaction_type')
        
        from .models import MessageReaction
        try:
            reaction = MessageReaction.objects.get(
                message=message,
                user=request.user,
                reaction_type=reaction_type
            )
            reaction.delete()
            return Response({'message': 'Reaction removed'})
        except MessageReaction.DoesNotExist:
            return Response(
                {'error': 'Reaction not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['patch'])
    def edit(self, request, pk=None):
        """Edit a message (only by sender)"""
        message = self.get_object()
        
        if message.sender != request.user:
            return Response(
                {'error': 'You can only edit your own messages'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_content = request.data.get('content')
        if not new_content:
            return Response(
                {'error': 'content is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        message.content = new_content
        message.mark_as_edited()
        
        return Response({
            'message': 'Message updated successfully',
            'content': message.content,
            'edited_at': message.edited_at
        })


class CrisisAlertViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CrisisAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return crisis alerts for the current user or handled by them"""
        return CrisisAlert.objects.filter(
            Q(user=self.request.user) | Q(responder=self.request.user)
        ).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge a crisis alert"""
        alert = self.get_object()
        
        if alert.status == 'active':
            alert.status = 'acknowledged'
            alert.responder = request.user
            alert.responded_at = timezone.now()
            alert.save()
            
            return Response({
                'message': 'Crisis alert acknowledged',
                'status': alert.status
            })
        else:
            return Response(
                {'error': f'Alert is already {alert.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve a crisis alert"""
        alert = self.get_object()
        resolution_notes = request.data.get('resolution_notes', '')
        
        alert.status = 'resolved'
        alert.resolution_notes = resolution_notes
        if not alert.responder:
            alert.responder = request.user
            alert.responded_at = timezone.now()
        alert.save()
        
        return Response({
            'message': 'Crisis alert resolved',
            'status': alert.status
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active crisis alerts (for crisis responders)"""
        active_alerts = CrisisAlert.objects.filter(
            status='active'
        ).order_by('-created_at')
        
        serializer = self.get_serializer(active_alerts, many=True)
        return Response(serializer.data)


class AIAssistantViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def get_response(self, request):
        """Get AI response for a message"""
        message = request.data.get('message', '')
        is_crisis = request.data.get('is_crisis', False)
        
        if not message:
            return Response(
                {'error': 'message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user context
        user_context = self.get_user_context(request.user)
        
        # Generate AI response
        ai_response = get_ai_response(
            message=message,
            is_crisis=is_crisis,
            user_context=user_context
        )
        
        return Response({
            'response': ai_response,
            'confidence': 0.9 if is_crisis else 0.7,
            'response_type': 'crisis_intervention' if is_crisis else 'supportive'
        })

    @action(detail=False, methods=['get'])
    def resources(self, request):
        """Get emergency and support resources"""
        return Response({
            'emergency_resources': get_emergency_resources(),
            'support_resources': get_support_resources()
        })

    @action(detail=False, methods=['post'])
    def check_crisis(self, request):
        """Check if message contains crisis indicators"""
        message = request.data.get('message', '')
        
        if not message:
            return Response(
                {'error': 'message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        crisis_keywords = detect_crisis_keywords(message)
        
        return Response({
            'is_crisis': bool(crisis_keywords),
            'keywords_detected': crisis_keywords,
            'urgency_level': 'high' if crisis_keywords else 'low'
        })

    def get_user_context(self, user):
        """Get user context for AI response generation"""
        context = {
            'recent_moods': [],
            'crisis_level': 'low'
        }
        
        if hasattr(user, 'profile'):
            context['crisis_level'] = user.profile.current_crisis_level
        
        # Get recent mood entries
        recent_moods = user.mood_entries.all()[:5]
        for mood in recent_moods:
            context['recent_moods'].append({
                'level': mood.mood_level,
                'date': mood.created_at.date().isoformat()
            })
        
        return context
