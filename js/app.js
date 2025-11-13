// API Configuration
// Get the base path (everything up to and including /crypto_folio/)
const getApiBase = () => {
    const path = window.location.pathname;
    // Remove trailing slash and filename, then add /api
    const basePath = path.replace(/\/[^/]*$/, '').replace(/\/$/, '');
    return basePath + '/api';
};

let currentUser = null;
let isAuthenticated = false;

// API Functions
async function apiRequest(endpoint, options = {}) {
    // Build full URL
    const apiBase = getApiBase();
    let url = `${apiBase}/${endpoint}`;
    
    // Always use http/https, never file://
    if (url.startsWith('file://') || !url.startsWith('http')) {
        // If we're on file://, we can't make requests anyway, but construct proper URL
        if (window.location.protocol === 'file:') {
            console.error('Cannot make API requests from file:// protocol. Please use a web server.');
            throw new Error('File protocol not supported. Use http://localhost:8000 or deploy to server.');
        }
        // Build proper URL
        url = window.location.origin + (url.startsWith('/') ? url : '/' + url);
    }
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
    };
    
    try {
        console.log('Making API request to:', url);
        const response = await fetch(url, { ...defaultOptions, ...options });
        console.log('Response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            // Try to parse JSON error message
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error) {
                    throw new Error(errorData.error);
                }
            } catch (e) {
                // Not JSON, use the text as-is
            }
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log('API response:', data);
        return data;
    } catch (error) {
        console.error('API Request failed:', error.message, 'URL:', url);
        throw error;
    }
}

// Authentication Functions
async function signIn(password) {
    try {
        const result = await apiRequest('auth.php?action=login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        
        if (result.success) {
            currentUser = result.user;
            isAuthenticated = true;
            // Save password to localStorage with 7-day expiration
            savePasswordToStorage(password);
            return { success: true };
        } else {
            return { success: false, error: result.error || 'Sign in failed' };
        }
    } catch (error) {
        // Parse error message from response
        let errorMessage = 'Network error. Please check your connection.';
        if (error.message) {
            try {
                const errorMatch = error.message.match(/\{"success":false,"error":"([^"]+)"\}/);
                if (errorMatch) {
                    errorMessage = errorMatch[1];
                } else if (error.message.includes('401')) {
                    errorMessage = 'Incorrect password. Please try again.';
                }
            } catch (e) {
                // Use default error message
            }
        }
        return { success: false, error: errorMessage };
    }
}

// Password persistence functions (7-day expiration)
function savePasswordToStorage(password) {
    const expirationTime = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    localStorage.setItem('savedPassword', JSON.stringify({
        password: password,
        expiresAt: expirationTime
    }));
}

function getPasswordFromStorage() {
    try {
        const saved = localStorage.getItem('savedPassword');
        if (!saved) return null;
        
        const data = JSON.parse(saved);
        if (Date.now() > data.expiresAt) {
            // Expired, remove it
            localStorage.removeItem('savedPassword');
            return null;
        }
        return data.password;
    } catch (e) {
        return null;
    }
}

function clearPasswordFromStorage() {
    localStorage.removeItem('savedPassword');
}

async function signOut() {
    try {
        await apiRequest('auth.php?action=logout', { method: 'POST' });
        currentUser = null;
        isAuthenticated = false;
        portfolio = [];
        portfolioStats = { highestValue: null, lowestValue: null };
        clearPasswordFromStorage();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function checkAuth() {
    try {
        const result = await apiRequest('auth.php?action=check');
        if (result.success) {
            currentUser = result.user;
            isAuthenticated = true;
            return true;
        }
        
        // Session expired - try auto-login with saved password
        const savedPassword = getPasswordFromStorage();
        if (savedPassword) {
            console.log('Session expired, attempting auto-login with saved password...');
            const loginResult = await signIn(savedPassword);
            if (loginResult.success) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        // Try auto-login on error too
        const savedPassword = getPasswordFromStorage();
        if (savedPassword) {
            console.log('Auth check failed, attempting auto-login with saved password...');
            try {
                const loginResult = await signIn(savedPassword);
                if (loginResult.success) {
                    return true;
                }
            } catch (e) {
                // Auto-login failed, return false
            }
        }
        return false;
    }
}

async function changePassword(currentPwd, newPwd) {
    try {
        const result = await apiRequest('auth.php?action=change-password', {
            method: 'POST',
            body: JSON.stringify({
                currentPassword: currentPwd,
                newPassword: newPwd
            }),
        });
        
        if (result.success) {
            return { success: true, message: result.message || 'Password changed successfully' };
        } else {
            return { success: false, error: result.error || 'Failed to change password' };
        }
    } catch (error) {
        return { success: false, error: error.message || 'Network error' };
    }
}

// Portfolio API Functions
async function loadPortfolioFromServer() {
    if (!isAuthenticated) {
        console.log('Not authenticated, loading from localStorage only');
        portfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
        return;
    }
    
    try {
        console.log('Loading portfolio from server...');
        const result = await apiRequest('portfolio.php');
        console.log('Server response:', result);
        
        if (result.success) {
            const serverPortfolio = result.portfolio || [];
            const serverStats = result.stats || { 
                highestValue: null, 
                lowestValue: null,
                highestValueTimestamp: null,
                lowestValueTimestamp: null
            };
            const serverApiUsage = result.apiUsage || {};
            
            console.log('Server portfolio:', serverPortfolio.length, 'coins');
            console.log('Server stats:', serverStats);
            
            // Check if server has empty portfolio but localStorage has data
            const localPortfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
            const localStats = JSON.parse(localStorage.getItem('portfolioStats') || '{}');
            const localApiUsage = JSON.parse(localStorage.getItem('apiUsage') || '{}');
            
            if (serverPortfolio.length === 0 && localPortfolio.length > 0) {
                // Server is empty but localStorage has data - migrate it
                console.log('Migrating localStorage data to server...');
                portfolio = localPortfolio;
                portfolioStats = {
                    highestValue: localStats.highestValue || null,
                    lowestValue: localStats.lowestValue || null,
                    highestValueTimestamp: localStats.highestValueTimestamp || null,
                    lowestValueTimestamp: localStats.lowestValueTimestamp || null
                };
                // Save portfolio to server (API usage will be saved separately when tracking)
                await savePortfolioToServer();
                // Update portfolio records display to show timestamps
                updatePortfolioRecordsDisplay();
                // Keep localStorage as backup
                return;
            }
            
            // Use server data (even if empty - this is the source of truth)
            portfolio = serverPortfolio;
            
            // Use server stats as base - server is source of truth for values
            portfolioStats = {
                highestValue: serverStats.highestValue !== undefined ? serverStats.highestValue : null,
                lowestValue: serverStats.lowestValue !== undefined ? serverStats.lowestValue : null,
                // Only merge timestamps - preserve from server if they exist, otherwise use defaults if values exist
                highestValueTimestamp: serverStats.highestValueTimestamp || 
                    (serverStats.highestValue ? '2025-11-06T00:00:00.000Z' : null),
                lowestValueTimestamp: serverStats.lowestValueTimestamp || 
                    (serverStats.lowestValue ? '2025-11-04T00:00:00.000Z' : null)
            };
            
            console.log('Using server data:', portfolio.length, 'coins');
            console.log('Portfolio stats with timestamps:', {
                highestValue: portfolioStats.highestValue,
                highestValueTimestamp: portfolioStats.highestValueTimestamp,
                lowestValue: portfolioStats.lowestValue,
                lowestValueTimestamp: portfolioStats.lowestValueTimestamp
            });
            
            // Always save server data to localStorage as backup (so it works offline too)
            localStorage.setItem('cryptoPortfolio', JSON.stringify(serverPortfolio));
            localStorage.setItem('portfolioStats', JSON.stringify(portfolioStats));
            
            // If we added default timestamps and they weren't in server, save them back to the server
            if ((!serverStats.highestValueTimestamp && portfolioStats.highestValueTimestamp) ||
                (!serverStats.lowestValueTimestamp && portfolioStats.lowestValueTimestamp)) {
                console.log('Saving timestamps to server...');
                // Use setTimeout to avoid saving during initial load
                setTimeout(() => {
                    savePortfolioStats().catch(err => console.error('Error saving timestamps:', err));
                }, 500);
            }
            
            // Always use server API usage data (server is source of truth, no local merging)
            // Update localStorage IMMEDIATELY so trackAPIUsage() uses correct data
            // Always overwrite localStorage with server data (even if empty) to clear stale cache
            localStorage.setItem('apiUsage', JSON.stringify(serverApiUsage));
            console.log('Updated localStorage with server API usage:', serverApiUsage);
            
            // Force update API stats display immediately with server data
            updateAPIStats();
            
            // Update portfolio records display to show timestamps
            updatePortfolioRecordsDisplay();
        } else {
            console.error('Server returned unsuccessful response:', result);
            // Fallback to localStorage
            portfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
        }
    } catch (error) {
        console.error('Error loading portfolio from server:', error);
        console.error('Error details:', error.message, error.stack);
        // Fallback to localStorage
        portfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
    }
}

async function savePortfolioToServer(apiUsageOverride = null, portfolioOverride = null, statsOverride = null) {
    if (!isAuthenticated) {
        console.log('Not authenticated, saving to localStorage only');
        // Fallback to localStorage
        localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio));
        return;
    }
    
    try {
        // Get current API usage from localStorage
        const currentApiUsage = apiUsageOverride || JSON.parse(localStorage.getItem('apiUsage') || '{}');
        const portfolioToSave = portfolioOverride || portfolio;
        const statsToSave = statsOverride || portfolioStats;
        
        console.log('Saving portfolio to server:', portfolioToSave.length, 'coins');
        
        const result = await apiRequest('portfolio.php', {
            method: 'POST',
            body: JSON.stringify({
                portfolio: portfolioToSave,
                stats: statsToSave,
                apiUsage: currentApiUsage,
            }),
        });
        
        console.log('Portfolio saved successfully:', result);
    } catch (error) {
        console.error('Error saving portfolio to server:', error);
        console.error('Error details:', error.message);
        // Fallback to localStorage
        localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio));
    }
}

