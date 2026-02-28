// ============================================================================
// Global State
// ============================================================================

window.TripApp = window.TripApp || {};

window.TripApp.currentTrip = null;
window.TripApp.stops = [];
window.TripApp.waypoints = [];
window.TripApp.map = null;
window.TripApp.markers = [];
window.TripApp.infoWindows = [];
window.TripApp.routePath = null;
window.TripApp.pendingStopUpdate = null; // Store pending update data for duration change

// 8 distinct colors for stops
window.TripApp.STOP_COLORS = [
    '#4285F4', // Blue
    '#34A853', // Green
    '#FBBC04', // Yellow
    '#EA4335', // Red
    '#9334E6', // Purple
    '#FF6D00', // Orange
    '#00ACC1', // Cyan
    '#E91E63'  // Pink
];
