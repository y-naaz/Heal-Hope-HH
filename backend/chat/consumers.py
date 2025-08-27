import json
import asyncio
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, ChatParticipant, CrisisAlert, AIResponse
from .ai_support import get_ai_response, detect_crisis_keywords, analyze_sentiment
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        self.user = self.scope['user']

        if self.user.is_anonymous:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Mark user as online
        await self.mark_user_online(True)

        # Send initial room info
        await self.send_room_info()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            # Mark user as offline
            await self.mark_user_online(False)

            # Leave room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'chat_message')

            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            elif message_type == 'reaction':
                await self.handle_reaction(data)
            elif message_type == 'edit_message':
                await self.handle_edit_message(data)
            elif message_type == 'delete_message':
                await self.handle_delete_message(data)

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error in receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'An error occurred'
            }))

    async def handle_chat_message(self, data):
        message_content = data['message']
        reply_to_id = data.get('reply_to')

        # Save message to database
        message = await self.save_message(message_content, reply_to_id)

        if message:
            # Check for crisis keywords
            crisis_detected = await self.check_crisis_content(message_content)

            # Send message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': await self.serialize_message(message),
                    'crisis_detected': crisis_detected
                }
            )

            # Generate AI response if in AI room or crisis detected
            room = await self.get_room()
            if room and (room.room_type == 'ai' or crisis_detected):
                await self.generate_ai_response(message, crisis_detected)

    async def handle_typing(self, data):
        is_typing = data.get('is_typing', False)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'username': self.user.username,
                'is_typing': is_typing
            }
        )

    async def handle_reaction(self, data):
        message_id = data.get('message_id')
        reaction_type = data.get('reaction_type')

        if message_id and reaction_type:
            reaction = await self.save_reaction(message_id, reaction_type)
            if reaction:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'message_reaction',
                        'message_id': message_id,
                        'reaction': {
                            'user_id': self.user.id,
                            'username': self.user.username,
                            'reaction_type': reaction_type,
                            'timestamp': reaction.created_at.isoformat()
                        }
                    }
                )

    async def handle_edit_message(self, data):
        message_id = data.get('message_id')
        new_content = data.get('new_content')

        if message_id and new_content:
            success = await self.edit_message(message_id, new_content)
            if success:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'message_edited',
                        'message_id': message_id,
                        'new_content': new_content,
                        'edited_by': self.user.id,
                        'edited_at': datetime.now().isoformat()
                    }
                )

    async def handle_delete_message(self, data):
        message_id = data.get('message_id')

        if message_id:
            success = await self.delete_message(message_id)
            if success:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'message_deleted',
                        'message_id': message_id,
                        'deleted_by': self.user.id
                    }
                )

    # WebSocket message handlers
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'crisis_detected': event.get('crisis_detected', False)
        }))

    async def typing_indicator(self, event):
        if event['user_id'] != self.user.id:  # Don't send typing indicator to self
            await self.send(text_data=json.dumps({
                'type': 'typing_indicator',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing']
            }))

    async def message_reaction(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_reaction',
            'message_id': event['message_id'],
            'reaction': event['reaction']
        }))

    async def message_edited(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_edited',
            'message_id': event['message_id'],
            'new_content': event['new_content'],
            'edited_by': event['edited_by'],
            'edited_at': event['edited_at']
        }))

    async def message_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id'],
            'deleted_by': event['deleted_by']
        }))

    async def ai_response(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ai_response',
            'message': event['message'],
            'response_type': event['response_type'],
            'confidence': event.get('confidence', 0.0)
        }))

    async def crisis_alert(self, event):
        await self.send(text_data=json.dumps({
            'type': 'crisis_alert',
            'alert': event['alert'],
            'severity': event['severity'],
            'resources': event.get('resources', [])
        }))

    # Database operations
    @database_sync_to_async
    def get_room(self):
        try:
            return ChatRoom.objects.get(name=self.room_name)
        except ChatRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def save_message(self, content, reply_to_id=None):
        try:
            room = ChatRoom.objects.get(name=self.room_name)
            reply_to = None
            if reply_to_id:
                try:
                    reply_to = Message.objects.get(id=reply_to_id)
                except Message.DoesNotExist:
                    pass

            message = Message.objects.create(
                room=room,
                sender=self.user,
                content=content,
                reply_to=reply_to
            )
            return message
        except Exception as e:
            logger.error(f"Error saving message: {str(e)}")
            return None

    @database_sync_to_async
    def save_reaction(self, message_id, reaction_type):
        try:
            from .models import MessageReaction
            message = Message.objects.get(id=message_id)
            reaction, created = MessageReaction.objects.get_or_create(
                message=message,
                user=self.user,
                reaction_type=reaction_type
            )
            return reaction
        except Exception as e:
            logger.error(f"Error saving reaction: {str(e)}")
            return None

    @database_sync_to_async
    def edit_message(self, message_id, new_content):
        try:
            message = Message.objects.get(id=message_id, sender=self.user)
            message.content = new_content
            message.mark_as_edited()
            return True
        except Message.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"Error editing message: {str(e)}")
            return False

    @database_sync_to_async
    def delete_message(self, message_id):
        try:
            message = Message.objects.get(id=message_id, sender=self.user)
            message.is_deleted = True
            message.save()
            return True
        except Message.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"Error deleting message: {str(e)}")
            return False

    @database_sync_to_async
    def mark_user_online(self, is_online):
        try:
            room = ChatRoom.objects.get(name=self.room_name)
            participant, created = ChatParticipant.objects.get_or_create(
                user=self.user,
                room=room
            )
            participant.is_online = is_online
            participant.save()
        except Exception as e:
            logger.error(f"Error updating online status: {str(e)}")

    @database_sync_to_async
    def serialize_message(self, message):
        return {
            'id': message.id,
            'content': message.content,
            'sender': {
                'id': message.sender.id,
                'username': message.sender.username,
                'first_name': message.sender.first_name,
                'last_name': message.sender.last_name
            },
            'message_type': message.message_type,
            'reply_to': message.reply_to.id if message.reply_to else None,
            'created_at': message.created_at.isoformat(),
            'is_edited': message.is_edited,
            'edited_at': message.edited_at.isoformat() if message.edited_at else None
        }

    async def send_room_info(self):
        room = await self.get_room()
        if room:
            participants = await self.get_room_participants()
            await self.send(text_data=json.dumps({
                'type': 'room_info',
                'room': {
                    'name': room.name,
                    'room_type': room.room_type,
                    'participant_count': len(participants)
                },
                'participants': participants
            }))

    @database_sync_to_async
    def get_room_participants(self):
        try:
            room = ChatRoom.objects.get(name=self.room_name)
            participants = []
            for participant in room.chatparticipant_set.filter(is_online=True):
                participants.append({
                    'id': participant.user.id,
                    'username': participant.user.username,
                    'role': participant.role,
                    'is_online': participant.is_online
                })
            return participants
        except Exception as e:
            logger.error(f"Error getting participants: {str(e)}")
            return []

    async def check_crisis_content(self, content):
        crisis_keywords = await database_sync_to_async(detect_crisis_keywords)(content)
        if crisis_keywords:
            await self.create_crisis_alert(content, crisis_keywords)
            return True
        return False

    @database_sync_to_async
    def create_crisis_alert(self, content, keywords):
        try:
            room = ChatRoom.objects.get(name=self.room_name)
            severity = 'high' if any(word in content.lower() for word in ['suicide', 'kill', 'die', 'end it all']) else 'medium'
            
            CrisisAlert.objects.create(
                user=self.user,
                room=room,
                severity=severity,
                alert_reason=f"Crisis keywords detected: {', '.join(keywords)}"
            )
        except Exception as e:
            logger.error(f"Error creating crisis alert: {str(e)}")

    async def generate_ai_response(self, message, is_crisis=False):
        try:
            ai_response_text = await database_sync_to_async(get_ai_response)(
                message.content, 
                is_crisis=is_crisis,
                user_context=await self.get_user_context()
            )
            
            if ai_response_text:
                # Save AI response as message
                ai_message = await self.save_ai_message(ai_response_text, message)
                
                if ai_message:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'ai_response',
                            'message': await self.serialize_message(ai_message),
                            'response_type': 'crisis_intervention' if is_crisis else 'supportive',
                            'confidence': 0.9 if is_crisis else 0.7
                        }
                    )

        except Exception as e:
            logger.error(f"Error generating AI response: {str(e)}")

    @database_sync_to_async
    def save_ai_message(self, content, original_message):
        try:
            # Create AI user if doesn't exist
            ai_user, created = User.objects.get_or_create(
                username='ai_assistant',
                defaults={
                    'email': 'ai@mentalhealth.com',
                    'first_name': 'AI',
                    'last_name': 'Assistant'
                }
            )
            
            room = ChatRoom.objects.get(name=self.room_name)
            ai_message = Message.objects.create(
                room=room,
                sender=ai_user,
                content=content,
                message_type='system',
                reply_to=original_message
            )
            
            # Create AI response record
            AIResponse.objects.create(
                message=ai_message,
                response_type='crisis_intervention' if 'crisis' in content.lower() else 'supportive',
                confidence_score=0.9
            )
            
            return ai_message
        except Exception as e:
            logger.error(f"Error saving AI message: {str(e)}")
            return None

    @database_sync_to_async
    def get_user_context(self):
        try:
            # Get recent mood entries, journal entries, etc. for context
            context = {
                'recent_moods': [],
                'crisis_level': 'low'
            }
            
            if hasattr(self.user, 'profile'):
                context['crisis_level'] = self.user.profile.current_crisis_level
            
            # Get recent mood entries
            recent_moods = self.user.mood_entries.all()[:5]
            for mood in recent_moods:
                context['recent_moods'].append({
                    'level': mood.mood_level,
                    'date': mood.created_at.date().isoformat()
                })
            
            return context
        except Exception as e:
            logger.error(f"Error getting user context: {str(e)}")
            return {}


