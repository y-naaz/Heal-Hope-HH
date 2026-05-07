// MindWell – Main Interactive JavaScript

// Resolve backend origin.
// On localhost: always use local backend (meta tag is ignored for local dev).
// On any other host: use <meta name="api-base-url"> if present, else Render.
const _mainIsLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const _mainMetaApiUrl = document.querySelector('meta[name="api-base-url"]');
const _mainMetaVal = !_mainIsLocal && _mainMetaApiUrl && _mainMetaApiUrl.content
    ? _mainMetaApiUrl.content.replace(/\/$/, '')
    : null;
const API_BASE_URL = _mainIsLocal
    ? 'http://localhost:8000'
    : (_mainMetaVal || 'https://mindwell-backend.onrender.com');

class MindWellApp {
    constructor() {
        this.isRealMode = false; // Start in demo mode
        this.user = null;
        this.init();
    }

    init() {
        this.setupLoadingScreen();
        this.setupUserModeToggle();
        this.setupScrollAnimations();
        this.setupParticles();
        this.setupHeader();
        this.setupTestimonials();
        this.setupMoodTracker();
        this.setupModals();
        this.setupInteractiveElements();
        this.setupPerformanceOptimizations();
        this.initializeUserMode();
    }

    // Create a demo session (optionally redirect to dashboard)
    autoAuthenticate(shouldRedirect = false) {
        // Set user as authenticated with default user data
        const defaultUser = {
            id: 'demo',
            first_name: 'Demo',
            last_name: 'User',
            full_name: 'Demo User',
            email: 'demo@mindwell.com',
            username: 'demo'
        };

        // Store authentication data
        localStorage.setItem('user', JSON.stringify(defaultUser));
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('loginTime', Date.now().toString());
        localStorage.setItem('userMode', 'demo');
        localStorage.setItem('isDemoAccount', 'true');

        if (shouldRedirect) {
            createNotification('Opening dashboard in demo mode...', 'info');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 600);
        }
    }

    // User Mode Toggle System
    setupUserModeToggle() {
        // Check if user is logged in with demo account
        const isDemoAccount = localStorage.getItem('isDemoAccount') === 'true';
        const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        const savedMode = localStorage.getItem('userMode');
        
        // If user is logged in with demo account, they should be in demo mode
        if (isDemoAccount && isAuthenticated) {
            this.isRealMode = false;
            localStorage.setItem('userMode', 'demo');
        } else if (savedMode === 'real' && isAuthenticated && !isDemoAccount) {
            this.isRealMode = true;
        } else {
            this.isRealMode = false;
            localStorage.setItem('userMode', 'demo');
        }

        // Update toggle UI
        this.updateToggleUI();
        this.updateNavigationUI();

        // Add event listener for toggle
        const toggleInput = document.getElementById('userModeToggle');
        if (toggleInput) {
            toggleInput.checked = this.isRealMode;
            toggleInput.addEventListener('change', this.handleModeToggle.bind(this));
        }
    }

    handleModeToggle(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            // Switching to real mode - check if user is authenticated
            const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
            
            if (isAuthenticated) {
                this.switchToRealMode();
            } else {
                // Show login modal
                event.target.checked = false; // Reset toggle
                this.showLoginPrompt();
            }
        } else {
            // Switching to demo mode
            this.switchToDemoMode();
        }
    }

    switchToRealMode() {
        this.isRealMode = true;
        localStorage.setItem('userMode', 'real');
        this.updateNavigationUI();
        
        // Load user data
        const userData = localStorage.getItem('user');
        if (userData) {
            this.user = JSON.parse(userData);
        }
        
        createNotification('Switched to Real User Mode', 'success');
        trackEvent('Mode Switch', { mode: 'real' });
    }

    switchToDemoMode() {
        this.isRealMode = false;
        localStorage.setItem('userMode', 'demo');
        this.updateNavigationUI();
        
        createNotification('Switched to Demo Mode - Explore our features!', 'info');
        trackEvent('Mode Switch', { mode: 'demo' });
    }

    showLoginPrompt() {
        // Remove any existing instance so we never get duplicate IDs
        const existing = document.getElementById('loginPromptModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'loginPromptModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-user-lock"></i> Authentication Required</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="prompt-content">
                    <div class="prompt-icon"><i class="fas fa-lock"></i></div>
                    <h3>Access Real User Mode</h3>
                    <p>To access real user mode with your personal data and settings, please log in to your account.</p>
                    <div class="prompt-actions">
                        <button class="btn btn-primary" data-prompt-action="login">
                            <i class="fas fa-sign-in-alt"></i> Login to Account
                        </button>
                        <button class="btn btn-outline" data-prompt-action="signup">
                            <i class="fas fa-user-plus"></i> Create Account
                        </button>
                        <button class="btn btn-outline btn-small close">
                            <i class="fas fa-times"></i> Stay in Demo Mode
                        </button>
                    </div>
                </div>
            </div>
        `;

        const dismiss = () => {
            modal.remove();
            document.body.style.overflow = '';
        };

        modal.querySelector('[data-prompt-action="login"]').addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
            window.showLogin();
        });
        modal.querySelector('[data-prompt-action="signup"]').addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
            window.showSignup();
        });

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }

    updateToggleUI() {
        const toggleInput = document.getElementById('userModeToggle');
        if (toggleInput) {
            toggleInput.checked = this.isRealMode;
        }
    }

    updateNavigationUI() {
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        const demoIndicator = document.getElementById('demoIndicator');

        const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        const isDemoAccount = localStorage.getItem('isDemoAccount') === 'true';
        const isRealUser = isAuthenticated && !isDemoAccount;

        if (isRealUser) {
            // Real authenticated user — always show their info, hide login buttons
            const userData = localStorage.getItem('user');
            if (userData) {
                this.showUserInfo(JSON.parse(userData));
            }
            if (authButtons) authButtons.style.display = 'none';
            if (demoIndicator) demoIndicator.style.display = 'none';
        } else if (this.isRealMode) {
            // Real mode but not authenticated — show login/signup buttons
            if (authButtons) authButtons.style.display = 'flex';
            if (userInfo) userInfo.style.display = 'none';
            if (demoIndicator) demoIndicator.style.display = 'none';
        } else {
            // Demo mode
            if (demoIndicator) demoIndicator.style.display = 'flex';
            if (authButtons) authButtons.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';
        }
    }

    showUserInfo(user) {
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        
        if (userInfo && userName) {
            userName.textContent = user.first_name || user.full_name || 'User';
            userInfo.style.display = 'flex';
        }
    }

    initializeUserMode() {
        // Check authentication status and update UI accordingly
        this.checkAuthStatus();
    }

    // Loading Screen Animation - Fixed
    setupLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        
        // Ensure loading screen exists and hide it after a shorter delay
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.transition = 'opacity 0.8s ease-out';
                
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 800);
            }, 1000); // Reduced from 2 seconds to 1 second
        }
        
        // Fallback in case DOMContentLoaded fires late
        document.addEventListener('DOMContentLoaded', () => {
            if (loadingScreen && loadingScreen.style.display !== 'none') {
                setTimeout(() => {
                    loadingScreen.style.opacity = '0';
                    loadingScreen.style.transition = 'opacity 0.8s ease-out';
                    
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 800);
                }, 500);
            }
        });
    }


    // Advanced Scroll Animations
    setupScrollAnimations() {
        // Intersection Observer for scroll-triggered animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('scroll-revealed');
                }
            });
        }, observerOptions);

        // Observe elements with scroll animation attributes
        const animatedElements = document.querySelectorAll('[data-scroll-fade], [data-scroll-slide], [data-scroll-fade-up]');
        animatedElements.forEach(el => observer.observe(el));

        // Parallax effects
        let ticking = false;
        
        const updateParallax = () => {
            const scrollTop = window.pageYOffset;
            
            // Hero parallax elements
            const heroElements = document.querySelectorAll('.wellness-shape, .floating-shapes .shape, .hero-illustration');
            heroElements.forEach((el, index) => {
                const speed = 0.5 + (index * 0.1);
                const yPos = -(scrollTop * speed);
                el.style.transform = `translateY(${yPos}px)`;
            });

            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        });

        // Staggered animations for cards
        const cards = document.querySelectorAll('.trust-card, .need-tile, .blog-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            observer.observe(card);
        });
    }

    // Floating Particles System
    setupParticles() {
        const particlesContainer = document.querySelector('.floating-particles');
        if (!particlesContainer) return;

        // Reset particles periodically for infinite effect
        setInterval(() => {
            const particles = particlesContainer.querySelectorAll('.particle');
            particles.forEach((particle, index) => {
                setTimeout(() => {
                    particle.style.animation = 'none';
                    particle.offsetHeight; // Trigger reflow
                    particle.style.animation = `floatParticle 20s linear infinite`;
                    particle.style.animationDelay = `${index * 3}s`;
                }, Math.random() * 2000);
            });
        }, 20000);
    }

    // Dynamic Header
    setupHeader() {
        const header = document.querySelector('.header');
        let lastScrollY = window.scrollY;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }

            // Hide/show header on scroll
            if (currentScrollY > lastScrollY && currentScrollY > 200) {
                header.style.transform = 'translateY(-100%)';
            } else {
                header.style.transform = 'translateY(0)';
            }

            lastScrollY = currentScrollY;
        });

        // Smooth scroll for navigation links
        const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // Enhanced Testimonials Carousel
    setupTestimonials() {
        const testimonials = document.querySelectorAll('.testimonial');
        const dots = document.querySelectorAll('.dot');
        let currentTestimonial = 0;
        let isAnimating = false;

        const showTestimonial = (index) => {
            if (isAnimating) return;
            isAnimating = true;

            // Hide current testimonial
            testimonials[currentTestimonial].classList.remove('active');
            dots[currentTestimonial].classList.remove('active');

            // Show new testimonial
            setTimeout(() => {
                currentTestimonial = index;
                testimonials[currentTestimonial].classList.add('active');
                dots[currentTestimonial].classList.add('active');
                isAnimating = false;
            }, 300);
        };

        // Auto-advance testimonials
        const autoAdvance = () => {
            const nextIndex = (currentTestimonial + 1) % testimonials.length;
            showTestimonial(nextIndex);
        };

        let autoAdvanceInterval = setInterval(autoAdvance, 5000);

        // Navigation controls
        const nextBtn = document.querySelector('.carousel-btn.next');
        const prevBtn = document.querySelector('.carousel-btn.prev');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                clearInterval(autoAdvanceInterval);
                const nextIndex = (currentTestimonial + 1) % testimonials.length;
                showTestimonial(nextIndex);
                autoAdvanceInterval = setInterval(autoAdvance, 5000);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                clearInterval(autoAdvanceInterval);
                const prevIndex = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
                showTestimonial(prevIndex);
                autoAdvanceInterval = setInterval(autoAdvance, 5000);
            });
        }

        // Dot navigation
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                clearInterval(autoAdvanceInterval);
                showTestimonial(index);
                autoAdvanceInterval = setInterval(autoAdvance, 5000);
            });
        });

        // Touch/swipe support
        let startX = 0;
        let startY = 0;
        const carousel = document.querySelector('.testimonials-carousel');

        if (carousel) {
            carousel.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            });

            carousel.addEventListener('touchend', (e) => {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const diffX = startX - endX;
                const diffY = startY - endY;

                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                    clearInterval(autoAdvanceInterval);
                    if (diffX > 0) {
                        // Swipe left - next
                        const nextIndex = (currentTestimonial + 1) % testimonials.length;
                        showTestimonial(nextIndex);
                    } else {
                        // Swipe right - previous
                        const prevIndex = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
                        showTestimonial(prevIndex);
                    }
                    autoAdvanceInterval = setInterval(autoAdvance, 5000);
                }
            });
        }
    }

    // Interactive Mood Tracker
    setupMoodTracker() {
        const moodButtons = document.querySelectorAll('.mood-btn');
        let selectedMood = null;

        moodButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove previous selection
                moodButtons.forEach(b => b.classList.remove('selected'));
                
                // Add selection to clicked button
                btn.classList.add('selected');
                selectedMood = btn.dataset.mood;

                // Add ripple effect
                this.createRipple(btn);

                // Show feedback
                this.showMoodFeedback(selectedMood);

                // Analytics (if implemented)
                if (typeof analytics !== 'undefined') {
                    analytics.track('Mood Selected', { mood: selectedMood });
                }
            });

            // Enhanced hover effects
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-8px) scale(1.1)';
            });

            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('selected')) {
                    btn.style.transform = '';
                }
            });
        });
    }

    // Modal System
    setupModals() {
        // Close modal function (also exposed globally below)
        const closeModal = (modal) => {
            if (!modal) return;
            modal.classList.remove('active');
            document.body.style.overflow = '';
        };

        // Open modal function
        const openModal = (modalId) => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        };

        // Single delegated listener for ALL close buttons (static + dynamic)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.close');
            if (btn) {
                const modal = btn.closest('.modal');
                closeModal(modal);
            }
        });

        // Click directly on the modal backdrop (the dark overlay) to close.
        // Using e.target === the .modal element itself prevents any bubbled click
        // from a button inside one modal from accidentally closing a modal that
        // was just opened by that same click (e.g. "Login to Account" flow).
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
                closeModal(e.target);
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                closeModal(activeModal);
            }
        });

        // Expose modal functions globally
        window.showLogin = () => {
            const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
            const isDemoAccount = localStorage.getItem('isDemoAccount') === 'true';
            if (isAuthenticated && !isDemoAccount) {
                // Real user already logged in — go to dashboard
                window.location.href = 'dashboard.html';
                return;
            }
            openModal('loginModal');
        };
        window.showSignup = () => openModal('signupModal');
        window.closeModal = (modalId) => {
            const modal = document.getElementById(modalId);
            closeModal(modal);
        };
        window.quickLogin = () => this.quickLogin();

        // Setup form submission handlers
        this.setupAuthForms();
    }

    // Authentication Form Setup
    setupAuthForms() {
        // Setup login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Setup signup form  
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', this.handleSignup.bind(this));
        }

        // Check if user is already logged in
        this.checkAuthStatus();
    }

    // Handle login form submission
    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/users/auth/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password
                })
            });

            const result = await response.json();

            if (result.success) {
                createNotification('Login successful! Redirecting to dashboard...', 'success');

                // Store token + user data
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                }
                localStorage.setItem('user', JSON.stringify(result.user));
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('loginTime', Date.now().toString());
                localStorage.setItem('userMode', 'real');
                localStorage.setItem('isDemoAccount', 'false');

                // Close modal and redirect
                this.closeModal(document.getElementById('loginModal'));

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                
            } else {
                createNotification(result.message || 'Login failed. Please try again.', 'error');
                // If user not found, show the signup hint inside the modal
                const hint = document.getElementById('loginSignupHint');
                if (hint) hint.style.display = 'block';
            }

        } catch (error) {
            console.error('Login error:', error);
            createNotification('Network error. Please check your connection.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // Try demo — opens dashboard in demo mode without real credentials
    quickLogin() {
        this.autoAuthenticate(true);
    }

    // Handle signup form submission
    async handleSignup(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Validation
        if (data.password.length < 8) {
            createNotification('Password must be at least 8 characters long.', 'error');
            return;
        }
        if (/\s/.test(data.password)) {
            createNotification('Password must not contain spaces.', 'error');
            return;
        }
        if (data.password !== data.confirmPassword) {
            createNotification('Passwords do not match.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/users/auth/signup/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    password: data.password
                })
            });

            const result = await response.json();

            if (result.success) {
                createNotification('Account created successfully! Redirecting to dashboard...', 'success');

                // Store token + user data
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                }
                localStorage.setItem('user', JSON.stringify(result.user));
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('loginTime', Date.now().toString());

                // Close modal and redirect
                this.closeModal(document.getElementById('signupModal'));
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                
            } else {
                createNotification(result.message || 'Signup failed. Please try again.', 'error');
            }

        } catch (error) {
            console.error('Signup error:', error);
            createNotification('Network error. Please check your connection.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // Check authentication status
    async checkAuthStatus() {
        try {
            const token = localStorage.getItem('authToken');
            const headers = token ? { 'Authorization': `Token ${token}` } : {};
            const response = await fetch(`${API_BASE_URL}/users/auth/status/`, { headers });
            const result = await response.json();

            if (result.authenticated) {
                // User is logged in, update UI
                this.updateAuthUI(result.user);
            } else {
                // User is not logged in, clear any stale data
                localStorage.removeItem('user');
                localStorage.removeItem('isAuthenticated');
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // Fallback to local storage check
            const isAuthenticated = localStorage.getItem('isAuthenticated');
            if (isAuthenticated === 'true') {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                this.updateAuthUI(user);
            }
        }
    }

    // Update UI for authenticated users
    updateAuthUI(user) {
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons && user.full_name) {
            authButtons.innerHTML = `
                <div class="user-menu">
                    <span class="user-greeting">Hello, ${user.first_name}!</span>
                    <a href="dashboard.html" class="btn btn-primary">Dashboard</a>
                    <button class="btn btn-outline" onclick="logout()">Logout</button>
                </div>
            `;
        }
    }

    // Close modal helper
    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Interactive Elements Enhancement
    setupInteractiveElements() {
        // Enhanced card interactions
        const cards = document.querySelectorAll('.trust-card, .need-tile, .blog-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.createFloatingEffect(card);
            });
        });

        // Resource item interactions
        const resourceItems = document.querySelectorAll('.resource-item');
        resourceItems.forEach(item => {
            item.addEventListener('click', () => {
                this.createRipple(item);
                // Add download animation or functionality here
            });
        });

        // Button enhancements
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.createRipple(btn, e);
            });
        });

        // Form enhancements
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', () => {
                if (input.value === '') {
                    input.parentElement.classList.remove('focused');
                }
            });
        });
    }

    // Performance Optimizations
    setupPerformanceOptimizations() {
        // Lazy load images
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));

        // Debounced resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });

        // Preload critical resources
        this.preloadCriticalResources();
    }

    // Utility Functions
    createRipple(element, event = null) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        
        let x, y;
        if (event) {
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;
        } else {
            x = rect.width / 2;
            y = rect.height / 2;
        }

        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (x - size / 2) + 'px';
        ripple.style.top = (y - size / 2) + 'px';
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(255, 255, 255, 0.3)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s linear';
        ripple.style.pointerEvents = 'none';

        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    createFloatingEffect(element) {
        const rect = element.getBoundingClientRect();
        const floating = document.createElement('div');
        
        floating.style.position = 'absolute';
        floating.style.width = '4px';
        floating.style.height = '4px';
        floating.style.background = 'rgba(68, 85, 107, 0.55)';
        floating.style.borderRadius = '50%';
        floating.style.pointerEvents = 'none';
        floating.style.left = (rect.left + Math.random() * rect.width) + 'px';
        floating.style.top = (rect.top + rect.height) + 'px';
        floating.style.zIndex = '1000';
        floating.style.animation = 'floatUp 2s ease-out forwards';

        document.body.appendChild(floating);

        setTimeout(() => {
            floating.remove();
        }, 2000);
    }

    showMoodFeedback(mood) {
        const feedbacks = {
            great: "That's wonderful! Keep up the positive energy! 🌟",
            good: "Glad to hear you're doing well! 😊",
            okay: "It's okay to have neutral days. Take care of yourself. 💙",
            sad: "I'm sorry you're feeling down. Remember, it's okay to not be okay. 🤗",
            anxious: "Anxiety can be tough. Consider some breathing exercises. 🌸"
        };

        const feedback = feedbacks[mood] || "Thank you for sharing how you feel.";
        
        // Create toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #3e4c5c 0%, #58677a 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.5s ease;
            max-width: 300px;
            font-size: 14px;
            line-height: 1.4;
        `;
        toast.textContent = feedback;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.5s ease forwards';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    handleResize() {
        // Recalculate elements that depend on viewport size
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Adjust particle count based on screen size
        const particles = document.querySelectorAll('.particle');
        particles.forEach((particle, index) => {
            if (vw <= 480 && index > 2) {
                particle.style.display = 'none';
            } else {
                particle.style.display = 'block';
            }
        });
    }

    preloadCriticalResources() {
        // Preload key fonts
        const fontLink = document.createElement('link');
        fontLink.rel = 'preload';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&display=swap';
        fontLink.as = 'style';
        document.head.appendChild(fontLink);
    }
}

