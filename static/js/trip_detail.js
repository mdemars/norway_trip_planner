// ============================================================================
// Global State
// ============================================================================

let currentTrip = null;
let stops = [];
let waypoints = [];
let map = null;
let markers = [];
let infoWindows = [];
let routePath = null;
let pendingStopUpdate = null; // Store pending update data for duration change

// 8 distinct colors for stops
const STOP_COLORS = [
    '#4285F4', // Blue
    '#34A853', // Green
    '#FBBC04', // Yellow
    '#EA4335', // Red
    '#9334E6', // Purple
    '#FF6D00', // Orange
    '#00ACC1', // Cyan
    '#E91E63'  // Pink
];

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
        showError(t('errors.failedToLoadTrip'));
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
            throw new Error(error.error || t('errors.failedToUpdateTrip'));
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
            throw new Error(error.error || t('errors.failedToDeleteTrip'));
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
        showError(t('errors.failedToLoadStops'));
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
            throw new Error(error.error || t('errors.failedToCreateStop'));
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
            throw new Error(error.error || t('errors.failedToUpdateStop'));
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating stop:', error);
        showError(error.message);
        throw error;
    }
}

async function deleteStopApi(stopId) {
    try {
        const response = await fetch(`/api/stops/${stopId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || t('errors.failedToDeleteStop'));
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
            throw new Error(error.error || t('errors.failedToCreateActivity'));
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
            throw new Error(error.error || t('errors.failedToDeleteActivity'));
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
            throw new Error(error.error || t('errors.failedToCalculateRoute'));
        }
        return await response.json();
    } catch (error) {
        console.error('Error calculating route:', error);
        showError(error.message);
        throw error;
    }
}

async function fetchWaypoints(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}/waypoints`);
        if (!response.ok) throw new Error('Failed to fetch waypoints');
        return await response.json();
    } catch (error) {
        console.error('Error fetching waypoints:', error);
        return [];
    }
}

