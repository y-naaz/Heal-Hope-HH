import os
import time
import requests as http_requests
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Avg, Q, Max, Min
from datetime import datetime, timedelta, date
from collections import Counter
import json

# Simple in-process cache for Reddit feed (avoids Redis dependency for this feature)
_reddit_cache = {}  # {key: (timestamp, data)}

from .models import (
    MoodEntry, JournalEntry, Goal, Activity, Appointment,
    UserSettings, MeditationSession, DashboardInsight, SafetyPlan
)
from .serializers import (
    MoodEntrySerializer, JournalEntrySerializer, GoalSerializer,
    ActivitySerializer, AppointmentSerializer, UserSettingsSerializer,
    MeditationSessionSerializer, DashboardInsightSerializer,
    MoodAnalyticsSerializer, DashboardStatsSerializer, RecentActivitySerializer,
    SafetyPlanSerializer
)
from chat.memory_service import MemoryService

class MoodEntryViewSet(viewsets.ModelViewSet):
    serializer_class = MoodEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        return MoodEntry.objects.filter(user=user)

    def create(self, request):
        date = request.data.get('date')
        existing = MoodEntry.objects.filter(user=request.user, date=date).first()

        if existing:
            # Update the existing entry for this day instead of inserting a duplicate
            serializer = self.get_serializer(existing, data=request.data, partial=False)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            mood_data = serializer.data
            created = False
        else:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(user=request.user)
            mood_data = serializer.data
            created = True

        # Add to memory system for personalization
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

        if created:
            Activity.objects.create(
                user=request.user,
                activity_type='mood',
                title=f"Logged mood: {mood_data['mood'].replace('-', ' ').title()}",
                description=mood_data.get('note', ''),
                metadata={'mood': mood_data['mood'], 'score': mood_data['score']}
            )

        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response({'success': True, **mood_data}, status=http_status)

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

        # Weekly windows
        week_ago = timezone.now().date() - timedelta(days=7)
        this_week = mood_entries.filter(date__gte=week_ago)
        last_week = mood_entries.filter(
            date__gte=week_ago - timedelta(days=7),
            date__lt=week_ago
        )

        this_week_avg = this_week.aggregate(Avg('score'))['score__avg'] or 0
        last_week_avg = last_week.aggregate(Avg('score'))['score__avg'] or 0

        # "This Week's Average" — only current-week entries
        average_score = this_week_avg

        # Most common mood (this week only, fall back to all-time)
        week_moods = list(this_week.values_list('mood', flat=True))
        mood_counts = Counter(week_moods) if week_moods else Counter(mood_entries.values_list('mood', flat=True))
        most_common_mood = mood_counts.most_common(1)[0][0] if mood_counts else None

        weekly_improvement = round((this_week_avg - last_week_avg) / last_week_avg * 100, 1) if last_week_avg > 0 else None
        
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
            'weekly_improvement': weekly_improvement,
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
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
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
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
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
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        return Activity.objects.filter(user=user)

