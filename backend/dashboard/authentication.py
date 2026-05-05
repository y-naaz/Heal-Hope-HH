from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Session authentication with CSRF exemption — used ONLY during local
    development when the frontend is opened via the file:// protocol.

    In production (DEBUG=False) the standard SessionAuthentication is used
    instead, so CSRF is fully enforced.  See settings.py REST_FRAMEWORK.
    """
    def enforce_csrf(self, request):
        # Skip CSRF only in development
        from django.conf import settings
        if settings.DEBUG:
            return
        # In production fall back to full CSRF enforcement
        super().enforce_csrf(request)