// Enhanced Functional Components
function bookSession() {
    showBookingModal();
}

function showSelfCheck() {
    showSelfAssessmentModal();
}

function navigateToService(service) {
    showServiceModal(service);
}

function downloadTools() {
    showDownloadModal();
}

function meetTeam() {
    showTeamModal();
}

function readMore() {
    showBlogModal();
}

function nextTestimonial() {
    const event = new CustomEvent('nextTestimonial');
    document.dispatchEvent(event);
}

function previousTestimonial() {
    const event = new CustomEvent('previousTestimonial');
    document.dispatchEvent(event);
}

function currentTestimonial(index) {
    const event = new CustomEvent('currentTestimonial', { detail: { index } });
    document.dispatchEvent(event);
}

// Utility notification system
function createNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        info: 'linear-gradient(135deg, #3e4c5c 0%, #58677a 100%)',
        success: 'linear-gradient(135deg, #6f8b77 0%, #8da395 100%)',
        warning: 'linear-gradient(135deg, #ad8f63 0%, #c4ab82 100%)',
        error: 'linear-gradient(135deg, #9f5e5e 0%, #b67979 100%)'
    };

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideInRight 0.5s ease;
        max-width: 300px;
        font-size: 14px;
        line-height: 1.4;
        backdrop-filter: blur(20px);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease forwards';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Additional CSS animations for notifications
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes floatUp {
        from { 
            transform: translateY(0) scale(0);
            opacity: 1;
        }
        to { 
            transform: translateY(-100px) scale(1);
            opacity: 0;
        }
    }
    
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .mood-btn.selected {
        background: linear-gradient(135deg, #3e4c5c 0%, #58677a 100%) !important;
        color: white !important;
        transform: translateY(-8px) scale(1.1) !important;
        box-shadow: 0 20px 40px rgba(68, 85, 107, 0.3) !important;
    }

    .mood-btn.selected i {
        color: white !important;
    }

    .mood-btn.selected span {
        color: white !important;
    }

    .form-group.focused label {
        color: var(--primary-color);
        transform: translateY(-2px);
        font-size: var(--font-size-sm);
    }
`;

document.head.appendChild(additionalStyles);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.mindWellApp = new MindWellApp();
});

// Handle page visibility changes for performance
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause heavy animations when tab is not visible
        document.body.classList.add('paused');
    } else {
        // Resume animations when tab becomes visible
        document.body.classList.remove('paused');
    }
});

// Add paused state styles
const pausedStyles = document.createElement('style');
pausedStyles.textContent = `
    .paused * {
        animation-play-state: paused !important;
    }
`;
document.head.appendChild(pausedStyles);

// Service Worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            console.log('SW registered: ', registration);
        }).catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}

// Advanced Modal System - Real Functionality
function showBookingModal() {
    const modalHTML = `
        <div id="bookingModal" class="modal active">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-calendar-plus"></i> Book Your Session</h2>
                    <span class="close" onclick="closeModal('bookingModal')">&times;</span>
                </div>
                <form id="bookingForm" class="booking-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="fullName">Full Name *</label>
                            <input type="text" id="fullName" name="fullName" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email Address *</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phone">Phone Number</label>
                            <input type="tel" id="phone" name="phone">
                        </div>
                        <div class="form-group">
                            <label for="sessionType">Session Type *</label>
                            <select id="sessionType" name="sessionType" required>
                                <option value="">Select session type</option>
                                <option value="individual">Individual Therapy</option>
                                <option value="couples">Couples Therapy</option>
                                <option value="family">Family Therapy</option>
                                <option value="group">Group Therapy</option>
                                <option value="consultation">Initial Consultation</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="preferredDate">Preferred Date *</label>
                            <input type="date" id="preferredDate" name="preferredDate" required>
                        </div>
                        <div class="form-group">
                            <label for="preferredTime">Preferred Time *</label>
                            <select id="preferredTime" name="preferredTime" required>
                                <option value="">Select time</option>
                                <option value="09:00">9:00 AM</option>
                                <option value="10:00">10:00 AM</option>
                                <option value="11:00">11:00 AM</option>
                                <option value="14:00">2:00 PM</option>
                                <option value="15:00">3:00 PM</option>
                                <option value="16:00">4:00 PM</option>
                                <option value="17:00">5:00 PM</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="concerns">What would you like to discuss? *</label>
                        <textarea id="concerns" name="concerns" rows="4" placeholder="Brief description of what you'd like to work on..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="sessionFormat">Session Format *</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="sessionFormat" value="online" checked>
                                <span class="radio-custom"></span>
                                Online Session
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="sessionFormat" value="in-person">
                                <span class="radio-custom"></span>
                                In-Person Session
                            </label>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">
                        <i class="fas fa-check"></i> Book Session
                    </button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('preferredDate').min = today;
    
    // Handle form submission
    document.getElementById('bookingForm').addEventListener('submit', handleBookingSubmission);
}

