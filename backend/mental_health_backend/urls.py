"""
URL configuration for mental_health_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.authtoken.views import obtain_auth_token
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({
        'status': 'healthy',
        'message': 'Mental Health Backend API is running',
        'endpoints': {
            'chat': '/chat/',
            'users': '/users/',
            'support': '/support/',
            'admin': '/admin/',
            'websocket': '/ws/support/<user_id>/'
        }
    })

urlpatterns = [
    path('', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('chat/', include('chat.urls')),
    path('users/', include('users.urls')),
    path('support/', include('support.urls')),
    path('api-auth/', include('rest_framework.urls')),
    path('api-token-auth/', obtain_auth_token, name='api_token_auth'),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