async function createWaypoint(tripId, waypointData) {
    try {
        const response = await fetch(`/api/trips/${tripId}/waypoints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(waypointData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || t('errors.failedToCreateWaypoint'));
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating waypoint:', error);
        showError(error.message);
        throw error;
    }
}

async function deleteWaypoint(waypointId) {
    try {
        const response = await fetch(`/api/waypoints/${waypointId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || t('errors.failedToDeleteWaypoint'));
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting waypoint:', error);
        showError(error.message);
        throw error;
    }
}

// ============================================================================
// UI Rendering
// ============================================================================

function renderStops(stopsData, waypointsData) {
    const container = document.getElementById('stopsContainer');
    stops = stopsData;
    waypoints = waypointsData || [];

    if (stops.length === 0) {
        container.innerHTML = `<div class="info-text" style="text-align: center; padding: 40px; color: #6c757d;">${t('stops.noStopsYet')}</div>`;
        return;
    }

    // Build combined list with stops and waypoints
    let html = '';
    stops.forEach((stop, index) => {
        html += createStopCard(stop, index + 1);

        // Add button to insert waypoint after this stop (except after the last stop)
        if (index < stops.length - 1) {
            const nextStop = stops[index + 1];
            
            // Add "insert waypoint" button
            html += `
                <div style="display: flex; justify-content: center; padding: 8px 0;">
                    <button class="btn btn-secondary btn-sm" onclick="openAddWaypointModal('${stop.id}', '${nextStop.id}')" style="font-size: 0.85em;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        ${t('waypoints.addWaypoint')}
                    </button>
                </div>
            `;
        }
    });

    container.innerHTML = html;

    // Update map
    updateMap();

    // Update calendar
    renderCalendar();
}

function createStopCard(stop, index) {
    // Check if this is a trip location (start/end)
    if (stop.is_trip_location) {
        const color = STOP_COLORS[(index - 1) % STOP_COLORS.length];
        const labelText = stop.type === 'trip-start' ? t('locations.start') : t('locations.end');
        
        return `
            <div class="stop-card collapsed trip-location-card" data-stop-id="${stop.id}" style="border-left-color: ${color};">
                <div class="stop-header" onclick="toggleStopCollapse('${stop.id}')">
                    <div class="stop-title-row">
                        <button class="collapse-toggle" onclick="event.stopPropagation(); toggleStopCollapse('${stop.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <h3>
                            <span style="color: #6c757d; font-weight: normal; margin-right: 8px;">${index}.</span>
                            <span style="font-style: italic; color: #6c757d;">${labelText}:</span>
                            ${escapeHtml(stop.name)}
                        </h3>
                    </div>
                    <div class="stop-actions" onclick="event.stopPropagation()">
                        <button class="icon-btn" onclick="showStopOnMap('${stop.id}')" title="${t('stops.showOnMap')}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                        </button>
                        <button class="icon-btn" onclick="openEditTripLocationModal('${stop.id}', '${stop.type}')" title="${t('buttons.edit')}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="icon-btn danger" onclick="handleDeleteTripLocation('${stop.id}', '${stop.type}', '${escapeHtml(stop.name).replace(/'/g, "\\'")}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="stop-details">
                    <div class="stop-info-section">
                        ${stop.address ? `<div class="stop-address">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            ${escapeHtml(stop.address)}
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Regular stop card
    const startDate = formatDate(stop.start_date);
    const endDate = formatDate(stop.end_date);

    // Calculate number of nights (days difference, excluding last day)
    const start = new Date(stop.start_date);
    const end = new Date(stop.end_date);
    const daysDifference = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const nights = daysDifference;
    const nightsText = t('stops.night', { count: nights });

    const activities = stop.activities || [];
    const activitiesHtml = activities.length > 0 ? `
        <div class="activities-list">
            <div class="activities-header">
                <h4>${t('activities.title')} (${activities.length})</h4>
                <button class="icon-btn" onclick="openAddActivityModal(${stop.id})" title="${t('activities.addActivity')}">
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
                ${t('activities.addActivity')}
            </button>
        </div>
    `;

    const color = STOP_COLORS[(index - 1) % STOP_COLORS.length];

    return `
        <div class="stop-card collapsed" data-stop-id="${stop.id}" style="border-left-color: ${color};">
            <div class="stop-header" onclick="toggleStopCollapse(${stop.id})">
                <div class="stop-title-row">
                    <button class="collapse-toggle" onclick="event.stopPropagation(); toggleStopCollapse(${stop.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <h3>
                        <span style="color: #6c757d; font-weight: normal; margin-right: 8px;">${index}.</span>
                        ${escapeHtml(stop.name)}
                        <span style="color: #6c757d; font-weight: normal; font-size: 0.85em; margin-left: 8px;">(${nightsText})</span>
                    </h3>
                </div>
                <div class="stop-actions" onclick="event.stopPropagation()">
                    <button class="icon-btn" onclick="showStopOnMap(${stop.id})" title="${t('stops.showOnMap')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </button>
                    <button class="icon-btn" onclick="openEditStopModal(${stop.id})" title="${t('buttons.edit')}">
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
            <div class="stop-details">
                <div class="stop-info-section">
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
                ${activitiesHtml}
            </div>
        </div>
    `;
}

function createActivityItem(activity) {
    return `
        <div class="activity-item">
            <div class="activity-info">
                <div class="activity-name">${escapeHtml(activity.name)}</div>
                ${activity.description ? `<div class="activity-description">${escapeHtml(activity.description)}</div>` : ''}
                ${activity.url ? `<div class="activity-url"><a href="${escapeHtml(activity.url)}" target="_blank" onclick="event.stopPropagation()">${t('activities.viewLink')}</a></div>` : ''}
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

function createWaypointCard(waypoint) {
    return `
        <div class="waypoint-card collapsed" data-waypoint-id="${waypoint.id}" style="margin: 8px 0; padding: 12px; background: #f8f9fa; border-left: 3px solid #6c757d; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleWaypointCollapse(${waypoint.id})">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="collapse-toggle" onclick="event.stopPropagation(); toggleWaypointCollapse(${waypoint.id})" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <div style="font-weight: 500; color: #495057;">${escapeHtml(waypoint.name)}</div>
                </div>
                <div onclick="event.stopPropagation()">
                    <button class="icon-btn danger" onclick="handleDeleteWaypoint(${waypoint.id}, '${escapeHtml(waypoint.name).replace(/'/g, "\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="waypoint-details" style="margin-top: 12px; padding-left: 40px;">
                ${waypoint.address ? `<div style="font-size: 0.85em; color: #6c757d; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    ${escapeHtml(waypoint.address)}
                </div>` : `<div style="font-size: 0.85em; color: #6c757d;">${t('locations.noAddress')}</div>`}
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
        mapElement.innerHTML = `<div class="map-placeholder"><p style="color: #dc3545;">${t('map.errorLoading')}</p></div>`;
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

    const bounds = new google.maps.LatLngBounds();

    // Add start location marker if it exists
    if (currentTrip && currentTrip.start_location && currentTrip.start_location.latitude) {
        const position = {
            lat: currentTrip.start_location.latitude,
            lng: currentTrip.start_location.longitude
        };

        const startIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#28a745',
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#ffffff',
            scale: 12
        };

        const marker = new google.maps.Marker({
            position: position,
            map: map,
            icon: startIcon,
            label: {
                text: 'S',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px'
            },
            title: t('locations.tripStart')
        });

        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 8px;">
                    <h3 style="margin: 0 0 8px 0; color: #28a745;">${t('locations.tripStart')}</h3>
                    <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(currentTrip.start_location.address || t('locations.startingLocation'))}</p>
                </div>
            `
        });

        marker.addListener('click', () => {
            infoWindows.forEach(iw => iw.close());
            infoWindow.open(map, marker);
        });

        markers.push(marker);
        infoWindows.push(infoWindow);
        bounds.extend(position);
    }

    if (stops.length === 0 && (!currentTrip || !currentTrip.start_location)) return;

    // Add markers for each stop

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
                        <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(stop.address || t('locations.noAddress'))}</p>
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

    // Add markers for waypoints
    waypoints.forEach((waypoint) => {
        if (waypoint.latitude && waypoint.longitude) {
            const position = { lat: waypoint.latitude, lng: waypoint.longitude };

            // Create a simple circular marker for waypoints
            const waypointIcon = {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#6c757d',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#ffffff',
                scale: 8
            };

            const marker = new google.maps.Marker({
                position: position,
                map: map,
                icon: waypointIcon,
                title: waypoint.name
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 8px;">
                        <h3 style="margin: 0 0 8px 0; color: #6c757d;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            ${escapeHtml(waypoint.name)}
                        </h3>
                        <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(waypoint.address || t('waypoints.waypoint'))}</p>
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

    // Add end location marker if it exists
    if (currentTrip && currentTrip.end_location && currentTrip.end_location.latitude) {
        const position = {
            lat: currentTrip.end_location.latitude,
            lng: currentTrip.end_location.longitude
        };

        const endIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#dc3545',
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#ffffff',
            scale: 12
        };

        const marker = new google.maps.Marker({
            position: position,
            map: map,
            icon: endIcon,
            label: {
                text: 'E',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px'
            },
            title: t('locations.tripEnd')
        });

        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 8px;">
                    <h3 style="margin: 0 0 8px 0; color: #dc3545;">${t('locations.tripEnd')}</h3>
                    <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(currentTrip.end_location.address || t('locations.endingLocation'))}</p>
                </div>
            `
        });

        marker.addListener('click', () => {
            infoWindows.forEach(iw => iw.close());
            infoWindow.open(map, marker);
        });

        markers.push(marker);
        infoWindows.push(infoWindow);
        bounds.extend(position);
    }

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

    // Build the complete path using polyline data from each segment
    const allPathCoordinates = [];

    routeData.segments.forEach(segment => {
        if (segment.polyline) {
            // Decode the Google polyline format
            const decodedPath = google.maps.geometry.encoding.decodePath(segment.polyline);
            allPathCoordinates.push(...decodedPath);
        }
    });

    if (allPathCoordinates.length < 2) {
        // Fallback to straight lines if no polyline data
        stops.forEach(stop => {
            if (stop.latitude && stop.longitude) {
                allPathCoordinates.push({ lat: stop.latitude, lng: stop.longitude });
            }
        });
    }

    if (allPathCoordinates.length < 2) return;

    // Draw the route following roads
    routePath = new google.maps.Polyline({
        path: allPathCoordinates,
        geodesic: false, // Set to false since we're using exact road paths
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
        showError(t('map.unableToShow'));
        return;
    }

    if (!map) {
        showError(t('map.notInitialized'));
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
// Calendar Functions
// ============================================================================

function renderCalendar() {
    // Filter to only stops with dates (exclude trip start/end locations)
    const stopsWithDates = stops.filter(stop => stop.start_date && stop.end_date);

    if (!stopsWithDates || stopsWithDates.length === 0) {
        document.getElementById('calendar').innerHTML = `
            <div class="calendar-placeholder">
                <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <p>${t('calendar.addStopsToSee')}</p>
            </div>
        `;
        return;
    }

    // Find the date range of the trip
    const allDates = stopsWithDates.flatMap(stop => [new Date(stop.start_date), new Date(stop.end_date)]);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    // Generate list of months to display
    const months = [];
    const currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const lastMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    while (currentMonth <= lastMonth) {
        months.push(new Date(currentMonth));
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Build calendar HTML
    let calendarHTML = '<div class="calendar-months">';

    months.forEach(monthDate => {
        calendarHTML += renderMonth(monthDate);
    });

    // Add legend (only for stops with dates)
    calendarHTML += `<div class="calendar-legend"><h4>${t('calendar.stops')}</h4><div class="calendar-legend-items">`;
    stopsWithDates.forEach((stop, index) => {
        const color = STOP_COLORS[index % STOP_COLORS.length];
        calendarHTML += `
            <div class="calendar-legend-item">
                <div class="calendar-legend-color" style="background: ${color};"></div>
                <div class="calendar-legend-text" title="${escapeHtml(stop.name)}">${escapeHtml(stop.name)}</div>
            </div>
        `;
    });
    calendarHTML += '</div></div>';

    calendarHTML += '</div>';

    document.getElementById('calendar').innerHTML = calendarHTML;
}

function renderMonth(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Get localized month name
    const monthNames = [
        t('calendar.months.january'), t('calendar.months.february'), t('calendar.months.march'),
        t('calendar.months.april'), t('calendar.months.may'), t('calendar.months.june'),
        t('calendar.months.july'), t('calendar.months.august'), t('calendar.months.september'),
        t('calendar.months.october'), t('calendar.months.november'), t('calendar.months.december')
    ];
    const monthName = `${monthNames[month]} ${year}`;

    // Get first and last day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for first day (0 = Sunday)
    const firstDayOfWeek = firstDay.getDay();

    // Localized weekday names
    const weekdays = [
        t('calendar.weekdays.sun'), t('calendar.weekdays.mon'), t('calendar.weekdays.tue'),
        t('calendar.weekdays.wed'), t('calendar.weekdays.thu'), t('calendar.weekdays.fri'),
        t('calendar.weekdays.sat')
    ];

    // Build calendar grid
    let html = `
        <div class="calendar-month">
            <div class="calendar-header">
                <h3>${monthName}</h3>
            </div>
            <div class="calendar-weekdays">
                ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
            </div>
            <div class="calendar-days">
    `;

    // Add empty cells for days before the first day of the month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const prevMonthStartDay = prevMonthLastDay - firstDayOfWeek + 1;
    for (let i = 0; i < firstDayOfWeek; i++) {
        const dayNum = prevMonthStartDay + i;
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${dayNum}</div></div>`;
    }

    // Add days of the current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDate = new Date(year, month, day);
        const stopsOnDay = getStopsForDay(currentDate);

        html += `<div class="calendar-day">`;
        html += `<div class="calendar-day-number">${day}</div>`;

        if (stopsOnDay.length > 0) {
            html += `<div class="calendar-day-stops">`;
            stopsOnDay.forEach(({ stop, index, isStart, isEnd }) => {
                const color = STOP_COLORS[index % STOP_COLORS.length];

                // Show label only on start day
                if (isStart) {
                    html += `
                        <div class="calendar-stop-label" style="background: ${color}; cursor: pointer;" title="${escapeHtml(stop.name)}" onclick="handleCalendarStopClick(${stop.id})">
                            ${escapeHtml(stop.name)}
                        </div>
                    `;
                } else {
                    html += `<div class="calendar-stop-bar" style="background: ${color}; cursor: pointer;" title="${escapeHtml(stop.name)}" onclick="handleCalendarStopClick(${stop.id})"></div>`;
                }
            });
            html += `</div>`;
        }

        html += `</div>`;
    }

    // Add empty cells for days after the last day of the month
    const lastDayOfWeek = lastDay.getDay();
    const remainingDays = 6 - lastDayOfWeek;
    for (let i = 1; i <= remainingDays; i++) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${i}</div></div>`;
    }

    html += `</div></div>`;

    return html;
}

function getStopsForDay(date) {
    const stopsOnDay = [];

    // Filter to only stops with dates (exclude trip start/end locations)
    const stopsWithDates = stops.filter(stop => stop.start_date && stop.end_date);

    stopsWithDates.forEach((stop, index) => {
        const startDate = new Date(stop.start_date);
        const endDate = new Date(stop.end_date);

        // Set time to midnight for accurate date comparison
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        if (checkDate >= startDate && checkDate <= endDate) {
            stopsOnDay.push({
                stop,
                index,
                isStart: checkDate.getTime() === startDate.getTime(),
                isEnd: checkDate.getTime() === endDate.getTime()
            });
        }
    });

    return stopsOnDay;
}

function handleCalendarStopClick(stopId) {
    // Collapse all stops
    document.querySelectorAll('.stop-card').forEach(card => {
        card.classList.add('collapsed');
    });

    // Expand the clicked stop
    const stopCard = document.querySelector(`.stop-card[data-stop-id="${stopId}"]`);
    if (stopCard) {
        stopCard.classList.remove('collapsed');

        // Scroll to the stop
        setTimeout(() => {
            stopCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

// ============================================================================
// Stop Handlers
// ============================================================================

function populateAddStopModal() {
    const addAfterSelect = document.getElementById('addAfterStop');

    // Clear existing options except "Start of trip"
    addAfterSelect.innerHTML = `<option value="start">${t('dates.startOfTrip')}</option>`;

    // Add existing stops as options
    stops.forEach((stop, index) => {
        const option = document.createElement('option');
        option.value = stop.id;
        option.textContent = t('dates.afterStop', { index: index + 1, name: stop.name });
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

    // Calculate end date based on number of nights (end date is departure day)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + numberOfNights);

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
        end_date: form.endDate.value + 'T00:00:00',
        location_type: locationType
    };

    if (locationType === 'address') {
        stopData.address = form.address.value.trim();
        if (!stopData.address) {
            showError(t('validation.addressRequired'));
            return;
        }
    } else {
        stopData.latitude = parseFloat(form.latitude.value);
        stopData.longitude = parseFloat(form.longitude.value);
        if (isNaN(stopData.latitude) || isNaN(stopData.longitude)) {
            showError(t('validation.validCoordinatesRequired'));
            return;
        }
    }

    try {
        await createStop(tripId, stopData);
        closeModal('addStopModal');
        form.reset();
        showSuccess(t('notifications.stopAdded'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

async function handleEditStopSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const stopId = document.getElementById('editStopId').value;
    const tripLocationType = form.dataset.tripLocationType;
    
    // Check if this is a trip location edit
    if (tripLocationType) {
        const locationType = form.editLocationType.value;
        const isStart = tripLocationType === 'trip-start';
        
        const locationData = {
            location_type: locationType
        };

        if (locationType === 'address') {
            locationData[isStart ? 'start_location_address' : 'end_location_address'] = form.address.value.trim();
            if (!locationData[isStart ? 'start_location_address' : 'end_location_address']) {
                showError(t('validation.addressRequired'));
                return;
            }
        } else if (locationType === 'gps') {
            const latitude = parseFloat(form.latitude.value);
            const longitude = parseFloat(form.longitude.value);
            if (isNaN(latitude) || isNaN(longitude)) {
                showError(t('validation.validCoordinatesRequired'));
                return;
            }
            locationData[isStart ? 'start_location_latitude' : 'end_location_latitude'] = latitude;
            locationData[isStart ? 'start_location_longitude' : 'end_location_longitude'] = longitude;
            locationData[isStart ? 'start_location_address' : 'end_location_address'] = form.address.value.trim() || null;
        }

        try {
            const response = await fetch(`/api/trips/${tripId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(locationData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update location');
            }

            closeModal('editStopModal');
            form.dataset.tripLocationType = '';
            document.getElementById('editStartDate').parentElement.style.display = 'block';
            document.getElementById('editEndDate').parentElement.style.display = 'block';
            showSuccess(t('notifications.stopUpdated'));
            await loadTrip();
            await loadStops();
        } catch (error) {
            console.error('Error updating trip location:', error);
            showError(error.message);
        }
        return;
    }

    // Regular stop edit
    const stopIndex = stops.findIndex(s => s.id === stopId);
    const originalStop = stops[stopIndex];
    const locationType = form.editLocationType.value;

    const stopData = {
        name: form.stopName.value.trim(),
        start_date: form.startDate.value + 'T00:00:00',
        end_date: form.endDate.value + 'T00:00:00',
        location_type: locationType
    };

    if (locationType === 'address') {
        stopData.address = form.address.value.trim();
        if (!stopData.address) {
            showError(t('validation.addressRequired'));
            return;
        }
    } else if (locationType === 'gps') {
        stopData.latitude = parseFloat(form.latitude.value);
        stopData.longitude = parseFloat(form.longitude.value);
        if (isNaN(stopData.latitude) || isNaN(stopData.longitude)) {
            showError(t('validation.validCoordinatesRequired'));
            return;
        }
    }

    // Check if duration was extended and there are following stops
    const originalEndDate = new Date(originalStop.end_date);
    const newEndDate = new Date(stopData.end_date);
    const hasFollowingStops = stopIndex < stops.length - 1;

    if (newEndDate > originalEndDate && hasFollowingStops) {
        // Duration extended - ask user how to handle following stops
        pendingStopUpdate = {
            stopId,
            stopIndex,
            stopData,
            originalEndDate,
            newEndDate,
            daysDifference: Math.round((newEndDate - originalEndDate) / (1000 * 60 * 60 * 24))
        };

        closeModal('editStopModal');
        openModal('durationChangeModal');
        return;
    }

    // No duration extension or no following stops - just update normally
    try {
        await updateStop(stopId, stopData);
        closeModal('editStopModal');
        showSuccess(t('notifications.stopUpdated'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

async function handleDeleteStop(stopId, stopName) {
    if (!confirm(t('confirmations.deleteStop', { name: stopName }))) {
        return;
    }

    try {
        await deleteStopApi(stopId);
        showSuccess(t('notifications.stopDeleted'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

function openEditStopModal(stopId) {
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return;

    // Clear any trip location type from previous edit
    document.getElementById('editStopForm').dataset.tripLocationType = '';

    document.getElementById('editStopId').value = stop.id;
    document.getElementById('editStopName').value = stop.name;

    // Show date fields and restore required attribute for regular stops
    const startDateInput = document.getElementById('editStartDate');
    const endDateInput = document.getElementById('editEndDate');
    startDateInput.parentElement.style.display = 'block';
    endDateInput.parentElement.style.display = 'block';
    startDateInput.required = true;
    endDateInput.required = true;
    startDateInput.value = formatDateForInput(stop.start_date);
    endDateInput.value = formatDateForInput(stop.end_date);

    // Set location type and values
    const locationType = stop.location_type || 'address';
    document.querySelector(`input[name="editLocationType"][value="${locationType}"]`).checked = true;

    // Populate fields
    document.getElementById('editAddress').value = stop.address || '';
    // Round coordinates to 4 decimal places for display
    document.getElementById('editLatitude').value = stop.latitude ? parseFloat(stop.latitude).toFixed(4) : '';
    document.getElementById('editLongitude').value = stop.longitude ? parseFloat(stop.longitude).toFixed(4) : '';

    // Always show both address and GPS fields
    const addressInput = document.getElementById('editAddressInput');
    const gpsInput = document.getElementById('editGpsInput');
    const latInput = document.getElementById('editLatitude');
    const lonInput = document.getElementById('editLongitude');

    addressInput.style.display = 'block';
    gpsInput.style.display = 'flex';

    if (locationType === 'gps') {
        document.getElementById('editAddress').required = false;
        latInput.required = true;
        lonInput.required = true;
        latInput.readOnly = false;
        lonInput.readOnly = false;
    } else {
        document.getElementById('editAddress').required = true;
        latInput.required = false;
        lonInput.required = false;
        latInput.readOnly = true;
        lonInput.readOnly = true;
    }

    openModal('editStopModal');
}

async function handleShiftAllStops() {
    if (!pendingStopUpdate) return;

    const { stopId, stopIndex, stopData, daysDifference } = pendingStopUpdate;

    try {
        // Update the current stop
        await updateStop(stopId, stopData);

        // Update all following stops
        const followingStops = stops.slice(stopIndex + 1);

        for (const stop of followingStops) {
            const startDate = new Date(stop.start_date);
            const endDate = new Date(stop.end_date);

            // Add the difference to both start and end dates
            startDate.setDate(startDate.getDate() + daysDifference);
            endDate.setDate(endDate.getDate() + daysDifference);

            const updatedData = {
                name: stop.name,
                start_date: startDate.toISOString().split('T')[0] + 'T00:00:00',
                end_date: endDate.toISOString().split('T')[0] + 'T00:00:00'
            };

            await updateStop(stop.id, updatedData);
        }

        closeModal('durationChangeModal');
        showSuccess(t('notifications.stopsShifted'));
        await loadStops();
        pendingStopUpdate = null;
    } catch (error) {
        showError(t('errors.failedToUpdateStops'));
        pendingStopUpdate = null;
    }
}

async function handleAdjustNextStop() {
    if (!pendingStopUpdate) return;

    const { stopId, stopIndex, stopData, newEndDate } = pendingStopUpdate;

    try {
        // Update the current stop
        await updateStop(stopId, stopData);

        // Update only the next stop
        const nextStop = stops[stopIndex + 1];

        if (nextStop) {
            const nextStartDate = new Date(newEndDate);
            nextStartDate.setDate(nextStartDate.getDate() + 1); // Day after current stop ends

            const nextEndDate = new Date(nextStop.end_date);

            // Check if the adjustment makes the next stop invalid (start after end)
            if (nextStartDate >= nextEndDate) {
                showError(t('notifications.cannotAdjust'));
                pendingStopUpdate = null;
                closeModal('durationChangeModal');
                return;
            }

            const updatedData = {
                name: nextStop.name,
                start_date: nextStartDate.toISOString().split('T')[0] + 'T00:00:00',
                end_date: nextStop.end_date // Keep original end date
            };

            await updateStop(nextStop.id, updatedData);
        }

        closeModal('durationChangeModal');
        showSuccess(t('notifications.nextStopAdjusted'));
        await loadStops();
        pendingStopUpdate = null;
    } catch (error) {
        showError(t('errors.failedToUpdateStops'));
        pendingStopUpdate = null;
    }
}

// ============================================================================
// Activity Handlers
// ============================================================================

function openEditTripLocationModal(locationId, locationType) {
    const isStart = locationType === 'trip-start';
    const location = isStart ? currentTrip.start_location : currentTrip.end_location;

    if (!location) return;

    // Determine modal to use (we'll use the edit stop modal for consistency)
    document.getElementById('editStopId').value = locationId;
    document.getElementById('editStopName').value = location.address || '';

    // Set location type
    const type = location.latitude && location.longitude ? 'gps' : 'address';
    document.querySelector(`input[name="editLocationType"][value="${type}"]`).checked = true;

    // Populate fields
    document.getElementById('editAddress').value = location.address || '';
    document.getElementById('editLatitude').value = location.latitude || '';
    document.getElementById('editLongitude').value = location.longitude || '';

    // Hide date fields and remove required attribute (not applicable to trip locations)
    const startDateInput = document.getElementById('editStartDate');
    const endDateInput = document.getElementById('editEndDate');
    startDateInput.parentElement.style.display = 'none';
    endDateInput.parentElement.style.display = 'none';
    startDateInput.required = false;
    endDateInput.required = false;

    // Store that this is a trip location for the save handler
    document.getElementById('editStopForm').dataset.tripLocationType = locationType;

    // Trigger change event to show/hide appropriate fields
    document.querySelector(`input[name="editLocationType"][value="${type}"]`).dispatchEvent(new Event('change'));

    openModal('editStopModal');
}

async function handleDeleteTripLocation(locationId, locationType, address) {
    if (!confirm(`${t('confirmations.deleteStop', { name: address })}`)) {
        return;
    }

    try {
        const isStart = locationType === 'trip-start';
        const updateData = isStart ? 
            { start_location_address: null } : 
            { end_location_address: null };

        const response = await fetch(`/api/trips/${tripId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete location');
        }

        showSuccess(t('notifications.stopDeleted'));
        await loadTrip();
        await loadStops();
    } catch (error) {
        console.error('Error deleting trip location:', error);
        showError(error.message);
    }
}

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
        showSuccess(t('notifications.activityAdded'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

async function handleDeleteActivity(activityId, activityName) {
    if (!confirm(t('confirmations.deleteActivity', { name: activityName }))) {
        return;
    }

    try {
        await deleteActivity(activityId);
        showSuccess(t('notifications.activityDeleted'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

// ============================================================================
// Waypoint Handlers
// ============================================================================

function openAddWaypointModal(afterStopId, beforeStopId) {
    document.getElementById('addWaypointForm').reset();

    // Populate previous location dropdown
    const previousLocationSelect = document.getElementById('waypointPreviousLocation');
    previousLocationSelect.innerHTML = `<option value="">${t('waypoints.noPreviousLocation') || 'None (start of route)'}</option>`;

    // Add the stop after which we're inserting the waypoint
    const afterStop = stops.find(s => s.id === afterStopId);
    if (afterStop) {
        const option = document.createElement('option');
        option.value = afterStop.guid;
        option.textContent = afterStop.name;
        previousLocationSelect.appendChild(option);
        previousLocationSelect.value = afterStop.guid; // Auto-select
    }

    openModal('addWaypointModal');
}

async function handleAddWaypointSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const locationType = document.querySelector('input[name="waypointLocationType"]:checked').value;
    const previousLocationGuid = document.getElementById('waypointPreviousLocation').value || null;

    const waypointData = {
        name: form.waypointName.value.trim(),
        location_type: locationType,
        previous_location_guid: previousLocationGuid
    };

    if (locationType === 'address') {
        waypointData.address = document.getElementById('waypointAddress').value.trim();
        if (!waypointData.address) {
            showError(t('validation.addressRequired'));
            return;
        }
    } else {
        waypointData.latitude = parseFloat(document.getElementById('waypointLatitude').value);
        waypointData.longitude = parseFloat(document.getElementById('waypointLongitude').value);
        if (isNaN(waypointData.latitude) || isNaN(waypointData.longitude)) {
            showError(t('validation.validCoordinatesRequired'));
            return;
        }
    }

    try {
        await createWaypoint(tripId, waypointData);
        closeModal('addWaypointModal');
        form.reset();
        showSuccess(t('notifications.waypointAdded'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

async function handleDeleteWaypoint(waypointId, waypointName) {
    if (!confirm(t('confirmations.deleteWaypoint', { name: waypointName }))) {
        return;
    }

    try {
        await deleteWaypoint(waypointId);
        showSuccess(t('notifications.waypointDeleted'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

// ============================================================================
// Collapse/Expand Handlers
// ============================================================================

function toggleStopCollapse(stopId) {
    const stopCard = document.querySelector(`.stop-card[data-stop-id="${stopId}"]`);
    if (stopCard) {
        stopCard.classList.toggle('collapsed');
    }
}

function toggleWaypointCollapse(waypointId) {
    const waypointCard = document.querySelector(`.waypoint-card[data-waypoint-id="${waypointId}"]`);
    if (waypointCard) {
        waypointCard.classList.toggle('collapsed');
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
        showError(t('validation.tripNameRequired'));
        return;
    }

    try {
        const updatedTrip = await updateTrip(tripId, tripName);
        closeModal('editTripModal');
        document.getElementById('tripTitle').textContent = updatedTrip.name;
        currentTrip = updatedTrip;
        showSuccess(t('notifications.tripUpdated'));
    } catch (error) {
        // Error already shown
    }
}

async function validateAddressField(inputId, validationIconId, latInputId = null, lonInputId = null) {
    const input = document.getElementById(inputId);
    const validationIcon = document.getElementById(validationIconId);
    const address = input.value.trim();

    // Clear previous validation state
    validationIcon.className = 'validation-icon';

    // If empty, don't validate
    if (!address) {
        return;
    }

    // Show validating state
    validationIcon.className = 'validation-icon validating';

    try {
        const response = await fetch('/api/validate-address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });

        const result = await response.json();

        if (result.valid) {
            validationIcon.className = 'validation-icon valid';
            validationIcon.title = `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`;

            // Update coordinate fields if provided
            if (latInputId && lonInputId) {
                document.getElementById(latInputId).value = result.latitude.toFixed(4);
                document.getElementById(lonInputId).value = result.longitude.toFixed(4);
            }
        } else {
            validationIcon.className = 'validation-icon invalid';
            validationIcon.title = t('validation.addressNotFound');
        }
    } catch (error) {
        console.error('Address validation error:', error);
        validationIcon.className = 'validation-icon invalid';
        validationIcon.title = t('validation.couldNotValidate');
    }
}

async function handleEditLocationsSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const startLocationAddress = form.startLocationAddress.value.trim();
    const endLocationAddress = form.endLocationAddress.value.trim();

    try {
        const response = await fetch(`/api/trips/${tripId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start_location_address: startLocationAddress,
                end_location_address: endLocationAddress
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || t('errors.failedToUpdateLocations'));
        }

        const updatedTrip = await response.json();
        closeModal('editLocationsModal');
        currentTrip = updatedTrip;

        // Update displays
        const startLocationDisplay = document.getElementById('startLocationDisplay');
        const endLocationDisplay = document.getElementById('endLocationDisplay');

        if (updatedTrip.start_location && updatedTrip.start_location.address) {
            startLocationDisplay.textContent = updatedTrip.start_location.address;
            startLocationDisplay.style.color = '#212529';
            startLocationDisplay.removeAttribute('data-i18n');
        } else {
            startLocationDisplay.textContent = t('locations.notSet');
            startLocationDisplay.style.color = '#6c757d';
        }

        if (updatedTrip.end_location && updatedTrip.end_location.address) {
            endLocationDisplay.textContent = updatedTrip.end_location.address;
            endLocationDisplay.style.color = '#212529';
            endLocationDisplay.removeAttribute('data-i18n');
        } else {
            endLocationDisplay.textContent = t('locations.notSet');
            endLocationDisplay.style.color = '#6c757d';
        }

        showSuccess(t('notifications.locationsUpdated'));

        // Refresh the map to show new locations
        updateMap();
    } catch (error) {
        console.error('Error updating locations:', error);
        showError(error.message);
    }
}

async function handleDeleteTrip() {
    if (!currentTrip) return;

    if (!confirm(t('confirmations.deleteTrip', { name: currentTrip.name }))) {
        return;
    }

    try {
        await deleteTrip(tripId);
        showSuccess(t('notifications.tripDeleted'));
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
        showError(t('route.needTwoStops'));
        return;
    }

    const btn = document.getElementById('calculateRouteBtn');
    const originalText = btn.textContent;
    btn.textContent = t('route.calculating');
    btn.disabled = true;

    try {
        const routeData = await calculateRoute(tripId);
        displayRouteInfo(routeData);
        drawRoute(routeData);
        showSuccess(t('notifications.routeCalculated'));
    } catch (error) {
        // Error already shown
    } finally {
        btn.textContent = t('route.calculateRoute');
        btn.disabled = false;
    }
}

function displayRouteInfo(routeData) {
    const container = document.getElementById('routeInfo');

    if (!routeData || !routeData.total_distance_km) {
        container.innerHTML = `<p class="info-text">${t('route.unableToCalculate')}</p>`;
        return;
    }

    const hoursEstimate = (routeData.total_distance_km / 80).toFixed(1);

    let html = `
        <div class="route-stats">
            <div class="route-stat">
                <span class="value">${routeData.total_distance_km.toFixed(1)}</span>
                <span class="label">${t('route.kmTotal')}</span>
            </div>
            <div class="route-stat">
                <span class="value">${hoursEstimate}</span>
                <span class="label">${t('route.hoursEst')}</span>
            </div>
        </div>
    `;

    if (routeData.segments && routeData.segments.length > 0) {
        // Sort segments by start_date if available
        const sortedSegments = [...routeData.segments].sort((a, b) => {
            if (a.start_date && b.start_date) {
                return new Date(a.start_date) - new Date(b.start_date);
            }
            return 0;
        });

        html += `
            <div class="route-segments">
                <h4>${t('route.routeSegments')}</h4>
                ${sortedSegments.map(segment => `
                    <div class="segment">
                        <div class="route">${escapeHtml(segment.from_name)} ${t('route.to')} ${escapeHtml(segment.to_name)}</div>
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
    const waypointsData = await fetchWaypoints(tripId);
    
    // Add trip start and end as pseudo-stops
    let allStops = [];
    
    // Add start location if it exists
    if (currentTrip && currentTrip.start_location && currentTrip.start_location.address) {
        allStops.push({
            id: 'trip-start',
            name: currentTrip.start_location.address,
            address: currentTrip.start_location.address,
            latitude: currentTrip.start_location.latitude,
            longitude: currentTrip.start_location.longitude,
            type: 'trip-start',
            is_trip_location: true,
            activities: []
        });
    }
    
    // Add regular stops
    allStops = allStops.concat(stopsData);
    
    // Add end location if it exists
    if (currentTrip && currentTrip.end_location && currentTrip.end_location.address) {
        allStops.push({
            id: 'trip-end',
            name: currentTrip.end_location.address,
            address: currentTrip.end_location.address,
            latitude: currentTrip.end_location.latitude,
            longitude: currentTrip.end_location.longitude,
            type: 'trip-end',
            is_trip_location: true,
            activities: []
        });
    }
    
    renderStops(allStops, waypointsData);
}

// ============================================================================
// Event Listeners
// ============================================================================

// Make initMap available globally for Google Maps callback
window.initMap = initMap;

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

    // Load data
    await loadTrip();
    await loadStops();

    // Map will be initialized via callback from Google Maps script
    // The callback=initMap parameter in the script URL will call initMap() when ready

    // Add stop button
    document.getElementById('addStopBtn').addEventListener('click', () => {
        populateAddStopModal();
        openModal('addStopModal');
    });

    // Add stop form
    document.getElementById('addStopForm').addEventListener('submit', handleAddStopSubmit);

    // Edit stop form
    document.getElementById('editStopForm').addEventListener('submit', handleEditStopSubmit);

    // Location type radio buttons (Add Stop)
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

    // Location type radio buttons (Edit Stop)
    const editRadioButtons = document.querySelectorAll('input[name="editLocationType"]');
    editRadioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const latInput = document.getElementById('editLatitude');
            const lonInput = document.getElementById('editLongitude');

            if (e.target.value === 'address') {
                document.getElementById('editAddress').required = true;
                latInput.required = false;
                lonInput.required = false;
                latInput.readOnly = true;
                lonInput.readOnly = true;
            } else {
                document.getElementById('editAddress').required = false;
                latInput.required = true;
                lonInput.required = true;
                latInput.readOnly = false;
                lonInput.readOnly = false;
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

    // Edit locations button (optional - may not exist in all views)
    const editLocationsBtn = document.getElementById('editLocationsBtn');
    if (editLocationsBtn) {
        editLocationsBtn.addEventListener('click', () => {
            if (currentTrip) {
                const startAddr = currentTrip.start_location ? currentTrip.start_location.address : '';
                const endAddr = currentTrip.end_location ? currentTrip.end_location.address : '';
                document.getElementById('startLocationAddress').value = startAddr || '';
                document.getElementById('endLocationAddress').value = endAddr || '';
                openModal('editLocationsModal');
            }
        });
    }

    // Edit locations form (optional - may not exist in all views)
    const editLocationsForm = document.getElementById('editLocationsForm');
    if (editLocationsForm) {
        editLocationsForm.addEventListener('submit', handleEditLocationsSubmit);
    }

    // Address validation on blur (optional elements)
    const startLocationAddress = document.getElementById('startLocationAddress');
    const endLocationAddress = document.getElementById('endLocationAddress');

    if (startLocationAddress) {
        startLocationAddress.addEventListener('blur', () => {
            validateAddressField('startLocationAddress', 'startLocationValidation');
        });

        startLocationAddress.addEventListener('input', () => {
            const validationIcon = document.getElementById('startLocationValidation');
            if (validationIcon && (validationIcon.classList.contains('valid') || validationIcon.classList.contains('invalid'))) {
                validationIcon.className = 'validation-icon';
            }
        });
    }

    if (endLocationAddress) {
        endLocationAddress.addEventListener('blur', () => {
            validateAddressField('endLocationAddress', 'endLocationValidation');
        });

        endLocationAddress.addEventListener('input', () => {
            const validationIcon = document.getElementById('endLocationValidation');
            if (validationIcon && (validationIcon.classList.contains('valid') || validationIcon.classList.contains('invalid'))) {
                validationIcon.className = 'validation-icon';
            }
        });
    }

    // Add Stop modal - address validation
    document.getElementById('address').addEventListener('blur', () => {
        const locationType = document.querySelector('input[name="locationType"]:checked').value;
        if (locationType === 'address') {
            validateAddressField('address', 'addressValidation');
        }
    });

    document.getElementById('address').addEventListener('input', () => {
        const validationIcon = document.getElementById('addressValidation');
        if (validationIcon.classList.contains('valid') || validationIcon.classList.contains('invalid')) {
            validationIcon.className = 'validation-icon';
        }
    });

    // Edit Stop modal - address validation
    document.getElementById('editAddress').addEventListener('blur', () => {
        const locationType = document.querySelector('input[name="editLocationType"]:checked').value;
        if (locationType === 'address') {
            validateAddressField('editAddress', 'editAddressValidation', 'editLatitude', 'editLongitude');
        }
    });

    document.getElementById('editAddress').addEventListener('input', () => {
        const validationIcon = document.getElementById('editAddressValidation');
        if (validationIcon.classList.contains('valid') || validationIcon.classList.contains('invalid')) {
            validationIcon.className = 'validation-icon';
        }
    });

    // Add Waypoint modal - address validation
    document.getElementById('waypointAddress').addEventListener('blur', () => {
        const locationType = document.querySelector('input[name="waypointLocationType"]:checked').value;
        if (locationType === 'address') {
            validateAddressField('waypointAddress', 'waypointAddressValidation');
        }
    });

    document.getElementById('waypointAddress').addEventListener('input', () => {
        const validationIcon = document.getElementById('waypointAddressValidation');
        if (validationIcon.classList.contains('valid') || validationIcon.classList.contains('invalid')) {
            validationIcon.className = 'validation-icon';
        }
    });

    // Delete trip button
    document.getElementById('deleteTripBtn').addEventListener('click', handleDeleteTrip);

    // Calculate route button
    document.getElementById('calculateRouteBtn').addEventListener('click', handleCalculateRoute);

    // Duration change modal buttons
    document.getElementById('shiftAllStopsBtn').addEventListener('click', handleShiftAllStops);
    document.getElementById('adjustNextStopBtn').addEventListener('click', handleAdjustNextStop);

    // Waypoint form
    document.getElementById('addWaypointForm').addEventListener('submit', handleAddWaypointSubmit);

    // Waypoint location type radio buttons
    const waypointRadioButtons = document.querySelectorAll('input[name="waypointLocationType"]');
    waypointRadioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const addressInput = document.getElementById('waypointAddressInput');
            const gpsInput = document.getElementById('waypointGpsInput');

            if (e.target.value === 'address') {
                addressInput.style.display = 'block';
                gpsInput.style.display = 'none';
                document.getElementById('waypointAddress').required = true;
                document.getElementById('waypointLatitude').required = false;
                document.getElementById('waypointLongitude').required = false;
            } else {
                addressInput.style.display = 'none';
                gpsInput.style.display = 'flex';
                document.getElementById('waypointAddress').required = false;
                document.getElementById('waypointLatitude').required = true;
                document.getElementById('waypointLongitude').required = true;
            }
        });
    });

    // Render calendar on page load
    renderCalendar();
});

// Listen for language changes
document.addEventListener('languageChanged', async () => {
    // Re-render dynamic content
    renderStops(stops, waypoints);
    renderCalendar();
    updateMap();

    // Update route info button text
    const routeBtn = document.getElementById('calculateRouteBtn');
    if (routeBtn && !routeBtn.disabled) {
        routeBtn.textContent = t('route.calculateRoute');
    }
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
