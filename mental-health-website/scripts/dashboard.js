// Dashboard JavaScript for MindWell Mental Health Website

// Global variables
let currentUser = null;
let isLoggedIn = false;
let currentTab = 'dashboard';
let moodChart = null;
let breathingInterval = null;
let breathingCycle = 'inhale';
let breathingTimer = null;
let isDemoMode = false; // Flag to track if we're in demo mode

// API Configuration
const API_BASE_URL = 'http://localhost:8000';
const CHAT_WS_URL = 'ws://localhost:8000';

// API Endpoints
const API_ENDPOINTS = {
    auth: {
        status: `${API_BASE_URL}/users/auth/status/`,
        profile: `${API_BASE_URL}/users/auth/profile/`,
        login: `${API_BASE_URL}/users/auth/login/`,
        logout: `${API_BASE_URL}/users/auth/logout/`
    },
    chat: {
        rooms: `${API_BASE_URL}/chat/rooms/`,
        messages: `${API_BASE_URL}/chat/messages/`,
        ai_chat: `${API_BASE_URL}/chat/ai-chat/`
    },
    memory: {
        add: `${API_BASE_URL}/chat/memory/add/`,
        search: `${API_BASE_URL}/chat/memory/search/`,
        profile: `${API_BASE_URL}/chat/memory/profile/`
    },
    dashboard: {
        overview: `${API_BASE_URL}/dashboard/api/dashboard-overview/`,
        activities: `${API_BASE_URL}/dashboard/api/user-activities/`,
        settings: `${API_BASE_URL}/dashboard/api/user-settings/`
    },
    mood: {
        entries: `${API_BASE_URL}/dashboard/api/mood-entries/`,
        create: `${API_BASE_URL}/dashboard/api/mood-entries/create/`,
        analytics: `${API_BASE_URL}/dashboard/api/mood-entries/analytics/`
    },
    journal: {
        entries: `${API_BASE_URL}/dashboard/api/journal-entries/`,
        create: `${API_BASE_URL}/dashboard/api/journal-entries/create/`,
        stats: `${API_BASE_URL}/dashboard/api/journal-entries/stats/`
    },
    goals: {
        list: `${API_BASE_URL}/dashboard/api/goals/`,
        create: `${API_BASE_URL}/dashboard/api/goals/create/`,
        update: `${API_BASE_URL}/dashboard/api/goals/update/`
    },
    meditation: {
        sessions: `${API_BASE_URL}/dashboard/api/meditation-sessions/`,
        stats: `${API_BASE_URL}/dashboard/api/meditation-sessions/stats/`
    },
    appointments: {
        list: `${API_BASE_URL}/dashboard/api/appointments/`,
        create: `${API_BASE_URL}/dashboard/api/appointments/`
    }
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard script loaded successfully');
    initializeDashboard();
    
    // Add debugging for crisis chat button
    console.log('Checking if startCrisisChat function exists:', typeof window.startCrisisChat);
});

// Initialize dashboard
function initializeDashboard() {
    checkAuthentication();
    setupTabNavigation();
    setupDashboardData();
    setupMoodTracking();
    setupMeditationFeatures();
    setupBreathingExercise();
    setupCharts();
    loadUserData();
    setupCrisisChatButton(); // Add crisis chat button setup
    setupRefreshButton(); // Add refresh button setup
}

// Check authentication with backend integration
async function checkAuthentication() {
    // Check for demo mode (for testing dynamic functionality)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
        console.log('Demo mode activated - creating test user data');
        createDemoUser();
        return;
    }
    
    // Check for test real user mode
    if (urlParams.get('testuser') === 'true') {
        console.log('Test real user mode activated - creating real user simulation');
        createTestRealUser();
        return;
    }
    
    // First check local storage
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userData = localStorage.getItem('user');
    
    if (!isAuthenticated || !userData) {
        console.log('No authentication data found in localStorage');
        redirectToLogin();
        return;
    }
    
    // Parse user data and set as current user first
    try {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
        updateUserProfile();
        console.log('User data loaded from localStorage:', currentUser);
        
        // Load dashboard immediately with local data
        await loadDashboardData();
    } catch (parseError) {
        console.error('Failed to parse user data:', parseError);
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        redirectToLogin();
        return;
    }
    
    // Verify with backend in the background (don't block the UI)
    verifyAuthWithBackend();
}

// Separate function to verify with backend without blocking the UI
async function verifyAuthWithBackend() {
    try {
        console.log('Verifying authentication with backend...');
        const response = await fetch('http://localhost:8000/users/auth/status/', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Backend auth check result:', result);
            
            if (result.authenticated) {
                // Update user data with backend response if different
                if (JSON.stringify(result.user) !== JSON.stringify(currentUser)) {
                    currentUser = { ...currentUser, ...result.user };
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    updateUserProfile();
                }
                
                // Load additional user profile data from backend
                await loadUserProfileFromBackend();
            } else {
                console.log('Backend says user is not authenticated, but continuing with local session');
                // Don't immediately redirect - the user was just logged in successfully
                // The backend might have session issues but local auth is valid
            }
        } else if (response.status === 401 || response.status === 403) {
            console.log('Backend auth check failed with auth error:', response.status);
            // Only redirect if it's been more than 5 minutes since login
            const loginTime = localStorage.getItem('loginTime');
            const now = Date.now();
            if (!loginTime || (now - parseInt(loginTime)) > 5 * 60 * 1000) {
                console.log('Session has expired, redirecting to login');
                localStorage.removeItem('user');
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('loginTime');
                redirectToLogin();
            } else {
                console.log('Recent login, ignoring backend auth error');
            }
        } else {
            console.log('Backend auth check failed with status:', response.status);
            // Don't redirect on other errors - user data is already loaded
        }
    } catch (error) {
        console.error('Auth check network error:', error);
        // Network error - continue with local storage data
        console.log('Continuing with local authentication data due to network error');
    }
}

// Redirect to login page
function redirectToLogin() {
    showNotification('Please log in to access the dashboard', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}

// Load user profile data from backend
async function loadUserProfileFromBackend() {
    try {
        const response = await fetch('http://localhost:8000/users/auth/profile/', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const profileData = await response.json();
            if (profileData.success) {
                // Update current user with additional profile data
                currentUser = { ...currentUser, ...profileData.user };
                updateUserProfile();
                console.log('Profile data loaded from backend:', profileData.user);
            }
        } else {
            console.log('Failed to load profile data, status:', response.status);
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
        // Continue with existing user data
    }
}

// Update user profile display
function updateUserProfile() {
    if (currentUser) {
        const profileName = document.querySelector('.profile-name');
        const profileEmail = document.querySelector('.profile-email');
        const welcomeHeader = document.querySelector('.page-header h1');
        
        // Handle both firstName/lastName and first_name/last_name formats
        const firstName = currentUser.firstName || currentUser.first_name || 'User';
        const lastName = currentUser.lastName || currentUser.last_name || '';
        const email = currentUser.email || '';
        
        if (profileName) profileName.textContent = `${firstName} ${lastName}`;
        if (profileEmail) profileEmail.textContent = email;
        if (welcomeHeader) welcomeHeader.textContent = `Welcome back, ${firstName}!`;
        
        console.log('Profile updated with:', { firstName, lastName, email });
    }
}

// Setup tab navigation
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    // Update navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        }
    });

    // Update content
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName) {
            content.classList.add('active');
        }
    });

    currentTab = tabName;
    
    // Load tab-specific data
    loadTabData(tabName);
}

// Load tab-specific data
function loadTabData(tabName) {
    switch (tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'mood-tracker':
            loadMoodTrackerData();
            break;
        case 'meditation':
            loadMeditationData();
            break;
        case 'appointments':
            loadAppointmentsData();
            break;
        case 'community':
            loadCommunityData();
            break;
        case 'resources':
            loadResourcesData();
            break;
        case 'goals':
            loadGoalsData();
            break;
        case 'journal':
            loadJournalData();
            break;
    }
}

// Get user-specific localStorage key
function getUserSpecificKey(baseKey) {
    const userId = currentUser?.id || currentUser?.username || 'demo';
    return `${baseKey}_${userId}`;
}

// Check if user is demo account
function isDemoUser() {
    if (!currentUser) return false;
    return currentUser.email === 'demo@mindwell.com' || 
           currentUser.username === 'demo' || 
           currentUser.id === 'demo';
}

// Setup dashboard data - now using backend APIs
async function setupDashboardData() {
    try {
        // Load real data from backend
        await loadUserMoodData();
        await loadUserActivities();
        await loadUserMemoryProfile();
    } catch (error) {
        console.error('Error setting up dashboard data:', error);
        // Fallback to sample data if backend is unavailable
        setupFallbackData();
    }
}

// Fallback to sample data if backend is unavailable
function setupFallbackData() {
    const moodDataKey = getUserSpecificKey('mindwell_mood_data');
    const activitiesKey = getUserSpecificKey('mindwell_activities');
    
    // Only create sample data for demo users, real users should start with empty data
    if (isDemoUser()) {
        if (!localStorage.getItem(moodDataKey)) {
            const sampleMoodData = generateSampleMoodData();
            localStorage.setItem(moodDataKey, JSON.stringify(sampleMoodData));
        }
        
        if (!localStorage.getItem(activitiesKey)) {
            const sampleActivities = generateSampleActivities();
            localStorage.setItem(activitiesKey, JSON.stringify(sampleActivities));
        }
    } else {
        // For real users, ensure they start with empty data if no backend data
        if (!localStorage.getItem(moodDataKey)) {
            localStorage.setItem(moodDataKey, JSON.stringify([]));
        }
        
        if (!localStorage.getItem(activitiesKey)) {
            localStorage.setItem(activitiesKey, JSON.stringify([]));
        }
    }
}

// Load user mood data from backend
async function loadUserMoodData() {
    const moodDataKey = getUserSpecificKey('mindwell_mood_data');
    
    try {
        const response = await fetch(API_ENDPOINTS.mood.entries, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                localStorage.setItem(moodDataKey, JSON.stringify(data.mood_entries));
                console.log('Loaded mood data from backend for user:', currentUser?.username, data.mood_entries.length, 'entries');
            }
        }
    } catch (error) {
        console.error('Failed to load mood data:', error);
    }
}

// Load user activities from backend
async function loadUserActivities() {
    const activitiesKey = getUserSpecificKey('mindwell_activities');
    
    try {
        const response = await fetch(API_ENDPOINTS.dashboard.activities, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                localStorage.setItem(activitiesKey, JSON.stringify(data.activities));
                console.log('Loaded activities from backend for user:', currentUser?.username, data.activities.length, 'activities');
            }
        }
    } catch (error) {
        console.error('Failed to load activities:', error);
    }
}

// Load user memory profile from Mem0
async function loadUserMemoryProfile() {
    try {
        const response = await fetch(API_ENDPOINTS.memory.profile, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                console.log('User memory profile loaded:', data.profile);
                // Store memory profile for personalization
                localStorage.setItem('mindwell_memory_profile', JSON.stringify(data.profile));
            }
        }
    } catch (error) {
        console.error('Failed to load memory profile:', error);
    }
}

// Generate sample mood data
function generateSampleMoodData() {
    const moods = [];
    const moodValues = ['very-sad', 'sad', 'neutral', 'good', 'very-good'];
    const moodScores = { 'very-sad': 2, 'sad': 4, 'neutral': 6, 'good': 8, 'very-good': 10 };
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const randomMood = moodValues[Math.floor(Math.random() * moodValues.length)];
        
        moods.push({
            date: date.toISOString().split('T')[0],
            mood: randomMood,
            score: moodScores[randomMood],
            note: i === 0 ? "Feeling good today! The meditation really helped." : "",
            factors: i === 0 ? ['Sleep', 'Exercise'] : []
        });
    }
    
    return moods;
}

// Generate sample activities
function generateSampleActivities() {
    const activities = [
        {
            id: 1,
            type: 'meditation',
            title: 'Completed 10-minute meditation',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            icon: 'fas fa-meditation'
        },
        {
            id: 2,
            type: 'mood',
            title: 'Logged mood: Good',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            icon: 'fas fa-smile'
        },
        {
            id: 3,
            type: 'journal',
            title: 'Added journal entry',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            icon: 'fas fa-pen'
        }
    ];
    
    return activities;
}

