from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Avg, Q, Max, Min
from datetime import datetime, timedelta, date
from collections import Counter
import json

from .models import (
    MoodEntry, JournalEntry, Goal, Activity, Appointment, 
    UserSettings, MeditationSession, DashboardInsight
)
from .serializers import (
    MoodEntrySerializer, JournalEntrySerializer, GoalSerializer, 
    ActivitySerializer, AppointmentSerializer, UserSettingsSerializer,
    MeditationSessionSerializer, DashboardInsightSerializer,
    MoodAnalyticsSerializer, DashboardStatsSerializer, RecentActivitySerializer
)
from chat.memory_service import MemoryService

class MoodEntryViewSet(viewsets.ModelViewSet):
    serializer_class = MoodEntrySerializer
    permission_classes = [AllowAny]  # Temporary for development - file:// protocol issue

    def get_queryset(self):
        # Handle anonymous users for development
        if not self.request.user.is_authenticated:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(username='yasmeen')
            except User.DoesNotExist:
                user = User.objects.first()
            if not user:
                return MoodEntry.objects.none()
        else:
            user = self.request.user
        
        return MoodEntry.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        # Create mood entry
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == status.HTTP_201_CREATED:
            # Add to memory system for personalization
            mood_data = response.data
            memory_content = f"User logged mood: {mood_data['mood']} (score: {mood_data['score']}) on {mood_data['date']}"
            if mood_data.get('note'):
                memory_content += f". Note: {mood_data['note']}"
            if mood_data.get('factors'):
                memory_content += f". Factors: {', '.join(mood_data['factors'])}"
            
            try:
                memory_service = MemoryService()
                memory_service.add_memory(
                    user_id=str(request.user.id),
                    content=memory_content,
                    category="mood_tracking"
                )
            except Exception as e:
                print(f"Failed to add mood to memory: {e}")
            
            # Create activity record
            Activity.objects.create(
                user=request.user,
                activity_type='mood',
                title=f"Logged mood: {mood_data['mood'].replace('-', ' ').title()}",
                description=mood_data.get('note', ''),
                metadata={'mood': mood_data['mood'], 'score': mood_data['score']}
            )
        
        return response

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Get mood analytics and insights"""
        mood_entries = self.get_queryset().order_by('-date')
        
        if not mood_entries.exists():
            return Response({
                'success': True,
                'analytics': {
                    'average_score': 0,
                    'most_common_mood': None,
                    'weekly_improvement': 0,
                    'total_entries': 0,
                    'mood_distribution': {},
                    'recent_trend': 'No data'
                }
            })
        
        # Calculate analytics
        total_entries = mood_entries.count()
        average_score = mood_entries.aggregate(Avg('score'))['score__avg'] or 0
        
        # Most common mood
        mood_counts = Counter(mood_entries.values_list('mood', flat=True))
        most_common_mood = mood_counts.most_common(1)[0][0] if mood_counts else None
        
        # Weekly improvement
        week_ago = timezone.now().date() - timedelta(days=7)
        this_week = mood_entries.filter(date__gte=week_ago)
        last_week = mood_entries.filter(
            date__gte=week_ago - timedelta(days=7),
            date__lt=week_ago
        )
        
        this_week_avg = this_week.aggregate(Avg('score'))['score__avg'] or 0
        last_week_avg = last_week.aggregate(Avg('score'))['score__avg'] or 0
        weekly_improvement = ((this_week_avg - last_week_avg) / last_week_avg * 100) if last_week_avg > 0 else 0
        
        # Mood distribution
        mood_distribution = dict(mood_counts)
        
        # Recent trend
        recent_entries = mood_entries[:7]
        if len(recent_entries) >= 2:
            recent_trend = "improving" if recent_entries[0].score > recent_entries[-1].score else "declining" if recent_entries[0].score < recent_entries[-1].score else "stable"
        else:
            recent_trend = "insufficient_data"
        
        analytics_data = {
            'average_score': round(average_score, 1),
            'most_common_mood': most_common_mood,
            'weekly_improvement': round(weekly_improvement, 1),
            'total_entries': total_entries,
            'mood_distribution': mood_distribution,
            'recent_trend': recent_trend
        }
        
        return Response({
            'success': True,
            'analytics': analytics_data
        })

class JournalEntryViewSet(viewsets.ModelViewSet):
    serializer_class = JournalEntrySerializer
    permission_classes = [AllowAny]  # Temporary for development - file:// protocol issue

    def get_queryset(self):
        # Handle anonymous users for development
        if not self.request.user.is_authenticated:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(username='yasmeen')
            except User.DoesNotExist:
                user = User.objects.first()
            if not user:
                return JournalEntry.objects.none()
        else:
            user = self.request.user
        
        return JournalEntry.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == status.HTTP_201_CREATED:
            # Add to memory system
            journal_data = response.data
            memory_content = f"Journal entry: {journal_data['title']}. Content preview: {journal_data['content'][:200]}..."
            
            try:
                memory_service = MemoryService()
                memory_service.add_memory(
                    user_id=str(request.user.id),
                    content=memory_content,
                    category="journal"
                )
            except Exception as e:
                print(f"Failed to add journal to memory: {e}")
            
            # Create activity record
            Activity.objects.create(
                user=request.user,
                activity_type='journal',
                title="Added journal entry",
                description=journal_data['title'],
                metadata={'word_count': journal_data['word_count']}
            )
        
        return response

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get journal statistics"""
        entries = self.get_queryset()
        
        total_entries = entries.count()
        total_words = sum(entries.values_list('word_count', flat=True))
        
        # Calculate writing streak
        today = timezone.now().date()
        streak = 0
        current_date = today
        
        while True:
            if entries.filter(date=current_date).exists():
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break
        
        # Recent entries
        recent_entries = entries[:5].values('id', 'title', 'date', 'word_count', 'mood')
        
        return Response({
            'success': True,
            'stats': {
                'total_entries': total_entries,
                'total_words': total_words,
                'current_streak': streak,
                'recent_entries': list(recent_entries)
            }
        })