// State management
let portfolio = [];
let priceData = {};
let availableCoins = [];
let refreshInterval;
let countdownInterval;
let countdownSeconds = 60;
let isTabVisible = true;
let recordUpdateTimeout = null;
const RECORD_UPDATE_DELAY = 5 * 60 * 1000; // 5 minutes in milliseconds
let portfolioStats = { 
    highestValue: null, 
    lowestValue: null,
    highestValueTimestamp: null,
    lowestValueTimestamp: null
};

const AVATAR_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const AVATAR_MAX_FILE_SIZE = 1024 * 1024; // 1MB
let selectedAvatarFile = null;


// API Usage Tracking
function getAPIUsage() {
    const now = new Date();
    const today = now.toDateString();
    const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
    
    const usage = JSON.parse(localStorage.getItem('apiUsage') || '{}');
    
    // Calculate monthly total (sum all days in current month)
    let monthlyTotal = 0;
    Object.keys(usage).forEach(key => {
        try {
            const dateKey = new Date(key);
            if (dateKey.toISOString().slice(0, 7) === thisMonth) {
                monthlyTotal += usage[key] || 0;
            }
        } catch (e) {
            // Skip invalid dates
        }
    });
    
    return {
        daily: usage[today] || 0,
        monthly: monthlyTotal,
        raw: usage,
        todayKey: today,
        monthKey: thisMonth
    };
}

function trackAPIUsage() {
    const today = new Date().toDateString();
    const usage = getAPIUsage();
    
    // Increment today's count
    usage.raw[today] = (usage.raw[today] || 0) + 1;
    localStorage.setItem('apiUsage', JSON.stringify(usage.raw));
    
    console.log('Tracked API usage - today:', today, 'count:', usage.raw[today], 'monthly total:', usage.monthly + 1);
    
    // Also save to server if authenticated
    if (isAuthenticated) {
        // Save API usage to server (async, don't wait)
        savePortfolioToServer(usage.raw, null, null).catch(error => {
            console.error('Error saving API usage to server:', error);
        });
    }
    
    updateAPIStats();
}

function updateAPIStats() {
    const usage = getAPIUsage();
    const monthlyEl = document.getElementById('apiMonthly');
    const COINGECKO_MONTHLY_LIMIT = 10000;
    
    if (monthlyEl) {
        // Show as remaining/total format: 9,980/10,000 (countdown from 10000)
        const remaining = Math.max(0, COINGECKO_MONTHLY_LIMIT - usage.monthly);
        monthlyEl.textContent = `${remaining.toLocaleString('en-US')}/${COINGECKO_MONTHLY_LIMIT.toLocaleString('en-US')}`;
        
        console.log('API Stats updated - monthly used:', usage.monthly, 'remaining:', remaining);
        
        // Keep same grey color (no color coding)
        monthlyEl.style.color = '';
    }
}

// DOM elements
const addCoinBtn = document.getElementById('addCoinBtn');
const modal = document.getElementById('modal');
const cancelBtn = document.getElementById('cancelBtn');
const addBtn = document.getElementById('addBtn');
const coinSelect = document.getElementById('coinSelect');
const coinSearch = document.getElementById('coinSearch');
const coinSuggestions = document.getElementById('coinSuggestions');
const quantityInput = document.getElementById('quantityInput');
const portfolioContainer = document.getElementById('portfolio');
const totalValueEl = document.getElementById('totalValue');
const totalChangeEl = document.getElementById('totalChange');
const lastUpdatedEl = document.getElementById('lastUpdated');
const highestValueEl = document.getElementById('highestValue');
const lowestValueEl = document.getElementById('lowestValue');
const refreshStatusEl = document.getElementById('refreshStatus');
const refreshTimerEl = document.getElementById('refreshTimer');
const apiMonthlyEl = document.getElementById('apiMonthly');
const editModal = document.getElementById('editModal');
const editCloseBtn = document.getElementById('editCloseBtn');
const editUpdateBtn = document.getElementById('editUpdateBtn');
const editRemoveBtn = document.getElementById('editRemoveBtn');
const editCoinId = document.getElementById('editCoinId');
const editCoinName = document.getElementById('editCoinName');
const editQuantityInput = document.getElementById('editQuantityInput');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const authModal = document.getElementById('authModal');
const authPassword = document.getElementById('authPassword');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const authError = document.getElementById('authError');
const authStatus = document.getElementById('authStatus');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const userNameText = document.querySelector('.user-name-text');
const userAvatarImage = document.getElementById('userAvatarImage');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const changePasswordModal = document.getElementById('changePasswordModal');
const changePasswordCloseBtn = document.getElementById('changePasswordCloseBtn');
const changePasswordCancelBtn = document.getElementById('changePasswordCancelBtn');
const changePasswordSubmitBtn = document.getElementById('changePasswordSubmitBtn');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmNewPassword = document.getElementById('confirmNewPassword');
const changePasswordError = document.getElementById('changePasswordError');
const changePasswordStatus = document.getElementById('changePasswordStatus');
const changeAvatarBtn = document.getElementById('changeAvatarBtn');
const avatarModal = document.getElementById('avatarModal');
const avatarCloseBtn = document.getElementById('avatarCloseBtn');
const avatarCancelBtn = document.getElementById('avatarCancelBtn');
const avatarUploadBtn = document.getElementById('avatarUploadBtn');
const avatarFileInput = document.getElementById('avatarFileInput');
const avatarPreviewImage = document.getElementById('avatarPreviewImage');
const avatarPreviewFallback = document.getElementById('avatarPreviewFallback');
const avatarError = document.getElementById('avatarError');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function openMobileMenu() {
    if (!isMobileViewport()) return;
    document.body.classList.add('mobile-menu-open');
    if (mobileMenuToggle) {
        mobileMenuToggle.setAttribute('aria-expanded', 'true');
    }
}

