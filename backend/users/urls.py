from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Add user-related viewsets here when needed

urlpatterns = [
    path('api/', include(router.urls)),
    path('auth/signup/', views.SignupView.as_view(), name='signup'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/profile/', views.user_profile, name='user_profile'),
    path('auth/status/', views.check_auth_status, name='auth_status'),
    # Web Push
    path('push/vapid-public-key/', views.vapid_public_key, name='vapid_public_key'),
    path('push/subscribe/', views.push_subscribe, name='push_subscribe'),
    path('push/unsubscribe/', views.push_unsubscribe, name='push_unsubscribe'),
    path('push/send-reminders/', views.send_goal_reminders, name='send_goal_reminders'),
]
