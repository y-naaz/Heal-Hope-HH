# 🧠 MindWell — Mental Health & Wellness Platform

A full-stack mental health platform with AI-powered chat support, real-time community, mood tracking, journaling, goal management, and support groups. Designed for Indian users with culturally sensitive responses and local crisis resources.

**Live Demo:**
- 🌐 Frontend: [heal-hope-hh.vercel.app](https://heal-hope-hh.vercel.app)
- ⚙️ Backend API: [mindwell-backend.onrender.com](https://mindwell-backend.onrender.com)

[![Django](https://img.shields.io/badge/Django-5.2.5-green.svg)](https://djangoproject.com/)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Channels](https://img.shields.io/badge/Django_Channels-4.1-purple.svg)](https://channels.readthedocs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

### 🤖 AI Chat Support
- **Groq + Llama 3.3 70B** as primary AI (14,400 free req/day)
- Google Gemini 2.0 Flash as fallback
- MindWell persona — warm, non-judgmental, culturally aware
- Multi-turn conversation history
- Crisis detection with immediate Indian helpline resources
- Circuit-breaker prevents quota spam errors

### 💬 Real-Time Community
- **WebSocket-powered community feed** — posts appear instantly for all users
- Post categories: General Support, Success Story, Question, Resource Share
- Anonymous posting option
- Like system with live count updates
- HTTP fallback when WebSocket unavailable

### 👥 Support Groups
- 3 default groups: Anxiety Support Circle, Depression Recovery Hub, Young Adults Circle
- Join / Leave groups with real member counts
- **Members-only real-time group chat** via WebSocket
- Group types: Open, Moderated, Age-specific
- Format: Online, Hybrid, In-person

### 📊 Personal Dashboard
- Mood tracking with trend analytics and charts
- Private journal with writing streaks
- Goal setting and progress tracking
- Appointment scheduling
- Meditation session logging
- AI-generated personalized insights

### 🛡️ Coping Tools
- **Box Breathing** interactive timer (4-4-4-4)
- **5-4-3-2-1 Grounding** technique with guided prompts
- **Ice Cube** distress tolerance technique
- Modal-based with animations

### 📧 Notifications
- Gmail SMTP email notifications
- Goal deadline reminders (daily cron at 08:00 UTC)
- Web Push notifications (VAPID)

### 🔐 Authentication
- Email/password registration and login
- DRF Token auth + Django session auth
- Auth tokens passed as `?token=` for WebSocket connections

---

## 🏗️ Architecture

```
Heal-Hope-HH/
├── backend/                          # Django 5.2 + Daphne ASGI
│   ├── mental_health_backend/
│   │   ├── settings.py               # All config via env vars
│   │   ├── urls.py
│   │   └── asgi.py                   # Channels routing
│   ├── chat/
│   │   ├── models.py                 # ChatRoom, Message, CommunityPost, SupportGroup
│   │   ├── consumers.py              # ChatConsumer, CommunityConsumer, GroupChatConsumer
│   │   ├── ai_support.py             # Groq/Gemini AI with circuit-breaker
│   │   ├── views.py                  # AI chat, community posts/groups REST API
│   │   └── routing.py                # WebSocket URL patterns
│   ├── dashboard/
│   │   ├── models.py                 # Mood, Journal, Goal, Activity, Appointment
│   │   └── views.py                  # Dashboard REST API + AI insights
│   ├── users/
│   │   ├── models.py                 # CustomUser, PushSubscription
│   │   └── views.py                  # Auth, profile, push notifications
│   ├── email_service.py              # Gmail SMTP helpers
│   ├── requirements.txt
│   └── .env.example
├── mental-health-website/            # Vanilla JS frontend (Vercel)
│   ├── index.html                    # Landing page
│   ├── dashboard.html                # Main app (meta tags → Render URL)
│   ├── scripts/
│   │   ├── main.js                   # Auth, landing page
│   │   └── dashboard.js              # All dashboard logic, WS, community, groups
│   └── styles/
│       ├── main.css
│       ├── dashboard.css
│       └── chat.css
├── render.yaml                       # Render deployment config
└── vercel.json                       # Vercel static deployment config
```

### WebSocket Routes
| URL | Consumer | Auth |
|---|---|---|
| `ws/chat/<room>/` | `ChatConsumer` | Token or session |
| `ws/community/` | `CommunityConsumer` | Token or session |
| `ws/community/group/<id>/` | `GroupChatConsumer` | Token, members-only |
| `ws/support/<user_id>/` | `SupportConsumer` | Token or session |
| `ws/crisis/<user_id>/` | `CrisisConsumer` | Token or session |

> WebSocket auth: since browsers can't send custom headers on WS connections, the token is passed as `?token=<key>` in the URL and resolved server-side.

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- Git
- [Groq API key](https://console.groq.com) (free, 14,400 req/day)

### 1. Clone
```bash
git clone https://github.com/y-naaz/Heal-Hope-HH.git
cd Heal-Hope-HH
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Variables
```bash
cp .env.example .env
```

Edit `.env`:
```env
DEBUG=True
SECRET_KEY=any-random-string-for-dev

# AI (get free key at console.groq.com)
GROQ_API_KEY=gsk_...

# Optional — Gemini fallback (get at aistudio.google.com)
GOOGLE_API_KEY=AIza...

# Email (optional for dev — uses console backend when DEBUG=True)
EMAIL_HOST_USER=yourname@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### 4. Database & Seed Data
```bash
python manage.py migrate
python manage.py seed_support_groups    # seeds 3 default support groups
```

### 5. Run
```bash
python manage.py runserver 8000
```

### 6. Frontend
Open `mental-health-website/index.html` in a browser, or use Live Server in VS Code.

The JS automatically detects `localhost` and uses `http://localhost:8000` regardless of the meta tag.

---

## 🔑 API Reference

### Authentication (`/users/`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/users/auth/signup/` | Register |
| POST | `/users/auth/login/` | Login → returns `token` |
| POST | `/users/auth/logout/` | Logout |
| GET | `/users/auth/profile/` | Get profile |
| GET | `/users/auth/status/` | Check auth (token or session) |

### Dashboard (`/dashboard/`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/overview/` | Stats, mood trend, goals |
| POST/GET | `/dashboard/mood-entries/` | Mood logging |
| POST/GET | `/dashboard/journal-entries/` | Journal |
| POST/GET | `/dashboard/goals/` | Goals |
| POST/GET | `/dashboard/appointments/` | Appointments |

### Chat & AI (`/chat/`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat/ai-chat/` | AI chat (Groq/Gemini) |
| GET/POST | `/chat/community/posts/` | Community posts |
| POST | `/chat/community/posts/<id>/like/` | Toggle like |
| GET | `/chat/community/groups/` | List support groups |
| POST | `/chat/community/groups/<id>/join/` | Toggle join/leave |

---

## 🚢 Deployment

### Stack
- **Backend**: Render (free tier, Daphne ASGI)
- **Frontend**: Vercel (static)
- **Database**: Render PostgreSQL (free tier)
- **Redis**: Render Redis (WebSocket channel layer)

### Environment Variables (set in Render dashboard)

| Key | Description |
|---|---|
| `SECRET_KEY` | Django secret key (auto-generated by Render) |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `mindwell-backend.onrender.com,.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://heal-hope-hh.vercel.app,https://healhope.vercel.app` |
| `DATABASE_URL` | Auto-set by Render PostgreSQL |
| `REDIS_URL` | Auto-set by Render Redis |
| `GROQ_API_KEY` | Groq API key |
| `GOOGLE_API_KEY` | Gemini API key (fallback) |
| `EMAIL_HOST_USER` | Gmail address |
| `EMAIL_HOST_PASSWORD` | Gmail App Password |
| `VAPID_PUBLIC_KEY` | Web push public key |
| `VAPID_PRIVATE_KEY` | Web push private key |
| `VAPID_CLAIMS_EMAIL` | `mailto:admin@healhope.com` |

### Post-Deploy Steps
```bash
# In Render Shell (or add to buildCommand):
python manage.py seed_support_groups
```

### Deploy Triggers
- Push to `main` → Render auto-deploys backend, Vercel auto-deploys frontend

---

## 🆘 Crisis Resources (India)

| Resource | Contact |
|---|---|
| Emergency | **112** |
| iCall (Mon–Sat 8AM–10PM) | **9152987821** |
| Vandrevala Foundation (24/7) | **1860-2662-345** |
| AASRA (24/7) | **9820466627** |
| Sneha India (24/7) | **044-24640050** |

---

## 🐛 Troubleshooting

**Chatbot not responding / quota errors**
The circuit-breaker in `ai_support.py` trips after a 429 quota error and falls back to static responses for 1 hour. Groq free tier resets daily. Switch API key or wait.

**WebSocket connection failing**
- On localhost: ensure Django server is running on port 8000
- On deployed: check Render Redis is running (channel layer requires Redis)
- Auth error: make sure `authToken` is in localStorage before opening chat

**CORS errors on deployed site**
Set `CORS_ALLOWED_ORIGINS` in Render dashboard to match your exact Vercel URL (no trailing slash).

**Build failing on Render**
Check Render → Events → Logs. Common causes: missing env var, `mem0ai` install failure.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.


## 🌟 Features

### 🎯 Core Functionality
- **Interactive Dashboard**: Personal mental health tracking with mood analytics, journal entries, and goal setting
- **AI-Powered Chatbot**: Google Gemini AI integration for intelligent mental health support and conversations
- **Mood Tracking**: Daily mood logging with analytics and trend analysis
- **Journal System**: Private journaling with word count tracking and writing streaks
- **Goal Management**: Set, track, and achieve personal mental health goals
- **Memory System**: Personalized AI memory for contextual conversations
- **Real-time Chat**: WebSocket-powered chat system with room management
- **Appointment Scheduling**: Book and manage therapy appointments
- **Meditation Tracking**: Log meditation sessions with progress analytics

### 🛡️ Security & Development Features
- **Authentication System**: Secure user registration and login
- **Development Mode**: Anonymous user support for testing (file:// protocol compatible)
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **RESTful APIs**: Comprehensive API endpoints for all functionality
- **Database Management**: Automated migrations and demo data setup

## 🏗️ Project Architecture

```
CBT/
├── backend/                           # Django Backend
│   ├── mental_health_backend/         # Main Django project
│   │   ├── settings.py               # Django settings with CORS, authentication
│   │   ├── urls.py                   # Main URL configuration
│   │   ├── asgi.py                   # ASGI config for WebSockets
│   │   └── wsgi.py                   # WSGI config for production
│   ├── users/                        # User Management App
│   │   ├── models.py                 # Custom user models
│   │   ├── views.py                  # User authentication views
│   │   └── management/commands/      # Custom management commands
│   ├── dashboard/                    # Dashboard & Analytics App
│   │   ├── models.py                 # Mood, Journal, Goal, Activity models
│   │   ├── views.py                  # Dashboard API endpoints
│   │   ├── serializers.py            # DRF serializers
│   │   └── authentication.py        # Custom authentication classes
│   ├── chat/                         # Chat & AI Integration
│   │   ├── models.py                 # Chat rooms, messages, memory models
│   │   ├── consumers.py              # WebSocket consumers
│   │   ├── ai_support.py             # Google Gemini AI integration
│   │   ├── memory_service.py         # AI memory management
│   │   └── rag_service.py            # RAG (Retrieval Augmented Generation)
│   ├── support/                      # Support Features
│   ├── requirements.txt              # Python dependencies
│   ├── .env.example                  # Environment variables template
│   └── manage.py                     # Django management script
├── mental-health-website/            # Frontend Application
│   ├── index.html                    # Landing page
│   ├── dashboard.html                # User dashboard interface
│   ├── styles/                       # CSS stylesheets
│   │   ├── main.css                  # Main website styles
│   │   ├── dashboard.css             # Dashboard-specific styles
│   │   └── chat.css                  # Chat interface styles
│   └── scripts/                      # JavaScript files
│       ├── main.js                   # Main website functionality
│       └── dashboard.js              # Dashboard API interactions
└── README.md                         # This documentation
```

## 🚀 Quick Start Guide

### Prerequisites

- **Python 3.8+** - [Download Python](https://www.python.org/downloads/)
- **Git** - [Download Git](https://git-scm.com/downloads)
- **Google Gemini API Key** - [Get API Key](https://ai.google.dev/)
- **Modern Web Browser** (Chrome, Firefox, Safari, Edge)

### 1. Clone the Repository

```bash
git clone https://github.com/y-naaz/Heal-Hope-HH.git
cd Heal-Hope-HH
```

### 2. Backend Setup

#### Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your configuration:
   ```env
   # Google Gemini AI Configuration
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Django Settings
   DEBUG=True
   SECRET_KEY=your_django_secret_key_here
   
   # Database (SQLite by default)
   DATABASE_URL=sqlite:///db.sqlite3
   
   # CORS Settings (for development)
   CORS_ALLOW_ALL_ORIGINS=True
   ```

#### Database Setup

```bash
# Run migrations to create database tables
python manage.py migrate

# Create demo user for testing (optional)
python manage.py create_demo_user

# Initialize memory system for AI
python manage.py init_memory_system

# Setup demo chat room (optional)
python manage.py setup_demo_room
```

#### Start the Development Server

```bash
python manage.py runserver
```

Backend will be available at: `http://localhost:8000`

### 3. Frontend Setup

#### Option A: Using Live Server (Recommended)

1. Open the `mental-health-website` folder in VS Code
2. Install "Live Server" extension
3. Right-click on `index.html` → "Open with Live Server"

#### Option B: Using Python HTTP Server

```bash
cd mental-health-website
python -m http.server 8080
```

Frontend will be available at: `http://localhost:8080`

#### Option C: Direct File Access

Simply open `mental-health-website/index.html` in your browser.

**Note**: For full functionality, use Option A or B as some features require proper server hosting.

## 🔧 Development Setup

### API Endpoints

#### Authentication
- `POST /api/users/register/` - User registration
- `POST /api/users/login/` - User login
- `GET /api/users/profile/` - Get user profile

#### Dashboard
- `GET /api/dashboard/overview/` - Get dashboard overview with stats
- `GET /api/dashboard/mood-entries/` - Get mood entries
- `POST /api/dashboard/mood-entries/` - Create mood entry
- `GET /api/dashboard/journal-entries/` - Get journal entries
- `POST /api/dashboard/journal-entries/` - Create journal entry
- `GET /api/dashboard/goals/` - Get goals
- `POST /api/dashboard/goals/` - Create goal
- `GET /api/dashboard/user-activities/` - Get user activities

#### Chat & AI
- `GET /api/chat/rooms/` - Get chat rooms
- `POST /api/chat/rooms/` - Create chat room
- `POST /api/chat/ai-support/` - Get AI response
- `WebSocket /ws/chat/{room_name}/` - Real-time chat

### Database Models

#### User & Authentication
- `User` - Custom user model with profile information
- `UserSettings` - User preferences and settings

#### Dashboard Models
- `MoodEntry` - Daily mood tracking with factors and notes
- `JournalEntry` - Personal journal entries with mood correlation
- `Goal` - Personal goals with progress tracking
- `Activity` - User activity log for all interactions
- `Appointment` - Therapy appointment scheduling
- `MeditationSession` - Meditation practice tracking

#### Chat & AI Models
- `ChatRoom` - Chat room management
- `Message` - Chat messages with user and timestamp
- `UserMemory` - AI memory system for personalized responses
- `KnowledgeBase` - RAG knowledge storage
- `PersonalizationProfile` - User personality and preference profiles

### Testing the Application

#### Backend API Testing

```bash
# Test Gemini AI integration
python test_gemini.py

# Test memory system
python test_memory_system.py

# Test informational queries
python test_informational_query.py

# Run Django tests
python manage.py test
```

#### Frontend Testing

1. **Landing Page**: Visit `http://localhost:8080/index.html`
2. **Dashboard**: Visit `http://localhost:8080/dashboard.html`
3. **API Integration**: Check browser console for any JavaScript errors

### Development Features

#### Anonymous User Support (Development Mode)

For development convenience, the application supports anonymous users:

- All dashboard endpoints work without authentication
- Falls back to demo user data when not authenticated
- Useful for frontend development and testing
- **Note**: Remove in production by changing `AllowAny` to `IsAuthenticated` in views

#### Debug Mode Features

- Detailed error messages
- Django Debug Toolbar support
- CORS enabled for all origins
- Console logging for AI interactions

## 🎨 Customization

### Adding New Features

1. **Backend**: Create new Django apps or extend existing ones
2. **Frontend**: Add new HTML pages and link them in navigation
3. **API**: Add new endpoints in `views.py` and register in `urls.py`
4. **Models**: Create new models and run migrations

### Styling

- Modify CSS files in `mental-health-website/styles/`
- Follow the existing color scheme and responsive design patterns
- Test on mobile devices for responsiveness

### AI Behavior

- Modify AI prompts in `chat/ai_support.py`
- Adjust memory system in `chat/memory_service.py`
- Customize personality traits in user profiles

## 🚢 Deployment

### Environment Variables for Production

```env
DEBUG=False
SECRET_KEY=your_production_secret_key
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:password@host:port/database
GEMINI_API_KEY=your_production_gemini_key
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Production Checklist

- [ ] Set `DEBUG=False`
- [ ] Configure production database (PostgreSQL recommended)
- [ ] Set up static file serving
- [ ] Configure HTTPS
- [ ] Set proper CORS origins
- [ ] Remove anonymous user support
- [ ] Set up proper logging
- [ ] Configure environment variables
- [ ] Set up database backups
- [ ] Configure error monitoring

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test dashboard
python manage.py test chat
python manage.py test users
```

### Manual Testing Checklist

#### Dashboard Functionality
- [ ] Mood entry creation and display
- [ ] Journal entry creation and editing
- [ ] Goal creation and progress tracking
- [ ] Analytics and insights generation
- [ ] Activity timeline display

#### Chat & AI
- [ ] Chat room creation and joining
- [ ] Real-time message delivery
- [ ] AI response generation
- [ ] Memory system functionality
- [ ] Context-aware conversations

#### Authentication
- [ ] User registration
- [ ] User login/logout
- [ ] Profile management
- [ ] Session handling

## 🐛 Troubleshooting

### Common Issues

#### Backend Issues

**Server won't start**
```bash
# Check for port conflicts
lsof -i :8000
# Kill conflicting processes
kill -9 <PID>
```

**Database errors**
```bash
# Reset database
rm db.sqlite3
python manage.py migrate
python manage.py create_demo_user
```

**Missing dependencies**
```bash
pip install -r requirements.txt
```

#### Frontend Issues

**API calls failing**
- Check if backend server is running on `http://localhost:8000`
- Verify CORS settings in Django settings
- Check browser console for error messages

**Styling issues**
- Clear browser cache
- Check CSS file paths
- Verify responsive design settings

#### AI Integration Issues

**Gemini API errors**
- Verify API key in `.env` file
- Check API quota and billing
- Review network connectivity

**Memory system not working**
- Run `python manage.py init_memory_system`
- Check database migrations
- Verify ChromaDB installation (optional)

### Debug Mode

Enable debug logging:

```python
# In settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'chat.ai_support': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Coding Standards

#### Backend (Python/Django)
- Follow PEP 8 style guide
- Use meaningful variable and function names
- Add docstrings to all functions and classes
- Write unit tests for new functionality
- Use Django best practices

#### Frontend (HTML/CSS/JavaScript)
- Use semantic HTML5 elements
- Follow responsive design principles
- Comment complex JavaScript functions
- Maintain consistent indentation
- Test across different browsers

### Commit Message Format

```
type(scope): brief description

longer description if needed

- List specific changes
- Reference issue numbers if applicable
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add yourself to contributors list
4. Request review from maintainers
5. Address feedback promptly

## 📚 Additional Resources

### Documentation
- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Google Gemini AI](https://ai.google.dev/docs)
- [WebSocket with Django Channels](https://channels.readthedocs.io/)

### Mental Health Resources

#### India-Specific Resources (Primary)
- **Emergency**: 112 (National Emergency Number)
- **National Suicide Prevention Helpline**: 9152987821
- **iCall Psychosocial Helpline**: 9152987821 (Monday-Saturday, 8 AM-10 PM)
- **Vandrevala Foundation**: 9999666555 (24x7 Helpline)
- **AASRA**: 91-9820466726 (24x7 Crisis Helpline)
- **Sneha India**: 044-24640050 (24x7 Suicide Prevention)
- **MPower 1 on 1**: Online counseling platform for Indians
- **YourDOST**: Mental health support for students and professionals

#### International Resources
- [National Suicide Prevention Lifeline](https://suicidepreventionlifeline.org/) - 988 (US)
- [Crisis Text Line](https://www.crisistextline.org/) - Text HOME to 741741 (US)
- [Mental Health America](https://www.mhanational.org/) (US)

### Support
- [Project Issues](https://github.com/y-naaz/Heal-Hope-HH/issues)
- [Discussions](https://github.com/y-naaz/Heal-Hope-HH/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for intelligent chat responses
- Django community for the excellent framework
- Mental health professionals who inspired this platform
- Open source contributors and testers

## ⚠️ Important Disclaimer

**This application is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. If you're experiencing a mental health crisis, please contact emergency services or a mental health professional immediately.**

### Crisis Resources

#### India (Primary)
- **Emergency**: 112 (National Emergency Number)
- **National Suicide Prevention Helpline**: 9152987821
- **Vandrevala Foundation**: 9999666555 (24x7)
- **AASRA**: 91-9820466726 (24x7)

#### International
- **Emergency**: 911 (US) or your local emergency number
- **National Suicide Prevention Lifeline**: 988 (US)
- **Crisis Text Line**: Text HOME to 741741 (US)

---

**Made with ❤️ for mental health awareness and support**

For questions, suggestions, or support, please [open an issue](https://github.com/y-naaz/Heal-Hope-HH/issues) or [start a discussion](https://github.com/y-naaz/Heal-Hope-HH/discussions).
