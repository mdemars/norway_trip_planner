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
// Expose on window for global access
// ============================================================================

window.escapeHtml = App.escapeHtml;
window.openModal = App.openModal;
window.closeModal = App.closeModal;
window.formatDateForInput = App.formatDateForInput;
window.showNotification = App.showNotification;
window.showError = App.showError;
window.showSuccess = App.showSuccess;
