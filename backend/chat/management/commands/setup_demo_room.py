from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from chat.models import ChatRoom, ChatParticipant

User = get_user_model()

class Command(BaseCommand):
    help = 'Create demo chat room for crisis support'

    def handle(self, *args, **options):
        try:
            # Create or get AI assistant user
            ai_user, created = User.objects.get_or_create(
                username='ai_assistant',
                defaults={
                    'email': 'ai@mentalhealth.com',
                    'first_name': 'AI',
                    'last_name': 'Assistant',
                    'is_active': True
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS('Created AI assistant user'))
            
            # Create or get demo user
            demo_user, created = User.objects.get_or_create(
                username='demo',
                defaults={
                    'email': 'demo@example.com',
                    'first_name': 'Demo',
                    'last_name': 'User',
                    'is_active': True
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS('Created demo user'))
            
            # Create demo chat room
            demo_room, created = ChatRoom.objects.get_or_create(
                name='demo',
                defaults={
                    'room_type': 'support',
                    'description': 'Demo crisis support chat room',
                    'created_by': demo_user,
                    'is_active': True,
                    'is_private': False,
                    'max_participants': 10
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS('Created demo chat room'))
            else:
                self.stdout.write(self.style.WARNING('Demo chat room already exists'))
            
            # Add AI assistant as participant
            ai_participant, created = ChatParticipant.objects.get_or_create(
                user=ai_user,
                room=demo_room,
                defaults={'role': 'ai'}
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS('Added AI assistant to demo room'))
            
            # Add demo user as participant
            demo_participant, created = ChatParticipant.objects.get_or_create(
                user=demo_user,
                room=demo_room,
                defaults={'role': 'user'}
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS('Added demo user to demo room'))
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Demo room setup complete! Room ID: {demo_room.id}, '
                    f'Participants: {demo_room.participant_count}'
                )
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error setting up demo room: {str(e)}')
            )