class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [AllowAny]  # Temporary for development - file:// protocol issue

    def get_queryset(self):
        # Handle anonymous users for development
        if not self.request.user.is_authenticated:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(username='yasmeen')
            except User.DoesNotExist:
                user = User.objects.first()
            if not user:
                return Goal.objects.none()
        else:
            user = self.request.user
        
        return Goal.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == status.HTTP_201_CREATED:
            goal_data = response.data
            
            # Add to memory system
            memory_content = f"New goal created: {goal_data['title']} - {goal_data['description']}. Target: {goal_data['target_value']} {goal_data['unit']}"
            
            try:
                memory_service = MemoryService()
                memory_service.add_memory(
                    user_id=str(request.user.id),
                    content=memory_content,
                    category="goals"
                )
            except Exception as e:
                print(f"Failed to add goal to memory: {e}")
            
            # Create activity record
            Activity.objects.create(
                user=request.user,
                activity_type='goal',
                title="Created new goal",
                description=goal_data['title'],
                metadata={'category': goal_data['category'], 'priority': goal_data['priority']}
            )
        
        return response

    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        """Update goal progress"""
        goal = self.get_object()
        increment = request.data.get('increment', 1)
        
        goal.current_value = min(goal.current_value + increment, goal.target_value)
        goal.save()
        
        # Create activity record
        Activity.objects.create(
            user=request.user,
            activity_type='goal',
            title=f"Updated goal progress: {goal.title}",
            description=f"Progress: {goal.current_value}/{goal.target_value} {goal.unit}",
            metadata={'progress_percentage': goal.progress_percentage}
        )
        
        # Add to memory if goal is completed
        if goal.status == 'completed':
            try:
                memory_service = MemoryService()
                memory_service.add_memory(
                    user_id=str(request.user.id),
                    content=f"Completed goal: {goal.title}. Achievement unlocked!",
                    category="achievements"
                )
            except Exception as e:
                print(f"Failed to add achievement to memory: {e}")
        
        serializer = self.get_serializer(goal)
        return Response({
            'success': True,
            'goal': serializer.data,
            'message': 'Goal completed!' if goal.status == 'completed' else 'Progress updated!'
        })

class ActivityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [AllowAny]  # Temporary for development - file:// protocol issue

    def get_queryset(self):
        # Handle anonymous users for development
        if not self.request.user.is_authenticated:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(username='yasmeen')
            except User.DoesNotExist:
                user = User.objects.first()
            if not user:
                return Activity.objects.none()
        else:
            user = self.request.user
        
        return Activity.objects.filter(user=user)

class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [AllowAny]  # Temporary for development - file:// protocol issue

    def get_queryset(self):
        # Handle anonymous users for development
        if not self.request.user.is_authenticated:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(username='yasmeen')
            except User.DoesNotExist:
                user = User.objects.first()
            if not user:
                return Appointment.objects.none()
        else:
            user = self.request.user
        
        return Appointment.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == status.HTTP_201_CREATED:
            appointment_data = response.data
            
            # Create activity record
            Activity.objects.create(
                user=request.user,
                activity_type='appointment',
                title="Scheduled appointment",
                description=f"with {appointment_data['therapist_name']} on {appointment_data['date']}",
                metadata={
                    'therapist': appointment_data['therapist_name'],
                    'type': appointment_data['appointment_type'],
                    'format': appointment_data['session_format']
                }
            )
        
        return response

class MeditationSessionViewSet(viewsets.ModelViewSet):
    serializer_class = MeditationSessionSerializer
    permission_classes = [AllowAny]  # Temporary for development - file:// protocol issue

    def get_queryset(self):
        # Handle anonymous users for development
        if not self.request.user.is_authenticated:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(username='yasmeen')
            except User.DoesNotExist:
                user = User.objects.first()
            if not user:
                return MeditationSession.objects.none()
        else:
            user = self.request.user
        
        return MeditationSession.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == status.HTTP_201_CREATED:
            session_data = response.data
            
            # Create activity record
            Activity.objects.create(
                user=request.user,
                activity_type='meditation',
                title=f"Completed meditation: {session_data['session_name']}",
                description=f"{session_data['duration_minutes']} minute session",
                metadata={
                    'duration': session_data['duration_minutes'],
                    'type': session_data['session_type'],
                    'completed': session_data['completed']
                }
            )
            
            # Add to memory system
            try:
                memory_service = MemoryService()
                memory_service.add_memory(
                    user_id=str(request.user.id),
                    content=f"Completed {session_data['duration_minutes']}-minute meditation session: {session_data['session_name']}",
                    category="meditation"
                )
            except Exception as e:
                print(f"Failed to add meditation to memory: {e}")
        
        return response

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get meditation statistics"""
        sessions = self.get_queryset().filter(completed=True)
        
        total_sessions = sessions.count()
        total_minutes = sum(sessions.values_list('duration_minutes', flat=True))
        
        # Calculate streak
        today = timezone.now().date()
        streak = 0
        current_date = today
        
        while True:
            if sessions.filter(created_at__date=current_date).exists():
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break
        
        return Response({
            'success': True,
            'stats': {
                'total_sessions': total_sessions,
                'total_minutes': total_minutes,
                'current_streak': streak,
                'average_duration': round(total_minutes / total_sessions, 1) if total_sessions > 0 else 0
            }
        })

@api_view(['GET'])
@permission_classes([AllowAny])  # Temporary for development - file:// protocol issue
def dashboard_overview(request):
    """Get comprehensive dashboard overview with all stats"""
    # Handle anonymous users for development
    if not request.user.is_authenticated:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        # Default to demo user for development
        try:
            user = User.objects.get(username='yasmeen')
        except User.DoesNotExist:
            user = User.objects.first()  # Fallback to first user
        if not user:
            return Response({'error': 'No users found'}, status=404)
    else:
        user = request.user
    
    today = timezone.now().date()
    
    # Today's mood
    today_mood_entry = MoodEntry.objects.filter(user=user, date=today).first()
    today_mood = today_mood_entry.mood if today_mood_entry else None
    
    # Calculate mood change from yesterday
    yesterday = today - timedelta(days=1)
    yesterday_mood = MoodEntry.objects.filter(user=user, date=yesterday).first()
    mood_change = 0
    if today_mood_entry and yesterday_mood:
        mood_change = ((today_mood_entry.score - yesterday_mood.score) / yesterday_mood.score) * 100
    
    # Meditation streak
    meditation_sessions = MeditationSession.objects.filter(user=user, completed=True).order_by('-created_at')
    meditation_streak = 0
    current_date = today
    
    while True:
        if meditation_sessions.filter(created_at__date=current_date).exists():
            meditation_streak += 1
            current_date -= timedelta(days=1)
        else:
            break
    
    # Goals stats
    goals = Goal.objects.filter(user=user)
    goals_completed = goals.filter(status='completed').count()
    goals_active = goals.filter(status='active').count()
    
    # Weekly goals progress
    active_goals = goals.filter(status='active')
    if active_goals.exists():
        weekly_progress = sum(goal.progress_percentage for goal in active_goals) / active_goals.count()
    else:
        weekly_progress = 0
    
    # Journal entries count
    journal_entries_count = JournalEntry.objects.filter(user=user).count()
    
    # Next appointment
    next_appointment = Appointment.objects.filter(
        user=user, 
        date__gte=today,
        status='scheduled'
    ).order_by('date', 'time').first()
    
    next_appointment_data = None
    if next_appointment:
        next_appointment_data = {
            'id': next_appointment.id,
            'therapist_name': next_appointment.therapist_name,
            'date': next_appointment.date,
            'time': next_appointment.time,
            'appointment_type': next_appointment.appointment_type,
            'session_format': next_appointment.session_format
        }
    
    # Recent activities
    recent_activities = Activity.objects.filter(user=user)[:5]
    activities_data = []
    
    for activity in recent_activities:
        icon_map = {
            'mood': 'fas fa-smile',
            'meditation': 'fas fa-meditation',
            'journal': 'fas fa-pen',
            'goal': 'fas fa-target',
            'appointment': 'fas fa-calendar',
            'exercise': 'fas fa-running',
            'sleep': 'fas fa-bed'
        }
        
        activities_data.append({
            'activity_type': activity.activity_type,
            'title': activity.title,
            'description': activity.description,
            'icon': icon_map.get(activity.activity_type, 'fas fa-circle'),
            'timestamp': activity.created_at,
            'metadata': activity.metadata
        })
    
    # Mood chart data (last 7 days)
    week_ago = today - timedelta(days=6)
    mood_entries = MoodEntry.objects.filter(
        user=user,
        date__gte=week_ago,
        date__lte=today
    ).order_by('date')
    
    mood_chart_data = []
    for i in range(7):
        chart_date = week_ago + timedelta(days=i)
        mood_entry = mood_entries.filter(date=chart_date).first()
        mood_chart_data.append({
            'date': chart_date.strftime('%Y-%m-%d'),
            'day': chart_date.strftime('%a'),
            'score': mood_entry.score if mood_entry else None,
            'mood': mood_entry.mood if mood_entry else None
        })
    
    # Generate insights
    insights = generate_user_insights(user)
    
    dashboard_data = {
        'success': True,
        'dashboard_stats': {
            'todays_mood': {
                'mood': today_mood,
                'change': round(mood_change, 1) if mood_change != 0 else None
            },
            'meditation_streak': meditation_streak,
            'meditation_streak_text': 'Personal best!' if meditation_streak > 0 else 'Start your journey!',
            'goals_completed': goals_completed,
            'goals_active': goals_active,
            'journal_entries_count': journal_entries_count,
            'next_session': {
                'time': 'Tomorrow' if next_appointment_data else 'No sessions scheduled',
                'details': f"{next_appointment_data['time']} with {next_appointment_data['therapist_name']}" if next_appointment_data else 'Schedule your first session'
            },
            'weekly_goals': {
                'progress': f"{goals_completed}/{goals_active + goals_completed}" if (goals_active + goals_completed) > 0 else "0/0",
                'status': 'On track' if weekly_progress > 50 else 'Getting started' if goals_active > 0 else 'No goals set',
                'on_track': weekly_progress > 50
            }
        },
        'recent_activities': activities_data,
        'mood_chart_data': {
            'labels': [entry['day'] for entry in mood_chart_data if entry['score'] is not None],
            'scores': [entry['score'] for entry in mood_chart_data if entry['score'] is not None]
        },
        'insights': insights
    }
    
    return Response(dashboard_data)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_settings(request):
    """Get or update user settings"""
    user = request.user
    
    if request.method == 'GET':
        settings, created = UserSettings.objects.get_or_create(user=user)
        serializer = UserSettingsSerializer(settings)
        return Response({
            'success': True,
            'settings': serializer.data
        })
    
    elif request.method == 'POST':
        settings, created = UserSettings.objects.get_or_create(user=user)
        serializer = UserSettingsSerializer(settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'settings': serializer.data,
                'message': 'Settings updated successfully'
            })
        else:
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

def generate_user_insights(user):
    """Generate personalized insights for the user"""
    insights = []
    
    # Mood trend insight
    mood_entries = MoodEntry.objects.filter(user=user).order_by('-date')[:14]
    if mood_entries.count() >= 7:
        recent_avg = sum(entry.score for entry in mood_entries[:7]) / 7
        previous_entries = mood_entries[7:14]
        if len(previous_entries) > 0:
            previous_avg = sum(entry.score for entry in previous_entries) / len(previous_entries)
        else:
            previous_avg = recent_avg  # Fallback to recent average if no previous data
        
        if recent_avg > previous_avg + 0.5:
            insights.append({
                'type': 'mood_improvement',
                'title': 'Your mood is improving! 📈',
                'description': f'Your mood has improved by {((recent_avg - previous_avg) / previous_avg * 100):.1f}% this week.',
                'icon': 'trending-up',
                'priority': 3
            })
        elif recent_avg < previous_avg - 0.5:
            insights.append({
                'type': 'mood_concern',
                'title': 'Let\'s focus on your wellbeing 💙',
                'description': 'Your mood has been lower lately. Consider talking to someone or trying some coping strategies.',
                'icon': 'heart',
                'priority': 4
            })
    
    # Goal progress insight
    active_goals = Goal.objects.filter(user=user, status='active')
    if active_goals.exists():
        avg_progress = sum(goal.progress_percentage for goal in active_goals) / active_goals.count()
        if avg_progress > 75:
            insights.append({
                'type': 'goal_achievement',
                'title': 'You\'re crushing your goals! 🎯',
                'description': f'You\'re {avg_progress:.0f}% through your active goals. Keep up the amazing work!',
                'icon': 'target',
                'priority': 2
            })
    
    # Meditation consistency
    meditation_sessions = MeditationSession.objects.filter(
        user=user,
        completed=True,
        created_at__gte=timezone.now() - timedelta(days=7)
    )
    if meditation_sessions.count() >= 5:
        insights.append({
            'type': 'meditation_consistency',
            'title': 'Meditation master in the making! 🧘',
            'description': f'You\'ve meditated {meditation_sessions.count()} times this week. Your mind thanks you!',
            'icon': 'brain',
            'priority': 2
        })
    
    # Sort by priority and return top 3
    insights.sort(key=lambda x: x['priority'], reverse=True)
    return insights[:3]

@api_view(['GET'])
@permission_classes([AllowAny])  # Temporary for development - file:// protocol issue
def user_activities(request):
    """Get user activities with pagination"""
    # Handle anonymous users for development
    if not request.user.is_authenticated:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(username='yasmeen')
        except User.DoesNotExist:
            user = User.objects.first()
        if not user:
            return Response({'error': 'No users found'}, status=404)
    else:
        user = request.user
    
    activities = Activity.objects.filter(user=user)
    
    # Get recent activities
    recent_activities = activities[:10]
    activities_data = []
    
    icon_map = {
        'mood': 'fas fa-smile',
        'meditation': 'fas fa-meditation', 
        'journal': 'fas fa-pen',
        'goal': 'fas fa-target',
        'appointment': 'fas fa-calendar',
        'exercise': 'fas fa-running',
        'sleep': 'fas fa-bed',
        'crisis': 'fas fa-shield-alt',
        'other': 'fas fa-circle'
    }
    
    for activity in recent_activities:
        activities_data.append({
            'id': activity.id,
            'activity_type': activity.activity_type,
            'title': activity.title,
            'description': activity.description,
            'icon': icon_map.get(activity.activity_type, 'fas fa-circle'),
            'timestamp': activity.created_at,
            'metadata': activity.metadata
        })
    
    return Response({
        'success': True,
        'activities': activities_data
    })

# API endpoints for specific dashboard components
@api_view(['GET'])
@permission_classes([AllowAny])  # Temporary for development - file:// protocol issue
def mood_entries(request):
    """Get mood entries for the authenticated user"""
    # Handle anonymous users for development
    if not request.user.is_authenticated:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(username='yasmeen')
        except User.DoesNotExist:
            user = User.objects.first()
        if not user:
            return Response({'error': 'No users found'}, status=404)
    else:
        user = request.user
    
    entries = MoodEntry.objects.filter(user=user).order_by('-date')
    serializer = MoodEntrySerializer(entries, many=True)
    
    return Response({
        'success': True,
        'mood_entries': serializer.data
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_mood_entry(request):
    """Create a new mood entry"""
    serializer = MoodEntrySerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        mood_entry = serializer.save()
        
        # Add to memory system
        memory_content = f"User logged mood: {mood_entry.mood} (score: {mood_entry.score}) on {mood_entry.date}"
        if mood_entry.note:
            memory_content += f". Note: {mood_entry.note}"
        if mood_entry.factors:
            memory_content += f". Factors: {', '.join(mood_entry.factors)}"
        
        try:
            memory_service = MemoryService()
            memory_service.add_memory(
                user_id=str(request.user.id),
                content=memory_content,
                category="mood_tracking"
            )
        except Exception as e:
            print(f"Failed to add mood to memory: {e}")
        
        # Create activity record
        Activity.objects.create(
            user=request.user,
            activity_type='mood',
            title=f"Logged mood: {mood_entry.mood.replace('-', ' ').title()}",
            description=mood_entry.note or '',
            metadata={'mood': mood_entry.mood, 'score': mood_entry.score}
        )
        
        return Response({
            'success': True,
            'mood_entry': serializer.data,
            'message': 'Mood logged successfully!'
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])  # Temporary for development - file:// protocol issue
def journal_entries(request):
    """Get journal entries for the authenticated user"""
    # Handle anonymous users for development
    if not request.user.is_authenticated:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(username='yasmeen')
        except User.DoesNotExist:
            user = User.objects.first()
        if not user:
            return Response({'error': 'No users found'}, status=404)
    else:
        user = request.user
    
    entries = JournalEntry.objects.filter(user=user).order_by('-created_at')
    serializer = JournalEntrySerializer(entries, many=True)
    
    return Response({
        'success': True,
        'entries': serializer.data
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_journal_entry(request):
    """Create a new journal entry"""
    serializer = JournalEntrySerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        journal_entry = serializer.save()
        
        # Add to memory system
        memory_content = f"Journal entry: {journal_entry.title}. Content preview: {journal_entry.content[:200]}..."
        
        try:
            memory_service = MemoryService()
            memory_service.add_memory(
                user_id=str(request.user.id),
                content=memory_content,
                category="journal"
            )
        except Exception as e:
            print(f"Failed to add journal to memory: {e}")
        
        # Create activity record
        Activity.objects.create(
            user=request.user,
            activity_type='journal',
            title="Added journal entry",
            description=journal_entry.title,
            metadata={'word_count': journal_entry.word_count}
        )
        
        return Response({
            'success': True,
            'entry': serializer.data,
            'message': 'Journal entry saved successfully!'
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])  # Temporary for development - file:// protocol issue
def goals_list(request):
    """Get goals for the authenticated user"""
    # Handle anonymous users for development
    if not request.user.is_authenticated:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(username='yasmeen')
        except User.DoesNotExist:
            user = User.objects.first()
        if not user:
            return Response({'error': 'No users found'}, status=404)
    else:
        user = request.user
    
    goals = Goal.objects.filter(user=user).order_by('-created_at')
    serializer = GoalSerializer(goals, many=True)
    
    return Response({
        'success': True,
        'goals': serializer.data
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_goal(request):
    """Create a new goal"""
    serializer = GoalSerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        goal = serializer.save()
        
        # Add to memory system
        memory_content = f"New goal created: {goal.title} - {goal.description}. Target: {goal.target_value} {goal.unit}"
        
        try:
            memory_service = MemoryService()
            memory_service.add_memory(
                user_id=str(request.user.id),
                content=memory_content,
                category="goals"
            )
        except Exception as e:
            print(f"Failed to add goal to memory: {e}")
        
        # Create activity record
        Activity.objects.create(
            user=request.user,
            activity_type='goal',
            title="Created new goal",
            description=goal.title,
            metadata={'category': goal.category, 'priority': goal.priority}
        )
        
        return Response({
            'success': True,
            'goal': serializer.data,
            'message': 'Goal created successfully!'
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])  # Temporary for development
def refresh_dashboard_data(request):
    """Refresh dashboard data by clearing/resetting all user data to zero"""
    
    # Handle anonymous users for development
    if not request.user.is_authenticated:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(username='yasmeen')
        except User.DoesNotExist:
            user = User.objects.first()
        if not user:
            return Response({'error': 'No users found'}, status=404)
    else:
        user = request.user
    
    try:
        # Clear all user data
        deleted_counts = {}
        
        # Delete all mood entries
        mood_count = MoodEntry.objects.filter(user=user).count()
        MoodEntry.objects.filter(user=user).delete()
        deleted_counts['mood_entries'] = mood_count
        
        # Delete all activities
        activity_count = Activity.objects.filter(user=user).count()
        Activity.objects.filter(user=user).delete()
        deleted_counts['activities'] = activity_count
        
        # Reset all goals to zero progress
        goals = Goal.objects.filter(user=user)
        goal_count = goals.count()
        for goal in goals:
            goal.current_value = 0
            goal.status = 'active'
            goal.save()
        deleted_counts['goals_reset'] = goal_count
        
        # Delete all journal entries
        journal_count = JournalEntry.objects.filter(user=user).count()
        JournalEntry.objects.filter(user=user).delete()
        deleted_counts['journal_entries'] = journal_count
        
        # Delete all meditation sessions
        meditation_count = MeditationSession.objects.filter(user=user).count()
        MeditationSession.objects.filter(user=user).delete()
        deleted_counts['meditation_sessions'] = meditation_count
        
        # Delete all appointments
        appointment_count = Appointment.objects.filter(user=user).count()
        Appointment.objects.filter(user=user).delete()
        deleted_counts['appointments'] = appointment_count
        
        # Create a single activity to show refresh happened
        Activity.objects.create(
            user=user,
            activity_type='other',
            title="🔄 Dashboard Reset",
            description=f"All user data cleared and reset to zero at {timezone.now().strftime('%H:%M:%S')}",
            metadata={
                'refresh_time': timezone.now().isoformat(),
                'reset_type': 'full_data_clear',
                'deleted_counts': deleted_counts
            }
        )
        
        return Response({
            'success': True,
            'message': 'All user data has been reset to zero!',
            'timestamp': timezone.now().isoformat(),
            'changes': {
                'data_cleared': True,
                'reset_type': 'full_reset',
                'data_refresh_time': timezone.now().strftime('%H:%M:%S'),
                'deleted_counts': deleted_counts
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to reset dashboard data'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
