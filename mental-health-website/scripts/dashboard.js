// Dashboard JavaScript for MindWell Mental Health Website

// Global variables
let currentUser = null;
let isLoggedIn = false;
let currentTab = 'dashboard';
let moodChart = null;
let breathingInterval = null;
let breathingCycle = 'inhale';
let breathingTimer = null;
let isDemoMode = false;

// Returns local date as YYYY-MM-DD (never UTC — fixes timezone off-by-one)
function localDateStr(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Simple TTL cache — avoids redundant backend calls on tab switches
const _cache = {};
function cacheGet(key, ttlMs = 60000) {
    const entry = _cache[key];
    if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
    return null;
}
function cacheSet(key, data) { _cache[key] = { data, ts: Date.now() }; }
function cacheInvalidate(key) { delete _cache[key]; }

// ─── API Configuration ────────────────────────────────────────────────────────
// On localhost: always use local backend (meta tag ignored for local dev).
// On any other host: use <meta name="api-base-url"> if present, else Render.
const _dashIsLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const _metaApiUrl = document.querySelector('meta[name="api-base-url"]');
const _metaWsUrl  = document.querySelector('meta[name="ws-base-url"]');

const API_BASE_URL  = _dashIsLocal ? 'http://localhost:8000'
    : ((_metaApiUrl && _metaApiUrl.content) ? _metaApiUrl.content.replace(/\/$/, '') : 'https://mindwell-backend.onrender.com');
const CHAT_WS_URL   = _dashIsLocal ? 'ws://localhost:8000'
    : ((_metaWsUrl  && _metaWsUrl.content)  ? _metaWsUrl.content.replace(/\/$/, '')  : 'wss://mindwell-backend.onrender.com');
const SUPPORT_AVATAR_URL = 'https://randomuser.me/api/portraits/women/68.jpg?v=20260505';
const SUPPORT_AVATAR_FALLBACK_URL = 'https://i.pravatar.cc/120?img=47';

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
    safetyPlan: {
        get:         `${API_BASE_URL}/dashboard/api/safety-plan/`,
        save:        `${API_BASE_URL}/dashboard/api/safety-plan/save/`,
        suggestions: (section) => `${API_BASE_URL}/dashboard/api/safety-plan/suggestions/?section=${section}`,
    },
    community: {
        posts: `${API_BASE_URL}/chat/community/posts/`,
        like: (id) => `${API_BASE_URL}/chat/community/posts/${id}/like/`,
        groups: `${API_BASE_URL}/chat/community/groups/`,
        groupJoin: (id) => `${API_BASE_URL}/chat/community/groups/${id}/join/`,
        redditFeed: (sub) => `${API_BASE_URL}/dashboard/api/reddit-feed/?sub=${sub}`,
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
        analyse: `${API_BASE_URL}/dashboard/api/journal-entries/analyse/`,
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

// Returns Authorization header for cross-origin API calls using the stored token.
// Falls back gracefully when no token is present (demo mode / not logged in).
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return token ? { 'Authorization': `Token ${token}` } : {};
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard script loaded successfully');
    initializeDashboard();
    
    // Add debugging for crisis chat button
    console.log('Checking if startCrisisChat function exists:', typeof window.startCrisisChat);
});

// Initialize dashboard
function initializeDashboard() {
    // Clean up stale non-user-specific localStorage keys from old versions
    ['mindwell_goals', 'mindwell_journal_entries', 'mindwell_mood_data', 'mindwell_activities'].forEach(k => {
        if (localStorage.getItem(k)) localStorage.removeItem(k);
    });

    checkAuthentication();
    setupTabNavigation();
    setupDashboardData();
    setupMoodTracking();
    setupMeditationFeatures();
    setupBreathingExercise();
    setupCharts();
    loadUserData();
    setupCrisisChatButton();
    setupRefreshButton();
    // Load safety plan state (card badge + wallet card)
    setTimeout(_updateSafetyPlanCard, 1500);
}

function getSupportAvatarMarkup() {
    return `<img src="${SUPPORT_AVATAR_URL}" alt="Support guide" class="avatar-photo" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${SUPPORT_AVATAR_FALLBACK_URL}';">`;
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
        showNotification('Opening dashboard in demo mode', 'info');
        createDemoUser();
        return;
    }
    
    // Parse user data and set as current user first
    try {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
        updateUserProfile();
        console.log('User data loaded from localStorage:', currentUser);

        // Load dashboard and analytics now that isLoggedIn is true
        await loadDashboardData();
        loadMoodTrackerData();
        initPushNotifications(); // start SW + push subscription
    } catch (parseError) {
        console.error('Failed to parse user data:', parseError);
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        showNotification('Session data was invalid, using demo mode', 'info');
        createDemoUser();
        return;
    }
    
    // Verify with backend in the background (don't block the UI)
    verifyAuthWithBackend();
}