class SupportConsumer(ChatConsumer):
    """Extended consumer for crisis support with additional features"""
    
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.room_name = f"support_{self.user_id}"
        self.room_group_name = f'support_{self.user_id}'
        self.user = self.scope['user']

        # Allow anonymous users for crisis support
        if self.user.is_anonymous:
            self.user = await self.create_anonymous_user()

        # Create or get support room
        await self.create_support_room()

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        await self.mark_user_online(True)

        # Send welcome message
        await self.send_support_welcome()

    @database_sync_to_async
    def create_anonymous_user(self):
        try:
            # Create a temporary anonymous user for crisis support
            import uuid
            username = f"anonymous_{str(uuid.uuid4())[:8]}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@anonymous.local',
                    'first_name': 'Anonymous',
                    'last_name': 'User',
                    'is_active': False  # Mark as inactive since it's temporary
                }
            )
            return user
        except Exception as e:
            logger.error(f"Error creating anonymous user: {str(e)}")
            return None

    @database_sync_to_async
    def create_support_room(self):
        try:
            room, created = ChatRoom.objects.get_or_create(
                name=self.room_name,
                defaults={
                    'room_type': 'support',
                    'description': f'Crisis support for user {self.user.username}',
                    'created_by': self.user,
                    'is_private': True
                }
            )
            
            # Add user as participant
            ChatParticipant.objects.get_or_create(
                user=self.user,
                room=room,
                defaults={'role': 'user'}
            )
            
        except Exception as e:
            logger.error(f"Error creating support room: {str(e)}")

    async def send_support_welcome(self):
        welcome_message = """
Hello! I'm here to provide you with crisis support and mental health assistance. 

🆘 If you're in immediate danger, please call emergency services (911, 988, or your local emergency number).

I can help you with:
• Crisis intervention and support
• Coping strategies and techniques
• Resource recommendations
• Connecting you with professional help

How are you feeling right now? Please tell me what's going on.
        """
        
        ai_message = await self.save_ai_message(welcome_message.strip(), None)
        if ai_message:
            await self.send(text_data=json.dumps({
                'type': 'ai_response',
                'message': await self.serialize_message(ai_message),
                'response_type': 'supportive'
            }))


