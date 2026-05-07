from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.conf import settings
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import CustomUser, UserProfile, PushSubscription
from email_service import send_welcome_email
import json

@method_decorator(csrf_exempt, name='dispatch')
class SignupView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            
            # Extract user data
            email = data.get('email')
            password = data.get('password')
            first_name = data.get('firstName')
            last_name = data.get('lastName')
            
            # Validation
            if not all([email, password, first_name, last_name]):
                return JsonResponse({
                    'success': False,
                    'message': 'All fields are required'
                }, status=400)
            
            # Check if user already exists
            if CustomUser.objects.filter(email=email).exists():
                return JsonResponse({
                    'success': False,
                    'message': 'User with this email already exists'
                }, status=400)
            
            # Create user
            user = CustomUser.objects.create_user(
                username=email,  # Using email as username
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            
            # Create user profile
            UserProfile.objects.create(user=user)
            
            # Send welcome email (non-blocking — errors are logged, never raised)
            send_welcome_email(user)

            # Log the user in and issue an auth token
            login(request, user)
            token, _ = Token.objects.get_or_create(user=user)

            return JsonResponse({
                'success': True,
                'message': 'Account created successfully',
                'token': token.key,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'full_name': f"{user.first_name} {user.last_name}"
                }
            })
            
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'message': 'Invalid JSON data'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': 'An error occurred during signup'
            }, status=500)

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            
            email = data.get('email')
            password = data.get('password')
            
            if not email or not password:
                return JsonResponse({
                    'success': False,
                    'message': 'Email and password are required'
                }, status=400)
            
            # Authenticate user
            user = authenticate(request, username=email, password=password)
            
            if user is not None:
                login(request, user)
                token, _ = Token.objects.get_or_create(user=user)
                return JsonResponse({
                    'success': True,
                    'message': 'Login successful',
                    'token': token.key,
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'full_name': f"{user.first_name} {user.last_name}"
                    }
                })
            else:
                return JsonResponse({
                    'success': False,
                    'message': 'Invalid email or password'
                }, status=401)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'message': 'Invalid JSON data'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': 'An error occurred during login'
            }, status=500)

class LogoutView(View):
    def post(self, request):
        logout(request)
        return JsonResponse({
            'success': True,
            'message': 'Logged out successfully'
        })

def user_profile(request):
    """Get current user profile — accepts session cookie or Authorization: Token header."""
    user = request.user
    if not user.is_authenticated:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Token '):
            try:
                token_key = auth_header.split(' ', 1)[1]
                token_obj = Token.objects.select_related('user').get(key=token_key)
                user = token_obj.user
            except Token.DoesNotExist:
                pass

    if not user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'Authentication required'}, status=401)
    profile = getattr(user, 'profile', None)
    
    profile_data = {
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'full_name': f"{user.first_name} {user.last_name}",
        'date_of_birth': user.date_of_birth.isoformat() if user.date_of_birth else None,
        'phone_number': user.phone_number,
        'is_verified': user.is_verified,
        'created_at': user.created_at.isoformat(),
    }
    
    if profile:
        profile_data.update({
            'bio': profile.bio,
            'gender': profile.get_gender_display() if profile.gender else None,
            'location': profile.location,
            'current_crisis_level': profile.get_current_crisis_level_display(),
            'emergency_contact_name': profile.emergency_contact_name,
            'emergency_contact_phone': profile.emergency_contact_phone,
        })
    
    return JsonResponse({
        'success': True,
        'user': profile_data
    })

def check_auth_status(request):
    """Check if user is authenticated (session or token)."""
    user = request.user

    # Also support Bearer/Token header for cross-origin clients that can't use cookies
    if not user.is_authenticated:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Token '):
            try:
                token_key = auth_header.split(' ', 1)[1]
                token_obj = Token.objects.select_related('user').get(key=token_key)
                user = token_obj.user
            except Token.DoesNotExist:
                pass

    if user.is_authenticated:
        return JsonResponse({
            'authenticated': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': f"{user.first_name} {user.last_name}"
            }
        })
    return JsonResponse({'authenticated': False})


# ── Web Push Notification endpoints ──────────────────────────────────────────

@api_view(['GET'])
@permission_classes([])
def vapid_public_key(request):
    """Return VAPID public key so the frontend can subscribe."""
    key = getattr(settings, 'VAPID_PUBLIC_KEY', '')
    return Response({'publicKey': key})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def push_subscribe(request):
    """Store or refresh a browser push subscription for the current user."""
    endpoint = request.data.get('endpoint')
    p256dh   = request.data.get('p256dh')
    auth     = request.data.get('auth')

    if not all([endpoint, p256dh, auth]):
        return Response({'error': 'endpoint, p256dh and auth are required'}, status=400)

    PushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={'user': request.user, 'p256dh': p256dh, 'auth': auth}
    )
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def push_unsubscribe(request):
    """Remove a push subscription."""
    endpoint = request.data.get('endpoint')
    if endpoint:
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_goal_reminders(request):
    """
    Check goals with reminders enabled that are due today/overdue and
    send a push notification to all of the user's subscribed browsers.
    Called by the frontend on dashboard load.
    """
    from datetime import date, timedelta
    from dashboard.models import Goal

    today = date.today()
    subscriptions = PushSubscription.objects.filter(user=request.user)
    if not subscriptions.exists():
        return Response({'sent': 0, 'reason': 'no_subscriptions'})

    goals = Goal.objects.filter(user=request.user, status='active')
    notifications = []

    for goal in goals:
        if not goal.reminders:
            continue
        days_left = (goal.end_date - today).days if goal.end_date else None
        pct = int((goal.current_value / goal.target_value) * 100) if goal.target_value else 0

        if days_left is not None and days_left < 0:
            msg = f'⚠️ "{goal.title}" is overdue! You\'re at {pct}%.'
        elif days_left is not None and days_left <= 3:
            msg = f'⏰ "{goal.title}" is due in {days_left} day(s) — you\'re at {pct}%.'
        else:
            msg = f'💪 Keep going on "{goal.title}" — {pct}% complete!'

        notifications.append({'title': 'MindWell Reminder', 'body': msg, 'goalId': goal.id})

    if not notifications:
        return Response({'sent': 0, 'reason': 'no_active_reminders'})

    # Send push to each subscription
    try:
        from pywebpush import webpush, WebPushException
        import json as _json

        private_key = getattr(settings, 'VAPID_PRIVATE_KEY', '')
        claims_email = getattr(settings, 'VAPID_CLAIMS_EMAIL', 'mailto:admin@mindwell.com')
        sent = 0

        for sub in subscriptions:
            for notif in notifications:
                try:
                    webpush(
                        subscription_info={
                            'endpoint': sub.endpoint,
                            'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}
                        },
                        data=_json.dumps(notif),
                        vapid_private_key=private_key,
                        vapid_claims={'sub': claims_email}
                    )
                    sent += 1
                except WebPushException as e:
                    # Subscription expired — clean it up
                    if e.response and e.response.status_code in (404, 410):
                        sub.delete()
                    break  # skip remaining notifications for this dead sub

        return Response({'sent': sent})

    except ImportError:
        return Response({'error': 'pywebpush not installed'}, status=500)
    except Exception as e:
        return Response({'error': str(e)}, status=500)


