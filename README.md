# CBT Mental Health Platform

A comprehensive mental health platform featuring Cognitive Behavioral Therapy (CBT) tools and AI-powered support.

## 🌟 Features

- **Interactive CBT Website**: User-friendly frontend with beautiful chatbot interface
- **Django Backend**: Robust API with user management and chat functionality
- **AI Support**: Integrated AI chatbot for mental health support
- **Dashboard**: Personal dashboard for tracking mental health progress
- **Real-time Chat**: WebSocket-powered chat system for instant communication

## 🏗️ Project Structure

```
CBT/
├── backend/                    # Django backend application
│   ├── mental_health_backend/  # Main Django project
│   ├── users/                  # User management app
│   ├── chat/                   # Chat functionality app
│   ├── support/                # Support features app
│   └── manage.py              # Django management script
├── mental-health-website/      # Frontend application
│   ├── index.html             # Main landing page
│   ├── dashboard.html         # User dashboard
│   ├── beautiful-chatbot.html # AI chatbot interface
│   ├── styles/                # CSS stylesheets
│   └── scripts/               # JavaScript files
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Django 4.0+
- Modern web browser

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install required dependencies:
   ```bash
   pip install django djangorestframework channels
   ```

3. Run migrations:
   ```bash
   python manage.py migrate
   ```

4. Start the Django development server:
   ```bash
   python manage.py runserver
   ```

The backend API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd mental-health-website
   ```

2. Open `index.html` in your web browser or serve it using a local server:
   ```bash
   # Using Python's built-in server
   python -m http.server 8080
   ```

The frontend will be available at `http://localhost:8080`

## 📱 Usage

1. **Main Website**: Start at `index.html` for the main landing page
2. **Dashboard**: Access `dashboard.html` for personal mental health tracking
3. **AI Chatbot**: Use `beautiful-chatbot.html` for AI-powered mental health support
4. **API**: The Django backend provides RESTful APIs for all functionality

## 🛠️ Technology Stack

**Backend:**
- Django - Web framework
- Django REST Framework - API development
- Django Channels - WebSocket support
- SQLite - Database (development)

**Frontend:**
- HTML5, CSS3, JavaScript
- Responsive design
- Real-time chat interface

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you have any questions or need help, please open an issue in this repository.

---

**Note**: This is a mental health support platform. If you're experiencing a mental health crisis, please contact your local emergency services or a mental health professional immediately.
