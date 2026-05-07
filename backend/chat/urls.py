from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'rooms', views.ChatRoomViewSet, basename='chatroom')
router.register(r'messages', views.MessageViewSet, basename='message')
router.register(r'crisis-alerts', views.CrisisAlertViewSet, basename='crisisalert')
router.register(r'ai-assistant', views.AIAssistantViewSet, basename='aiassistant')

urlpatterns = [
    path('api/', include(router.urls)),
    path('memory/add/', views.memory_add, name='memory-add'),
    path('memory/search/', views.memory_search, name='memory-search'),
    path('memory/profile/', views.memory_profile, name='memory-profile'),
]
