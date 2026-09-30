document.addEventListener('DOMContentLoaded', () => {
    // --- Telegram WebApp Integration ---
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();
    }

    // --- State ---
    let appData = {
        breakfasts: [],
        sweet_breakfasts: [],
        lunches: [],
        dinners: [],
        cozy: [],
        freezer: [],
        party: [],
        sauces: [],
        dressings: [],
        snacks: []
    };
    let favorites = JSON.parse(localStorage.getItem('recipe_favorites_v3')) || [];
    let cart = JSON.parse(localStorage.getItem('recipe_cart_v1')) || [];
    let checkedIngredients = JSON.parse(localStorage.getItem('recipe_cart_checked_v1')) || {};
    let currentTab = 'breakfasts';
    let searchQuery = '';
    let shoppingViewMode = localStorage.getItem('recipe_cart_view_mode_v1') || 'categories';

    // Cooking Mode & Timer State
    let chefModeRecipe = null;
    let chefModeStepIndex = 0;
    let wakeLockSentinel = null;
    let activeTimer = null; // { totalSeconds, remainingSeconds, isRunning, label }
    let activeTimerInterval = null;
    let audioCtx = null;

    // --- DOM Elements ---
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    const headerFavBtn = document.getElementById('headerFavBtn');
    const headerFavBadge = document.getElementById('headerFavBadge');
    const mainTabsContainer = document.getElementById('mainTabs');
    const navArrowLeft = document.getElementById('navArrowLeft');
    const navArrowRight = document.getElementById('navArrowRight');
    const mainTabs = document.querySelectorAll('.tab-btn');
    const searchInput = document.getElementById('searchInput');
    const recipesGrid = document.getElementById('recipesGrid');
    const emptyState = document.getElementById('emptyState');
    const favoritesEmptyState = document.getElementById('favoritesEmptyState');
    
    // Recipe Modal Elements
    const recipeModal = document.getElementById('recipeModal');
    const modalClose = document.getElementById('modalClose');
    const modalBody = document.getElementById('modalBody');

    // Shopping List Elements
    const openShoppingBtn = document.getElementById('openShoppingBtn');
    const shoppingBadge = document.getElementById('shoppingBadge');
    const floatingCartBar = document.getElementById('floatingCartBar');
    const floatingCartCount = document.getElementById('floatingCartCount');
    const floatingCartSub = document.getElementById('floatingCartSub');
    const floatingOpenShoppingBtn = document.getElementById('floatingOpenShoppingBtn');
    const shoppingModal = document.getElementById('shoppingModal');
    const shoppingModalClose = document.getElementById('shoppingModalClose');
    const shoppingModalBody = document.getElementById('shoppingModalBody');
    const shoppingModalActions = document.getElementById('shoppingModalActions');
    const copyShoppingListBtn = document.getElementById('copyShoppingListBtn');
    const clearShoppingListBtn = document.getElementById('clearShoppingListBtn');
    const shoppingClearConfirm = document.getElementById('shoppingClearConfirm');
    const clearShoppingYesBtn = document.getElementById('clearShoppingYesBtn');
    const clearShoppingNoBtn = document.getElementById('clearShoppingNoBtn');
    const shoppingViewToggle = document.getElementById('shoppingViewToggle');
    const viewCategoriesBtn = document.getElementById('viewCategoriesBtn');
    const viewUnifiedBtn = document.getElementById('viewUnifiedBtn');
    const toastContainer = document.getElementById('toastContainer');

    // Chef Mode & Timer Elements
    const chefModeModal = document.getElementById('chefModeModal');
    const chefModeClose = document.getElementById('chefModeClose');
    const chefModeStepBadge = document.getElementById('chefModeStepBadge');
    const chefModeProgressFill = document.getElementById('chefModeProgressFill');
    const chefModeRecipeTitle = document.getElementById('chefModeRecipeTitle');
    const chefModeStepText = document.getElementById('chefModeStepText');
    const chefModeStepTimerWrap = document.getElementById('chefModeStepTimerWrap');
    const chefModePrevBtn = document.getElementById('chefModePrevBtn');
    const chefModeNextBtn = document.getElementById('chefModeNextBtn');

    // Floating Timer Widget Elements
    const activeTimerWidget = document.getElementById('activeTimerWidget');
    const timerWidgetTime = document.getElementById('timerWidgetTime');
    const timerWidgetToggleBtn = document.getElementById('timerWidgetToggleBtn');
    const timerPauseIcon = document.getElementById('timerPauseIcon');
    const timerPlayIcon = document.getElementById('timerPlayIcon');
    const timerWidgetStopBtn = document.getElementById('timerWidgetStopBtn');

    // Auth & Profile Elements
    const authGateOverlay = document.getElementById('authGateOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginErrorMsg = document.getElementById('loginErrorMsg');
    const headerProfileBtn = document.getElementById('headerProfileBtn');
    const profileModal = document.getElementById('profileModal');
    const profileModalClose = document.getElementById('profileModalClose');
    const profileUserDisplay = document.getElementById('profileUserDisplay');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const oldPasswordInput = document.getElementById('oldPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const passwordChangeErrorMsg = document.getElementById('passwordChangeErrorMsg');
    const passwordChangeSuccessMsg = document.getElementById('passwordChangeSuccessMsg');
    const logoutBtn = document.getElementById('logoutBtn');

    // --- Theme Handling ---
    const savedTheme = localStorage.getItem('recipe_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('recipe_theme', next);
        updateThemeIcons(next);
    });

    function updateThemeIcons(theme) {
        if (theme === 'light') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    }

    // --- Toast Notifications ---
    function showToast(message) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
            toast.style.transition = 'opacity 0.25s, transform 0.25s';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 250);
        }, 2200);
    }

    // --- Russian Grammar Helpers ---
    function formatRecipeCount(count) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod100 >= 11 && mod100 <= 19) return `${count}&nbsp;рецептов`;
        if (mod10 === 1) return `${count}&nbsp;рецепт`;
        if (mod10 >= 2 && mod10 <= 4) return `${count}&nbsp;рецепта`;
        return `${count}&nbsp;рецептов`;
    }

    function formatIngredientCount(count) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod100 >= 11 && mod100 <= 19) return `${count}&nbsp;ингредиентов`;
        if (mod10 === 1) return `${count}&nbsp;ингредиент`;
        if (mod10 >= 2 && mod10 <= 4) return `${count}&nbsp;ингредиента`;
        return `${count}&nbsp;ингредиентов`;
    }

    // --- Authentication & Security State (Supabase Cloud + Local Backup) ---
    const SUPABASE_URL = 'https://wmcrshretrerwvcjxper.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtY3JzaHJldHJlcnd2Y2p4cGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3ODg3NDgsImV4cCI6MjEwNjM2NDc0OH0.AdtBc5gYOqXljfdzVLjj7yYbExPYeXnIVfrcHan_4vM';
    let supabaseClient = null;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    }

    const AUTH_SESSION_KEY = 'recipe_user_session_v1';
    let currentSession = null;
    try {
        currentSession = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
    } catch (e) {
        currentSession = null;
    }

    // Dynamic local users storage helpers
    const LOCAL_USERS_KEY = 'recipe_registered_users_v1';

    // ── Canonical password table (version-controlled) ──────────────────────────
    // Whenever the chef/admin password is changed centrally, bump PASSWD_VER
    // and update CANONICAL_PASSWORDS. All devices that have an older version
    // (or the stale defaults) will be force-migrated on next page load.
    const PASSWD_VER_KEY = 'recipe_passwd_ver_v1';
    const PASSWD_VER = 3; // increment each time passwords change centrally
    const CANONICAL_PASSWORDS = {
        chef:  { password: 'Xsub6dfnv9!', email: 'chef@nnesterov.ru' },
        admin: { password: 'Xsub6dfnv9!', email: 'admin@nnesterov.ru' }
    };
    // ───────────────────────────────────────────────────────────────────────────

    function getLocalUsers() {
        let users = {};
        try {
            users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY)) || {};
        } catch (e) {
            users = {};
        }
        // Ensure baseline accounts exist without clobbering user-defined passwords
        let needsSave = false;
        if (!users['chef']) {
            users['chef'] = { password: CANONICAL_PASSWORDS.chef.password, email: 'chef@nnesterov.ru' };
            needsSave = true;
        }
        if (!users['admin']) {
            users['admin'] = { password: CANONICAL_PASSWORDS.admin.password, email: 'admin@nnesterov.ru' };
            needsSave = true;
        }
        if (needsSave) {
            try {
                localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
            } catch (e) {}
        }
        return users;
    }

    function saveLocalUsers(users) {
        try {
            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
        } catch (e) {}
    }

    // ── Versioned migration: force canonical passwords on stale devices ─────────
    (function migratePasswords() {
        try {
            const storedVer = parseInt(localStorage.getItem(PASSWD_VER_KEY) || '0', 10);
            if (storedVer < PASSWD_VER) {
                let users = {};
                try { users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY)) || {}; } catch (e) {}
                // Update each managed account to the canonical password
                for (const [name, creds] of Object.entries(CANONICAL_PASSWORDS)) {
                    users[name] = { ...creds };
                }
                localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
                localStorage.setItem(PASSWD_VER_KEY, String(PASSWD_VER));
            }
        } catch (e) {}
    })();
    // ───────────────────────────────────────────────────────────────────────────

    // Initialize baseline on load
    getLocalUsers();

    function checkAuthStatus() {
        if (!currentSession || !currentSession.token) {
            authGateOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            return false;
        }
        authGateOverlay.classList.add('hidden');
        document.body.style.overflow = '';
        if (profileUserDisplay) {
            profileUserDisplay.textContent = currentSession.username || 'Пользователь';
        }
        return true;
    }

    function loadRecipesData() {
        const headers = {};
        if (currentSession && currentSession.token) {
            headers['Authorization'] = `Bearer ${currentSession.token}`;
        }

        fetch('recipes_data.json', { headers })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    throw new Error('Unauthorized');
                }
                return res.json();
            })
            .then(data => {
                appData = data;
                handleHash();
                renderCurrentView();
                updateCartUI();
                updateFavoritesBadge();
            })
            .catch(err => {
                console.error('Failed to load recipe data:', err);
                if (err.message === 'Unauthorized') {
                    localStorage.removeItem(AUTH_SESSION_KEY);
                    currentSession = null;
                    checkAuthStatus();
                }
            });
    }

    // Initial Gate Check
    const isAuthenticated = checkAuthStatus();
    if (isAuthenticated) {
        loadRecipesData();
    }

    // --- Tab Switching ---
    const VALID_TABS = ['breakfasts', 'roti', 'tea', 'sweet_breakfasts', 'soups', 'mains', 'cozy', 'freezer', 'prep_preserves', 'party', 'sauces', 'dressings', 'snacks', 'favorites'];

    function switchTab(tabName) {
        if (!VALID_TABS.includes(tabName)) return;
        currentTab = tabName;
        mainTabs.forEach(b => {
            const isTarget = b.getAttribute('data-tab') === tabName;
            b.classList.toggle('active', isTarget);
        });

        if (headerFavBtn) {
            headerFavBtn.classList.toggle('active', tabName === 'favorites');
        }

        renderCurrentView();
    }

    mainTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
            window.location.hash = tab;
        });
    });

    if (headerFavBtn) {
        headerFavBtn.addEventListener('click', () => {
            if (currentTab === 'favorites') {
                switchTab('breakfasts');
                window.location.hash = 'breakfasts';
            } else {
                switchTab('favorites');
                window.location.hash = 'favorites';
            }
        });
    }

    // Scroll navigation tabs horizontally
    if (navArrowLeft && mainTabsContainer) {
        navArrowLeft.addEventListener('click', () => {
            mainTabsContainer.scrollBy({ left: -260, behavior: 'smooth' });
        });
    }

    if (navArrowRight && mainTabsContainer) {
        navArrowRight.addEventListener('click', () => {
            mainTabsContainer.scrollBy({ left: 260, behavior: 'smooth' });
        });
    }

    function handleHash() {
        const hash = window.location.hash.replace('#', '');
        if (hash.startsWith('recipe-')) {
            const recipeId = hash.replace('recipe-', '');
            openModal(recipeId);
        } else if (VALID_TABS.includes(hash)) {
            switchTab(hash);
        }
    }

    window.addEventListener('hashchange', handleHash);

    // --- Search ---
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderCurrentView();
    });

    // --- Helpers ---
    function getAllItems() {
        return [
            ...(appData.breakfasts || []),
            ...(appData.roti || []),
            ...(appData.tea || []),
            ...(appData.sweet_breakfasts || []),
            ...(appData.soups || []),
            ...(appData.mains || []),
            ...(appData.cozy || []),
            ...(appData.freezer || []),
            ...(appData.prep_preserves || []),
            ...(appData.party || []),
            ...(appData.sauces || []),
            ...(appData.dressings || []),
            ...(appData.snacks || [])
        ];
    }

    function getItemsForCurrentTab() {
        if (currentTab === 'favorites') {
            const all = getAllItems();
            return all.filter(item => favorites.includes(item.id));
        }
        return appData[currentTab] || [];
    }

    // --- Rendering Cards ---
    function renderCurrentView() {
        const rawItems = getItemsForCurrentTab();
        
        let filtered = rawItems.filter(item => {
            if (searchQuery) {
                const titleMatch = (item.title || '').toLowerCase().includes(searchQuery);
                const descMatch = (item.description || '').toLowerCase().includes(searchQuery);
                const noteMatch = (item.note || '').toLowerCase().includes(searchQuery);
                const fitsMatch = (item.fits || '').toLowerCase().includes(searchQuery);
                const fitsSaladMatch = (item.fits_salads || '').toLowerCase().includes(searchQuery);
                const fitsOtherMatch = (item.fits_other || '').toLowerCase().includes(searchQuery);
                const ingMatch = (item.ingredients || []).some(ing => (ing.name || '').toLowerCase().includes(searchQuery));
                if (!titleMatch && !descMatch && !ingMatch && !noteMatch && !fitsMatch && !fitsSaladMatch && !fitsOtherMatch) return false;
            }
            return true;
        });

        emptyState.classList.add('hidden');
        favoritesEmptyState.classList.add('hidden');

        if (currentTab === 'favorites' && rawItems.length === 0) {
            recipesGrid.innerHTML = '';
            favoritesEmptyState.classList.remove('hidden');
            return;
        }

        if (filtered.length === 0) {
            recipesGrid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        recipesGrid.innerHTML = filtered.map(item => createCardHtml(item)).join('');
        attachCardEvents();
    }

    function createCardHtml(item) {
        const isFav = favorites.includes(item.id);
        const inCart = cart.includes(item.id);
        const tag = item.category || 'Рецепт';
        const metaSecondary = item.servings ? item.servings : (item.calories ? `${item.calories} ККАЛ` : '');
        const imageHtml = item.image ? `
            <div class="card-image-wrap">
                <img src="${item.image}" alt="${item.title.replace(/&nbsp;/g, ' ')}" class="card-image" loading="lazy" />
            </div>
        ` : '';

        const heartIconSrc = isFav ? 'heart_filled.svg' : 'heart_outline.svg';

        return `
            <div class="recipe-card ${item.image ? 'has-image' : ''}" data-id="${item.id}">
                <div class="card-top">
                    <span class="card-tag">${tag}</span>
                    <button class="card-fav-btn ${isFav ? 'active' : ''}" data-id="${item.id}" aria-label="В избранное">
                        <img src="${heartIconSrc}" alt="" class="card-fav-icon" />
                    </button>
                </div>
                ${imageHtml}
                <h3 class="card-title">${item.title}</h3>
                <div class="card-bottom">
                    <div class="card-meta-info">
                        <span>${item.time_minutes} МИН</span>
                        ${metaSecondary ? `<span class="card-bottom-val">${metaSecondary}</span>` : ''}
                    </div>
                    <button class="card-cart-btn ${inCart ? 'active' : ''}" data-id="${item.id}" aria-label="В список покупок">
                        <span>${inCart ? 'В&nbsp;списке' : '+ В&nbsp;закупку'}</span>
                    </button>
                </div>
            </div>
        `;
    }

    function attachCardEvents() {
        recipesGrid.querySelectorAll('.recipe-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-fav-btn') || e.target.closest('.card-cart-btn')) return;
                const id = card.getAttribute('data-id');
                openModal(id);
            });
        });

        recipesGrid.querySelectorAll('.card-fav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                toggleFavorite(id);
            });
        });

        recipesGrid.querySelectorAll('.card-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                toggleCart(id);
            });
        });
    }

    // --- Favorites Logic ---
    function updateFavoritesBadge() {
        if (headerFavBadge) {
            headerFavBadge.textContent = favorites.length;
            if (favorites.length > 0) {
                headerFavBadge.classList.remove('hidden');
            } else {
                headerFavBadge.classList.add('hidden');
            }
        }
    }

    function toggleFavorite(id) {
        const index = favorites.indexOf(id);
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(id);
        }
        localStorage.setItem('recipe_favorites_v3', JSON.stringify(favorites));
        updateFavoritesBadge();

        if (currentTab === 'favorites') {
            renderCurrentView();
        } else {
            recipesGrid.querySelectorAll(`.card-fav-btn[data-id="${id}"]`).forEach(btn => {
                const isFav = favorites.includes(id);
                btn.classList.toggle('active', isFav);
                const img = btn.querySelector('.card-fav-icon');
                if (img) {
                    img.src = isFav ? 'heart_filled.svg' : 'heart_outline.svg';
                }
            });
        }
    }

    // --- Shopping List / Cart Logic ---
    function updateCartUI() {
        const allItems = getAllItems();
        const selectedRecipes = allItems.filter(r => cart.includes(r.id));
        const totalIngs = selectedRecipes.reduce((sum, r) => sum + (r.ingredients ? r.ingredients.length : 0), 0);

        // Header Badge
        if (shoppingBadge) {
            shoppingBadge.textContent = cart.length;
            if (cart.length > 0) {
                shoppingBadge.classList.remove('hidden');
                if (openShoppingBtn) openShoppingBtn.classList.add('has-items');
            } else {
                shoppingBadge.classList.add('hidden');
                if (openShoppingBtn) openShoppingBtn.classList.remove('has-items');
            }
        }

        // Floating Bar
        if (floatingCartBar) {
            if (cart.length > 0) {
                floatingCartCount.innerHTML = `В&nbsp;списке: ${formatRecipeCount(cart.length)}`;
                floatingCartSub.innerHTML = `${formatIngredientCount(totalIngs)} для&nbsp;похода в&nbsp;магазин`;
                floatingCartBar.classList.remove('hidden');
            } else {
                floatingCartBar.classList.add('hidden');
            }
        }

        // Card Buttons
        recipesGrid.querySelectorAll('.card-cart-btn').forEach(btn => {
            const id = btn.getAttribute('data-id');
            const inCart = cart.includes(id);
            btn.classList.toggle('active', inCart);
            btn.innerHTML = `<span>${inCart ? 'В&nbsp;списке' : '+ В&nbsp;закупку'}</span>`;
        });

        // Detail Modal Button
        const modalCartBtn = document.getElementById('modalCartBtn');
        if (modalCartBtn) {
            const id = modalCartBtn.getAttribute('data-id');
            const inCart = cart.includes(id);
            modalCartBtn.classList.toggle('active', inCart);
            modalCartBtn.innerHTML = `
                <img src="icon_cart.png" alt="" class="modal-btn-icon">
                <span>${inCart ? 'Убрать из&nbsp;списка покупок' : '+ Добавить в&nbsp;список покупок'}</span>
            `;
        }

        // Shopping Modal Content
        if (shoppingModal && shoppingModal.classList.contains('active')) {
            renderShoppingModalBody();
        }
    }

    function toggleCart(id) {
        const index = cart.indexOf(id);
        if (index > -1) {
            cart.splice(index, 1);
            showToast('Удалено из&nbsp;списка покупок');
        } else {
            cart.push(id);
            showToast('Добавлено в&nbsp;список покупок');
        }
        localStorage.setItem('recipe_cart_v1', JSON.stringify(cart));
        updateCartUI();
    }

    function clearCart() {
        cart = [];
        checkedIngredients = {};
        localStorage.setItem('recipe_cart_v1', JSON.stringify(cart));
        localStorage.setItem('recipe_cart_checked_v1', JSON.stringify(checkedIngredients));
        updateCartUI();
        showToast('Список покупок очищен');
    }

    function getAggregatedGroceries(selectedRecipes) {
        const itemMap = new Map();

        selectedRecipes.forEach(recipe => {
            const list = recipe.grocery || [];
            list.forEach(g => {
                const key = g.key || g.name;
                if (!itemMap.has(key)) {
                    itemMap.set(key, {
                        key: key,
                        name: g.name,
                        baseUnit: g.unit,
                        category: g.category || 'Продукты',
                        recipeCount: 1,
                        recipes: [recipe.title]
                    });
                } else {
                    const existing = itemMap.get(key);
                    existing.recipeCount += 1;
                    if (!existing.recipes.includes(recipe.title)) {
                        existing.recipes.push(recipe.title);
                    }
                }
            });
        });

        const aggregated = [];
        itemMap.forEach(item => {
            let displayUnit = item.baseUnit;
            if (item.recipeCount > 1) {
                if (item.key === 'roti') {
                    displayUnit = '1 упаковка (в&nbsp;пачке 5 шт, хватит на&nbsp;оба блюда)';
                } else if (item.key === 'eggs') {
                    displayUnit = item.recipeCount > 3 ? '2 десятка' : '1 десяток (хватит на&nbsp;все рецепты)';
                } else if (item.key === 'butter') {
                    displayUnit = '1 пачка (хватит на&nbsp;все рецепты)';
                } else if (item.key === 'garlic') {
                    displayUnit = '1-2 головки';
                } else if (item.key === 'canned_tomatoes') {
                    displayUnit = `${item.recipeCount} банки`;
                } else if (item.key === 'cream_20' || item.key === 'cream_33') {
                    displayUnit = '1 большая упаковка (500 мл)';
                } else if (item.key === 'sour_cream') {
                    displayUnit = '1 большая банка (300–400 г)';
                } else if (item.key === 'pasta_tagliatelle' || item.key === 'spaghetti' || item.key === 'orzo_pasta') {
                    displayUnit = '1-2 пачки';
                } else if (item.key === 'dill' || item.key === 'parsley' || item.key === 'green_onion' || item.key === 'fresh_herbs') {
                    displayUnit = `${item.recipeCount} пучка`;
                } else if (item.key === 'cucumber') {
                    displayUnit = '1 упаковка (3-4 шт)';
                } else {
                    displayUnit = `${item.baseUnit} (для&nbsp;${item.recipeCount} блюд)`;
                }
            }

            aggregated.push({
                key: item.key,
                name: item.name,
                displayUnit: displayUnit,
                category: item.category,
                recipeCount: item.recipeCount,
                recipes: item.recipes
            });
        });

        return aggregated;
    }

    function renderShoppingModalBody() {
        const allItems = getAllItems();
        const selectedRecipes = allItems.filter(r => cart.includes(r.id));

        if (selectedRecipes.length === 0) {
            if (shoppingModalActions) shoppingModalActions.classList.add('hidden');
            if (shoppingViewToggle) shoppingViewToggle.classList.add('hidden');
            shoppingModalBody.innerHTML = `
                <div class="shopping-empty">
                    <div class="shopping-empty-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                    </div>
                    <div class="shopping-empty-title">В&nbsp;списке покупок пока пусто</div>
                    <p class="shopping-empty-desc">Добавляйте любые понравившиеся блюда кнопкой «+ В&nbsp;закупку» на&nbsp;карточках или внутри рецепта&nbsp;— здесь автоматически сформируется удобный чек-лист продуктов для&nbsp;похода в&nbsp;супермаркет</p>
                </div>
            `;
            return;
        }

        if (shoppingModalActions) shoppingModalActions.classList.remove('hidden');
        if (shoppingViewToggle) shoppingViewToggle.classList.remove('hidden');

        // Update toggle active buttons
        if (viewCategoriesBtn && viewUnifiedBtn) {
            viewCategoriesBtn.classList.toggle('active', shoppingViewMode === 'categories');
            viewUnifiedBtn.classList.toggle('active', shoppingViewMode === 'unified');
        }

        const aggregatedItems = getAggregatedGroceries(selectedRecipes);

        const chipsHtml = selectedRecipes.map(r => `
            <div class="shopping-dish-chip">
                <span class="shopping-dish-title">${r.title}</span>
                <button class="shopping-dish-remove" data-id="${r.id}" aria-label="Убрать блюдо">✕</button>
            </div>
        `).join('');

        let listContentHtml = '';

        if (shoppingViewMode === 'categories') {
            // Group by category (clean Russian names, no emojis)
            const categoryOrder = [
                'Овощи и зелень',
                'Молочный отдел и сыры',
                'Мясо и птица',
                'Рыба и морепродукты',
                'Заморозка',
                'Бакалея и соусы',
                'Специи'
            ];

            const grouped = {};
            aggregatedItems.forEach(item => {
                const cat = item.category || 'Бакалея и соусы';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
            });

            // Sorted categories matching user-friendly department layout
            const sortedCategories = Object.keys(grouped).sort((a, b) => {
                const idxA = categoryOrder.indexOf(a);
                const idxB = categoryOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            const groupsHtml = sortedCategories.map(cat => {
                const items = grouped[cat];
                const itemsHtml = items.map(item => {
                    const isChecked = !!checkedIngredients[item.key];
                    return `
                        <div class="shopping-check-item ${isChecked ? 'checked' : ''}" data-key="${item.key}" role="checkbox" aria-checked="${isChecked}" tabindex="0">
                            <span class="shopping-check-box"></span>
                            <span class="shopping-check-name">${item.name}</span>
                            <span class="shopping-check-amount">${item.displayUnit}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="shopping-category-group">
                        <div class="shopping-category-title">
                            <span>${cat}</span>
                            <span class="shopping-category-count">${items.length} поз</span>
                        </div>
                        <div class="shopping-category-items">
                            ${itemsHtml}
                        </div>
                    </div>
                `;
            }).join('');

            listContentHtml = `
                <div class="shopping-categories-wrap">
                    ${groupsHtml}
                </div>
            `;
        } else {
            // Unified List
            const itemsHtml = aggregatedItems.map(item => {
                const isChecked = !!checkedIngredients[item.key];
                return `
                    <div class="shopping-check-item ${isChecked ? 'checked' : ''}" data-key="${item.key}" role="checkbox" aria-checked="${isChecked}" tabindex="0">
                        <span class="shopping-check-box"></span>
                        <span class="shopping-check-name">${item.name}</span>
                        <span class="shopping-check-amount">${item.displayUnit}</span>
                    </div>
                `;
            }).join('');

            listContentHtml = `
                <div class="shopping-unified-list-wrap">
                    <div class="shopping-unified-header">
                        <span class="shopping-unified-title">Что купить в&nbsp;магазине (${aggregatedItems.length})</span>
                        <span class="shopping-unified-hint">Отмечайте галочками купленные продукты</span>
                    </div>
                    <div class="shopping-unified-items">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }

        shoppingModalBody.innerHTML = `
            <div class="shopping-dishes-bar">
                <div class="shopping-dishes-header">
                    <span class="shopping-dishes-title">Выбранные блюда (${selectedRecipes.length}):</span>
                </div>
                <div class="shopping-dishes-chips">
                    ${chipsHtml}
                </div>
            </div>

            ${listContentHtml}

            <div class="shopping-pantry-note">
                <span class="shopping-pantry-label">Базовые запасы дома:</span>соль, перец, масло для&nbsp;жарки (проверьте на&nbsp;кухне)
            </div>
        `;

        shoppingModalBody.querySelectorAll('.shopping-dish-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                toggleCart(id);
            });
        });

        shoppingModalBody.querySelectorAll('.shopping-check-item').forEach(item => {
            const toggleCheck = () => {
                const key = item.getAttribute('data-key');
                if (!key) return;
                const willBeChecked = !checkedIngredients[key];
                if (willBeChecked) {
                    checkedIngredients[key] = true;
                    item.classList.add('checked');
                    item.setAttribute('aria-checked', 'true');
                } else {
                    delete checkedIngredients[key];
                    item.classList.remove('checked');
                    item.setAttribute('aria-checked', 'false');
                }
                localStorage.setItem('recipe_cart_checked_v1', JSON.stringify(checkedIngredients));
            };

            item.addEventListener('click', toggleCheck);
            item.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleCheck();
                }
            });
        });
    }

    if (viewCategoriesBtn) {
        viewCategoriesBtn.addEventListener('click', () => {
            shoppingViewMode = 'categories';
            localStorage.setItem('recipe_cart_view_mode_v1', 'categories');
            renderShoppingModalBody();
        });
    }

    if (viewUnifiedBtn) {
        viewUnifiedBtn.addEventListener('click', () => {
            shoppingViewMode = 'unified';
            localStorage.setItem('recipe_cart_view_mode_v1', 'unified');
            renderShoppingModalBody();
        });
    }

    function copyShoppingListToClipboard() {
        const allItems = getAllItems();
        const selectedRecipes = allItems.filter(r => cart.includes(r.id));
        if (selectedRecipes.length === 0) return;

        const aggregatedItems = getAggregatedGroceries(selectedRecipes);
        const clean = (str) => (str || '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        let lines = [];
        lines.push('Список продуктов в магазин:');
        lines.push('');
        lines.push(`Блюда (${selectedRecipes.length}):`);
        selectedRecipes.forEach(r => {
            lines.push(`• ${clean(r.title)}`);
        });
        lines.push('');

        if (shoppingViewMode === 'categories') {
            const categoryOrder = [
                'Овощи и зелень',
                'Молочный отдел и сыры',
                'Мясо и птица',
                'Рыба и морепродукты',
                'Заморозка',
                'Бакалея и соусы',
                'Специи'
            ];
            const grouped = {};
            aggregatedItems.forEach(item => {
                const cat = item.category || 'Бакалея и соусы';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
            });
            const sortedCategories = Object.keys(grouped).sort((a, b) => {
                const idxA = categoryOrder.indexOf(a);
                const idxB = categoryOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });
            sortedCategories.forEach(cat => {
                lines.push(clean(cat).toUpperCase());
                grouped[cat].forEach(item => {
                    lines.push(`• ${clean(item.name)} — ${clean(item.displayUnit)}`);
                });
                lines.push('');
            });
        } else {
            lines.push(`Купить в супермаркете (${aggregatedItems.length}):`);
            aggregatedItems.forEach(item => {
                lines.push(`• ${clean(item.name)} — ${clean(item.displayUnit)}`);
            });
            lines.push('');
        }

        lines.push('Базовые запасы дома:');
        lines.push('Проверьте наличие соли, перца и масла для жарки');

        const fullText = lines.join('\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullText).then(() => {
                showToast('Список покупок скопирован в&nbsp;буфер');
            }).catch(() => {
                fallbackCopyText(fullText);
            });
        } else {
            fallbackCopyText(fullText);
        }
    }

    function fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Список покупок скопирован в&nbsp;буфер');
        } catch (err) {
            console.error('Copy failed:', err);
        }
        document.body.removeChild(textArea);
    }

    function openShoppingModal() {
        renderShoppingModalBody();
        shoppingModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (window.Telegram && window.Telegram.WebApp) {
            Telegram.WebApp.BackButton.show();
        }
    }

    function closeShoppingModal() {
        shoppingModal.classList.remove('active');
        if (!recipeModal.classList.contains('active') && (!chefModeModal || !chefModeModal.classList.contains('active'))) {
            document.body.style.overflow = '';
        }
        if (window.Telegram && window.Telegram.WebApp && !recipeModal.classList.contains('active')) {
            Telegram.WebApp.BackButton.hide();
        }
    }

    if (openShoppingBtn) openShoppingBtn.addEventListener('click', openShoppingModal);
    if (floatingOpenShoppingBtn) floatingOpenShoppingBtn.addEventListener('click', openShoppingModal);
    if (shoppingModalClose) shoppingModalClose.addEventListener('click', closeShoppingModal);
    if (copyShoppingListBtn) copyShoppingListBtn.addEventListener('click', copyShoppingListToClipboard);
    if (clearShoppingListBtn) {
        clearShoppingListBtn.addEventListener('click', () => {
            if (shoppingClearConfirm) {
                clearShoppingListBtn.classList.add('hidden');
                shoppingClearConfirm.classList.remove('hidden');
            } else {
                clearCart();
            }
        });
    }

    if (clearShoppingYesBtn) {
        clearShoppingYesBtn.addEventListener('click', () => {
            if (shoppingClearConfirm) shoppingClearConfirm.classList.add('hidden');
            if (clearShoppingListBtn) clearShoppingListBtn.classList.remove('hidden');
            clearCart();
        });
    }

    if (clearShoppingNoBtn) {
        clearShoppingNoBtn.addEventListener('click', () => {
            if (shoppingClearConfirm) shoppingClearConfirm.classList.add('hidden');
            if (clearShoppingListBtn) clearShoppingListBtn.classList.remove('hidden');
        });
    }

    if (shoppingModal) {
        shoppingModal.addEventListener('click', (e) => {
            if (e.target === shoppingModal) {
                if (shoppingClearConfirm) shoppingClearConfirm.classList.add('hidden');
                if (clearShoppingListBtn) clearShoppingListBtn.classList.remove('hidden');
                closeShoppingModal();
            }
        });
    }

    // --- Audio Tone Synthesis (Web Audio API) ---
    function playTimerChime() {
        try {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtxClass) return;
            if (!audioCtx) audioCtx = new AudioCtxClass();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const now = audioCtx.currentTime;
            const notes = [587.33, 880.00, 1174.66]; // D5, A5, D6 cheerful chime
            notes.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.12);
                gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.45);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + idx * 0.12);
                osc.stop(now + idx * 0.12 + 0.5);
            });
        } catch (e) {
            console.error('Audio chime error:', e);
        }

        if (navigator.vibrate) {
            try {
                navigator.vibrate([200, 100, 200, 100, 300]);
            } catch (err) {}
        }
    }

    // --- Timer Engine & Floating Widget ---
    function formatTimeDisplay(totalSec) {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateTimerWidgetUI() {
        if (!activeTimerWidget) return;
        if (!activeTimer) {
            activeTimerWidget.classList.add('hidden');
            return;
        }

        activeTimerWidget.classList.remove('hidden');
        if (timerWidgetTime) {
            timerWidgetTime.textContent = formatTimeDisplay(activeTimer.remainingSeconds);
        }

        if (timerPauseIcon && timerPlayIcon) {
            if (activeTimer.isRunning) {
                timerPauseIcon.classList.remove('hidden');
                timerPlayIcon.classList.add('hidden');
            } else {
                timerPauseIcon.classList.add('hidden');
                timerPlayIcon.classList.remove('hidden');
            }
        }
    }

    function startTimer(seconds, label = 'Таймер') {
        if (activeTimerInterval) {
            clearInterval(activeTimerInterval);
            activeTimerInterval = null;
        }

        activeTimer = {
            totalSeconds: seconds,
            remainingSeconds: seconds,
            isRunning: true,
            label: label
        };

        updateTimerWidgetUI();
        showToast(`Таймер запущен на&nbsp;${formatTimeDisplay(seconds)}`);

        activeTimerInterval = setInterval(() => {
            if (!activeTimer || !activeTimer.isRunning) return;

            activeTimer.remainingSeconds -= 1;
            updateTimerWidgetUI();

            if (activeTimer.remainingSeconds <= 0) {
                clearInterval(activeTimerInterval);
                activeTimerInterval = null;
                const doneLabel = activeTimer.label || 'Таймер';
                activeTimer = null;
                updateTimerWidgetUI();
                playTimerChime();
                showToast(`Время вышло: ${doneLabel}`);
            }
        }, 1000);
    }

    function toggleTimerPause() {
        if (!activeTimer) return;
        activeTimer.isRunning = !activeTimer.isRunning;
        updateTimerWidgetUI();
        if (activeTimer.isRunning) {
            showToast('Таймер возобновлен');
        } else {
            showToast('Таймер на&nbsp;паузе');
        }
    }

    function stopTimer() {
        if (activeTimerInterval) {
            clearInterval(activeTimerInterval);
            activeTimerInterval = null;
        }
        activeTimer = null;
        updateTimerWidgetUI();
        showToast('Таймер сброшен');
    }

    if (timerWidgetToggleBtn) {
        timerWidgetToggleBtn.addEventListener('click', toggleTimerPause);
    }
    if (timerWidgetStopBtn) {
        timerWidgetStopBtn.addEventListener('click', stopTimer);
    }

    // --- Interactive Timer Extraction in Steps ---
    function parseStepTimers(stepText) {
        // Matches e.g. "1.5–2 минуты", "1-2 минуты", "30 секунд", "3 минуты", "15 минут", "1 час"
        const regex = /(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?)\s*(минут[ыа-я]*|сек[уа-я]*|час[а-я]*)/gi;
        const timers = [];
        let match;

        while ((match = regex.exec(stepText)) !== null) {
            const rawNumber = match[1];
            const rawUnit = match[2].toLowerCase();

            // Pick the max number in range for safety
            let num = 0;
            if (rawNumber.includes('-') || rawNumber.includes('–') || rawNumber.includes('—')) {
                const parts = rawNumber.split(/[-–—]/);
                num = parseFloat(parts[parts.length - 1].replace(',', '.').trim()) || 0;
            } else {
                num = parseFloat(rawNumber.replace(',', '.').trim()) || 0;
            }

            let seconds = 0;
            if (rawUnit.startsWith('сек')) {
                seconds = Math.round(num);
            } else if (rawUnit.startsWith('мин')) {
                seconds = Math.round(num * 60);
            } else if (rawUnit.startsWith('час')) {
                seconds = Math.round(num * 3600);
            }

            if (seconds > 0) {
                timers.push({
                    text: match[0],
                    seconds: seconds
                });
            }
        }

        return timers;
    }

    function renderStepWithTimers(stepText) {
        const regex = /(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:минут[ыа-я]*|сек[уа-я]*|час[а-я]*))/gi;
        return stepText.replace(regex, (matchText) => {
            const timers = parseStepTimers(matchText);
            if (timers.length > 0) {
                const s = timers[0].seconds;
                return `<button class="step-timer-chip" type="button" data-seconds="${s}" data-label="${matchText}" aria-label="Запустить таймер на ${matchText}"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>${matchText}</span></button>`;
            }
            return matchText;
        });
    }

    // Global event delegation for all timer chips across all views
    document.addEventListener('click', (e) => {
        const chip = e.target.closest('.step-timer-chip');
        if (!chip) return;
        e.stopPropagation();
        const sec = parseInt(chip.getAttribute('data-seconds'), 10);
        if (sec) {
            const label = chip.getAttribute('data-label') || (chefModeRecipe ? chefModeRecipe.title : 'Таймер');
            startTimer(sec, label);
        }
    });

    // --- Servings Calculator Math ---
    function scaleIngredientAmount(amountStr, multiplier) {
        if (!amountStr || multiplier === 1) return amountStr;
        // Match leading integer or float: "240 г", "2 шт", "1.5 ст. л.", "1-2 зубчика"
        const match = amountStr.match(/^(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/);
        if (!match) return amountStr;

        const numPart = match[1];
        const restPart = match[2];

        if (numPart.includes('-') || numPart.includes('–') || numPart.includes('—')) {
            const splitChar = numPart.includes('–') ? '–' : (numPart.includes('—') ? '—' : '-');
            const parts = numPart.split(/[-–—]/);
            const n1 = parseFloat(parts[0].replace(',', '.').trim()) * multiplier;
            const n2 = parseFloat(parts[1].replace(',', '.').trim()) * multiplier;
            const f1 = Number.isInteger(n1) ? n1 : n1.toFixed(1).replace('.0', '');
            const f2 = Number.isInteger(n2) ? n2 : n2.toFixed(1).replace('.0', '');
            return `${f1}${splitChar}${f2} ${restPart}`.trim();
        }

        const baseVal = parseFloat(numPart.replace(',', '.'));
        if (isNaN(baseVal)) return amountStr;
        const scaledVal = baseVal * multiplier;
        const formatted = Number.isInteger(scaledVal) ? scaledVal : scaledVal.toFixed(1).replace('.0', '');
        return `${formatted} ${restPart}`.trim();
    }

    // --- Feature 2: Hands-Free Chef Mode ---
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => {
                    wakeLockSentinel = null;
                });
            }
        } catch (err) {
            console.warn('Wake Lock request error:', err);
        }
    }

    function releaseWakeLock() {
        if (wakeLockSentinel) {
            wakeLockSentinel.release().catch(() => {});
            wakeLockSentinel = null;
        }
    }

    function openChefMode(recipe) {
        if (!recipe || !recipe.steps || recipe.steps.length === 0) return;
        chefModeRecipe = recipe;
        chefModeStepIndex = 0;
        chefModeModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        requestWakeLock();
        renderChefModeStep();
    }

    function closeChefMode() {
        chefModeModal.classList.remove('active');
        releaseWakeLock();
        chefModeRecipe = null;
        if (!recipeModal.classList.contains('active') && !shoppingModal.classList.contains('active')) {
            document.body.style.overflow = '';
        }
    }

    function renderChefModeStep() {
        if (!chefModeRecipe) return;
        const steps = chefModeRecipe.steps;
        const total = steps.length;
        const currentStep = steps[chefModeStepIndex];

        if (chefModeStepBadge) {
            chefModeStepBadge.innerHTML = `Шаг ${chefModeStepIndex + 1} из&nbsp;${total}`;
        }
        if (chefModeProgressFill) {
            const percent = ((chefModeStepIndex + 1) / total) * 100;
            chefModeProgressFill.style.width = `${percent}%`;
        }
        if (chefModeRecipeTitle) {
            chefModeRecipeTitle.innerHTML = chefModeRecipe.title;
        }
        if (chefModeStepText) {
            chefModeStepText.innerHTML = renderStepWithTimers(currentStep);
            chefModeStepText.querySelectorAll('.step-timer-chip').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sec = parseInt(btn.getAttribute('data-seconds'), 10);
                    if (sec) startTimer(sec, `Шаг ${chefModeStepIndex + 1}`);
                });
            });
        }

        // Attach timers to step timer wrap if step contains timers
        if (chefModeStepTimerWrap) {
            chefModeStepTimerWrap.innerHTML = '';
            const timers = parseStepTimers(currentStep);
            if (timers.length > 0) {
                timers.forEach(t => {
                    const timerBtn = document.createElement('button');
                    timerBtn.className = 'step-timer-chip';
                    timerBtn.setAttribute('data-seconds', t.seconds);
                    timerBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>Запустить таймер (${t.text})</span>
                    `;
                    timerBtn.addEventListener('click', () => {
                        startTimer(t.seconds, `Шаг ${chefModeStepIndex + 1} (${chefModeRecipe.title})`);
                    });
                    chefModeStepTimerWrap.appendChild(timerBtn);
                });
            }
        }

        if (chefModePrevBtn) {
            chefModePrevBtn.disabled = chefModeStepIndex === 0;
        }

        if (chefModeNextBtn) {
            const isLast = chefModeStepIndex === total - 1;
            chefModeNextBtn.innerHTML = isLast ? `
                <span>Завершить готовку</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ` : `
                <span>Следующий шаг</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><polyline points="9 18 15 12 9 6"></polyline></svg>
            `;
        }
    }

    if (chefModePrevBtn) {
        chefModePrevBtn.addEventListener('click', () => {
            if (chefModeStepIndex > 0) {
                chefModeStepIndex -= 1;
                renderChefModeStep();
            }
        });
    }

    if (chefModeNextBtn) {
        chefModeNextBtn.addEventListener('click', () => {
            if (!chefModeRecipe) return;
            if (chefModeStepIndex < chefModeRecipe.steps.length - 1) {
                chefModeStepIndex += 1;
                renderChefModeStep();
            } else {
                closeChefMode();
                showToast('Блюдо готово, приятного аппетита');
            }
        });
    }

    if (chefModeClose) {
        chefModeClose.addEventListener('click', closeChefMode);
    }

    // --- Recipe Detail Modal Logic ---
    function openModal(id) {
        const item = getAllItems().find(x => x.id === id);
        if (!item) return;

        let currentMultiplier = 1;
        const inCart = cart.includes(item.id);
        const tag = item.category || 'Рецепт';
        const servingsInfo = item.servings ? `<div class="modal-meta-item"><span>${item.servings}</span></div>` : '';
        const caloriesInfo = item.calories ? `<div class="modal-meta-item"><span>${item.calories} ККАЛ</span></div>` : '';

        const noteHtml = item.note ? `
            <div class="modal-note-box">
                <span class="modal-note-label">Лайфхак при&nbsp;покупке:</span>${item.note}
            </div>
        ` : '';

        const chefSecretHtml = item.chef_secret ? `
            <div class="chef-secret-box">
                <div class="chef-secret-header">Секрет шефа</div>
                <div class="chef-secret-body">${item.chef_secret}</div>
            </div>
        ` : '';

        let usageGuideHtml = '';
        if (item.fits_salads || item.fits_other) {
            usageGuideHtml = `
                <div class="usage-guide-box">
                    ${item.fits_salads ? `
                        <div class="usage-guide-item">
                            <span class="usage-guide-label">К&nbsp;каким салатам подходит</span>
                            <div class="usage-guide-text">${item.fits_salads}</div>
                        </div>
                    ` : ''}
                    ${item.fits_other ? `
                        <div class="usage-guide-item">
                            <span class="usage-guide-label">Куда еще подходит помимо салатов</span>
                            <div class="usage-guide-text">${item.fits_other}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (item.fits) {
            usageGuideHtml = `
                <div class="sauce-fits-box">
                    <span class="sauce-fits-label">К&nbsp;чему подходит:</span>${item.fits}
                </div>
            `;
        }

        const modalImageHtml = item.image ? `
            <div class="modal-image-wrap">
                <img src="${item.image}" alt="${item.title.replace(/&nbsp;/g, ' ')}" class="modal-image" />
            </div>
        ` : '';

        const modalActionsHtml = `
            <div class="modal-actions-grid">
                <button class="start-cooking-btn" id="startCookingBtn" data-id="${item.id}">
                    <img src="icon_play.png" alt="" class="modal-btn-icon">
                    <span>Начать готовить</span>
                </button>
                <button class="modal-cart-btn ${inCart ? 'active' : ''}" id="modalCartBtn" data-id="${item.id}">
                    <img src="icon_cart.png" alt="" class="modal-btn-icon">
                    <span>${inCart ? 'Убрать из&nbsp;списка' : '+ В&nbsp;закупку'}</span>
                </button>
            </div>
        `;

        const servingsCalculatorHtml = `
            <div class="servings-calculator">
                <span class="servings-calc-label">Количество порций:</span>
                <div class="servings-calc-buttons">
                    <button class="servings-btn ${currentMultiplier === 1 ? 'active' : ''}" data-multiplier="1">1x</button>
                    <button class="servings-btn ${currentMultiplier === 2 ? 'active' : ''}" data-multiplier="2">2x</button>
                    <button class="servings-btn ${currentMultiplier === 4 ? 'active' : ''}" data-multiplier="4">4x</button>
                </div>
            </div>
        `;

        function renderIngredientsHtml(multiplier) {
            return (item.ingredients || []).map(ing => `
                <li class="ingredient-item">
                    <span>${ing.name}</span>
                    <span class="ingredient-amount">${scaleIngredientAmount(ing.amount, multiplier)}</span>
                </li>
            `).join('');
        }

        const stepsHtml = (item.steps || []).map(step => `
            <li class="step-item">${renderStepWithTimers(step)}</li>
        `).join('');

        modalBody.innerHTML = `
            <div class="modal-tag">${tag}</div>
            <h2 class="modal-title">${item.title}</h2>
            <div class="modal-meta-row">
                <div class="modal-meta-item"><span>${item.time_minutes} МИН</span></div>
                ${servingsInfo}
                ${caloriesInfo}
            </div>

            ${modalImageHtml}
            ${modalActionsHtml}
            ${item.description ? `<p class="modal-desc">${item.description}</p>` : ''}
            ${noteHtml}

            <h3 class="modal-section-title">Ингредиенты</h3>
            ${servingsCalculatorHtml}
            <ul class="ingredients-list" id="modalIngredientsList">
                ${renderIngredientsHtml(1)}
            </ul>

            ${item.prep && item.prep.trim() ? `
                <div class="recipe-section-wrap">
                    <h3 class="modal-section-title">Подготовка</h3>
                    <div class="recipe-section-card">${item.prep}</div>
                </div>
            ` : ''}

            <div class="recipe-section-wrap">
                <h3 class="modal-section-title">Приготовление</h3>
                <ul class="steps-list">
                    ${stepsHtml}
                </ul>
            </div>

            ${item.critical && item.critical.trim() ? `
                <div class="recipe-section-wrap">
                    <div class="recipe-section-card critical-card">
                        <div class="recipe-critical-title">Критические моменты</div>
                        <div class="recipe-critical-sub">Что нельзя сделать неправильно: температура, время, соль, кислота, текстура</div>
                        <div>${item.critical}</div>
                    </div>
                </div>
            ` : ''}

            ${item.substitutes && item.substitutes.trim() ? `
                <div class="recipe-section-wrap">
                    <h3 class="modal-section-title">Чем заменить</h3>
                    <div class="recipe-section-card">${item.substitutes}</div>
                </div>
            ` : ''}

            ${(() => {
                const s = (item.serving || '').trim();
                const norm = s.toLowerCase().replace(/&nbsp;/g, ' ').replace(/[.\s]/g, '');
                if (!s || norm === 'подаватьнемедленно' || norm === 'подаватьнемедленновтепломвиде' || norm === 'съедатьсразу' || norm === 'съедатьсвежим') return '';
                return `
                    <div class="recipe-section-wrap">
                        <h3 class="modal-section-title">Подача</h3>
                        <div class="recipe-section-card">${s}</div>
                    </div>
                `;
            })()}

            ${(() => {
                const st = (item.storage || '').trim();
                const norm = st.toLowerCase().replace(/&nbsp;/g, ' ').replace(/[.\s]/g, '');
                if (!st || norm === 'нехранится' || norm === 'нехранится,съедатьсразу' || norm === 'съедатьсвежим' || norm === 'неприменимо') return '';
                return `
                    <div class="recipe-section-wrap">
                        <h3 class="modal-section-title">Хранение</h3>
                        <div class="recipe-section-card">${st}</div>
                    </div>
                `;
            })()}

            ${(() => {
                const f = (item.freezer || '').trim();
                const norm = f.toLowerCase().replace(/&nbsp;/g, ' ').replace(/[.\s]/g, '');
                if (!f || norm === 'незамораживается' || norm === 'неподлежитзаморозке' || norm === 'неприменимо' || norm === 'незамораживать') return '';
                return `
                    <div class="recipe-section-wrap">
                        <h3 class="modal-section-title">Заморозка</h3>
                        <div class="recipe-section-card">${f}</div>
                    </div>
                `;
            })()}

            ${item.variations && item.variations.trim() ? `
                <div class="recipe-section-wrap">
                    <h3 class="modal-section-title">Вариации</h3>
                    <div class="recipe-section-card">${item.variations}</div>
                </div>
            ` : ''}

            ${chefSecretHtml}
            ${usageGuideHtml}
        `;

        // Servings scaling listeners
        const modalIngredientsList = document.getElementById('modalIngredientsList');
        modalBody.querySelectorAll('.servings-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mult = parseFloat(btn.getAttribute('data-multiplier')) || 1;
                modalBody.querySelectorAll('.servings-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (modalIngredientsList) {
                    modalIngredientsList.innerHTML = renderIngredientsHtml(mult);
                }
            });
        });

        // Step Timer Chips in modal steps
        modalBody.querySelectorAll('.step-timer-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sec = parseInt(btn.getAttribute('data-seconds'), 10);
                if (sec) startTimer(sec, item.title);
            });
        });

        // Start Cooking Button
        const startCookingBtn = document.getElementById('startCookingBtn');
        if (startCookingBtn) {
            startCookingBtn.addEventListener('click', () => {
                openChefMode(item);
            });
        }

        // Cart toggle inside modal
        const modalCartBtn = document.getElementById('modalCartBtn');
        if (modalCartBtn) {
            modalCartBtn.addEventListener('click', () => {
                toggleCart(item.id);
            });
        }

        recipeModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (window.Telegram && window.Telegram.WebApp) {
            Telegram.WebApp.BackButton.show();
        }
    }

    function closeModal() {
        recipeModal.classList.remove('active');
        if (!shoppingModal.classList.contains('active') && (!chefModeModal || !chefModeModal.classList.contains('active'))) {
            document.body.style.overflow = '';
        }
        if (window.location.hash.startsWith('#recipe-')) {
            window.location.hash = currentTab;
        }
        if (window.Telegram && window.Telegram.WebApp && !shoppingModal.classList.contains('active')) {
            Telegram.WebApp.BackButton.hide();
        }
    }

    modalClose.addEventListener('click', closeModal);
    recipeModal.addEventListener('click', (e) => {
        if (e.target === recipeModal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (chefModeModal && chefModeModal.classList.contains('active')) {
                closeChefMode();
            } else if (shoppingModal && shoppingModal.classList.contains('active')) {
                closeShoppingModal();
            } else if (recipeModal && recipeModal.classList.contains('active')) {
                closeModal();
            }
        }
    });

    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.BackButton.onClick(() => {
            if (profileModal && profileModal.classList.contains('active')) {
                closeProfileModal();
            } else if (chefModeModal && chefModeModal.classList.contains('active')) {
                closeChefMode();
            } else if (shoppingModal && shoppingModal.classList.contains('active')) {
                closeShoppingModal();
            } else if (recipeModal && recipeModal.classList.contains('active')) {
                closeModal();
            }
        });
    }

    // --- Authentication Event Handlers ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginErrorMsg.classList.add('hidden');
            loginErrorMsg.textContent = '';

            const username = loginInput.value.trim().toLowerCase();
            const password = passwordInput.value;

            if (!username || !password) {
                loginErrorMsg.textContent = 'Пожалуйста, заполните логин и&nbsp;пароль';
                loginErrorMsg.classList.remove('hidden');
                return;
            }

            const submitBtn = document.getElementById('loginSubmitBtn');
            if (submitBtn) submitBtn.disabled = true;

            try {
                let authSuccess = false;
                let userToken = null;
                let activeUsername = username;

                // 1. Try Supabase Cloud Auth first (Cloud synchronization across all devices)
                if (supabaseClient) {
                    try {
                        const emailToTry = username.includes('@') ? username : `${username}@nnesterov.ru`;
                        const { data: supaData, error: supaErr } = await supabaseClient.auth.signInWithPassword({
                            email: emailToTry,
                            password: password
                        });

                        if (!supaErr && supaData && supaData.session) {
                            authSuccess = true;
                            userToken = supaData.session.access_token;
                            activeUsername = username;
                        }
                    } catch (e) {
                        // Supabase network error or fallback
                    }
                }

                // 2. Fallback to local baseline credentials (offline & bootstrap support)
                if (!authSuccess) {
                    const users = getLocalUsers();
                    const userRecord = users[username];
                    if (userRecord && (userRecord.password === password || userRecord.altPassword === password)) {
                        authSuccess = true;
                        userToken = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
                    }
                }

                // 3. Fallback to backend API endpoint if exists
                if (!authSuccess) {
                    try {
                        const response = await fetch('/api/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, password })
                        });
                        if (response.ok) {
                            const authRes = await response.json();
                            authSuccess = true;
                            userToken = authRes.token;
                            activeUsername = authRes.username || username;
                        } else if (response.status !== 404) {
                            const errData = await response.json().catch(() => ({}));
                            loginErrorMsg.textContent = errData.message || 'Неверный логин или пароль';
                            loginErrorMsg.classList.remove('hidden');
                            return;
                        }
                    } catch (netErr) {
                        // Offline or static file server
                    }
                }

                if (authSuccess && userToken) {
                    currentSession = {
                        token: userToken,
                        username: activeUsername
                    };
                    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentSession));
                    checkAuthStatus();
                    loadRecipesData();
                    showToast('Вход успешно выполнен');
                } else {
                    loginErrorMsg.textContent = 'Неверный логин или пароль';
                    loginErrorMsg.classList.remove('hidden');
                }
            } catch (err) {
                loginErrorMsg.textContent = 'Не&nbsp;удалось войти, попробуйте еще раз';
                loginErrorMsg.classList.remove('hidden');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Official Telegram Login Widget Callback (Signed by Telegram)
    window.onTelegramAuth = function(user) {
        if (!user || !user.id) return;
        
        // Telegram verified identity payload
        const tgDisplayName = user.first_name || user.username || `User_${user.id}`;
        const activeUsername = user.username ? `@${user.username}` : `tg_${user.id}`;
        
        currentSession = {
            token: `tg_auth_${user.id}_${user.auth_date}_${user.hash}`,
            username: activeUsername,
            tgUser: user
        };
        
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentSession));
        checkAuthStatus();
        loadRecipesData();
        showToast(`Добро пожаловать, ${tgDisplayName}`);
    };

    // Demo Fill Button Handler
    const demoFillBtn = document.getElementById('demoFillBtn');
    if (demoFillBtn) {
        demoFillBtn.addEventListener('click', () => {
            // Always use the canonical password, never stale localStorage value
            if (loginInput) loginInput.value = 'chef';
            if (passwordInput) passwordInput.value = CANONICAL_PASSWORDS.chef.password;
            if (loginErrorMsg) {
                loginErrorMsg.classList.add('hidden');
                loginErrorMsg.textContent = '';
            }
        });
    }

    // Password visibility toggle handler (eye icon)
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const eyeOpen = btn.querySelector('.eye-open-icon');
            const eyeClosed = btn.querySelector('.eye-closed-icon');

            if (input.type === 'password') {
                input.type = 'text';
                if (eyeOpen) eyeOpen.classList.add('hidden');
                if (eyeClosed) eyeClosed.classList.remove('hidden');
                btn.setAttribute('aria-label', 'Скрыть пароль');
            } else {
                input.type = 'password';
                if (eyeOpen) eyeOpen.classList.remove('hidden');
                if (eyeClosed) eyeClosed.classList.add('hidden');
                btn.setAttribute('aria-label', 'Показать пароль');
            }
        });
    });

    // Profile Modal Open / Close
    function openProfileModal() {
        if (!currentSession) {
            checkAuthStatus();
            return;
        }
        if (passwordChangeErrorMsg) passwordChangeErrorMsg.classList.add('hidden');
        if (passwordChangeSuccessMsg) passwordChangeSuccessMsg.classList.add('hidden');
        if (changePasswordForm) changePasswordForm.reset();
        
        // Reset all inputs to password type
        if (oldPasswordInput) oldPasswordInput.type = 'password';
        if (newPasswordInput) newPasswordInput.type = 'password';
        if (confirmPasswordInput) confirmPasswordInput.type = 'password';
        document.querySelectorAll('.password-toggle-btn').forEach(btn => {
            const eyeOpen = btn.querySelector('.eye-open-icon');
            const eyeClosed = btn.querySelector('.eye-closed-icon');
            if (eyeOpen) eyeOpen.classList.remove('hidden');
            if (eyeClosed) eyeClosed.classList.add('hidden');
            btn.setAttribute('aria-label', 'Показать пароль');
        });

        profileModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeProfileModal() {
        profileModal.classList.remove('active');
        if (!recipeModal.classList.contains('active') && !shoppingModal.classList.contains('active') && (!chefModeModal || !chefModeModal.classList.contains('active'))) {
            document.body.style.overflow = '';
        }
    }

    if (headerProfileBtn) {
        headerProfileBtn.addEventListener('click', openProfileModal);
    }
    if (profileModalClose) {
        profileModalClose.addEventListener('click', closeProfileModal);
    }
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) closeProfileModal();
        });
    }

    // Change Password Form
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            passwordChangeErrorMsg.classList.add('hidden');
            passwordChangeSuccessMsg.classList.add('hidden');

            const oldPass = oldPasswordInput.value;
            const newPass = newPasswordInput.value;
            const confirmPass = confirmPasswordInput.value;

            if (newPass !== confirmPass) {
                passwordChangeErrorMsg.textContent = 'Новые пароли не&nbsp;совпадают';
                passwordChangeErrorMsg.classList.remove('hidden');
                return;
            }

            if (newPass.length < 6) {
                passwordChangeErrorMsg.textContent = 'Длина нового пароля должна быть не&nbsp;менее 6 символов';
                passwordChangeErrorMsg.classList.remove('hidden');
                return;
            }

            const changeBtn = document.getElementById('changePasswordBtn');
            if (changeBtn) changeBtn.disabled = true;

            try {
                const rawUsername = currentSession && currentSession.username ? currentSession.username : 'chef';
                const username = rawUsername.trim().toLowerCase();
                let changedLocally = false;

                // 1. Try local update first with fresh records
                const users = getLocalUsers();
                if (users[username]) {
                    const rec = users[username];
                    if (rec.password === oldPass || rec.altPassword === oldPass) {
                        rec.password = newPass;
                        delete rec.altPassword;
                        saveLocalUsers(users);
                        changedLocally = true;
                    } else {
                        passwordChangeErrorMsg.textContent = 'Текущий пароль указан неверно';
                        passwordChangeErrorMsg.classList.remove('hidden');
                        if (changeBtn) changeBtn.disabled = false;
                        return;
                    }
                } else {
                    // In case user profile username didn't exist in localUsers, register it
                    users[username] = { password: newPass, email: `${username}@nnesterov.ru` };
                    saveLocalUsers(users);
                    changedLocally = true;
                }

                // 2. Also sync with Supabase Cloud so the new password works on all devices instantly
                if (supabaseClient) {
                    try {
                        const { error: supaUpErr } = await supabaseClient.auth.updateUser({
                            password: newPass
                        });
                        if (!supaUpErr) {
                            changedLocally = true;
                        }
                    } catch (e) {
                        // fallback to local/api
                    }
                }

                // 3. Also sync with backend server if live endpoint exists
                try {
                    await fetch('/api/change-password', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${currentSession ? currentSession.token : ''}`
                        },
                        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
                    });
                } catch (netErr) {
                    // Static / offline host
                }

                if (changedLocally) {
                    passwordChangeSuccessMsg.textContent = 'Пароль успешно обновлен';
                    passwordChangeSuccessMsg.classList.remove('hidden');
                    changePasswordForm.reset();
                    showToast('Пароль успешно изменен');
                    setTimeout(() => closeProfileModal(), 1200);
                } else {
                    passwordChangeErrorMsg.textContent = 'Ошибка смены пароля&nbsp;— проверьте текущий пароль';
                    passwordChangeErrorMsg.classList.remove('hidden');
                }
            } catch (err) {
                passwordChangeErrorMsg.textContent = 'Не&nbsp;удалось сменить пароль&nbsp;— попробуйте позже';
                passwordChangeErrorMsg.classList.remove('hidden');
            } finally {
                if (changeBtn) changeBtn.disabled = false;
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem(AUTH_SESSION_KEY);
            currentSession = null;
            closeProfileModal();
            checkAuthStatus();
            showToast('Вы вышли из&nbsp;аккаунта');
        });
    }
});
