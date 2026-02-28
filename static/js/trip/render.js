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

    // Build combined list with stops and waypoints
    let html = '';
    App.stops.forEach((stop, index) => {
        html += App.createStopCard(stop, index + 1);

        // Render any waypoints that come after this stop
        const stopWaypoints = App.waypoints.filter(w => w.previous_location_guid === stop.guid);
        stopWaypoints.forEach(wp => {
            html += App.createWaypointCard(wp);
        });

        // Add buttons to insert stop/waypoint after this stop (except after the last stop)
        if (index < App.stops.length - 1) {
            const nextStop = App.stops[index + 1];

            html += `
                <div style="display: flex; justify-content: center; gap: 8px; padding: 8px 0;">
                    <button class="btn btn-primary btn-sm" onclick="openAddStopAfter('${stop.id}')" style="font-size: 0.85em;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        ${t('stops.addStop')}
                    </button>
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
    App.updateMap();

    // Update calendar
    App.renderCalendar();
};

App.createStopCard = function createStopCard(stop, index) {
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

    // Format dates as dd/MMM for summary (explicitly exclude year)
    const shortDateOptions = { day: '2-digit', month: 'short', year: undefined };
    const startDateShort = formatDate(stop.start_date, shortDateOptions);
    const endDateShort = formatDate(stop.end_date, shortDateOptions);
    const dateRangeText = `${startDateShort} - ${endDateShort}`;

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
                        <span style="color: #6c757d; font-weight: normal; font-size: 0.85em; margin-left: 8px;">(${dateRangeText}, ${nightsText})</span>
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
                    ${stop.description ? `<div class="stop-description" style="font-size: 0.85em; color: var(--text-muted, #6c757d); margin-top: 6px;">${escapeHtml(stop.description)}</div>` : ''}
                    ${stop.url ? `<div class="stop-url" style="font-size: 0.8em; margin-top: 4px;"><a href="${escapeHtml(stop.url)}" target="_blank" onclick="event.stopPropagation()" style="color: var(--primary-color, #4285F4); text-decoration: none;">${t('locations.viewLink')}</a></div>` : ''}
                </div>
                ${activitiesHtml}
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

App.createWaypointCard = function createWaypointCard(waypoint) {
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
