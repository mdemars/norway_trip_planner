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

async function createTrip(name, startAddress, endAddress) {
    const body = { name };
    if (startAddress) body.start_location_address = startAddress;
    if (endAddress) body.end_location_address = endAddress;

    try {
        const response = await fetch('/api/trips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
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
    const datedStops = stops.filter(s => s.start_date && s.end_date);
    const stopsText = t('stops.stop', { count: numStops });

    let tripDatesHtml = '';
    if (datedStops.length > 0) {
        const startDates = datedStops.map(s => new Date(s.start_date));
        const endDates = datedStops.map(s => new Date(s.end_date));
        const dateRangeStr = formatDateRange(new Date(Math.min(...startDates)), new Date(Math.max(...endDates)));

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
    } else if (numStops > 0) {
        tripDatesHtml = `
            <span class="date" style="color: var(--text-muted);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                ${stopsText} · ${t('stops.noDatesSet')}
            </span>
        `;
    } else {
        tripDatesHtml = `
            <span class="date" style="color: #6c757d;">
                ${t('stops.noStopsMessage')}
            </span>
        `;
    }

    const distanceHtml = trip.total_distance_km != null
        ? `<span class="date">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <line x1="5" y1="12" x2="19" y2="12"></line>
                   <polyline points="12 5 19 12 12 19"></polyline>
               </svg>
               ${trip.total_distance_km.toFixed(1)} km
           </span>`
        : '';

    return `
        <div class="trip-card" onclick="window.location.href='/trip/${trip.id}'">
            <h3>${escapeHtml(trip.name)}</h3>
            <div class="meta">
                ${tripDatesHtml}
                ${distanceHtml}
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
    const startAddress = form.tripStartAddress.value.trim();
    const endAddress = form.tripEndAddress.value.trim();

    if (!tripName) {
        showError(t('validation.tripNameRequired'));
        return;
    }

    // Check address validation status for non-empty addresses
    const startStatus = document.getElementById('tripStartAddress').dataset.validationState;
    const endStatus = document.getElementById('tripEndAddress').dataset.validationState;

    if (startAddress && startStatus === 'invalid') {
        showError(t('validation.addressNotFound'));
        return;
    }
    if (endAddress && endStatus === 'invalid') {
        showError(t('validation.addressNotFound'));
        return;
    }
    if (startAddress && startStatus === 'validating') {
        showError(t('validation.validatingAddress'));
        return;
    }
    if (endAddress && endStatus === 'validating') {
        showError(t('validation.validatingAddress'));
        return;
    }

    try {
        const trip = await createTrip(tripName, startAddress, endAddress);
        closeModal('newTripModal');
        form.reset();
        resetAddressValidation('tripStartAddress', 'tripStartAddressStatus');
        resetAddressValidation('tripEndAddress', 'tripEndAddressStatus');
        showSuccess(t('notifications.tripCreated'));

        // Redirect to trip detail page
        window.location.href = `/trip/${trip.id}`;
    } catch (error) {
        // Error already shown in createTrip
    }
}

// ============================================================================
// Address Validation
// ============================================================================

let addressValidationTimers = {};

function setupAddressValidation(inputId, statusId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', () => {
        clearTimeout(addressValidationTimers[inputId]);
        const address = input.value.trim();

        if (!address) {
            resetAddressValidation(inputId, statusId);
            return;
        }

        setAddressStatus(inputId, statusId, 'validating');

        addressValidationTimers[inputId] = setTimeout(() => {
            validateAddress(inputId, statusId, address);
        }, 500);
    });
}

async function validateAddress(inputId, statusId, address) {
    try {
        const response = await fetch('/api/validate-address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });
        const result = await response.json();

        // Only update if the input still has the same value
        const currentValue = document.getElementById(inputId).value.trim();
        if (currentValue !== address) return;

        if (result.valid) {
            setAddressStatus(inputId, statusId, 'valid');
        } else {
            setAddressStatus(inputId, statusId, 'invalid');
        }
    } catch (error) {
        setAddressStatus(inputId, statusId, 'invalid');
    }
}

function setAddressStatus(inputId, statusId, state) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (!input || !status) return;

    input.dataset.validationState = state;

    if (state === 'validating') {
        status.className = 'address-validation-status validating';
        status.textContent = '...';
    } else if (state === 'valid') {
        status.className = 'address-validation-status valid';
        status.textContent = '\u2713';
    } else if (state === 'invalid') {
        status.className = 'address-validation-status invalid';
        status.textContent = '\u2717';
    }
}

function resetAddressValidation(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (input) delete input.dataset.validationState;
    if (status) {
        status.className = 'address-validation-status';
        status.textContent = '';
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

    // Address validation on trip creation modal
    setupAddressValidation('tripStartAddress', 'tripStartAddressStatus');
    setupAddressValidation('tripEndAddress', 'tripEndAddressStatus');

    // Quick trip wizard button
    document.getElementById('quickTripBtn').addEventListener('click', openQuickTripWizard);
});

// ============================================================================
// Quick Trip Wizard
// ============================================================================

function openQuickTripWizard() {
    document.getElementById('quickTripName').value = '';
    document.getElementById('wizardStopsList').innerHTML = '';
    // Start with 2 blank rows
    addWizardRow();
    addWizardRow();
    openModal('quickTripModal');
    // Focus the trip name
    setTimeout(() => document.getElementById('quickTripName').focus(), 50);
}

function addWizardRow() {
    const list = document.getElementById('wizardStopsList');
    const row = document.createElement('div');
    row.className = 'wizard-stop-row';
    row.innerHTML = `
        <input class="wizard-name" type="text" placeholder="${t('stops.stopName')}" autocomplete="off">
        <div class="address-input-wrapper wizard-address-wrapper">
            <input class="wizard-address" type="text" placeholder="${t('stops.addressOrGps')}" autocomplete="off">
            <span class="address-validation-status"></span>
        </div>
        <button type="button" class="icon-btn wizard-remove" onclick="removeWizardRow(this)" title="${t('stops.removeStop')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    list.appendChild(row);
    updateWizardBadges();
    setupWizardAddressValidation(row);
    // Tab from address → add new row (fast keyboard entry)
    row.querySelector('.wizard-address').addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            const rows = document.querySelectorAll('#wizardStopsList .wizard-stop-row');
            if (row === rows[rows.length - 1]) {
                e.preventDefault();
                addWizardRow();
            }
        }
    });
    // Focus the new name input if the list already had rows (not initial setup)
    if (list.children.length > 2) {
        row.querySelector('.wizard-name').focus();
    }
}

