"""
Tests for road stop (undated stop) display in trip details.

Road stops are stops without dates — previously called waypoints.
They appear in the ordered chain between overnight stops.

These tests verify that the backend:
  1. Returns all stops (including road stops) in correct order via
     GET /api/trips/<id>/stops.
  2. Returns all locations in correct order via
     GET /api/trips/<id>/debug/route-points.
"""
import json


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


def test_two_consecutive_road_stops_appear_in_trip_details(client):
    """
    When two road stops are added between the same pair of overnight stops,
    both must be returned by the stops endpoint and appear (in order) in the route.

    Chain created
    -------------
      Oslo  →  Viewpoint  →  Rest stop  →  Bergen

    Both road stops have the first stop (Oslo) as their chain ancestor, but only
    Viewpoint's previous_location_guid equals Oslo's guid directly; Rest stop's
    previous_location_guid equals Viewpoint's guid.

    Assertions
    ----------
    1. GET /api/trips/<id>/stops  → 4 stops returned, including road stops.
    2. GET /api/trips/<id>/debug/route-points → order is
       [Oslo, Viewpoint, Rest stop, Bergen].
    """
    trip_id = post_json(client, '/api/trips', {'name': 'Two road stops test'}).get_json()['id']

    # Stop 1
    stop_a = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Oslo',
        'start_date': '2026-07-01',
        'end_date': '2026-07-04',
        'location_type': 'gps',
        'latitude': 59.9139,
        'longitude': 10.7522,
    }).get_json()

    # Road stop 1 — explicitly after Oslo (no dates)
    rs1 = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Viewpoint',
        'location_type': 'gps',
        'latitude': 60.0000,
        'longitude': 8.0000,
        'previous_location_guid': stop_a['guid'],
    }).get_json()

    # Road stop 2 — after road stop 1 (no dates)
    rs2 = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Rest stop',
        'location_type': 'gps',
        'latitude': 60.2000,
        'longitude': 7.0000,
    }).get_json()

    # Stop 2 — auto-appends after road stop 2
    stop_b = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Bergen',
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
        'location_type': 'gps',
        'latitude': 60.3913,
        'longitude': 5.3221,
    }).get_json()

    # ── 1. All stops returned ─────────────────────────────────────────────────
    stops_resp = client.get(f'/api/trips/{trip_id}/stops')
    assert stops_resp.status_code == 200
    all_names = {s['name'] for s in stops_resp.get_json()}
    assert {'Oslo', 'Viewpoint', 'Rest stop', 'Bergen'} == all_names, (
        f"Expected all 4 stops but got: {all_names}"
    )

    # ── 2. Route preserves the full order ────────────────────────────────────
    route_resp = client.get(f'/api/trips/{trip_id}/debug/route-points')
    assert route_resp.status_code == 200
    route_names = [p['name'] for p in route_resp.get_json()['points']]
    assert route_names == ['Oslo', 'Viewpoint', 'Rest stop', 'Bergen'], (
        f"Expected ['Oslo', 'Viewpoint', 'Rest stop', 'Bergen'] but got {route_names}."
    )
