// ============================================================================
// API Functions
// ============================================================================

(function() {
    const App = window.TripApp;

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

// Attach all API functions to window.TripApp
App.fetchTrip = fetchTrip;
App.updateTrip = updateTrip;
App.deleteTrip = deleteTrip;
App.fetchStops = fetchStops;
App.createStop = createStop;
App.updateStop = updateStop;
App.deleteStopApi = deleteStopApi;
App.createActivity = createActivity;
App.deleteActivity = deleteActivity;
App.calculateRoute = calculateRoute;
App.fetchWaypoints = fetchWaypoints;
App.createWaypoint = createWaypoint;
App.deleteWaypoint = deleteWaypoint;

// Expose API functions globally for use by other modules
window.fetchTrip = fetchTrip;
window.updateTrip = updateTrip;
window.deleteTrip = deleteTrip;
window.fetchStops = fetchStops;
window.createStop = createStop;
window.updateStop = updateStop;
window.deleteStopApi = deleteStopApi;
window.createActivity = createActivity;
window.deleteActivity = deleteActivity;
window.calculateRoute = calculateRoute;
window.fetchWaypoints = fetchWaypoints;
window.createWaypoint = createWaypoint;
window.deleteWaypoint = deleteWaypoint;
})();
