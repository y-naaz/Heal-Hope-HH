from django.core.management.base import BaseCommand
from users.models import CustomUser, UserProfile
from dashboard.models import MoodEntry, JournalEntry, Goal, Activity, MeditationSession
from datetime import date, timedelta
import random

class Command(BaseCommand):
    help = 'Create a demo user with sample data for testing the dynamic dashboard'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='demo@mindwell.com',
            help='Email for demo user (default: demo@mindwell.com)'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='demo123',
            help='Password for demo user (default: demo123)'
        )

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        
        # Create or get demo user
        user, created = CustomUser.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': 'Yasmeen',
                'last_name': 'Demo',
                'is_verified': True
            }
        )
        
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Created demo user: {email}'))
        else:
            self.stdout.write(self.style.WARNING(f'Demo user already exists: {email}'))
        
        # Create user profile if it doesn't exist
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'bio': 'Demo user for testing the MindWell dashboard',
                'location': 'Demo City'
            }
        )
        
        # Create sample mood entries for the last 7 days
        mood_choices = ['very-sad', 'sad', 'neutral', 'good', 'very-good']
        mood_scores = {'very-sad': 2, 'sad': 4, 'neutral': 6, 'good': 8, 'very-good': 10}
        factors_list = [['Sleep', 'Exercise'], ['Work', 'Stress'], ['Social'], ['Weather'], ['Exercise', 'Nutrition']]
        
        for i in range(7):
            entry_date = date.today() - timedelta(days=i)
            mood = random.choice(mood_choices)
            factors = random.choice(factors_list)
            
            MoodEntry.objects.get_or_create(
                user=user,
                date=entry_date,
                defaults={
                    'mood': mood,
                    'score': mood_scores[mood],
                    'note': f'Sample mood entry for {entry_date}' if i == 0 else '',
                    'factors': factors
                }
            )
        
        # Create sample journal entries
        journal_entries = [
            {
                'title': 'Reflecting on Progress',
                'content': 'Today I realized how much progress I\'ve made over the past few months. The daily meditation is really helping me stay centered and focused. I\'m grateful for the small wins.',
                'mood': 'good',
                'tags': ['Progress', 'Meditation', 'Gratitude'],
                'date': date.today() - timedelta(days=1)
            },
            {
                'title': 'Challenging Day',
                'content': 'Had a really tough day dealing with work stress. Feeling overwhelmed but trying to use the coping strategies I\'ve learned. Tomorrow is a new day.',
                'mood': 'sad',
                'tags': ['Work', 'Stress', 'Coping'],
                'date': date.today() - timedelta(days=3)
            }
        ]
        
        for entry_data in journal_entries:
            word_count = len(entry_data['content'].split())
            JournalEntry.objects.get_or_create(
                user=user,
                title=entry_data['title'],
                defaults={
                    'content': entry_data['content'],
                    'mood': entry_data['mood'],
                    'tags': entry_data['tags'],
                    'date': entry_data['date'],
                    'word_count': word_count
                }
            )
        
        # Create sample goals
        goals_data = [
            {
                'title': 'Daily Meditation Practice',
                'description': 'Meditate for at least 10 minutes every day',
                'category': 'mindfulness',
                'target_value': 30,
                'current_value': 7,
                'unit': 'days',
                'priority': 'high'
            },
            {
                'title': 'Weekly Therapy Sessions',
                'description': 'Attend therapy sessions consistently for 3 months',
                'category': 'therapy',
                'target_value': 12,
                'current_value': 8,
                'unit': 'sessions',
                'priority': 'medium'
            }
        ]
        
        for goal_data in goals_data:
            Goal.objects.get_or_create(
                user=user,
                title=goal_data['title'],
                defaults={
                    'description': goal_data['description'],
                    'category': goal_data['category'],
                    'target_value': goal_data['target_value'],
                    'current_value': goal_data['current_value'],
                    'unit': goal_data['unit'],
                    'priority': goal_data['priority'],
                    'start_date': date.today() - timedelta(days=7),
                    'end_date': date.today() + timedelta(days=23)
                }
            )
        
        # Create sample meditation sessions
        for i in range(3):
            session_date = date.today() - timedelta(days=i*2)
            MeditationSession.objects.get_or_create(
                user=user,
                session_name='Mindfulness Meditation',
                duration_minutes=10 + (i * 5),
                defaults={
                    'session_type': 'mindfulness',
                    'completed': True,
                    'notes': f'Great session on {session_date}'
                }
            )
        
        # Create sample activities
        activities_data = [
            {
                'activity_type': 'meditation',
                'title': 'Completed 10-minute meditation',
                'description': 'Mindfulness meditation session'
            },
            {
                'activity_type': 'mood',
                'title': 'Logged mood: Good',
                'description': 'Daily mood tracking'
            },
            {
                'activity_type': 'journal',
                'title': 'Added journal entry',
                'description': 'Reflected on progress'
            },
            {
                'activity_type': 'goal',
                'title': 'Updated goal progress',
                'description': 'Meditation practice goal'
            }
        ]
        
        for activity_data in activities_data:
            Activity.objects.get_or_create(
                user=user,
                title=activity_data['title'],
                defaults={
                    'activity_type': activity_data['activity_type'],
                    'description': activity_data['description']
                }
            )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nDemo user setup complete!\n'
                f'Email: {email}\n'
                f'Password: {password}\n'
                f'The user now has sample mood entries, journal entries, goals, and activities.'
            )
        )