// Load dashboard data - enhanced with backend integration
async function loadDashboardData() {
    // Skip backend calls in demo mode or if not authenticated
    if (isDemoMode || !isLoggedIn) {
        console.log('Loading dashboard data in demo/offline mode');
        await loadFallbackDashboardData();
        return;
    }
    
    try {
        // Load comprehensive dashboard data from backend
        const response = await fetch(API_ENDPOINTS.dashboard.overview, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                console.log('Dashboard data loaded from backend:', data);
                
                // Update dashboard stats with real data
                updateDashboardStatsFromBackend(data.dashboard_stats);
                
                // Update recent activities with real data
                updateRecentActivitiesFromBackend(data.recent_activities);
                
                // Update mood chart with real data
                if (moodChart) {
                    moodChart.destroy();
                }
                createMoodChartFromBackend(data.mood_chart_data);
                
                // Display insights
                if (data.insights && data.insights.length > 0) {
                    displayPersonalizedInsightsFromBackend(data.insights);
                }
                
                return;
            }
        } else if (response.status === 401 || response.status === 403) {
            // Authentication error - don't redirect, just use fallback data
            console.log('Authentication error loading dashboard data, using fallback');
            await loadFallbackDashboardData();
            return;
        }
        
        // Fallback if backend fails
        console.log('Backend failed, using fallback data');
        await loadFallbackDashboardData();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Fallback to local data - don't redirect on network errors
        await loadFallbackDashboardData();
    }
}

// Fallback dashboard data loading
async function loadFallbackDashboardData() {
    await loadUserMoodData();
    await loadUserActivities();
    
    const moodDataKey = getUserSpecificKey('mindwell_mood_data');
    const activitiesKey = getUserSpecificKey('mindwell_activities');
    
    const moodData = JSON.parse(localStorage.getItem(moodDataKey) || '[]');
    const activities = JSON.parse(localStorage.getItem(activitiesKey) || '[]');
    
    updateDashboardStats(moodData);
    updateRecentActivities(activities);
    if (moodChart) moodChart.destroy();
    createMoodChart(moodData);
    await loadPersonalizedInsights();
}

// Backend data handling functions
function updateDashboardStatsFromBackend(dashboardStats) {
    console.log('Updating dashboard stats from backend:', dashboardStats);
    
    // Update today's mood
    const moodValue = document.querySelector('.stat-card .stat-value');
    const moodSubtext = document.querySelector('.stat-card .stat-subtext');
    
    if (moodValue && dashboardStats.todays_mood) {
        const moodLabels = {
            'very-sad': 'Very Sad',
            'sad': 'Sad', 
            'neutral': 'Neutral',
            'good': 'Good',
            'very-good': 'Very Good'
        };
        moodValue.textContent = moodLabels[dashboardStats.todays_mood.mood] || 'Not logged';
        
        if (moodSubtext && dashboardStats.todays_mood.change) {
            const change = dashboardStats.todays_mood.change;
            moodSubtext.textContent = `${change > 0 ? '+' : ''}${change}% from yesterday`;
            moodSubtext.className = `stat-subtext ${change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'}`;
        }
    }
    
    // Update meditation streak
    const streakElements = document.querySelectorAll('.stat-card');
    if (streakElements.length > 1 && dashboardStats.meditation_streak !== undefined) {
        const streakValue = streakElements[1].querySelector('.stat-value');
        const streakSubtext = streakElements[1].querySelector('.stat-subtext');
        
        if (streakValue) {
            streakValue.textContent = `${dashboardStats.meditation_streak} days`;
        }
        if (streakSubtext && dashboardStats.meditation_streak > 0) {
            streakSubtext.textContent = dashboardStats.meditation_streak_text || 'Personal best!';
            streakSubtext.className = 'stat-subtext positive';
        }
    }
    
    // Update next session
    if (streakElements.length > 2 && dashboardStats.next_session) {
        const sessionValue = streakElements[2].querySelector('.stat-value');
        const sessionSubtext = streakElements[2].querySelector('.stat-subtext');
        
        if (sessionValue) {
            sessionValue.textContent = dashboardStats.next_session.time || 'Tomorrow';
        }
        if (sessionSubtext) {
            sessionSubtext.textContent = dashboardStats.next_session.details || '2:00 PM with Dr. Smith';
        }
    }
    
    // Update weekly goals
    if (streakElements.length > 3 && dashboardStats.weekly_goals) {
        const goalsValue = streakElements[3].querySelector('.stat-value');
        const goalsSubtext = streakElements[3].querySelector('.stat-subtext');
        
        if (goalsValue) {
            goalsValue.textContent = dashboardStats.weekly_goals.progress || '4/6';
        }
        if (goalsSubtext) {
            goalsSubtext.textContent = dashboardStats.weekly_goals.status || 'On track';
            goalsSubtext.className = `stat-subtext ${dashboardStats.weekly_goals.on_track ? 'positive' : 'neutral'}`;
        }
    }
}

function updateRecentActivitiesFromBackend(recentActivities) {
    console.log('Updating recent activities from backend:', recentActivities);
    
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    if (!recentActivities || recentActivities.length === 0) {
        activityList.innerHTML = '<p class="no-activities">No recent activities</p>';
        return;
    }
    
    recentActivities.slice(0, 5).forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        // Map activity types to icons
        const iconMap = {
            'mood': 'fas fa-smile',
            'meditation': 'fas fa-meditation',
            'journal': 'fas fa-pen',
            'goal': 'fas fa-target',
            'appointment': 'fas fa-calendar',
            'chat': 'fas fa-comments',
            'exercise': 'fas fa-dumbbell',
            'sleep': 'fas fa-bed'
        };
        
        const icon = iconMap[activity.activity_type] || activity.icon || 'fas fa-circle';
        
        activityItem.innerHTML = `
            <div class="activity-icon ${activity.activity_type}">
                <i class="${icon}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title || activity.description}</h4>
                <span class="activity-time">${getTimeAgo(activity.created_at || activity.timestamp)}</span>
            </div>
        `;
        
        activityList.appendChild(activityItem);
    });
}

