// ============================================================================
// Map Functions
// ============================================================================

(function() {
    const App = window.TripApp;

function initMap() {
    const mapElement = document.getElementById('map');

    try {
        // Center on Norway by default
        App.map = new google.maps.Map(mapElement, {
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
    if (!App.map) return;

    // Clear existing markers, info windows, and paths
    App.markers.forEach(marker => marker.setMap(null));
    App.markers = [];
    App.infoWindows = [];
    if (App.routePath) {
        App.routePath.setMap(null);
        App.routePath = null;
    }

    const bounds = new google.maps.LatLngBounds();

    // Add start location marker if it exists
    if (App.currentTrip && App.currentTrip.start_location && App.currentTrip.start_location.latitude) {
        const position = {
            lat: App.currentTrip.start_location.latitude,
            lng: App.currentTrip.start_location.longitude
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
            map: App.map,
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
                    <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(App.currentTrip.start_location.address || t('locations.startingLocation'))}</p>
                </div>
            `
        });

        marker.addListener('click', () => {
            App.infoWindows.forEach(iw => iw.close());
            infoWindow.open(App.map, marker);
        });

        App.markers.push(marker);
        App.infoWindows.push(infoWindow);
        bounds.extend(position);
    }

    if (App.stops.length === 0 && (!App.currentTrip || !App.currentTrip.start_location)) return;

    // Add markers for each stop

    App.stops.forEach((stop, index) => {
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
                map: App.map,
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
                App.infoWindows.forEach(iw => iw.close());
                infoWindow.open(App.map, marker);
            });

            App.markers.push(marker);
            App.infoWindows.push(infoWindow);
            bounds.extend(position);
        }
    });

    // Add markers for waypoints
    App.waypoints.forEach((waypoint) => {
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
                map: App.map,
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
                App.infoWindows.forEach(iw => iw.close());
                infoWindow.open(App.map, marker);
            });

            App.markers.push(marker);
            App.infoWindows.push(infoWindow);
            bounds.extend(position);
        }
    });

    // Add end location marker if it exists
    if (App.currentTrip && App.currentTrip.end_location && App.currentTrip.end_location.latitude) {
        const position = {
            lat: App.currentTrip.end_location.latitude,
            lng: App.currentTrip.end_location.longitude
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
            map: App.map,
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
                    <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(App.currentTrip.end_location.address || t('locations.endingLocation'))}</p>
                </div>
            `
        });

        marker.addListener('click', () => {
            App.infoWindows.forEach(iw => iw.close());
            infoWindow.open(App.map, marker);
        });

        App.markers.push(marker);
        App.infoWindows.push(infoWindow);
        bounds.extend(position);
    }

    // Fit map to show all markers
    if (App.markers.length > 0) {
        App.map.fitBounds(bounds);
        if (App.markers.length === 1) {
            App.map.setZoom(12);
        }
    }
}

function drawRoute(routeData) {
    if (!App.map || !routeData || !routeData.segments) return;

    // Clear existing route path
    if (App.routePath) {
        App.routePath.setMap(null);
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
        App.stops.forEach(stop => {
            if (stop.latitude && stop.longitude) {
                allPathCoordinates.push({ lat: stop.latitude, lng: stop.longitude });
            }
        });
    }

    if (allPathCoordinates.length < 2) return;

    // Draw the route following roads
    App.routePath = new google.maps.Polyline({
        path: allPathCoordinates,
        geodesic: false, // Set to false since we're using exact road paths
        strokeColor: '#0066cc',
        strokeOpacity: 0.8,
        strokeWeight: 4
    });

    App.routePath.setMap(App.map);
}

function showStopOnMap(stopId) {
    const stopIndex = App.stops.findIndex(s => s.id === stopId);
    const stop = App.stops[stopIndex];

    if (!stop || !stop.latitude || !stop.longitude) {
        showError(t('map.unableToShow'));
        return;
    }

    if (!App.map) {
        showError(t('map.notInitialized'));
        return;
    }

    // Center map on the stop
    const position = { lat: stop.latitude, lng: stop.longitude };
    App.map.setCenter(position);
    App.map.setZoom(14);

    // Close all info windows and open the selected one
    if (stopIndex !== -1 && App.markers[stopIndex] && App.infoWindows[stopIndex]) {
        App.infoWindows.forEach(iw => iw.close());
        App.infoWindows[stopIndex].open(App.map, App.markers[stopIndex]);
    }

    // Scroll to map on mobile/small screens
    const mapElement = document.getElementById('map');
    if (mapElement && window.innerWidth < 1024) {
        mapElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Expose on TripApp
App.initMap = initMap;
App.updateMap = updateMap;
App.drawRoute = drawRoute;
App.showStopOnMap = showStopOnMap;

// Expose on window
window.initMap = App.initMap;
window.updateMap = App.updateMap;
window.drawRoute = App.drawRoute;
window.showStopOnMap = App.showStopOnMap;
})();
