// ============================================================================
// API Functions
// ============================================================================

async function fetchTrips() {
    try {
        const response = await fetch('/api/trips');
        if (!response.ok) throw new Error('Failed to fetch trips');
        return await response.json();
    } catch (error) {
        console.error('Error fetching trips:', error);
        showError(t('errors.failedToLoadTrips'));
        return [];
    }
}

async function createTrip(name) {
    try {
        const response = await fetch('/api/trips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || t('errors.failedToCreateTrip'));
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating trip:', error);
        showError(error.message);
        throw error;
    }
}

async function deleteTrip(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || t('errors.failedToDeleteTrip'));
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting trip:', error);
        showError(error.message);
        throw error;
    }
}

// ============================================================================
// UI Functions
// ============================================================================

function renderTrips(trips) {
    const container = document.getElementById('tripsContainer');
    const emptyState = document.getElementById('emptyState');

    if (trips.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.style.display = 'grid';
    container.innerHTML = trips.map(trip => createTripCard(trip)).join('');

    // Add event listeners to delete buttons
    trips.forEach(trip => {
        const deleteBtn = document.getElementById(`deleteTrip_${trip.id}`);
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleDeleteTrip(trip.id, trip.name);
            });
        }
    });
}

function createTripCard(trip) {
    const createdDate = formatDate(trip.created_at);

    // Get trip summary info from stops
    const stops = trip.stops || [];
    const numStops = stops.length;

    let tripDatesHtml = '';
    if (numStops > 0) {
        // Find earliest start date and latest end date
        const startDates = stops.map(s => new Date(s.start_date));
        const endDates = stops.map(s => new Date(s.end_date));

        const earliestStart = new Date(Math.min(...startDates));
        const latestEnd = new Date(Math.max(...endDates));

        const dateRangeStr = formatDateRange(earliestStart, latestEnd);
        const stopsText = t('stops.stop', { count: numStops });

        tripDatesHtml = `
            <span class="date">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${dateRangeStr}
            </span>
            <span class="date">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                ${stopsText}
            </span>
        `;
    } else {
        tripDatesHtml = `
            <span class="date" style="color: #6c757d;">
                ${t('stops.noStopsMessage')}
            </span>
        `;
    }

    return `
        <div class="trip-card" onclick="window.location.href='/trip/${trip.id}'">
            <h3>${escapeHtml(trip.name)}</h3>
            <div class="meta">
                ${tripDatesHtml}
            </div>
            <div class="actions">
                <button id="deleteTrip_${trip.id}" class="btn btn-danger btn-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    ${t('trips.delete')}
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleDeleteTrip(tripId, tripName) {
    if (!confirm(t('confirmations.deleteTrip', { name: tripName }))) {
        return;
    }

    try {
        await deleteTrip(tripId);
        showSuccess(t('notifications.tripDeleted'));
        await loadTrips();
    } catch (error) {
        // Error already shown in deleteTrip
    }
}

async function loadTrips() {
    const trips = await fetchTrips();
    renderTrips(trips);
}

// ============================================================================
// Modal Functions
// ============================================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});

// ============================================================================
// Form Handlers
// ============================================================================

async function handleNewTripSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const tripName = form.tripName.value.trim();

    if (!tripName) {
        showError(t('validation.tripNameRequired'));
        return;
    }

    try {
        const trip = await createTrip(tripName);
        closeModal('newTripModal');
        form.reset();
        showSuccess(t('notifications.tripCreated'));

        // Redirect to trip detail page
        window.location.href = `/trip/${trip.id}`;
    } catch (error) {
        // Error already shown in createTrip
    }
}

// ============================================================================
// Notification Functions
// ============================================================================

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Style the notification
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
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

// ============================================================================
// Event Listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await initI18n();

    // Insert language selector
    const langContainer = document.getElementById('languageSelectorContainer');
    if (langContainer) {
        langContainer.innerHTML = createLanguageSelector();
        setupLanguageSelector();
    }

    // Update all static translations
    updateAllTranslations();

    // Load trips
    loadTrips();

    // New trip button
    document.getElementById('newTripBtn').addEventListener('click', () => {
        openModal('newTripModal');
    });

    // New trip form
    document.getElementById('newTripForm').addEventListener('submit', handleNewTripSubmit);
});

// Listen for language changes to re-render dynamic content
document.addEventListener('languageChanged', () => {
    loadTrips();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
