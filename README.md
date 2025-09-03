# 🧠 Heal & Hope (HH) - CBT Mental Health Platform

A comprehensive mental health platform featuring Cognitive Behavioral Therapy (CBT) tools, AI-powered support, and personalized dashboard for mental wellness tracking. **Primarily designed for Indian users** with culturally sensitive mental health support and local crisis resources.

[![Python](https://img.shields.io/badge/python-v3.8+-blue.svg)](https://www.python.org/downloads/)
[![Django](https://img.shields.io/badge/django-v5.2.5-green.svg)](https://djangoproject.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
