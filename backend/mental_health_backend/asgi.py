"""
ASGI config for mental_health_backend project.
"""

import os

# MUST be set before any Django/app imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mental_health_backend.settings')

from django.core.asgi import get_asgi_application

# Boot Django fully before importing any app code
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from chat.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
