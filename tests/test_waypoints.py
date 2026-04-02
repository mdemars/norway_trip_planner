"""
Tests for waypoint display in trip details.

The frontend renders waypoints after a stop by filtering:
    waypoints.filter(w => w.previous_location_guid === stop.guid)

This only catches waypoints that follow a stop directly.  A second waypoint
that follows the first waypoint (previous_location_guid = waypoint1.guid)
is invisible to that filter and therefore disappears from the trip detail UI.

These tests verify that the backend:
  1. Returns ALL waypoints via GET /api/trips/<id>/waypoints.
  2. Returns all waypoints in correct order via
     GET /api/trips/<id>/debug/route-points.
"""
import json


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


def test_two_consecutive_waypoints_appear_in_trip_details(client):
    """
    When two waypoints are added between the same pair of stops, both must be
    returned by the waypoints endpoint and appear (in order) in the route.

    Chain created
    -------------
      Oslo  →  Viewpoint  →  Rest stop  →  Bergen

    Both waypoints have the first stop (Oslo) as their chain ancestor, but only
    Viewpoint's previous_location_guid equals Oslo's guid directly; Rest stop's
    previous_location_guid equals Viewpoint's guid.

    Assertions
    ----------
    1. GET /api/trips/<id>/waypoints  → 2 waypoints returned.
    2. GET /api/trips/<id>/debug/route-points → order is
       [Oslo, Viewpoint, Rest stop, Bergen].
    """
    trip_id = post_json(client, '/api/trips', {'name': 'Two waypoints test'}).get_json()['id']

    # Stop 1
    stop_a = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Oslo',
        'start_date': '2026-07-01',
        'end_date': '2026-07-04',
        'location_type': 'gps',
        'latitude': 59.9139,
        'longitude': 10.7522,
    }).get_json()

    # Waypoint 1 — explicitly after Oslo
    wp1 = post_json(client, f'/api/trips/{trip_id}/waypoints', {
        'name': 'Viewpoint',
        'location_type': 'gps',
        'latitude': 60.0000,
        'longitude': 8.0000,
        'previous_location_guid': stop_a['guid'],
    }).get_json()

    # Waypoint 2 — auto-appends after Waypoint 1 (last location by id)
    wp2 = post_json(client, f'/api/trips/{trip_id}/waypoints', {
        'name': 'Rest stop',
        'location_type': 'gps',
        'latitude': 60.2000,
        'longitude': 7.0000,
    }).get_json()

    # Stop 2 — auto-appends after Waypoint 2
    stop_b = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Bergen',
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
        'location_type': 'gps',
        'latitude': 60.3913,
        'longitude': 5.3221,
    }).get_json()

    # ── 1. Both waypoints are returned by the waypoints endpoint ─────────────
    wp_resp = client.get(f'/api/trips/{trip_id}/waypoints')
    assert wp_resp.status_code == 200
    waypoints = wp_resp.get_json()
    waypoint_names = {w['name'] for w in waypoints}
    assert waypoint_names == {'Viewpoint', 'Rest stop'}, (
        f"Expected both waypoints but got: {waypoint_names}"
    )

    # ── 2. Route preserves the full order ────────────────────────────────────
    route_resp = client.get(f'/api/trips/{trip_id}/debug/route-points')
    assert route_resp.status_code == 200
    route_names = [p['name'] for p in route_resp.get_json()['points']]
    assert route_names == ['Oslo', 'Viewpoint', 'Rest stop', 'Bergen'], (
        f"Expected ['Oslo', 'Viewpoint', 'Rest stop', 'Bergen'] but got {route_names}."
    )