function createMoodChartFromBackend(moodChartData) {
    console.log('Creating mood chart from backend data:', moodChartData);
    
    const canvas = document.getElementById('moodChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (!moodChartData || !moodChartData.labels || !moodChartData.scores) {
        console.log('Invalid mood chart data, skipping chart creation');
        return;
    }
    
    // Ensure we have valid data
    const labels = moodChartData.labels || [];
    const scores = moodChartData.scores || [];
    
    if (labels.length === 0 || scores.length === 0) {
        console.log('Empty mood chart data, skipping chart creation');
        return;
    }
    
    moodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mood Score',
                data: scores,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 2,
                        callback: function(value) {
                            const moodLabels = {
                                0: 'Very Sad',
                                2: 'Sad', 
                                4: 'Low',
                                6: 'Neutral',
                                8: 'Good',
                                10: 'Very Good'
                            };
                            return moodLabels[value] || value;
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            elements: {
                point: {
                    hoverRadius: 8
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function displayPersonalizedInsightsFromBackend(insights) {
    console.log('Displaying personalized insights from backend:', insights);
    
    let insightsContainer = document.querySelector('.personalized-insights');
    
    if (!insightsContainer) {
        // Create insights container if it doesn't exist
        const dashboardGrid = document.querySelector('.dashboard-grid');
        if (dashboardGrid) {
            insightsContainer = document.createElement('div');
            insightsContainer.className = 'personalized-insights card';
            insightsContainer.innerHTML = `
                <div class="card-header">
                    <h2><i class="fas fa-lightbulb"></i> Your Personal Insights</h2>
                </div>
                <div class="insights-content">
                    <div class="insight-list"></div>
                </div>
            `;
            dashboardGrid.appendChild(insightsContainer);
        }
    }
    
    const insightsList = document.querySelector('.insight-list');
    if (!insightsList) return;
    
    if (!insights || insights.length === 0) {
        insightsList.innerHTML = '<p class="no-insights">No insights available yet. Keep tracking your mood and activities!</p>';
        return;
    }
    
    insightsList.innerHTML = insights.map(insight => {
        const insightTypes = {
            'mood_trend': 'fas fa-chart-line',
            'activity_pattern': 'fas fa-clock',
            'goal_progress': 'fas fa-target',
            'recommendation': 'fas fa-star',
            'achievement': 'fas fa-trophy',
            'tip': 'fas fa-lightbulb'
        };
        
        const icon = insightTypes[insight.type] || 'fas fa-info-circle';
        
        return `
            <div class="insight-item">
                <i class="${icon}"></i>
                <div class="insight-content">
                    <h4>${insight.title || 'Personal Insight'}</h4>
                    <p>${insight.content || insight.description}</p>
                    ${insight.action_text ? `
                        <button class="btn btn-outline btn-sm" onclick="${insight.action || 'showNotification(\'Feature coming soon!\', \'info\')'}">
                            ${insight.action_text}
                        </button>
                    ` : ''}
                </div>
                <small class="insight-time">${getTimeAgo(insight.created_at || insight.timestamp || Date.now())}</small>
            </div>
        `;
    }).join('');
}

// Load personalized insights using memory system
async function loadPersonalizedInsights() {
    try {
        const response = await fetch(API_ENDPOINTS.memory.search, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: 'mood patterns and mental health insights',
                limit: 5
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.memories.length > 0) {
                displayPersonalizedInsights(data.memories);
            }
        }
    } catch (error) {
        console.error('Failed to load personalized insights:', error);
    }
}

// Display personalized insights
function displayPersonalizedInsights(memories) {
    const insightsContainer = document.querySelector('.personalized-insights');
    if (!insightsContainer) {
        // Create insights container if it doesn't exist
        const dashboardGrid = document.querySelector('.dashboard-grid');
        const insightsCard = document.createElement('div');
        insightsCard.className = 'personalized-insights card';
        insightsCard.innerHTML = `
            <div class="card-header">
                <h2>Your Personal Insights</h2>
            </div>
            <div class="insights-content">
                <div class="insight-list"></div>
            </div>
        `;
        dashboardGrid.appendChild(insightsCard);
    }
    
    const insightsList = document.querySelector('.insight-list');
    if (insightsList) {
        insightsList.innerHTML = memories.map(memory => `
            <div class="insight-item">
                <i class="fas fa-lightbulb"></i>
                <p>${memory.content}</p>
                <small>${getTimeAgo(memory.created_at)}</small>
            </div>
        `).join('');
    }
}

// Update dashboard stats
function updateDashboardStats(moodData) {
    const today = new Date().toISOString().split('T')[0];
    const todayMood = moodData.find(entry => entry.date === today);
    
    // Update today's mood
    const moodValue = document.querySelector('.stat-card .stat-value');
    if (moodValue && todayMood) {
        const moodLabels = {
            'very-sad': 'Very Sad',
            'sad': 'Sad',
            'neutral': 'Neutral',
            'good': 'Good',
            'very-good': 'Very Good'
        };
        moodValue.textContent = moodLabels[todayMood.mood] || 'Not logged';
    }
}

// Update recent activities
function updateRecentActivities(activities) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    activities.slice(0, 3).forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon ${activity.type}">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                <span class="activity-time">${getTimeAgo(activity.timestamp)}</span>
            </div>
        `;
        activityList.appendChild(activityItem);
    });
}

// Create mood chart
function createMoodChart(moodData) {
    const canvas = document.getElementById('moodChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const labels = moodData.map(entry => {
        const date = new Date(entry.date);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    });
    
    const scores = moodData.map(entry => entry.score);
    
    moodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mood Score',
                data: scores,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 2
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            elements: {
                point: {
                    hoverRadius: 8
                }
            }
        }
    });
}

// Setup mood tracking
function setupMoodTracking() {
    const moodOptions = document.querySelectorAll('.mood-option');
    const factorTags = document.querySelectorAll('.factor-tag');
    
    moodOptions.forEach(option => {
        option.addEventListener('click', function() {
            moodOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    
    factorTags.forEach(tag => {
        tag.addEventListener('click', function() {
            this.classList.toggle('selected');
        });
    });
}

// Save mood entry - now with backend integration
async function saveMood() {
    const selectedMood = document.querySelector('.mood-option.selected');
    const moodNote = document.querySelector('.mood-details textarea').value;
    const selectedFactors = Array.from(document.querySelectorAll('.factor-tag.selected'))
        .map(tag => tag.textContent);
    
    if (!selectedMood) {
        showNotification('Please select a mood', 'error');
        return;
    }
    
    const moodScores = { 'very-sad': 2, 'sad': 4, 'neutral': 6, 'good': 8, 'very-good': 10 };
    const moodEntry = {
        mood: selectedMood.getAttribute('data-mood'),
        score: moodScores[selectedMood.getAttribute('data-mood')],
        note: moodNote,
        factors: selectedFactors,
        date: new Date().toISOString().split('T')[0]
    };
    
    try {
        // Save to backend
        const response = await fetch(API_ENDPOINTS.mood.entries, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(moodEntry)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Add to Mem0 memory system
                await addToMemorySystem('mood', `User logged mood: ${selectedMood.textContent.trim()}. Note: ${moodNote}. Factors: ${selectedFactors.join(', ')}`);
                
                // Update local storage for immediate UI update
                await loadUserMoodData();
                
                showNotification('Mood logged successfully!', 'success');
                
                // Reset form
                selectedMood.classList.remove('selected');
                document.querySelector('.mood-details textarea').value = '';
                document.querySelectorAll('.factor-tag.selected').forEach(tag => tag.classList.remove('selected'));
                
                // Update dashboard if we're on it
                if (currentTab === 'dashboard') {
                    loadDashboardData();
                }
            } else {
                throw new Error(data.message || 'Failed to save mood');
            }
        } else {
            throw new Error('Failed to connect to server');
        }
    } catch (error) {
        console.error('Error saving mood:', error);
        showNotification('Failed to save mood. Please try again.', 'error');
    }
}

// Add entry to Mem0 memory system
async function addToMemorySystem(category, content) {
    try {
        const response = await fetch(API_ENDPOINTS.memory.add, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content,
                category: category,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source: 'dashboard'
                }
            })
        });
        
        if (response.ok) {
            console.log('Added to memory system:', category, content);
        }
    } catch (error) {
        console.error('Failed to add to memory system:', error);
    }
}

// Load mood tracker data
function loadMoodTrackerData() {
    const moodDataKey = getUserSpecificKey('mindwell_mood_data');
    const moodData = JSON.parse(localStorage.getItem(moodDataKey) || '[]');
    
    if (moodData.length > 0) {
        // Calculate analytics
        const thisWeekData = moodData.slice(-7);
        const averageScore = thisWeekData.reduce((sum, entry) => sum + entry.score, 0) / thisWeekData.length;
        const mostCommonMood = getMostCommonMood(thisWeekData);
        const lastWeekData = moodData.slice(-14, -7);
        const lastWeekAverage = lastWeekData.length > 0 ? 
            lastWeekData.reduce((sum, entry) => sum + entry.score, 0) / lastWeekData.length : 0;
        
        const improvement = lastWeekAverage > 0 ? 
            ((averageScore - lastWeekAverage) / lastWeekAverage * 100).toFixed(0) : 0;
        
        // Update analytics display
        updateMoodAnalytics(averageScore, mostCommonMood, improvement);
    }
}

// Get most common mood
function getMostCommonMood(moodData) {
    const moodCounts = {};
    moodData.forEach(entry => {
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
    });
    
    return Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b);
}

// Update mood analytics
function updateMoodAnalytics(averageScore, mostCommonMood, improvement) {
    const scoreValue = document.querySelector('.score-value');
    const commonMoodElement = document.querySelector('.common-mood span');
    const improvementValue = document.querySelector('.improvement-value');
    
    if (scoreValue) scoreValue.textContent = averageScore.toFixed(1);
    if (commonMoodElement) {
        const moodLabels = {
            'very-sad': 'Very Sad',
            'sad': 'Sad',
            'neutral': 'Neutral',
            'good': 'Good',
            'very-good': 'Very Good'
        };
        commonMoodElement.textContent = moodLabels[mostCommonMood] || 'Good';
    }
    if (improvementValue) {
        improvementValue.textContent = `${improvement > 0 ? '+' : ''}${improvement}%`;
    }
}

// Setup meditation features
function setupMeditationFeatures() {
    // Setup breathing exercise range inputs
    const inhaleRange = document.getElementById('inhaleTime');
    const holdRange = document.getElementById('holdTime');
    const exhaleRange = document.getElementById('exhaleTime');
    
    if (inhaleRange) {
        inhaleRange.addEventListener('input', function() {
            this.nextElementSibling.textContent = this.value + 's';
        });
    }
    
    if (holdRange) {
        holdRange.addEventListener('input', function() {
            this.nextElementSibling.textContent = this.value + 's';
        });
    }
    
    if (exhaleRange) {
        exhaleRange.addEventListener('input', function() {
            this.nextElementSibling.textContent = this.value + 's';
        });
    }
    
    // Setup meditation library filters
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.getAttribute('data-filter');
            filterMeditations(filter);
        });
    });
}

// Filter meditations
function filterMeditations(filter) {
    const meditationItems = document.querySelectorAll('.meditation-item');
    
    meditationItems.forEach(item => {
        if (filter === 'all' || item.getAttribute('data-category') === filter) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Setup breathing exercise
function setupBreathingExercise() {
    const breathingCircle = document.getElementById('breathingCircle');
    const breathingText = document.getElementById('breathingText');
    
    if (breathingCircle) {
        breathingCircle.addEventListener('click', startBreathing);
    }
}

// Start breathing exercise
function startBreathing() {
    const circle = document.getElementById('breathingCircle');
    const text = document.getElementById('breathingText');
    const inhaleTime = parseInt(document.getElementById('inhaleTime')?.value || 4) * 1000;
    const holdTime = parseInt(document.getElementById('holdTime')?.value || 4) * 1000;
    const exhaleTime = parseInt(document.getElementById('exhaleTime')?.value || 6) * 1000;
    
    if (!circle || !text) return;
    
    if (breathingInterval) {
        clearInterval(breathingInterval);
        clearTimeout(breathingTimer);
        circle.style.transform = 'scale(1)';
        text.textContent = 'Click to Start';
        breathingInterval = null;
        return;
    }
    
    breathingCycle = 'inhale';
    text.textContent = 'Inhale';
    circle.style.transform = 'scale(1.3)';
    circle.style.transition = `transform ${inhaleTime}ms ease-in-out`;
    
    const runCycle = () => {
        switch (breathingCycle) {
            case 'inhale':
                text.textContent = 'Hold';
                breathingCycle = 'hold';
                breathingTimer = setTimeout(() => {
                    text.textContent = 'Exhale';
                    circle.style.transform = 'scale(1)';
                    circle.style.transition = `transform ${exhaleTime}ms ease-in-out`;
                    breathingCycle = 'exhale';
                    breathingTimer = setTimeout(() => {
                        text.textContent = 'Inhale';
                        circle.style.transform = 'scale(1.3)';
                        circle.style.transition = `transform ${inhaleTime}ms ease-in-out`;
                        breathingCycle = 'inhale';
                    }, exhaleTime);
                }, holdTime);
                break;
        }
    };
    
    breathingTimer = setTimeout(runCycle, inhaleTime);
    breathingInterval = setInterval(() => {
        if (breathingCycle === 'inhale') {
            runCycle();
        }
    }, inhaleTime + holdTime + exhaleTime);
}

// Start meditation session
function startMeditation() {
    const playBtn = document.querySelector('.play-btn');
    const progressBar = document.querySelector('.progress');
    const timeDisplay = document.querySelector('.time');
    
    if (!playBtn) return;
    
    if (playBtn.innerHTML.includes('fa-play')) {
        // Start meditation
        playBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Session';
        simulateMeditationProgress(progressBar, timeDisplay);
        
        // Add to activities
        setTimeout(() => {
            const activities = JSON.parse(localStorage.getItem('mindwell_activities') || '[]');
            activities.unshift({
                id: Date.now(),
                type: 'meditation',
                title: 'Completed meditation session',
                timestamp: new Date().toISOString(),
                icon: 'fas fa-meditation'
            });
            localStorage.setItem('mindwell_activities', JSON.stringify(activities.slice(0, 10)));
        }, 10000); // Add after 10 seconds for demo
        
    } else {
        // Pause meditation
        playBtn.innerHTML = '<i class="fas fa-play"></i> Start Session';
    }
}

// Simulate meditation progress
function simulateMeditationProgress(progressBar, timeDisplay) {
    let progress = 0;
    const totalTime = 600; // 10 minutes in seconds
    
    const interval = setInterval(() => {
        progress += 1;
        const percentage = (progress / totalTime) * 100;
        
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (timeDisplay) {
            const minutes = Math.floor(progress / 60);
            const seconds = progress % 60;
            timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} / 10:00`;
        }
        
        if (progress >= totalTime) {
            clearInterval(interval);
            showNotification('Meditation session completed!', 'success');
            
            const playBtn = document.querySelector('.play-btn');
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i> Start Session';
        }
    }, 1000);
}

// Setup charts
function setupCharts() {
    // Chart.js will be initialized when data is loaded
}

// Load user data
function loadUserData() {
    // Load user-specific data and preferences
    const userPreferences = JSON.parse(localStorage.getItem(`mindwell_preferences_${currentUser?.id}`) || '{}');
    
    // Apply preferences if any
    if (userPreferences.theme) {
        document.body.setAttribute('data-theme', userPreferences.theme);
    }
}

// Utility function for time ago
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add notification styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;

    // Add to DOM
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Load placeholder data for other tabs with proper error handling
function loadMeditationData() {
    // Skip backend calls in demo mode or if not authenticated
    if (isDemoMode || !isLoggedIn) {
        console.log('Loading meditation data in demo/offline mode');
        const meditationStats = JSON.parse(localStorage.getItem('mindwell_meditation_stats') || '{}');
        updateMeditationStats(meditationStats);
        return;
    }
    
    // Load meditation data from backend with error handling
    fetch(API_ENDPOINTS.meditation.stats, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 401 || response.status === 403) {
            // Don't redirect on auth errors, just use local data
            console.log('Auth error loading meditation data, using local data');
            return null;
        }
        throw new Error('Failed to load meditation data');
    })
    .then(data => {
        if (data && data.success) {
            localStorage.setItem('mindwell_meditation_stats', JSON.stringify(data.stats));
            updateMeditationStats(data.stats);
        } else {
            // Fallback to local data
            const meditationStats = JSON.parse(localStorage.getItem('mindwell_meditation_stats') || '{}');
            updateMeditationStats(meditationStats);
        }
    })
    .catch(error => {
        console.error('Error loading meditation data:', error);
        // Fallback to local data without redirecting
        const meditationStats = JSON.parse(localStorage.getItem('mindwell_meditation_stats') || '{}');
        updateMeditationStats(meditationStats);
    });
}

function loadAppointmentsData() {
    // Skip backend calls in demo mode or if not authenticated
    if (isDemoMode || !isLoggedIn) {
        console.log('Loading appointments data in demo/offline mode');
        const appointments = JSON.parse(localStorage.getItem('mindwell_appointments') || '[]');
        updateAppointmentsList(appointments);
        return;
    }
    
    // Load appointments from backend with error handling
    fetch(API_ENDPOINTS.appointments.list, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 401 || response.status === 403) {
            console.log('Auth error loading appointments, using local data');
            return null;
        }
        throw new Error('Failed to load appointments');
    })
    .then(data => {
        if (data && data.success) {
            localStorage.setItem('mindwell_appointments', JSON.stringify(data.appointments));
            updateAppointmentsList(data.appointments);
        } else {
            const appointments = JSON.parse(localStorage.getItem('mindwell_appointments') || '[]');
            updateAppointmentsList(appointments);
        }
    })
    .catch(error => {
        console.error('Error loading appointments:', error);
        const appointments = JSON.parse(localStorage.getItem('mindwell_appointments') || '[]');
        updateAppointmentsList(appointments);
    });
}

