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
    // Reset to overnight mode
    const overnightRadio = document.querySelector('input[name="stopType"][value="overnight"]');
    if (overnightRadio) { overnightRadio.checked = true; }
    const addDatesSection = document.getElementById('addDatesSection');
    if (addDatesSection) addDatesSection.style.display = 'block';
    document.getElementById('numberOfNights').required = true;
    document.getElementById('startDate').required = true;
    document.getElementById('endDate').required = true;

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
    const addAfterStopId = form.addAfterStop.value;

    // Find the stop we're adding after to get its GUID
    let previousLocationGuid = null;
    if (addAfterStopId === 'start') {
        // Adding after the start location
        previousLocationGuid = App.currentTrip && App.currentTrip.start_location ? App.currentTrip.start_location.guid : null;
    } else {
        // Adding after a specific stop
        const afterStop = App.stops.find(s => s.id === parseInt(addAfterStopId));
        previousLocationGuid = afterStop ? afterStop.guid : null;
    }

    const stopTypeEl = document.querySelector('input[name="stopType"]:checked');
    const isOvernight = !stopTypeEl || stopTypeEl.value === 'overnight';

    const stopData = {
        name: form.stopName.value.trim(),
        location_type: locationType,
        description: form.stopDescription.value.trim(),
        url: form.stopUrl.value.trim(),
        previous_location_guid: previousLocationGuid
    };

    if (isOvernight) {
        stopData.start_date = form.startDate.value + 'T00:00:00';
        stopData.end_date = form.endDate.value + 'T00:00:00';
    }

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
        notifyAdded('stop', null, stopData.name);

        // Clear all distances since the route has changed
        try {
            await App.clearRouteDistances(tripId);
        } catch (e) {
            // Silently ignore - distances clearing is not critical
        }

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
            const editStopTypeSect = document.getElementById('editStopTypeSection');
            if (editStopTypeSect) editStopTypeSect.style.display = 'block';
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
    const editStopTypeEl = document.querySelector('input[name="editStopType"]:checked');
    const isOvernight = !editStopTypeEl || editStopTypeEl.value === 'overnight';

    const stopData = {
        name: form.stopName.value.trim(),
        start_date: isOvernight && form.startDate.value ? form.startDate.value + 'T00:00:00' : null,
        end_date: isOvernight && form.endDate.value ? form.endDate.value + 'T00:00:00' : null,
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

    // Check if duration was extended and there are following overnight stops
    const originalEndDate = originalStop.end_date ? new Date(originalStop.end_date) : null;
    const newEndDate = stopData.end_date ? new Date(stopData.end_date) : null;
    const hasFollowingStops = stopIndex < App.stops.length - 1;

    if (isOvernight && originalEndDate && newEndDate && newEndDate > originalEndDate && hasFollowingStops) {
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
        notifySaved('stop', stopId, stopData.name);
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
        notifyDeleted('stop', stopId, stopName);

        // Clear all distances since the route has changed
        try {
            await App.clearRouteDistances(tripId);
        } catch (e) {
            // Silently ignore - distances clearing is not critical
        }

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

    // Set stop type toggle (overnight vs road stop)
    const isOvernight = !!(stop.start_date);
    const stopTypeRadio = document.querySelector(`input[name="editStopType"][value="${isOvernight ? 'overnight' : 'road'}"]`);
    if (stopTypeRadio) stopTypeRadio.checked = true;

    // Show/hide dates section
    const editDatesSection = document.getElementById('editDatesSection');
    if (editDatesSection) editDatesSection.style.display = isOvernight ? 'block' : 'none';

    const startDateInput = document.getElementById('editStartDate');
    const endDateInput = document.getElementById('editEndDate');
    startDateInput.required = isOvernight;
    endDateInput.required = isOvernight;
    startDateInput.value = stop.start_date ? formatDateForInput(stop.start_date) : '';
    endDateInput.value = stop.end_date ? formatDateForInput(stop.end_date) : '';

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

    notifyEditing('stop', stop.id, stop.name);
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

        // Update all following overnight stops (skip road stops which have no dates)
        const followingStops = App.stops.slice(stopIndex + 1).filter(s => !s.is_trip_location && s.start_date);

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

        notifySaved('stop', stopId, stopData.name);
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

        // Update only the next overnight stop (skip road stops which have no dates)
        const nextStop = App.stops.slice(stopIndex + 1).find(s => !s.is_trip_location && s.start_date);

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

        notifySaved('stop', stopId, stopData.name);
        closeModal('durationChangeModal');
        showSuccess(t('notifications.nextStopAdjusted'));
        await loadStops();
        App.pendingStopUpdate = null;
    } catch (error) {
        showError(t('errors.failedToUpdateStops'));
        App.pendingStopUpdate = null;
    }
}