function removeWizardRow(btn) {
    const list = document.getElementById('wizardStopsList');
    if (list.children.length <= 2) return; // always keep at least 2
    btn.closest('.wizard-stop-row').remove();
    updateWizardBadges();
}

function updateWizardBadges() {
    const rows = document.querySelectorAll('#wizardStopsList .wizard-stop-row');
    rows.forEach((row) => {
        const removeBtn = row.querySelector('.wizard-remove');
        removeBtn.style.visibility = rows.length > 2 ? 'visible' : 'hidden';
    });
}

async function handleQuickTripSubmit() {
    const name = document.getElementById('quickTripName').value.trim();
    if (!name) {
        document.getElementById('quickTripName').focus();
        showError(t('validation.tripNameRequired'));
        return;
    }

    const rows = document.querySelectorAll('#wizardStopsList .wizard-stop-row');
    const stops = [];
    let hasError = false;
    let hasValidating = false;

    rows.forEach(row => {
        const nameInput = row.querySelector('.wizard-name');
        const addressInput = row.querySelector('.wizard-address');
        const stopName = nameInput.value.trim();
        const addressValue = addressInput.value.trim();

        if (!stopName) {
            nameInput.classList.add('input-error');
            nameInput.addEventListener('input', () => nameInput.classList.remove('input-error'), { once: true });
            hasError = true;
            return;
        }

        if (addressValue) {
            const state = addressInput.dataset.validationState;
            if (state === 'validating') {
                hasValidating = true;
                hasError = true;
                return;
            }
            if (state === 'invalid') {
                addressInput.classList.add('input-error');
                addressInput.addEventListener('input', () => addressInput.classList.remove('input-error'), { once: true });
                hasError = true;
                return;
            }
        }

        const stop = { name: stopName };
        if (addressValue) {
            if (addressInput.dataset.locationType === 'gps') {
                stop.latitude = parseFloat(addressInput.dataset.latitude);
                stop.longitude = parseFloat(addressInput.dataset.longitude);
                stop.location_type = 'gps';
            } else {
                stop.address = addressValue;
            }
        }
        stops.push(stop);
    });

    if (hasError) {
        showError(hasValidating ? t('validation.pleaseWaitValidation') : t('validation.pleaseFixErrors'));
        return;
    }

    const submitBtn = document.getElementById('quickTripSubmitBtn');
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/trips/quick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, stops })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create trip');
        }

        const trip = await response.json();
        closeModal('quickTripModal');
        window.location.href = `/trip/${trip.id}`;
    } catch (error) {
        showError(error.message);
        submitBtn.disabled = false;
    }
}