function loadCommunityData() {
    // Skip backend calls in demo mode or if not authenticated  
    if (isDemoMode || !isLoggedIn) {
        console.log('Loading community data in demo/offline mode');
        const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
        updateCommunityFeed(posts);
        return;
    }
    
    // Community data is typically local for now, but add error handling for future backend integration
    const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
    updateCommunityFeed(posts);
}

function loadResourcesData() {
    // Skip backend calls in demo mode or if not authenticated
    if (isDemoMode || !isLoggedIn) {
        console.log('Loading resources data in demo/offline mode');
        const resources = JSON.parse(localStorage.getItem('mindwell_resources') || '[]');
        updateResourcesGrid(resources);
        return;
    }
    
    // Resources are typically local for now, but add error handling for future backend integration
    const resources = JSON.parse(localStorage.getItem('mindwell_resources') || '[]');
    updateResourcesGrid(resources);
}

function loadGoalsData() {
    // Skip backend calls in demo mode or if not authenticated
    if (isDemoMode || !isLoggedIn) {
        console.log('Loading goals data in demo/offline mode');
        const goals = JSON.parse(localStorage.getItem('mindwell_goals') || '[]');
        const goalsList = document.querySelector('.goal-list');
        if (goalsList) {
            // Use existing loadGoalsData logic but with local data
            loadGoalsDataLocal();
        }
        return;
    }
    
    // Load goals from backend with error handling
    fetch(API_ENDPOINTS.goals.list, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 401 || response.status === 403) {
            console.log('Auth error loading goals, using local data');
            return null;
        }
        throw new Error('Failed to load goals');
    })
    .then(data => {
        if (data && data.success) {
            localStorage.setItem('mindwell_goals', JSON.stringify(data.goals));
            loadGoalsDataLocal();
        } else {
            loadGoalsDataLocal();
        }
    })
    .catch(error => {
        console.error('Error loading goals:', error);
        loadGoalsDataLocal();
    });
}

function loadJournalData() {
    // Skip backend calls in demo mode or if not authenticated
    if (isDemoMode || !isLoggedIn) {
        console.log('Loading journal data in demo/offline mode');
        loadJournalDataLocal();
        return;
    }
    
    // Load journal from backend with error handling
    fetch(API_ENDPOINTS.journal.entries, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 401 || response.status === 403) {
            console.log('Auth error loading journal, using local data');
            return null;
        }
        throw new Error('Failed to load journal');
    })
    .then(data => {
        if (data && data.success) {
            localStorage.setItem('mindwell_journal_entries', JSON.stringify(data.entries));
            loadJournalDataLocal();
        } else {
            loadJournalDataLocal();
        }
    })
    .catch(error => {
        console.error('Error loading journal:', error);
        loadJournalDataLocal();
    });
}

// Helper functions for local data loading
function loadGoalsDataLocal() {
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    const goalsList = document.querySelector('.goal-list');
    
    if (!goalsList) return;
    
    goalsList.innerHTML = '';
    
    goals.forEach(goal => {
        const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100);
        const isCompleted = progress >= 100;
        
        const goalCard = document.createElement('div');
        goalCard.className = `goal-card ${isCompleted ? 'completed' : 'active'}`;
        goalCard.innerHTML = `
            <div class="goal-header">
                <h3>${goal.title}</h3>
                <span class="goal-status ${isCompleted ? 'completed' : 'in-progress'}">${isCompleted ? 'Completed' : 'In Progress'}</span>
            </div>
            <p>${goal.description}</p>
            <div class="goal-progress">
                <div class="progress-info">
                    <span>Progress: ${goal.currentValue}/${goal.targetValue} ${goal.unit}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${progress}%"></div>
                </div>
            </div>
            ${isCompleted ? 
                `<div class="goal-completion">
                    <i class="fas fa-trophy"></i>
                    <span>Completed on ${formatDate(goal.endDate)}</span>
                </div>` :
                `<div class="goal-actions">
                    <button class="btn btn-outline btn-sm" onclick="updateGoalProgress(${goal.id}, 1)">+1</button>
                    <button class="btn btn-outline btn-sm" onclick="editGoal(${goal.id})">Edit</button>
                    <button class="btn btn-primary btn-sm" onclick="markGoalComplete(${goal.id})">Mark Complete</button>
                </div>`
            }
        `;
        goalsList.appendChild(goalCard);
    });
}

function loadJournalDataLocal() {
    const journalKey = getUserSpecificKey('mindwell_journal_entries');
    const entries = JSON.parse(localStorage.getItem(journalKey) || '[]');
    const entriesList = document.querySelector('.entries-list');
    
    if (!entriesList) return;
    
    entriesList.innerHTML = '';
    
    entries.slice(0, 10).forEach(entry => {
        const entryCard = document.createElement('div');
        entryCard.className = 'entry-card';
        entryCard.innerHTML = `
            <div class="entry-header">
                <h3>${entry.title}</h3>
                <div class="entry-meta">
                    <span class="entry-mood">${getMoodEmoji(entry.mood)}</span>
                    <span class="entry-date">${formatDate(entry.date)}</span>
                </div>
            </div>
            <div class="entry-preview">
                <p>${entry.content.substring(0, 150)}${entry.content.length > 150 ? '...' : ''}</p>
            </div>
            <div class="entry-tags">
                ${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="entry-actions">
                <button class="btn btn-outline btn-sm" onclick="editJournalEntry(${entry.id})">Edit</button>
                <button class="btn btn-outline btn-sm" onclick="viewJournalEntry(${entry.id})">View Full</button>
                <button class="btn btn-outline btn-sm" onclick="deleteJournalEntry(${entry.id})">Delete</button>
            </div>
            <div class="entry-stats">
                <small>${entry.wordCount} words • ${getTimeAgo(entry.createdAt)}</small>
            </div>
        `;
        entriesList.appendChild(entryCard);
    });
}

// Journal Management System
function initializeJournal() {
    if (!localStorage.getItem('mindwell_journal_entries')) {
        const sampleEntries = [
            {
                id: 1,
                title: "Reflecting on Progress",
                content: "Today I realized how much progress I've made over the past few months. The daily meditation is really helping me stay centered and focused. I'm grateful for the small wins.",
                mood: "good",
                tags: ["Progress", "Meditation", "Gratitude"],
                date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                wordCount: 45,
                isPrivate: false
            },
            {
                id: 2,
                title: "Challenging Day at Work",
                content: "Had a really tough day dealing with work stress. Feeling overwhelmed but trying to use the coping strategies I've learned. Tomorrow is a new day.",
                mood: "sad",
                tags: ["Work", "Stress", "Coping"],
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                wordCount: 32,
                isPrivate: true
            }
        ];
        localStorage.setItem('mindwell_journal_entries', JSON.stringify(sampleEntries));
    }
}

async function saveJournalEntry() {
    const title = document.querySelector('.entry-title').value.trim();
    const content = document.querySelector('.journal-editor').value.trim();
    const mood = document.querySelector('.mood-select').value;
    const date = document.querySelector('.entry-date').value;
    const tagInput = document.querySelector('.tag-input').value;
    
    if (!title || !content) {
        showNotification('Please fill in title and content', 'error');
        return;
    }
    
    const tags = tagInput ? tagInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const selectedTags = Array.from(document.querySelectorAll('.tag-btn.selected')).map(btn => btn.textContent);
    const allTags = [...new Set([...tags, ...selectedTags])];
    
    const journalEntry = {
        title,
        content,
        mood,
        tags: allTags,
        date: date || new Date().toISOString().split('T')[0],
        wordCount: content.split(/\s+/).length,
        isPrivate: false
    };
    
    try {
        // Save to backend
        const response = await fetch(API_ENDPOINTS.journal.entries, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(journalEntry)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Add to memory system for future insights
                await addToMemorySystem('journal', `Journal entry: ${title}. Content summary: ${content.substring(0, 200)}...`);
                
                showNotification('Journal entry saved successfully!', 'success');
                
                // Clear form
                document.querySelector('.entry-title').value = '';
                document.querySelector('.journal-editor').value = '';
                document.querySelector('.mood-select').value = '';
                document.querySelector('.tag-input').value = '';
                document.querySelectorAll('.tag-btn.selected').forEach(btn => btn.classList.remove('selected'));
                
                // Refresh journal list
                await loadJournalData();
            } else {
                throw new Error(data.message || 'Failed to save journal entry');
            }
        } else {
            throw new Error('Failed to connect to server');
        }
    } catch (error) {
        console.error('Error saving journal entry:', error);
        showNotification('Failed to save journal entry. Please try again.', 'error');
        
        // Fallback to local storage
        saveJournalEntryLocal(journalEntry);
    }
}

// Fallback local save for journal entries
function saveJournalEntryLocal(journalEntry) {
    const journalKey = getUserSpecificKey('mindwell_journal_entries');
    const entries = JSON.parse(localStorage.getItem(journalKey) || '[]');
    const newEntry = {
        id: Date.now(),
        ...journalEntry,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
    };
    
    entries.unshift(newEntry);
    localStorage.setItem(journalKey, JSON.stringify(entries));
    
    showNotification('Journal entry saved locally!', 'info');
    loadJournalData();
}

function loadJournalData() {
    const entries = JSON.parse(localStorage.getItem('mindwell_journal_entries') || '[]');
    const entriesList = document.querySelector('.entries-list');
    
    if (!entriesList) return;
    
    entriesList.innerHTML = '';
    
    entries.slice(0, 10).forEach(entry => {
        const entryCard = document.createElement('div');
        entryCard.className = 'entry-card';
        entryCard.innerHTML = `
            <div class="entry-header">
                <h3>${entry.title}</h3>
                <div class="entry-meta">
                    <span class="entry-mood">${getMoodEmoji(entry.mood)}</span>
                    <span class="entry-date">${formatDate(entry.date)}</span>
                </div>
            </div>
            <div class="entry-preview">
                <p>${entry.content.substring(0, 150)}${entry.content.length > 150 ? '...' : ''}</p>
            </div>
            <div class="entry-tags">
                ${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="entry-actions">
                <button class="btn btn-outline btn-sm" onclick="editJournalEntry(${entry.id})">Edit</button>
                <button class="btn btn-outline btn-sm" onclick="viewJournalEntry(${entry.id})">View Full</button>
                <button class="btn btn-outline btn-sm" onclick="deleteJournalEntry(${entry.id})">Delete</button>
            </div>
            <div class="entry-stats">
                <small>${entry.wordCount} words • ${getTimeAgo(entry.createdAt)}</small>
            </div>
        `;
        entriesList.appendChild(entryCard);
    });
}

function getMoodEmoji(mood) {
    const emojis = {
        'very-good': '😄',
        'good': '😊',
        'neutral': '😐',
        'sad': '😔',
        'very-sad': '😢'
    };
    return emojis[mood] || '😐';
}

function updateJournalStats() {
    const entries = JSON.parse(localStorage.getItem('mindwell_journal_entries') || '[]');
    const totalWords = entries.reduce((sum, entry) => sum + entry.wordCount, 0);
    const streak = calculateWritingStreak(entries);
    
    // Update stats in UI if elements exist
    const statsElements = document.querySelectorAll('.journal-stat');
    if (statsElements.length > 0) {
        statsElements[0].textContent = `${entries.length} entries`;
        statsElements[1].textContent = `${totalWords} words`;
        statsElements[2].textContent = `${streak} day streak`;
    }
}

function calculateWritingStreak(entries) {
    if (entries.length === 0) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const dates = [...new Set(entries.map(entry => entry.date))].sort();
    
    let streak = 0;
    let currentDate = new Date(today);
    
    while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (dates.includes(dateStr)) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    return streak;
}

