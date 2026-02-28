// ============================================================================
// trip/handlers.js - All handler functions for trip detail page
// ============================================================================

(function() {
    const App = window.TripApp;

// ============================================================================
// Stop Handlers
// ============================================================================

function openAddStopAfter(stopId) {
    populateAddStopModal();
    document.getElementById('addAfterStop').value = stopId;
    calculateStopDates();
    openModal('addStopModal');
}

function populateAddStopModal() {
    const addAfterSelect = document.getElementById('addAfterStop');

    // Clear existing options except "Start of trip"
    addAfterSelect.innerHTML = `<option value="start">${t('dates.startOfTrip')}</option>`;

    // Add existing stops as options (excluding pseudo-stops like trip-start and trip-end)
    const realStops = App.stops.filter(s => !s.is_trip_location);
    realStops.forEach((stop, index) => {
        const option = document.createElement('option');
        option.value = stop.id;
        option.textContent = t('dates.afterStop', { index: index + 1, name: stop.name });
        addAfterSelect.appendChild(option);
    });

    // Auto-select the last stop if there are stops
    if (realStops.length > 0) {
        addAfterSelect.value = realStops[realStops.length - 1].id;
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
        const selectedStop = App.stops.find(s => s.id === selectedStopId);

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
        location_type: locationType,
        description: form.stopDescription.value.trim(),
        url: form.stopUrl.value.trim()
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
    const stopId = parseInt(document.getElementById('editStopId').value);
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
    const stopIndex = App.stops.findIndex(s => s.id === stopId);
    const originalStop = App.stops[stopIndex];
    const locationType = form.editLocationType.value;

    const stopData = {
        name: form.stopName.value.trim(),
        start_date: form.startDate.value + 'T00:00:00',
        end_date: form.endDate.value + 'T00:00:00',
        location_type: locationType,
        description: document.getElementById('editStopDescription').value.trim(),
        url: document.getElementById('editStopUrl').value.trim()
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
    const hasFollowingStops = stopIndex < App.stops.length - 1;

    if (newEndDate > originalEndDate && hasFollowingStops) {
        // Duration extended - ask user how to handle following stops
        App.pendingStopUpdate = {
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
    const stop = App.stops.find(s => s.id === stopId);
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

    // Show description/url fields for regular stops
    document.getElementById('editDescriptionGroup').style.display = 'block';
    document.getElementById('editUrlGroup').style.display = 'block';

    // Set location type and values
    const locationType = stop.location_type || 'address';
    document.querySelector(`input[name="editLocationType"][value="${locationType}"]`).checked = true;

    // Populate fields
    document.getElementById('editAddress').value = stop.address || '';
    document.getElementById('editStopDescription').value = stop.description || '';
    document.getElementById('editStopUrl').value = stop.url || '';
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

// ============================================================================
// Duration Change Handlers
// ============================================================================

async function handleShiftAllStops() {
    if (!App.pendingStopUpdate) return;

    const { stopId, stopIndex, stopData, daysDifference } = App.pendingStopUpdate;

    try {
        // Update the current stop
        await updateStop(stopId, stopData);

        // Update all following stops
        const followingStops = App.stops.slice(stopIndex + 1);

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
        App.pendingStopUpdate = null;
    } catch (error) {
        showError(t('errors.failedToUpdateStops'));
        App.pendingStopUpdate = null;
    }
}

async function handleAdjustNextStop() {
    if (!App.pendingStopUpdate) return;

    const { stopId, stopIndex, stopData, newEndDate } = App.pendingStopUpdate;

    try {
        // Update the current stop
        await updateStop(stopId, stopData);

        // Update only the next stop
        const nextStop = App.stops[stopIndex + 1];

        if (nextStop) {
            const nextStartDate = new Date(newEndDate);
            nextStartDate.setDate(nextStartDate.getDate() + 1); // Day after current stop ends

            const nextEndDate = new Date(nextStop.end_date);

            // Check if the adjustment makes the next stop invalid (start after end)
            if (nextStartDate >= nextEndDate) {
                showError(t('notifications.cannotAdjust'));
                App.pendingStopUpdate = null;
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
        App.pendingStopUpdate = null;
    } catch (error) {
        showError(t('errors.failedToUpdateStops'));
        App.pendingStopUpdate = null;
    }
}

// ============================================================================
// Trip Location Handlers
// ============================================================================

function openEditTripLocationModal(locationId, locationType) {
    const isStart = locationType === 'trip-start';
    const location = isStart ? App.currentTrip.start_location : App.currentTrip.end_location;

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

    // Hide description/url fields (not applicable to trip locations)
    document.getElementById('editDescriptionGroup').style.display = 'none';
    document.getElementById('editUrlGroup').style.display = 'none';

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

    // Populate previous location dropdown with all stops (excluding trip-end)
    const previousLocationSelect = document.getElementById('waypointPreviousLocation');
    previousLocationSelect.innerHTML = `<option value="">${t('waypoints.noPreviousLocation') || 'None (start of route)'}</option>`;

    // Add all stops except trip-end as options
    const availableStops = App.stops.filter(s => s.type !== 'trip-end');
    availableStops.forEach(stop => {
        const option = document.createElement('option');
        option.value = stop.guid;
        option.textContent = stop.name;
        previousLocationSelect.appendChild(option);
    });

    // Auto-select the stop above where "Add Waypoint" was clicked
    const afterStop = App.stops.find(s => s.id === afterStopId);
    if (afterStop) {
        previousLocationSelect.value = afterStop.guid;
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
        previous_location_guid: previousLocationGuid,
        description: document.getElementById('waypointDescription').value.trim(),
        url: document.getElementById('waypointUrl').value.trim()
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
        document.getElementById('tripName').textContent = updatedTrip.name;
        App.currentTrip = updatedTrip;
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
        App.currentTrip = updatedTrip;

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
    if (!App.currentTrip) return;

    if (!confirm(t('confirmations.deleteTrip', { name: App.currentTrip.name }))) {
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
    if (App.stops.length < 2) {
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

async function handleDebugRoute() {
    const contentEl = document.getElementById('debugRouteContent');
    contentEl.innerHTML = '<div class="loading">Loading...</div>';
    openModal('debugRouteModal');

    try {
        const response = await fetch(`/api/trips/${tripId}/debug/route-points`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch route points');
        }

        const data = await response.json();

        if (!data.points || data.points.length === 0) {
            contentEl.innerHTML = '<p style="color: #6c757d;">No route points found.</p>';
            return;
        }

        let html = `<p style="margin-bottom: 12px;"><strong>Total points: ${data.total_points}</strong></p>`;
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">';
        html += '<thead><tr style="background: var(--bg-secondary, #f8f9fa); border-bottom: 2px solid var(--border-color, #dee2e6);">';
        html += '<th style="padding: 8px; text-align: left;">#</th>';
        html += '<th style="padding: 8px; text-align: left;">Type</th>';
        html += '<th style="padding: 8px; text-align: left;">Name</th>';
        html += '<th style="padding: 8px; text-align: left;">Address</th>';
        html += '<th style="padding: 8px; text-align: left;">Coords</th>';
        html += '</tr></thead><tbody>';

        data.points.forEach((point, index) => {
            const typeColor = point.type === 'start' ? '#34A853' :
                              point.type === 'end' ? '#EA4335' :
                              point.type === 'waypoint' ? '#9334E6' : '#4285F4';
            const coords = point.latitude && point.longitude ?
                `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` : 'N/A';

            html += `<tr style="border-bottom: 1px solid var(--border-color, #dee2e6);">`;
            html += `<td style="padding: 8px;">${point.order !== undefined ? point.order : index}</td>`;
            html += `<td style="padding: 8px;"><span style="background: ${typeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">${point.type}</span></td>`;
            html += `<td style="padding: 8px;">${escapeHtml(point.name || '-')}</td>`;
            html += `<td style="padding: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(point.address || '')}">${escapeHtml(point.address || '-')}</td>`;
            html += `<td style="padding: 8px; font-family: monospace; font-size: 0.85em;">${coords}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        contentEl.innerHTML = html;
    } catch (error) {
        console.error('Error fetching debug route points:', error);
        contentEl.innerHTML = `<p style="color: #dc3545;">Error: ${escapeHtml(error.message)}</p>`;
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
// Expose all handler functions on window for HTML onclick attributes
// ============================================================================

window.openAddStopAfter = openAddStopAfter;
window.populateAddStopModal = populateAddStopModal;
window.calculateStopDates = calculateStopDates;
window.handleAddStopSubmit = handleAddStopSubmit;
window.handleEditStopSubmit = handleEditStopSubmit;
window.handleDeleteStop = handleDeleteStop;
window.openEditStopModal = openEditStopModal;
window.handleShiftAllStops = handleShiftAllStops;
window.handleAdjustNextStop = handleAdjustNextStop;
window.openEditTripLocationModal = openEditTripLocationModal;
window.handleDeleteTripLocation = handleDeleteTripLocation;
window.openAddActivityModal = openAddActivityModal;
window.handleAddActivitySubmit = handleAddActivitySubmit;
window.handleDeleteActivity = handleDeleteActivity;
window.openAddWaypointModal = openAddWaypointModal;
window.handleAddWaypointSubmit = handleAddWaypointSubmit;
window.handleDeleteWaypoint = handleDeleteWaypoint;
window.toggleStopCollapse = toggleStopCollapse;
window.toggleWaypointCollapse = toggleWaypointCollapse;
window.handleEditTripSubmit = handleEditTripSubmit;
window.validateAddressField = validateAddressField;
window.handleEditLocationsSubmit = handleEditLocationsSubmit;
window.handleDeleteTrip = handleDeleteTrip;
window.handleCalculateRoute = handleCalculateRoute;
window.handleDebugRoute = handleDebugRoute;
window.displayRouteInfo = displayRouteInfo;
})();