// Separate function to verify with backend without blocking the UI
async function verifyAuthWithBackend() {
    // Skip backend verification for demo mode and demo users
    if (isDemoMode || isDemoUser()) {
        console.log('Skipping backend auth verification for demo user/mode');
        return;
    }
    
    try {
        console.log('Verifying authentication with backend...');
        const response = await fetch(API_ENDPOINTS.auth.status, {
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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
        const response = await fetch(API_ENDPOINTS.auth.profile, {
            headers: {
                ...getAuthHeaders(),
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

        const avatarImg = document.querySelector('.profile-avatar img');
        if (avatarImg) {
            const fullName = encodeURIComponent(`${firstName} ${lastName}`.trim());
            avatarImg.src = `https://ui-avatars.com/api/?name=${fullName}&background=6366f1&color=fff&t=${Date.now()}`;
            avatarImg.alt = `${firstName} ${lastName}`;
        }
        
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

    // Close community WebSocket when leaving the community tab
    if (tabName !== 'community') disconnectCommunitySocket();

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
            initializeJournal();
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
        // Run all three in parallel instead of sequentially
        await Promise.all([
            loadUserMoodData(),
            loadUserActivities()
        ]);
        // Memory profile is non-critical — run in background, don't block
        loadUserMemoryProfile().catch(() => {});
    } catch (error) {
        console.error('Error setting up dashboard data:', error);
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
    if (cacheGet('moodData')) return; // Fresh data in cache, skip fetch
    const moodDataKey = getUserSpecificKey('mindwell_mood_data');
    try {
        const response = await fetch(API_ENDPOINTS.mood.entries, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                localStorage.setItem(moodDataKey, JSON.stringify(data.mood_entries));
                cacheSet('moodData', true);
            }
        }
    } catch (error) {
        console.error('Failed to load mood data:', error);
    }
}

// Load user activities from backend
async function loadUserActivities() {
    if (cacheGet('activitiesData')) return; // Fresh data in cache, skip fetch
    const activitiesKey = getUserSpecificKey('mindwell_activities');
    try {
        const response = await fetch(API_ENDPOINTS.dashboard.activities, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                localStorage.setItem(activitiesKey, JSON.stringify(data.activities));
                cacheSet('activitiesData', true);
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
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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
            date: localDateStr(date),
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
        const localToday = new Date();
        const todayParam = `${localToday.getFullYear()}-${String(localToday.getMonth()+1).padStart(2,'0')}-${String(localToday.getDate()).padStart(2,'0')}`;
        const response = await fetch(`${API_ENDPOINTS.dashboard.overview}?today=${todayParam}`, {
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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
    await Promise.all([loadUserMoodData(), loadUserActivities()]);
    
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

    if (moodValue && dashboardStats.todays_mood) {
        const moodLabels = {
            'very-sad': 'Very Sad',
            'sad': 'Sad',
            'neutral': 'Neutral',
            'good': 'Good',
            'very-good': 'Very Good'
        };
        moodValue.textContent = moodLabels[dashboardStats.todays_mood.mood] || 'Not logged';

        const moodSubtext = document.querySelector('.stat-card .stat-change');
        if (moodSubtext) {
            const change = dashboardStats.todays_mood.change;
            if (change === null || change === undefined) {
                moodSubtext.textContent = 'No entry for yesterday';
                moodSubtext.className = 'stat-change neutral';
            } else if (change === 0) {
                moodSubtext.textContent = 'Same as yesterday';
                moodSubtext.className = 'stat-change neutral';
            } else {
                moodSubtext.textContent = `${change > 0 ? '+' : ''}${change}% from yesterday`;
                moodSubtext.className = `stat-change ${change > 0 ? 'positive' : 'negative'}`;
            }
        }
    }

    // Update meditation streak
    const streakElements = document.querySelectorAll('.stat-card');
    if (streakElements.length > 1 && dashboardStats.meditation_streak !== undefined) {
        const streakValue = streakElements[1].querySelector('.stat-value');
        const streakChange = streakElements[1].querySelector('.stat-change');

        if (streakValue) streakValue.textContent = `${dashboardStats.meditation_streak} days`;
        if (streakChange && dashboardStats.meditation_streak > 0) {
            streakChange.textContent = dashboardStats.meditation_streak_text || 'Personal best!';
            streakChange.className = 'stat-change positive';
        }
    }

    // Update next session
    if (streakElements.length > 2 && dashboardStats.next_session) {
        const sessionValue = streakElements[2].querySelector('.stat-value');
        const sessionChange = streakElements[2].querySelector('.stat-change');

        if (sessionValue) sessionValue.textContent = dashboardStats.next_session.time || 'Tomorrow';
        if (sessionChange) sessionChange.textContent = dashboardStats.next_session.details || '2:00 PM with Dr. Smith';
    }

    // Update weekly goals
    if (streakElements.length > 3 && dashboardStats.weekly_goals) {
        const goalsValue = streakElements[3].querySelector('.stat-value');
        const goalsChange = streakElements[3].querySelector('.stat-change');

        if (goalsValue) goalsValue.textContent = dashboardStats.weekly_goals.progress || '4/6';
        if (goalsChange) {
            goalsChange.textContent = dashboardStats.weekly_goals.status || 'On track';
            goalsChange.className = `stat-change ${dashboardStats.weekly_goals.on_track ? 'positive' : 'neutral'}`;
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

// Refresh the mood trend chart by re-fetching dashboard-overview chart data
async function refreshMoodTrendChart() {
    if (isDemoMode || !isLoggedIn) return;
    try {
        const ld = new Date();
        const tp = `${ld.getFullYear()}-${String(ld.getMonth()+1).padStart(2,'0')}-${String(ld.getDate()).padStart(2,'0')}`;
        const response = await fetch(`${API_ENDPOINTS.dashboard.overview}?today=${tp}`, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.mood_chart_data) {
                if (moodChart) moodChart.destroy();
                createMoodChartFromBackend(data.mood_chart_data);
            }
        }
    } catch (e) {
        console.error('Failed to refresh mood trend chart:', e);
    }
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
                borderColor: '#44556b',
                backgroundColor: 'rgba(68, 85, 107, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                spanGaps: false,
                pointBackgroundColor: scores.map(s => s === null ? 'transparent' : '#44556b'),
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: scores.map(s => s === null ? 0 : 6),
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            const scoreToMood = { 2: 'Very Sad', 4: 'Sad', 6: 'Neutral', 8: 'Good', 10: 'Very Good' };
                            return ctx.raw !== null ? scoreToMood[ctx.raw] || ctx.raw : 'No entry';
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 1,
                    max: 10,
                    ticks: {
                        stepSize: 2,
                        callback: function(value) {
                            const labels = { 2: 'Very Sad', 4: 'Sad', 6: 'Neutral', 8: 'Good', 10: 'Very Good' };
                            return labels[value] || '';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)'
                    }
                },
                x: {
                    grid: { display: false }
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
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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
    const today = localDateStr();
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
        // Parse date-only strings as local noon to avoid UTC midnight timezone shift
        const [y, m, d] = (entry.date || '').split('-').map(Number);
        const date = new Date(y, m - 1, d, 12);
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
                borderColor: '#44556b',
                backgroundColor: 'rgba(68, 85, 107, 0.12)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#44556b',
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
        date: localDateStr()
    };
    
    try {
        // Save to backend
        const response = await fetch(API_ENDPOINTS.mood.create, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(moodEntry)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Add to Mem0 memory system
                addToMemorySystem('mood', `User logged mood: ${selectedMood.textContent.trim()}. Note: ${moodNote}. Factors: ${selectedFactors.join(', ')}`);
                
                // Update local storage for immediate UI update
                await loadUserMoodData();
                
                showNotification('Mood logged successfully!', 'success');
                _checkMoodForSafetyNudge(moodScores[selectedMood.getAttribute('data-mood')] || 5);

                // Reset form
                selectedMood.classList.remove('selected');
                document.querySelector('.mood-details textarea').value = '';
                document.querySelectorAll('.factor-tag.selected').forEach(tag => tag.classList.remove('selected'));

                // Refresh analytics and trend chart immediately after saving
                loadMoodTrackerData();
                refreshMoodTrendChart();

                // Update dashboard stats if on dashboard tab
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
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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

// Load mood tracker data — fetches live analytics from the backend
async function loadMoodTrackerData() {
    if (isDemoMode || !isLoggedIn) {
        // Demo fallback: compute from localStorage
        const moodDataKey = getUserSpecificKey('mindwell_mood_data');
        const moodData = JSON.parse(localStorage.getItem(moodDataKey) || '[]');
        if (moodData.length > 0) {
            const thisWeekData = moodData.slice(-7);
            const averageScore = thisWeekData.reduce((sum, e) => sum + e.score, 0) / thisWeekData.length;
            const mostCommonMood = getMostCommonMood(thisWeekData);
            const lastWeekData = moodData.slice(-14, -7);
            const lastWeekAvg = lastWeekData.length > 0
                ? lastWeekData.reduce((sum, e) => sum + e.score, 0) / lastWeekData.length : 0;
            const improvement = lastWeekAvg > 0
                ? ((averageScore - lastWeekAvg) / lastWeekAvg * 100).toFixed(0) : 0;
            updateMoodAnalytics(averageScore, mostCommonMood, improvement);
        }
        return;
    }

    try {
        const response = await fetch(API_ENDPOINTS.mood.analytics, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.analytics) {
                const a = data.analytics;
                updateMoodAnalytics(a.average_score, a.most_common_mood, a.weekly_improvement);
            }
        }
    } catch (error) {
        console.error('Failed to load mood analytics:', error);
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
    const moodLabels = {
        'very-sad': 'Very Sad', 'sad': 'Sad',
        'neutral': 'Neutral', 'good': 'Good', 'very-good': 'Very Good'
    };
    const moodIcons = {
        'very-sad': 'fa-sad-cry', 'sad': 'fa-frown',
        'neutral': 'fa-meh', 'good': 'fa-smile', 'very-good': 'fa-grin-stars'
    };

    const scoreValue = document.querySelector('.score-value');
    const scoreLabel = document.querySelector('.score-label');
    const commonMoodEl = document.querySelector('.common-mood span');
    const commonMoodIcon = document.querySelector('.common-mood i');
    const improvementValue = document.querySelector('.improvement-value');
    const improvementLabel = document.querySelector('.improvement-label');

    if (scoreValue) scoreValue.textContent = (averageScore !== null && averageScore !== undefined) ? Number(averageScore).toFixed(1) : '—';

    if (scoreLabel) {
        const s = Number(averageScore);
        // Scores: very-sad=2, sad=4, neutral=6, good=8, very-good=10
        const label = (!averageScore) ? '—' : s >= 9 ? 'Very Good' : s >= 7 ? 'Good' : s >= 5 ? 'Neutral' : s >= 3 ? 'Sad' : 'Very Sad';
        scoreLabel.textContent = label;
    }

    if (commonMoodEl) commonMoodEl.textContent = moodLabels[mostCommonMood] || '—';
    if (commonMoodIcon) {
        if (mostCommonMood) {
            commonMoodIcon.className = `fas ${moodIcons[mostCommonMood] || 'fa-smile'}`;
            commonMoodIcon.style.display = '';
        } else {
            commonMoodIcon.style.display = 'none';
        }
    }

    if (improvementValue) {
        const imp = Number(improvement);
        if (improvement === null || improvement === undefined) {
            improvementValue.textContent = '—';
            improvementValue.style.color = '';
        } else {
            improvementValue.textContent = `${imp > 0 ? '+' : ''}${imp}%`;
            improvementValue.style.color = imp > 0 ? '#06d6a0' : imp < 0 ? '#ff6b6b' : '';
        }
    }
    if (improvementLabel) improvementLabel.textContent = 'from last week';
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
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// ── Web Push Notification System ─────────────────────────────────────────────

let _swRegistration = null;

async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        _swRegistration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered');

        // Listen for SW messages (e.g. reminder clicked → switch to goals tab)
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data?.type === 'REMINDER_CLICK') {
                switchTab('goals');
            }
        });

        // If user is real and logged in, subscribe and request reminders
        if (!isDemoMode && isLoggedIn) {
            await subscribeToPush();
            requestGoalReminders();   // non-blocking
        }

    } catch (err) {
        console.warn('Service Worker registration failed:', err);
    }
}

async function subscribeToPush() {
    if (!_swRegistration && 'serviceWorker' in navigator) {
        _swRegistration = await navigator.serviceWorker.ready;
    }
    if (!_swRegistration) return;

    // Already subscribed?
    let sub = await _swRegistration.pushManager.getSubscription();
    if (sub) {
        await sendSubscriptionToBackend(sub);
        return;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Fetch VAPID public key
    let vapidKey;
    try {
        const res = await fetch(`${API_BASE_URL}/users/push/vapid-public-key/`);
        const data = await res.json();
        vapidKey = data.publicKey;
    } catch { return; }

    if (!vapidKey) return;

    // Subscribe
    try {
        sub = await _swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        await sendSubscriptionToBackend(sub);
    } catch (err) {
        console.warn('Push subscription failed:', err);
    }
}

async function sendSubscriptionToBackend(sub) {
    const key  = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    try {
        await fetch(`${API_BASE_URL}/users/push/subscribe/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
                endpoint: sub.endpoint,
                p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
                auth:   btoa(String.fromCharCode(...new Uint8Array(auth)))
            })
        });
    } catch (err) {
        console.warn('Failed to send subscription to backend:', err);
    }
}

async function requestGoalReminders() {
    try {
        await fetch(`${API_BASE_URL}/users/push/send-reminders/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
    } catch { /* non-critical */ }
}

// Helper: base64url → Uint8Array (required by PushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── End Web Push ──────────────────────────────────────────────────────────────

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
        background: ${type === 'success' ? '#6f8b77' : type === 'error' ? '#9f5e5e' : '#44556b'};
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
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

let _currentRedditSub = 'mentalhealth';

async function loadCommunityData() {
    connectCommunitySocket();
    // Live feed loads first by default; other panels load on demand
    loadRedditFeed(_currentRedditSub);
    loadSupportGroups();
    _loadCommunityPosts();
}

async function _loadCommunityPosts() {
    if (isDemoMode || !isLoggedIn) {
        initializeCommunity();
        const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
        updateCommunityFeed(posts.map(p => ({
            id: p.id, content: p.content, category: p.category, author: p.author,
            author_id: null, is_anonymous: p.isAnonymous || false,
            like_count: p.likes || 0, is_liked: false,
            created_at: p.timestamp || new Date().toISOString(),
        })));
        return;
    }
    try {
        const resp = await fetch(API_ENDPOINTS.community.posts, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data.success) { updateCommunityFeed(data.posts); return; }
        }
    } catch (e) { console.error('Failed to load community posts:', e); }
    const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
    updateCommunityFeed(posts.map(p => ({
        id: p.id, content: p.content, category: p.category, author: p.author,
        author_id: null, is_anonymous: p.isAnonymous || false,
        like_count: p.likes || 0, is_liked: false,
        created_at: p.timestamp || new Date().toISOString(),
    })));
}

// ── Community view switcher ───────────────────────────────────────────────────

function switchCommunityView(view, btn) {
    document.querySelectorAll('.comm-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.comm-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const panel = document.getElementById(`comm-panel-${view}`);
    if (panel) panel.classList.add('active');
}

// ── Reddit Live Feed ──────────────────────────────────────────────────────────

async function loadRedditFeed(sub, btn) {
    _currentRedditSub = sub || _currentRedditSub;

    // update pill active state
    if (btn) {
        document.querySelectorAll('.sub-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
    }

    const container = document.getElementById('reddit-posts-container');
    if (!container) return;

    container.innerHTML = `
        <div class="reddit-loading">
            <div class="reddit-spinner"></div>
            <p>Loading r/${_currentRedditSub}…</p>
        </div>`;

    const refreshBtn = document.getElementById('redditRefreshBtn');
    if (refreshBtn) refreshBtn.classList.add('spinning');

    try {
        const resp = await fetch(API_ENDPOINTS.community.redditFeed(_currentRedditSub), {
            headers: { ...getAuthHeaders() }
        });
        const data = await resp.json();

        if (data.success && data.posts.length > 0) {
            container.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'reddit-posts-grid';
            data.posts.forEach(post => grid.appendChild(buildRedditCard(post)));
            container.appendChild(grid);
        } else {
            container.innerHTML = `<div class="reddit-empty">
                <i class="fab fa-reddit-alien"></i>
                <p>Couldn't load posts right now. Try refreshing.</p>
            </div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="reddit-empty">
            <i class="fas fa-wifi"></i>
            <p>Network error. Check your connection and try again.</p>
        </div>`;
    } finally {
        if (refreshBtn) refreshBtn.classList.remove('spinning');
    }
}

function refreshRedditFeed() {
    loadRedditFeed(_currentRedditSub);
}

function buildRedditCard(post) {
    const card = document.createElement('div');
    card.className = 'reddit-card';

    const age = _redditAge(post.created_utc);
    const flair = post.flair ? `<span class="reddit-flair">${escapeHtml(post.flair)}</span>` : '';
    const excerpt = post.text
        ? `<p class="reddit-excerpt">${escapeHtml(post.text.substring(0, 220))}${post.text.length > 220 ? '…' : ''}</p>`
        : '';
    const upvotes = post.upvotes >= 1000
        ? `${(post.upvotes / 1000).toFixed(1)}k`
        : post.upvotes;

    card.innerHTML = `
        <div class="reddit-card-top">
            <div class="reddit-sub-badge">
                <i class="fab fa-reddit-alien"></i> r/${escapeHtml(post.subreddit)}
            </div>
            ${flair}
            <span class="reddit-age">${age}</span>
        </div>
        <h3 class="reddit-title">${escapeHtml(post.title)}</h3>
        ${excerpt}
        <div class="reddit-card-footer">
            <div class="reddit-stats">
                <span><i class="fas fa-arrow-up"></i> ${upvotes}</span>
                <span><i class="fas fa-comment-alt"></i> ${post.comments}</span>
            </div>
            <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="reddit-read-link">
                Read thread <i class="fas fa-external-link-alt"></i>
            </a>
        </div>
    `;
    return card;
}

function _redditAge(utc) {
    const diff = Math.floor(Date.now() / 1000) - utc;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ── Community WebSocket ──────────────────────────────────────────────────────

function connectCommunitySocket() {
    if (communitySocket && communitySocket.readyState === WebSocket.OPEN) return;
    if (isDemoMode || !isLoggedIn) return;

    const _token = localStorage.getItem('authToken') || '';
    const wsUrl = `${CHAT_WS_URL}/ws/community/${_token ? '?token=' + encodeURIComponent(_token) : ''}`;
    try {
        communitySocket = new WebSocket(wsUrl);

        communitySocket.onopen = () => {
            console.log('Community WebSocket connected');
            clearTimeout(communityReconnectTimer);
        };

        communitySocket.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                if (data.type === 'new_post') {
                    prependCommunityPost(data.post);
                } else if (data.type === 'post_liked') {
                    updatePostLikeCount(data.post_id, data.like_count);
                }
            } catch (e) {
                console.error('Community WS message error:', e);
            }
        };

        communitySocket.onclose = () => {
            console.log('Community WebSocket closed');
            communitySocket = null;
            communityReconnectTimer = setTimeout(connectCommunitySocket, 5000);
        };

        communitySocket.onerror = (e) => {
            console.error('Community WebSocket error:', e);
        };
    } catch (e) {
        console.error('Failed to open community WebSocket:', e);
    }
}

function disconnectCommunitySocket() {
    clearTimeout(communityReconnectTimer);
    if (communitySocket) {
        communitySocket.close();
        communitySocket = null;
    }
}

function prependCommunityPost(post) {
    const feed = document.querySelector('.posts-feed');
    if (!feed) return;
    const card = buildPostCard(post);
    feed.insertBefore(card, feed.firstChild);
}

// ── Support Groups (Real Online Communities) ──────────────────────────────────

const REAL_SUPPORT_GROUPS = [
    {
        name: 'r/mentalhealth',
        platform: 'Reddit',
        icon: 'fab fa-reddit-alien',
        color: '#FF4500',
        bg: '#fff5f0',
        description: 'General mental health community — share experiences, coping strategies, and peer support.',
        members: '1.5M+',
        tag: 'General',
        category: 'reddit',
        url: 'https://www.reddit.com/r/mentalhealth/',
    },
    {
        name: 'r/anxiety',
        platform: 'Reddit',
        icon: 'fab fa-reddit-alien',
        color: '#FF4500',
        bg: '#fff5f0',
        description: 'Support community for anxiety disorders, panic attacks, and day-to-day coping.',
        members: '700K+',
        tag: 'Anxiety',
        category: 'reddit',
        url: 'https://www.reddit.com/r/Anxiety/',
    },
    {
        name: 'r/depression',
        platform: 'Reddit',
        icon: 'fab fa-reddit-alien',
        color: '#FF4500',
        bg: '#fff5f0',
        description: 'A safe space for people experiencing depression to share, vent, and find support.',
        members: '900K+',
        tag: 'Depression',
        category: 'reddit',
        url: 'https://www.reddit.com/r/depression/',
    },
    {
        name: 'r/IndianMentalHealth',
        platform: 'Reddit',
        icon: 'fab fa-reddit-alien',
        color: '#FF4500',
        bg: '#fff5f0',
        description: 'Mental health discussions in the Indian cultural context — family, stigma, therapy access.',
        members: '50K+',
        tag: 'India',
        category: 'india',
        url: 'https://www.reddit.com/r/IndianMentalHealth/',
    },
    {
        name: '7 Cups',
        platform: 'Peer Support',
        icon: 'fas fa-mug-hot',
        color: '#16a34a',
        bg: '#f0fdf4',
        description: 'Free 24/7 emotional support from trained volunteer listeners. Over 50 million conversations.',
        members: '50M+ served',
        tag: 'Free · 24/7',
        category: 'peer',
        url: 'https://www.7cups.com/',
    },
    {
        name: 'The Mighty',
        platform: 'Community',
        icon: 'fas fa-hands-helping',
        color: '#6366f1',
        bg: '#eef2ff',
        description: 'Community for people facing mental and physical health challenges. Stories, groups & forums.',
        members: '3M+',
        tag: 'Stories · Forums',
        category: 'peer',
        url: 'https://themighty.com/',
    },
    {
        name: 'iCall India',
        platform: 'India',
        icon: 'fas fa-heart',
        color: '#dc2626',
        bg: '#fef2f2',
        description: 'Psychosocial helpline by TISS Mumbai. Resources, blogs, and professional counselling.',
        members: 'Free',
        tag: 'India · Counselling',
        category: 'india',
        url: 'https://icallhelpline.org/',
    },
    {
        name: 'Mann Talks',
        platform: 'India',
        icon: 'fas fa-comment-dots',
        color: '#d97706',
        bg: '#fffbeb',
        description: "India's mental wellness community for open conversations on stress, anxiety, and self-care.",
        members: '100K+',
        tag: 'India · Wellness',
        category: 'india',
        url: 'https://manntalks.org/',
    },
    {
        name: 'White Swan Foundation',
        platform: 'India',
        icon: 'fas fa-dove',
        color: '#0284c7',
        bg: '#f0f9ff',
        description: 'India-focused mental health education, caregiver support groups, and awareness resources.',
        members: 'Open',
        tag: 'India · Education',
        category: 'india',
        url: 'https://www.whiteswan.org.in/',
    },
    {
        name: 'Vandrevala Foundation',
        platform: 'India',
        icon: 'fas fa-phone-alt',
        color: '#7c3aed',
        bg: '#f5f3ff',
        description: '24/7 free mental health helpline and online resources. India-wide. Multilingual support.',
        members: 'Free · 24/7',
        tag: 'India · Helpline',
        category: 'india',
        url: 'https://vandrevalafoundation.com/',
    },
];

function loadSupportGroups() {
    const container = document.getElementById('groupList');
    if (!container) return;
    renderRealGroups(container, 'all');
}

function renderRealGroups(container, category) {
    const groups = category === 'all'
        ? REAL_SUPPORT_GROUPS
        : REAL_SUPPORT_GROUPS.filter(g => g.category === category);

    container.innerHTML = '';
    groups.forEach(g => {
        const card = document.createElement('div');
        card.className = 'group-card real-group-card';
        card.dataset.category = g.category;
        card.innerHTML = `
            <div class="group-header" style="align-items:flex-start;gap:12px;">
                <div style="width:40px;height:40px;border-radius:10px;background:${g.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="${g.icon}" style="color:${g.color};font-size:18px;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <h3 style="margin:0 0 2px;font-size:15px;">${g.name}</h3>
                    <span class="group-type" style="background:${g.bg};color:${g.color};border:none;">${g.tag}</span>
                </div>
            </div>
            <p style="margin:10px 0;color:#64748b;font-size:13.5px;line-height:1.5;">${g.description}</p>
            <div class="group-meta" style="margin-bottom:12px;">
                <span><i class="fas fa-users"></i> ${g.members}</span>
                <span style="color:${g.color};font-weight:500;"><i class="fas fa-external-link-alt" style="font-size:11px;"></i> ${g.platform}</span>
            </div>
            <div class="group-actions">
                <a href="${g.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;">
                    Visit Community <i class="fas fa-arrow-right" style="font-size:12px;"></i>
                </a>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterGroups(category, btn) {
    document.querySelectorAll('.group-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const container = document.getElementById('groupList');
    if (container) renderRealGroups(container, category);
}

// ── Group Chat ────────────────────────────────────────────────────────────────

function openGroupChat(groupId, groupName) {
    const existing = document.getElementById('groupChatModal');
    if (existing) existing.remove();
    if (groupChatSocket) { groupChatSocket.close(); groupChatSocket = null; }

    activeGroupChatId = groupId;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="groupChatModal" class="chat-modal-overlay">
            <div class="chat-modal-container">
                <div class="crisis-chat-container">
                    <div class="chat-header">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <i class="fas fa-users" style="color:#6366f1;font-size:18px;"></i>
                            <span style="font-weight:700;color:#0f172a;font-size:15px;">${escapeHtml(groupName)}</span>
                        </div>
                        <button class="close-btn" onclick="closeGroupChat()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="chat-messages" id="groupChatMessages">
                        <div class="chat-message system" style="justify-content:center;">
                            <div class="message-content" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:12px 16px;text-align:center;max-width:320px;">
                                <p style="margin:0;color:#0369a1;font-size:13px;"><i class="fas fa-lock" style="margin-right:6px;"></i>Messages are live — not saved after you close.</p>
                            </div>
                        </div>
                    </div>
                    <div class="chat-input-container">
                        <div class="input-wrapper">
                            <input type="text" id="groupChatInput" placeholder="Say something to the group..." maxlength="500" disabled>
                            <button class="send-btn" id="groupSendBtn" onclick="sendGroupMessage()" disabled>
                                <div class="btn-content"><i class="fas fa-paper-plane"></i></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);

    document.getElementById('groupChatInput').addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMessage(); }
    });

    connectGroupChatSocket(groupId);
}

function closeGroupChat() {
    if (groupChatSocket) { groupChatSocket.close(); groupChatSocket = null; }
    activeGroupChatId = null;
    const modal = document.getElementById('groupChatModal');
    if (modal) modal.remove();
}

function connectGroupChatSocket(groupId) {
    const _token = localStorage.getItem('authToken') || '';
    const wsUrl = `${CHAT_WS_URL}/ws/community/group/${groupId}/${_token ? '?token=' + encodeURIComponent(_token) : ''}`;
    try {
        groupChatSocket = new WebSocket(wsUrl);

        groupChatSocket.onopen = () => {
            const input = document.getElementById('groupChatInput');
            const btn = document.getElementById('groupSendBtn');
            if (input) input.disabled = false;
            if (btn) btn.disabled = false;
        };

        groupChatSocket.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                if (data.type === 'message') appendGroupMessage(data.message);
            } catch (e) { console.error('Group chat WS parse error:', e); }
        };

        groupChatSocket.onclose = () => {
            groupChatSocket = null;
            appendGroupSystemNote('Disconnected from group chat.');
        };

        groupChatSocket.onerror = () => {
            appendGroupSystemNote('Could not connect. Check your connection.');
        };
    } catch (e) {
        appendGroupSystemNote('WebSocket not available.');
    }
}

function sendGroupMessage() {
    const input = document.getElementById('groupChatInput');
    const msg = (input?.value || '').trim();
    if (!msg) return;

    if (groupChatSocket && groupChatSocket.readyState === WebSocket.OPEN) {
        groupChatSocket.send(JSON.stringify({ message: msg }));
        input.value = '';
    } else {
        showNotification('Not connected to group chat.', 'error');
    }
}

function appendGroupMessage(msg) {
    const container = document.getElementById('groupChatMessages');
    if (!container) return;

    const isOwn = msg.sender_id === (currentUser?.id || currentUser?.username);
    const div = document.createElement('div');
    div.className = `chat-message ${isOwn ? 'user' : 'bot'}`;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initial = (msg.sender || '?').charAt(0).toUpperCase();

    if (isOwn) {
        div.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(msg.content)}</p>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-avatar"><i class="fas fa-user"></i></div>
        `;
    } else {
        div.innerHTML = `
            <div class="message-avatar" style="background:#6366f1;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;">${escapeHtml(initial)}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="sender-name" style="font-size:12px;font-weight:600;color:#6366f1;">${escapeHtml(msg.sender)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <p>${escapeHtml(msg.content)}</p>
            </div>
        `;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendGroupSystemNote(text) {
    const container = document.getElementById('groupChatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-message system';
    div.style.justifyContent = 'center';
    div.innerHTML = `<div class="message-content" style="background:#fef9c3;border-radius:8px;padding:8px 14px;font-size:12px;color:#92400e;">${escapeHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function updatePostLikeCount(postId, likeCount) {
    const btn = document.querySelector(`.post-card[data-post-id="${postId}"] .like-btn`);
    if (btn) btn.innerHTML = `<i class="fas fa-heart"></i> ${likeCount}`;
}

// ── Submit a new community post ──────────────────────────────────────────────

async function submitCommunityPost() {
    const textarea = document.getElementById('communityPostText');
    const categoryEl = document.getElementById('communityPostCategory');
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) { showNotification('Please write something before posting.', 'error'); return; }
    if (content.length > 1000) { showNotification('Post is too long (max 1000 characters).', 'error'); return; }

    const categoryLabel = categoryEl ? categoryEl.value : 'General Support';
    const categoryMap = {
        'General Support': 'general', 'Success Story': 'success',
        'Question': 'question', 'Resource Share': 'resource',
    };
    const category = categoryMap[categoryLabel] || 'general';

    if (isDemoMode || !isLoggedIn) {
        // Local-only demo post
        const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
        const newPost = {
            id: Date.now(),
            author: currentUser?.firstName || 'You',
            content,
            category: categoryLabel,
            likes: 0,
            comments: 0,
            timestamp: new Date().toISOString(),
            isAnonymous: false,
        };
        posts.unshift(newPost);
        localStorage.setItem('mindwell_community_posts', JSON.stringify(posts));
        textarea.value = '';
        loadCommunityData();
        return;
    }

    // Try WebSocket first
    if (communitySocket && communitySocket.readyState === WebSocket.OPEN) {
        communitySocket.send(JSON.stringify({ type: 'new_post', content, category }));
        textarea.value = '';
        return;
    }

    // HTTP fallback
    try {
        const resp = await fetch(API_ENDPOINTS.community.posts, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ content, category }),
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data.success) {
                textarea.value = '';
                prependCommunityPost(data.post);
                showNotification('Post shared!', 'success');
                return;
            }
        }
        showNotification('Failed to post. Please try again.', 'error');
    } catch (e) {
        console.error('submitCommunityPost error:', e);
        showNotification('Network error. Please try again.', 'error');
    }
}

// ── Like a community post ────────────────────────────────────────────────────

async function likePost(postId) {
    if (isDemoMode || !isLoggedIn) {
        // Demo: mutate localStorage
        const posts = JSON.parse(localStorage.getItem('mindwell_community_posts') || '[]');
        const post = posts.find(p => p.id === postId);
        if (post) {
            post.likes = (post.likes || 0) + 1;
            localStorage.setItem('mindwell_community_posts', JSON.stringify(posts));
            updatePostLikeCount(postId, post.likes);
        }
        return;
    }

    // Try WebSocket
    if (communitySocket && communitySocket.readyState === WebSocket.OPEN) {
        communitySocket.send(JSON.stringify({ type: 'like_post', post_id: postId }));
        return;
    }

    // HTTP fallback
    try {
        const resp = await fetch(API_ENDPOINTS.community.like(postId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data.success) {
                updatePostLikeCount(postId, data.like_count);
                // Toggle heart colour
                const btn = document.querySelector(`.post-card[data-post-id="${postId}"] .like-btn`);
                if (btn) btn.classList.toggle('liked', data.liked);
            }
        }
    } catch (e) {
        console.error('likePost error:', e);
    }
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
        loadGoalsDataLocal();
        return;
    }
    
    // Load goals from backend with error handling
    fetch(API_ENDPOINTS.goals.list, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
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
        // Router list returns a plain array; goals_list view wraps in {success, goals}
        const goals = Array.isArray(data) ? data : (data && data.goals) ? data.goals : null;
        if (goals) {
            renderGoalsList(goals);
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
    // Always render from localStorage immediately (instant)
    loadJournalDataLocal();

    // Skip backend fetch if demo, not logged in, or cache is fresh (2 min TTL)
    if (isDemoMode || !isLoggedIn || cacheGet('journalData', 120000)) return;

    // Background sync with backend — filter deleted entries before storing
    fetch(API_ENDPOINTS.journal.entries, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
        if (data?.success && Array.isArray(data.entries)) {
            const deletedDates = getDeletedJournalDates();
            const filtered = data.entries.filter(e =>
                !deletedDates.includes((e.date || '').substring(0, 10))
            );
            const key = getUserSpecificKey('mindwell_journal_entries');
            localStorage.setItem(key, JSON.stringify(filtered));
            cacheSet('journalData', true);
            loadJournalDataLocal();
        }
    })
    .catch(() => {});
}

// Helper functions for local data loading
function loadGoalsDataLocal() {
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    renderGoalsList(goals);
    const goalsList = document.querySelector('.goal-list'); // kept for any legacy code below
    
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

function renderJournalEntries(entries) {
    const entriesList = document.querySelector('.entries-list');
    if (!entriesList) return;

    if (!entries.length) {
        entriesList.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:24px;">No entries found.</p>';
        return;
    }

    entriesList.innerHTML = '';
    entries.slice(0, 20).forEach(entry => {
        const s = entry.sentiment || analyzeSentiment(entry.content || '');
        // Fix missing/wrong values
        if (!entry.wordCount || entry.wordCount === 0)
            entry.wordCount = (entry.content || '').split(/\s+/).filter(w => w).length;
        if (!entry.createdAt) entry.createdAt = entry.date || new Date().toISOString();
        const card = document.createElement('div');
        card.className = 'entry-card';
        card.innerHTML = `
            <div class="entry-header">
                <h3>${entry.title}</h3>
                <div class="entry-meta">
                    <span class="entry-mood">${getMoodEmoji(entry.mood)}</span>
                    <span class="entry-date">${formatDate(entry.date)}</span>
                    <span style="background:${s.bg||'#f8fafc'};color:${s.color||'#475569'};font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;border:1px solid ${s.color||'#cbd5e1'}20;">${s.icon} ${s.label}</span>
                </div>
            </div>
            <div class="entry-preview">
                <p>${entry.content.substring(0, 150)}${entry.content.length > 150 ? '...' : ''}</p>
            </div>
            <div class="entry-tags">
                ${(entry.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="entry-actions">
                <button class="btn btn-outline btn-sm" onclick="editJournalEntry(${entry.id})">Edit</button>
                <button class="btn btn-outline btn-sm" onclick="viewJournalEntry(${entry.id})">View Full</button>
                <button class="btn btn-outline btn-sm" onclick="deleteJournalEntry(${entry.id})">Delete</button>
            </div>
            <div class="entry-stats">
                <small>${entry.wordCount || 0} words • ${getTimeAgo(entry.createdAt)}</small>
            </div>
        `;
        entriesList.appendChild(card);
    });
}

function deduplicateJournalEntries() {
    const entries = getJournalEntries();
    const seen = {};
    const deduped = [];
    for (const e of entries) {
        const day = (e.date || '').substring(0, 10);
        if (!seen[day]) { seen[day] = true; deduped.push(e); }
    }
    if (deduped.length < entries.length) {
        setJournalEntries(deduped);
        return deduped;
    }
    return entries;
}

function loadJournalDataLocal() {
    const entries = deduplicateJournalEntries();
    renderJournalEntries(entries);
    updateJournalStats();
    updateSentimentSuggestions(entries);
    renderTrendPanel(entries);

    // Keep composer editingId in sync with today's entry
    const today = localDateStr();
    const todayEntry = entries.find(e => (e.date || '').substring(0, 10) === today);
    const composer = document.querySelector('.journal-composer');
    const saveBtn = document.querySelector('.save-actions .btn-primary');
    const composerTitle = document.querySelector('.journal-composer h2');
    if (composer) composer.dataset.editingId = todayEntry ? todayEntry.id : '';
    if (saveBtn) saveBtn.textContent = todayEntry ? 'Update Entry' : 'Save Entry';
    if (composerTitle) composerTitle.textContent = todayEntry ? "Today's Entry — Edit" : "Today's Entry";
}

function updateSentimentSuggestions(entries) {
    const section = document.getElementById('journalSuggestions');
    if (!section || !entries.length) return;

    const latest = entries[0];
    const s = latest.sentiment || analyzeSentiment(latest.content || '');

    const suggestionMap = {
        'Bright': {
            title: 'You seem to be in a good space ☀️',
            subtitle: 'Keep riding this wave',
            text: "It looks like today's entry carries a light, uplifted energy. This is a great time to build on that momentum — whether it's tackling something you've been putting off, reaching out to someone you care about, or setting a small goal for tomorrow.",
            actions: [
                { label: '🎯 Set a Goal', tab: 'goals' },
                { label: '🧘 Try Meditation', tab: 'meditation' },
            ]
        },
        'Partly Cloudy': {
            title: 'A balanced day ⛅',
            subtitle: 'A little of everything',
            text: "Your entry feels thoughtful and grounded — a mix of ups and downs. On days like these, a gentle routine can help bring more clarity. You might enjoy a short walk, a breathing exercise, or simply sitting quietly for a few minutes.",
            actions: [
                { label: '🌬️ Breathing Exercise', tab: 'meditation' },
                { label: '📋 View Resources', tab: 'resources' },
            ]
        },
        'Cloudy': {
            title: 'It sounds like a heavy day 🌧️',
            subtitle: 'You showed up — that matters',
            text: "Writing about difficult moments takes courage. You don't have to have it all figured out right now. Consider trying one small thing that brings you comfort — a warm drink, a short walk, or talking to someone you trust. We're here if you need support.",
            actions: [
                { label: '💬 Crisis Support', tab: 'crisis' },
                { label: '🌬️ Breathing Exercise', tab: 'meditation' },
                { label: '📋 View Resources', tab: 'resources' },
            ]
        }
    };

    const config = suggestionMap[s.label] || suggestionMap['Partly Cloudy'];

    document.getElementById('suggestionIcon').textContent = s.icon;
    document.getElementById('suggestionTitle').textContent = config.title;
    document.getElementById('suggestionSubtitle').textContent = config.subtitle;
    document.getElementById('suggestionText').textContent = config.text;

    const actionsEl = document.getElementById('suggestionActions');
    actionsEl.innerHTML = config.actions.map(a => `
        <button class="btn btn-outline btn-sm" onclick="switchTab('${a.tab}')" style="font-size:13px;">
            ${a.label}
        </button>
    `).join('');

    section.style.display = 'block';
}

function renderTrendPanel(entries) {
    const panel = document.getElementById('journalTrendPanel');
    const trendDays = document.getElementById('trendDays');
    const trendSummary = document.getElementById('trendSummary');
    if (!panel || !entries.length) return;

    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return localDateStr(d);
    });

    const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const entryByDate = {};
    entries.forEach(e => { if (e.date) entryByDate[e.date] = e; });

    const scores = days.map(d => entryByDate[d]?.sentiment?.score ?? null);
    const written = scores.filter(s => s !== null).length;

    trendDays.innerHTML = days.map((d, i) => {
        const entry = entryByDate[d];
        const score = scores[i];
        const dayName = dayLabels[new Date(d + 'T12:00:00').getDay()];
        const isToday = d === localDateStr(today);

        let icon = '·', bg = '#f1f5f9', height = '24px', title = 'No entry';
        if (score !== null) {
            const s = entry.sentiment || analyzeSentiment(entry.content || '');
            icon = s.icon;
            bg = s.bg || '#f0f9ff';
            height = `${Math.max(32, Math.min(80, 56 + score * 4))}px`;
            title = s.label;
        }

        return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;" title="${title}">
                <div style="background:${bg};border-radius:10px;width:100%;height:${height};display:flex;align-items:center;justify-content:center;font-size:18px;transition:height 0.3s;border:${isToday ? '2px solid #6366f1' : '1px solid #e2e8f0'};">
                    ${score !== null ? icon : '<span style="color:#cbd5e1;font-size:12px;">—</span>'}
                </div>
                <span style="font-size:10px;color:${isToday ? '#6366f1' : '#94a3b8'};font-weight:${isToday ? '700' : '400'};">${dayName}</span>
            </div>
        `;
    }).join('');

    // Trend summary
    const recentScores = scores.filter(s => s !== null);
    let summaryText = `You've written ${written} out of the last 7 days.`;
    if (recentScores.length >= 2) {
        const first = recentScores[0];
        const last = recentScores[recentScores.length - 1];
        const diff = last - first;
        if (diff >= 2) summaryText += ' Your entries are feeling lighter as the week goes on. ☀️';
        else if (diff <= -2) summaryText += ' It\'s been a heavier week — remember, every day is a fresh start. 🌱';
        else summaryText += ' Your energy has been steady this week. ⛅';
    }

    trendSummary.textContent = summaryText;
    panel.style.display = 'block';
}

// Journal Management System
function initializeJournal() {
    const journalKey = getUserSpecificKey('mindwell_journal_entries');
    if (!localStorage.getItem(journalKey)) {
        const sampleEntries = [
            {
                id: 1,
                title: "Reflecting on Progress",
                content: "Today I realized how much progress I've made over the past few months. The daily meditation is really helping me stay centered and focused. I'm grateful for the small wins.",
                mood: "good",
                tags: ["Progress", "Meditation", "Gratitude"],
                date: localDateStr(new Date(Date.now() - 86400000)),
                wordCount: 45,
                isPrivate: false,
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                title: "Challenging Day at Work",
                content: "Had a really tough day dealing with work stress. Feeling overwhelmed but trying to use the coping strategies I've learned. Tomorrow is a new day.",
                mood: "sad",
                tags: ["Work", "Stress", "Coping"],
                date: localDateStr(new Date(Date.now() - 3*86400000)),
                wordCount: 32,
                isPrivate: true,
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem(journalKey, JSON.stringify(sampleEntries));
    }

    // Set today's date as default
    const today = localDateStr();
    const dateInput = document.getElementById('journalEntryDate');
    if (dateInput) { dateInput.value = today; dateInput.max = today; }

    // One entry per day — if today's entry exists, load it for editing
    const todayEntry = getJournalEntries().find(e => (e.date || '').substring(0, 10) === today);
    const composerTitle = document.querySelector('.journal-composer h2');
    const saveBtn = document.querySelector('.save-actions .btn-primary');
    if (todayEntry) {
        if (composerTitle) composerTitle.textContent = "Today's Entry — Edit";
        if (saveBtn) saveBtn.textContent = 'Update Entry';
        document.querySelector('.entry-title').value = todayEntry.title.replace(/^\[Draft\] /, '');
        document.querySelector('.journal-editor').value = todayEntry.content;
        document.querySelector('.mood-select').value = todayEntry.mood || '';
        document.querySelector('.tag-input').value = (todayEntry.tags || []).join(', ');
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.classList.toggle('selected', (todayEntry.tags || []).includes(btn.textContent.trim()));
        });
        // Mark as editing today's entry
        document.querySelector('.journal-composer').dataset.editingId = todayEntry.id;
    } else {
        if (composerTitle) composerTitle.textContent = "Today's Entry";
        if (saveBtn) saveBtn.textContent = 'Save Entry';
        document.querySelector('.journal-composer').dataset.editingId = '';
    }

    // Wire up search and mood filter
    const searchInput = document.querySelector('.search-entries');
    const moodFilter = document.querySelector('.filter-mood');

    const applyFilters = () => {
        const query = searchInput?.value.toLowerCase() || '';
        const mood = moodFilter?.value || '';
        const moodMap = { 'Very Good': 'very-good', 'Good': 'good', 'Neutral': 'neutral', 'Sad': 'sad', 'Very Sad': 'very-sad' };
        const moodValue = moodMap[mood] || '';

        const entries = getJournalEntries().filter(e => {
            const matchesSearch = !query ||
                e.title.toLowerCase().includes(query) ||
                e.content.toLowerCase().includes(query) ||
                (e.tags || []).some(t => t.toLowerCase().includes(query));
            const matchesMood = !moodValue || e.mood === moodValue;
            return matchesSearch && matchesMood;
        });
        renderJournalEntries(entries);
    };

    searchInput?.addEventListener('input', applyFilters);
    moodFilter?.addEventListener('change', applyFilters);
}

function toggleJournalTag(btn) {
    btn.classList.toggle('selected');
}

async function saveJournalEntry(isDraft = false) {
    const title = document.querySelector('.entry-title').value.trim();
    const content = document.querySelector('.journal-editor').value.trim();
    const mood = document.querySelector('.mood-select').value;
    const tagInput = document.querySelector('.tag-input').value;

    if (!title || !content) {
        showNotification('Please fill in title and content', 'error');
        return;
    }
    
    const tags = tagInput ? tagInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const selectedTags = Array.from(document.querySelectorAll('.tag-btn.selected')).map(btn => btn.textContent);
    const allTags = [...new Set([...tags, ...selectedTags])];
    
    const sentiment = analyzeSentiment(content);
    const entryDate = document.getElementById('journalEntryDate')?.value || localDateStr();
    const editingId = document.querySelector('.journal-composer')?.dataset.editingId;

    // Normalize date to YYYY-MM-DD for consistent comparison
    const normalizeDate = d => (d || '').substring(0, 10);
    // Enforce one entry per day — find any existing entry for this date
    const existingForDate = getJournalEntries().find(e => normalizeDate(e.date) === entryDate);
    const isUpdate = editingId || (existingForDate && existingForDate.id);

    if (existingForDate && !editingId) {
        deleteJournalEntry(existingForDate.id, true);
        showNotification('Entry for this day updated.', 'info');
    } else if (editingId) {
        deleteJournalEntry(editingId, true);
    }
    // Immediately unmark — we're replacing, not permanently deleting
    unmarkJournalDateDeleted(entryDate);

    const journalEntry = {
        title: isDraft ? `[Draft] ${title}` : title,
        content,
        mood,
        tags: allTags,
        date: entryDate,
        wordCount: content.split(/\s+/).filter(w => w).length,
        isPrivate: isDraft,
        sentiment: { score: sentiment.score, label: sentiment.label, icon: sentiment.icon }
    };

    // Update composer state
    const composerTitle = document.querySelector('.journal-composer h2');
    const saveBtn = document.querySelector('.save-actions .btn-primary');
    if (isUpdate && composerTitle) composerTitle.textContent = "Today's Entry — Edit";
    if (saveBtn) saveBtn.textContent = isDraft ? 'Save Draft' : isUpdate ? 'Update Entry' : 'Save Entry';
    
    try {
        // Save to backend
        const response = await fetch(API_ENDPOINTS.journal.create, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(journalEntry)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                addToMemorySystem('journal', `Journal entry: ${title}. Content summary: ${content.substring(0, 200)}...`);

                // Write entry directly to localStorage — don't rely on background sync
                const savedEntry = {
                    id: data.entry?.id || Date.now(),
                    ...journalEntry,
                    wordCount: data.entry?.word_count || journalEntry.wordCount,
                    createdAt: data.entry?.created_at || new Date().toISOString(),
                    lastModified: new Date().toISOString()
                };
                const jKey = getUserSpecificKey('mindwell_journal_entries');
                const existing = JSON.parse(localStorage.getItem(jKey) || '[]');
                existing.unshift(savedEntry);
                localStorage.setItem(jKey, JSON.stringify(existing));

                // Unmark deleted date so future syncs include it
                unmarkJournalDateDeleted(entryDate);
                // Set cache so background sync won't overwrite what we just saved
                cacheSet('journalData', true);

                showNotification(isDraft ? 'Draft saved!' : 'Journal entry saved!', 'success');

                // Clear form
                document.querySelector('.entry-title').value = '';
                document.querySelector('.journal-editor').value = '';
                document.querySelector('.mood-select').value = '';
                document.querySelector('.tag-input').value = '';
                document.querySelectorAll('.tag-btn.selected').forEach(btn => btn.classList.remove('selected'));

                // Render from localStorage immediately
                loadJournalDataLocal();

                // AI sentiment analysis (non-blocking)
                if (!isDraft) analyseEntryWithAI(savedEntry.id, content);
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
        saveJournalEntryLocal(journalEntry, isDraft);
    }
}

// Fallback local save for journal entries
function saveJournalEntryLocal(journalEntry, isDraft = false) {
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
    unmarkJournalDateDeleted(newEntry.date);
    cacheSet('journalData', true); // prevent background sync from overwriting local save

    showNotification(isDraft ? 'Draft saved!' : 'Journal entry saved!', 'success');
    loadJournalDataLocal(); // render immediately, no need to hit backend

    // Async AI sentiment analysis — update entry and panels when ready
    if (!isDemoMode && isLoggedIn && !isDraft) {
        analyseEntryWithAI(newEntry.id, journalEntry.content);
    }
}


async function analyseEntryWithAI(entryId, content) {
    const suggestionSection = document.getElementById('journalSuggestions');
    if (suggestionSection) {
        // Show loading state
        document.getElementById('suggestionTitle').textContent = 'Analysing your entry...';
        document.getElementById('suggestionText').textContent = '';
        document.getElementById('suggestionActions').innerHTML = '';
        document.getElementById('suggestionIcon').textContent = '✨';
        suggestionSection.style.display = 'block';
    }

    try {
        const response = await fetch(API_ENDPOINTS.journal.analyse, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ text: content })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Analysis failed');

        // Update the entry in localStorage with AI sentiment
        if (entryId) {
            const entries = getJournalEntries();
            const idx = entries.findIndex(e => e.id === entryId);
            if (idx !== -1) {
                entries[idx].sentiment = { score: result.score, label: result.label, icon: result.icon };
                setJournalEntries(entries);
            }
        }

        // Update suggestion panel with AI result
        const actionTabMap = {
            'meditation': 'meditation', 'breathe': 'meditation', 'breathing': 'meditation',
            'goal': 'goals', 'resource': 'resources', 'support': 'crisis', 'talk': 'crisis'
        };

        if (suggestionSection) {
            document.getElementById('suggestionIcon').textContent = result.icon;
            document.getElementById('suggestionTitle').textContent = getSentimentTitle(result.label);
            document.getElementById('suggestionSubtitle').textContent = 'Based on your entry today';
            document.getElementById('suggestionText').textContent = result.suggestion;

            const actionsEl = document.getElementById('suggestionActions');
            actionsEl.innerHTML = (result.actions || []).map(label => {
                const tab = Object.entries(actionTabMap).find(([k]) => label.toLowerCase().includes(k))?.[1] || 'resources';
                return `<button class="btn btn-outline btn-sm" onclick="switchTab('${tab}')" style="font-size:13px;">${label}</button>`;
            }).join('');
            suggestionSection.style.display = 'block';
        }

        // Re-render entries to show updated label
        renderJournalEntries(getJournalEntries());

    } catch (err) {
        console.warn('AI sentiment analysis failed, using keyword fallback:', err);
        // Fall back to keyword-based analysis already stored
        updateSentimentSuggestions(getJournalEntries());
    }
}

function getSentimentTitle(label) {
    const titles = {
        'Bright': 'You seem to be in a good space ☀️',
        'Partly Cloudy': 'A thoughtful, balanced day ⛅',
        'Cloudy': 'It sounds like a heavy day 🌧️'
    };
    return titles[label] || 'How you\'re feeling today';
}

function getJournalEntries() {
    const key = getUserSpecificKey('mindwell_journal_entries');
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function setJournalEntries(entries) {
    const key = getUserSpecificKey('mindwell_journal_entries');
    localStorage.setItem(key, JSON.stringify(entries));
}

function viewJournalEntry(id) {
    const entry = getJournalEntries().find(e => e.id == id);
    if (!entry) return;

    const existing = document.getElementById('journalViewModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'journalViewModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:680px;max-height:85vh;overflow-y:auto;">
            <div class="modal-header">
                <h2>${getMoodEmoji(entry.mood)} ${entry.title}</h2>
                <span class="close" onclick="document.getElementById('journalViewModal').remove();document.body.style.overflow=''">&times;</span>
            </div>
            <div style="padding:24px 28px;">
                <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;color:#64748b;font-size:13px;">
                    <span><i class="fas fa-calendar"></i> ${formatDate(entry.date)}</span>
                    <span><i class="fas fa-pen"></i> ${entry.wordCount || 0} words</span>
                    ${entry.isPrivate ? '<span><i class="fas fa-lock"></i> Draft</span>' : ''}
                </div>
                <div style="white-space:pre-wrap;line-height:1.8;color:#374151;font-size:15px;margin-bottom:20px;">${entry.content}</div>
                ${entry.tags?.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${entry.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
                <div style="display:flex;gap:10px;margin-top:24px;">
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('journalViewModal').remove();document.body.style.overflow='';editJournalEntry(${entry.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="document.getElementById('journalViewModal').remove();document.body.style.overflow=''">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function editJournalEntry(id) {
    const entry = getJournalEntries().find(e => e.id == id);
    if (!entry) return;

    // Populate the composer with existing entry data
    document.querySelector('.entry-title').value = entry.title.replace(/^\[Draft\] /, '');
    document.querySelector('.journal-editor').value = entry.content;
    document.querySelector('.entry-date').value = entry.date?.split('T')[0] || '';
    const moodSelect = document.querySelector('.mood-select');
    if (moodSelect) moodSelect.value = entry.mood || '';
    document.querySelector('.tag-input').value = (entry.tags || []).join(', ');

    // Mark matching tag buttons selected
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.toggle('selected', (entry.tags || []).includes(btn.textContent.trim()));
    });

    // Delete old entry so saving creates a fresh one
    deleteJournalEntry(id, true);

    document.querySelector('.journal-composer').scrollIntoView({ behavior: 'smooth' });
    showNotification('Entry loaded for editing — save when done.', 'info');
}

function getDeletedJournalDates() {
    const key = getUserSpecificKey('mindwell_deleted_journal_dates');
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function markJournalDateDeleted(date) {
    if (!date) return;
    const key = getUserSpecificKey('mindwell_deleted_journal_dates');
    const dates = getDeletedJournalDates();
    const day = date.substring(0, 10);
    if (!dates.includes(day)) {
        dates.push(day);
        localStorage.setItem(key, JSON.stringify(dates));
    }
}

function unmarkJournalDateDeleted(date) {
    if (!date) return;
    const key = getUserSpecificKey('mindwell_deleted_journal_dates');
    const day = date.substring(0, 10);
    const dates = getDeletedJournalDates().filter(d => d !== day);
    localStorage.setItem(key, JSON.stringify(dates));
}

async function deleteJournalEntry(id, silent = false) {
    if (!silent && !confirm('Delete this journal entry?')) return;

    // Find entry before removing so we can get its date and backend ID
    const entry = getJournalEntries().find(e => e.id == id);

    // Remove from localStorage immediately
    setJournalEntries(getJournalEntries().filter(e => e.id != id));

    // Track deleted date so background sync never restores it
    if (entry?.date) markJournalDateDeleted(entry.date);

    // Also delete from backend (fire-and-forget, don't block UI)
    if (!isDemoMode && isLoggedIn && entry?.id) {
        fetch(`${API_ENDPOINTS.journal.entries}${entry.id}/`, {
            method: 'DELETE',
            headers: { ...getAuthHeaders() }
        }).catch(() => {});
    }

    // Invalidate cache so next sync re-fetches without the deleted entry
    cacheInvalidate('journalData');

    if (!silent) {
        showNotification('Entry deleted.', 'info');
        loadJournalData();
        updateJournalStats();
    }
}

function analyzeSentiment(text) {
    const positive = [
        'happy','joy','grateful','gratitude','love','excited','hopeful','proud','peaceful','calm',
        'amazing','wonderful','blessed','thankful','accomplished','confident','energized','motivated',
        'optimistic','smile','laugh','great','good','better','improve','progress','success','achieve',
        'celebrate','bright','strong','grow','thrive','heal','recover','friend','family','care','hope',
        'dream','goal','beautiful','inspire','courage','strength','resilient','forward','light','warmth',
        'kind','appreciate','enjoy','comfort','safe','secure','trust','believe','relax','refresh','balance',
        'clarity','peaceful','content','fulfilled','serene','delight','pleasure','excited','alive','free',
        'connection','understanding','support','loved','accepted','enough','capable','worthy'
    ];
    const negative = [
        'sad','angry','anxious','worried','stressed','depressed','hopeless','tired','exhausted',
        'overwhelmed','frustrated','scared','fear','hate','fail','failure','worthless','useless',
        'alone','lonely','empty','dark','heavy','hurt','pain','cry','broken','stuck','trapped',
        'lost','numb','dread','panic','shame','guilt','regret','disappoint','struggle','difficult',
        'bad','worse','worst','terrible','awful','horrible','miserable','suffer','despair','grief',
        'sorrow','burden','pressure','tension','conflict','trouble','wrong','mistake','blame',
        'reject','abandon','isolate','pointless','meaningless','helpless','powerless','invisible',
        'unloved','unworthy','unwanted','fail','numb','hollow','bitter','resentful','devastated'
    ];
    const negators = new Set(['not','never','no','neither','nor','cannot','cant',"don't","won't","can't","doesn't","didn't"]);

    const words = text.toLowerCase().replace(/['"]/g, '').match(/\b\w+\b/g) || [];
    let score = 0;

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const prev = words[i - 1] || '';
        const negated = negators.has(prev);
        if (positive.includes(w)) score += negated ? -1 : 1;
        else if (negative.includes(w)) score += negated ? 1 : -1;
    }

    // Normalize: clamp to -10..+10
    const raw = words.length > 0 ? (score / Math.sqrt(words.length)) * 3 : 0;
    const normalized = Math.max(-10, Math.min(10, Math.round(raw)));

    let label, icon, color, bg;
    if (normalized >= 2)       { label = 'Bright';        icon = '☀️';  color = '#d97706'; bg = '#fffbeb'; }
    else if (normalized >= -1) { label = 'Partly Cloudy'; icon = '⛅';  color = '#0284c7'; bg = '#f0f9ff'; }
    else                       { label = 'Cloudy';        icon = '🌧️'; color = '#475569'; bg = '#f8fafc'; }

    return { score: normalized, label, icon, color, bg };
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
    const entries = getJournalEntries();
    const totalWords = entries.reduce((sum, e) => sum + (e.wordCount || 0), 0);
    const streak = calculateWritingStreak(entries);

    const el1 = document.getElementById('journalStatEntries');
    const el2 = document.getElementById('journalStatWords');
    const el3 = document.getElementById('journalStatStreak');
    if (el1) el1.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    if (el2) el2.textContent = `${totalWords.toLocaleString()} words`;
    if (el3) el3.textContent = `${streak} day streak`;
}

function calculateWritingStreak(entries) {
    if (entries.length === 0) return 0;
    
    const today = localDateStr();
    const dates = [...new Set(entries.map(entry => entry.date))].sort();
    
    let streak = 0;
    let currentDate = new Date(today);
    
    while (true) {
        const dateStr = localDateStr(currentDate);
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
    const _goalsKey = getUserSpecificKey('mindwell_goals');
    if (!localStorage.getItem(_goalsKey)) {
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
                startDate: localDateStr(),
                endDate: localDateStr(new Date(Date.now() + 30*86400000)),
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
                startDate: localDateStr(new Date(Date.now() - 60*86400000)),
                endDate: localDateStr(new Date(Date.now() + 30*86400000)),
                status: "active",
                priority: "medium",
                reminders: true,
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem(_goalsKey, JSON.stringify(sampleGoals));
    }
}

function createNewGoal() {
    showGoalModal();
}

function showGoalModal() {
    const today = localDateStr();
    const next30 = localDateStr(new Date(Date.now() + 30*86400000));
    const modalHtml = `
        <div id="goalModal" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,0.6);backdrop-filter:blur(6px);padding:16px;">
            <div style="background:#fff;border-radius:20px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.2);animation:goalModalIn 0.25s ease;">
                <!-- Header -->
                <div style="padding:28px 28px 0;display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#4facfe,#00f2fe);display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-bullseye" style="color:#fff;font-size:16px;"></i>
                        </div>
                        <div>
                            <h2 style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">Create New Goal</h2>
                            <p style="margin:0;font-size:12px;color:#94a3b8;">Track your mental wellness journey</p>
                        </div>
                    </div>
                    <button onclick="closeGoalModal()" style="width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:16px;transition:background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">&times;</button>
                </div>

                <form id="goalForm" style="padding:24px 28px 28px;display:flex;flex-direction:column;gap:18px;">
                    <!-- Title -->
                    <div>
                        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Goal Title <span style="color:#ef4444;">*</span></label>
                        <input type="text" id="goalTitle" name="title" required placeholder="e.g., Daily Meditation Practice"
                            style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;transition:border-color 0.2s;box-sizing:border-box;"
                            onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'">
                    </div>

                    <!-- Description -->
                    <div>
                        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Description</label>
                        <textarea id="goalDescription" name="description" rows="2" placeholder="Describe your goal and why it matters to you..."
                            style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;resize:vertical;transition:border-color 0.2s;font-family:inherit;box-sizing:border-box;"
                            onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
                    </div>

                    <!-- Category + Priority -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Category</label>
                            <select id="goalCategory" name="category"
                                style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;background:#fff;cursor:pointer;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'">
                                <option value="mindfulness">🧘 Mindfulness</option>
                                <option value="therapy">💬 Therapy</option>
                                <option value="exercise">🏃 Exercise</option>
                                <option value="sleep">😴 Sleep</option>
                                <option value="social">🤝 Social</option>
                                <option value="self-care">💆 Self-care</option>
                                <option value="other">✨ Other</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Priority</label>
                            <select id="goalPriority" name="priority"
                                style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;background:#fff;cursor:pointer;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'">
                                <option value="low">🟢 Low</option>
                                <option value="medium" selected>🟡 Medium</option>
                                <option value="high">🔴 High</option>
                            </select>
                        </div>
                    </div>

                    <!-- Target + Unit -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Target Value <span style="color:#ef4444;">*</span></label>
                            <input type="number" id="goalTarget" name="target" min="1" required placeholder="30"
                                style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;transition:border-color 0.2s;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Unit</label>
                            <select id="goalUnit" name="unit"
                                style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;background:#fff;cursor:pointer;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'">
                                <option value="days">Days</option>
                                <option value="sessions">Sessions</option>
                                <option value="hours">Hours</option>
                                <option value="times">Times</option>
                                <option value="weeks">Weeks</option>
                            </select>
                        </div>
                    </div>

                    <!-- Start + End Date -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Start Date</label>
                            <input type="date" id="goalStartDate" name="startDate" value="${today}"
                                style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">End Date</label>
                            <input type="date" id="goalEndDate" name="endDate" value="${next30}"
                                style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;outline:none;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#4facfe'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>
                    </div>

                    <!-- Reminders toggle -->
                    <label style="display:flex;align-items:center;gap:10px;padding:14px;background:#f8fafc;border-radius:12px;cursor:pointer;border:1.5px solid #e2e8f0;">
                        <input type="checkbox" name="reminders" checked style="width:16px;height:16px;accent-color:#4facfe;cursor:pointer;">
                        <div>
                            <span style="font-size:14px;font-weight:600;color:#374151;">Enable reminders</span>
                            <p style="margin:0;font-size:12px;color:#94a3b8;">Get notified to stay on track</p>
                        </div>
                    </label>

                    <!-- Submit -->
                    <button type="submit"
                        style="width:100%;padding:14px;background:linear-gradient(135deg,#4facfe,#00f2fe);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:opacity 0.2s;letter-spacing:0.3px;"
                        onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        <i class="fas fa-plus" style="margin-right:8px;"></i>Create Goal
                    </button>
                </form>
            </div>
        </div>
        <style>
            @keyframes goalModalIn {
                from { opacity:0; transform:scale(0.95) translateY(10px); }
                to   { opacity:1; transform:scale(1) translateY(0); }
            }
        </style>
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

// One-click add from Suggested Goals panel
async function addSuggestedGoal(title, description, category, targetValue, unit) {
    // Duplicate check — fetch existing goals and compare titles (case-insensitive)
    if (!isDemoMode && isLoggedIn) {
        try {
            const res = await fetch(API_ENDPOINTS.goals.list, {
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
            });
            if (res.ok) {
                const data = await res.json();
                const existing = Array.isArray(data) ? data : (data.goals || []);
                const alreadyExists = existing.some(
                    g => g.title.trim().toLowerCase() === title.trim().toLowerCase()
                );
                if (alreadyExists) {
                    showNotification(`"${title}" is already in your goals.`, 'info');
                    return;
                }
            }
        } catch (e) { /* proceed with creation if check fails */ }
    } else {
        const goalsKey = getUserSpecificKey('mindwell_goals');
        const local = JSON.parse(localStorage.getItem(goalsKey) || '[]');
        if (local.some(g => g.title.trim().toLowerCase() === title.trim().toLowerCase())) {
            showNotification(`"${title}" is already in your goals.`, 'info');
            return;
        }
    }

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);

    const payload = {
        title,
        description,
        category,
        target_value: targetValue,
        current_value: 0,
        unit,
        start_date: localDateStr(today),
        end_date: localDateStr(endDate),
        status: 'active',
        priority: 'medium'
    };

    if (!isDemoMode && isLoggedIn) {
        try {
            const response = await fetch(API_ENDPOINTS.goals.create, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(`"${title}" added to your goals!`, 'success');
                loadGoalsData();
                return;
            }
            showNotification(data.detail || JSON.stringify(data) || 'Failed to add goal.', 'error');
            return;
        } catch (e) { console.error('addSuggestedGoal error:', e); }
    }
    // demo fallback
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    goals.unshift({ ...payload, id: Date.now(), currentValue: 0, targetValue });
    localStorage.setItem(goalsKey, JSON.stringify(goals));
    showNotification(`"${title}" added to your goals!`, 'success');
    loadGoalsData();
}

async function saveNewGoal(form) {
    const formData = new FormData(form);
    const today = localDateStr();
    const next30 = localDateStr(new Date(Date.now() + 30*86400000));

    const payload = {
        title:        formData.get('title'),
        description:  formData.get('description') || formData.get('title'),
        category:     formData.get('category') || 'other',
        target_value: parseInt(formData.get('target')) || 1,
        current_value: 0,
        unit:         formData.get('unit') || 'days',
        start_date:   formData.get('startDate') || today,
        end_date:     formData.get('endDate') || next30,
        status:       'active',
        priority:     formData.get('priority') || 'medium',
        reminders:    formData.get('reminders') === 'on'
    };

    if (!isDemoMode && isLoggedIn) {
        try {
            const response = await fetch(API_ENDPOINTS.goals.create, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showNotification('Goal created successfully!', 'success');
                closeGoalModal();
                loadGoalsData();
                return;
            }
            const errMsg = data.errors ? Object.values(data.errors).flat().join(' ') : 'Failed to create goal.';
            showNotification(errMsg, 'error');
            return;
        } catch (e) { console.error('saveNewGoal error:', e); }
    }
    // demo fallback
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    goals.unshift({ ...payload, id: Date.now(), currentValue: 0, targetValue: payload.target_value });
    localStorage.setItem(goalsKey, JSON.stringify(goals));
    showNotification('Goal created!', 'success');
    closeGoalModal();
    loadGoalsData();
}

// Renders goals — handles both backend snake_case and localStorage camelCase
function renderGoalsList(goals) {
    const goalsList = document.querySelector('.goal-list');
    if (!goalsList) return;
    goalsList.innerHTML = '';

    if (!goals || goals.length === 0) {
        goalsList.innerHTML = '<p style="color:#6b7280;text-align:center;padding:24px;">No goals yet. Click "+ Create New Goal" to get started!</p>';
        return;
    }

    const active    = goals.filter(g => (g.status || 'active') !== 'completed');
    const completed = goals.filter(g => (g.status || 'active') === 'completed');

    function makeCard(goal) {
        const current     = goal.current_value ?? goal.currentValue ?? 0;
        const target      = goal.target_value  ?? goal.targetValue  ?? 1;
        const unit        = goal.unit    || '';
        const status      = goal.status  || 'active';
        const isCompleted = status === 'completed';
        // Completed goals always show 100% on the bar
        const progress    = isCompleted ? 100 : Math.min((current / target) * 100, 100);
        const displayVal  = isCompleted ? target : current;
        const completedAt = goal.completed_at || null;
        const endDate     = goal.end_date || goal.endDate || null;

        const card = document.createElement('div');
        card.className = `goal-card ${isCompleted ? 'completed' : 'active'}`;
        card.style.position = 'relative';
        card.innerHTML = `
            <!-- Delete button — top-right corner -->
            <button class="btn btn-danger btn-sm goal-delete-btn"
                    onclick="deleteGoal(${goal.id})" title="Delete goal"
                    style="position:absolute;top:12px;right:12px;padding:4px 8px;font-size:0.75rem;">
                <i class="fas fa-trash-alt"></i>
            </button>

            <div class="goal-header" style="padding-right:48px;">
                <h3>${goal.title}</h3>
                <span class="goal-status ${isCompleted ? 'completed' : 'in-progress'}">
                    ${isCompleted ? '✓ Completed' : 'In Progress'}
                </span>
            </div>
            <p class="goal-description">${goal.description || ''}</p>
            <div class="goal-progress">
                <div class="progress-info">
                    <span>Progress: ${displayVal} / ${target} ${unit}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width:${progress}%"></div>
                </div>
            </div>
            <div class="goal-meta">
                ${endDate ? `<span>Due: ${formatDate(endDate)}</span>` : ''}
                <span>Priority: ${goal.priority || 'medium'}</span>
            </div>
            <div class="goal-actions">
                ${!isCompleted ? `
                    <button class="btn btn-outline btn-sm" onclick="updateGoalProgress(${goal.id}, 1)">+1 Progress</button>
                    <button class="btn btn-primary btn-sm" onclick="markGoalComplete(${goal.id})">Mark Complete</button>
                ` : `
                    <span style="color:#6b7280;font-size:0.8rem;">
                        <i class="fas fa-trophy" style="color:#f59e0b;margin-right:4px;"></i>
                        Completed${completedAt ? ' on ' + formatDate(completedAt) : ''}
                    </span>
                `}
            </div>
        `;
        goalsList.appendChild(card);
    }

    if (active.length > 0) {
        const title = document.createElement('p');
        title.className = 'goal-section-title';
        title.textContent = `Active (${active.length})`;
        goalsList.appendChild(title);
        active.forEach(makeCard);
    }

    if (completed.length > 0) {
        const title = document.createElement('p');
        title.className = 'goal-section-title';
        title.textContent = `Completed (${completed.length})`;
        goalsList.appendChild(title);
        completed.forEach(makeCard);
    }
}

async function updateGoalProgress(goalId, increment) {
    if (!isDemoMode && isLoggedIn) {
        try {
            const response = await fetch(`${API_BASE_URL}/dashboard/api/goals/${goalId}/update_progress/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ increment })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                if (data.goal && data.goal.status === 'completed')
                    showNotification(`🎉 Goal "${data.goal.title}" completed!`, 'success');
                else
                    showNotification('Progress updated!', 'success');
                loadGoalsData();
                return;
            }
            showNotification('Failed to update progress.', 'error');
        } catch (e) { console.error('updateGoalProgress error:', e); }
        return;
    }
    // demo fallback
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
        goal.currentValue = Math.min((goal.currentValue || 0) + increment, goal.targetValue || 1);
        if (goal.currentValue >= goal.targetValue) {
            goal.status = 'completed';
            showNotification(`🎉 Goal "${goal.title}" completed!`, 'success');
        } else {
            showNotification('Progress updated!', 'success');
        }
        localStorage.setItem(goalsKey, JSON.stringify(goals));
        loadGoalsData();
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Delete this goal?')) return;
    if (!isDemoMode && isLoggedIn) {
        try {
            const response = await fetch(`${API_BASE_URL}/dashboard/api/goals/${goalId}/`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders() }
            });
            if (response.ok || response.status === 204) {
                showNotification('Goal deleted.', 'info');
                loadGoalsData();
                return;
            }
        } catch (e) { console.error('deleteGoal error:', e); }
        return;
    }
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]').filter(g => g.id !== goalId);
    localStorage.setItem(goalsKey, JSON.stringify(goals));
    showNotification('Goal deleted.', 'info');
    loadGoalsData();
}

async function markGoalComplete(goalId) {
    if (!isDemoMode && isLoggedIn) {
        try {
            // Fetch goal first to know target_value so we can set current_value = target_value
            const getRes = await fetch(`${API_BASE_URL}/dashboard/api/goals/${goalId}/`, {
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
            });
            const goal = await getRes.json();
            const patchRes = await fetch(`${API_BASE_URL}/dashboard/api/goals/${goalId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ status: 'completed', current_value: goal.target_value })
            });
            if (patchRes.ok) {
                showNotification('Goal completed! 🎉', 'success');
                loadGoalsData();
                return;
            }
        } catch (e) { console.error('markGoalComplete error:', e); }
        return;
    }
    // demo fallback
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
        goal.status = 'completed';
        goal.currentValue = goal.targetValue;
        localStorage.setItem(goalsKey, JSON.stringify(goals));
        showNotification('Goal completed! 🎉', 'success');
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
                            <input type="date" id="appointmentDate" name="date" required min="${localDateStr()}">
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
let chatHistory = []; // [{role:'user'|'assistant', content:'...'}]
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// WebSocket for real-time community feed
let communitySocket = null;
let communityReconnectTimer = null;

// WebSocket for group chat
let groupChatSocket = null;
let activeGroupChatId = null;

// Enhanced Crisis Support with AI and Memory Integration
async function startCrisisChat() {
    chatHistory = []; // fresh conversation each time

    // Remove any existing chat modal first
    const existingChat = document.getElementById('crisisChat');
    if (existingChat) {
        existingChat.remove();
    }
    
    // Log crisis chat initiation to memory system
    addToMemorySystem('crisis', 'User initiated crisis support chat');
    
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
                        <!-- Typing indicator -->
                        <div id="typingIndicator" style="display:none;align-items:flex-end;gap:10px;margin-bottom:16px;">
                            <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0;">🤝</div>
                            <div style="background:#fff;padding:12px 18px;border-radius:18px 18px 18px 4px;box-shadow:0 2px 12px rgba(0,0,0,0.08);border:1px solid #f1f5f9;display:flex;align-items:center;gap:6px;">
                                <span style="width:7px;height:7px;background:#10b981;border-radius:50%;animation:typing-bounce 1.2s infinite 0s;display:inline-block;"></span>
                                <span style="width:7px;height:7px;background:#10b981;border-radius:50%;animation:typing-bounce 1.2s infinite 0.2s;display:inline-block;"></span>
                                <span style="width:7px;height:7px;background:#10b981;border-radius:50%;animation:typing-bounce 1.2s infinite 0.4s;display:inline-block;"></span>
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
    
    // Inject typing bounce animation
    if (!document.getElementById('chatBounceStyle')) {
        const s = document.createElement('style');
        s.id = 'chatBounceStyle';
        s.textContent = `@keyframes typing-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`;
        document.head.appendChild(s);
    }

    // Connect to WebSocket (chat still works via HTTP if this fails)
    connectToSupportChat();

    // Enable input immediately so HTTP fallback works right away
    const initialInput = document.getElementById('chatInput');
    const initialBtn = document.getElementById('sendBtn');
    if (initialInput) initialInput.disabled = false;
    if (initialBtn) initialBtn.disabled = false;

    console.log('Crisis chat modal created successfully');
}

// Connect to WebSocket for crisis support with enhanced AI
function connectToSupportChat() {
    const userId = currentUser?.id || currentUser?.username || 'demo';
    const wsPath = `${CHAT_WS_URL}/ws/crisis/${userId}/`;

    const enableInputs = () => {
        const inp = document.getElementById('chatInput');
        const btn = document.getElementById('sendBtn');
        if (inp) inp.disabled = false;
        if (btn) btn.disabled = false;
    };

    // Show welcome only in HTTP mode (WS sends its own welcome from backend)
    const showHttpWelcome = () => {
        addChatMessage({
            content: "Hi, I'm glad you're here. Take your time — share whatever feels right, and I'll do my best to support you.",
            created_at: new Date().toISOString()
        }, 'bot');
    };

    try {
        chatSocket = new WebSocket(wsPath);

        const wsTimeout = setTimeout(() => {
            if (chatSocket.readyState !== WebSocket.OPEN) {
                chatSocket.onclose = null;
                chatSocket.onerror = null;
                chatSocket.close();
                chatSocket = null;
                updateChatStatus('connected', 'Connected');
                enableInputs();
                showHttpWelcome();
            }
        }, 3000);

        chatSocket.onopen = () => {
            clearTimeout(wsTimeout);
            updateChatStatus('connected', 'Connected securely');
            enableInputs();
        };

        chatSocket.onmessage = (e) => {
            try { handleChatMessage(JSON.parse(e.data)); } catch {}
        };

        chatSocket.onclose = () => {
            clearTimeout(wsTimeout);
            chatSocket = null;
            updateChatStatus('connected', 'Connected');
            enableInputs();
        };

        chatSocket.onerror = () => {
            clearTimeout(wsTimeout);
            chatSocket = null;
            updateChatStatus('connected', 'Connected');
            enableInputs();
            showHttpWelcome();
        };

    } catch {
        chatSocket = null;
        updateChatStatus('connected', 'Connected');
        enableInputs();
        showHttpWelcome();
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
    const sendBtn = document.getElementById('sendBtn');
    const message = input.value.trim();
    if (!message) return;

    // Prevent duplicate sends
    if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }
    input.value = '';

    // Track in history
    chatHistory.push({ role: 'user', content: message });

    addChatMessage({
        content: message,
        sender: { id: currentUser?.id || 'me', username: currentUser?.username || 'You' },
        created_at: new Date().toISOString()
    }, 'user');
    input.value = '';

    // ── WebSocket path ────────────────────────────────────────────────────
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            type: 'chat_message',
            message,
            history: chatHistory.slice(-12), // last 6 turns
            include_memory: true,
            use_rag: true
        }));
        showTypingIndicator();
        return;
    }

    // ── HTTP fallback path ───────────────────────────────────────────────
    showTypingIndicator();
    try {
        const resp = await fetch(API_ENDPOINTS.chat.ai_chat, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ message, history: chatHistory.slice(-12) })
        });
        hideTypingIndicator();
        if (resp.ok) {
            const data = await resp.json();
            const reply = data.response || "I'm here to support you. Could you tell me more?";
            chatHistory.push({ role: 'assistant', content: reply });
            addChatMessage({
                content: reply,
                sender: { id: 'ai', username: 'MindWell', first_name: 'MindWell', last_name: '' },
                created_at: new Date().toISOString()
            }, 'bot');
            if (data.is_crisis) showCrisisResources();
        } else {
            addChatMessage({
                content: "I'm here with you. Could you tell me more about how you're feeling right now?",
                sender: { id: 'ai', username: 'MindWell', first_name: 'MindWell', last_name: '' },
                created_at: new Date().toISOString()
            }, 'bot');
        }
    } catch (err) {
        hideTypingIndicator();
        addChatMessage({
            content: "I'm having trouble connecting. If you're in crisis, please call or text **988** right now.",
            sender: { id: 'ai', username: 'MindWell', first_name: 'MindWell', last_name: '' },
            created_at: new Date().toISOString()
        }, 'bot');
    }
}

function sendQuickMessage(message) {
    const input = document.getElementById('chatInput');
    input.value = message;
    sendChatMessage();
}

function addChatMessage(messageData, senderType) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const timeString = new Date(messageData.created_at || Date.now())
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;align-items:${senderType === 'user' ? 'flex-end' : 'flex-start'};gap:10px;margin-bottom:16px;${senderType === 'user' ? 'flex-direction:row-reverse;' : ''}`;

    if (senderType === 'user') {
        // User initial avatar
        const name = currentUser?.first_name || currentUser?.firstName || 'Y';
        const initials = name.charAt(0).toUpperCase();
        wrap.innerHTML = `
            <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>
            <div style="max-width:70%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:12px 16px;border-radius:18px 18px 4px 18px;box-shadow:0 2px 8px rgba(99,102,241,0.25);">
                <p style="margin:0;font-size:14px;line-height:1.5;word-break:break-word;">${escapeHtml(messageData.content)}</p>
                <span style="display:block;text-align:right;font-size:11px;opacity:0.75;margin-top:4px;">${timeString}</span>
            </div>`;
    } else {
        wrap.innerHTML = `
            <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0;">🤝</div>
            <div style="max-width:75%;background:#fff;color:#1e293b;padding:14px 18px;border-radius:18px 18px 18px 4px;box-shadow:0 2px 12px rgba(0,0,0,0.08);border:1px solid #f1f5f9;">
                <div style="font-size:11px;font-weight:600;color:#10b981;margin-bottom:6px;">MindWell Support</div>
                <div style="font-size:14px;line-height:1.6;word-break:break-word;">${formatBotMessage(messageData.content)}</div>
                <span style="display:block;font-size:11px;color:#94a3b8;margin-top:6px;">${timeString}</span>
            </div>`;
    }

    // Insert before typing indicator so it always stays last
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        chatMessages.insertBefore(wrap, typingIndicator);
    } else {
        chatMessages.appendChild(wrap);
    }
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
    if (typingIndicator) typingIndicator.style.display = 'none';
    // Re-enable send button when response arrives
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
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
    if (!chatMessages) return;

    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:16px;';
    div.innerHTML = `
        <div style="background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:16px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#dc2626;">🛟 Immediate Support Resources</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <a href="tel:9152987821" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fef2f2;border-radius:10px;text-decoration:none;color:#1e293b;">
                    <span style="font-size:16px;">📞</span>
                    <div><div style="font-size:13px;font-weight:600;">iCall India</div><div style="font-size:11px;color:#64748b;">9152987821 · Free counselling · Mon–Sat 8am–10pm</div></div>
                </a>
                <a href="tel:18602662345" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fef2f2;border-radius:10px;text-decoration:none;color:#1e293b;">
                    <span style="font-size:16px;">📞</span>
                    <div><div style="font-size:13px;font-weight:600;">Vandrevala Foundation</div><div style="font-size:11px;color:#64748b;">1860-2662-345 · 24/7 · India</div></div>
                </a>
                <a href="tel:9820466627" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fef2f2;border-radius:10px;text-decoration:none;color:#1e293b;">
                    <span style="font-size:16px;">📞</span>
                    <div><div style="font-size:13px;font-weight:600;">AASRA</div><div style="font-size:11px;color:#64748b;">9820466627 · 24/7 Suicide Prevention · India</div></div>
                </a>
                <a href="tel:112" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fee2e2;border-radius:10px;text-decoration:none;color:#1e293b;">
                    <span style="font-size:16px;">🚨</span>
                    <div><div style="font-size:13px;font-weight:600;">Emergency Services</div><div style="font-size:11px;color:#64748b;">112 · All emergencies · India</div></div>
                </a>
            </div>
        </div>
    `;

    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) chatMessages.insertBefore(div, typingIndicator);
    else chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showFallbackSupport() {
    // Keep chat input enabled so HTTP fallback still works
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    if (chatInput) chatInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    updateChatStatus('connecting', 'Using backup connection');

    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const fallbackDiv = document.createElement('div');
    fallbackDiv.innerHTML = `
        <div style="background:#fff8f0;border:1px solid #fed7aa;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e;">
            <p style="margin:0 0 6px;font-weight:600;">⚠️ Live connection unavailable — backup chat active</p>
            <p style="margin:0 0 8px;font-size:12px;color:#b45309;">If you're in immediate danger:</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <a href="tel:988" style="background:#dc2626;color:#fff;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600;">📞 988</a>
                <a href="tel:911" style="background:#dc2626;color:#fff;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600;">🚨 911</a>
                <a href="sms:741741&body=HOME" style="background:#dc2626;color:#fff;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600;">💬 Text 741741</a>
            </div>
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

// ── Safety Plan Wizard ────────────────────────────────────────────────────────

const SP_STEPS = [
    {
        key: 'warning_signs_personal',
        title: 'Warning Signs — Personal',
        icon: '🔍',
        subtitle: 'Step 1 of 6',
        description: 'What thoughts, feelings, or body sensations tell <em>you</em> that a crisis may be building? The earlier you catch these, the easier it is to act.',
        fields: [{ type: 'textarea', name: 'warning_signs_personal', placeholder: 'e.g. I start feeling numb, I stop replying to messages, I can\'t sleep...', rows: 4 }],
        tip: 'Be specific — generic answers are harder to act on during a crisis.',
    },
    {
        key: 'warning_signs_observable',
        title: 'Warning Signs — What Others Notice',
        icon: '👁️',
        subtitle: 'Step 2 of 6',
        description: 'What might a friend or family member notice about you when you\'re struggling? This helps your support network spot a crisis even when you can\'t.',
        fields: [{ type: 'textarea', name: 'warning_signs_observable', placeholder: 'e.g. I stop eating, I cancel plans, I become very quiet or very irritable...', rows: 4 }],
        tip: 'Ask someone who knows you well — they often see things we miss.',
    },
    {
        key: 'coping_strategies',
        title: 'Coping Strategies',
        icon: '🧘',
        subtitle: 'Step 3 of 6',
        description: 'Things you can do <em>on your own</em> to feel better — no one else needed. List at least 3 that have worked for you before.',
        fields: [{ type: 'textarea', name: 'coping_strategies', placeholder: 'e.g. Go for a 15-minute walk, put on a playlist, call a friend, write in my journal...', rows: 5 }],
        tip: 'Order them from easiest to hardest — try the easiest one first.',
    },
    {
        key: 'support_contacts',
        title: 'Social Support',
        icon: '🤝',
        subtitle: 'Step 4 of 6',
        description: 'People you trust who you can reach out to — not necessarily to talk about the crisis, just to not be alone.',
        fields: 'contacts_support',
        tip: 'Include people who make you feel safe, not just people you feel obligated to call.',
    },
    {
        key: 'professional_contacts',
        title: 'Professional Contacts',
        icon: '🏥',
        subtitle: 'Step 5 of 6',
        description: 'Your therapist, doctor, or a crisis helpline. These contacts are for when personal support isn\'t enough.',
        fields: 'contacts_professional',
        tip: 'Save these numbers in your phone too — don\'t rely on this plan being open.',
    },
    {
        key: 'environment_safety',
        title: 'Safe Environment & Reasons for Living',
        icon: '💚',
        subtitle: 'Step 6 of 6',
        description: 'Two final — and often the most powerful — sections of your plan.',
        fields: [
            { type: 'textarea', name: 'environment_safety', label: '🏠 Make my environment safer', placeholder: 'e.g. Ask someone to check on me, remove items that feel dangerous...', rows: 3 },
            { type: 'textarea', name: 'reasons_for_living', label: '💛 My reasons for living', placeholder: 'e.g. My dog, finishing my degree, the people who love me, experiencing more sunrises...', rows: 3 },
        ],
        tip: 'Re-read your reasons for living regularly — not only in a crisis.',
    },
];

let _spStep = 0;
let _spData = {};
let _spSaving = false;

async function createSafetyPlan() {
    if (document.getElementById('safetyPlanModal')) return;
    // Load existing plan first
    try {
        const resp = await fetch(API_ENDPOINTS.safetyPlan.get, { headers: getAuthHeaders() });
        if (resp.ok) {
            const d = await resp.json();
            if (d.success) _spData = d.plan || {};
        }
    } catch (_) {
        const stored = localStorage.getItem('mindwell_safety_plan_v2');
        if (stored) _spData = JSON.parse(stored);
    }
    _spStep = 0;
    _renderSafetyPlanModal();
}

function _renderSafetyPlanModal() {
    const existing = document.getElementById('safetyPlanModal');
    if (existing) existing.remove();

    const pct = _spCompletionPct();
    const step = SP_STEPS[_spStep];
    const isLast = _spStep === SP_STEPS.length - 1;
    const lastUpdated = _spData.updated_at
        ? `Last saved ${new Date(_spData.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
        : 'Not saved yet';

    const html = `
    <div id="safetyPlanModal" style="position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);">
      <div style="background:#fff;border-radius:20px;width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.2);overflow:hidden;">

        <!-- Header -->
        <div style="padding:20px 24px 16px;border-bottom:1px solid #f1f5f9;background:linear-gradient(135deg,#6366f108,#8b5cf608);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <h2 style="font-size:17px;font-weight:700;color:#0f172a;margin:0;">Personal Safety Plan</h2>
              <span style="font-size:12px;color:#94a3b8;">${lastUpdated}</span>
            </div>
            <button onclick="closeSafetyPlan()" style="width:32px;height:32px;border-radius:50%;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:18px;color:#64748b;display:flex;align-items:center;justify-content:center;">&times;</button>
          </div>
          <!-- Progress bar -->
          <div style="background:#f1f5f9;border-radius:99px;height:6px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:99px;transition:width 0.4s ease;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span style="font-size:11px;color:#64748b;">${step.subtitle}</span>
            <span style="font-size:11px;color:#6366f1;font-weight:600;">${pct}% complete</span>
          </div>
          <!-- Step dots -->
          <div style="display:flex;gap:6px;margin-top:10px;justify-content:center;">
            ${SP_STEPS.map((s, i) => `
              <div onclick="_spGoTo(${i})" style="width:${i === _spStep ? '24px' : '8px'};height:8px;border-radius:99px;background:${i === _spStep ? '#6366f1' : (i < _spStep ? '#a5b4fc' : '#e2e8f0')};cursor:pointer;transition:all 0.2s;"></div>
            `).join('')}
          </div>
        </div>

        <!-- Step body -->
        <div style="padding:24px;overflow-y:auto;flex:1;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span style="font-size:24px;">${step.icon}</span>
            <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0;">${step.title}</h3>
          </div>
          <p style="font-size:13.5px;color:#475569;margin:0 0 18px;line-height:1.6;">${step.description}</p>

          ${_spRenderFields(step)}

          <!-- AI Suggestions -->
          <div id="sp-suggestions-area" style="margin-top:16px;"></div>
          <button onclick="_spGetSuggestions('${step.key}')"
            style="display:inline-flex;align-items:center;gap:7px;margin-top:12px;padding:8px 14px;border-radius:10px;border:1px solid #6366f130;background:#6366f108;color:#6366f1;font-size:13px;font-weight:600;cursor:pointer;">
            <i class="fas fa-magic"></i> Get AI suggestions for this section
          </button>

          <!-- Tip -->
          <div style="margin-top:18px;padding:10px 14px;background:#fffbeb;border-radius:10px;border-left:3px solid #f59e0b;font-size:12.5px;color:#78350f;">
            <strong>Tip:</strong> ${step.tip}
          </div>
        </div>

        <!-- Footer nav -->
        <div style="padding:16px 24px;border-top:1px solid #f1f5f9;display:flex;gap:10px;align-items:center;">
          ${_spStep > 0 ? `<button onclick="_spNav(-1)" style="padding:10px 18px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:14px;font-weight:500;cursor:pointer;">← Back</button>` : ''}
          <div style="flex:1;"></div>
          <button onclick="_spSaveProgress()" style="padding:10px 18px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#6366f1;font-size:14px;font-weight:500;cursor:pointer;">Save draft</button>
          ${isLast
            ? `<button onclick="_spFinalSave()" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;"><i class="fas fa-check"></i> Save & Finish</button>
               <button onclick="_spPrint()" style="padding:10px 14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;cursor:pointer;" title="Download PDF"><i class="fas fa-download"></i></button>`
            : `<button onclick="_spNav(1)" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Next →</button>`
          }
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    _spRestoreFields(step);
}

function _spCompletionPct() {
    const keys = ['warning_signs_personal', 'warning_signs_observable', 'coping_strategies',
                  'support_contacts', 'professional_contacts', 'environment_safety', 'reasons_for_living'];
    const filled = keys.filter(k => {
        const v = _spData[k];
        return Array.isArray(v) ? v.length > 0 : (v && String(v).trim().length > 0);
    }).length;
    return Math.round(filled / keys.length * 100);
}

function _spRenderFields(step) {
    if (step.fields === 'contacts_support') return _spContactFields('support', 3);
    if (step.fields === 'contacts_professional') return _spContactFields('professional', 3);
    return step.fields.map(f => `
        <div style="margin-bottom:14px;">
            ${f.label ? `<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">${f.label}</label>` : ''}
            <textarea id="sp-${f.name}" name="${f.name}" rows="${f.rows}"
                placeholder="${f.placeholder}"
                oninput="_spAutoSave()"
                style="width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;resize:vertical;font-family:inherit;line-height:1.5;box-sizing:border-box;transition:border-color 0.15s;"
                onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
        </div>`).join('');
}

function _spContactFields(type, count) {
    const contacts = _spData[`${type}_contacts`] || [];
    let html = '';
    for (let i = 0; i < count; i++) {
        const c = contacts[i] || {};
        const roleField = type === 'professional'
            ? `<input id="sp-${type}-role-${i}" placeholder="Role (e.g. Therapist)" value="${escapeHtml(c.role||'')}" oninput="_spAutoSave()" style="${_spInputStyle()}">`
            : `<input id="sp-${type}-rel-${i}" placeholder="Relationship (e.g. Friend)" value="${escapeHtml(c.relationship||'')}" oninput="_spAutoSave()" style="${_spInputStyle()}">`;
        html += `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
            <input id="sp-${type}-name-${i}" placeholder="Name" value="${escapeHtml(c.name||'')}" oninput="_spAutoSave()" style="${_spInputStyle()}">
            <input id="sp-${type}-phone-${i}" placeholder="Phone" type="tel" value="${escapeHtml(c.phone||'')}" oninput="_spAutoSave()" style="${_spInputStyle()}">
            ${roleField}
        </div>`;
    }
    return html;
}

function _spInputStyle() {
    return 'padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13.5px;font-family:inherit;width:100%;box-sizing:border-box;';
}

function _spRestoreFields(step) {
    if (step.fields === 'contacts_support' || step.fields === 'contacts_professional') return;
    step.fields.forEach(f => {
        const el = document.getElementById(`sp-${f.name}`);
        if (el && _spData[f.name]) el.value = _spData[f.name];
    });
}

function _spCollectCurrentStep() {
    const step = SP_STEPS[_spStep];
    if (step.fields === 'contacts_support' || step.fields === 'contacts_professional') {
        const type = step.fields === 'contacts_support' ? 'support' : 'professional';
        const contacts = [];
        for (let i = 0; i < 3; i++) {
            const name  = (document.getElementById(`sp-${type}-name-${i}`)?.value || '').trim();
            const phone = (document.getElementById(`sp-${type}-phone-${i}`)?.value || '').trim();
            const role  = (document.getElementById(`sp-${type}-role-${i}`)?.value || '').trim();
            const rel   = (document.getElementById(`sp-${type}-rel-${i}`)?.value || '').trim();
            if (name || phone) contacts.push({ name, phone, role, relationship: rel });
        }
        _spData[`${type}_contacts`] = contacts;
    } else {
        step.fields.forEach(f => {
            const el = document.getElementById(`sp-${f.name}`);
            if (el) _spData[f.name] = el.value;
        });
    }
}

let _spAutoSaveTimer = null;
function _spAutoSave() {
    clearTimeout(_spAutoSaveTimer);
    _spAutoSaveTimer = setTimeout(() => {
        _spCollectCurrentStep();
        localStorage.setItem('mindwell_safety_plan_v2', JSON.stringify(_spData));
    }, 800);
}

function _spNav(dir) {
    _spCollectCurrentStep();
    localStorage.setItem('mindwell_safety_plan_v2', JSON.stringify(_spData));
    _spStep = Math.max(0, Math.min(SP_STEPS.length - 1, _spStep + dir));
    _renderSafetyPlanModal();
}

function _spGoTo(idx) {
    _spCollectCurrentStep();
    localStorage.setItem('mindwell_safety_plan_v2', JSON.stringify(_spData));
    _spStep = idx;
    _renderSafetyPlanModal();
}

async function _spSaveProgress() {
    _spCollectCurrentStep();
    localStorage.setItem('mindwell_safety_plan_v2', JSON.stringify(_spData));
    try {
        const resp = await fetch(API_ENDPOINTS.safetyPlan.save, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(_spData),
        });
        if (resp.ok) {
            const d = await resp.json();
            if (d.success) _spData = { ..._spData, ...d.plan };
        }
    } catch (_) {}
    showNotification('Draft saved', 'success');
}

async function _spFinalSave() {
    _spCollectCurrentStep();
    _spData.mark_reviewed = true;
    try {
        const resp = await fetch(API_ENDPOINTS.safetyPlan.save, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(_spData),
        });
        if (resp.ok) {
            const d = await resp.json();
            if (d.success) _spData = { ..._spData, ...d.plan };
        }
    } catch (_) {}
    localStorage.setItem('mindwell_safety_plan_v2', JSON.stringify(_spData));
    // Cache in service worker for offline access
    if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CACHE_SAFETY_PLAN', plan: _spData });
    }
    showNotification('Safety plan saved! ✓', 'success');
    closeSafetyPlan();
    _updateSafetyPlanCard();
}

async function _spGetSuggestions(section) {
    const area = document.getElementById('sp-suggestions-area');
    if (!area) return;
    area.innerHTML = `<div style="padding:12px;color:#6366f1;font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Getting suggestions…</div>`;
    try {
        const resp = await fetch(API_ENDPOINTS.safetyPlan.suggestions(section), { headers: getAuthHeaders() });
        const data = await resp.json();
        if (data.success && data.suggestions.length) {
            area.innerHTML = `
            <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:14px;">
                <p style="font-size:12px;font-weight:600;color:#6366f1;margin:0 0 10px;">AI suggestions — click to add:</p>
                <div style="display:flex;flex-direction:column;gap:7px;">
                    ${data.suggestions.map(s => `
                        <button onclick="_spInsertSuggestion('${section}', \`${s.replace(/`/g, "'")}\`)"
                            style="text-align:left;padding:8px 12px;border-radius:8px;border:1px solid #e0e7ff;background:#fff;color:#374151;font-size:13px;cursor:pointer;line-height:1.4;transition:background 0.15s;"
                            onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='#fff'">
                            + ${escapeHtml(s)}
                        </button>`).join('')}
                </div>
            </div>`;
        } else {
            area.innerHTML = `<p style="font-size:13px;color:#94a3b8;">Couldn't load suggestions right now.</p>`;
        }
    } catch (_) {
        area.innerHTML = `<p style="font-size:13px;color:#94a3b8;">AI suggestions unavailable offline.</p>`;
    }
}

function _spInsertSuggestion(section, text) {
    const step = SP_STEPS[_spStep];
    if (step.fields === 'contacts_support' || step.fields === 'contacts_professional') return;
    const targetField = step.fields.find(f => f.name === section) || step.fields[0];
    const el = document.getElementById(`sp-${targetField.name}`);
    if (el) {
        el.value = el.value ? el.value + '\n• ' + text : '• ' + text;
        _spAutoSave();
    }
}

function closeSafetyPlan() {
    const modal = document.getElementById('safetyPlanModal');
    if (modal) modal.remove();
}

// Legacy alias kept for old onclick refs
function saveSafetyPlan() { _spFinalSave(); }

function _spPrint() {
    _spCollectCurrentStep();
    const plan = _spData;
    const userName = document.querySelector('.profile-name')?.textContent || 'My';
    const win = window.open('', '_blank');
    const sc = (contacts) => (contacts || []).map(c =>
        `<tr><td>${c.name||''}</td><td>${c.phone||''}</td><td>${c.role||c.relationship||''}</td></tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>${userName}'s Safety Plan</title>
    <style>
        body{font-family:Arial,sans-serif;max-width:750px;margin:40px auto;color:#0f172a;line-height:1.6;font-size:14px;}
        h1{color:#6366f1;font-size:22px;border-bottom:2px solid #6366f1;padding-bottom:8px;}
        h2{font-size:15px;color:#374151;margin-top:24px;margin-bottom:6px;}
        p,pre{white-space:pre-wrap;background:#f8fafc;padding:10px 14px;border-radius:6px;border-left:3px solid #6366f1;margin:0;}
        table{width:100%;border-collapse:collapse;margin:8px 0;}
        td{padding:7px 10px;border:1px solid #e2e8f0;font-size:13px;}
        tr:nth-child(even) td{background:#f8fafc;}
        .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;}
        @media print{body{margin:20px;}}
    </style></head><body>
    <h1>🛡️ ${userName}'s Personal Safety Plan</h1>
    <p style="background:none;border:none;padding:0;color:#64748b;font-size:12px;">Created with MindWell · ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>

    <h2>🔍 Warning Signs — Personal</h2><p>${escapeHtml(plan.warning_signs_personal||'Not filled')}</p>
    <h2>👁️ Warning Signs — Observable</h2><p>${escapeHtml(plan.warning_signs_observable||'Not filled')}</p>
    <h2>🧘 Coping Strategies</h2><p>${escapeHtml(plan.coping_strategies||'Not filled')}</p>
    <h2>🤝 Social Support Contacts</h2>
    <table><tr style="background:#f1f5f9;"><td><b>Name</b></td><td><b>Phone</b></td><td><b>Relationship</b></td></tr>${sc(plan.support_contacts)}</table>
    <h2>🏥 Professional Contacts</h2>
    <table><tr style="background:#f1f5f9;"><td><b>Name</b></td><td><b>Phone</b></td><td><b>Role</b></td></tr>${sc(plan.professional_contacts)}</table>
    <h2>🏠 Safe Environment Steps</h2><p>${escapeHtml(plan.environment_safety||'Not filled')}</p>
    <h2>💛 Reasons for Living</h2><p>${escapeHtml(plan.reasons_for_living||'Not filled')}</p>

    <div class="footer">MindWell Safety Plan · Keep a copy in your phone and share with your therapist.</div>
    </body></html>`);
    win.document.close();
    win.print();
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
                            <a href="tel:9152987821" class="btn btn-danger">iCall: 9152987821</a>
                            <a href="tel:112" class="btn btn-warning">Emergency: 112</a>
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
    // Pull professional contacts from saved safety plan
    const stored = JSON.parse(localStorage.getItem('mindwell_safety_plan_v2') || '{}');
    const profContacts = (stored.professional_contacts || []).filter(c => c.name || c.phone);
    const suppContacts = (stored.support_contacts || []).filter(c => c.name || c.phone);

    const myContactsHtml = (profContacts.length + suppContacts.length) > 0 ? `
        <div class="contact-section">
            <h3>👤 From Your Safety Plan</h3>
            ${[...suppContacts, ...profContacts].map(c => `
            <div class="contact-item">
                <h4>${escapeHtml(c.name)}</h4>
                ${c.phone ? `<a href="tel:${c.phone}" class="contact-number">${escapeHtml(c.phone)}</a>` : ''}
                <p>${escapeHtml(c.role || c.relationship || '')}</p>
            </div>`).join('')}
        </div>` : `
        <div class="contact-section" style="background:#fffbeb;border-radius:10px;padding:12px 14px;margin-bottom:4px;">
            <p style="font-size:13px;color:#78350f;margin:0;">
                <i class="fas fa-lightbulb"></i>
                Add personal contacts to your <button onclick="createSafetyPlan();closeEmergencyContacts();" style="background:none;border:none;color:#6366f1;font-weight:600;cursor:pointer;font-size:13px;padding:0;">Safety Plan</button> — they'll appear here.
            </p>
        </div>`;

    const contactsHtml = `
        <div id="emergencyContacts" class="modal show" style="display:flex;">
            <div class="modal-content" style="max-width:500px;max-height:85vh;overflow-y:auto;">
                <div class="modal-header">
                    <h2>Emergency Contacts</h2>
                    <span class="close" onclick="closeEmergencyContacts()">&times;</span>
                </div>
                <div class="contacts-content">
                    ${myContactsHtml}
                    <div class="contact-section">
                        <h3>🚨 Crisis Helplines — India</h3>
                        <div class="contact-item">
                            <h4>iCall India</h4>
                            <a href="tel:9152987821" class="contact-number">9152987821</a>
                            <p>Free counselling · Mon–Sat 8am–10pm</p>
                        </div>
                        <div class="contact-item">
                            <h4>Vandrevala Foundation</h4>
                            <a href="tel:18602662345" class="contact-number">1860-2662-345</a>
                            <p>Free mental health support · 24/7</p>
                        </div>
                        <div class="contact-item">
                            <h4>AASRA</h4>
                            <a href="tel:9820466627" class="contact-number">9820466627</a>
                            <p>Suicide prevention · 24/7</p>
                        </div>
                        <div class="contact-item">
                            <h4>Snehi India</h4>
                            <a href="tel:04424640050" class="contact-number">044-24640050</a>
                            <p>Emotional support · Mon–Sat</p>
                        </div>
                        <div class="contact-item">
                            <h4>Emergency Services</h4>
                            <a href="tel:112" class="contact-number">112</a>
                            <p>All emergencies · 24/7</p>
                        </div>
                    </div>
                    <div class="contact-section">
                        <h3>💬 Online Support</h3>
                        <div class="contact-item">
                            <h4>Crisis Chat</h4>
                            <button onclick="startCrisisChat();closeEmergencyContacts();" class="btn btn-primary btn-sm">Start Chat</button>
                            <p>Anonymous AI-assisted crisis support</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', contactsHtml);
}

function closeEmergencyContacts() {
    const modal = document.getElementById('emergencyContacts');
    if (modal) modal.remove();
}

// ── Safety Plan Card Updater ──────────────────────────────────────────────────

async function _updateSafetyPlanCard() {
    let plan = null;
    try {
        const resp = await fetch(API_ENDPOINTS.safetyPlan.get, { headers: getAuthHeaders() });
        if (resp.ok) { const d = await resp.json(); if (d.success) plan = d.plan; }
    } catch (_) {
        const stored = localStorage.getItem('mindwell_safety_plan_v2');
        if (stored) plan = JSON.parse(stored);
    }
    if (!plan) return;

    const pct = plan.completion_pct ?? _spCompletionPct.call({ _spData: plan });
    const statusEl  = document.getElementById('safetyPlanStatus');
    const barEl     = document.getElementById('safetyPlanBar');
    const pctEl     = document.getElementById('safetyPlanPct');
    const btnEl     = document.getElementById('safetyPlanBtn');

    if (statusEl && pct > 0) {
        statusEl.style.display = 'block';
        if (barEl)  barEl.style.width  = pct + '%';
        if (pctEl)  pctEl.textContent  = pct + '%';
    }
    if (btnEl && pct > 0) {
        btnEl.innerHTML = '<i class="fas fa-edit"></i> View / Edit Safety Plan';
    }

    // Cache for SOS mode + wallet card
    localStorage.setItem('mindwell_safety_plan_v2', JSON.stringify(plan));
    _renderWalletCard(plan);
}

// ── Mini Wallet Card ──────────────────────────────────────────────────────────

function _renderWalletCard(plan) {
    const container = document.getElementById('walletCardContainer');
    if (!container) return;

    const coping = (plan.coping_strategies || '').split('\n').filter(Boolean).slice(0, 3);
    const contacts = [...(plan.support_contacts || []), ...(plan.professional_contacts || [])]
        .filter(c => c.name).slice(0, 2);
    const reasons = (plan.reasons_for_living || '').split('\n').filter(Boolean).slice(0, 2);

    if (!coping.length && !contacts.length && !reasons.length) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;padding:16px 18px;color:#fff;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
        <div style="position:absolute;bottom:-30px;left:40px;width:100px;height:100px;background:rgba(255,255,255,0.06);border-radius:50%;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;position:relative;">
            <div style="display:flex;align-items:center;gap:8px;">
                <i class="fas fa-shield-alt" style="font-size:15px;opacity:0.9;"></i>
                <span style="font-size:13px;font-weight:700;letter-spacing:0.02em;">My Safety Card</span>
            </div>
            <button onclick="createSafetyPlan()" style="background:rgba(255,255,255,0.2);border:none;border-radius:8px;padding:4px 10px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">Edit</button>
        </div>
        ${coping.length ? `
        <div style="margin-bottom:10px;position:relative;">
            <p style="font-size:10px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px;">When I'm struggling</p>
            ${coping.map(c => `<p style="font-size:12.5px;margin:0 0 3px;opacity:0.95;">• ${escapeHtml(c.replace(/^[•\-\d\.]+\s*/,''))}</p>`).join('')}
        </div>` : ''}
        ${contacts.length ? `
        <div style="margin-bottom:10px;position:relative;">
            <p style="font-size:10px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px;">I can call</p>
            ${contacts.map(c => `
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:12.5px;opacity:0.95;">${escapeHtml(c.name)}</span>
                ${c.phone ? `<a href="tel:${c.phone}" style="color:#fff;font-size:12px;font-weight:600;text-decoration:none;background:rgba(255,255,255,0.15);padding:2px 8px;border-radius:6px;">${escapeHtml(c.phone)}</a>` : ''}
            </div>`).join('')}
        </div>` : ''}
        ${reasons.length ? `
        <div style="position:relative;">
            <p style="font-size:10px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px;">I'm doing this for</p>
            ${reasons.map(r => `<p style="font-size:12.5px;margin:0 0 2px;opacity:0.95;">💛 ${escapeHtml(r.replace(/^[•\-\d\.]+\s*/,''))}</p>`).join('')}
        </div>` : ''}
    </div>`;
}

// ── SOS Crisis Mode ───────────────────────────────────────────────────────────

function openSosMode() {
    const overlay = document.getElementById('sosOverlay');
    if (!overlay) return;

    const plan = JSON.parse(localStorage.getItem('mindwell_safety_plan_v2') || '{}');
    const coping   = (plan.coping_strategies || '').split('\n').filter(Boolean);
    const contacts = [...(plan.support_contacts || []), ...(plan.professional_contacts || [])].filter(c => c.name);
    const reasons  = (plan.reasons_for_living || '').split('\n').filter(Boolean);
    const hasPlan  = coping.length || contacts.length || reasons.length;

    overlay.style.cssText = 'display:flex;position:fixed;inset:0;z-index:20000;background:rgba(15,23,42,0.97);align-items:center;justify-content:center;flex-direction:column;padding:24px;overflow-y:auto;';

    overlay.innerHTML = `
    <div style="max-width:520px;width:100%;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🛡️</div>
        <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;">You are not alone</h2>
        <p style="color:#94a3b8;font-size:15px;margin:0 0 28px;line-height:1.6;">Take a breath. You've got through hard moments before.<br>Let's go through your plan together.</p>

        <!-- Immediate action -->
        <div style="background:#dc2626;border-radius:14px;padding:16px;margin-bottom:16px;">
            <p style="color:#fff;font-size:13px;font-weight:600;margin:0 0 10px;">If you're in immediate danger</p>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <a href="tel:112" style="background:#fff;color:#dc2626;padding:10px 20px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">📞 Call 112</a>
                <a href="tel:9152987821" style="background:rgba(255,255,255,0.15);color:#fff;padding:10px 20px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">iCall 9152987821</a>
            </div>
        </div>

        ${hasPlan ? `
        <!-- Coping strategies -->
        ${coping.length ? `
        <div style="background:#1e293b;border-radius:14px;padding:18px;margin-bottom:12px;text-align:left;">
            <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;">Try one of these right now</p>
            ${coping.slice(0,4).map(c => `
            <div style="background:#0f172a;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">🧘</span>
                <span style="color:#e2e8f0;font-size:14px;line-height:1.4;">${escapeHtml(c.replace(/^[•\-\d\.]+\s*/,''))}</span>
            </div>`).join('')}
        </div>` : ''}

        <!-- Contacts -->
        ${contacts.length ? `
        <div style="background:#1e293b;border-radius:14px;padding:18px;margin-bottom:12px;text-align:left;">
            <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;">Reach out to someone</p>
            ${contacts.slice(0,3).map(c => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #0f172a;">
                <div>
                    <p style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0;">${escapeHtml(c.name)}</p>
                    <p style="color:#64748b;font-size:12px;margin:0;">${escapeHtml(c.role||c.relationship||'')}</p>
                </div>
                ${c.phone ? `<a href="tel:${c.phone}" style="background:#6366f1;color:#fff;padding:8px 14px;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none;">Call</a>` : ''}
            </div>`).join('')}
        </div>` : ''}

        <!-- Reasons for living -->
        ${reasons.length ? `
        <div style="background:#1e293b;border-radius:14px;padding:18px;margin-bottom:12px;text-align:left;">
            <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;">Remember why you're here</p>
            ${reasons.slice(0,4).map(r => `
            <p style="color:#e2e8f0;font-size:14px;margin:0 0 7px;line-height:1.5;">💛 ${escapeHtml(r.replace(/^[•\-\d\.]+\s*/,''))}</p>`).join('')}
        </div>` : ''}
        ` : `
        <div style="background:#1e293b;border-radius:14px;padding:20px;margin-bottom:16px;">
            <p style="color:#e2e8f0;font-size:14px;line-height:1.6;margin:0 0 14px;">You haven't set up a safety plan yet. Creating one now takes just a few minutes and gives you a personalised guide for moments like this.</p>
            <button onclick="closeSosMode();createSafetyPlan();" style="background:#6366f1;color:#fff;border:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;width:100%;">Create my safety plan →</button>
        </div>`}

        <!-- Chat support -->
        <button onclick="closeSosMode();startCrisisChat();" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:13px;color:#e2e8f0;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:12px;">
            💬 Talk to AI support chat
        </button>

        <button onclick="closeSosMode()" style="background:transparent;border:1px solid #334155;border-radius:12px;padding:11px 20px;color:#64748b;font-size:14px;cursor:pointer;width:100%;">
            I'm feeling a little better — close
        </button>
    </div>`;
}

function closeSosMode() {
    const overlay = document.getElementById('sosOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ── Mood-triggered nudge ──────────────────────────────────────────────────────

function _checkMoodForSafetyNudge(moodScore) {
    if (moodScore > 2) return;
    const nudge = document.getElementById('safetyPlanNudge');
    if (!nudge) return;
    // Don't show if dismissed in last 4 hours
    const lastShown = parseInt(localStorage.getItem('sp_nudge_ts') || '0');
    if (Date.now() - lastShown < 4 * 3600 * 1000) return;
    localStorage.setItem('sp_nudge_ts', Date.now());
    nudge.style.display = 'block';
    setTimeout(() => { nudge.style.display = 'none'; }, 20000);
}

// ── Coping Effectiveness Tracker ─────────────────────────────────────────────

function trackCopingStrategy(strategy, rating) {
    const stored = JSON.parse(localStorage.getItem('mindwell_safety_plan_v2') || '{}');
    const effectiveness = stored.coping_effectiveness || [];
    const existing = effectiveness.find(e => e.strategy === strategy);
    if (existing) {
        existing.tried_count = (existing.tried_count || 0) + 1;
        existing.avg_rating  = ((existing.avg_rating || rating) + rating) / 2;
    } else {
        effectiveness.push({ strategy, tried_count: 1, avg_rating: rating });
    }
    stored.coping_effectiveness = effectiveness;
    localStorage.setItem('mindwell_safety_plan_v2', JSON.stringify(stored));
    // Sync to backend silently
    fetch(API_ENDPOINTS.safetyPlan.save, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ coping_effectiveness: effectiveness }),
    }).catch(() => {});
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
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.entries)) {
                const deletedDates = getDeletedJournalDates();
                const filtered = data.entries.filter(e =>
                    !deletedDates.includes((e.date || '').substring(0, 10))
                );
                const key = getUserSpecificKey('mindwell_journal_entries');
                localStorage.setItem(key, JSON.stringify(filtered));
                if (!filtered.length) initializeJournal();
            } else {
                initializeJournal();
            }
        }
    } catch (error) {
        console.error('Failed to load journal data from backend:', error);
        initializeJournal();
    }
}

// Load goals data from backend  
async function loadGoalsDataFromBackend() {
    try {
        const response = await fetch(API_ENDPOINTS.goals.list, {
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const goalsKey = getUserSpecificKey('mindwell_goals');
                localStorage.setItem(goalsKey, JSON.stringify(data.goals));
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
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
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
                date: localDateStr(new Date(Date.now() + 86400000)),
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

    if (!posts || posts.length === 0) {
        postsFeed.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:24px;">No posts yet. Be the first to share!</p>';
        return;
    }

    posts.slice(0, 50).forEach(post => {
        postsFeed.appendChild(buildPostCard(post));
    });
}

function buildPostCard(post) {
    const authorName = post.author || 'Anonymous';
    const avatarColor = post.is_anonymous ? '94a3b8' : '6366f1';
    const likeCount = post.like_count ?? post.likes ?? 0;
    const isLiked = post.is_liked || false;
    const category = post.category || post.category_key || 'General Support';
    const timestamp = post.created_at || post.timestamp || new Date().toISOString();

    const card = document.createElement('div');
    card.className = 'post-card';
    card.setAttribute('data-post-id', post.id);
    card.innerHTML = `
        <div class="post-header">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=${avatarColor}&color=fff" alt="${escapeHtml(authorName)}" class="post-avatar">
            <div class="post-meta">
                <h4>${escapeHtml(authorName)}</h4>
                <span>${getTimeAgo(timestamp)} · ${escapeHtml(category)}</span>
            </div>
        </div>
        <div class="post-content">
            <p>${escapeHtml(post.content)}</p>
        </div>
        <div class="post-actions">
            <button class="post-btn like-btn${isLiked ? ' liked' : ''}" onclick="likePost(${post.id})">
                <i class="fas fa-heart"></i> ${likeCount}
            </button>
            <button class="post-btn" onclick="commentOnPost(${post.id})">
                <i class="fas fa-comment"></i> 0
            </button>
            <button class="post-btn"><i class="fas fa-share"></i> Share</button>
        </div>
    `;
    return card;
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
    if (!dateString) return '';
    // For date-only strings (YYYY-MM-DD), parse as local noon to avoid timezone shift
    const s = String(dateString);
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        date = new Date(y, m - 1, d, 12);
    } else {
        date = new Date(s);
    }
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
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
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('isDemoAccount');
    localStorage.removeItem('userMode');
    localStorage.removeItem('authToken');
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
        email: 'admin@mindwell.com'
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
    
    // Set demo authentication data in localStorage to prevent logout loop
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(currentUser));
    localStorage.setItem('loginTime', Date.now().toString());
    
    updateUserProfile();
    
    // Create comprehensive demo data with user-specific keys
    const demoMoodData = [
        {
            date: localDateStr(new Date(Date.now() - 6*86400000)),
            mood: 'neutral',
            score: 6,
            note: '',
            factors: ['Sleep']
        },
        {
            date: localDateStr(new Date(Date.now() - 5*86400000)),
            mood: 'good',
            score: 8,
            note: 'Had a good therapy session',
            factors: ['Therapy', 'Exercise']
        },
        {
            date: localDateStr(new Date(Date.now() - 4*86400000)),
            mood: 'sad',
            score: 4,
            note: 'Feeling stressed about work',
            factors: ['Work', 'Stress']
        },
        {
            date: localDateStr(new Date(Date.now() - 3*86400000)),
            mood: 'neutral',
            score: 6,
            note: '',
            factors: ['Sleep']
        },
        {
            date: localDateStr(new Date(Date.now() - 2*86400000)),
            mood: 'good',
            score: 8,
            note: 'Meditation helped a lot',
            factors: ['Meditation', 'Exercise']
        },
        {
            date: localDateStr(new Date(Date.now() - 86400000)),
            mood: 'very-good',
            score: 10,
            note: 'Great day with friends',
            factors: ['Social', 'Exercise']
        },
        {
            date: localDateStr(),
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
            startDate: localDateStr(),
            endDate: localDateStr(new Date(Date.now() + 30*86400000)),
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
            date: localDateStr(new Date(Date.now() - 86400000)),
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
                ...getAuthHeaders()
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
window.logout = logout;
window.saveMood = saveMood;
window.startMeditation = startMeditation;
window.startBreathing = startBreathing;
window.showBookingModal = showBookingModal;

// ── Coping Technique Modals ───────────────────────────────────────────────────

// ─── Box Breathing Modal ──────────────────────────────────────────────────────
let _bbRunning = false;
let _bbPhase = 'inhale';
let _bbCycles = 0;
let _bbTimer = null;
let _bbCountdownTimer = null;

const BB_PHASES = [
    { key: 'inhale',  label: 'Inhale',  duration: 4, instruction: 'Breathe in slowly through your nose...',       color: '#6366f1', scale: 1.35 },
    { key: 'hold1',   label: 'Hold',    duration: 4, instruction: 'Hold your breath gently...',                   color: '#8b5cf6', scale: 1.35 },
    { key: 'exhale',  label: 'Exhale',  duration: 4, instruction: 'Breathe out slowly through your mouth...',     color: '#06b6d4', scale: 1.0  },
    { key: 'hold2',   label: 'Hold',    duration: 4, instruction: 'Hold — lungs empty, stay still...',            color: '#0ea5e9', scale: 1.0  },
];
let _bbPhaseIdx = 0;

function openBoxBreathingModal() {
    _openModal('boxBreathingModal');
    _bbReset();
}
function closeBoxBreathingModal() {
    _bbStop();
    _closeModal('boxBreathingModal');
}
function _bbReset() {
    _bbStop();
    _bbCycles = 0;
    _bbPhaseIdx = 0;
    _bbRunning = false;
    const circle = document.getElementById('bbCircle');
    const ring   = document.getElementById('bbRing');
    if (circle) { circle.style.transform = 'scale(1)'; circle.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)'; }
    if (ring)   { ring.style.animation = 'none'; }
    _setText('bbPhaseLabel', 'Ready');
    _setText('bbCountdown', '');
    _setText('bbInstruction', 'Press Start to begin your session');
    _setText('bbCycleCount', 'Cycles: 0');
    _setText('bbStartBtn', '▶ Start');
}
function _bbStop() {
    clearTimeout(_bbTimer);
    clearTimeout(_bbCountdownTimer);
    _bbRunning = false;
}
function toggleBoxBreathing() {
    if (_bbRunning) {
        _bbStop();
        _setText('bbStartBtn', '▶ Resume');
        _setText('bbInstruction', 'Paused — press Resume whenever you\'re ready.');
    } else {
        _bbRunning = true;
        _setText('bbStartBtn', '⏸ Pause');
        _bbRunPhase();
    }
}
function _bbRunPhase() {
    if (!_bbRunning) return;
    const phase = BB_PHASES[_bbPhaseIdx];
    const circle = document.getElementById('bbCircle');
    const ring   = document.getElementById('bbRing');

    _setText('bbPhaseLabel', phase.label);
    _setText('bbInstruction', phase.instruction);
    if (circle) {
        circle.style.transition = `transform ${phase.duration * 0.9}s ease-in-out`;
        circle.style.transform  = `scale(${phase.scale})`;
        circle.style.background = `linear-gradient(135deg,${phase.color},${phase.color}cc)`;
    }
    if (ring) {
        ring.style.animation = 'none';
        void ring.offsetWidth; // reflow
        ring.style.animation = `bbRingPulse ${phase.duration}s linear forwards`;
        ring.style.borderColor = phase.color;
    }

    let remaining = phase.duration;
    _setText('bbCountdown', remaining);
    const tick = () => {
        remaining -= 1;
        if (remaining > 0) {
            _setText('bbCountdown', remaining);
            _bbCountdownTimer = setTimeout(tick, 1000);
        } else {
            _setText('bbCountdown', '');
        }
    };
    _bbCountdownTimer = setTimeout(tick, 1000);

    _bbTimer = setTimeout(() => {
        if (!_bbRunning) return;
        _bbPhaseIdx = (_bbPhaseIdx + 1) % BB_PHASES.length;
        if (_bbPhaseIdx === 0) {
            _bbCycles++;
            _setText('bbCycleCount', `Cycles: ${_bbCycles}`);
        }
        _bbRunPhase();
    }, phase.duration * 1000);
}

// ─── 5-4-3-2-1 Grounding Modal ────────────────────────────────────────────────
const GROUNDING_STEPS = [
    { num: 5, sense: 'SEE',   icon: 'fa-eye',        prompt: 'Look around and name 5 things you can see right now. Take your time with each one.' },
    { num: 4, sense: 'FEEL',  icon: 'fa-hand-paper', prompt: 'Notice 4 things you can physically feel — your feet on the floor, your clothes on your skin...' },
    { num: 3, sense: 'HEAR',  icon: 'fa-ear-listen', prompt: 'Listen carefully and identify 3 sounds around you. Near or far, obvious or subtle.' },
    { num: 2, sense: 'SMELL', icon: 'fa-nose',       prompt: 'Notice 2 things you can smell. If you can\'t smell anything, think of 2 favourite scents.' },
    { num: 1, sense: 'TASTE', icon: 'fa-utensils',   prompt: 'Bring your awareness to 1 thing you can taste, or simply notice the inside of your mouth.' },
];
let _groundingStep = 0;

function openGroundingModal() {
    _groundingStep = 0;
    _openModal('groundingModal');
    _renderGroundingStep();
}
function closeGroundingModal() {
    _closeModal('groundingModal');
}
function _renderGroundingStep() {
    const s = GROUNDING_STEPS[_groundingStep];
    _setText('groundingNum', s.num);
    document.getElementById('groundingSenseIcon').innerHTML = `<i class="fas ${s.icon}"></i>`;
    _setText('groundingStepTitle', `Things you can ${s.sense}`);
    _setText('groundingStepDesc', s.prompt);

    // Dots
    const dots = document.getElementById('groundingDots');
    if (dots) {
        dots.innerHTML = GROUNDING_STEPS.map((_, i) =>
            `<span class="g-dot${i === _groundingStep ? ' active' : ''}"></span>`
        ).join('');
    }

    // Buttons
    const prev = document.getElementById('groundingPrevBtn');
    const next = document.getElementById('groundingNextBtn');
    if (prev) prev.style.display = _groundingStep > 0 ? 'inline-flex' : 'none';
    if (next) {
        if (_groundingStep === GROUNDING_STEPS.length - 1) {
            next.textContent = '✓ Finish';
            next.onclick = _groundingFinish;
        } else {
            next.textContent = 'Next →';
            next.onclick = groundingNext;
        }
    }
}
function groundingNext() {
    if (_groundingStep < GROUNDING_STEPS.length - 1) {
        _groundingStep++;
        _renderGroundingStep();
    }
}
function groundingPrev() {
    if (_groundingStep > 0) {
        _groundingStep--;
        _renderGroundingStep();
    }
}
function _groundingFinish() {
    const display = document.querySelector('#groundingModal .grounding-step-display');
    if (display) {
        display.innerHTML = `
            <div style="text-align:center;padding:24px 0;">
                <div style="font-size:48px;margin-bottom:12px;">🌿</div>
                <h3 style="color:var(--primary-color);margin-bottom:8px;">Well done!</h3>
                <p style="color:var(--gray-600);">You've completed the grounding exercise.<br>Take a moment to notice how you feel right now.</p>
            </div>`;
        document.getElementById('groundingNextBtn').style.display = 'none';
        document.getElementById('groundingPrevBtn').style.display = 'none';
        document.getElementById('groundingDots').style.display = 'none';
    }
}

// ─── Ice Cube Timer ───────────────────────────────────────────────────────────
let _iceRunning = false;
let _iceSeconds = 30;
let _iceInterval = null;

function openIceCubeModal() {
    _iceStop();
    _iceSeconds = 30;
    _setText('iceTimerDisplay', '0:30');
    _setText('iceTimerBtn', '▶ Start Timer');
    _openModal('iceCubeModal');
}
function closeIceCubeModal() {
    _iceStop();
    _closeModal('iceCubeModal');
}
function _iceStop() {
    clearInterval(_iceInterval);
    _iceRunning = false;
}
function toggleIceTimer() {
    if (_iceRunning) {
        _iceStop();
        _setText('iceTimerBtn', '▶ Resume');
    } else {
        if (_iceSeconds <= 0) { _iceSeconds = 30; }
        _iceRunning = true;
        _setText('iceTimerBtn', '⏸ Pause');
        _iceInterval = setInterval(() => {
            _iceSeconds--;
            const m = Math.floor(_iceSeconds / 60);
            const s = _iceSeconds % 60;
            _setText('iceTimerDisplay', `${m}:${s.toString().padStart(2, '0')}`);
            if (_iceSeconds <= 0) {
                _iceStop();
                _setText('iceTimerDisplay', '✓ Done');
                _setText('iceTimerBtn', '↺ Again');
            }
        }, 1000);
    }
}

// Shared helper
function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
// Modal open/close — toggles body class so position:fixed escapes the
// stacking context created by .dashboard-body's overflow:hidden
function _openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'flex';
    document.body.classList.add('coping-modal-open');
    // Close on Escape
    const onKey = (e) => { if (e.key === 'Escape') { el.click(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
}
function _closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
    // Only remove class if no other modals are open
    const anyOpen = document.querySelectorAll('.coping-modal[style*="flex"]').length > 0;
    if (!anyOpen) document.body.classList.remove('coping-modal-open');
}
window.createNewGoal = createNewGoal;
window.startCrisisChat = startCrisisChat;
window.createSafetyPlan = createSafetyPlan;
window.viewCopingStrategies = viewCopingStrategies;
window.contactSupports = contactSupports;
window.saveJournalEntry = saveJournalEntry;
window.editJournalEntry = editJournalEntry;
window.viewJournalEntry = viewJournalEntry;
window.deleteJournalEntry = deleteJournalEntry;
window.unmarkJournalDateDeleted = unmarkJournalDateDeleted;
window.toggleJournalTag = toggleJournalTag;
window.analyseEntryWithAI = analyseEntryWithAI;
window.updateGoalProgress = updateGoalProgress;
window.markGoalComplete = markGoalComplete;
window.addSuggestedGoal = addSuggestedGoal;
window.requestGoalReminders = requestGoalReminders;
// Coping technique modals
window.openBoxBreathingModal = openBoxBreathingModal;
window.closeBoxBreathingModal = closeBoxBreathingModal;
window.toggleBoxBreathing = toggleBoxBreathing;
window.openGroundingModal = openGroundingModal;
window.closeGroundingModal = closeGroundingModal;
window.groundingNext = groundingNext;
window.groundingPrev = groundingPrev;
window.openIceCubeModal = openIceCubeModal;
window.closeIceCubeModal = closeIceCubeModal;
window.toggleIceTimer = toggleIceTimer;

// ── Notification bell helpers ─────────────────────────────────────────────────
window.toggleNotifPanel = function() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) refreshNotifPanel();
};

window.enablePushFromBell = async function() {
    await subscribeToPush();
    await requestGoalReminders();
    refreshNotifPanel();
};

window.disablePushFromBell = async function() {
    if (!_swRegistration && 'serviceWorker' in navigator) {
        _swRegistration = await navigator.serviceWorker.ready;
    }
    if (!_swRegistration) return;
    const sub = await _swRegistration.pushManager.getSubscription();
    if (sub) {
        // Tell backend to remove subscription
        try {
            await fetch(`${API_BASE_URL}/users/push/unsubscribe/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ endpoint: sub.endpoint })
            });
        } catch { /* best effort */ }
        await sub.unsubscribe();
    }
    refreshNotifPanel();
    showNotification('Goal reminders disabled.', 'info');
};

function refreshNotifPanel() {
    const list = document.getElementById('notifList');
    if (!list) return;
    const goalsKey = getUserSpecificKey('mindwell_goals');
    const goals    = JSON.parse(localStorage.getItem(goalsKey) || '[]');
    const today    = new Date();
    const items    = [];

    goals.forEach(g => {
        if (!g.reminders && !g.reminders === undefined) return;
        const end      = g.endDate || g.end_date;
        const daysLeft = end ? Math.ceil((new Date(end) - today) / 86400000) : null;
        const pct      = g.target_value ? Math.round(((g.current_value || 0) / g.target_value) * 100) : 0;
        let icon = '💪', color = '#4facfe', msg = `${pct}% complete`;

        if (daysLeft !== null && daysLeft < 0)    { icon = '⚠️'; color = '#ef4444'; msg = `Overdue by ${Math.abs(daysLeft)}d`; }
        else if (daysLeft !== null && daysLeft <= 3) { icon = '⏰'; color = '#f59e0b'; msg = `Due in ${daysLeft}d`; }

        items.push(`
            <div style="padding:12px 18px;border-bottom:1px solid #f8fafc;display:flex;gap:12px;align-items:flex-start;">
                <span style="font-size:20px;">${icon}</span>
                <div>
                    <p style="margin:0;font-size:13px;font-weight:600;color:#374151;">${g.title}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:${color};">${msg}</p>
                </div>
            </div>
        `);
    });

    list.innerHTML = items.length
        ? items.join('')
        : '<p style="text-align:center;color:#94a3b8;font-size:13px;padding:20px;">No active goal reminders</p>';

    // Show badge if any overdue/due-soon
    const badge = document.getElementById('notifBadge');
    const urgent = goals.some(g => {
        const end = g.endDate || g.end_date;
        if (!end) return false;
        return Math.ceil((new Date(end) - today) / 86400000) <= 3;
    });
    if (badge) badge.style.display = urgent ? 'block' : 'none';

    // Update Enable/Disable button based on actual subscription state
    const toggleBtn = document.getElementById('notifToggleBtn');
    if (!toggleBtn) return;
    const swReg = _swRegistration || (('serviceWorker' in navigator) ? navigator.serviceWorker.controller && navigator.serviceWorker.ready : null);
    if (!swReg) {
        toggleBtn.textContent = 'Enable';
        toggleBtn.style.background = 'linear-gradient(135deg,#4facfe,#00f2fe)';
        toggleBtn.style.color = '#fff';
        toggleBtn.onclick = window.enablePushFromBell;
        return;
    }
    Promise.resolve(swReg).then(reg => reg.pushManager.getSubscription()).then(sub => {
        if (sub) {
            toggleBtn.textContent = 'Disable';
            toggleBtn.style.background = '#f1f5f9';
            toggleBtn.style.color = '#64748b';
            toggleBtn.onclick = window.disablePushFromBell;
        } else {
            toggleBtn.textContent = 'Enable';
            toggleBtn.style.background = 'linear-gradient(135deg,#4facfe,#00f2fe)';
            toggleBtn.style.color = '#fff';
            toggleBtn.onclick = window.enablePushFromBell;
        }
    });
}

// Close panel when clicking outside
document.addEventListener('click', e => {
    const panel = document.getElementById('notifPanel');
    const bell  = document.getElementById('notifBellBtn');
    if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
        panel.style.display = 'none';
    }
});

// Attach bell button click — script is at end of body so DOM is ready
(function() {
    const bell = document.getElementById('notifBellBtn');
    if (bell) bell.addEventListener('click', function(e) {
        e.stopPropagation();
        window.toggleNotifPanel();
    });
})();
window.deleteGoal = deleteGoal;
window.closeCrisisChat = closeCrisisChat;
window.closeSafetyPlan = closeSafetyPlan;
window.closeCopingStrategies = closeCopingStrategies;
window.closeEmergencyContacts = closeEmergencyContacts;
window.closeGoalModal = closeGoalModal;
window.closeAppointmentModal = closeAppointmentModal;
window.sendChatMessage = sendChatMessage;
window.refreshUserData = refreshUserData;
window.logout = logout;
