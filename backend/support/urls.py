from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Add support-related viewsets here when needed

urlpatterns = [
    path('api/', include(router.urls)),
]
