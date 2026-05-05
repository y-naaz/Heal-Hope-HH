"""
Django settings for mental_health_backend project.
All sensitive values are read from environment variables (see .env.example).
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file if present (development convenience)
load_dotenv(BASE_DIR / '.env')


# ─── Core security ────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-dev-only-change-in-production')

DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

_allowed = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(',') if h.strip()]


# ─── Application definition ───────────────────────────────────────────────────
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'channels',
    'corsheaders',
    'whitenoise.runserver_nostatic',
    'users',
    'chat',
    'support',
    'dashboard',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mental_health_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mental_health_backend.wsgi.application'
ASGI_APPLICATION = 'mental_health_backend.asgi.application'


# ─── Database ─────────────────────────────────────────────────────────────────
# Uses PostgreSQL when DATABASE_URL is set, otherwise falls back to SQLite (dev)
_database_url = os.environ.get('DATABASE_URL', '')
if _database_url and _database_url.startswith('postgresql'):
    import dj_database_url
    DATABASES = {'default': dj_database_url.config(default=_database_url, conn_max_age=600)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# ─── Password validation ──────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'users.CustomUser'


# ─── Internationalisation ─────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# ─── Static & Media files ─────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    d for d in [BASE_DIR / 'static'] if d.exists()
]
# WhiteNoise serves static files efficiently in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ─── CORS ─────────────────────────────────────────────────────────────────────
_cors_raw = os.environ.get('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_raw.split(',') if o.strip()] or [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
]
# NEVER open CORS to all origins in production
CORS_ALLOW_ALL_ORIGINS = DEBUG  # True only in dev
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_NULL_ORIGIN = DEBUG  # Needed for file:// in dev only
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]


# ─── REST Framework ───────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/min',
        'user': '200/min',
    },
}


# ─── CSRF ─────────────────────────────────────────────────────────────────────
# In production the frontend must be served from the same origin or use the
# token correctly. Keep CSRF enabled.
CSRF_COOKIE_HTTPONLY = False   # Front-end JS needs to read the token
CSRF_USE_SESSIONS = False
if not DEBUG:
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'


# ─── Channels / Redis ─────────────────────────────────────────────────────────
_redis_url = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/0')
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [_redis_url],
        },
    },
}


# ─── Logging ─────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}


# ─── Email ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.sendgrid.net')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@healhope.com')


# ─── Custom User Model ────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'users.CustomUser'


# ─── Session ─────────────────────────────────────────────────────────────────
SESSION_COOKIE_AGE = 86400          # 24 hours
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_COOKIE_SECURE = not DEBUG   # HTTPS-only in production
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_NAME = 'healhope_sessionid'


# ─── CSRF trusted origins (expanded at deploy time via env) ───────────────────
_csrf_raw = os.environ.get('CORS_ALLOWED_ORIGINS', '')
_csrf_origins = [o.strip() for o in _csrf_raw.split(',') if o.strip()]
CSRF_TRUSTED_ORIGINS = _csrf_origins or [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]


# ─── AI / Memory Configuration ───────────────────────────────────────────────
AI_SERVICE = os.environ.get('AI_SERVICE', 'openai')   # 'openai' or 'gemini'
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
MEM0_API_KEY = os.environ.get('MEM0_API_KEY', '')
VECTOR_DB_TYPE = os.environ.get('VECTOR_DB_TYPE', 'chroma')
VECTOR_DB_PATH = os.environ.get('VECTOR_DB_PATH', str(BASE_DIR / 'vector_db'))
DEFAULT_MODEL = os.environ.get('DEFAULT_MODEL', 'gpt-3.5-turbo')
EMBEDDING_MODEL = os.environ.get('EMBEDDING_MODEL', 'text-embedding-ada-002')
DEBUG_AI = os.environ.get('DEBUG_AI', 'False').lower() == 'true'


# Ensure logs directory exists
os.makedirs(BASE_DIR / 'logs', exist_ok=True)