// ============================================================================
// Wizard Address Validation
// ============================================================================

function parseGpsCoords(str) {
    // Match "lat, lng" or "lat lng" or "lat,lng" with optional whitespace
    const match = str.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { latitude: lat, longitude: lng };
}

const wizardValidationTimers = {};

function setupWizardAddressValidation(row) {
    const input = row.querySelector('.wizard-address');
    const status = row.querySelector('.address-validation-status');

    input.addEventListener('input', () => {
        const id = input.dataset.wizardId || (input.dataset.wizardId = Math.random().toString(36).slice(2));
        clearTimeout(wizardValidationTimers[id]);
        const value = input.value.trim();

        if (!value) {
            resetWizardAddressStatus(input, status);
            return;
        }

        const gps = parseGpsCoords(value);
        if (gps) {
            input.dataset.validationState = 'valid';
            input.dataset.locationType = 'gps';
            input.dataset.latitude = gps.latitude;
            input.dataset.longitude = gps.longitude;
            setWizardAddressStatus(input, status, 'valid');
            return;
        }

        input.dataset.locationType = 'address';
        setWizardAddressStatus(input, status, 'validating');

        wizardValidationTimers[id] = setTimeout(async () => {
            try {
                const response = await fetch('/api/validate-address', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: value })
                });
                const result = await response.json();
                if (input.value.trim() !== value) return;
                setWizardAddressStatus(input, status, result.valid ? 'valid' : 'invalid');
            } catch {
                setWizardAddressStatus(input, status, 'invalid');
            }
        }, 500);
    });
}

function setWizardAddressStatus(input, status, state) {
    input.dataset.validationState = state;
    if (state === 'validating') {
        status.className = 'address-validation-status validating';
        status.textContent = '...';
    } else if (state === 'valid') {
        status.className = 'address-validation-status valid';
        status.textContent = '\u2713';
    } else if (state === 'invalid') {
        status.className = 'address-validation-status invalid';
        status.textContent = '\u2717';
    }
}

function resetWizardAddressStatus(input, status) {
    delete input.dataset.validationState;
    delete input.dataset.locationType;
    delete input.dataset.latitude;
    delete input.dataset.longitude;
    status.className = 'address-validation-status';
    status.textContent = '';
}

window.addWizardRow = addWizardRow;
window.removeWizardRow = removeWizardRow;
window.handleQuickTripSubmit = handleQuickTripSubmit;

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