function closeMobileMenu() {
    if (!document.body.classList.contains('mobile-menu-open')) return;
    document.body.classList.remove('mobile-menu-open');
    if (mobileMenuToggle) {
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
    }
}

function toggleMobileMenu() {
    if (document.body.classList.contains('mobile-menu-open')) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

updatePortfolioRecordsDisplay();

// Initialize app
async function init() {
    // Initially hide modal and lock scrolling (will be updated after auth check)
    document.body.classList.add('modal-open');
    
    // Check authentication first (before locking UI)
    const authenticated = await checkAuth();
    
    if (authenticated) {
        // User is authenticated - don't show modal, unlock scrolling
        document.body.classList.remove('modal-open');
        await loadPortfolioFromServer();
        updateUserUI();
        
        // Wait a moment to ensure localStorage is updated before fetching prices
        // This prevents trackAPIUsage() from reading empty localStorage
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start fetching prices immediately in parallel (don't wait)
        if (portfolio.length > 0) {
            // Fetch prices immediately while we continue with other initialization
            updatePrices().catch(error => {
                console.error('Error updating prices on init:', error);
            });
        }
    } else {
        // User not authenticated - show modal and lock scrolling
        document.body.classList.add('modal-open');
        // Fallback to localStorage for non-authenticated users
        portfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
        portfolioStats = loadPortfolioStats();
        updateUserUI();
    }
    
    await loadAvailableCoins();
    updateAPIStats();
    
    // Initialize countdown display
    updateCountdown();
    
    // Always render portfolio first, even without prices
    renderPortfolio();
    updateSummary();
    
    // If prices haven't been fetched yet (non-authenticated), fetch them now
    if (!authenticated && portfolio.length > 0) {
        updatePrices().catch(error => {
            console.error('Error updating prices on init:', error);
        });
    }
    
    setupEventListeners();
    setupPageVisibility();
    startAutoRefresh();
    
    // Fetch fresh data when returning to tab
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && portfolio.length > 0) {
            // Render first to ensure coins are visible
            renderPortfolio();
            updateSummary();
            
            // Small delay to ensure tab is fully visible, then fetch prices
            setTimeout(async () => {
                updatePrices().catch(error => {
                    console.error('Error updating prices on visibility change:', error);
                    // Portfolio already rendered, just update with new prices if successful
                });
            }, 100);
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    addCoinBtn.addEventListener('click', openModal);
    cancelBtn.addEventListener('click', closeModal);
    addBtn.addEventListener('click', addCoin);
    
    // Edit modal listeners
    editCloseBtn.addEventListener('click', closeEditModal);
    editUpdateBtn.addEventListener('click', updateCoin);
    editRemoveBtn.addEventListener('click', () => {
        showConfirmDialog(
            'Are you sure you want to remove this coin from your portfolio?',
            () => removeCoinFromEdit()
        );
    });
    
    // Confirmation modal listeners
    confirmCancelBtn.addEventListener('click', closeConfirmModal);
    confirmOkBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
            confirmCallback = null;
        }
        closeConfirmModal();
    });
    
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            closeConfirmModal();
        }
    });
    
    // Coin search functionality
    coinSearch.addEventListener('input', debounce(handleCoinSearch, 300));
    coinSearch.addEventListener('focus', () => {
        if (coinSearch.value.length >= 2) {
            handleCoinSearch({ target: coinSearch });
        }
    });
    
    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!editModal.classList.contains('hidden')) {
                closeEditModal();
            }
            if (!confirmModal.classList.contains('hidden')) {
                closeConfirmModal();
            }
            if (avatarModal && !avatarModal.classList.contains('hidden')) {
                closeAvatarModal();
            }
            closeMobileMenu();
        }
    });
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!coinSearch.contains(e.target) && !coinSuggestions.contains(e.target)) {
            coinSuggestions.style.display = 'none';
        }
    });

    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openAvatarModal();
        });
    }

    if (avatarCloseBtn) {
        avatarCloseBtn.addEventListener('click', closeAvatarModal);
    }

    if (avatarCancelBtn) {
        avatarCancelBtn.addEventListener('click', closeAvatarModal);
    }

    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', handleAvatarFileSelection);
    }

    if (avatarUploadBtn) {
        avatarUploadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await uploadAvatar();
        });
    }

    if (avatarModal) {
        avatarModal.addEventListener('click', (e) => {
            if (e.target === avatarModal) {
                closeAvatarModal();
            }
        });
    }

    // Event delegation for edit buttons (since they're created dynamically)
    portfolioContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            const coinId = editBtn.getAttribute('data-coin-id');
            if (coinId) {
                e.preventDefault();
                openEditModal(coinId);
            }
        }
    });
    
    // Auth event listeners
    const handleSignIn = async () => {
        // Try to use saved password first, otherwise use input value
        let password = authPassword?.value;
        
        // If password field is empty, try to use saved password
        if (!password || password.trim() === '') {
            const savedPassword = getPasswordFromStorage();
            if (savedPassword) {
                password = savedPassword;
            }
        }
        
        if (!password) {
            showAuthError('Please enter your password');
            return;
        }
        
        showAuthStatus('Signing in...', 'loading');
        const result = await signIn(password);
        
        if (result.success) {
            showAuthStatus('Signed in successfully!', 'success');
            await loadPortfolioFromServer();
            
            // Wait a moment to ensure localStorage is updated before fetching prices
            // This prevents trackAPIUsage() from reading empty localStorage
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Start fetching prices immediately (don't wait)
            if (portfolio.length > 0) {
                updatePrices().catch(error => {
                    console.error('Error updating prices after login:', error);
                });
            }
            
            // Check if we migrated data (only show once)
            const migrationShown = localStorage.getItem('portfolioMigrationShown');
            const localPortfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
            if (!migrationShown && localPortfolio.length > 0 && portfolio.length === localPortfolio.length) {
                showAuthStatus('Signed in! Your portfolio has been migrated to the cloud.', 'success');
                localStorage.setItem('portfolioMigrationShown', 'true');
            }
            
            setTimeout(() => {
                authModal?.classList.add('hidden');
                renderPortfolio();
                updateSummary();
                updateUserUI();
            }, 1500);
        } else {
            showAuthError(result.error || 'Failed to sign in');
        }
    };
    
    if (signInBtn) {
        signInBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleSignIn();
        });
    }
    
    // Allow Enter key to submit password
    if (authPassword) {
        authPassword.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await handleSignIn();
            }
        });
    }
    
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            await signOut();
            renderPortfolio();
            updateSummary();
            updateUserUI();
            authModal?.classList.remove('hidden');
            closeMobileMenu();
        });
    }
    
    // Change password modal
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            changePasswordModal?.classList.remove('hidden');
            if (currentPassword) currentPassword.value = '';
            if (newPassword) newPassword.value = '';
            if (confirmNewPassword) confirmNewPassword.value = '';
            if (changePasswordError) changePasswordError.style.display = 'none';
            if (changePasswordStatus) changePasswordStatus.style.display = 'none';
            closeMobileMenu();
        });
    }
    
    if (changePasswordCloseBtn) {
        changePasswordCloseBtn.addEventListener('click', closeChangePasswordModal);
    }
    
    if (changePasswordCancelBtn) {
        changePasswordCancelBtn.addEventListener('click', closeChangePasswordModal);
    }
    
    if (changePasswordSubmitBtn) {
        changePasswordSubmitBtn.addEventListener('click', async () => {
            const currentPwd = currentPassword?.value || '';
            const newPwd = newPassword?.value || '';
            const confirmPwd = confirmNewPassword?.value || '';
            
            if (!currentPwd || !newPwd || !confirmPwd) {
                showChangePasswordError('All fields are required');
                return;
            }
            
            if (newPwd.length < 6) {
                showChangePasswordError('New password must be at least 6 characters');
                return;
            }
            
            if (newPwd !== confirmPwd) {
                showChangePasswordError('New passwords do not match');
                return;
            }
            
            showChangePasswordStatus('Changing password...', 'loading');
            const result = await changePassword(currentPwd, newPwd);
            
            if (result.success) {
                // Clear saved password from localStorage since it's now invalid
                clearPasswordFromStorage();
                showChangePasswordStatus('Password changed successfully!', 'success');
                setTimeout(() => {
                    closeChangePasswordModal();
                }, 1500);
            } else {
                showChangePasswordError(result.error || 'Failed to change password');
            }
        });
    }
    
    // Close modals on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (authModal && !authModal.classList.contains('hidden') && isAuthenticated) {
                authModal.classList.add('hidden');
            }
            if (changePasswordModal && !changePasswordModal.classList.contains('hidden')) {
                closeChangePasswordModal();
            }
            if (avatarModal && !avatarModal.classList.contains('hidden')) {
                closeAvatarModal();
            }
            closeMobileMenu();
        }
    });
    
    // Close change password modal on outside click
    if (changePasswordModal) {
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) {
                closeChangePasswordModal();
            }
        });
    }
}