// Goals Management System
function initializeGoals() {
    if (!localStorage.getItem('mindwell_goals')) {
        const sampleGoals = [
            {
                id: 1,
                title: "Daily Meditation Practice",
                description: "Meditate for at least 10 minutes every day",
                category: "mindfulness",
                targetType: "daily",
                targetValue: 30,
                currentValue: 7,
                unit: "days",
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: "active",
                priority: "high",
                reminders: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 2,
                title: "Weekly Therapy Sessions",
                description: "Attend therapy sessions consistently for 3 months",
                category: "therapy",
                targetType: "count",
                targetValue: 12,
                currentValue: 8,
                unit: "sessions",
                startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: "active",
                priority: "medium",
                reminders: true,
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem('mindwell_goals', JSON.stringify(sampleGoals));
    }
}

function createNewGoal() {
    showGoalModal();
}

function showGoalModal() {
    const modalHtml = `
        <div id="goalModal" class="modal show" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Create New Goal</h2>
                    <span class="close" onclick="closeGoalModal()">&times;</span>
                </div>
                <form id="goalForm" class="auth-form">
                    <div class="form-group">
                        <label for="goalTitle">Goal Title</label>
                        <input type="text" id="goalTitle" name="title" required placeholder="e.g., Daily Exercise">
                    </div>
                    <div class="form-group">
                        <label for="goalDescription">Description</label>
                        <textarea id="goalDescription" name="description" rows="3" placeholder="Describe your goal in detail..."></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="goalCategory">Category</label>
                            <select id="goalCategory" name="category">
                                <option value="mindfulness">Mindfulness</option>
                                <option value="therapy">Therapy</option>
                                <option value="exercise">Exercise</option>
                                <option value="sleep">Sleep</option>
                                <option value="social">Social</option>
                                <option value="self-care">Self-care</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="goalPriority">Priority</label>
                            <select id="goalPriority" name="priority">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="goalTarget">Target Value</label>
                            <input type="number" id="goalTarget" name="target" min="1" required placeholder="30">
                        </div>
                        <div class="form-group">
                            <label for="goalUnit">Unit</label>
                            <select id="goalUnit" name="unit">
                                <option value="days">Days</option>
                                <option value="sessions">Sessions</option>
                                <option value="hours">Hours</option>
                                <option value="times">Times</option>
                                <option value="weeks">Weeks</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="goalStartDate">Start Date</label>
                            <input type="date" id="goalStartDate" name="startDate" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label for="goalEndDate">End Date</label>
                            <input type="date" id="goalEndDate" name="endDate" value="${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-container">
                            <input type="checkbox" name="reminders" checked>
                            <span class="checkmark"></span>
                            Enable reminders for this goal
                        </label>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Create Goal</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('goalForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveNewGoal(this);
    });
}

function closeGoalModal() {
    const modal = document.getElementById('goalModal');
    if (modal) modal.remove();
}

function saveNewGoal(form) {
    const formData = new FormData(form);
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    
    const newGoal = {
        id: Date.now(),
        title: formData.get('title'),
        description: formData.get('description'),
        category: formData.get('category'),
        targetType: "count",
        targetValue: parseInt(formData.get('target')),
        currentValue: 0,
        unit: formData.get('unit'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        status: "active",
        priority: formData.get('priority'),
        reminders: formData.get('reminders') === 'on',
        createdAt: new Date().toISOString()
    };
    
    goals.unshift(newGoal);
    localStorage.setItem(goalsKey, JSON.stringify(goals));
    
    showNotification('Goal created successfully!', 'success');
    closeGoalModal();
    loadGoalsData();
}

function loadGoalsData() {
    const goals = JSON.parse(localStorage.getItem('mindwell_goals') || '[]');
    const goalsList = document.querySelector('.goal-list');
    
    if (!goalsList) return;
    
    goalsList.innerHTML = '';
    
    goals.forEach(goal => {
        const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100);
        const isCompleted = progress >= 100;
        
        const goalCard = document.createElement('div');
        goalCard.className = `goal-card ${isCompleted ? 'completed' : 'active'}`;
        goalCard.innerHTML = `
            <div class="goal-header">
                <h3>${goal.title}</h3>
                <span class="goal-status ${isCompleted ? 'completed' : 'in-progress'}">${isCompleted ? 'Completed' : 'In Progress'}</span>
            </div>
            <p>${goal.description}</p>
            <div class="goal-progress">
                <div class="progress-info">
                    <span>Progress: ${goal.currentValue}/${goal.targetValue} ${goal.unit}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${progress}%"></div>
                </div>
            </div>
            ${isCompleted ? 
                `<div class="goal-completion">
                    <i class="fas fa-trophy"></i>
                    <span>Completed on ${formatDate(goal.endDate)}</span>
                </div>` :
                `<div class="goal-actions">
                    <button class="btn btn-outline btn-sm" onclick="updateGoalProgress(${goal.id}, 1)">+1</button>
                    <button class="btn btn-outline btn-sm" onclick="editGoal(${goal.id})">Edit</button>
                    <button class="btn btn-primary btn-sm" onclick="markGoalComplete(${goal.id})">Mark Complete</button>
                </div>`
            }
        `;
        goalsList.appendChild(goalCard);
    });
}

function updateGoalProgress(goalId, increment) {
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    const goal = goals.find(g => g.id === goalId);
    
    if (goal) {
        goal.currentValue = Math.min(goal.currentValue + increment, goal.targetValue);
        localStorage.setItem(goalsKey, JSON.stringify(goals));
        
        if (goal.currentValue >= goal.targetValue) {
            showNotification(`🎉 Goal "${goal.title}" completed!`, 'success');
        }
        
        loadGoalsData();
    }
}

// Appointments Management System
function showBookingModal() {
    const modalHtml = `
        <div id="appointmentModal" class="modal show" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Book Appointment</h2>
                    <span class="close" onclick="closeAppointmentModal()">&times;</span>
                </div>
                <form id="appointmentForm" class="auth-form">
                    <div class="form-group">
                        <label for="therapistSelect">Select Therapist</label>
                        <select id="therapistSelect" name="therapist" required>
                            <option value="">Choose a therapist...</option>
                            <option value="dr-sarah-smith">Dr. Sarah Smith - Anxiety, Depression, CBT</option>
                            <option value="dr-michael-johnson">Dr. Michael Johnson - PTSD, Trauma</option>
                            <option value="dr-emily-davis">Dr. Emily Davis - Relationship Counseling</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="appointmentType">Session Type</label>
                        <select id="appointmentType" name="type" required>
                            <option value="individual">Individual Therapy (50 min)</option>
                            <option value="consultation">Initial Consultation (30 min)</option>
                            <option value="followup">Follow-up Session (30 min)</option>
                            <option value="group">Group Therapy (90 min)</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="appointmentDate">Preferred Date</label>
                            <input type="date" id="appointmentDate" name="date" required min="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label for="appointmentTime">Preferred Time</label>
                            <select id="appointmentTime" name="time" required>
                                <option value="">Select time...</option>
                                <option value="09:00">9:00 AM</option>
                                <option value="10:00">10:00 AM</option>
                                <option value="11:00">11:00 AM</option>
                                <option value="14:00">2:00 PM</option>
                                <option value="15:00">3:00 PM</option>
                                <option value="16:00">4:00 PM</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="appointmentFormat">Session Format</label>
                        <select id="appointmentFormat" name="format" required>
                            <option value="video">Video Call</option>
                            <option value="phone">Phone Call</option>
                            <option value="in-person">In-Person</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="appointmentNotes">Additional Notes (Optional)</label>
                        <textarea id="appointmentNotes" name="notes" rows="3" placeholder="Any specific concerns or topics you'd like to discuss..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Book Appointment</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('appointmentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveAppointment(this);
    });
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    if (modal) modal.remove();
}

function saveAppointment(form) {
    const formData = new FormData(form);
    const appointments = JSON.parse(localStorage.getItem('mindwell_appointments') || '[]');
    
    const newAppointment = {
        id: Date.now(),
        therapist: formData.get('therapist'),
        type: formData.get('type'),
        date: formData.get('date'),
        time: formData.get('time'),
        format: formData.get('format'),
        notes: formData.get('notes'),
        status: 'scheduled',
        createdAt: new Date().toISOString()
    };
    
    appointments.unshift(newAppointment);
    localStorage.setItem('mindwell_appointments', JSON.stringify(appointments));
    
    showNotification('Appointment booked successfully!', 'success');
    closeAppointmentModal();
    loadAppointmentsData();
}

// Setup crisis chat button with event listener
function setupCrisisChatButton() {
    console.log('Setting up crisis chat button...');
    
    // Try to find the button and add event listener
    setTimeout(() => {
        const crisisChatButton = document.querySelector('button[onclick*="startCrisisChat"]');
        console.log('Crisis chat button found:', !!crisisChatButton);
        
        if (crisisChatButton) {
            // Remove onclick attribute and add event listener
            crisisChatButton.removeAttribute('onclick');
            crisisChatButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Crisis chat button clicked via event listener');
                startCrisisChat();
            });
            console.log('Event listener added to crisis chat button');
        } else {
            console.log('Crisis chat button not found yet, will retry...');
            // Retry after a short delay if the button isn't found yet
            setTimeout(setupCrisisChatButton, 1000);
        }
    }, 100);
}

// WebSocket connection for real-time chat
let chatSocket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Enhanced Crisis Support with AI and Memory Integration
async function startCrisisChat() {
    console.log('Starting crisis chat with AI and memory integration...');
    
    // Remove any existing chat modal first
    const existingChat = document.getElementById('crisisChat');
    if (existingChat) {
        existingChat.remove();
    }
    
    // Log crisis chat initiation to memory system
    await addToMemorySystem('crisis', 'User initiated crisis support chat');
    
    const chatHtml = `
        <div id="crisisChat" class="chat-modal-overlay">
            <div class="chat-modal-container">
                <div class="crisis-chat-container">
                    <div class="chat-header">
                        <div class="chat-status" id="chatStatus">
                            <span class="status-dot connecting"></span>
                            <span class="status-text">Connecting...</span>
                        </div>
                        <button class="close-btn" onclick="closeCrisisChat()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="chat-messages" id="chatMessages">
                        <div class="chat-message system">
                            <div class="message-avatar system-avatar">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="message-content">
                                <div class="message-header">
                                    <span class="sender-name">MindWell Support</span>
                                    <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div class="message-text">
                                    <p><strong>🛡️ You're in a safe space</strong></p>
                                    <p>This is a confidential crisis support chat. If you're in immediate danger, please call emergency services.</p>
                                    <div class="emergency-actions">
                                        <a href="tel:988" class="emergency-btn">📞 Call 988</a>
                                        <a href="tel:911" class="emergency-btn">🚨 Call 911</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="typing-indicator" id="typingIndicator" style="display: none;">
                            <div class="typing-avatar">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="typing-content">
                                <div class="typing-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                                <span class="typing-text">AI Assistant is typing...</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="chat-input-container">
                        <div class="quick-responses" id="quickResponses">
                            <button class="quick-btn" onclick="sendQuickMessage('I need help')">
                                <i class="fas fa-hand-holding-heart"></i>
                                I need help
                            </button>
                            <button class="quick-btn" onclick="sendQuickMessage('I\\'m feeling overwhelmed')">
                                <i class="fas fa-cloud-rain"></i>
                                I'm feeling overwhelmed
                            </button>
                            <button class="quick-btn" onclick="sendQuickMessage('I need coping strategies')">
                                <i class="fas fa-tools"></i>
                                I need coping strategies
                            </button>
                        </div>
                        <div class="input-wrapper">
                            <input type="text" id="chatInput" placeholder="Share how you're feeling..." maxlength="500" disabled>
                            <button class="send-btn" onclick="sendChatMessage()" id="sendBtn" disabled>
                                <div class="btn-content">
                                    <i class="fas fa-paper-plane"></i>
                                    <span class="ripple"></span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatHtml);
    
    // Setup event listeners
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        
        chatInput.addEventListener('input', function() {
            if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                chatSocket.send(JSON.stringify({
                    'type': 'typing',
                    'is_typing': this.value.length > 0
                }));
            }
        });
    }
    
    // Connect to WebSocket
    connectToSupportChat();
    
    console.log('Crisis chat modal created successfully');
}

// Connect to WebSocket for crisis support with enhanced AI
function connectToSupportChat() {
    const userId = currentUser?.id || currentUser?.username || 'demo';
    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsPath = `${wsScheme}://127.0.0.1:8000/ws/crisis/${userId}/`;
    
    try {
        chatSocket = new WebSocket(wsPath);
        
        chatSocket.onopen = function(e) {
            console.log('Crisis chat connected');
            updateChatStatus('connected', 'Connected securely');
            document.getElementById('chatInput').disabled = false;
            document.getElementById('sendBtn').disabled = false;
            reconnectAttempts = 0;
        };
        
        chatSocket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            handleChatMessage(data);
        };
        
        chatSocket.onclose = function(e) {
            console.log('Crisis chat disconnected');
            updateChatStatus('disconnected', 'Disconnected');
            document.getElementById('chatInput').disabled = true;
            document.getElementById('sendBtn').disabled = true;
            
            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                setTimeout(() => {
                    reconnectAttempts++;
                    updateChatStatus('connecting', `Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`);
                    connectToSupportChat();
                }, 2000 * reconnectAttempts);
            } else {
                updateChatStatus('error', 'Connection failed');
                showFallbackSupport();
            }
        };
        
        chatSocket.onerror = function(e) {
            console.error('Crisis chat error:', e);
            updateChatStatus('error', 'Connection error');
            showFallbackSupport();
        };
        
    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        showFallbackSupport();
    }
}

