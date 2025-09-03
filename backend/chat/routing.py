from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),
    re_path(r'ws/support/(?P<user_id>\w+)/$', consumers.SupportConsumer.as_asgi()),
    re_path(r'ws/crisis/(?P<user_id>\w+)/$', consumers.CrisisConsumer.as_asgi()),
]
