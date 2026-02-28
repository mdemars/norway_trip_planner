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

App.loadStops = async function() {
    const stopsData = await window.fetchStops(tripId);
    const waypointsData = await window.fetchWaypoints(tripId);

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
