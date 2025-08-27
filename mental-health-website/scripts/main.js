// Main JavaScript for MindWell Mental Health Website

// Global variables
let currentUser = null;
let isLoggedIn = false;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize application
function initializeApp() {
    checkLoginStatus();
    setupEventListeners();
    setupPasswordStrengthChecker();
    setupModalHandlers();
}

// Check if user is logged in
function checkLoginStatus() {
    const userData = localStorage.getItem('mindwell_user');
    if (userData) {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
        // Redirect to dashboard if already logged in
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            window.location.href = 'dashboard.html';
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Modal close buttons
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal.id);
        });
    });

    // Click outside modal to close
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });

    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Show login modal
function showLogin() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
        // Focus on email input
        setTimeout(() => {
            const emailInput = document.getElementById('loginEmail');
            if (emailInput) emailInput.focus();
        }, 100);
    }
}

// Show signup modal
function showSignup() {
    const modal = document.getElementById('signupModal');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
        // Focus on first name input
        setTimeout(() => {
            const firstNameInput = document.getElementById('firstName');
            if (firstNameInput) firstNameInput.focus();
        }, 100);
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

// Switch to signup modal from login
function switchToSignup() {
    closeModal('loginModal');
    setTimeout(() => showSignup(), 150);
}

// Switch to login modal from signup
function switchToLogin() {
    closeModal('signupModal');
    setTimeout(() => showLogin(), 150);
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const remember = formData.get('remember');

    // Validate inputs
    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    // Show loading state
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Logging in...';
    submitButton.disabled = true;

    try {
        // Simulate API call
        await simulateAPICall(1000);
        
        // Get stored user data or create demo user
        const storedUsers = JSON.parse(localStorage.getItem('mindwell_users') || '[]');
        let user = storedUsers.find(u => u.email === email);
        
        if (!user) {
            // Create demo user for testing
            user = {
                id: Date.now(),
                email: email,
                firstName: 'John',
                lastName: 'Doe',
                birthDate: '1990-01-01',
                createdAt: new Date().toISOString()
            };
            storedUsers.push(user);
            localStorage.setItem('mindwell_users', JSON.stringify(storedUsers));
        }

        // Set current user
        currentUser = user;
        isLoggedIn = true;
        
        // Store login session
        if (remember) {
            localStorage.setItem('mindwell_user', JSON.stringify(user));
        } else {
            sessionStorage.setItem('mindwell_user', JSON.stringify(user));
        }

        showNotification('Login successful! Redirecting...', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    } finally {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Handle signup form submission
async function handleSignup(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const birthDate = formData.get('birthDate');
    const terms = formData.get('terms');

    // Validate inputs
    if (!firstName || !lastName || !email || !password || !confirmPassword || !birthDate) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (!terms) {
        showNotification('Please agree to the Terms of Service', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }

    // Show loading state
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Creating Account...';
    submitButton.disabled = true;

    try {
        // Simulate API call
        await simulateAPICall(1500);
        
        // Check if user already exists
        const storedUsers = JSON.parse(localStorage.getItem('mindwell_users') || '[]');
        const existingUser = storedUsers.find(u => u.email === email);
        
        if (existingUser) {
            showNotification('An account with this email already exists', 'error');
            return;
        }

        // Create new user
        const newUser = {
            id: Date.now(),
            firstName,
            lastName,
            email,
            birthDate,
            createdAt: new Date().toISOString()
        };

        // Store user
        storedUsers.push(newUser);
        localStorage.setItem('mindwell_users', JSON.stringify(storedUsers));
        
        // Set current user
        currentUser = newUser;
        isLoggedIn = true;
        localStorage.setItem('mindwell_user', JSON.stringify(newUser));

        showNotification('Account created successfully! Redirecting...', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);

    } catch (error) {
        console.error('Signup error:', error);
        showNotification('Account creation failed. Please try again.', 'error');
    } finally {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Setup password strength checker
function setupPasswordStrengthChecker() {
    const passwordInput = document.getElementById('signupPassword');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');

    if (!passwordInput || !strengthBar || !strengthText) return;

    passwordInput.addEventListener('input', function() {
        const password = this.value;
        const strength = calculatePasswordStrength(password);
        
        // Update strength bar
        strengthBar.style.width = `${strength.percentage}%`;
        strengthBar.style.backgroundColor = strength.color;
        
        // Update strength text
        strengthText.textContent = strength.text;
        strengthText.style.color = strength.color;
    });
}

// Calculate password strength
function calculatePasswordStrength(password) {
    let score = 0;
    let feedback = [];

    if (password.length >= 8) score += 25;
    else feedback.push('at least 8 characters');

    if (/[a-z]/.test(password)) score += 25;
    else feedback.push('lowercase letters');

    if (/[A-Z]/.test(password)) score += 25;
    else feedback.push('uppercase letters');

    if (/[0-9]/.test(password)) score += 25;
    else feedback.push('numbers');

    let strength = {
        percentage: score,
        text: 'Weak',
        color: '#ef4444'
    };

    if (score >= 75) {
        strength.text = 'Strong';
        strength.color = '#10b981';
    } else if (score >= 50) {
        strength.text = 'Medium';
        strength.color = '#f59e0b';
    } else if (score >= 25) {
        strength.text = 'Fair';
        strength.color = '#f97316';
    }

    return strength;
}

// Setup modal handlers
function setupModalHandlers() {
    // Add keyboard event listeners
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
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

    // Add animation keyframes if not already added
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .notification-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
            }
            .notification-close {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 0.25rem;
                transition: background-color 0.15s ease;
            }
            .notification-close:hover {
                background: rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);
    }

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

// Simulate API call
function simulateAPICall(delay = 1000) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Logout function
function logout() {
    localStorage.removeItem('mindwell_user');
    sessionStorage.removeItem('mindwell_user');
    currentUser = null;
    isLoggedIn = false;
    window.location.href = 'index.html';
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return formatDate(dateString);
}

// Export functions for use in other scripts
window.MindWell = {
    showLogin,
    showSignup,
    closeModal,
    switchToLogin,
    switchToSignup,
    logout,
    showNotification,
    formatDate,
    getTimeAgo,
    currentUser: () => currentUser,
    isLoggedIn: () => isLoggedIn
};