function closeChangePasswordModal() {
    if (changePasswordModal) {
        changePasswordModal.classList.add('hidden');
    }
    if (currentPassword) currentPassword.value = '';
    if (newPassword) newPassword.value = '';
    if (confirmNewPassword) confirmNewPassword.value = '';
    if (changePasswordError) changePasswordError.style.display = 'none';
    if (changePasswordStatus) changePasswordStatus.style.display = 'none';
}

function showChangePasswordError(message) {
    if (changePasswordError) {
        changePasswordError.textContent = message;
        changePasswordError.style.display = 'block';
    }
    if (changePasswordStatus) {
        changePasswordStatus.style.display = 'none';
    }
}

function showChangePasswordStatus(message, type) {
    if (changePasswordStatus) {
        changePasswordStatus.textContent = message;
        changePasswordStatus.className = `auth-status ${type}`;
        changePasswordStatus.style.display = 'block';
    }
    if (changePasswordError) {
        changePasswordError.style.display = 'none';
    }
}

function clearAvatarError() {
    if (avatarError) {
        avatarError.style.display = 'none';
        avatarError.textContent = '';
    }
}

function showAvatarError(message) {
    if (avatarError) {
        avatarError.textContent = message;
        avatarError.style.display = 'block';
    }
}

function updateAvatarPreview(source) {
    if (!avatarPreviewImage || !avatarPreviewFallback) {
        return;
    }

    if (source) {
        avatarPreviewImage.src = source;
        avatarPreviewImage.style.display = 'block';
        avatarPreviewFallback.style.display = 'none';
    } else {
        avatarPreviewImage.removeAttribute('src');
        avatarPreviewImage.style.display = 'none';
        avatarPreviewFallback.style.display = 'flex';
    }
}

function setUserAvatar(avatarUrl) {
    const hasAvatar = typeof avatarUrl === 'string' && avatarUrl.trim() !== '';

    if (userAvatarImage) {
        if (hasAvatar) {
            userAvatarImage.src = avatarUrl;
            userAvatarImage.style.display = 'inline-block';
        } else {
            userAvatarImage.removeAttribute('src');
            userAvatarImage.style.display = 'none';
        }
    }

    if (userName) {
        if (hasAvatar) {
            userName.classList.add('has-avatar');
        } else {
            userName.classList.remove('has-avatar');
        }
    }
}

function isBodyModalLockNeeded() {
    const trackedModals = [authModal, modal, editModal, confirmModal, changePasswordModal, avatarModal];
    return trackedModals.some(el => el && !el.classList.contains('hidden'));
}

function resetAvatarModal() {
    selectedAvatarFile = null;
    clearAvatarError();
    if (avatarFileInput) {
        avatarFileInput.value = '';
    }
    if (avatarUploadBtn) {
        avatarUploadBtn.disabled = true;
        avatarUploadBtn.textContent = 'Upload';
    }
    const existingAvatarUrl = currentUser?.avatarUrl || null;
    updateAvatarPreview(existingAvatarUrl);
}

function openAvatarModal() {
    if (!avatarModal) return;
    closeMobileMenu();
    resetAvatarModal();
    avatarModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeAvatarModal() {
    if (!avatarModal) return;
    avatarModal.classList.add('hidden');
    if (!isBodyModalLockNeeded()) {
        document.body.classList.remove('modal-open');
    }
    selectedAvatarFile = null;
}

function handleAvatarFileSelection(event) {
    if (!avatarUploadBtn) return;
    clearAvatarError();
    selectedAvatarFile = null;
    avatarUploadBtn.disabled = true;

    const file = event.target.files?.[0];
    if (!file) {
        updateAvatarPreview(currentUser?.avatarUrl || null);
        return;
    }

    if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type)) {
        showAvatarError('Unsupported file type. Use PNG, JPG, or WebP.');
        updateAvatarPreview(null);
        return;
    }

    if (file.size > AVATAR_MAX_FILE_SIZE) {
        showAvatarError('File exceeds maximum size of 1MB.');
        updateAvatarPreview(null);
        return;
    }

    selectedAvatarFile = file;
    avatarUploadBtn.disabled = false;

    const reader = new FileReader();
    reader.onload = (e) => {
        updateAvatarPreview(e.target?.result || null);
    };
    reader.readAsDataURL(file);
}

async function uploadAvatar() {
    if (!selectedAvatarFile) {
        showAvatarError('Choose an image before uploading.');
        return;
    }

    if (!avatarUploadBtn) return;

    const formData = new FormData();
    formData.append('avatar', selectedAvatarFile);

    avatarUploadBtn.disabled = true;
    const originalText = avatarUploadBtn.textContent;
    avatarUploadBtn.textContent = 'Uploading...';

    try {
        const response = await fetch('api/avatar.php', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || `Upload failed (${response.status})`);
        }

        if (currentUser) {
            currentUser.avatarUrl = data.avatarUrl;
        }
        setUserAvatar(data.avatarUrl);
        closeAvatarModal();
    } catch (error) {
        showAvatarError(error.message || 'Failed to upload avatar.');
        if (avatarUploadBtn) {
            avatarUploadBtn.disabled = false;
        }
        return;
    } finally {
        if (avatarUploadBtn) {
            avatarUploadBtn.textContent = originalText;
            avatarUploadBtn.disabled = !selectedAvatarFile;
        }
    }
}

