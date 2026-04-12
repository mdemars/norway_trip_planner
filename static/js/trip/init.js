// ============================================================================
// Initialization: Data Loading, Event Wiring, CSS Animations
// ============================================================================

(function() {
    const App = window.TripApp;

// ============================================================================
// Data Loading
// ============================================================================

App.loadTrip = async function() {
    const trip = await window.fetchTrip(tripId);
    if (trip) {
        App.currentTrip = trip;
        document.getElementById('tripTitle').textContent = trip.name;
        document.getElementById('tripName').textContent = trip.name;
    }
};

function checkChainIntegrity(stopsData) {
    // A broken chain = multiple stops with previous_location_guid that is null
    // (i.e. multiple chain heads among the real stops).
    const heads = stopsData.filter(s => !s.previous_location_guid);
    const banner = document.getElementById('chainWarningBanner');
    if (!banner) return;
    if (heads.length > 1) {
        banner.style.display = 'flex';
        banner.querySelector('.chain-warning-count').textContent = heads.length;
    } else {
        banner.style.display = 'none';
    }
}

App.loadStops = async function() {
    const stopsData = await window.fetchStops(tripId);
    const waypointsData = await window.fetchWaypoints(tripId);

    // Check for broken chain and show warning if needed
    checkChainIntegrity(stopsData);

    // Add trip start and end as pseudo-stops
    let allStops = [];

    // Add start location if it exists
    if (App.currentTrip && App.currentTrip.start_location && App.currentTrip.start_location.address) {
        allStops.push({
            id: 'trip-start',
            guid: App.currentTrip.start_location.guid,
            name: App.currentTrip.start_location.address,
            address: App.currentTrip.start_location.address,
            latitude: App.currentTrip.start_location.latitude,
            longitude: App.currentTrip.start_location.longitude,
            type: 'trip-start',
            is_trip_location: true,
            activities: []
        });
    }

    // Add regular stops
    allStops = allStops.concat(stopsData);

    // Add end location if it exists
    if (App.currentTrip && App.currentTrip.end_location && App.currentTrip.end_location.address) {
        allStops.push({
            id: 'trip-end',
            guid: App.currentTrip.end_location.guid,
            name: App.currentTrip.end_location.address,
            address: App.currentTrip.end_location.address,
            latitude: App.currentTrip.end_location.latitude,
            longitude: App.currentTrip.end_location.longitude,
            type: 'trip-end',
            is_trip_location: true,
            activities: []
        });
    }

    renderStops(allStops, waypointsData);
};

// Expose on window
window.loadTrip = App.loadTrip;
window.loadStops = App.loadStops;

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

    // Load data
    await App.loadTrip();
    await App.loadStops();

    // Load bookmarks
    const bookmarks = await fetchBookmarks(tripId);
    renderBookmarks(bookmarks);

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
                document.getElementById('gpsHint').style.display = 'none';
                document.getElementById('address').required = true;
                document.getElementById('latitude').required = false;
                document.getElementById('longitude').required = false;
            } else {
                addressInput.style.display = 'none';
                gpsInput.style.display = 'flex';
                document.getElementById('gpsHint').style.display = 'block';
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
        if (App.currentTrip) {
            document.getElementById('editTripName').value = App.currentTrip.name;
            openModal('editTripModal');
        }
    });

    // Edit trip form
    document.getElementById('editTripForm').addEventListener('submit', handleEditTripSubmit);

    // Edit locations button (optional - may not exist in all views)
    const editLocationsBtn = document.getElementById('editLocationsBtn');
    if (editLocationsBtn) {
        editLocationsBtn.addEventListener('click', () => {
            if (App.currentTrip) {
                const startAddr = App.currentTrip.start_location ? App.currentTrip.start_location.address : '';
                const endAddr = App.currentTrip.end_location ? App.currentTrip.end_location.address : '';
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

    // Debug route button
    document.getElementById('debugRouteBtn').addEventListener('click', handleDebugRoute);

    // Calculate route button
    document.getElementById('calculateRouteBtn').addEventListener('click', handleCalculateRoute);

    // Duration change modal buttons
    document.getElementById('shiftAllStopsBtn').addEventListener('click', handleShiftAllStops);
    document.getElementById('adjustNextStopBtn').addEventListener('click', handleAdjustNextStop);
    document.getElementById('justUpdateStopBtn').addEventListener('click', handleJustUpdateStop);

    // Bookmark form
    document.getElementById('addBookmarkForm').addEventListener('submit', handleAddBookmarkSubmit);

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
                document.getElementById('waypointGpsHint').style.display = 'none';
                document.getElementById('waypointAddress').required = true;
                document.getElementById('waypointLatitude').required = false;
                document.getElementById('waypointLongitude').required = false;
            } else {
                addressInput.style.display = 'none';
                gpsInput.style.display = 'flex';
                document.getElementById('waypointGpsHint').style.display = 'block';
                document.getElementById('waypointAddress').required = false;
                document.getElementById('waypointLatitude').required = true;
                document.getElementById('waypointLongitude').required = true;
            }
        });
    });

    // Right-panel toggle (map + calendar)
    const tripDetailContent = document.querySelector('.trip-detail-content');
    const toggleBtn = document.getElementById('toggleRightPanelBtn');
    const toggleIcon = document.getElementById('toggleRightPanelIcon');

    // SVG paths for the two states
    const iconExpanded  = '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>';   // panel visible → clicking will hide
    const iconCollapsed = '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>';     // panel hidden  → clicking will show

    function applyPanelState(collapsed) {
        if (collapsed) {
            tripDetailContent.classList.add('right-collapsed');
            toggleIcon.innerHTML = iconCollapsed;
            toggleBtn.title = 'Show map & calendar';
        } else {
            tripDetailContent.classList.remove('right-collapsed');
            toggleIcon.innerHTML = iconExpanded;
            toggleBtn.title = 'Hide map & calendar';
        }
    }

    // Restore persisted state
    const panelCollapsed = localStorage.getItem('rightPanelCollapsed') === 'true';
    applyPanelState(panelCollapsed);

    toggleBtn.addEventListener('click', () => {
        const nowCollapsed = !tripDetailContent.classList.contains('right-collapsed');
        localStorage.setItem('rightPanelCollapsed', nowCollapsed);
        applyPanelState(nowCollapsed);
    });

    // DMS coordinate parsing for all GPS field pairs
    App.attachDMSParsing('latitude', 'longitude');
    App.attachDMSParsing('editLatitude', 'editLongitude');
    App.attachDMSParsing('waypointLatitude', 'waypointLongitude');

    // Render calendar on page load
    renderCalendar();
});

// ============================================================================
// Language Change Handler
// ============================================================================

// Listen for language changes
document.addEventListener('languageChanged', async () => {
    // Re-render dynamic content
    renderStops(App.stops, App.waypoints);
    renderCalendar();
    updateMap();

    // Update route info button text
    const routeBtn = document.getElementById('calculateRouteBtn');
    if (routeBtn && !routeBtn.disabled) {
        routeBtn.textContent = t('route.calculateRoute');
    }
});

// ============================================================================
// CSS Animations
// ============================================================================

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
})();
