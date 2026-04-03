// ============================================================================
// UI Utilities: Modals, Notifications, HTML helpers
// ============================================================================

const App = window.TripApp;

// ============================================================================
// HTML Helpers
// ============================================================================

App.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// ============================================================================
// Modal Functions
// ============================================================================

App.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
};

App.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
};

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        App.closeModal(e.target.id);
    }
});

// ============================================================================
// Utility Functions
// ============================================================================

App.formatDateForInput = function(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// ============================================================================
// Notification Functions
// ============================================================================

App.showNotification = function(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#0066cc'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s;
        font-weight: 500;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

App.showError = function(message) {
    App.showNotification(message, 'error');
};

App.showSuccess = function(message) {
    App.showNotification(message, 'success');
};

// ============================================================================
// DMS Coordinate Parsing
// ============================================================================

// Parse a single DMS string like "63°32'29.6″N" → decimal degrees.
// Also accepts plain decimals like "63.5412" or "-10.8127".
// Returns null if the string cannot be recognised.
App.parseDMS = function(str) {
    str = str.trim();
    if (!str) return null;

    // Already a plain decimal number
    if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);

    // DMS: require the ° symbol so we don't misparse arbitrary text.
    // Handles  63°32'29.6″N  63° 32' 29.6" N  63°32′29.6‴N  etc.
    const m = str.match(
        /(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)\s*['\u2032]\s*(\d+(?:\.\d+)?)\s*[″"\u2033]?\s*([NSEWnsew])/
    );
    if (!m) return null;

    let dec = parseFloat(m[1]) + parseFloat(m[2]) / 60 + parseFloat(m[3]) / 3600;
    if (/[SWsw]/.test(m[4])) dec = -dec;
    return Math.round(dec * 1e6) / 1e6;
};

// Try to extract a lat+lng pair from a single pasted string like
// "63°32'29.6″N 10°48'45.7″E". Returns { lat, lng } or null.
App.parseDMSPair = function(str) {
    const coordRe = /(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)\s*['\u2032]\s*(\d+(?:\.\d+)?)\s*[″"\u2033]?\s*([NSEWnsew])/g;
    const matches = [...str.matchAll(coordRe)];

    const toDecimal = (m) => {
        let dec = parseFloat(m[1]) + parseFloat(m[2]) / 60 + parseFloat(m[3]) / 3600;
        if (/[SWsw]/.test(m[4])) dec = -dec;
        return Math.round(dec * 1e6) / 1e6;
    };

    let lat = null, lng = null;
    for (const m of matches) {
        if (lat === null && /[NSns]/.test(m[4])) lat = toDecimal(m);
        if (lng === null && /[EWew]/.test(m[4])) lng = toDecimal(m);
    }
    return (lat !== null && lng !== null) ? { lat, lng } : null;
};

// Attach blur-time DMS parsing to a latitude/longitude input pair.
// Pasting a full "lat lng" DMS string into the latitude field fills both.
App.attachDMSParsing = function(latId, lngId) {
    const latInput = document.getElementById(latId);
    const lngInput = document.getElementById(lngId);
    if (!latInput || !lngInput) return;

    latInput.addEventListener('blur', () => {
        const val = latInput.value.trim();
        if (!val) return;

        // Full pair pasted into lat field?
        const pair = App.parseDMSPair(val);
        if (pair) {
            latInput.value = pair.lat;
            lngInput.value = pair.lng;
            return;
        }

        // Single coordinate
        const dec = App.parseDMS(val);
        if (dec !== null) latInput.value = dec;
    });

    lngInput.addEventListener('blur', () => {
        const val = lngInput.value.trim();
        if (!val) return;
        const dec = App.parseDMS(val);
        if (dec !== null) lngInput.value = dec;
    });
};

// ============================================================================
// Expose on window for global access
// ============================================================================

window.escapeHtml = App.escapeHtml;
window.openModal = App.openModal;
window.closeModal = App.closeModal;
window.formatDateForInput = App.formatDateForInput;
window.showNotification = App.showNotification;
window.showError = App.showError;
window.showSuccess = App.showSuccess;