function updateUserUI() {
    closeMobileMenu();
    const isLoggedIn = isAuthenticated && currentUser;
    if (userNameText) {
        userNameText.textContent = isLoggedIn && currentUser?.email ? currentUser.email : 'User';
    }
    setUserAvatar(isLoggedIn ? currentUser?.avatarUrl || null : null);
    if (isLoggedIn) {
        if (userInfo) userInfo.style.display = 'block';
        if (authModal) authModal.classList.add('hidden');
        if (addCoinBtn) addCoinBtn.style.display = 'block';
        document.body.classList.remove('modal-open');
        if (authPassword) authPassword.value = '';
    } else {
        if (userInfo) userInfo.style.display = 'none';
        if (authModal) authModal.classList.remove('hidden');
        if (addCoinBtn) addCoinBtn.style.display = 'none';
        document.body.classList.add('modal-open');
        if (authPassword) authPassword.value = '';
    }
}

function showAuthError(message) {
    if (authError) {
        authError.textContent = message;
        authError.style.display = 'block';
    }
    if (authStatus) {
        authStatus.style.display = 'none';
    }
}

function showAuthStatus(message, type) {
    if (authStatus) {
        authStatus.textContent = message;
        authStatus.className = `auth-status ${type}`;
        authStatus.style.display = 'block';
    }
    if (authError) {
        authError.style.display = 'none';
    }
}

// Setup drag and drop for coin cards
function setupDragAndDrop() {
    const cards = portfolioContainer.querySelectorAll('.coin-card');
    let draggedElement = null;
    let draggedIndex = -1;
    
    cards.forEach((card) => {
        card.addEventListener('dragstart', (e) => {
            // Prevent dragging when clicking edit button
            if (e.target.closest('.edit-btn')) {
                e.preventDefault();
                return;
            }
            
            draggedElement = card;
            draggedIndex = parseInt(card.getAttribute('data-coin-index'));
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedIndex.toString());
        });
        
        card.addEventListener('dragend', (e) => {
            card.classList.remove('dragging');
            cards.forEach(c => {
                c.classList.remove('drag-over');
                c.classList.remove('drag-before');
            });
            
            // Calculate final position and reorder if needed
            if (draggedElement) {
                const allCards = Array.from(portfolioContainer.querySelectorAll('.coin-card'));
                const newIndex = allCards.indexOf(draggedElement);
                
                if (draggedIndex !== -1 && newIndex !== -1 && draggedIndex !== newIndex) {
                    // Reorder the portfolio array
                    loadPortfolio();
                    const [movedItem] = portfolio.splice(draggedIndex, 1);
                    portfolio.splice(newIndex, 0, movedItem);
                    
                    savePortfolio();
                    renderPortfolio();
                }
            }
            
            draggedElement = null;
            draggedIndex = -1;
        });
        
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (!draggedElement || card === draggedElement) return;
            
            const rect = card.getBoundingClientRect();
            const mouseY = e.clientY;
            const cardMiddle = rect.top + rect.height / 2;
            
            // Determine if we should insert before or after this card
            const insertBefore = mouseY < cardMiddle;
            
            // Remove all drag classes first
            cards.forEach(c => {
                c.classList.remove('drag-over', 'drag-before');
            });
            
            // Add appropriate class
            if (insertBefore) {
                card.classList.add('drag-before');
            } else {
                card.classList.add('drag-over');
            }
            
            // Move the dragged card in DOM for real-time positioning
            if (insertBefore) {
                portfolioContainer.insertBefore(draggedElement, card);
            } else {
                const nextCard = card.nextElementSibling;
                if (nextCard) {
                    portfolioContainer.insertBefore(draggedElement, nextCard);
                } else {
                    portfolioContainer.appendChild(draggedElement);
                }
            }
        });
        
        card.addEventListener('dragleave', (e) => {
            // Only remove class if we're actually leaving the card
            if (!card.contains(e.relatedTarget)) {
                card.classList.remove('drag-over', 'drag-before');
            }
        });
        
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('drag-over', 'drag-before');
        });
    });
}

// Setup Page Visibility API
function setupPageVisibility() {
    document.addEventListener('visibilitychange', () => {
        const wasVisible = isTabVisible;
        isTabVisible = !document.hidden;
        
        if (isTabVisible && !wasVisible) {
            // Tab became visible - resume auto-refresh
            startAutoRefresh();
        } else if (!isTabVisible && wasVisible) {
            // Tab became hidden - pause auto-refresh
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
            // Keep countdown running to show paused state
        }
    });
}


// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle coin search
function handleCoinSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) {
        coinSuggestions.style.display = 'none';
        coinSuggestions.innerHTML = '';
        return;
    }

    const matches = availableCoins
        .filter(coin => 
            coin.name.toLowerCase().includes(query) || 
            coin.symbol.toLowerCase().includes(query) ||
            coin.id.toLowerCase().includes(query)
        )
        .slice(0, 20); // Show top 20 matches

    displaySuggestions(matches);
}

// Display coin suggestions
function displaySuggestions(matches) {
    coinSuggestions.innerHTML = '';
    
    if (matches.length === 0) {
        coinSuggestions.innerHTML = '<div class="suggestion-item">No coins found</div>';
        coinSuggestions.style.display = 'block';
        return;
    }

    matches.forEach(async (coin) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        // Try to get image, fetch if missing
        let imageUrl = coin.image || coin.large || '';
        if (!imageUrl) {
            // Try standard CoinGecko image path first
            imageUrl = `https://assets.coingecko.com/coins/images/${coin.id}/small/${coin.id}.png`;
        }
        
        const suggestionImgId = `suggestion-img-${coin.id}-${Date.now()}`;
        item.innerHTML = `
            <img id="${suggestionImgId}" src="${imageUrl}" alt="${coin.name}" onerror="handleSuggestionImageError('${coin.id}', '${suggestionImgId}')">
            <div class="coin-info">
                <div class="coin-name">${coin.name}</div>
                <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            coinSearch.value = coin.name;
            coinSelect.value = coin.id;
            coinSuggestions.style.display = 'none';
        });
        
        coinSuggestions.appendChild(item);
    });

    coinSuggestions.style.display = 'block';
}

// Handle suggestion image error
async function handleSuggestionImageError(coinId, imgId) {
    const imgElement = document.getElementById(imgId);
    if (!imgElement) return;
    
    const image = await fetchCoinImage(coinId);
    if (image) {
        imgElement.src = image;
        imgElement.onerror = null;
    } else {
        imgElement.src = `https://via.placeholder.com/24?text=${coinId.charAt(0).toUpperCase()}`;
    }
}

// Make function available globally
window.handleSuggestionImageError = handleSuggestionImageError;

