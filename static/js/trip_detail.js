// ============================================================================
// Global State
// ============================================================================

let currentTrip = null;
let stops = [];
let map = null;
let markers = [];
let infoWindows = [];
let routePath = null;

// ============================================================================
// API Functions
// ============================================================================

async function fetchTrip(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}`);
        if (!response.ok) throw new Error('Failed to fetch trip');
        return await response.json();
    } catch (error) {
        console.error('Error fetching trip:', error);
        showError('Failed to load trip');
        return null;
    }
}

async function updateTrip(tripId, name) {
    try {
        const response = await fetch(`/api/trips/${tripId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update trip');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating trip:', error);
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
            throw new Error(error.error || 'Failed to delete trip');
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting trip:', error);
        showError(error.message);
        throw error;
    }
}

async function fetchStops(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}/stops`);
        if (!response.ok) throw new Error('Failed to fetch stops');
        return await response.json();
    } catch (error) {
        console.error('Error fetching stops:', error);
        showError('Failed to load stops');
        return [];
    }
}

async function createStop(tripId, stopData) {
    try {
        const response = await fetch(`/api/trips/${tripId}/stops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stopData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create stop');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating stop:', error);
        showError(error.message);
        throw error;
    }
}

async function updateStop(stopId, stopData) {
    try {
        const response = await fetch(`/api/stops/${stopId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stopData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update stop');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating stop:', error);
        showError(error.message);
        throw error;
    }
}

async function deleteStop(stopId) {
    try {
        const response = await fetch(`/api/stops/${stopId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete stop');
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting stop:', error);
        showError(error.message);
        throw error;
    }
}

async function createActivity(stopId, activityData) {
    try {
        const response = await fetch(`/api/stops/${stopId}/activities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activityData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create activity');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating activity:', error);
        showError(error.message);
        throw error;
    }
}

async function deleteActivity(activityId) {
    try {
        const response = await fetch(`/api/activities/${activityId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete activity');
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting activity:', error);
        showError(error.message);
        throw error;
    }
}

async function calculateRoute(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}/route`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to calculate route');
        }
        return await response.json();
    } catch (error) {
        console.error('Error calculating route:', error);
        showError(error.message);
        throw error;
    }
}

// ============================================================================
// UI Rendering
// ============================================================================

function renderStops(stopsData) {
    const container = document.getElementById('stopsContainer');
    stops = stopsData;

    if (stops.length === 0) {
        container.innerHTML = '<div class="info-text" style="text-align: center; padding: 40px; color: #6c757d;">No stops yet. Add your first stop to begin planning!</div>';
        return;
    }

    container.innerHTML = stops.map((stop, index) => createStopCard(stop, index + 1)).join('');

    // Update map
    updateMap();
}

function createStopCard(stop, index) {
    const startDate = new Date(stop.start_date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const endDate = new Date(stop.end_date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const activities = stop.activities || [];
    const activitiesHtml = activities.length > 0 ? `
        <div class="activities-list">
            <div class="activities-header">
                <h4>Activities (${activities.length})</h4>
                <button class="icon-btn" onclick="openAddActivityModal(${stop.id})" title="Add activity">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
            ${activities.map(activity => createActivityItem(activity)).join('')}
        </div>
    ` : `
        <div class="activities-list">
            <button class="btn btn-secondary btn-sm" onclick="openAddActivityModal(${stop.id})" style="width: 100%;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Activity
            </button>
        </div>
    `;

    return `
        <div class="stop-card" data-stop-id="${stop.id}">
            <div class="stop-header">
                <div class="stop-info">
                    <h3>
                        <span style="color: #6c757d; font-weight: normal; margin-right: 8px;">${index}.</span>
                        ${escapeHtml(stop.name)}
                    </h3>
                    <div class="stop-dates">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${startDate} → ${endDate}
                    </div>
                    ${stop.address ? `<div class="stop-address">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${escapeHtml(stop.address)}
                    </div>` : ''}
                </div>
                <div class="stop-actions">
                    <button class="icon-btn" onclick="showStopOnMap(${stop.id})" title="Show on map">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </button>
                    <button class="icon-btn" onclick="openEditStopModal(${stop.id})" title="Edit stop">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="icon-btn danger" onclick="handleDeleteStop(${stop.id}, '${escapeHtml(stop.name).replace(/'/g, "\\'")}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            ${activitiesHtml}
        </div>
    `;
}

function createActivityItem(activity) {
    return `
        <div class="activity-item">
            <div class="activity-info">
                <div class="activity-name">${escapeHtml(activity.name)}</div>
                ${activity.description ? `<div class="activity-description">${escapeHtml(activity.description)}</div>` : ''}
                ${activity.url ? `<div class="activity-url"><a href="${escapeHtml(activity.url)}" target="_blank" onclick="event.stopPropagation()">View Link</a></div>` : ''}
            </div>
            <div class="activity-actions">
                <button class="icon-btn danger" onclick="handleDeleteActivity(${activity.id}, '${escapeHtml(activity.name).replace(/'/g, "\\'")}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Map Functions
// ============================================================================

function initMap() {
    const mapElement = document.getElementById('map');

    try {
        // Center on Norway by default
        map = new google.maps.Map(mapElement, {
            center: { lat: 60.472, lng: 8.4689 },
            zoom: 5,
            styles: []
        });
    } catch (error) {
        console.error('Error initializing map:', error);
        mapElement.innerHTML = '<div class="map-placeholder"><p style="color: #dc3545;">Error loading Google Maps. Check console for details.</p></div>';
    }
}

function updateMap() {
    if (!map) return;

    // Clear existing markers, info windows, and paths
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    infoWindows = [];
    if (routePath) {
        routePath.setMap(null);
        routePath = null;
    }

    if (stops.length === 0) return;

    // Add markers for each stop
    const bounds = new google.maps.LatLngBounds();

    stops.forEach((stop, index) => {
        if (stop.latitude && stop.longitude) {
            const position = { lat: stop.latitude, lng: stop.longitude };

            // Create custom camping tent icon
            const campingIcon = {
                path: 'M12 2L2 22h20L12 2zm0 4.84L18.16 20H5.84L12 6.84z M10 18h4v-2h-4v2z',
                fillColor: '#0066cc',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#ffffff',
                scale: 1.2,
                anchor: new google.maps.Point(12, 22),
                labelOrigin: new google.maps.Point(12, 10)
            };

            const marker = new google.maps.Marker({
                position: position,
                map: map,
                icon: campingIcon,
                label: {
                    text: (index + 1).toString(),
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px'
                },
                title: stop.name
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 8px;">
                        <h3 style="margin: 0 0 8px 0;">${escapeHtml(stop.name)}</h3>
                        <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(stop.address || 'No address')}</p>
                    </div>
                `
            });

            marker.addListener('click', () => {
                // Close all other info windows
                infoWindows.forEach(iw => iw.close());
                infoWindow.open(map, marker);
            });

            markers.push(marker);
            infoWindows.push(infoWindow);
            bounds.extend(position);
        }
    });

    // Fit map to show all markers
    if (markers.length > 0) {
        map.fitBounds(bounds);
        if (markers.length === 1) {
            map.setZoom(12);
        }
    }
}

function drawRoute(routeData) {
    if (!map || !routeData || !routeData.segments) return;

    // Clear existing route path
    if (routePath) {
        routePath.setMap(null);
    }

    // Create path coordinates
    const pathCoordinates = [];
    stops.forEach(stop => {
        if (stop.latitude && stop.longitude) {
            pathCoordinates.push({ lat: stop.latitude, lng: stop.longitude });
        }
    });

    if (pathCoordinates.length < 2) return;

    // Draw the route
    routePath = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#0066cc',
        strokeOpacity: 0.8,
        strokeWeight: 4
    });

    routePath.setMap(map);
}

function showStopOnMap(stopId) {
    const stopIndex = stops.findIndex(s => s.id === stopId);
    const stop = stops[stopIndex];

    if (!stop || !stop.latitude || !stop.longitude) {
        showError('Unable to show stop on map - no coordinates available');
        return;
    }

    if (!map) {
        showError('Map not initialized');
        return;
    }

    // Center map on the stop
    const position = { lat: stop.latitude, lng: stop.longitude };
    map.setCenter(position);
    map.setZoom(14);

    // Close all info windows and open the selected one
    if (stopIndex !== -1 && markers[stopIndex] && infoWindows[stopIndex]) {
        infoWindows.forEach(iw => iw.close());
        infoWindows[stopIndex].open(map, markers[stopIndex]);
    }

    // Scroll to map on mobile/small screens
    const mapElement = document.getElementById('map');
    if (mapElement && window.innerWidth < 1024) {
        mapElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ============================================================================
// Stop Handlers
// ============================================================================

function populateAddStopModal() {
    const addAfterSelect = document.getElementById('addAfterStop');

    // Clear existing options except "Start of trip"
    addAfterSelect.innerHTML = '<option value="start">Start of trip</option>';

    // Add existing stops as options
    stops.forEach((stop, index) => {
        const option = document.createElement('option');
        option.value = stop.id;
        option.textContent = `After stop ${index + 1}: ${stop.name}`;
        addAfterSelect.appendChild(option);
    });

    // Auto-select the last stop if there are stops
    if (stops.length > 0) {
        addAfterSelect.value = stops[stops.length - 1].id;
    }

    // Calculate initial dates
    calculateStopDates();
}

function calculateStopDates() {
    const addAfterSelect = document.getElementById('addAfterStop');
    const numberOfNights = parseInt(document.getElementById('numberOfNights').value) || 1;
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    let startDate;

    if (addAfterSelect.value === 'start') {
        // If adding at start, use today's date
        startDate = new Date();
    } else {
        // Find the selected stop and use its end date as the new start date
        const selectedStopId = parseInt(addAfterSelect.value);
        const selectedStop = stops.find(s => s.id === selectedStopId);

        if (selectedStop && selectedStop.end_date) {
            startDate = new Date(selectedStop.end_date);
            // Add one day to start the day after the previous stop ends
            startDate.setDate(startDate.getDate() + 1);
        } else {
            startDate = new Date();
        }
    }

    // Calculate end date based on number of nights
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + numberOfNights - 1);

    // Set the input values
    startDateInput.value = formatDateForInput(startDate.toISOString());
    endDateInput.value = formatDateForInput(endDate.toISOString());
}

async function handleAddStopSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const locationType = form.locationType.value;

    const stopData = {
        name: form.stopName.value.trim(),
        start_date: form.startDate.value + 'T00:00:00',
        end_date: form.endDate.value + 'T23:59:59',
        location_type: locationType
    };

    if (locationType === 'address') {
        stopData.address = form.address.value.trim();
        if (!stopData.address) {
            showError('Address is required');
            return;
        }
    } else {
        stopData.latitude = parseFloat(form.latitude.value);
        stopData.longitude = parseFloat(form.longitude.value);
        if (isNaN(stopData.latitude) || isNaN(stopData.longitude)) {
            showError('Valid GPS coordinates are required');
            return;
        }
    }

    try {
        await createStop(tripId, stopData);
        closeModal('addStopModal');
        form.reset();
        showSuccess('Stop added successfully');
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

async function handleEditStopSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const stopId = document.getElementById('editStopId').value;

    const stopData = {
        name: form.stopName.value.trim(),
        start_date: form.startDate.value + 'T00:00:00',
        end_date: form.endDate.value + 'T23:59:59'
    };

    try {
        await updateStop(stopId, stopData);
        closeModal('editStopModal');
        showSuccess('Stop updated successfully');
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

async function handleDeleteStop(stopId, stopName) {
    if (!confirm(`Are you sure you want to delete "${stopName}"? This will also delete all activities at this stop.`)) {
        return;
    }

    try {
        await deleteStop(stopId);
        showSuccess('Stop deleted successfully');
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

function openEditStopModal(stopId) {
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return;

    document.getElementById('editStopId').value = stop.id;
    document.getElementById('editStopName').value = stop.name;
    document.getElementById('editStartDate').value = formatDateForInput(stop.start_date);
    document.getElementById('editEndDate').value = formatDateForInput(stop.end_date);
    document.getElementById('editAddress').value = stop.address || '';

    openModal('editStopModal');
}

// ============================================================================
// Activity Handlers
// ============================================================================

function openAddActivityModal(stopId) {
    document.getElementById('activityStopId').value = stopId;
    document.getElementById('addActivityForm').reset();
    openModal('addActivityModal');
}

async function handleAddActivitySubmit(e) {
    e.preventDefault();

    const form = e.target;
    const stopId = parseInt(document.getElementById('activityStopId').value);

    const activityData = {
        name: form.activityName.value.trim(),
        description: form.activityDescription.value.trim(),
        url: form.activityUrl.value.trim()
    };

    try {
        await createActivity(stopId, activityData);
        closeModal('addActivityModal');
        form.reset();
        showSuccess('Activity added successfully');
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

async function handleDeleteActivity(activityId, activityName) {
    if (!confirm(`Are you sure you want to delete "${activityName}"?`)) {
        return;
    }

    try {
        await deleteActivity(activityId);
        showSuccess('Activity deleted successfully');
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

// ============================================================================
// Trip Handlers
// ============================================================================

async function handleEditTripSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const tripName = form.tripName.value.trim();

    if (!tripName) {
        showError('Trip name is required');
        return;
    }

    try {
        const updatedTrip = await updateTrip(tripId, tripName);
        closeModal('editTripModal');
        document.getElementById('tripTitle').textContent = updatedTrip.name;
        currentTrip = updatedTrip;
        showSuccess('Trip name updated successfully');
    } catch (error) {
        // Error already shown
    }
}

async function handleDeleteTrip() {
    if (!currentTrip) return;

    if (!confirm(`Are you sure you want to delete "${currentTrip.name}"? This will also delete all stops and activities.`)) {
        return;
    }

    try {
        await deleteTrip(tripId);
        showSuccess('Trip deleted successfully');
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    } catch (error) {
        // Error already shown
    }
}

// ============================================================================
// Route Calculation
// ============================================================================

async function handleCalculateRoute() {
    if (stops.length < 2) {
        showError('You need at least 2 stops to calculate a route');
        return;
    }

    const btn = document.getElementById('calculateRouteBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Calculating...';
    btn.disabled = true;

    try {
        const routeData = await calculateRoute(tripId);
        displayRouteInfo(routeData);
        drawRoute(routeData);
        showSuccess('Route calculated successfully');
    } catch (error) {
        // Error already shown
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function displayRouteInfo(routeData) {
    const container = document.getElementById('routeInfo');

    if (!routeData || !routeData.total_distance_km) {
        container.innerHTML = '<p class="info-text">Unable to calculate route</p>';
        return;
    }

    const hoursEstimate = (routeData.total_distance_km / 80).toFixed(1);

    let html = `
        <div class="route-stats">
            <div class="route-stat">
                <span class="value">${routeData.total_distance_km.toFixed(1)}</span>
                <span class="label">km total</span>
            </div>
            <div class="route-stat">
                <span class="value">${hoursEstimate}</span>
                <span class="label">hours (est.)</span>
            </div>
        </div>
    `;

    if (routeData.segments && routeData.segments.length > 0) {
        html += `
            <div class="route-segments">
                <h4>Route Segments</h4>
                ${routeData.segments.map(segment => `
                    <div class="segment">
                        <div class="route">${escapeHtml(segment.from)} → ${escapeHtml(segment.to)}</div>
                        <div class="distance">${segment.distance_km.toFixed(1)} km</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
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
// Utility Functions
// ============================================================================

function formatDateForInput(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================================
// Notification Functions
// ============================================================================

function showNotification(message, type = 'info') {
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
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadTrip() {
    const trip = await fetchTrip(tripId);
    if (trip) {
        currentTrip = trip;
        document.getElementById('tripTitle').textContent = trip.name;
    }
}

async function loadStops() {
    const stopsData = await fetchStops(tripId);
    renderStops(stopsData);
}

// ============================================================================
// Event Listeners
// ============================================================================

// Make initMap available globally for Google Maps callback
window.initMap = initMap;

document.addEventListener('DOMContentLoaded', async () => {
    // Load data
    await loadTrip();
    await loadStops();

    // Initialize map if Google Maps is already loaded
    if (typeof google !== 'undefined' && google.maps) {
        initMap();
    }
    // Otherwise, wait for callback from script tag

    // Add stop button
    document.getElementById('addStopBtn').addEventListener('click', () => {
        populateAddStopModal();
        openModal('addStopModal');
    });

    // Add stop form
    document.getElementById('addStopForm').addEventListener('submit', handleAddStopSubmit);

    // Edit stop form
    document.getElementById('editStopForm').addEventListener('submit', handleEditStopSubmit);

    // Location type radio buttons
    const radioButtons = document.querySelectorAll('input[name="locationType"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const addressInput = document.getElementById('addressInput');
            const gpsInput = document.getElementById('gpsInput');

            if (e.target.value === 'address') {
                addressInput.style.display = 'block';
                gpsInput.style.display = 'none';
                document.getElementById('address').required = true;
                document.getElementById('latitude').required = false;
                document.getElementById('longitude').required = false;
            } else {
                addressInput.style.display = 'none';
                gpsInput.style.display = 'flex';
                document.getElementById('address').required = false;
                document.getElementById('latitude').required = true;
                document.getElementById('longitude').required = true;
            }
        });
    });

    // Add stop date calculation listeners
    document.getElementById('addAfterStop').addEventListener('change', calculateStopDates);
    document.getElementById('numberOfNights').addEventListener('input', calculateStopDates);

    // Add activity form
    document.getElementById('addActivityForm').addEventListener('submit', handleAddActivitySubmit);

    // Edit trip button
    document.getElementById('editTripBtn').addEventListener('click', () => {
        if (currentTrip) {
            document.getElementById('editTripName').value = currentTrip.name;
            openModal('editTripModal');
        }
    });

    // Edit trip form
    document.getElementById('editTripForm').addEventListener('submit', handleEditTripSubmit);

    // Delete trip button
    document.getElementById('deleteTripBtn').addEventListener('click', handleDeleteTrip);

    // Calculate route button
    document.getElementById('calculateRouteBtn').addEventListener('click', handleCalculateRoute);
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