async function handleJustUpdateStop() {
    if (!App.pendingStopUpdate) return;

    const { stopId, stopData } = App.pendingStopUpdate;

    try {
        // Just update the current stop without adjusting any following stops
        await updateStop(stopId, stopData);
        notifySaved('stop', stopId, stopData.name);
        closeModal('durationChangeModal');
        showSuccess(t('notifications.stopUpdated'));
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

    // Hide stop type section and dates (not applicable to trip locations)
    const editStopTypeSection = document.getElementById('editStopTypeSection');
    if (editStopTypeSection) editStopTypeSection.style.display = 'none';
    const editDatesSection = document.getElementById('editDatesSection');
    if (editDatesSection) editDatesSection.style.display = 'none';
    const startDateInput = document.getElementById('editStartDate');
    const endDateInput = document.getElementById('editEndDate');
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

async function handleDeleteTripLocation(_locationId, locationType, address) {
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
    document.getElementById('activityId').value = '';
    document.getElementById('activityModalTitle').textContent = t('activities.addActivity');
    document.getElementById('activitySubmitBtn').textContent = t('activities.addActivity');
    document.getElementById('addActivityForm').reset();
    openModal('addActivityModal');
}

function openEditActivityModal(activityId, stopId) {
    // Find the activity in the current stops data
    const stop = App.stops.find(s => s.id === stopId);
    if (!stop) return;
    
    const activity = stop.activities.find(a => a.id === activityId);
    if (!activity) return;
    
    document.getElementById('activityStopId').value = stopId;
    document.getElementById('activityId').value = activityId;
    document.getElementById('activityModalTitle').textContent = t('buttons.edit');
    document.getElementById('activitySubmitBtn').textContent = t('buttons.save');

    // Fill in the form with existing data
    document.getElementById('activityName').value = activity.name;
    document.getElementById('activityDescription').value = activity.description || '';
    document.getElementById('activityUrl').value = activity.url || '';

    notifyEditing('activity', activityId, activity.name);
    openModal('addActivityModal');
}

async function handleAddActivitySubmit(e) {
    e.preventDefault();

    const form = e.target;
    const stopId = parseInt(document.getElementById('activityStopId').value);
    const activityId = parseInt(document.getElementById('activityId').value) || null;

    const activityData = {
        name: form.activityName.value.trim(),
        description: form.activityDescription.value.trim(),
        url: form.activityUrl.value.trim()
    };

    try {
        if (activityId) {
            // Edit existing activity
            await updateActivity(activityId, activityData);
            notifySaved('activity', activityId, activityData.name);
            showSuccess(t('notifications.activityUpdated'));
        } else {
            // Create new activity
            await createActivity(stopId, activityData);
            notifyAdded('activity', null, activityData.name);
            showSuccess(t('notifications.activityAdded'));
        }
        closeModal('addActivityModal');
        form.reset();
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
        notifyDeleted('activity', activityId, activityName);
        showSuccess(t('notifications.activityDeleted'));
        await loadStops();
    } catch (error) {
        // Error already shown
    }
}

// ============================================================================
// Road Stop Helpers
// ============================================================================

function openAddRoadStopAfter(stopId) {
    populateAddStopModal();
    document.getElementById('addAfterStop').value = stopId;
    document.querySelector('input[name="stopType"][value="road"]').checked = true;
    document.getElementById('addDatesSection').style.display = 'none';
    document.getElementById('numberOfNights').required = false;
    document.getElementById('startDate').required = false;
    document.getElementById('endDate').required = false;
    openModal('addStopModal');
}

function updateAddStopTypeDisplay() {
    const isOvernight = document.querySelector('input[name="stopType"]:checked').value === 'overnight';
    document.getElementById('addDatesSection').style.display = isOvernight ? 'block' : 'none';
    document.getElementById('numberOfNights').required = isOvernight;
    document.getElementById('startDate').required = isOvernight;
    document.getElementById('endDate').required = isOvernight;
    if (isOvernight) calculateStopDates();
}

function updateEditStopTypeDisplay() {
    const isOvernight = document.querySelector('input[name="editStopType"]:checked').value === 'overnight';
    document.getElementById('editDatesSection').style.display = isOvernight ? 'block' : 'none';
    document.getElementById('editStartDate').required = isOvernight;
    document.getElementById('editEndDate').required = isOvernight;
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


function closeAllStopMenus() {
    document.querySelectorAll('.stop-menu-dropdown.open').forEach(d => d.classList.remove('open'));
}

function toggleStopMenu(id) {
    const dropdown = document.getElementById(`stop-menu-${id}`);
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('open');
    closeAllStopMenus();
    if (!isOpen) dropdown.classList.add('open');
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

    const btn = document.getElementById('calculateRouteBtnTop');
    btn.textContent = t('route.calculating');
    btn.disabled = true;

    try {
        const routeData = await calculateRoute(tripId);
        drawRoute(routeData);
        await saveRouteDistances(routeData);
        await updateTripCountries(tripId);
        await App.loadTrip();  // Reload trip to get updated distances and start/end locations
        App.updateMap();  // Refresh markers while preserving the drawn route
        showSuccess(t('notifications.routeCalculated'));
    } catch (error) {
        // Error already shown
    } finally {
        btn.textContent = t('route.calculateRoute');
        btn.disabled = false;
    }
}


async function saveRouteDistances(routeData) {
    if (!routeData || !routeData.segments) return;

    const allLocations = App.stops;
    const segments = [];
    let endDistanceKm = null;

    for (const segment of routeData.segments) {
        if (segment.to_name === 'Trip End') {
            endDistanceKm = segment.distance_km;
        } else {
            const loc = allLocations.find(l => l.name === segment.to_name);
            if (loc && loc.guid) segments.push({ to_guid: loc.guid, distance_km: segment.distance_km });
        }
    }

    if (segments.length === 0 && endDistanceKm === null) return;

    const payload = { segments };
    if (endDistanceKm !== null) payload.end_distance_km = endDistanceKm;
    if (routeData.total_distance_km != null) payload.total_distance_km = routeData.total_distance_km;

    const response = await fetch(`/api/trips/${App.currentTrip.id}/save-distances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) return;

    const result = await response.json();

    // Update in-memory trip so cards re-render correctly
    if (result.end_distance_km !== undefined && App.currentTrip.end_location) {
        App.currentTrip.end_location.distance_km = result.end_distance_km;
    }
    if (result.total_distance_km != null) {
        App.currentTrip.total_distance_km = result.total_distance_km;
        document.getElementById('tripTotalDistance').textContent = `${result.total_distance_km.toFixed(1)} km`;
        document.getElementById('tripDistanceBadge').style.display = 'block';
    }

    App.stops = result.locations.filter(loc => loc.type === 'stop');
    App.renderStops(App.stops);
}

async function updateTripCountries(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}/update-countries`, { method: 'POST' });
        if (!response.ok) {
            console.warn('Could not update trip country codes');
        }
    } catch (error) {
        console.warn('Error updating trip countries:', error);
    }
}

// ============================================================================
// Bookmark Handlers
// ============================================================================

function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    } catch {
        return null;
    }
}