window.handleAssessmentCTA = function handleAssessmentCTA() {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (isAuthenticated) {
        // Already logged in — go straight to dashboard
        document.getElementById('resultsModal')?.remove();
        document.body.style.overflow = '';
        window.location.href = 'dashboard.html';
    } else {
        // Not logged in — close results and open login modal
        document.getElementById('resultsModal')?.remove();
        document.body.style.overflow = '';
        window.showLogin();
    }
}

function showSelfAssessmentModal() {
    // Remove any stale instances so getElementById always finds the fresh one
    ['assessmentModal', 'resultsModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    const questions = [
        // PHQ-9 (Depression)
        { id: 'q1',  section: 'PHQ-9', category: 'Depression', text: 'Little interest or pleasure in doing things', icon: '😔' },
        { id: 'q2',  section: 'PHQ-9', category: 'Depression', text: 'Feeling down, depressed, or hopeless', icon: '🌧️' },
        { id: 'q3',  section: 'PHQ-9', category: 'Sleep', text: 'Trouble falling or staying asleep, or sleeping too much', icon: '😴' },
        { id: 'q4',  section: 'PHQ-9', category: 'Energy', text: 'Feeling tired or having little energy', icon: '⚡' },
        { id: 'q5',  section: 'PHQ-9', category: 'Appetite', text: 'Poor appetite or overeating', icon: '🍽️' },
        { id: 'q6',  section: 'PHQ-9', category: 'Self-worth', text: 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down', icon: '💭' },
        { id: 'q7',  section: 'PHQ-9', category: 'Concentration', text: 'Trouble concentrating on things, such as reading or watching television', icon: '🧠' },
        { id: 'q8',  section: 'PHQ-9', category: 'Movement', text: 'Moving or speaking so slowly that other people could have noticed — or being so fidgety or restless that you have been moving around a lot more than usual', icon: '🐢' },
        { id: 'q9',  section: 'PHQ-9', category: 'Safety', text: 'Thoughts that you would be better off dead, or of hurting yourself in some way', icon: '🆘' },
        // GAD-7 (Anxiety)
        { id: 'q10', section: 'GAD-7', category: 'Anxiety', text: 'Feeling nervous, anxious, or on edge', icon: '😰' },
        { id: 'q11', section: 'GAD-7', category: 'Anxiety', text: 'Not being able to stop or control worrying', icon: '🌀' },
        { id: 'q12', section: 'GAD-7', category: 'Anxiety', text: 'Worrying too much about different things', icon: '🤯' },
        { id: 'q13', section: 'GAD-7', category: 'Relaxation', text: 'Trouble relaxing', icon: '🧘' },
        { id: 'q14', section: 'GAD-7', category: 'Restlessness', text: 'Being so restless that it is hard to sit still', icon: '😤' },
        { id: 'q15', section: 'GAD-7', category: 'Irritability', text: 'Becoming easily annoyed or irritable', icon: '😠' },
        { id: 'q16', section: 'GAD-7', category: 'Fear', text: 'Feeling afraid as if something awful might happen', icon: '😨' },
    ];
    const options = [
        { label: 'Not at all', value: 0 },
        { label: 'Several days', value: 1 },
        { label: 'More than half the days', value: 2 },
        { label: 'Nearly every day', value: 3 },
    ];

    const modalHTML = `
        <div id="assessmentModal" class="modal active">
            <div class="modal-content" style="max-width:620px;">
                <div class="modal-header">
                    <h2><i class="fas fa-clipboard-check"></i> Mental Health Self-Check</h2>
                    <span class="close" onclick="document.getElementById('assessmentModal')?.remove(); document.body.style.overflow='';">&times;</span>
                </div>
                <div class="assessment-content" style="padding:28px 32px;">
                    <p style="color:#64748b;font-size:14px;margin-bottom:20px;line-height:1.6;">
                        Based on the standard <strong>PHQ-9</strong> and <strong>GAD-7</strong> clinical tools.
                        Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following?
                    </p>

                    <div id="qa-progress-bar" style="background:#f1f5f9;border-radius:99px;height:6px;margin-bottom:24px;">
                        <div id="qa-progress-fill" style="height:6px;border-radius:99px;background:linear-gradient(90deg,#6366f1,#8b5cf6);width:0%;transition:width 0.4s ease;"></div>
                    </div>
                    <p id="qa-progress-label" style="text-align:right;font-size:12px;color:#94a3b8;margin-top:-18px;margin-bottom:20px;">Question 1 of 16</p>

                    <div id="qa-question-area"></div>

                    <div style="display:flex;gap:12px;margin-top:28px;">
                        <button id="qa-back-btn" class="btn btn-outline" style="display:none;flex:1;" onclick="qaNavigate(-1)">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button id="qa-next-btn" class="btn btn-primary" style="flex:2;opacity:0.4;cursor:not-allowed;" disabled onclick="qaNavigate(1)">
                            Next <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';

    let current = 0;
    const answers = {};

    function renderQuestion(idx) {
        const q = questions[idx];
        const area = document.getElementById('qa-question-area');
        const fill = document.getElementById('qa-progress-fill');
        const label = document.getElementById('qa-progress-label');
        const nextBtn = document.getElementById('qa-next-btn');
        const backBtn = document.getElementById('qa-back-btn');

        fill.style.width = `${((idx) / questions.length) * 100}%`;
        label.textContent = `Question ${idx + 1} of ${questions.length}`;
        backBtn.style.display = idx === 0 ? 'none' : 'flex';

        const isLast = idx === questions.length - 1;
        nextBtn.innerHTML = isLast
            ? '<i class="fas fa-chart-line"></i> Get My Results'
            : 'Next <i class="fas fa-arrow-right"></i>';

        const sectionColor = q.section === 'PHQ-9' ? '#6366f1' : '#0ea5e9';
        const sectionBg    = q.section === 'PHQ-9' ? '#ede9fe' : '#e0f2fe';
        area.innerHTML = `
            <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:48px;margin-bottom:10px;">${q.icon}</div>
                <div style="display:flex;justify-content:center;gap:8px;margin-bottom:4px;">
                    <span style="background:${sectionBg};color:${sectionColor};font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;letter-spacing:0.5px;">${q.section}</span>
                    <span style="background:#f1f5f9;color:#64748b;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;text-transform:uppercase;letter-spacing:0.5px;">${q.category}</span>
                </div>
                <h3 style="margin:14px 0 0;font-size:17px;color:#1e293b;line-height:1.5;">${q.text}</h3>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                ${options.map(opt => `
                    <label style="display:flex;align-items:center;gap:14px;padding:14px 18px;border:2px solid ${answers[q.id] == opt.value ? '#6366f1' : '#e2e8f0'};border-radius:12px;cursor:pointer;background:${answers[q.id] == opt.value ? '#f5f3ff' : '#fff'};transition:all 0.2s;">
                        <input type="radio" name="qa_current" value="${opt.value}" ${answers[q.id] == opt.value ? 'checked' : ''} style="accent-color:#6366f1;width:18px;height:18px;">
                        <span style="font-size:15px;color:#374151;font-weight:${answers[q.id] == opt.value ? '600' : '400'};">${opt.label}</span>
                    </label>
                `).join('')}
            </div>
        `;

        // Re-enable next if already answered
        const alreadyAnswered = answers[q.id] !== undefined;
        nextBtn.disabled = !alreadyAnswered;
        nextBtn.style.opacity = alreadyAnswered ? '1' : '0.4';
        nextBtn.style.cursor = alreadyAnswered ? 'pointer' : 'not-allowed';

        area.querySelectorAll('input[name="qa_current"]').forEach(radio => {
            radio.addEventListener('change', () => {
                answers[q.id] = parseInt(radio.value);
                nextBtn.disabled = false;
                nextBtn.style.opacity = '1';
                nextBtn.style.cursor = 'pointer';
                // Re-render to highlight selected
                renderQuestion(current);
            });
        });
    }

    window.qaNavigate = function(dir) {
        if (dir === 1 && current === questions.length - 1) {
            // Submit
            const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);
            document.getElementById('assessmentModal')?.remove();
            document.body.style.overflow = '';
            handleAssessmentSubmission({ score: totalScore, answers, questions });
            return;
        }
        current = Math.max(0, Math.min(questions.length - 1, current + dir));
        renderQuestion(current);
    };

    renderQuestion(0);
}

function showServiceModal(serviceType) {
    const services = {
        anxiety: {
            title: 'Anxiety Therapy',
            icon: 'fa-cloud-rain',
            description: 'Professional support for managing anxiety and panic disorders.',
            features: ['Cognitive Behavioral Therapy', 'Mindfulness Techniques', 'Exposure Therapy', 'Relaxation Training'],
            duration: '50 minutes',
            price: '$120 per session'
        },
        couples: {
            title: 'Couples Therapy',
            icon: 'fa-heart',
            description: 'Strengthen your relationship through guided communication and understanding.',
            features: ['Communication Skills', 'Conflict Resolution', 'Intimacy Building', 'Trust Rebuilding'],
            duration: '90 minutes',
            price: '$180 per session'
        },
        workplace: {
            title: 'Corporate Wellness',
            icon: 'fa-briefcase-medical',
            description: 'Professional support for work-related stress and burnout.',
            features: ['Stress Management', 'Work-Life Balance', 'Leadership Coaching', 'Team Dynamics'],
            duration: '60 minutes',
            price: '$150 per session'
        },
        mindfulness: {
            title: 'Mindfulness Programs',
            icon: 'fa-leaf',
            description: 'Learn mindfulness and meditation techniques for better mental well-being.',
            features: ['Meditation Training', 'Stress Reduction', 'Present Moment Awareness', 'Emotional Regulation'],
            duration: '45 minutes',
            price: '$100 per session'
        }
    };
    
    const service = services[serviceType] || services.anxiety;
    
    const modalHTML = `
        <div id="serviceModal" class="modal active">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas ${service.icon}"></i> ${service.title}</h2>
                    <span class="close" onclick="closeModal('serviceModal')">&times;</span>
                </div>
                <div class="service-content">
                    <p class="service-description">${service.description}</p>
                    
                    <div class="service-details">
                        <h3>What's Included:</h3>
                        <ul class="feature-list">
                            ${service.features.map(feature => `<li><i class="fas fa-check"></i> ${feature}</li>`).join('')}
                        </ul>
                        
                        <div class="service-info">
                            <div class="info-item">
                                <i class="fas fa-clock"></i>
                                <span>Duration: ${service.duration}</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-dollar-sign"></i>
                                <span>Investment: ${service.price}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="service-actions">
                        <button class="btn btn-primary" onclick="closeModal('serviceModal'); bookSession();">
                            <i class="fas fa-calendar-plus"></i> Book This Service
                        </button>
                        <button class="btn btn-outline" onclick="closeModal('serviceModal'); showConsultationModal();">
                            <i class="fas fa-phone"></i> Free Consultation
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

function showDownloadModal() {
    const modalHTML = `
        <div id="downloadModal" class="modal active">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-download"></i> Free Mental Health Tools</h2>
                    <span class="close" onclick="closeModal('downloadModal')">&times;</span>
                </div>
                <div class="download-content">
                    <p>Get instant access to our collection of mental health resources:</p>
                    
                    <div class="download-items">
                        <div class="download-item">
                            <i class="fas fa-headphones"></i>
                            <div>
                                <h4>Guided Meditation Audio (5 tracks)</h4>
                                <p>Professional meditation sessions for stress relief</p>
                            </div>
                        </div>
                        <div class="download-item">
                            <i class="fas fa-book-journal-whills"></i>
                            <div>
                                <h4>Stress-Relief Journal (PDF)</h4>
                                <p>30-day guided journal for tracking mental wellness</p>
                            </div>
                        </div>
                        <div class="download-item">
                            <i class="fas fa-lungs"></i>
                            <div>
                                <h4>Breathing Exercise Guide</h4>
                                <p>Interactive guide with 10 breathing techniques</p>
                            </div>
                        </div>
                    </div>
                    
                    <form id="downloadForm" class="download-form">
                        <div class="form-group">
                            <label for="downloadEmail">Email Address *</label>
                            <input type="email" id="downloadEmail" name="email" required placeholder="Enter your email to receive the tools">
                        </div>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="newsletter" value="yes">
                                <span class="checkbox-custom"></span>
                                Subscribe to our mental wellness newsletter
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary btn-full">
                            <i class="fas fa-download"></i> Download Free Tools
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
    
    document.getElementById('downloadForm').addEventListener('submit', handleDownloadSubmission);
}

function showTeamModal() {
    const modalHTML = `
        <div id="teamModal" class="modal active">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2><i class="fas fa-users"></i> Meet Our Team</h2>
                    <span class="close" onclick="closeModal('teamModal')">&times;</span>
                </div>
                <div class="team-content">
                    <div class="team-grid">
                        <div class="team-member">
                            <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face" alt="Dr. Sarah Johnson">
                            <h3>Dr. Sarah Johnson</h3>
                            <p class="title">Licensed Clinical Psychologist</p>
                            <p class="experience">12+ years experience</p>
                            <p class="specialties">Anxiety, Depression, Trauma</p>
                            <button class="btn btn-outline btn-small" onclick="bookWithTherapist('sarah')">Book with Dr. Sarah</button>
                        </div>
                        
                        <div class="team-member">
                            <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face" alt="Dr. Michael Chen">
                            <h3>Dr. Michael Chen</h3>
                            <p class="title">Licensed Marriage Therapist</p>
                            <p class="experience">8+ years experience</p>
                            <p class="specialties">Couples, Family, Relationships</p>
                            <button class="btn btn-outline btn-small" onclick="bookWithTherapist('michael')">Book with Dr. Chen</button>
                        </div>
                        
                        <div class="team-member">
                            <img src="https://images.unsplash.com/photo-1594824804732-5b4c8c0ac9e0?w=150&h=150&fit=crop&crop=face" alt="Dr. Emily Rodriguez">
                            <h3>Dr. Emily Rodriguez</h3>
                            <p class="title">Licensed Clinical Social Worker</p>
                            <p class="experience">10+ years experience</p>
                            <p class="specialties">Trauma, PTSD, Mindfulness</p>
                            <button class="btn btn-outline btn-small" onclick="bookWithTherapist('emily')">Book with Dr. Rodriguez</button>
                        </div>
                        
                        <div class="team-member">
                            <img src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face" alt="Dr. James Wilson">
                            <h3>Dr. James Wilson</h3>
                            <p class="title">Licensed Psychiatrist</p>
                            <p class="experience">15+ years experience</p>
                            <p class="specialties">Medication Management, Bipolar</p>
                            <button class="btn btn-outline btn-small" onclick="bookWithTherapist('james')">Book with Dr. Wilson</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

function showBlogModal() {
    const modalHTML = `
        <div id="blogModal" class="modal active">
            <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2><i class="fas fa-book-open"></i> Mental Health Articles</h2>
                    <span class="close" onclick="closeModal('blogModal')">&times;</span>
                </div>
                <div class="blog-modal-content">
                    <p class="blog-intro">Explore our collection of mental health resources and insights from our expert team.</p>
                    
                    <div class="blog-articles">
                        <article class="blog-article">
                            <div class="article-image">
                                <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop" alt="Night anxiety relief" />
                                <div class="article-category">Anxiety</div>
                            </div>
                            <div class="article-content">
                                <h3>5 Ways to Calm Anxiety at Night</h3>
                                <p>Discover practical techniques to ease nighttime anxiety and improve your sleep quality. Learn breathing exercises, progressive muscle relaxation, and mindfulness practices that can help you find peace before bedtime.</p>
                                <div class="article-meta">
                                    <span class="read-time"><i class="fas fa-clock"></i> 6 min read</span>
                                    <span class="publish-date">Aug 28, 2024</span>
                                </div>
                                <button class="btn btn-outline btn-small" onclick="showArticleDetail('anxiety-night')">Read Full Article</button>
                            </div>
                        </article>
                        
                        <article class="blog-article">
                            <div class="article-image">
                                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=200&fit=crop" alt="Setting boundaries" />
                                <div class="article-category">Relationships</div>
                            </div>
                            <div class="article-content">
                                <h3>How to Build Healthy Boundaries</h3>
                                <p>Learn to protect your mental health by setting clear, respectful boundaries in all relationships. This guide covers communication strategies, self-advocacy techniques, and maintaining relationships while honoring your needs.</p>
                                <div class="article-meta">
                                    <span class="read-time"><i class="fas fa-clock"></i> 8 min read</span>
                                    <span class="publish-date">Aug 25, 2024</span>
                                </div>
                                <button class="btn btn-outline btn-small" onclick="showArticleDetail('healthy-boundaries')">Read Full Article</button>
                            </div>
                        </article>
                        
                        <article class="blog-article">
                            <div class="article-image">
                                <img src="https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=300&h=200&fit=crop" alt="Mindfulness meditation" />
                                <div class="article-category">Mindfulness</div>
                            </div>
                            <div class="article-content">
                                <h3>Mindfulness for Beginners: Start Your Practice Today</h3>
                                <p>Simple mindfulness exercises that anyone can practice to reduce stress and increase awareness. Includes guided meditations, breathing techniques, and tips for incorporating mindfulness into daily life.</p>
                                <div class="article-meta">
                                    <span class="read-time"><i class="fas fa-clock"></i> 5 min read</span>
                                    <span class="publish-date">Aug 22, 2024</span>
                                </div>
                                <button class="btn btn-outline btn-small" onclick="showArticleDetail('mindfulness-beginners')">Read Full Article</button>
                            </div>
                        </article>
                        
                        <article class="blog-article">
                            <div class="article-image">
                                <img src="https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=300&h=200&fit=crop" alt="Depression support" />
                                <div class="article-category">Depression</div>
                            </div>
                            <div class="article-content">
                                <h3>Understanding Depression: Signs, Symptoms, and Support</h3>
                                <p>A comprehensive guide to recognizing depression and finding help. Learn about different types of depression, treatment options, and how to support yourself or loved ones through challenging times.</p>
                                <div class="article-meta">
                                    <span class="read-time"><i class="fas fa-clock"></i> 10 min read</span>
                                    <span class="publish-date">Aug 20, 2024</span>
                                </div>
                                <button class="btn btn-outline btn-small" onclick="showArticleDetail('understanding-depression')">Read Full Article</button>
                            </div>
                        </article>
                        
                        <article class="blog-article">
                            <div class="article-image">
                                <img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop" alt="Workplace stress" />
                                <div class="article-category">Work-Life Balance</div>
                            </div>
                            <div class="article-content">
                                <h3>Managing Workplace Stress and Burnout</h3>
                                <p>Practical strategies for handling work-related stress and preventing burnout. Discover techniques for time management, setting work boundaries, and maintaining mental health in demanding careers.</p>
                                <div class="article-meta">
                                    <span class="read-time"><i class="fas fa-clock"></i> 7 min read</span>
                                    <span class="publish-date">Aug 18, 2024</span>
                                </div>
                                <button class="btn btn-outline btn-small" onclick="showArticleDetail('workplace-stress')">Read Full Article</button>
                            </div>
                        </article>
                        
                        <article class="blog-article">
                            <div class="article-image">
                                <img src="https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=300&h=200&fit=crop" alt="Self-care routine" />
                                <div class="article-category">Self-Care</div>
                            </div>
                            <div class="article-content">
                                <h3>Building a Sustainable Self-Care Routine</h3>
                                <p>Create a personalized self-care routine that fits your lifestyle and actually works. This article covers physical, emotional, and mental self-care practices that you can implement starting today.</p>
                                <div class="article-meta">
                                    <span class="read-time"><i class="fas fa-clock"></i> 6 min read</span>
                                    <span class="publish-date">Aug 15, 2024</span>
                                </div>
                                <button class="btn btn-outline btn-small" onclick="showArticleDetail('self-care-routine')">Read Full Article</button>
                            </div>
                        </article>
                    </div>
                    
                    <div class="blog-cta">
                        <h3>Want More Mental Health Resources?</h3>
                        <p>Subscribe to our newsletter for weekly tips and insights from our mental health experts.</p>
                        <div class="newsletter-signup">
                            <input type="email" placeholder="Enter your email address" id="blogNewsletterEmail">
                            <button class="btn btn-primary" onclick="subscribeToBlogNewsletter()">
                                <i class="fas fa-envelope"></i> Subscribe
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

function showArticleDetail(articleId) {
    closeModal('blogModal');
    
    const articles = {
        'anxiety-night': {
            title: '5 Ways to Calm Anxiety at Night',
            category: 'Anxiety',
            readTime: '6 min read',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop',
            content: `
                <p>Nighttime anxiety can turn peaceful sleep into a struggle. Racing thoughts, physical tension, and worry can make it difficult to unwind after a long day. Here are five evidence-based techniques to help you calm anxiety at night.</p>
                
                <h3>1. Progressive Muscle Relaxation</h3>
                <p>This technique involves tensing and then relaxing each muscle group in your body, starting from your toes and working up to your head. It helps release physical tension and signals to your brain that it's time to relax.</p>
                
                <h3>2. The 4-7-8 Breathing Technique</h3>
                <p>Inhale for 4 counts, hold for 7 counts, and exhale for 8 counts. This breathing pattern activates your parasympathetic nervous system, promoting relaxation and reducing anxiety.</p>
                
                <h3>3. Create a Worry Window</h3>
                <p>Set aside 10-15 minutes earlier in the day to write down your worries. This helps prevent them from surfacing at bedtime when your mind should be winding down.</p>
                
                <h3>4. Practice Mindful Meditation</h3>
                <p>Focus on the present moment through guided meditation or simple awareness of your breath. This helps break the cycle of anxious thoughts and grounds you in the present.</p>
                
                <h3>5. Optimize Your Sleep Environment</h3>
                <p>Keep your bedroom cool, dark, and quiet. Consider using blackout curtains, white noise machines, or aromatherapy with lavender to create a calming atmosphere.</p>
                
                <p><strong>Remember:</strong> If anxiety continues to interfere with your sleep regularly, consider speaking with a mental health professional for personalized strategies and support.</p>
            `
        },
        'healthy-boundaries': {
            title: 'How to Build Healthy Boundaries',
            category: 'Relationships',
            readTime: '8 min read',
            image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=400&fit=crop',
            content: `
                <p>Setting healthy boundaries is essential for maintaining your mental health and building strong, respectful relationships. Boundaries help you protect your time, energy, and emotional well-being while fostering mutual respect.</p>
                
                <h3>Understanding Boundaries</h3>
                <p>Boundaries are the limits we set with others about what we are and aren't comfortable with. They can be physical, emotional, mental, or digital, and they help define where you end and others begin.</p>
                
                <h3>Types of Boundaries</h3>
                <ul>
                    <li><strong>Physical:</strong> Personal space and physical touch preferences</li>
                    <li><strong>Emotional:</strong> What you're willing to discuss and support others with</li>
                    <li><strong>Time:</strong> How you spend your time and availability to others</li>
                    <li><strong>Digital:</strong> Social media interactions and communication preferences</li>
                </ul>
                
                <h3>How to Set Boundaries</h3>
                <ol>
                    <li><strong>Identify your limits:</strong> Reflect on what makes you uncomfortable or drained</li>
                    <li><strong>Be clear and direct:</strong> Use "I" statements to communicate your needs</li>
                    <li><strong>Start small:</strong> Begin with less challenging situations to build confidence</li>
                    <li><strong>Be consistent:</strong> Maintain your boundaries even when it's difficult</li>
                    <li><strong>Prepare for pushback:</strong> Others may resist at first, but stay firm</li>
                </ol>
                
                <h3>Common Boundary Setting Phrases</h3>
                <ul>
                    <li>"I need some time to think about that."</li>
                    <li>"I'm not comfortable discussing this topic."</li>
                    <li>"I can't take on any additional commitments right now."</li>
                    <li>"I prefer to keep work and personal life separate."</li>
                </ul>
                
                <p>Remember, setting boundaries is not about being mean or selfish—it's about taking care of yourself so you can show up as your best self in relationships.</p>
            `
        },
        'mindfulness-beginners': {
            title: 'Mindfulness for Beginners: Start Your Practice Today',
            category: 'Mindfulness',
            readTime: '5 min read',
            image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=600&h=400&fit=crop',
            content: `
                <p>Mindfulness is the practice of paying attention to the present moment without judgment. It's a simple yet powerful tool that can reduce stress, improve focus, and enhance overall well-being.</p>
                
                <h3>What is Mindfulness?</h3>
                <p>Mindfulness involves observing your thoughts, feelings, and sensations as they arise, without trying to change or judge them. It's about being fully present in the moment rather than being caught up in past regrets or future worries.</p>
                
                <h3>Simple Mindfulness Exercises for Beginners</h3>
                
                <h4>1. Mindful Breathing (2-5 minutes)</h4>
                <p>Sit comfortably and focus on your breath. Notice the sensation of air entering and leaving your body. When your mind wanders, gently bring attention back to your breath.</p>
                
                <h4>2. Body Scan (5-10 minutes)</h4>
                <p>Lie down and slowly scan your body from head to toe, noticing any sensations, tension, or relaxation in each part.</p>
                
                <h4>3. Mindful Walking (5-15 minutes)</h4>
                <p>Walk slowly and deliberately, paying attention to each step, the feeling of your feet touching the ground, and your surroundings.</p>
                
                <h4>4. The 5-4-3-2-1 Technique</h4>
                <p>Notice 5 things you can see, 4 things you can touch, 3 things you can hear, 2 things you can smell, and 1 thing you can taste.</p>
                
                <h3>Tips for Building a Mindfulness Practice</h3>
                <ul>
                    <li>Start with just 2-3 minutes daily</li>
                    <li>Choose a consistent time and place</li>
                    <li>Use guided meditations or apps when starting</li>
                    <li>Be patient and kind with yourself</li>
                    <li>Remember that it's normal for the mind to wander</li>
                </ul>
                
                <p>Mindfulness is a skill that develops over time. The key is consistency rather than perfection. Even a few minutes of daily practice can make a significant difference in your mental well-being.</p>
            `
        },
        'understanding-depression': {
            title: 'Understanding Depression: Signs, Symptoms, and Support',
            category: 'Depression',
            readTime: '10 min read',
            image: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=600&h=400&fit=crop',
            content: `
                <p>Depression is more than just feeling sad or going through a rough patch. It's a serious mental health condition that affects how you feel, think, and handle daily activities.</p>
                
                <h3>Common Signs and Symptoms</h3>
                <p>Depression symptoms can vary from person to person, but common signs include:</p>
                
                <h4>Emotional Symptoms:</h4>
                <ul>
                    <li>Persistent sadness or emptiness</li>
                    <li>Loss of interest in activities once enjoyed</li>
                    <li>Feelings of hopelessness or pessimism</li>
                    <li>Irritability or restlessness</li>
                    <li>Feelings of guilt, worthlessness, or helplessness</li>
                </ul>
                
                <h4>Physical Symptoms:</h4>
                <ul>
                    <li>Changes in appetite or weight</li>
                    <li>Sleep disturbances (insomnia or oversleeping)</li>
                    <li>Fatigue or decreased energy</li>
                    <li>Difficulty concentrating or making decisions</li>
                    <li>Physical aches and pains</li>
                </ul>
                
                <h3>Types of Depression</h3>
                <ul>
                    <li><strong>Major Depressive Disorder:</strong> Severe symptoms that interfere with daily life</li>
                    <li><strong>Persistent Depressive Disorder:</strong> Long-term, chronic depression</li>
                    <li><strong>Seasonal Affective Disorder:</strong> Depression related to seasonal changes</li>
                    <li><strong>Postpartum Depression:</strong> Depression following childbirth</li>
                </ul>
                
                <h3>Treatment Options</h3>
                <p>Depression is highly treatable. Common treatment approaches include:</p>
                <ul>
                    <li><strong>Psychotherapy:</strong> Cognitive Behavioral Therapy (CBT), Interpersonal Therapy</li>
                    <li><strong>Medication:</strong> Antidepressants prescribed by a healthcare provider</li>
                    <li><strong>Lifestyle Changes:</strong> Regular exercise, healthy diet, adequate sleep</li>
                    <li><strong>Support Groups:</strong> Connecting with others who understand</li>
                </ul>
                
                <h3>How to Support Someone with Depression</h3>
                <ul>
                    <li>Listen without judgment</li>
                    <li>Encourage professional help</li>
                    <li>Be patient and understanding</li>
                    <li>Help with daily tasks when needed</li>
                    <li>Take care of your own mental health too</li>
                </ul>
                
                <h3>When to Seek Help</h3>
                <p>If you or someone you know is experiencing thoughts of self-harm or suicide, seek immediate help by calling a crisis hotline or going to the nearest emergency room.</p>
                
                <p>Remember: Depression is not a sign of weakness, and seeking help is a sign of strength. With proper treatment and support, people with depression can lead fulfilling lives.</p>
            `
        },
        'workplace-stress': {
            title: 'Managing Workplace Stress and Burnout',
            category: 'Work-Life Balance',
            readTime: '7 min read',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
            content: `
                <p>Workplace stress has become increasingly common in today's fast-paced work environment. Learning to manage stress and prevent burnout is essential for maintaining both professional success and personal well-being.</p>
                
                <h3>Recognizing Workplace Stress</h3>
                <p>Common signs of workplace stress include:</p>
                <ul>
                    <li>Feeling overwhelmed by workload</li>
                    <li>Difficulty concentrating</li>
                    <li>Increased irritability with colleagues</li>
                    <li>Physical symptoms like headaches or tension</li>
                    <li>Dreading going to work</li>
                    <li>Decreased job satisfaction</li>
                </ul>
                
                <h3>Understanding Burnout</h3>
                <p>Burnout is a state of physical, emotional, and mental exhaustion caused by prolonged exposure to stressful work situations. It's characterized by:</p>
                <ul>
                    <li><strong>Emotional exhaustion:</strong> Feeling drained and depleted</li>
                    <li><strong>Depersonalization:</strong> Becoming cynical about work and colleagues</li>
                    <li><strong>Reduced accomplishment:</strong> Feeling ineffective and unproductive</li>
                </ul>
                
                <h3>Stress Management Strategies</h3>
                
                <h4>Time Management Techniques</h4>
                <ul>
                    <li>Prioritize tasks using the Eisenhower Matrix</li>
                    <li>Break large projects into smaller, manageable steps</li>
                    <li>Use time-blocking to schedule focused work periods</li>
                    <li>Learn to say no to non-essential tasks</li>
                </ul>
                
                <h4>Workplace Boundaries</h4>
                <ul>
                    <li>Set clear work hours and stick to them</li>
                    <li>Avoid checking emails outside of work hours</li>
                    <li>Take regular breaks throughout the day</li>
                    <li>Use your vacation time and sick days when needed</li>
                </ul>
                
                <h4>Stress-Relief Techniques</h4>
                <ul>
                    <li>Practice deep breathing exercises during the workday</li>
                    <li>Take short walks or stretch breaks</li>
                    <li>Listen to calming music or nature sounds</li>
                    <li>Keep a stress ball or fidget toy at your desk</li>
                </ul>
                
                <h3>Building Resilience</h3>
                <ul>
                    <li><strong>Develop a support network:</strong> Build relationships with supportive colleagues</li>
                    <li><strong>Practice self-care:</strong> Maintain healthy habits outside of work</li>
                    <li><strong>Focus on what you can control:</strong> Let go of things beyond your influence</li>
                    <li><strong>Celebrate small wins:</strong> Acknowledge your accomplishments regularly</li>
                </ul>
                
                <h3>When to Seek Help</h3>
                <p>Consider seeking professional help if:</p>
                <ul>
                    <li>Stress is affecting your physical health</li>
                    <li>You're using substances to cope</li>
                    <li>Relationships are suffering</li>
                    <li>You feel hopeless about your work situation</li>
                </ul>
                
                <p>Remember, managing workplace stress is an ongoing process. Be patient with yourself as you develop and implement these strategies.</p>
            `
        },
        'self-care-routine': {
            title: 'Building a Sustainable Self-Care Routine',
            category: 'Self-Care',
            readTime: '6 min read',
            image: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=600&h=400&fit=crop',
            content: `
                <p>Self-care isn't selfish—it's essential. A sustainable self-care routine helps you maintain your physical, mental, and emotional well-being, enabling you to better handle life's challenges and support others.</p>
                
                <h3>What is Self-Care?</h3>
                <p>Self-care encompasses any activity that we do deliberately to take care of our mental, emotional, and physical health. It's about being as kind to yourself as you would be to a good friend.</p>
                
                <h3>Dimensions of Self-Care</h3>
                
                <h4>Physical Self-Care</h4>
                <ul>
                    <li>Getting adequate sleep (7-9 hours per night)</li>
                    <li>Eating nutritious meals regularly</li>
                    <li>Staying hydrated throughout the day</li>
                    <li>Engaging in regular physical activity</li>
                    <li>Attending medical appointments when needed</li>
                </ul>
                
                <h4>Emotional Self-Care</h4>
                <ul>
                    <li>Practicing mindfulness and meditation</li>
                    <li>Journaling to process emotions</li>
                    <li>Setting healthy boundaries</li>
                    <li>Seeking therapy or counseling when needed</li>
                    <li>Engaging in activities that bring joy</li>
                </ul>
                
                <h4>Mental Self-Care</h4>
                <ul>
                    <li>Reading books or learning new skills</li>
                    <li>Limiting negative media consumption</li>
                    <li>Practicing problem-solving and decision-making</li>
                    <li>Engaging in creative activities</li>
                    <li>Taking breaks from technology</li>
                </ul>
                
                <h4>Social Self-Care</h4>
                <ul>
                    <li>Spending time with supportive friends and family</li>
                    <li>Setting boundaries in relationships</li>
                    <li>Joining groups or communities with shared interests</li>
                    <li>Practicing good communication skills</li>
                    <li>Asking for help when needed</li>
                </ul>
                
                <h3>Creating Your Self-Care Routine</h3>
                
                <h4>Step 1: Assess Your Current State</h4>
                <p>Take inventory of your current self-care practices and identify areas that need attention. Consider which dimension of self-care feels most neglected.</p>
                
                <h4>Step 2: Start Small</h4>
                <p>Choose 1-2 simple self-care activities to incorporate into your routine. Examples:</p>
                <ul>
                    <li>5-minute morning meditation</li>
                    <li>Taking a 10-minute walk after lunch</li>
                    <li>Writing three things you're grateful for each evening</li>
                </ul>
                
                <h4>Step 3: Schedule It</h4>
                <p>Treat self-care appointments with yourself as seriously as you would any other important commitment. Put them in your calendar and protect that time.</p>
                
                <h4>Step 4: Be Flexible</h4>
                <p>Life happens, and your self-care routine may need to adapt. Have backup options for busy days, like a 2-minute breathing exercise instead of a 20-minute walk.</p>
                
                <h3>Common Self-Care Obstacles</h3>
                <ul>
                    <li><strong>Guilt:</strong> Remember that caring for yourself enables you to better care for others</li>
                    <li><strong>Time constraints:</strong> Even 5 minutes of self-care is better than none</li>
                    <li><strong>Perfectionism:</strong> Progress, not perfection, is the goal</li>
                    <li><strong>Cost concerns:</strong> Many effective self-care activities are free</li>
                </ul>
                
                <p>Remember, self-care is a practice, not a destination. Be patient with yourself as you develop habits that support your overall well-being.</p>
            `
        }
    };
    
    const article = articles[articleId];
    if (!article) {
        createNotification('Article not found', 'error');
        return;
    }
    
    const modalHTML = `
        <div id="articleModal" class="modal active">
            <div class="modal-content" style="max-width: 800px; max-height: 85vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2><i class="fas fa-book-open"></i> ${article.title}</h2>
                    <span class="close" onclick="closeModal('articleModal')">&times;</span>
                </div>
                <div class="article-detail-content">
                    <div class="article-hero">
                        <img src="${article.image}" alt="${article.title}" class="article-hero-image">
                        <div class="article-meta-detail">
                            <span class="article-category-detail">${article.category}</span>
                            <span class="article-read-time-detail"><i class="fas fa-clock"></i> ${article.readTime}</span>
                        </div>
                    </div>
                    
                    <div class="article-body">
                        ${article.content}
                    </div>
                    
                    <div class="article-actions">
                        <button class="btn btn-outline" onclick="closeModal('articleModal'); showBlogModal();">
                            <i class="fas fa-arrow-left"></i> Back to Articles
                        </button>
                        <button class="btn btn-primary" onclick="closeModal('articleModal'); showConsultationModal();">
                            <i class="fas fa-phone"></i> Get Professional Support
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

async function subscribeToBlogNewsletter() {
    const emailInput = document.getElementById('blogNewsletterEmail');
    const email = emailInput.value.trim();
    
    if (!validateEmail(email)) {
        createNotification('Please enter a valid email address.', 'error');
        return;
    }
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        createNotification('Successfully subscribed to our newsletter!', 'success');
        emailInput.value = '';
        
        // Store subscription
        saveUserData('blogNewsletter', { email, subscribed: true });
        trackEvent('Blog Newsletter Subscription', { email });
        
    } catch (error) {
        createNotification('Subscription failed. Please try again.', 'error');
    }
}

function bookWithTherapist(therapistId) {
    closeModal('teamModal');
    setTimeout(() => {
        showBookingModal();
        // Pre-select the therapist in the booking form
        setTimeout(() => {
            const form = document.getElementById('bookingForm');
            if (form) {
                const therapistInput = document.createElement('input');
                therapistInput.type = 'hidden';
                therapistInput.name = 'preferredTherapist';
                therapistInput.value = therapistId;
                form.appendChild(therapistInput);
            }
        }, 100);
    }, 300);
}

// Form Submission Handlers
async function handleBookingSubmission(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
    submitBtn.disabled = true;
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        closeModal('bookingModal');
        createNotification('Booking request submitted successfully! We\'ll contact you within 24 hours.', 'success');
        
        // Store booking data locally
        localStorage.setItem('lastBooking', JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
        }));
        
    } catch (error) {
        createNotification('Booking failed. Please try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function handleAssessmentSubmission({ score, answers, questions }) {
    const phq9Score = questions.filter(q => q.section === 'PHQ-9').reduce((s, q) => s + (answers[q.id] ?? 0), 0);
    const gad7Score = questions.filter(q => q.section === 'GAD-7').reduce((s, q) => s + (answers[q.id] ?? 0), 0);

    // PHQ-9: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 mod-severe, 20-27 severe
    let depressionLevel, depressionColor;
    if (phq9Score <= 4)       { depressionLevel = 'Minimal';             depressionColor = '#22c55e'; }
    else if (phq9Score <= 9)  { depressionLevel = 'Mild';                depressionColor = '#84cc16'; }
    else if (phq9Score <= 14) { depressionLevel = 'Moderate';            depressionColor = '#f59e0b'; }
    else if (phq9Score <= 19) { depressionLevel = 'Moderately Severe';   depressionColor = '#f97316'; }
    else                      { depressionLevel = 'Severe';              depressionColor = '#ef4444'; }

    // GAD-7: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe
    let anxietyLevel, anxietyColor;
    if (gad7Score <= 4)       { anxietyLevel = 'Minimal';   anxietyColor = '#22c55e'; }
    else if (gad7Score <= 9)  { anxietyLevel = 'Mild';      anxietyColor = '#84cc16'; }
    else if (gad7Score <= 14) { anxietyLevel = 'Moderate';  anxietyColor = '#f59e0b'; }
    else                      { anxietyLevel = 'Severe';    anxietyColor = '#ef4444'; }

    const overallScore = phq9Score + gad7Score;
    const isHighRisk = phq9Score >= 15 || gad7Score >= 15 || answers['q9'] >= 1;

    let emoji, recommendation;
    if (overallScore <= 8) {
        emoji = '🌟';
        recommendation = 'You appear to be doing well overall. Keep maintaining healthy routines — regular exercise, sleep, and mindfulness are great for sustaining good mental health.';
    } else if (overallScore <= 18) {
        emoji = '🌤️';
        recommendation = 'You may be experiencing mild symptoms. Self-care strategies like journaling, exercise, and mindfulness can help. Consider a free consultation if symptoms persist for more than 2 weeks.';
    } else if (overallScore <= 30) {
        emoji = '🌧️';
        recommendation = 'Moderate symptoms detected across depression and/or anxiety. Speaking with a mental health professional would be beneficial. Our therapists can help you develop effective coping strategies.';
    } else {
        emoji = '⚠️';
        recommendation = 'Your responses suggest significant distress. We strongly recommend scheduling an appointment with one of our therapists. You deserve support and care.';
    }

    // Q9 safety flag
    const safetyFlag = answers['q9'] >= 1;

    showAssessmentResults({ phq9Score, gad7Score, overallScore, depressionLevel, depressionColor, anxietyLevel, anxietyColor, emoji, recommendation, safetyFlag, answers, questions });

    localStorage.setItem('lastAssessment', JSON.stringify({
        phq9Score, gad7Score, overallScore, depressionLevel, anxietyLevel, answers,
        timestamp: new Date().toISOString()
    }));
}

function showAssessmentResults({ phq9Score, gad7Score, depressionLevel, depressionColor, anxietyLevel, anxietyColor, emoji, recommendation, safetyFlag, answers, questions }) {
    const optionLabels = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];

    const makeBreakdown = (section, borderColor) => questions
        .filter(q => q.section === section)
        .map(q => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <span style="font-size:13px;color:#475569;flex:1;line-height:1.4;">${q.icon} ${q.text}</span>
                <span style="font-size:12px;font-weight:600;color:${borderColor};margin-left:12px;white-space:nowrap;">${optionLabels[answers[q.id] ?? 0]}</span>
            </div>
        `).join('');

    const modalHTML = `
        <div id="resultsModal" class="modal active">
            <div class="modal-content" style="max-width:620px;max-height:90vh;overflow-y:auto;">
                <div class="modal-header" style="position:sticky;top:0;z-index:10;background:#fff;">
                    <h2><i class="fas fa-chart-line"></i> Your Assessment Results</h2>
                    <span class="close" onclick="document.getElementById('resultsModal')?.remove(); document.body.style.overflow='';">&times;</span>
                </div>
                <div style="padding:24px 32px;">

                    ${safetyFlag ? `
                    <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start;">
                        <span style="font-size:20px;">🆘</span>
                        <div>
                            <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">If you are having thoughts of hurting yourself, please reach out immediately.</p>
                            <p style="margin:4px 0 0;font-size:13px;color:#dc2626;">Call or text <strong>988</strong> (Suicide & Crisis Lifeline) — available 24/7.</p>
                        </div>
                    </div>` : ''}

                    <div style="font-size:48px;text-align:center;margin-bottom:16px;">${emoji}</div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
                        <div style="background:#f8fafc;border:2px solid ${depressionColor};border-radius:14px;padding:16px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">PHQ-9 · Depression</p>
                            <div style="font-size:36px;font-weight:800;color:${depressionColor};">${phq9Score}<span style="font-size:14px;color:#94a3b8;">/27</span></div>
                            <div style="font-size:13px;font-weight:600;color:${depressionColor};margin-top:2px;">${depressionLevel}</div>
                        </div>
                        <div style="background:#f8fafc;border:2px solid ${anxietyColor};border-radius:14px;padding:16px;text-align:center;">
                            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">GAD-7 · Anxiety</p>
                            <div style="font-size:36px;font-weight:800;color:${anxietyColor};">${gad7Score}<span style="font-size:14px;color:#94a3b8;">/21</span></div>
                            <div style="font-size:13px;font-weight:600;color:${anxietyColor};margin-top:2px;">${anxietyLevel}</div>
                        </div>
                    </div>

                    <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
                        <h4 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;">Recommendation</h4>
                        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0;">${recommendation}</p>
                    </div>

                    <details style="margin-bottom:20px;">
                        <summary style="font-size:13px;font-weight:600;color:#6366f1;cursor:pointer;margin-bottom:8px;">PHQ-9 Answers (Depression)</summary>
                        <div style="margin-top:8px;">${makeBreakdown('PHQ-9', '#6366f1')}</div>
                    </details>
                    <details style="margin-bottom:20px;">
                        <summary style="font-size:13px;font-weight:600;color:#0ea5e9;cursor:pointer;margin-bottom:8px;">GAD-7 Answers (Anxiety)</summary>
                        <div style="margin-top:8px;">${makeBreakdown('GAD-7', '#0ea5e9')}</div>
                    </details>

                    <div style="display:flex;gap:12px;margin-bottom:12px;">
                        <button class="btn btn-primary" style="flex:1;" onclick="handleAssessmentCTA()">
                            <i class="fas fa-user"></i> Login / Sign Up
                        </button>
                        <button class="btn btn-outline" style="flex:1;" onclick="document.getElementById('resultsModal')?.remove(); document.body.style.overflow='';">
                            Okay
                        </button>
                    </div>
                    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.5;">
                        This is a validated screening tool, not a clinical diagnosis.<br>Please consult a qualified mental health professional for a proper assessment.
                    </p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function handleDownloadSubmission(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing Download...';
    submitBtn.disabled = true;
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        closeModal('downloadModal');
        createNotification('Download links sent to your email! Check your inbox.', 'success');
        
        // Store download request
        localStorage.setItem('downloadRequest', JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
        }));
        
    } catch (error) {
        createNotification('Download failed. Please try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Enhanced modal styles
const modalStyles = document.createElement('style');
modalStyles.textContent = `
    .booking-form, .assessment-form, .download-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    
    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .booking-form .form-group input,
    .booking-form .form-group select,
    .booking-form .form-group textarea,
    .consultation-form .form-group input,
    .consultation-form .form-group select,
    .consultation-form .form-group textarea {
        width: 100%;
        padding: 0.85rem 0.95rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.625rem;
        background: #ffffff;
        color: #1e293b;
        font-size: 0.95rem;
        line-height: 1.45;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .booking-form .form-group textarea,
    .consultation-form .form-group textarea {
        min-height: 120px;
        padding-top: 0.95rem;
        resize: vertical;
    }

    .booking-form .form-group textarea::placeholder,
    .consultation-form .form-group textarea::placeholder {
        color: #94a3b8;
        line-height: 1.45;
    }

    .booking-form .form-group input:focus,
    .booking-form .form-group select:focus,
    .booking-form .form-group textarea:focus,
    .consultation-form .form-group input:focus,
    .consultation-form .form-group select:focus,
    .consultation-form .form-group textarea:focus {
        outline: none;
        border-color: #44556b;
        box-shadow: 0 0 0 3px rgba(68, 85, 107, 0.15);
    }
    
    .radio-group, .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .radio-label, .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        padding: 0.75rem;
        border-radius: 0.5rem;
        transition: background-color 0.2s;
    }
    
    .radio-label:hover, .checkbox-label:hover {
        background-color: rgba(37, 99, 235, 0.05);
    }
    
    .radio-custom, .checkbox-custom {
        width: 1.25rem;
        height: 1.25rem;
        border: 2px solid #cbd5e1;
        border-radius: 50%;
        position: relative;
        transition: all 0.2s;
    }
    
    .checkbox-custom {
        border-radius: 0.25rem;
    }
    
    .radio-label input:checked + .radio-custom {
        border-color: #2563eb;
        background-color: #2563eb;
    }
    
    .radio-label input:checked + .radio-custom::after {
        content: '';
        width: 0.5rem;
        height: 0.5rem;
        background: white;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    
    .checkbox-label input:checked + .checkbox-custom {
        border-color: #2563eb;
        background-color: #2563eb;
    }
    
    .checkbox-label input:checked + .checkbox-custom::after {
        content: '✓';
        color: white;
        font-size: 0.875rem;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    
    .stress-slider {
        padding: 1rem 0;
    }
    
    .stress-slider input[type="range"] {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #e2e8f0;
        outline: none;
        -webkit-appearance: none;
    }
    
    .stress-slider input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #2563eb;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    
    .slider-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.875rem;
        color: #64748b;
    }
    
    .team-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1.5rem;
    }
    
    .team-member {
        text-align: center;
        padding: 1.5rem;
        border-radius: 1rem;
        border: 1px solid #e2e8f0;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .team-member:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }
    
    .team-member img {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 1rem;
    }
    
    .team-member h3 {
        margin-bottom: 0.5rem;
        color: #1e293b;
    }
    
    .team-member .title {
        font-weight: 600;
        color: #2563eb;
        margin-bottom: 0.25rem;
    }
    
    .team-member .experience {
        font-size: 0.875rem;
        color: #64748b;
        margin-bottom: 0.5rem;
    }
    
    .team-member .specialties {
        font-size: 0.875rem;
        color: #059669;
        margin-bottom: 1rem;
        font-weight: 500;
    }
    
    .btn-small {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
    }
    
    .download-items {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: 1.5rem 0;
    }
    
    .download-item {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .download-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .download-item i {
        font-size: 1.5rem;
        color: #2563eb;
        margin-top: 0.25rem;
    }
    
    .download-item h4 {
        margin-bottom: 0.25rem;
        color: #1e293b;
        font-weight: 600;
    }
    
    .download-item p {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0;
    }
    
    .service-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    
    .service-description {
        font-size: 1.125rem;
        color: #4b5563;
        line-height: 1.7;
    }
    
    .feature-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .feature-list li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: #374151;
    }
    
    .feature-list i {
        color: #059669;
        font-size: 0.875rem;
    }
    
    .service-info {
        display: flex;
        gap: 2rem;
        margin-top: 1rem;
        padding: 1rem;
        background: #f8fafc;
        border-radius: 0.75rem;
    }
    
    .info-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #374151;
        font-weight: 500;
    }
    
    .info-item i {
        color: #2563eb;
    }
    
    .service-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 1rem;
    }
    
    .question-group {
        margin-bottom: 2rem;
    }
    
    .question-group h3 {
        margin-bottom: 1rem;
        color: #1e293b;
        font-weight: 600;
        font-size: 1.125rem;
    }
    
    .assessment-intro {
        background: #f0f9ff;
        padding: 1rem;
        border-radius: 0.75rem;
        border-left: 4px solid #2563eb;
        margin-bottom: 2rem;
        font-style: italic;
    }
    
    .results-content {
        text-align: center;
    }
    
    .score-display {
        margin-bottom: 2rem;
    }
    
    .score-circle {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem;
        font-weight: bold;
        color: white;
    }
    
    .score-circle.low {
        background: linear-gradient(135deg, #6f8b77, #8da395);
    }
    
    .score-circle.moderate {
        background: linear-gradient(135deg, #ad8f63, #c4ab82);
    }
    
    .score-circle.high {
        background: linear-gradient(135deg, #9f5e5e, #b67979);
    }
    
    .score-number {
        font-size: 2rem;
        line-height: 1;
    }
    
    .score-label {
        font-size: 0.875rem;
        opacity: 0.9;
    }
    
    .risk-level span.low {
        color: #059669;
    }
    
    .risk-level span.moderate {
        color: #f59e0b;
    }
    
    .risk-level span.high {
        color: #dc2626;
    }
    
    .recommendation {
        background: #f8fafc;
        padding: 1.5rem;
        border-radius: 0.75rem;
        margin-bottom: 2rem;
        text-align: left;
    }
    
    .recommendation h3 {
        margin-bottom: 0.75rem;
        color: #1e293b;
    }
    
    .next-steps {
        text-align: left;
    }
    
    .next-steps h3 {
        margin-bottom: 1rem;
        color: #1e293b;
    }
    
    .action-buttons {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
    }
    
    /* Hide default radio and checkbox inputs */
    .radio-label input,
    .checkbox-label input {
        opacity: 0;
        position: absolute;
        pointer-events: none;
    }
    
    /* Blog Modal Styles */
    .blog-modal-content {
        padding: 0;
    }
    
    .blog-intro {
        background: #f8fafc;
        padding: 1.5rem;
        margin: -1.5rem -1.5rem 2rem -1.5rem;
        border-radius: 0.75rem 0.75rem 0 0;
        font-size: 1.125rem;
        color: #4b5563;
        text-align: center;
    }
    
    .blog-articles {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        margin-bottom: 3rem;
    }
    
    .blog-article {
        display: flex;
        gap: 1.5rem;
        padding: 1.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .blog-article:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }
    
    .article-image {
        position: relative;
        flex-shrink: 0;
        width: 200px;
        height: 140px;
        border-radius: 0.75rem;
        overflow: hidden;
    }
    
    .article-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .article-category {
        position: absolute;
        top: 0.75rem;
        left: 0.75rem;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
    }
    
    .article-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .article-content h3 {
        color: #1e293b;
        font-weight: 600;
        font-size: 1.25rem;
        line-height: 1.4;
        margin: 0;
    }
    
    .article-content p {
        color: #64748b;
        line-height: 1.6;
        margin: 0;
        flex: 1;
    }
    
    .article-meta {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-top: auto;
        font-size: 0.875rem;
        color: #64748b;
    }
    
    .read-time {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .publish-date {
        font-weight: 500;
    }
    
    .blog-cta {
        text-align: center;
        padding: 2rem;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-radius: 1rem;
        margin-top: 2rem;
    }
    
    .blog-cta h3 {
        color: #1e293b;
        margin-bottom: 0.75rem;
        font-size: 1.5rem;
    }
    
    .blog-cta p {
        color: #64748b;
        margin-bottom: 1.5rem;
    }
    
    .newsletter-signup {
        display: flex;
        gap: 0.75rem;
        max-width: 400px;
        margin: 0 auto;
    }
    
    .newsletter-signup input {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        font-size: 0.875rem;
    }
    
    .newsletter-signup input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    /* Article Detail Styles */
    .article-detail-content {
        padding: 0;
    }
    
    .article-hero {
        margin: -1.5rem -1.5rem 2rem -1.5rem;
        position: relative;
    }
    
    .article-hero-image {
        width: 100%;
        height: 300px;
        object-fit: cover;
        border-radius: 0.75rem 0.75rem 0 0;
    }
    
    .article-meta-detail {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        display: flex;
        gap: 1rem;
    }
    
    .article-category-detail {
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
    }
    
    .article-read-time-detail {
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .article-body {
        padding: 0 1.5rem;
        line-height: 1.8;
        color: #374151;
    }
    
    .article-body h3 {
        color: #1e293b;
        font-weight: 600;
        font-size: 1.375rem;
        margin: 2rem 0 1rem 0;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 0.5rem;
    }
    
    .article-body h4 {
        color: #1e293b;
        font-weight: 600;
        font-size: 1.125rem;
        margin: 1.5rem 0 0.75rem 0;
    }
    
    .article-body p {
        margin-bottom: 1.25rem;
    }
    
    .article-body ul, 
    .article-body ol {
        margin: 1.25rem 0;
        padding-left: 1.5rem;
    }
    
    .article-body ul li, 
    .article-body ol li {
        margin-bottom: 0.5rem;
        line-height: 1.6;
    }
    
    .article-body strong {
        color: #1e293b;
        font-weight: 600;
    }
    
    .article-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin: 3rem 1.5rem 1.5rem 1.5rem;
        padding-top: 2rem;
        border-top: 1px solid #e2e8f0;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .form-row {
            grid-template-columns: 1fr;
        }
        
        .team-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }
        
        .service-info {
            flex-direction: column;
            gap: 1rem;
        }
        
        .action-buttons {
            flex-direction: column;
            align-items: center;
        }
        
        .modal-content {
            margin: 1rem;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        .blog-article {
            flex-direction: column;
            gap: 1rem;
        }
        
        .article-image {
            width: 100%;
            height: 200px;
        }
        
        .newsletter-signup {
            flex-direction: column;
        }
        
        .article-hero-image {
            height: 200px;
        }
        
        .article-actions {
            flex-direction: column;
            align-items: center;
        }
    }
`;

document.head.appendChild(modalStyles);

// Additional utility functions
function showConsultationModal() {
    const modalHTML = `
        <div id="consultationModal" class="modal active">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-phone"></i> Free Consultation</h2>
                    <span class="close" onclick="closeModal('consultationModal')">&times;</span>
                </div>
                <div class="consultation-content">
                    <p>Schedule a free 15-minute consultation to discuss your needs and how we can help.</p>
                    
                    <form id="consultationForm" class="consultation-form">
                        <div class="form-group">
                            <label for="consultName">Full Name *</label>
                            <input type="text" id="consultName" name="fullName" required>
                        </div>
                        <div class="form-group">
                            <label for="consultEmail">Email Address *</label>
                            <input type="email" id="consultEmail" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="consultPhone">Phone Number *</label>
                            <input type="tel" id="consultPhone" name="phone" required>
                        </div>
                        <div class="form-group">
                            <label for="consultTime">Preferred Call Time</label>
                            <select id="consultTime" name="preferredTime">
                                <option value="">Select preferred time</option>
                                <option value="morning">Morning (9 AM - 12 PM)</option>
                                <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                                <option value="evening">Evening (5 PM - 8 PM)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="consultTopic">What would you like to discuss?</label>
                            <textarea id="consultTopic" name="topic" rows="3" placeholder="Brief description of what you'd like to talk about..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary btn-full">
                            <i class="fas fa-calendar-check"></i> Schedule Free Consultation
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
    
    document.getElementById('consultationForm').addEventListener('submit', handleConsultationSubmission);
}

async function handleConsultationSubmission(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
    submitBtn.disabled = true;
    
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        closeModal('consultationModal');
        createNotification('Consultation scheduled! We\'ll call you within 24 hours.', 'success');
        
        localStorage.setItem('consultationRequest', JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
        }));
        
    } catch (error) {
        createNotification('Failed to schedule consultation. Please try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Enhanced form validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s|-|\(|\)/g, ''));
}

// Local storage utilities
function saveUserData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Failed to save user data:', error);
    }
}

function getUserData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Failed to retrieve user data:', error);
        return null;
    }
}

// Analytics tracking (placeholder for real analytics)
function trackEvent(eventName, data = {}) {
    console.log('Analytics Event:', eventName, data);
    
    // Store events locally for demo purposes
    const events = getUserData('analyticsEvents') || [];
    events.push({
        event: eventName,
        data,
        timestamp: new Date().toISOString()
    });
    
    if (events.length > 100) {
        events.splice(0, 50); // Keep only latest 100 events
    }
    
    saveUserData('analyticsEvents', events);
}

// Newsletter subscription handler
document.addEventListener('DOMContentLoaded', () => {
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            
            if (validateEmail(email)) {
                const submitBtn = e.target.querySelector('button');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Subscribing...';
                submitBtn.disabled = true;
                
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    createNotification('Successfully subscribed to newsletter!', 'success');
                    saveUserData('newsletter', { email, subscribed: true });
                    e.target.reset();
                } catch (error) {
                    createNotification('Subscription failed. Please try again.', 'error');
                } finally {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            } else {
                createNotification('Please enter a valid email address.', 'error');
            }
        });
    }
});

// Enhanced mood tracking with persistence
function saveMoodEntry(mood) {
    const moodHistory = getUserData('moodHistory') || [];
    moodHistory.push({
        mood,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 30 entries
    if (moodHistory.length > 30) {
        moodHistory.splice(0, moodHistory.length - 30);
    }
    
    saveUserData('moodHistory', moodHistory);
    trackEvent('Mood Tracked', { mood });
}

// Update mood tracker to save data
document.addEventListener('DOMContentLoaded', () => {
    // Load previous mood if tracked today
    const moodHistory = getUserData('moodHistory') || [];
    const today = new Date().toISOString().split('T')[0];
    const todayMood = moodHistory.find(entry => entry.date === today);
    
    if (todayMood) {
        const moodBtn = document.querySelector(`[data-mood="${todayMood.mood}"]`);
        if (moodBtn) {
            moodBtn.classList.add('selected');
        }
    }
});

// Global logout function
async function logout() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/users/auth/logout/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Token ${token}` } : {})
            },
        });

        const result = await response.json();

        if (result.success) {
            localStorage.removeItem('user');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('authToken');
            
            createNotification('Logged out successfully!', 'success');
            
            // Redirect to home page after a short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
        } else {
            createNotification('Logout failed. Please try again.', 'error');
        }

    } catch (error) {
        console.error('Logout error:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('authToken');
        createNotification('Logged out locally.', 'info');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
}

// Make functions globally available
window.logout = logout;
window.showDashboard = () => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const userData = localStorage.getItem('user');

    if (!isAuthenticated || !userData) {
        if (window.mindWellApp && typeof window.mindWellApp.autoAuthenticate === 'function') {
            window.mindWellApp.autoAuthenticate();
        }
    }
    window.location.href = 'dashboard.html';
};
window.toggleUserMode = function() {
    const app = window.mindWellApp;
    if (app && app.handleModeToggle) {
        const toggle = document.getElementById('userModeToggle');
        app.handleModeToggle({ target: toggle });
    }
};

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MindWellApp,
        showBookingModal,
        showSelfAssessmentModal,
        showServiceModal,
        showDownloadModal,
        showTeamModal,
        createNotification,
        logout
    };
}