class CrisisConsumer(SupportConsumer):
    """Specialized consumer for crisis situations with immediate intervention"""
    
    async def connect(self):
        await super().connect()
        
        # Immediately escalate and notify crisis team
        await self.escalate_crisis()

    async def escalate_crisis(self):
        """Immediately escalate to crisis intervention team"""
        await self.create_immediate_crisis_alert()
        
        crisis_message = """
🚨 CRISIS INTERVENTION ACTIVATED 🚨

I've detected that you may be in crisis. Your safety is our top priority.

IMMEDIATE RESOURCES:
• National Suicide Prevention Lifeline: 988
• Crisis Text Line: Text HOME to 741741
• Emergency Services: 911

A crisis counselor will join this chat shortly. Please stay with us.

Remember: You are not alone, and help is available. Your life matters.
        """
        
        ai_message = await self.save_ai_message(crisis_message.strip(), None)
        if ai_message:
            await self.send(text_data=json.dumps({
                'type': 'crisis_alert',
                'message': await self.serialize_message(ai_message),
                'severity': 'critical',
                'resources': [
                    {'name': 'Suicide Prevention Lifeline', 'contact': '988'},
                    {'name': 'Crisis Text Line', 'contact': 'Text HOME to 741741'},
                    {'name': 'Emergency Services', 'contact': '911'}
                ]
            }))

    @database_sync_to_async
    def create_immediate_crisis_alert(self):
        try:
            CrisisAlert.objects.create(
                user=self.user,
                severity='critical',
                status='active',
                alert_reason='User accessed crisis intervention channel',
                emergency_contacts_notified=False
            )
        except Exception as e:
            logger.error(f"Error creating immediate crisis alert: {str(e)}")
