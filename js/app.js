// State management
let portfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [];
let priceData = {};
let availableCoins = [];
let refreshInterval;
let countdownInterval;
let countdownSeconds = 60;
let isTabVisible = true;
let portfolioStats = loadPortfolioStats();


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
    
    usage.raw[today] = (usage.raw[today] || 0) + 1;
    localStorage.setItem('apiUsage', JSON.stringify(usage.raw));
    
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

updatePortfolioRecordsDisplay();

// Initialize app
async function init() {
    await loadAvailableCoins();
    updateAPIStats();
    
    // Initialize countdown display
    updateCountdown();
    
    // Always render portfolio first, even without prices
    renderPortfolio();
    updateSummary();
    
    // Then fetch fresh prices (don't block rendering)
    if (portfolio.length > 0) {
        updatePrices().catch(error => {
            console.error('Error updating prices on init:', error);
            // Portfolio is already rendered, so it will show with "Loading..." states
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
        }
    });
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!coinSearch.contains(e.target) && !coinSuggestions.contains(e.target)) {
            coinSuggestions.style.display = 'none';
        }
    });
    
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
    if (highestValueEl) {
        highestValueEl.textContent = formatPortfolioRecord(portfolioStats.highestValue);
    }
    if (lowestValueEl) {
        lowestValueEl.textContent = formatPortfolioRecord(portfolioStats.lowestValue);
    }
}

function updatePortfolioRecords(currentValue) {
    if (typeof currentValue !== 'number' || !Number.isFinite(currentValue)) {
        return;
    }

    let shouldSave = false;

    if (portfolioStats.highestValue === null || currentValue > portfolioStats.highestValue) {
        portfolioStats.highestValue = currentValue;
        shouldSave = true;
    }

    if (portfolioStats.lowestValue === null || currentValue < portfolioStats.lowestValue) {
        portfolioStats.lowestValue = currentValue;
        shouldSave = true;
    }

    if (shouldSave) {
        savePortfolioStats();
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

    if (hasCompletePriceData) {
        updatePortfolioRecords(totalValue);
    }

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

// Save portfolio to localStorage
function savePortfolio() {
    localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio));
}

function loadPortfolioStats() {
    try {
        const stored = JSON.parse(localStorage.getItem('portfolioStats'));
        if (stored && typeof stored === 'object') {
            return {
                highestValue: typeof stored.highestValue === 'number' ? stored.highestValue : null,
                lowestValue: typeof stored.lowestValue === 'number' ? stored.lowestValue : null
            };
        }
    } catch (error) {
        console.error('Error loading portfolio stats:', error);
    }
    return { highestValue: null, lowestValue: null };
}

function savePortfolioStats() {
    try {
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