class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
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
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
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
@permission_classes([IsAuthenticated])
def mood_entry_analytics(request):
    """Explicit analytics endpoint — mirrors MoodEntryViewSet.analytics."""
    user = request.user
    mood_entries = MoodEntry.objects.filter(user=user).order_by('-date')

    if not mood_entries.exists():
        return Response({
            'success': True,
            'analytics': {
                'average_score': None,
                'most_common_mood': None,
                'weekly_improvement': None,
                'total_entries': 0,
            }
        })

    week_ago = timezone.now().date() - timedelta(days=7)
    this_week = mood_entries.filter(date__gte=week_ago)
    last_week = mood_entries.filter(date__gte=week_ago - timedelta(days=7), date__lt=week_ago)

    this_week_avg = this_week.aggregate(Avg('score'))['score__avg']
    last_week_avg = last_week.aggregate(Avg('score'))['score__avg']

    week_moods = list(this_week.values_list('mood', flat=True))
    mood_counts = Counter(week_moods) if week_moods else Counter(mood_entries.values_list('mood', flat=True))
    most_common_mood = mood_counts.most_common(1)[0][0] if mood_counts else None

    weekly_improvement = None
    if this_week_avg is not None and last_week_avg:
        weekly_improvement = round((this_week_avg - last_week_avg) / last_week_avg * 100, 1)

    return Response({
        'success': True,
        'analytics': {
            'average_score': round(this_week_avg, 1) if this_week_avg else None,
            'most_common_mood': most_common_mood,
            'weekly_improvement': weekly_improvement,
            'total_entries': mood_entries.count(),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_overview(request):
    """Get comprehensive dashboard overview with all stats"""
    user = request.user

    # Use client-supplied date to handle timezone differences (frontend sends YYYY-MM-DD)
    client_date = request.query_params.get('today')
    try:
        today = datetime.strptime(client_date, '%Y-%m-%d').date() if client_date else timezone.now().date()
    except ValueError:
        today = timezone.now().date()
    
    # Today's mood
    today_mood_entry = MoodEntry.objects.filter(user=user, date=today).first()
    today_mood = today_mood_entry.mood if today_mood_entry else None
    
    # Calculate mood change from yesterday
    yesterday = today - timedelta(days=1)
    yesterday_mood = MoodEntry.objects.filter(user=user, date=yesterday).first()
    # None = no yesterday entry (can't compute), 0 = same score, else % change
    mood_change = None
    if today_mood_entry and yesterday_mood:
        if yesterday_mood.score != 0:
            mood_change = round(((today_mood_entry.score - yesterday_mood.score) / yesterday_mood.score) * 100, 1)
        else:
            mood_change = 0
    
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
                'change': mood_change
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
            'labels': [entry['day'] for entry in mood_chart_data],
            'scores': [entry['score'] for entry in mood_chart_data],  # None for days with no entry
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
@permission_classes([IsAuthenticated])
def user_activities(request):
    """Get user activities with pagination"""
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
@permission_classes([IsAuthenticated])
def mood_entries(request):
    """Get mood entries for the authenticated user"""
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
    """Create or update today's mood entry (one entry per user per date)"""
    date = request.data.get('date')
    existing = MoodEntry.objects.filter(user=request.user, date=date).first()

    if existing:
        serializer = MoodEntrySerializer(existing, data=request.data, context={'request': request}, partial=False)
    else:
        serializer = MoodEntrySerializer(data=request.data, context={'request': request})

    if serializer.is_valid():
        mood_entry = serializer.save()
        created = not bool(existing)

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

        if created:
            Activity.objects.create(
                user=request.user,
                activity_type='mood',
                title=f"Logged mood: {mood_entry.mood.replace('-', ' ').title()}",
                description=mood_entry.note or '',
                metadata={'mood': mood_entry.mood, 'score': mood_entry.score}
            )

        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response({
            'success': True,
            'mood_entry': serializer.data,
            'message': 'Mood logged successfully!'
        }, status=http_status)

    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyse_journal_sentiment(request):
    """Use Claude AI to analyse journal entry sentiment."""
    import json as _json
    text = request.data.get('text', '').strip()
    if not text:
        return Response({'error': 'No text provided'}, status=400)

    FALLBACK = {
        'success': True,
        'label': 'Partly Cloudy', 'icon': '⛅', 'score': 0,
        'suggestion': "Take a moment to breathe and check in with yourself. Even writing a few words is a meaningful step.",
        'actions': ['🌬️ Breathing Exercise', '📋 View Resources']
    }

    prompt = f"""You are a compassionate journaling companion. Analyse this journal entry and reply with ONLY valid JSON — no markdown, no explanation.

Journal entry:
\"\"\"{text[:1500]}\"\"\"

Reply with exactly this JSON:
{{
  "label": "Bright" | "Partly Cloudy" | "Cloudy",
  "icon": "☀️" | "⛅" | "🌧️",
  "score": <integer -10 to 10>,
  "suggestion": "<warm 2-3 sentence paragraph, no clinical words like negative/positive/sentiment/disorder>",
  "actions": ["<emoji + short label>", "<emoji + short label>"]
}}

Rules:
- Bright (3..10): hopeful, grateful, joyful, peaceful tone
- Partly Cloudy (-2..2): mixed, reflective, neutral
- Cloudy (-10..-3): heavy, sad, anxious, overwhelmed
- actions examples: "🧘 Try Meditation", "🎯 Set a Goal", "💬 Talk to Someone", "🌬️ Breathing Exercise", "📋 View Resources" """

    try:
        import google.generativeai as genai
        from django.conf import settings as s
        key = getattr(s, 'GEMINI_API_KEY', '') or os.environ.get('GOOGLE_API_KEY', '')
        if not key:
            return Response(FALLBACK)
        genai.configure(api_key=key)
        model = genai.GenerativeModel('models/gemini-2.0-flash')
        raw = model.generate_content(prompt).text.strip()
        if raw.startswith('```'):
            raw = raw.split('```')[1].lstrip('json').strip()
        result = _json.loads(raw)
        return Response({'success': True, **result})
    except Exception:
        return Response(FALLBACK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def journal_entries(request):
    """Get journal entries for the authenticated user."""
    entries = JournalEntry.objects.filter(user=request.user).order_by('-created_at')
    serializer = JournalEntrySerializer(entries, many=True)
    return Response({'success': True, 'entries': serializer.data})

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
@permission_classes([IsAuthenticated])
def goals_list(request):
    """Get goals for the authenticated user"""
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
@permission_classes([IsAuthenticated])
def refresh_dashboard_data(request):
    """Refresh dashboard data by clearing/resetting all user data to zero"""
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


# ── Safety Plan ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def safety_plan_get(request):
    plan, _ = SafetyPlan.objects.get_or_create(user=request.user)
    return Response({'success': True, 'plan': SafetyPlanSerializer(plan).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def safety_plan_save(request):
    plan, _ = SafetyPlan.objects.get_or_create(user=request.user)
    data = request.data.copy()

    # Mark as reviewed whenever explicitly saved
    if data.get('mark_reviewed'):
        data['last_reviewed_at'] = timezone.now().isoformat()

    serializer = SafetyPlanSerializer(plan, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({'success': True, 'plan': serializer.data})
    return Response({'success': False, 'errors': serializer.errors}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def safety_plan_suggestions(request):
    section = request.GET.get('section', 'general')

    SECTION_PROMPTS = {
        'warning_signs_personal': (
            "Give 5 concise, specific personal warning signs that someone might notice "
            "in themselves before a mental health crisis — thoughts, feelings, body sensations. "
            "Format as a simple numbered list, no headings."
        ),
        'warning_signs_observable': (
            "Give 5 concise observable behavioral warning signs that friends or family might "
            "notice in someone heading toward a mental health crisis. "
            "Numbered list, no headings."
        ),
        'coping_strategies': (
            "Give 6 evidence-based coping strategies someone can do alone to manage distress. "
            "Mix physical, mindfulness, and creative activities. "
            "Numbered list, brief (one sentence each), no headings."
        ),
        'environment_safety': (
            "Give 5 practical steps someone can take to make their home environment safer "
            "during a mental health crisis. Numbered list, no headings."
        ),
        'reasons_for_living': (
            "Give 6 prompts to help someone identify their own personal reasons for living — "
            "questions or sentence starters they can complete. Numbered list, no headings."
        ),
    }

    prompt = SECTION_PROMPTS.get(section, SECTION_PROMPTS['coping_strategies'])

    try:
        import google.generativeai as genai
        genai.configure(api_key=os.environ.get('GOOGLE_API_KEY', ''))
        model = genai.GenerativeModel('models/gemini-2.0-flash-lite')
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Parse numbered list into array
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        suggestions = []
        for line in lines:
            # Strip leading number + dot/paren
            import re
            cleaned = re.sub(r'^\d+[\.\)]\s*', '', line).strip()
            if cleaned:
                suggestions.append(cleaned)
        return Response({'success': True, 'suggestions': suggestions[:7]})
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=500)


# ── Reddit Community Feed Proxy ────────────────────────────────────────────────

ALLOWED_SUBS = {
    'mentalhealth', 'Anxiety', 'depression', 'IndianMentalHealth',
    'mindfulness', 'selfimprovement', 'meditation', 'therapy'
}

_REDDIT_CACHE_TTL = 900  # 15 minutes


def _reddit_cache_get(key):
    entry = _reddit_cache.get(key)
    if entry and (time.time() - entry[0]) < _REDDIT_CACHE_TTL:
        return entry[1]
    return None


def _reddit_cache_set(key, data):
    _reddit_cache[key] = (time.time(), data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reddit_feed(request):
    sub = request.GET.get('sub', 'mentalhealth')
    if sub not in ALLOWED_SUBS:
        sub = 'mentalhealth'

    cache_key = f'reddit_{sub}'
    cached = _reddit_cache_get(cache_key)
    if cached:
        return Response({'success': True, 'posts': cached, 'cached': True})

    try:
        url = f'https://www.reddit.com/r/{sub}/hot.json?limit=25&raw_json=1'
        headers = {
            'User-Agent': 'MindWell/1.0 mental-health-app (+https://heal-hope-hh.vercel.app)'
        }
        resp = http_requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        children = resp.json()['data']['children']

        posts = []
        for child in children:
            p = child['data']
            if p.get('over_18') or p.get('stickied'):
                continue
            text = (p.get('selftext') or '').strip()
            if text == '[removed]' or text == '[deleted]':
                text = ''
            posts.append({
                'id': p['id'],
                'title': p['title'],
                'text': text[:500],
                'url': f"https://www.reddit.com{p['permalink']}",
                'subreddit': p['subreddit'],
                'upvotes': p['ups'],
                'comments': p['num_comments'],
                'created_utc': p['created_utc'],
                'flair': p.get('link_flair_text') or '',
                'author': p.get('author', 'unknown'),
            })

        _reddit_cache_set(cache_key, posts)
        return Response({'success': True, 'posts': posts, 'cached': False})

    except http_requests.exceptions.Timeout:
        return Response({'success': False, 'error': 'Reddit took too long to respond.'}, status=504)
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=502)
