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
]
