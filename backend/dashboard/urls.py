from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'mood-entries', views.MoodEntryViewSet, basename='moodentry')
router.register(r'journal-entries', views.JournalEntryViewSet, basename='journalentry')
router.register(r'goals', views.GoalViewSet, basename='goal')
router.register(r'activities', views.ActivityViewSet, basename='activity')
router.register(r'appointments', views.AppointmentViewSet, basename='appointment')
router.register(r'meditation-sessions', views.MeditationSessionViewSet, basename='meditationsession')

urlpatterns = [
    # Explicit endpoints BEFORE the router — prevents router matching them
    # as detail routes with pk='analytics', pk='create', etc.
    path('api/mood-entries/analytics/', views.mood_entry_analytics, name='mood-analytics'),
    path('api/mood-entries/create/', views.create_mood_entry, name='create-mood-entry'),
    path('api/mood-entries/', views.mood_entries, name='mood-entries'),
    path('api/goals/create/', views.create_goal, name='create-goal'),
    path('api/goals/', views.goals_list, name='goals-list'),
    path('api/journal-entries/create/', views.create_journal_entry, name='create-journal-entry'),
    path('api/journal-entries/analyse/', views.analyse_journal_sentiment, name='journal-sentiment'),
    path('api/journal-entries/', views.journal_entries, name='journal-entries'),

    # Router (handles all viewset CRUD + custom actions)
    path('api/', include(router.urls)),

    # Standalone views
    path('api/dashboard-overview/', views.dashboard_overview, name='dashboard-overview'),
    path('api/user-settings/', views.user_settings, name='user-settings'),
    path('api/user-activities/', views.user_activities, name='user-activities'),
    path('api/refresh-data/', views.refresh_dashboard_data, name='refresh-data'),
    path('api/reddit-feed/', views.reddit_feed, name='reddit-feed'),
    path('api/safety-plan/', views.safety_plan_get, name='safety-plan-get'),
    path('api/safety-plan/save/', views.safety_plan_save, name='safety-plan-save'),
    path('api/safety-plan/suggestions/', views.safety_plan_suggestions, name='safety-plan-suggestions'),
]
