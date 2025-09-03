from rest_framework.authentication import SessionAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Custom session authentication that exempts CSRF validation for development.
    This is needed for file:// protocol requests during development.
    """
    def enforce_csrf(self, request):
        # Disable CSRF for API endpoints during development
        return