function updateChatStatus(status, message) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (statusDot && statusText) {
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = message;
    }
}

function handleChatMessage(data) {
    const chatMessages = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('typingIndicator');
    
    console.log('Received message:', data.type, data);
    
    switch (data.type) {
        case 'ai_response':
            console.log('Handling AI response:', data.message);
            hideTypingIndicator();
            addChatMessage(data.message, 'bot');
            if (data.response_type === 'crisis_intervention') {
                showCrisisResources();
            }
            break;
            
        case 'chat_message':
            // Handle regular chat messages from other users
            console.log('Handling chat message:', data.message);
            hideTypingIndicator();
            // Don't add our own messages again - check both id and username
            const currentUserId = currentUser?.id || 'demo';
            const currentUsername = currentUser?.username || 'You';
            if (data.message.sender.id !== currentUserId && 
                data.message.sender.username !== currentUsername &&
                data.message.sender.username !== 'demo') {
                addChatMessage(data.message, 'user');
            }
            break;
            
        case 'crisis_alert':
            hideTypingIndicator();
            addCrisisAlert(data);
            break;
            
        case 'typing_indicator':
            // Exclude AI from typing indicators and only show for other real users
            const isAI = data.username === 'ai_assistant' || data.username === 'AI Assistant' || data.user_id === 'ai';
            if (data.is_typing && data.user_id !== (currentUser?.id || 'demo') && !isAI) {
                showTypingIndicator();
            } else {
                hideTypingIndicator();
            }
            break;
            
        case 'room_info':
            console.log('Room info:', data.room);
            break;
            
        case 'error':
            hideTypingIndicator();
            showNotification('Chat error: ' + data.message, 'error');
            break;
            
        default:
            console.log('Unknown message type:', data.type);
            break;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
        if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
            showNotification('Chat is not connected. Please wait for reconnection.', 'error');
        }
        return;
    }
    
    // Add user message to memory system for context
    await addToMemorySystem('crisis_chat', `User message: ${message}`);
    
    // Send message to server with memory context
    chatSocket.send(JSON.stringify({
        'type': 'chat_message',
        'message': message,
        'include_memory': true,
        'use_rag': true
    }));
    
    input.value = '';
    showTypingIndicator();
}

function sendQuickMessage(message) {
    const input = document.getElementById('chatInput');
    input.value = message;
    sendChatMessage();
}