// Load available coins from CoinGecko (full list for search)
async function loadAvailableCoins() {
    try {
        // First try to load from cache
        const cached = localStorage.getItem('coinGeckoList');
        if (cached) {
            const cachedData = JSON.parse(cached);
            const cacheTime = cachedData.timestamp || 0;
            // Use cache if less than 24 hours old
            if (Date.now() - cacheTime < 24 * 60 * 60 * 1000) {
                availableCoins = cachedData.coins || [];
                return;
            }
        }
        
        // Fetch full list of coins (has all coins, not just top 100)
        const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
        const coinsList = await response.json();
        
        // Fetch market data for images and better sorting
        const marketsResponse = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1');
        const marketsData = await marketsResponse.json();
        
        // Create a map of market data by id for faster lookup
        const marketMap = {};
        marketsData.forEach(coin => {
            marketMap[coin.id] = coin;
        });
        
        // Merge coins list with market data (for images)
        availableCoins = coinsList.map(coin => {
            const marketData = marketMap[coin.id];
            return {
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol,
                image: marketData?.image || '',
                large: marketData?.image || ''
            };
        });
        
        // Cache the result
        localStorage.setItem('coinGeckoList', JSON.stringify({
            coins: availableCoins,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('Error loading coins:', error);
        // Fallback to a smaller list if full list fails
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1');
            availableCoins = await response.json();
        } catch (fallbackError) {
            console.error('Error loading fallback coins:', fallbackError);
            availableCoins = [];
        }
    }
}

// Fetch prices from CoinGecko API
async function updatePrices() {
    if (portfolio.length === 0) {
        updateSummary();
        return;
    }

    const coinIds = portfolio.map(coin => coin.id).join(',');
    
    try {
        // Use simple/price endpoint which includes 24h change immediately
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`);
        
        if (!response.ok) {
            // Handle different error statuses
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else if (response.status === 404) {
                throw new Error('Coin not found. Some coins may not be available.');
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        const data = await response.json();
        
        // Check if we got data back
        if (!data || Object.keys(data).length === 0) {
            throw new Error('No price data received');
        }
        
        // Merge new price data with existing (don't overwrite, merge)
        priceData = { ...priceData, ...data };
        
        // Track API usage
        trackAPIUsage();
        
        renderPortfolio();
        updateSummary();
        updateLastUpdated();
        
        // Schedule record update check after prices change
        scheduleRecordUpdate();
    } catch (error) {
        console.error('Error fetching prices:', error);
        
        // Always render portfolio, even if prices failed - show "Loading..." states
        // This ensures coins are visible even when API calls fail
        renderPortfolio();
        updateSummary();
        
        // Re-throw to allow caller to handle if needed
        throw error;
    }
}

// Render portfolio cards
function renderPortfolio() {
    if (portfolio.length === 0) {
        portfolioContainer.innerHTML = `
            <div class="empty-state">
                <p class="empty-text">No coins added yet. Click "Add Coin" to get started!</p>
            </div>
        `;
        return;
    }

    portfolioContainer.innerHTML = portfolio.map((coin, index) => {
        const hasPriceData = priceData[coin.id];
        const price = hasPriceData?.usd || 0;
        const change24h = hasPriceData?.usd_24h_change || 0;
        const value = price * coin.quantity;
        const changeClass = hasPriceData ? (change24h >= 0 ? 'positive' : 'negative') : '';
        const bgClass = hasPriceData ? (change24h >= 0 ? 'pulse-green' : 'pulse-red') : '';
        
        // Use coin image or placeholder
        const coinImage = coin.image || `https://via.placeholder.com/40?text=${coin.symbol.charAt(0).toUpperCase()}`;
        const imgId = `coin-img-${coin.id}`;
        
        return `
            <div class="coin-card ${bgClass}" draggable="true" data-coin-index="${index}" data-coin-id="${coin.id}">
                <div class="coin-header">
                    <div class="coin-info">
                        <img id="${imgId}" src="${coinImage}" alt="${coin.name}" class="coin-logo" onerror="handleImageError('${coin.id}', this.id)">
                        <div>
                            <div class="coin-name">${coin.name}</div>
                            <div class="coin-symbol">${coin.symbol}</div>
                        </div>
                    </div>
                    <button class="edit-btn" data-coin-id="${coin.id}" title="Edit coin" draggable="false">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="coin-details">
                    <div class="coin-detail-row">
                        <span class="detail-label">Price</span>
                        <span class="detail-value">${hasPriceData ? '$' + formatPrice(price) : '<span style="opacity: 0.5;">Loading...</span>'}</span>
                    </div>
                    <div class="coin-detail-row">
                        <span class="detail-label">Quantity</span>
                        <span class="detail-value">${formatQuantity(coin.quantity)}</span>
                    </div>
                    <div class="coin-detail-row">
                        <span class="detail-label">24h Change</span>
                        <span class="detail-value change-small portfolio-change ${changeClass}">
                            ${hasPriceData ? (change24h >= 0 ? '+' : '') + change24h.toFixed(2) + '%' : '<span style="opacity: 0.5;">-</span>'}
                        </span>
                    </div>
                    <div class="coin-detail-row">
                        <span class="detail-label">Value</span>
                        <span class="detail-value large">${hasPriceData ? formatValue(value) : '<span style="opacity: 0.5;">Loading...</span>'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Setup drag and drop handlers
    setupDragAndDrop();
    
    // Fetch missing images after rendering
    portfolio.forEach(async (coin) => {
        if (!coin.image) {
            const image = await fetchCoinImage(coin.id);
            if (image) {
                coin.image = image;
                savePortfolio();
                // Update the image in the DOM
                const img = document.querySelector(`.coin-card img[alt="${coin.name}"]`);
                if (img && img.src.includes('placeholder')) {
                    img.src = image;
                }
            }
        }
    });
}

// Format price
function formatPrice(price) {
    if (price >= 1) {
        return price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 6});
    } else {
        return price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 8});
    }
}

// Format quantity
function formatQuantity(quantity) {
    return quantity.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 8});
}

// Format value
function formatValue(value) {
    if (value >= 0.01) {
        return '$' + value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    } else {
        return '$' + value.toFixed(6);
    }
}

function formatPortfolioRecord(value) {
    if (value === null || value === undefined) {
        return '—';
    }

    const absValue = Math.abs(value);
    let options;

    if (absValue === 0) {
        options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    } else if (absValue >= 1) {
        options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    } else if (absValue >= 0.01) {
        options = { minimumFractionDigits: 2, maximumFractionDigits: 4 };
    } else {
        options = { minimumFractionDigits: 4, maximumFractionDigits: 6 };
    }

    return '$' + value.toLocaleString('en-US', options);
}

function updatePortfolioRecordsDisplay() {
    console.log('updatePortfolioRecordsDisplay called with stats:', {
        highestValue: portfolioStats.highestValue,
        highestValueTimestamp: portfolioStats.highestValueTimestamp,
        lowestValue: portfolioStats.lowestValue,
        lowestValueTimestamp: portfolioStats.lowestValueTimestamp
    });
    
    if (highestValueEl) {
        highestValueEl.textContent = formatPortfolioRecord(portfolioStats.highestValue);
        
        // Show timestamp icon and tooltip if timestamp exists
        const highestTimestampEl = document.getElementById('highestValueTimestamp');
        if (highestTimestampEl) {
            if (portfolioStats.highestValueTimestamp) {
                const date = new Date(portfolioStats.highestValueTimestamp);
                const formattedDate = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                });
                highestTimestampEl.setAttribute('title', `Recorded on ${formattedDate}`);
                highestTimestampEl.style.display = 'inline-block';
                console.log('Showing highest timestamp icon with date:', formattedDate);
            } else {
                highestTimestampEl.style.display = 'none';
                console.log('Hiding highest timestamp icon (no timestamp)');
            }
        } else {
            console.log('highestValueTimestamp element not found');
        }
    }
    if (lowestValueEl) {
        lowestValueEl.textContent = formatPortfolioRecord(portfolioStats.lowestValue);
        
        // Show timestamp icon and tooltip if timestamp exists
        const lowestTimestampEl = document.getElementById('lowestValueTimestamp');
        if (lowestTimestampEl) {
            if (portfolioStats.lowestValueTimestamp) {
                const date = new Date(portfolioStats.lowestValueTimestamp);
                const formattedDate = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                });
                lowestTimestampEl.setAttribute('title', `Recorded on ${formattedDate}`);
                lowestTimestampEl.style.display = 'inline-block';
                console.log('Showing lowest timestamp icon with date:', formattedDate);
            } else {
                lowestTimestampEl.style.display = 'none';
                console.log('Hiding lowest timestamp icon (no timestamp)');
            }
        } else {
            console.log('lowestValueTimestamp element not found');
        }
    }
}

// Schedule portfolio record update after delay (to allow time to correct mistakes)
function scheduleRecordUpdate() {
    // Clear any existing timeout
    if (recordUpdateTimeout) {
        clearTimeout(recordUpdateTimeout);
        recordUpdateTimeout = null;
    }
    
    // Don't update records if portfolio is empty
    if (portfolio.length === 0) {
        console.log('Portfolio is empty. Skipping record update.');
        return;
    }
    
    // Calculate current portfolio value
    const currentValue = portfolio.reduce((sum, coin) => {
        const price = priceData[coin.id]?.usd || 0;
        return sum + (price * coin.quantity);
    }, 0);
    
    if (typeof currentValue !== 'number' || !Number.isFinite(currentValue) || currentValue <= 0) {
        return;
    }
    
    console.log(`Portfolio changed. Will update records in ${RECORD_UPDATE_DELAY / 1000 / 60} minutes if value remains stable...`);
    
    // Set timeout to update records after delay
    recordUpdateTimeout = setTimeout(() => {
        updatePortfolioRecords(currentValue);
        recordUpdateTimeout = null;
    }, RECORD_UPDATE_DELAY);
}

// Actually update portfolio records (called after delay)
function updatePortfolioRecords(currentValue) {
    // Don't update records if portfolio is empty (to avoid $0 lowest value)
    if (portfolio.length === 0) {
        console.log('Portfolio is empty. Skipping record update.');
        return;
    }
    
    if (typeof currentValue !== 'number' || !Number.isFinite(currentValue) || currentValue <= 0) {
        return;
    }

    let shouldSave = false;

    // Check for highest value
    if (portfolioStats.highestValue === null || currentValue > portfolioStats.highestValue) {
        portfolioStats.highestValue = currentValue;
        portfolioStats.highestValueTimestamp = new Date().toISOString();
        shouldSave = true;
        console.log(`✅ New highest portfolio value recorded: $${currentValue.toLocaleString()}`);
    }

    // Check for lowest value
    if (portfolioStats.lowestValue === null || currentValue < portfolioStats.lowestValue) {
        portfolioStats.lowestValue = currentValue;
        portfolioStats.lowestValueTimestamp = new Date().toISOString();
        shouldSave = true;
        console.log(`✅ New lowest portfolio value recorded: $${currentValue.toLocaleString()}`);
    }

    if (shouldSave) {
        savePortfolioStats();
        updatePortfolioRecordsDisplay();
    }
}

// Update portfolio summary
function updateSummary() {
    if (portfolio.length === 0) {
        animateNumberChange(totalValueEl, 0);
        totalChangeEl.textContent = '$0.00 (0.00%)';
        totalChangeEl.className = 'portfolio-change';
        const body = document.body;
        body.classList.remove('portfolio-low', 'portfolio-high');
        body.classList.add('portfolio-low'); // 0 is less than 100k, so red
        totalValueEl.classList.remove('portfolio-low', 'portfolio-high');
        totalValueEl.classList.add('portfolio-low'); // 0 is less than 100k, so red
        if (lastUpdatedEl) lastUpdatedEl.textContent = 'Never';
        updatePortfolioRecordsDisplay();
        return;
    }

    const totalValue = portfolio.reduce((sum, coin) => {
        const price = priceData[coin.id]?.usd || 0;
        return sum + (price * coin.quantity);
    }, 0);

    // Calculate 24h change: sum of (value * 24h_change_percentage / 100) for each coin
    const totalChange24h = portfolio.reduce((sum, coin) => {
        const price = priceData[coin.id]?.usd || 0;
        const change24h = priceData[coin.id]?.usd_24h_change || 0;
        const coinValue = price * coin.quantity;
        // Calculate dollar change for this coin: value * (change% / 100)
        return sum + (coinValue * (change24h / 100));
    }, 0);

    // Calculate percentage change: total change / previous total value * 100
    // Previous total value = current total - change
    const previousTotal = totalValue - totalChange24h;
    const totalChangePercent = previousTotal > 0 ? (totalChange24h / previousTotal) * 100 : 0;

    // Animate portfolio value like a clock
    animateNumberChange(totalValueEl, totalValue);
    
    // Apply background color based on portfolio value
    const body = document.body;
    body.classList.remove('portfolio-low', 'portfolio-high');
    totalValueEl.classList.remove('portfolio-low', 'portfolio-high');
    if (totalValue < 100000) {
        body.classList.add('portfolio-low');
        totalValueEl.classList.add('portfolio-low');
    } else if (totalValue >= 1000000) {
        body.classList.add('portfolio-high');
        totalValueEl.classList.add('portfolio-high');
    }
    
    const changeClass = totalChange24h >= 0 ? 'positive' : 'negative';
    const sign = totalChange24h >= 0 ? '+' : '-';
    totalChangeEl.className = `portfolio-change ${changeClass}`;
    totalChangeEl.textContent = `${sign}$${Math.abs(totalChange24h).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${sign}${Math.abs(totalChangePercent).toFixed(2)}%)`;

    const hasCompletePriceData = portfolio.every(coin => {
        const price = priceData[coin.id]?.usd;
        return typeof price === 'number' && Number.isFinite(price);
    });

    updatePortfolioRecordsDisplay();
}

// Animate number changes like an old clock
let animationFrameIds = new Map();

function animateNumberChange(element, newValue) {
    // Cancel any existing animation for this element
    if (animationFrameIds.has(element)) {
        cancelAnimationFrame(animationFrameIds.get(element));
    }
    
    const oldText = element.textContent || '$0.00';
    const oldValue = parseFloat(oldText.replace(/[^0-9.-]/g, '')) || 0;
    const newValueNum = parseFloat(newValue) || 0;
    
    if (Math.abs(oldValue - newValueNum) < 0.01) {
        return; // No significant change
    }
    
    const duration = 800; // Animation duration in ms
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = oldValue + (newValueNum - oldValue) * easeProgress;
        
        element.textContent = '$' + currentValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        if (progress < 1) {
            const frameId = requestAnimationFrame(update);
            animationFrameIds.set(element, frameId);
        } else {
            // Final value
            element.textContent = '$' + newValueNum.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            animationFrameIds.delete(element);
        }
    }
    
    const frameId = requestAnimationFrame(update);
    animationFrameIds.set(element, frameId);
}

// Update last updated timestamp
function updateLastUpdated() {
    if (!lastUpdatedEl) return;
    const now = new Date();
    lastUpdatedEl.textContent = now.toLocaleTimeString();
}

// Modal functions
function openModal() {
    closeMobileMenu();
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    quantityInput.value = '';
    coinSearch.value = '';
    coinSelect.value = '';
    coinSuggestions.style.display = 'none';
    coinSuggestions.innerHTML = '';
}

// Fetch coin image from CoinGecko
async function fetchCoinImage(coinId) {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.image?.small || data.image?.thumb || data.image?.large || null;
    } catch (error) {
        console.error(`Error fetching image for ${coinId}:`, error);
        return null;
    }
}

// Add coin to portfolio
async function addCoin() {
    const coinId = coinSelect.value;
    const quantity = parseFloat(quantityInput.value);

    if (!coinId || !quantity || quantity <= 0) {
        alert('Please select a coin and enter a valid quantity');
        return;
    }

    const coinData = availableCoins.find(c => c.id === coinId);
    
    if (!coinData) {
        alert('Coin not found. Please try searching again.');
        return;
    }

    // Check if coin already exists
    const existingCoin = portfolio.find(c => c.id === coinId);
    if (existingCoin) {
        existingCoin.quantity += quantity;
    } else {
        // Fetch image if missing
        let image = coinData.image || coinData.large || '';
        if (!image) {
            image = await fetchCoinImage(coinId) || '';
        }
        
        portfolio.push({
            id: coinId,
            name: coinData.name,
            symbol: coinData.symbol.toUpperCase(),
            quantity: quantity,
            image: image
        });
    }

    savePortfolio();
    
    // Render portfolio immediately so coin appears right away
    renderPortfolio();
    
    // Schedule record update after delay (gives time to correct mistakes)
    scheduleRecordUpdate();
    updateSummary();
    
    // Then fetch fresh prices (don't await to avoid blocking UI)
    updatePrices().catch(error => {
        console.error('Error updating prices after adding coin:', error);
        // Portfolio is already rendered, so user can see the coin even if price fetch fails
        // Re-render to show the coin with "Loading..." state
        renderPortfolio();
        updateSummary();
    });
    
    closeModal();
}

// Open edit modal
function openEditModal(coinId) {
    if (!coinId) {
        console.error('No coinId provided');
        return;
    }
    
    loadPortfolio(); // Ensure we have latest data
    const coin = portfolio.find(c => c.id === coinId);
    
    if (!coin) {
        console.error('Coin not found:', coinId, 'Available coins:', portfolio.map(c => c.id));
        alert('Coin not found');
        return;
    }
    
    if (!editModal) {
        console.error('editModal element not found');
        return;
    }
    if (!editCoinId) {
        console.error('editCoinId element not found');
        return;
    }
    if (!editCoinName) {
        console.error('editCoinName element not found');
        return;
    }
    if (!editQuantityInput) {
        console.error('editQuantityInput element not found');
        return;
    }
    
    editCoinId.value = coin.id;
    editCoinName.value = `${coin.name} (${coin.symbol})`;
    editQuantityInput.value = coin.quantity;
    
    editModal.classList.remove('hidden');
}

// Close edit modal
function closeEditModal() {
    editModal.classList.add('hidden');
    editCoinId.value = '';
    editCoinName.value = '';
    editQuantityInput.value = '';
}

// Update coin quantity
function updateCoin() {
    const coinId = editCoinId.value;
    const quantity = parseFloat(editQuantityInput.value);
    
    if (!coinId || !quantity || quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
    }
    
    loadPortfolio(); // Ensure we have latest data
    const coin = portfolio.find(c => c.id === coinId);
    if (!coin) {
        alert('Coin not found');
        return;
    }
    
    coin.quantity = quantity;
    savePortfolio();
    renderPortfolio();
    updateSummary();
    
    // Schedule record update after delay (gives time to correct mistakes)
    scheduleRecordUpdate();
    
    // Update prices to reflect new quantity
    updatePrices().catch(error => {
        console.error('Error updating prices after editing coin:', error);
    });
    
    closeEditModal();
}

// Remove coin from edit modal
function removeCoinFromEdit() {
    const coinId = editCoinId.value;
    if (!coinId) return;
    
    loadPortfolio(); // Ensure we have latest data
    portfolio = portfolio.filter(coin => coin.id !== coinId);
    savePortfolio();
    renderPortfolio();
    updateSummary();
    
    // Schedule record update after delay (gives time to correct mistakes)
    scheduleRecordUpdate();
    
    closeEditModal();
}

// Custom confirmation dialog
let confirmCallback = null;

function showConfirmDialog(message, callback) {
    confirmMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
    confirmMessage.textContent = '';
}

// Make openEditModal available globally
window.openEditModal = openEditModal;

// Handle image error - fetch and update
async function handleImageError(coinId, imgId) {
    const imgElement = document.getElementById(imgId);
    if (!imgElement) return;
    
    // Try to fetch the image
    const image = await fetchCoinImage(coinId);
    if (image) {
        imgElement.src = image;
        imgElement.onerror = null; // Remove error handler after successful load
        
        // Update in portfolio data
        const coin = portfolio.find(c => c.id === coinId);
        if (coin && !coin.image) {
            coin.image = image;
            savePortfolio();
        }
    } else {
        // Keep placeholder if fetch fails
        imgElement.src = `https://via.placeholder.com/40?text=${coinId.charAt(0).toUpperCase()}`;
    }
}

// Make functions available globally for inline handlers
window.handleImageError = handleImageError;
window.fetchCoinImageAndUpdate = handleImageError;

// Load portfolio from localStorage
function loadPortfolio() {
    portfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
}

// Save portfolio to server or localStorage
async function savePortfolio() {
    await savePortfolioToServer();
    // Also save to localStorage as backup
    localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio));
}

