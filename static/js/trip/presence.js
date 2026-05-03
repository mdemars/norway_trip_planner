// ============================================================================
// trip/presence.js - Real-time collaborative editing notifications via SSE
// ============================================================================

(function () {
    const MAX_TOASTS = 3;
    const TOAST_DURATION_MS = 5000;
    const RECONNECT_DELAY_MS = 5000;

    let _eventSource = null;
    let _tripId = null;
    let _container = null;

    // -------------------------------------------------------------------------
    // Public API (exposed on window)
    // -------------------------------------------------------------------------

    /**
     * Open an SSE connection for the given trip and start listening.
     * Called once from init.js on DOMContentLoaded.
     */
    function initPresence(tripId) {
        _tripId = tripId;
        _container = _getOrCreateContainer();
        _connect();
    }

    /**
     * Notify other viewers that the current user opened an edit form.
     * Fire-and-forget — errors are silently swallowed.
     */
    function notifyEditing(entity, entityId, entityName) {
        _notify({ action: 'editing', entity, entity_id: entityId, entity_name: entityName });
    }

    /**
     * Notify other viewers that the current user saved a change.
     */
    function notifySaved(entity, entityId, entityName) {
        _notify({ action: 'saved', entity, entity_id: entityId, entity_name: entityName });
    }

    /**
     * Notify other viewers that the current user added a new entity.
     */
    function notifyAdded(entity, entityId, entityName) {
        _notify({ action: 'added', entity, entity_id: entityId, entity_name: entityName });
    }

    /**
     * Notify other viewers that the current user deleted an entity.
     */
    function notifyDeleted(entity, entityId, entityName) {
        _notify({ action: 'deleted', entity, entity_id: entityId, entity_name: entityName });
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _connect() {
        if (_eventSource) {
            _eventSource.close();
        }

        _eventSource = new EventSource(`/api/trips/${_tripId}/events`);

        _eventSource.onmessage = function (e) {
            try {
                const event = JSON.parse(e.data);
                _handleEvent(event);
            } catch (_) { /* ignore malformed events */ }
        };

        _eventSource.onerror = function () {
            _eventSource.close();
            _eventSource = null;
            // Reconnect after a delay
            setTimeout(_connect, RECONNECT_DELAY_MS);
        };
    }

    function _handleEvent(event) {
        const { action, user, entity, entity_name, viewers } = event;

        // Don't show toasts for 'joined'/'left' — too noisy for a trip planner
        if (action === 'joined' || action === 'left') return;

        const label = _entityLabel(entity);
        let message = '';

        if (action === 'editing') {
            message = `${user} is editing ${label}: ${entity_name}`;
        } else if (action === 'saved') {
            message = `${user} saved ${label}: ${entity_name}`;
        } else if (action === 'added') {
            message = `${user} added ${label}: ${entity_name}`;
        } else if (action === 'deleted') {
            message = `${user} deleted ${label}: ${entity_name}`;
        } else {
            return;
        }

        _showToast(message, action);
    }

    function _entityLabel(entity) {
        if (entity === 'stop') return 'stop';
        if (entity === 'activity') return 'activity';
        return entity || 'item';
    }

    function _notify(payload) {
        if (!_tripId) return;
        fetch(`/api/trips/${_tripId}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(() => { /* non-critical */ });
    }

    function _getOrCreateContainer() {
        let el = document.getElementById('presenceToastContainer');
        if (!el) {
            el = document.createElement('div');
            el.id = 'presenceToastContainer';
            document.body.appendChild(el);
        }
        return el;
    }

    function _showToast(message, action) {
        if (!_container) return;

        // Trim to MAX_TOASTS — remove oldest if needed
        while (_container.children.length >= MAX_TOASTS) {
            _container.removeChild(_container.firstChild);
        }

        const toast = document.createElement('div');
        toast.className = `presence-toast presence-toast--${action}`;

        const icon = _icon(action);
        toast.innerHTML = `${icon}<span>${_escapeHtml(message)}</span>`;

        _container.appendChild(toast);

        // Trigger enter animation on next frame
        requestAnimationFrame(() => toast.classList.add('presence-toast--visible'));

        // Auto-dismiss
        setTimeout(() => _dismissToast(toast), TOAST_DURATION_MS);
    }

    function _dismissToast(toast) {
        toast.classList.remove('presence-toast--visible');
        toast.classList.add('presence-toast--hiding');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }

    function _icon(action) {
        // Inline SVG icons for each action type
        if (action === 'editing') {
            return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>`;
        }
        if (action === 'saved') {
            return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>`;
        }
        if (action === 'added') {
            return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>`;
        }
        if (action === 'deleted') {
            return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>`;
        }
        return '';
    }

    function _escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // -------------------------------------------------------------------------
    // Expose on window
    // -------------------------------------------------------------------------
    window.initPresence = initPresence;
    window.notifyEditing = notifyEditing;
    window.notifySaved = notifySaved;
    window.notifyAdded = notifyAdded;
    window.notifyDeleted = notifyDeleted;
})();