function addChatMessage(messageData, senderType) {
    const chatMessages = document.getElementById('chatMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${senderType}`;
    
    const timestamp = new Date(messageData.created_at || Date.now());
    const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (senderType === 'user') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(messageData.content)}</p>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
        `;
    } else if (senderType === 'bot') {
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>${formatBotMessage(messageData.content)}</p>
                <span class="message-time">${timeString}</span>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'flex';
    }
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
}

function addCrisisAlert(data) {
    const chatMessages = document.getElementById('chatMessages');
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'chat-message crisis-alert';
    
    // Safely handle alert data
    const alert = data.alert || {};
    const alertReason = alert.alert_reason || alert.message || 'Crisis support has been activated for your safety.';
    const resources = data.resources || [];
    
    alertDiv.innerHTML = `
        <div class="alert-content">
            <div class="alert-header">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Crisis Alert Activated</strong>
            </div>
            <p>${alertReason}</p>
            <div class="crisis-resources">
                <h4>Immediate Help:</h4>
                ${resources.map(resource => 
                    `<a href="tel:${(resource.contact || '').replace(/[^0-9]/g, '')}" class="crisis-resource-btn">
                        <i class="fas fa-phone"></i> ${resource.name || 'Emergency Service'}: ${resource.contact || 'Contact Available'}
                    </a>`
                ).join('')}
            </div>
        </div>
    `;
    
    chatMessages.appendChild(alertDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showCrisisResources() {
    const chatMessages = document.getElementById('chatMessages');
    
    const resourcesDiv = document.createElement('div');
    resourcesDiv.className = 'chat-message resources';
    resourcesDiv.innerHTML = `
        <div class="resources-content">
            <h4>🛟 Crisis Resources</h4>
            <div class="resource-grid">
                <a href="tel:988" class="resource-card">
                    <i class="fas fa-phone"></i>
                    <span>988 Lifeline</span>
                </a>
                <a href="sms:741741&body=HOME" class="resource-card">
                    <i class="fas fa-sms"></i>
                    <span>Text HOME to 741741</span>
                </a>
                <button onclick="viewCopingStrategies()" class="resource-card">
                    <i class="fas fa-heart"></i>
                    <span>Coping Strategies</span>
                </button>
                <button onclick="createSafetyPlan()" class="resource-card">
                    <i class="fas fa-shield-alt"></i>
                    <span>Safety Plan</span>
                </button>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(resourcesDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showFallbackSupport() {
    const chatMessages = document.getElementById('chatMessages');
    
    const fallbackDiv = document.createElement('div');
    fallbackDiv.className = 'chat-message system';
    fallbackDiv.innerHTML = `
        <div class="message-content">
            <p><strong>⚠️ Connection Issue</strong></p>
            <p>We're having trouble connecting to our live chat system. Please use these immediate resources:</p>
            <div class="emergency-actions">
                <a href="tel:988" class="emergency-btn">📞 Call 988 - Suicide & Crisis Lifeline</a>
                <a href="tel:911" class="emergency-btn">🚨 Call 911 - Emergency Services</a>
                <a href="sms:741741&body=HOME" class="emergency-btn">💬 Text HOME to 741741</a>
            </div>
            <button onclick="connectToSupportChat()" class="btn btn-primary btn-sm">Try Reconnecting</button>
        </div>
    `;
    
    chatMessages.appendChild(fallbackDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatBotMessage(content) {
    // Convert markdown-like formatting to HTML
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/•/g, '•')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateCrisisResponse(userMessage) {
    const responses = [
        "I hear you, and what you're feeling is valid. Remember that difficult feelings are temporary. What's one small thing that usually helps you feel a bit better?",
        "Thank you for sharing that with me. You're being very brave by reaching out. Have you been able to use any coping strategies today?",
        "It sounds like you're going through a really tough time right now. Remember, you don't have to face this alone. Is there someone you trust that you could reach out to?",
        "I'm glad you're here talking to me. That takes courage. Let's focus on getting through this moment together. Can you try taking three deep breaths with me?",
        "Your feelings are important and valid. Sometimes when we're struggling, it helps to focus on very small, immediate things. Are you in a safe place right now?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

function closeCrisisChat() {
    // Close WebSocket connection
    if (chatSocket) {
        chatSocket.close();
        chatSocket = null;
    }
    
    const modal = document.getElementById('crisisChat');
    if (modal) modal.remove();
}

function createSafetyPlan() {
    const planHtml = `
        <div id="safetyPlan" class="modal show" style="display: flex;">
            <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>Personal Safety Plan</h2>
                    <span class="close" onclick="closeSafetyPlan()">&times;</span>
                </div>
                <form id="safetyPlanForm" class="auth-form">
                    <div class="safety-plan-section">
                        <h3>1. Warning Signs</h3>
                        <p>List thoughts, feelings, or behaviors that might indicate a crisis:</p>
                        <textarea name="warningSignsPersonal" placeholder="Personal warning signs (e.g., feeling hopeless, withdrawing from others)..." rows="3"></textarea>
                        <textarea name="warningSigns" placeholder="Warning signs others might notice (e.g., changes in sleep, mood swings)..." rows="3"></textarea>
                    </div>
                    
                    <div class="safety-plan-section">
                        <h3>2. Coping Strategies</h3>
                        <p>Things you can do on your own to help yourself feel better:</p>
                        <textarea name="copingStrategies" placeholder="List activities that help you cope (e.g., listening to music, going for a walk, deep breathing)..." rows="4"></textarea>
                    </div>
                    
                    <div class="safety-plan-section">
                        <h3>3. Social Support</h3>
                        <p>People you can talk to for support:</p>
                        <div class="form-row">
                            <input type="text" name="supportPerson1" placeholder="Name">
                            <input type="tel" name="supportPhone1" placeholder="Phone number">
                        </div>
                        <div class="form-row">
                            <input type="text" name="supportPerson2" placeholder="Name">
                            <input type="tel" name="supportPhone2" placeholder="Phone number">
                        </div>
                    </div>
                    
                    <div class="safety-plan-section">
                        <h3>4. Professional Contacts</h3>
                        <p>Healthcare providers and emergency contacts:</p>
                        <div class="form-row">
                            <input type="text" name="therapistName" placeholder="Therapist/Counselor Name">
                            <input type="tel" name="therapistPhone" placeholder="Phone number">
                        </div>
                        <div class="form-row">
                            <input type="text" name="doctorName" placeholder="Doctor Name">
                            <input type="tel" name="doctorPhone" placeholder="Phone number">
                        </div>
                    </div>
                    
                    <div class="safety-plan-section">
                        <h3>5. Safe Environment</h3>
                        <p>Ways to make your environment safer:</p>
                        <textarea name="environmentSafety" placeholder="List steps to make your space safer (e.g., remove harmful items, ask family to check on you)..." rows="3"></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary btn-full">Save Safety Plan</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', planHtml);
    
    document.getElementById('safetyPlanForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSafetyPlan(this);
    });
}

function closeSafetyPlan() {
    const modal = document.getElementById('safetyPlan');
    if (modal) modal.remove();
}

function saveSafetyPlan(form) {
    const formData = new FormData(form);
    const safetyPlan = {
        id: Date.now(),
        warningSignsPersonal: formData.get('warningSignsPersonal'),
        warningSigns: formData.get('warningSigns'),
        copingStrategies: formData.get('copingStrategies'),
        supportPerson1: formData.get('supportPerson1'),
        supportPhone1: formData.get('supportPhone1'),
        supportPerson2: formData.get('supportPerson2'),
        supportPhone2: formData.get('supportPhone2'),
        therapistName: formData.get('therapistName'),
        therapistPhone: formData.get('therapistPhone'),
        doctorName: formData.get('doctorName'),
        doctorPhone: formData.get('doctorPhone'),
        environmentSafety: formData.get('environmentSafety'),
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
    };
    
    localStorage.setItem('mindwell_safety_plan', JSON.stringify(safetyPlan));
    showNotification('Safety plan saved successfully!', 'success');
    closeSafetyPlan();
}

function viewCopingStrategies() {
    const strategiesHtml = `
        <div id="copingStrategies" class="modal show" style="display: flex;">
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>Coping Strategies</h2>
                    <span class="close" onclick="closeCopingStrategies()">&times;</span>
                </div>
                <div class="coping-content">
                    <div class="strategy-category">
                        <h3>🧘 Mindfulness & Relaxation</h3>
                        <ul>
                            <li>Deep breathing exercises (4-7-8 technique)</li>
                            <li>Progressive muscle relaxation</li>
                            <li>Mindfulness meditation (5-10 minutes)</li>
                            <li>Body scan meditation</li>
                            <li>Guided imagery</li>
                        </ul>
                    </div>
                    
                    <div class="strategy-category">
                        <h3>🏃 Physical Activities</h3>
                        <ul>
                            <li>Go for a walk or run</li>
                            <li>Do jumping jacks or stretches</li>
                            <li>Practice yoga</li>
                            <li>Dance to favorite music</li>
                            <li>Clean or organize space</li>
                        </ul>
                    </div>
                    
                    <div class="strategy-category">
                        <h3>🎨 Creative Expression</h3>
                        <ul>
                            <li>Draw, paint, or doodle</li>
                            <li>Write in a journal</li>
                            <li>Listen to calming music</li>
                            <li>Play a musical instrument</li>
                            <li>Crafting or DIY projects</li>
                        </ul>
                    </div>
                    
                    <div class="strategy-category">
                        <h3>🤝 Social Connection</h3>
                        <ul>
                            <li>Call a trusted friend or family member</li>
                            <li>Send a text to check in with someone</li>
                            <li>Join an online support group</li>
                            <li>Pet or spend time with animals</li>
                            <li>Volunteer for a cause you care about</li>
                        </ul>
                    </div>
                    
                    <div class="strategy-category">
                        <h3>🧠 Cognitive Techniques</h3>
                        <ul>
                            <li>Practice gratitude (list 3 things you're grateful for)</li>
                            <li>Challenge negative thoughts</li>
                            <li>Use positive affirmations</li>
                            <li>Focus on what you can control</li>
                            <li>Break problems into smaller steps</li>
                        </ul>
                    </div>
                    
                    <div class="emergency-note">
                        <p><strong>Remember:</strong> If you're having thoughts of self-harm, please reach out for immediate help:</p>
                        <div class="emergency-contacts">
                            <a href="tel:988" class="btn btn-danger">Call 988</a>
                            <a href="tel:911" class="btn btn-warning">Call 911</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', strategiesHtml);
}

function closeCopingStrategies() {
    const modal = document.getElementById('copingStrategies');
    if (modal) modal.remove();
}

function contactSupports() {
    const contactsHtml = `
        <div id="emergencyContacts" class="modal show" style="display: flex;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Emergency Contacts</h2>
                    <span class="close" onclick="closeEmergencyContacts()">&times;</span>
                </div>
                <div class="contacts-content">
                    <div class="contact-section">
                        <h3>🚨 Crisis Hotlines</h3>
                        <div class="contact-item">
                            <h4>National Suicide Prevention Lifeline</h4>
                            <a href="tel:988" class="contact-number">988</a>
                            <p>24/7 free and confidential support</p>
                        </div>
                        <div class="contact-item">
                            <h4>Crisis Text Line</h4>
                            <span class="contact-number">Text HOME to 741741</span>
                            <p>24/7 crisis support via text</p>
                        </div>
                        <div class="contact-item">
                            <h4>National Alliance on Mental Illness</h4>
                            <a href="tel:18009506264" class="contact-number">1-800-950-NAMI</a>
                            <p>Information and referral services</p>
                        </div>
                    </div>
                    
                    <div class="contact-section">
                        <h3>🏥 Local Emergency Services</h3>
                        <div class="contact-item">
                            <h4>Emergency Services</h4>
                            <a href="tel:911" class="contact-number">911</a>
                            <p>For immediate life-threatening emergencies</p>
                        </div>
                        <div class="contact-item">
                            <h4>Local Crisis Center</h4>
                            <span class="contact-number">Call 211 for local resources</span>
                            <p>Find crisis centers near you</p>
                        </div>
                    </div>
                    
                    <div class="contact-section">
                        <h3>📱 Online Resources</h3>
                        <div class="contact-item">
                            <h4>Crisis Chat</h4>
                            <button onclick="startCrisisChat(); closeEmergencyContacts();" class="btn btn-primary btn-sm">Start Chat</button>
                            <p>Anonymous crisis support chat</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', contactsHtml);
}

function closeEmergencyContacts() {
    const modal = document.getElementById('emergencyContacts');
    if (modal) modal.remove();
}

// Enhanced Data Initialization with Backend Integration
async function initializeAllData() {
    try {
        // Try to load data from backend first
        await Promise.all([
            loadJournalDataFromBackend(),
            loadGoalsDataFromBackend(),
            loadUserMoodData(),
            loadUserActivities()
        ]);
        console.log('Successfully loaded data from backend');
    } catch (error) {
        console.error('Failed to load from backend, using local fallback:', error);
        // Fallback to local initialization
        initializeJournal();
        initializeGoals();
        initializeCommunity();
        initializeResources();
        initializeAppointments();
    }
}

// Load journal data from backend
async function loadJournalDataFromBackend() {
    try {
        const response = await fetch(API_ENDPOINTS.journal.entries, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                localStorage.setItem('mindwell_journal_entries', JSON.stringify(data.entries));
                console.log('Loaded journal entries from backend:', data.entries.length);
            }
        }
    } catch (error) {
        console.error('Failed to load journal data from backend:', error);
        initializeJournal(); // Fallback
    }
}

// Load goals data from backend  
async function loadGoalsDataFromBackend() {
    try {
        const response = await fetch(API_ENDPOINTS.goals.list, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                localStorage.setItem('mindwell_goals', JSON.stringify(data.goals));
                console.log('Loaded goals from backend:', data.goals.length);
            }
        }
    } catch (error) {
        console.error('Failed to load goals data from backend:', error);
        initializeGoals(); // Fallback
    }
}

// Enhanced AI Chat Integration
async function sendAIChatMessage(message, context = {}) {
    try {
        const response = await fetch(API_ENDPOINTS.chat.ai_chat, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                use_memory: true,
                use_rag: true,
                context: context,
                room_type: 'crisis_support'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error('Failed to get AI response');
        }
    } catch (error) {
        console.error('Error in AI chat:', error);
        return { success: false, error: error.message };
    }
}

// Get personalized recommendations using RAG
async function getPersonalizedRecommendations() {
    try {
        const response = await fetch(`${API_BASE_URL}/chat/recommendations/`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                use_memory: true,
                use_rag: true,
                category: 'mental_health_recommendations'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displayPersonalizedRecommendations(data.recommendations);
            }
        }
    } catch (error) {
        console.error('Failed to get personalized recommendations:', error);
    }
}

// Display personalized recommendations
function displayPersonalizedRecommendations(recommendations) {
    const dashboardGrid = document.querySelector('.dashboard-grid');
    const existingRecommendations = document.querySelector('.personalized-recommendations');
    
    if (existingRecommendations) {
        existingRecommendations.remove();
    }
    
    const recommendationsCard = document.createElement('div');
    recommendationsCard.className = 'personalized-recommendations card';
    recommendationsCard.innerHTML = `
        <div class="card-header">
            <h2>🎯 Personalized for You</h2>
        </div>
        <div class="recommendations-content">
            ${recommendations.map(rec => `
                <div class="recommendation-item">
                    <i class="fas fa-${rec.icon || 'star'}"></i>
                    <div class="rec-content">
                        <h4>${rec.title}</h4>
                        <p>${rec.description}</p>
                        ${rec.action ? `<button class="btn btn-outline btn-sm" onclick="${rec.action}">${rec.action_text}</button>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    dashboardGrid.appendChild(recommendationsCard);
}

function initializeCommunity() {
    if (!localStorage.getItem('mindwell_community_posts')) {
        const samplePosts = [
            {
                id: 1,
                author: "Anonymous",
                content: "Had a tough day today but trying to remember that it's okay to not be okay sometimes. Taking it one step at a time. 💙",
                category: "General Support",
                likes: 12,
                comments: 5,
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                isAnonymous: true
            },
            {
                id: 2,
                author: "MindfulMike",
                content: "30 days meditation streak! 🎉 Never thought I could stick to it but here we are. For anyone struggling to start, just try 5 minutes a day. You've got this!",
                category: "Success Story",
                likes: 28,
                comments: 8,
                timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                isAnonymous: false
            }
        ];
        localStorage.setItem('mindwell_community_posts', JSON.stringify(samplePosts));
    }
}

function initializeResources() {
    if (!localStorage.getItem('mindwell_resources')) {
        const sampleResources = [
            {
                id: 1,
                title: "Understanding Anxiety: A Complete Guide",
                type: "article",
                content: "Learn about anxiety disorders, symptoms, and evidence-based treatment approaches.",
                duration: "15 min read",
                rating: 4.7,
                category: "anxiety",
                url: "#",
                featured: true
            },
            {
                id: 2,
                title: "Daily Mindfulness Practice",
                type: "video",
                content: "Simple mindfulness exercises you can do anywhere, anytime.",
                duration: "12 minutes",
                rating: 4.9,
                category: "mindfulness",
                url: "#",
                featured: true
            }
        ];
        localStorage.setItem('mindwell_resources', JSON.stringify(sampleResources));
    }
}

function initializeAppointments() {
    if (!localStorage.getItem('mindwell_appointments')) {
        const sampleAppointments = [
            {
                id: 1,
                therapist: "dr-sarah-smith",
                therapistName: "Dr. Sarah Smith",
                type: "individual",
                date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                time: "14:00",
                format: "video",
                status: "scheduled",
                notes: "Follow-up on anxiety management techniques"
            }
        ];
        localStorage.setItem('mindwell_appointments', JSON.stringify(sampleAppointments));
    }
}

// Enhanced Analytics and Insights
function generateMoodInsights() {
    const moodData = JSON.parse(localStorage.getItem('mindwell_mood_data') || '[]');
    if (moodData.length < 7) return null;
    
    const insights = {
        weeklyTrend: calculateWeeklyTrend(moodData),
        commonFactors: getCommonMoodFactors(moodData),
        bestDays: getBestDays(moodData),
        recommendations: generateRecommendations(moodData)
    };
    
    return insights;
}

function calculateWeeklyTrend(moodData) {
    const recent = moodData.slice(-7);
    const scores = recent.map(entry => entry.score);
    const trend = scores[scores.length - 1] - scores[0];
    
    return {
        direction: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
        change: Math.abs(trend),
        message: trend > 0 ? 'Your mood has been improving!' : 
                trend < 0 ? 'Your mood needs attention' : 
                'Your mood has been stable'
    };
}

function getCommonMoodFactors(moodData) {
    const factorCounts = {};
    moodData.forEach(entry => {
        entry.factors?.forEach(factor => {
            factorCounts[factor] = (factorCounts[factor] || 0) + 1;
        });
    });
    
    return Object.entries(factorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([factor]) => factor);
}

// Enhanced Tab Loading Functions
function loadMeditationData() {
    const meditationStats = JSON.parse(localStorage.getItem('mindwell_meditation_stats') || '{}');
    updateMeditationStats(meditationStats);
}

function loadAppointmentsData() {
    const appointments = JSON.parse(localStorage.getItem('mindwell_appointments') || '[]');
    updateAppointmentsList(appointments);
}

function loadCommunityData() {
    const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
    updateCommunityFeed(posts);
}

function loadResourcesData() {
    const resources = JSON.parse(localStorage.getItem('mindwell_resources') || '[]');
    updateResourcesGrid(resources);
}

function updateMeditationStats(stats) {
    // Update meditation statistics in the UI
    const totalSessions = stats.totalSessions || 0;
    const totalMinutes = stats.totalMinutes || 0;
    const streak = stats.currentStreak || 0;
    
    // Update UI elements if they exist
    const statsElements = document.querySelectorAll('.meditation-stat');
    if (statsElements.length >= 3) {
        statsElements[0].textContent = `${totalSessions} sessions`;
        statsElements[1].textContent = `${totalMinutes} minutes`;
        statsElements[2].textContent = `${streak} day streak`;
    }
}

function updateAppointmentsList(appointments) {
    const appointmentsList = document.querySelector('.appointment-list');
    if (!appointmentsList) return;
    
    appointmentsList.innerHTML = '';
    
    appointments.slice(0, 5).forEach(appointment => {
        const date = new Date(appointment.date);
        const appointmentCard = document.createElement('div');
        appointmentCard.className = 'appointment-card';
        appointmentCard.innerHTML = `
            <div class="appointment-date">
                <span class="day">${date.getDate()}</span>
                <span class="month">${date.toLocaleDateString('en-US', { month: 'short' })}</span>
            </div>
            <div class="appointment-info">
                <h4>${appointment.therapistName}</h4>
                <p>${appointment.type} Session</p>
                <div class="appointment-meta">
                    <span><i class="fas fa-clock"></i> ${appointment.time}</span>
                    <span><i class="fas fa-${appointment.format === 'video' ? 'video' : appointment.format === 'phone' ? 'phone' : 'map-marker-alt'}"></i> ${appointment.format}</span>
                </div>
            </div>
            <div class="appointment-actions">
                <button class="btn btn-outline btn-sm" onclick="rescheduleAppointment(${appointment.id})">Reschedule</button>
                <button class="btn btn-primary btn-sm" onclick="joinAppointment(${appointment.id})">Join</button>
            </div>
        `;
        appointmentsList.appendChild(appointmentCard);
    });
}

function updateCommunityFeed(posts) {
    const postsFeed = document.querySelector('.posts-feed');
    if (!postsFeed) return;
    
    postsFeed.innerHTML = '';
    
    posts.slice(0, 10).forEach(post => {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.innerHTML = `
            <div class="post-header">
                <img src="https://ui-avatars.com/api/?name=${post.author}&background=6366f1&color=fff" alt="User" class="post-avatar">
                <div class="post-meta">
                    <h4>${post.author}</h4>
                    <span>${getTimeAgo(post.timestamp)} • ${post.category}</span>
                </div>
            </div>
            <div class="post-content">
                <p>${post.content}</p>
            </div>
            <div class="post-actions">
                <button class="post-btn" onclick="likePost(${post.id})"><i class="fas fa-heart"></i> ${post.likes}</button>
                <button class="post-btn" onclick="commentOnPost(${post.id})"><i class="fas fa-comment"></i> ${post.comments}</button>
                <button class="post-btn"><i class="fas fa-share"></i> Share</button>
            </div>
        `;
        postsFeed.appendChild(postCard);
    });
}

function updateResourcesGrid(resources) {
    const resourcesGrid = document.querySelector('.resources-grid');
    if (!resourcesGrid) return;
    
    resourcesGrid.innerHTML = '';
    
    resources.forEach(resource => {
        const resourceCard = document.createElement('div');
        resourceCard.className = 'resource-card';
        resourceCard.setAttribute('data-type', resource.type);
        resourceCard.innerHTML = `
            <img src="https://via.placeholder.com/300x200/6366f1/ffffff?text=${encodeURIComponent(resource.title)}" alt="${resource.title}">
            <div class="resource-content">
                <span class="resource-type">${resource.type}</span>
                <h3>${resource.title}</h3>
                <p>${resource.content}</p>
                <div class="resource-meta">
                    <span><i class="fas fa-clock"></i> ${resource.duration}</span>
                    <span><i class="fas fa-star"></i> ${resource.rating} rating</span>
                </div>
            </div>
            <button class="btn btn-outline" onclick="openResource('${resource.url}')">
                ${resource.type === 'article' ? 'Read Article' : 
                  resource.type === 'video' ? 'Watch Video' : 
                  resource.type === 'podcast' ? 'Listen Now' : 'View Resource'}
            </button>
        `;
        resourcesGrid.appendChild(resourceCard);
    });
}

// Utility functions for new features
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function likePost(postId) {
    const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.likes += 1;
        localStorage.setItem('mindwell_community_posts', JSON.stringify(posts));
        loadCommunityData();
    }
}

function commentOnPost(postId) {
    showNotification('Comment feature coming soon!', 'info');
}

function rescheduleAppointment(appointmentId) {
    showNotification('Reschedule feature coming soon!', 'info');
}

function joinAppointment(appointmentId) {
    showNotification('Joining appointment...', 'success');
}

function openResource(url) {
    if (url === '#') {
        showNotification('Resource content coming soon!', 'info');
    } else {
        window.open(url, '_blank');
    }
}

// Initialize all data when dashboard loads
document.addEventListener('DOMContentLoaded', function() {
    initializeAllData();
});

// Logout function
function logout() {
    localStorage.removeItem('mindwell_user');
    sessionStorage.removeItem('mindwell_user');
    window.location.href = 'index.html';
}

// Create test real user for testing refresh functionality  
function createTestRealUser() {
    console.log('Creating test real user for refresh testing...');
    
    // Set real user data (not demo mode)
    isDemoMode = false;
    
    // Set real user authentication data
    currentUser = {
        id: 'user123',
        username: 'yasmeen.naaz',
        firstName: 'Yasmeen',
        lastName: 'Naaz',
        email: 'yasmeen.naaz@mindwell.com'
    };
    
    isLoggedIn = true;
    
    // Set authentication data in localStorage
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(currentUser));
    localStorage.setItem('loginTime', Date.now().toString());
    
    updateUserProfile();
    
    // Load dashboard data
    loadDashboardData();
    
    console.log('Test real user created and logged in');
}

// Create demo user data for testing dynamic functionality
function createDemoUser() {
    console.log('Creating demo user data...');
    
    // Set demo mode flag to prevent backend API calls
    isDemoMode = true;
    
    // Set demo user data
    currentUser = {
        id: 'demo',
        username: 'demo',
        firstName: 'Yasmeen',
        lastName: 'Demo',
        email: 'yasmeen.demo@mindwell.com'
    };
    
    isLoggedIn = true;
    updateUserProfile();
    
    // Create comprehensive demo data with user-specific keys
    const demoMoodData = [
        {
            date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mood: 'neutral',
            score: 6,
            note: '',
            factors: ['Sleep']
        },
        {
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mood: 'good',
            score: 8,
            note: 'Had a good therapy session',
            factors: ['Therapy', 'Exercise']
        },
        {
            date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mood: 'sad',
            score: 4,
            note: 'Feeling stressed about work',
            factors: ['Work', 'Stress']
        },
        {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mood: 'neutral',
            score: 6,
            note: '',
            factors: ['Sleep']
        },
        {
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mood: 'good',
            score: 8,
            note: 'Meditation helped a lot',
            factors: ['Meditation', 'Exercise']
        },
        {
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mood: 'very-good',
            score: 10,
            note: 'Great day with friends',
            factors: ['Social', 'Exercise']
        },
        {
            date: new Date().toISOString().split('T')[0],
            mood: 'good',
            score: 8,
            note: 'Feeling good today! The meditation really helped.',
            factors: ['Sleep', 'Meditation']
        }
    ];
    
    const demoActivities = [
        {
            id: 1,
            type: 'meditation',
            activity_type: 'meditation',
            title: 'Completed 10-minute meditation',
            description: 'Completed 10-minute meditation session',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            icon: 'fas fa-meditation'
        },
        {
            id: 2,
            type: 'mood',
            activity_type: 'mood',
            title: 'Logged mood: Good',
            description: 'Logged daily mood entry',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            icon: 'fas fa-smile'
        },
        {
            id: 3,
            type: 'journal',
            activity_type: 'journal',
            title: 'Added journal entry',
            description: 'Wrote about today\'s experiences',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            icon: 'fas fa-pen'
        }
    ];
    
    // Store demo data with user-specific keys
    const moodDataKey = getUserSpecificKey('mindwell_mood_data');
    const activitiesKey = getUserSpecificKey('mindwell_activities');
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const journalKey = getUserSpecificKey('mindwell_journal_entries');
    
    localStorage.setItem(moodDataKey, JSON.stringify(demoMoodData));
    localStorage.setItem(activitiesKey, JSON.stringify(demoActivities));
    
    // Create demo goals
    const demoGoals = [
        {
            id: 1,
            title: "Daily Meditation Practice",
            description: "Meditate for at least 10 minutes every day",
            category: "mindfulness",
            targetType: "daily",
            targetValue: 30,
            currentValue: 7,
            unit: "days",
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: "active",
            priority: "high",
            reminders: true,
            createdAt: new Date().toISOString()
        }
    ];
    localStorage.setItem(goalsKey, JSON.stringify(demoGoals));
    
    // Create demo journal entries
    const demoJournalEntries = [
        {
            id: 1,
            title: "Reflecting on Progress",
            content: "Today I realized how much progress I've made over the past few months. The daily meditation is really helping me stay centered and focused. I'm grateful for the small wins.",
            mood: "good",
            tags: ["Progress", "Meditation", "Gratitude"],
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            wordCount: 45,
            isPrivate: false,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
    ];
    localStorage.setItem(journalKey, JSON.stringify(demoJournalEntries));
    
    console.log('Demo user data created successfully');
    
    // Load dashboard data
    loadDashboardData();
}

// Refresh user data from backend
async function refreshUserData() {
    console.log('Refreshing user data from backend...');
    
    // Show loading state
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.7';
    }
    
    try {
        // Show immediate feedback
        showNotification('Generating new data from server...', 'info');
        
        // First, call the backend refresh endpoint to generate new data
        console.log('Calling backend refresh endpoint...');
        const refreshResponse = await fetch(`${API_BASE_URL}/dashboard/api/refresh-data/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!refreshResponse.ok) {
            throw new Error(`Refresh request failed: ${refreshResponse.status}`);
        }
        
        const refreshResult = await refreshResponse.json();
        console.log('Backend refresh result:', refreshResult);
        
        if (refreshResult.success) {
            // Show intermediate success message
            showNotification('📊 New data generated! Loading updated dashboard...', 'info');
            
            // Wait a moment for data to be committed
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Now refresh all user data from backend to get the new data
            await Promise.all([
                loadUserMoodData(),
                loadUserActivities(),
                loadUserMemoryProfile(),
                loadJournalDataFromBackend(),
                loadGoalsDataFromBackend()
            ]);
            
            // Refresh dashboard if we're currently on it
            if (currentTab === 'dashboard') {
                await loadDashboardData();
            }
            
            // Refresh current tab data
            loadTabData(currentTab);
            
            // Show detailed success notification
            const changes = refreshResult.changes || {};
            let successMessage = '✅ Dashboard refreshed successfully! ';
            if (changes.mood_updated) successMessage += 'New mood data generated. ';
            if (changes.goals_updated) successMessage += 'Goal progress updated. ';
            if (changes.data_refresh_time) successMessage += `Updated at ${changes.data_refresh_time}.`;
            
            showNotification(successMessage, 'success');
            console.log('User data refreshed successfully with new data');
        } else {
            throw new Error(refreshResult.message || 'Backend refresh failed');
        }
        
    } catch (error) {
        console.error('Error refreshing user data:', error);
        showNotification('❌ Failed to refresh data. Please try again.', 'error');
    } finally {
        // Reset button state with slight delay
        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = '1';
            }
        }, 500);
    }
}

// Show refresh button for real users only
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (!refreshBtn) return;
    
    // Show refresh button only for real users (not demo mode or demo users)
    if (!isDemoMode && !isDemoUser() && isLoggedIn) {
        refreshBtn.style.display = 'inline-flex';
        console.log('Refresh button shown for real user');
    } else {
        refreshBtn.style.display = 'none';
        console.log('Refresh button hidden for demo user/mode');
    }
}

// Export functions to global scope
window.switchTab = switchTab;
window.saveMood = saveMood;
window.startMeditation = startMeditation;
window.startBreathing = startBreathing;
window.showBookingModal = showBookingModal;
window.createNewGoal = createNewGoal;
window.startCrisisChat = startCrisisChat;
window.createSafetyPlan = createSafetyPlan;
window.viewCopingStrategies = viewCopingStrategies;
window.contactSupports = contactSupports;
window.saveJournalEntry = saveJournalEntry;
window.updateGoalProgress = updateGoalProgress;
window.closeCrisisChat = closeCrisisChat;
window.closeSafetyPlan = closeSafetyPlan;
window.closeCopingStrategies = closeCopingStrategies;
window.closeEmergencyContacts = closeEmergencyContacts;
window.closeGoalModal = closeGoalModal;
window.closeAppointmentModal = closeAppointmentModal;
window.sendChatMessage = sendChatMessage;
window.refreshUserData = refreshUserData;
window.logout = logout;