function loadPortfolioStats() {
    try {
        const stored = JSON.parse(localStorage.getItem('portfolioStats'));
        if (stored && typeof stored === 'object') {
            return {
                highestValue: typeof stored.highestValue === 'number' ? stored.highestValue : null,
                lowestValue: typeof stored.lowestValue === 'number' ? stored.lowestValue : null,
                highestValueTimestamp: stored.highestValueTimestamp || null,
                lowestValueTimestamp: stored.lowestValueTimestamp || null
            };
        }
    } catch (error) {
        console.error('Error loading portfolio stats:', error);
    }
    return { 
        highestValue: null, 
        lowestValue: null,
        highestValueTimestamp: null,
        lowestValueTimestamp: null
    };
}

async function savePortfolioStats() {
    try {
        // Save to server (which includes stats)
        await savePortfolioToServer();
        // Also save to localStorage as backup
        localStorage.setItem('portfolioStats', JSON.stringify(portfolioStats));
    } catch (error) {
        console.error('Error saving portfolio stats:', error);
    }
}

// Auto-refresh prices every 1 minute
function startAutoRefresh() {
    // Only start if tab is visible
    if (!isTabVisible) {
        // Still show countdown even if paused
        if (!countdownInterval) {
            startCountdown();
        }
        return;
    }
    
    // Clear any existing intervals
    stopAutoRefresh();
    
    // Reset countdown
    countdownSeconds = 60;
    updateCountdown();
    
    // Refresh every 1 minute (60000 ms)
    refreshInterval = setInterval(() => {
        if (isTabVisible && portfolio.length > 0) {
            updatePrices();
            countdownSeconds = 60; // Reset countdown
        }
    }, 60000);
    
    // Start countdown timer
    startCountdown();
}

function startCountdown() {
    if (countdownInterval) return;
    
    countdownInterval = setInterval(() => {
        if (isTabVisible) {
            countdownSeconds--;
            updateCountdown();
            
            if (countdownSeconds <= 0) {
                countdownSeconds = 60;
            }
        } else {
            // When tab is hidden, show paused message
            if (refreshTimerEl) {
                refreshTimerEl.textContent = 'Auto-refresh paused (tab inactive)';
            }
        }
    }, 1000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function updateCountdown() {
    if (refreshTimerEl) {
        const minutes = Math.floor(countdownSeconds / 60);
        const seconds = countdownSeconds % 60;
        refreshTimerEl.textContent = `Next refresh in ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Initialize on page load
init();