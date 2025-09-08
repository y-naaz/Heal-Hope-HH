from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for viewsets
router = DefaultRouter()
router.register(r'mood-entries', views.MoodEntryViewSet, basename='moodentry')
router.register(r'journal-entries', views.JournalEntryViewSet, basename='journalentry')
router.register(r'goals', views.GoalViewSet, basename='goal')
router.register(r'activities', views.ActivityViewSet, basename='activity')
router.register(r'appointments', views.AppointmentViewSet, basename='appointment')
router.register(r'meditation-sessions', views.MeditationSessionViewSet, basename='meditationsession')

urlpatterns = [
    # Include router URLs
    path('api/', include(router.urls)),
    
    # Dashboard overview
    path('api/dashboard-overview/', views.dashboard_overview, name='dashboard-overview'),
    
    # User settings
    path('api/user-settings/', views.user_settings, name='user-settings'),
    
    # User activities
    path('api/user-activities/', views.user_activities, name='user-activities'),
    
    # Mood endpoints (alternative to viewset)
    path('api/mood-entries/', views.mood_entries, name='mood-entries'),
    path('api/mood-entries/create/', views.create_mood_entry, name='create-mood-entry'),
    
    # Journal endpoints (alternative to viewset)
    path('api/journal-entries/', views.journal_entries, name='journal-entries'),
    path('api/journal-entries/create/', views.create_journal_entry, name='create-journal-entry'),
    
    # Goals endpoints (alternative to viewset)
    path('api/goals/', views.goals_list, name='goals-list'),
    path('api/goals/create/', views.create_goal, name='create-goal'),
    
    # Refresh endpoint
    path('api/refresh-data/', views.refresh_dashboard_data, name='refresh-data'),
]