function renderBookmarks(bookmarks) {
    const table = document.getElementById('bookmarksTable');
    const tbody = document.getElementById('bookmarksTbody');
    const empty = document.getElementById('bookmarksEmpty');

    if (!bookmarks || bookmarks.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    tbody.innerHTML = bookmarks.map(b => {
        const faviconUrl = getFaviconUrl(b.url);
        const faviconImg = faviconUrl
            ? `<img src="${escapeHtml(faviconUrl)}" alt="" class="bookmark-favicon" onerror="this.style.display='none'">`
            : '';
        const desc = b.description ? `<span class="bookmark-desc">${escapeHtml(b.description)}</span>` : '';
        let displayUrl;
        try { displayUrl = new URL(b.url).hostname; } catch { displayUrl = b.url; }
        return `<tr>
            <td class="bookmark-favicon-cell">${faviconImg}</td>
            <td class="bookmark-url-cell">
                <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayUrl)}</a>
                ${desc}
            </td>
            <td class="bookmark-actions-cell">
                <button class="icon-btn danger" onclick="handleDeleteBookmark(${b.id})" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>`;
    }).join('');
}

async function handleAddBookmarkSubmit(e) {
    try {
        e.preventDefault();
        e.stopPropagation();
        
        const url = document.getElementById('bookmarkUrl').value.trim();
        const description = document.getElementById('bookmarkDescription').value.trim();
        if (!url) {
            console.warn('Bookmark URL is empty');
            return;
        }
        
        await window.createBookmark(tripId, { url, description });
        e.target.reset();
        const bookmarks = await window.fetchBookmarks(tripId);
        window.renderBookmarks(bookmarks);
    } catch (error) {
        console.error('Error in handleAddBookmarkSubmit:', error);
        // Error already shown by showError in API call
    }
}

async function handleDeleteBookmark(bookmarkId) {
    try {
        await window.deleteBookmark(bookmarkId);
        const bookmarks = await window.fetchBookmarks(tripId);
        renderBookmarks(bookmarks);
    } catch {
        // Error already shown
    }
}

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
window.handleJustUpdateStop = handleJustUpdateStop;
window.openEditTripLocationModal = openEditTripLocationModal;
window.handleDeleteTripLocation = handleDeleteTripLocation;
window.openAddActivityModal = openAddActivityModal;
window.openEditActivityModal = openEditActivityModal;
window.handleAddActivitySubmit = handleAddActivitySubmit;
window.handleDeleteActivity = handleDeleteActivity;
window.openAddRoadStopAfter = openAddRoadStopAfter;
window.updateAddStopTypeDisplay = updateAddStopTypeDisplay;
window.updateEditStopTypeDisplay = updateEditStopTypeDisplay;
window.toggleStopCollapse = toggleStopCollapse;
window.toggleStopMenu = toggleStopMenu;
window.closeAllStopMenus = closeAllStopMenus;
window.handleEditTripSubmit = handleEditTripSubmit;
window.validateAddressField = validateAddressField;
window.handleEditLocationsSubmit = handleEditLocationsSubmit;
window.handleDeleteTrip = handleDeleteTrip;
window.handleCalculateRoute = handleCalculateRoute;
window.renderBookmarks = renderBookmarks;
window.handleAddBookmarkSubmit = handleAddBookmarkSubmit;
window.handleDeleteBookmark = handleDeleteBookmark;
})();
