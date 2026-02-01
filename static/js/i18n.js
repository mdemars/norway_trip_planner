// ============================================================================
// i18n Configuration - Internationalization for Norway Trip Planner
// ============================================================================

const i18nConfig = {
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'de'],
    debug: false,
    interpolation: {
        escapeValue: false
    },
    backend: {
        loadPath: '/static/locales/{{lng}}/translation.json'
    }
};

// Language display names for UI
const LANGUAGE_NAMES = {
    en: { native: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
    fr: { native: 'Francais', flag: '\u{1F1EB}\u{1F1F7}' },
    de: { native: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' }
};

// Global i18next instance
let i18nInitialized = false;

// Initialize i18next
async function initI18n() {
    if (i18nInitialized) return;

    await i18next
        .use(i18nextHttpBackend)
        .init({
            ...i18nConfig,
            lng: getStoredLanguage()
        });

    i18nInitialized = true;
    document.documentElement.lang = i18next.language;
}

// Get language from localStorage or browser
function getStoredLanguage() {
    const stored = localStorage.getItem('preferred_language');
    if (stored && i18nConfig.supportedLngs.includes(stored)) {
        return stored;
    }
    // Detect browser language
    const browserLang = navigator.language.split('-')[0];
    if (i18nConfig.supportedLngs.includes(browserLang)) {
        return browserLang;
    }
    return 'en';
}

// Change language and persist
async function changeLanguage(lng) {
    await i18next.changeLanguage(lng);
    localStorage.setItem('preferred_language', lng);
    document.documentElement.lang = lng;
    updateLanguageSelectorUI();
    updateAllTranslations();
}

// Update all translatable elements on the page
function updateAllTranslations() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = i18next.t(key);
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = i18next.t(key);
    });

    // Update titles/tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = i18next.t(key);
    });

    // Update page title if it has data-i18n
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
        document.title = i18next.t(titleEl.getAttribute('data-i18n'));
    }

    // Trigger custom event for JS components to update
    document.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { language: i18next.language }
    }));
}

// Translation helper
function t(key, options = {}) {
    return i18next.t(key, options);
}

// Date formatting helper (locale-aware)
function formatDate(date, options = {}) {
    const locale = i18next.language;
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    return new Date(date).toLocaleDateString(locale, { ...defaultOptions, ...options });
}

// Format date range
function formatDateRange(startDate, endDate) {
    const locale = i18next.language;
    const options = { month: 'short', day: 'numeric' };
    const start = new Date(startDate).toLocaleDateString(locale, options);
    const end = new Date(endDate).toLocaleDateString(locale, { ...options, year: 'numeric' });
    return `${start} - ${end}`;
}

// Create language selector component HTML
function createLanguageSelector() {
    const currentLang = i18next.language;
    const html = `
        <div class="language-selector">
            <button class="language-btn" id="languageToggle" type="button">
                <span class="lang-flag">${LANGUAGE_NAMES[currentLang].flag}</span>
                <span class="lang-name">${LANGUAGE_NAMES[currentLang].native}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div class="language-dropdown" id="languageDropdown">
                ${i18nConfig.supportedLngs.map(lng => `
                    <button class="language-option ${lng === currentLang ? 'active' : ''}"
                            data-lang="${lng}" type="button">
                        <span class="lang-flag">${LANGUAGE_NAMES[lng].flag}</span>
                        <span class="lang-name">${LANGUAGE_NAMES[lng].native}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    return html;
}

// Update language selector UI after language change
function updateLanguageSelectorUI() {
    const currentLang = i18next.language;
    const toggle = document.getElementById('languageToggle');
    if (toggle) {
        toggle.querySelector('.lang-flag').textContent = LANGUAGE_NAMES[currentLang].flag;
        toggle.querySelector('.lang-name').textContent = LANGUAGE_NAMES[currentLang].native;
    }

    document.querySelectorAll('.language-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === currentLang);
    });
}

// Setup language selector event listeners
function setupLanguageSelector() {
    const toggle = document.getElementById('languageToggle');
    const selector = toggle?.closest('.language-selector');

    if (!toggle || !selector) return;

    // Toggle dropdown
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        selector.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        selector.classList.remove('open');
    });

    // Language selection
    selector.addEventListener('click', async (e) => {
        const option = e.target.closest('.language-option');
        if (option) {
            e.stopPropagation();
            const lang = option.dataset.lang;
            await changeLanguage(lang);
            selector.classList.remove('open');
        }
    });
}
