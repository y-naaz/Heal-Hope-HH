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
]
