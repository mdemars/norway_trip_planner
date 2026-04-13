// ============================================================================
// UI Rendering (extracted from trip_detail.js)
// ============================================================================

(function() {
    const App = window.TripApp;

App.renderStops = function renderStops(stopsData, waypointsData) {
    const container = document.getElementById('stopsContainer');
    App.stops = stopsData;
    App.waypoints = waypointsData || [];

    if (App.stops.length === 0) {
        container.innerHTML = `<div class="info-text" style="text-align: center; padding: 40px; color: #6c757d;">${t('stops.noStopsYet')}</div>`;
        return;
    }

    // Calculate min/max distance for gradient coloring
    const allLocations = [...App.stops, ...App.waypoints];
    const distancesWithValues = allLocations.filter(loc => loc.distance_km != null).map(loc => loc.distance_km);
    let minDistance = Infinity;
    let maxDistance = -Infinity;
    
    if (distancesWithValues.length > 0) {
        minDistance = Math.min(...distancesWithValues);
        maxDistance = Math.max(...distancesWithValues);
    }

    const distanceGradient = { min: minDistance, max: maxDistance, range: maxDistance - minDistance || 1 };

    // Build a lookup so we can walk the chain: previous_guid → waypoint
    const waypointByPrev = {};
    App.waypoints.forEach(w => { waypointByPrev[w.previous_location_guid] = w; });

    // Build combined list with stops and waypoints
    let html = '';
    App.stops.forEach((stop, index) => {
        const isLastStop = index === App.stops.length - 1;
        const nextStop = !isLastStop ? App.stops[index + 1] : null;
        html += App.createStopCard(stop, index + 1, isLastStop, nextStop, distanceGradient);

        // Walk the chain from this stop, rendering all consecutive waypoints
        // (including waypoints that follow other waypoints, not just the stop directly)
        let nextGuid = stop.guid;
        while (waypointByPrev[nextGuid]) {
            const wp = waypointByPrev[nextGuid];
            html += App.createWaypointCard(wp, distanceGradient);
            nextGuid = wp.guid;
        }
    });

    container.innerHTML = html;

    // Update map
    App.updateMap();

    // Update calendar
    App.renderCalendar();
};

App.createStopCard = function createStopCard(stop, index, isLastStop, nextStop, distanceGradient = {}) {
    // Helper to calculate distance color hue (120=green, 60=yellow, 0=red)
    const getDistanceHue = (distance) => {
        if (distance == null || distanceGradient.range === undefined || distanceGradient.range === 0) {
            return 60; // Yellow for no data
        }
        return Math.round(120 * (1 - (distance - distanceGradient.min) / distanceGradient.range));
    };

    // Helper to build distance badge HTML
    const renderDistanceBadge = (distance) => {
        if (distance == null) return '';
        const hue = getDistanceHue(distance);
        const textColor = `hsl(${hue}, 72%, 42%)`;
        const bgColor = `hsl(${hue}, 72%, 96%)`;
        return ` <span class="distance-badge" style="background-color: ${bgColor}; color: ${textColor}; border-left: 3px solid ${textColor};">↤ ${distance.toFixed(1)} km</span>`;
    };

    // Check if this is a trip location (start/end)
    if (stop.is_trip_location) {
        const color = App.STOP_COLORS[(index - 1) % App.STOP_COLORS.length];
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
                            ${renderDistanceBadge(stop.distance_km)}
                        </h3>
                    </div>
                    <div class="stop-menu" onclick="event.stopPropagation()">
                        <button class="icon-btn stop-menu-btn" onclick="toggleStopMenu('tl-${stop.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
                            </svg>
                        </button>
                        <div class="stop-menu-dropdown" id="stop-menu-tl-${stop.id}">
                            <button onclick="closeAllStopMenus(); showStopOnMap('${stop.id}')">${t('stops.showOnMap')}</button>
                            <button onclick="closeAllStopMenus(); openEditTripLocationModal('${stop.id}', '${stop.type}')">${t('buttons.edit')}</button>
                            <button class="danger" onclick="closeAllStopMenus(); handleDeleteTripLocation('${stop.id}', '${stop.type}', '${escapeHtml(stop.name).replace(/'/g, "\\'")}')">${t('buttons.delete')}</button>
                        </div>
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
    const hasDates = stop.start_date && stop.end_date;

    let dateRangeText = '';
    let nightsText = '';
    if (hasDates) {
        const shortDateOptions = { day: '2-digit', month: 'short', year: undefined };
        const startDateShort = formatDate(stop.start_date, shortDateOptions);
        const endDateShort = formatDate(stop.end_date, shortDateOptions);
        dateRangeText = `${startDateShort} - ${endDateShort}`;
        const nights = Math.round((new Date(stop.end_date) - new Date(stop.start_date)) / (1000 * 60 * 60 * 24));
        nightsText = t('stops.night', { count: nights });
    }

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
            ${activities.map(activity => App.createActivityItem(activity)).join('')}
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

    const color = App.STOP_COLORS[(index - 1) % App.STOP_COLORS.length];

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
                        ${hasDates
                            ? `<span style="color: #6c757d; font-weight: normal; font-size: 0.85em; margin-left: 8px;">(${dateRangeText}, ${nightsText})</span>${renderDistanceBadge(stop.distance_km)}`
                            : `<span class="undated-badge">No dates</span>`
                        }
                    </h3>
                </div>
                    <div class="stop-menu" onclick="event.stopPropagation()">
                        <button class="icon-btn stop-menu-btn" onclick="toggleStopMenu(${stop.id})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
                            </svg>
                        </button>
                        <div class="stop-menu-dropdown" id="stop-menu-${stop.id}">
                            <button onclick="closeAllStopMenus(); showStopOnMap(${stop.id})">${t('stops.showOnMap')}</button>
                            ${!isLastStop ? `
                            <button onclick="closeAllStopMenus(); openAddStopAfter('${stop.id}')">${t('stops.addStop')}</button>
                            <button onclick="closeAllStopMenus(); openAddWaypointModal('${stop.id}', '${nextStop.id}')">${t('waypoints.addWaypoint')}</button>
                            ` : ''}
                            <button onclick="closeAllStopMenus(); openEditStopModal(${stop.id})">${t('buttons.edit')}</button>
                            <button class="danger" onclick="closeAllStopMenus(); handleDeleteStop(${stop.id}, '${escapeHtml(stop.name).replace(/'/g, "\\'")}')">${t('buttons.delete')}</button>
                        </div>
                    </div>
            </div>
            <div class="stop-details">
                <div class="stop-info-section">
                    ${hasDates ? `
                    <div class="stop-dates">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${formatDate(stop.start_date)} → ${formatDate(stop.end_date)}
                    </div>` : `
                    <button class="btn btn-primary btn-sm set-dates-btn" onclick="event.stopPropagation(); openEditStopModal(${stop.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${t('stops.setDatesDetails')}
                    </button>`}
                    ${stop.address ? `<div class="stop-address">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${escapeHtml(stop.address)}
                    </div>` : ''}
                    ${stop.description ? `<div class="stop-description" style="font-size: 0.85em; color: var(--text-muted, #6c757d); margin-top: 6px;">${escapeHtml(stop.description)}</div>` : ''}
                    ${stop.url ? `<div class="stop-url" style="font-size: 0.8em; margin-top: 4px;"><a href="${escapeHtml(stop.url)}" target="_blank" onclick="event.stopPropagation()" style="color: var(--primary-color, #4285F4); text-decoration: none;">${t('locations.viewLink')}</a></div>` : ''}
                </div>
                ${hasDates ? activitiesHtml : ''}
            </div>
        </div>
    `;
};

App.createActivityItem = function createActivityItem(activity) {
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
};

App.createWaypointCard = function createWaypointCard(waypoint, distanceGradient = {}) {
    // Helper to calculate distance color hue (120=green, 60=yellow, 0=red)
    const getDistanceHue = (distance) => {
        if (distance == null || distanceGradient.range === undefined || distanceGradient.range === 0) {
            return 60; // Yellow for no data
        }
        return Math.round(120 * (1 - (distance - distanceGradient.min) / distanceGradient.range));
    };

    // Helper to build distance badge HTML
    const renderDistanceBadge = (distance) => {
        if (distance == null) return '';
        const hue = getDistanceHue(distance);
        const textColor = `hsl(${hue}, 72%, 42%)`;
        const bgColor = `hsl(${hue}, 72%, 96%)`;
        return ` <span class="distance-badge" style="background-color: ${bgColor}; color: ${textColor}; border-left: 3px solid ${textColor}; margin-left: 12px;">↤ ${distance.toFixed(1)} km</span>`;
    };

    return `
        <div class="waypoint-card collapsed" data-waypoint-id="${waypoint.id}" style="margin: 8px 0; padding: 12px; background: #f8f9fa; border-left: 3px solid #6c757d; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleWaypointCollapse(${waypoint.id})">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <button class="collapse-toggle" onclick="event.stopPropagation(); toggleWaypointCollapse(${waypoint.id})" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <div style="font-weight: 500; color: #495057;">${escapeHtml(waypoint.name)}${renderDistanceBadge(waypoint.distance_km)}</div>
                </div>
                <div style="display: flex; gap: 4px;" onclick="event.stopPropagation()">
                    <button class="icon-btn" onclick="showWaypointOnMap(${waypoint.id})" title="Show on map">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </button>
                    <button class="icon-btn" onclick="openEditWaypointModal(${waypoint.id})" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
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
                ${waypoint.description ? `<div style="font-size: 0.85em; color: #6c757d; margin-top: 6px;">${escapeHtml(waypoint.description)}</div>` : ''}
                ${waypoint.url ? `<div style="font-size: 0.8em; margin-top: 4px;"><a href="${escapeHtml(waypoint.url)}" target="_blank" onclick="event.stopPropagation()" style="color: var(--primary-color, #4285F4); text-decoration: none;">${t('locations.viewLink')}</a></div>` : ''}
            </div>
        </div>
    `;
};

// Expose rendering functions globally for backward compatibility
window.renderStops = App.renderStops;
window.createStopCard = App.createStopCard;
window.createActivityItem = App.createActivityItem;
window.createWaypointCard = App.createWaypointCard;
})();
